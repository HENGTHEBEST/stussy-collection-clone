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

afterEach(async () => {
  for (const repository of repositories.splice(0)) await repository.close();
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('SqliteOrderRepository', () => {
  it('returns asynchronous results while preserving request idempotency and transaction uniqueness', async () => {
    const repository = open();
    await expect(repository.createOrder(fixture())).resolves.toMatchObject({ id: 'order-1' });
    await expect(repository.createOrder({ ...fixture('retry'), requestId: 'request-order-1' }))
      .resolves.toMatchObject({ id: 'order-1', totalMinor: 10800 });
    await repository.createOrder(fixture('order-2'));
    await expect(repository.markPaid('order-1', 'provider-hash', paidAt)).resolves.toBe(true);
    await expect(repository.markPaid('order-2', 'provider-hash', paidAt)).rejects.toThrow();
    await expect(repository.findById('order-2')).resolves.toMatchObject({
      status: 'awaiting_payment', payment: { status: 'pending', transactionHash: null },
    });
    await expect(repository.close()).resolves.toBeUndefined();
  });

  it('finds an order by its provider reference', async () => {
    const repository = open();
    const created = await repository.createOrder(fixture());
    expect(await repository.findByProviderReference(created.payment.providerReference)).toEqual(created);
  });

  it('stores the full order, trusted line snapshot, and private payment details', async () => {
    const repository = open();
    const created = await repository.createOrder(fixture());
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
    expect(await repository.findById(created.id)).toEqual(created);
    expect(await repository.findByRequestId(created.requestId)).toEqual(created);
    expect(created.lines).toEqual(fixture().lines);
  });

  it('retrieves a committed order through a new file-backed repository instance', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'stussy-orders-'));
    directories.push(directory);
    const path = join(directory, 'orders.sqlite');
    const first = open(path);
    await first.createOrder(fixture());
    await first.markPaid('order-1', 'persisted-hash', paidAt);
    await first.close();
    const reopened = open(path);
    expect(await reopened.findByRequestId('request-order-1')).toMatchObject({
      id: 'order-1', status: 'paid', updatedAt: paidAt,
      payment: { status: 'paid', transactionHash: 'persisted-hash' },
    });
  });

  it('returns the original order for a duplicate requestId without changing its contents', async () => {
    const repository = open();
    const original = await repository.createOrder(fixture());
    await repository.markPaid(original.id, 'original-hash', paidAt);
    const retry = { ...fixture('different-id'), requestId: original.requestId, totalMinor: 1 };
    expect(await repository.createOrder(retry)).toEqual(await repository.findById(original.id));
    expect(await repository.findById('different-id')).toBeNull();
    expect(await repository.findById(original.id)).toMatchObject({ totalMinor: 10800, status: 'paid' });
  });

  it('rolls back order and line inserts if payment creation fails', async () => {
    const repository = open();
    const invalid = fixture();
    invalid.payment.status = 'invalid' as typeof invalid.payment.status;
    await expect(repository.createOrder(invalid)).rejects.toThrow();
    expect(await repository.findById(invalid.id)).toBeNull();
    expect(await repository.findByRequestId(invalid.requestId)).toBeNull();
    expect(await repository.createOrder(fixture())).toMatchObject({ id: 'order-1', lines: [{ quantity: 2 }] });
  });

  it('preserves line order and separate sizes when the same product appears twice', async () => {
    const repository = open();
    const input = fixture();
    input.lines.push({ ...input.lines[0], size: 'L', quantity: 1 });
    input.subtotalMinor = 14400;
    input.totalMinor = 15600;
    await repository.createOrder(input);
    expect((await repository.findById(input.id))?.lines.map(({ size, quantity }) => ({ size, quantity })))
      .toEqual([{ size: 'M', quantity: 2 }, { size: 'L', quantity: 1 }]);
  });

  it('updates both statuses atomically and accepts the same paid transaction idempotently', async () => {
    const repository = open();
    await repository.createOrder(fixture());
    expect(await repository.markPaid('order-1', 'mock-hash', paidAt)).toBe(true);
    expect(await repository.markPaid('order-1', 'mock-hash', later)).toBe(true);
    expect(await repository.findById('order-1')).toMatchObject({
      status: 'paid', updatedAt: paidAt, payment: { status: 'paid', transactionHash: 'mock-hash' },
    });
    expect(await repository.markPaid('order-1', 'replacement-hash', later)).toBe(false);
    expect((await repository.findById('order-1'))?.payment.transactionHash).toBe('mock-hash');
  });

  it.each(['markFailed', 'markExpired'] as const)('rejects %s for a paid order', async (method) => {
    const repository = open();
    await repository.createOrder(fixture());
    await repository.markPaid('order-1', 'mock-hash', paidAt);
    await expect(repository[method]('order-1', later)).rejects.toThrow(/paid/i);
    expect(await repository.findById('order-1')).toMatchObject({
      status: 'paid', updatedAt: paidAt, payment: { status: 'paid', transactionHash: 'mock-hash' },
    });
  });

  it.each([
    ['markFailed', 'failed'], ['markExpired', 'expired'],
  ] as const)('applies %s to both records and keeps terminal orders terminal', async (method, status) => {
    const repository = open();
    await repository.createOrder(fixture());
    expect(await repository[method]('order-1', paidAt)).toBe(true);
    expect(await repository[method]('order-1', later)).toBe(true);
    expect(await repository.markPaid('order-1', 'too-late-hash', later)).toBe(false);
    const other = method === 'markFailed' ? 'markExpired' : 'markFailed';
    expect(await repository[other]('order-1', later)).toBe(false);
    expect(await repository.findById('order-1')).toMatchObject({
      status, updatedAt: paidAt, payment: { status, transactionHash: null },
    });
  });

  it('prevents a transaction hash from paying two orders and rolls back the losing update', async () => {
    const repository = open();
    await repository.createOrder(fixture());
    await repository.createOrder(fixture('order-2'));
    await repository.markPaid('order-1', 'shared-hash', paidAt);
    await expect(repository.markPaid('order-2', 'shared-hash', paidAt)).rejects.toThrow(/unique/i);
    expect(await repository.findById('order-2')).toMatchObject({
      status: 'awaiting_payment', updatedAt: createdAt,
      payment: { status: 'pending', transactionHash: null },
    });
    expect(await repository.markPaid('order-2', 'different-hash', paidAt)).toBe(true);
  });

  it.each(['markPaid', 'markFailed', 'markExpired'] as const)('rolls back %s if its payment status guard rejects the change', async (method) => {
    const repository = open();
    const input = fixture();
    input.payment.status = 'expired';
    await repository.createOrder(input);
    await expect(method === 'markPaid'
      ? repository.markPaid(input.id, 'mock-hash', paidAt)
      : repository[method](input.id, paidAt)).rejects.toThrow(/payment/i);
    expect(await repository.findById(input.id)).toMatchObject({
      status: 'awaiting_payment', updatedAt: createdAt,
      payment: { status: 'expired', transactionHash: null },
    });
  });

  it('returns null or false for unknown orders', async () => {
    const repository = open();
    expect(await repository.findById('missing')).toBeNull();
    expect(await repository.findByRequestId('missing')).toBeNull();
    expect(await repository.findByProviderReference('missing')).toBeNull();
    expect(await repository.markPaid('missing', 'hash', paidAt)).toBe(false);
    expect(await repository.markFailed('missing', paidAt)).toBe(false);
    expect(await repository.markExpired('missing', paidAt)).toBe(false);
  });
});
