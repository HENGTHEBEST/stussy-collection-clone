// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { priceOrder } from '../catalog/order-pricing.js';
import type { CreateStoredOrderInput } from './order-repository.js';
import { SqliteOrderRepository } from './sqlite-order-repository.js';

const createdAt = '2026-11-09T10:00:00.000Z';
const paidAt = '2026-11-09T10:01:00.000Z';
const later = '2026-11-09T10:02:00.000Z';

function fixture(id = 'order-1'): CreateStoredOrderInput {
  return {
    id,
    requestId: 'request-' + id,
    status: 'awaiting_payment',
    createdAt,
    updatedAt: createdAt,
    customer: { name: "Sam O'Connor", email: 'sam@example.test', phone: '+85512345678' },
    address: { street: '12 Test Street', city: 'Phnom Penh', region: 'Phnom Penh', postalCode: '12000', country: 'Cambodia' },
    delivery: 'standard',
    deliveryLabel: 'Standard delivery',
    currency: 'USD',
    ...priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity: 2 }], 'standard'),
    mockMode: true,
    payment: {
      status: 'pending', qrDataUrl: 'data:image/png;base64,test',
      expiresAt: '2026-11-09T10:10:00.000Z', providerReference: 'provider-' + id,
      qrPayload: 'mock-khqr-' + id, md5: 'md5-' + id, transactionHash: null,
    },
  };
}

const repositories: SqliteOrderRepository[] = [];
const directories: string[] = [];
function open(path = ':memory:') {
  const repository = new SqliteOrderRepository(path);
  repositories.push(repository);
  return repository;
}

afterEach(() => {
  for (const repository of repositories.splice(0)) repository.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('SqliteOrderRepository', () => {
  it('stores the full order, trusted line snapshot, and private payment details', () => {
    const repository = open();
    const created = repository.createOrder(fixture());
    expect(created).toMatchObject({
      id: 'order-1', requestId: 'request-order-1', status: 'awaiting_payment',
      createdAt, updatedAt: createdAt, currency: 'USD', mockMode: true,
      customer: { name: "Sam O'Connor", email: 'sam@example.test', phone: '+85512345678' },
      address: { street: '12 Test Street', city: 'Phnom Penh', region: 'Phnom Penh', postalCode: '12000', country: 'Cambodia' },
      delivery: 'standard', deliveryLabel: 'Standard delivery',
      subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800,
      lines: [{ productId: 1, unitPriceMinor: 4800, quantity: 2, size: 'M', color: 'Black' }],
      payment: { status: 'pending', qrDataUrl: 'data:image/png;base64,test',
        expiresAt: '2026-11-09T10:10:00.000Z', providerReference: 'provider-order-1',
        qrPayload: 'mock-khqr-order-1', md5: 'md5-order-1', transactionHash: null },
    });
    expect(repository.findById(created.id)).toEqual(created);
    expect(repository.findByRequestId(created.requestId)).toEqual(created);
    expect(created.lines).toEqual(fixture().lines);
  });

  it('retrieves a committed order through a new file-backed repository instance', () => {
    const directory = mkdtempSync(join(tmpdir(), 'stussy-orders-'));
    directories.push(directory);
    const path = join(directory, 'orders.sqlite');
    const first = open(path);
    first.createOrder(fixture());
    first.markPaid('order-1', 'persisted-hash', paidAt);
    first.close();
    const reopened = open(path);
    expect(reopened.findByRequestId('request-order-1')).toMatchObject({
      id: 'order-1', status: 'paid', updatedAt: paidAt,
      payment: { status: 'paid', transactionHash: 'persisted-hash' },
    });
  });

  it('returns the original order for a duplicate requestId without changing its contents', () => {
    const repository = open();
    const original = repository.createOrder(fixture());
    repository.markPaid(original.id, 'original-hash', paidAt);
    const retry = { ...fixture('different-id'), requestId: original.requestId, totalMinor: 1 };
    expect(repository.createOrder(retry)).toEqual(repository.findById(original.id));
    expect(repository.findById('different-id')).toBeNull();
    expect(repository.findById(original.id)).toMatchObject({ totalMinor: 10800, status: 'paid' });
  });

  it('rolls back order and line inserts if payment creation fails', () => {
    const repository = open();
    const invalid = fixture();
    invalid.payment.status = 'invalid' as typeof invalid.payment.status;
    expect(() => repository.createOrder(invalid)).toThrow();
    expect(repository.findById(invalid.id)).toBeNull();
    expect(repository.findByRequestId(invalid.requestId)).toBeNull();
    expect(repository.createOrder(fixture())).toMatchObject({ id: 'order-1', lines: [{ quantity: 2 }] });
  });

  it('preserves line order and separate sizes when the same product appears twice', () => {
    const repository = open();
    const input = fixture();
    input.lines.push({ ...input.lines[0], size: 'L', quantity: 1 });
    input.subtotalMinor = 14400;
    input.totalMinor = 15600;
    repository.createOrder(input);
    expect(repository.findById(input.id)?.lines.map(({ size, quantity }) => ({ size, quantity })))
      .toEqual([{ size: 'M', quantity: 2 }, { size: 'L', quantity: 1 }]);
  });

  it('updates both statuses atomically and accepts the same paid transaction idempotently', () => {
    const repository = open();
    repository.createOrder(fixture());
    expect(repository.markPaid('order-1', 'mock-hash', paidAt)).toBe(true);
    expect(repository.markPaid('order-1', 'mock-hash', later)).toBe(true);
    expect(repository.findById('order-1')).toMatchObject({
      status: 'paid', updatedAt: paidAt, payment: { status: 'paid', transactionHash: 'mock-hash' },
    });
    expect(repository.markPaid('order-1', 'replacement-hash', later)).toBe(false);
    expect(repository.findById('order-1')?.payment.transactionHash).toBe('mock-hash');
  });

  it.each(['markFailed', 'markExpired'] as const)('rejects %s for a paid order', (method) => {
    const repository = open();
    repository.createOrder(fixture());
    repository.markPaid('order-1', 'mock-hash', paidAt);
    expect(() => repository[method]('order-1', later)).toThrow(/paid/i);
    expect(repository.findById('order-1')).toMatchObject({
      status: 'paid', updatedAt: paidAt, payment: { status: 'paid', transactionHash: 'mock-hash' },
    });
  });

  it.each([
    ['markFailed', 'failed'], ['markExpired', 'expired'],
  ] as const)('applies %s to both records and keeps terminal orders terminal', (method, status) => {
    const repository = open();
    repository.createOrder(fixture());
    expect(repository[method]('order-1', paidAt)).toBe(true);
    expect(repository[method]('order-1', later)).toBe(true);
    expect(repository.markPaid('order-1', 'too-late-hash', later)).toBe(false);
    const other = method === 'markFailed' ? 'markExpired' : 'markFailed';
    expect(repository[other]('order-1', later)).toBe(false);
    expect(repository.findById('order-1')).toMatchObject({
      status, updatedAt: paidAt, payment: { status, transactionHash: null },
    });
  });

  it('prevents a transaction hash from paying two orders and rolls back the losing update', () => {
    const repository = open();
    repository.createOrder(fixture());
    repository.createOrder(fixture('order-2'));
    repository.markPaid('order-1', 'shared-hash', paidAt);
    expect(() => repository.markPaid('order-2', 'shared-hash', paidAt)).toThrow(/unique/i);
    expect(repository.findById('order-2')).toMatchObject({
      status: 'awaiting_payment', updatedAt: createdAt,
      payment: { status: 'pending', transactionHash: null },
    });
    expect(repository.markPaid('order-2', 'different-hash', paidAt)).toBe(true);
  });

  it.each(['markPaid', 'markFailed', 'markExpired'] as const)('rolls back %s if its payment status guard rejects the change', (method) => {
    const repository = open();
    const input = fixture();
    input.payment.status = 'expired';
    repository.createOrder(input);
    expect(() => method === 'markPaid'
      ? repository.markPaid(input.id, 'mock-hash', paidAt)
      : repository[method](input.id, paidAt)).toThrow(/payment/i);
    expect(repository.findById(input.id)).toMatchObject({
      status: 'awaiting_payment', updatedAt: createdAt,
      payment: { status: 'expired', transactionHash: null },
    });
  });

  it('returns null or false for unknown orders', () => {
    const repository = open();
    expect(repository.findById('missing')).toBeNull();
    expect(repository.findByRequestId('missing')).toBeNull();
    expect(repository.markPaid('missing', 'hash', paidAt)).toBe(false);
    expect(repository.markFailed('missing', paidAt)).toBe(false);
    expect(repository.markExpired('missing', paidAt)).toBe(false);
  });
});
