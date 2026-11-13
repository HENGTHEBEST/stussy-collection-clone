// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateStoredOrderInput } from './order-repository.js';
import { SupabaseOrderRepository } from './supabase-order-repository.js';

const order: CreateStoredOrderInput = {
  id: '00000000-0000-4000-8000-000000000001',
  requestId: '00000000-0000-4000-8000-000000000002',
  status: 'awaiting_payment',
  createdAt: '2026-11-11T10:00:00+00:00', updatedAt: '2026-11-11T10:00:00+00:00',
  customer: { name: 'Sam', email: 'sam@example.test', phone: '+85512345678' },
  address: { street: '12 Test Street', city: 'Phnom Penh', region: 'Phnom Penh', postalCode: '12000', country: 'Cambodia' },
  delivery: 'standard', deliveryLabel: 'Standard delivery', currency: 'USD',
  subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800, mockMode: true,
  lines: [
    { productId: 1, slug: 'tee', name: 'Tee', image: '/tee.png', size: 'M', color: 'Black', quantity: 1, unitPriceMinor: 4800 },
    { productId: 1, slug: 'tee', name: 'Tee', image: '/tee.png', size: 'L', color: 'Black', quantity: 1, unitPriceMinor: 4800 },
  ],
  payment: {
    status: 'pending', qrDataUrl: 'data:image/png;base64,test',
    expiresAt: '2026-11-11T10:10:00+00:00', providerReference: 'provider-order-1',
    qrPayload: 'mock-khqr', md5: 'mock-md5', transactionHash: null,
  },
};
const changedAt = '2026-11-11T10:01:00.000Z';

afterEach(() => vi.unstubAllGlobals());

// Only the external HTTP transport is replaced; the Supabase client and adapter are real.
function open(data: unknown) {
  const requests: { name: string; args: unknown }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ name: new URL(String(input)).pathname, args: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  return {
    repository: new SupabaseOrderRepository('https://project.supabase.co', 'test-service-role-key'),
    requests,
  };
}

describe('SupabaseOrderRepository', () => {
  it('creates through the atomic RPC and preserves its original snapshot on request-id retries', async () => {
    const { repository, requests } = open(order);
    await expect(repository.createOrder(order)).resolves.toEqual(order);
    const retry = { ...order, id: '00000000-0000-4000-8000-000000000003', totalMinor: 1 };
    await expect(repository.createOrder(retry)).resolves.toEqual(order);
    expect(requests).toEqual([
      { name: '/rest/v1/rpc/create_order', args: { payload: order } },
      { name: '/rest/v1/rpc/create_order', args: { payload: retry } },
    ]);
  });

  it.each([
    ['findById', order.id, 'get_order', { target_id: order.id }],
    ['findByRequestId', order.requestId, 'get_order_by_request_id', { target_request_id: order.requestId }],
    ['findByProviderReference', 'provider-order-1', 'get_order_by_provider_reference', { target_reference: 'provider-order-1' }],
  ] as const)('reads full snapshots through %s and handles absent orders', async (method, value, rpc, args) => {
    const { repository, requests } = open(order);
    await expect(repository[method](value)).resolves.toEqual(order);
    expect(requests).toEqual([{ name: '/rest/v1/rpc/' + rpc, args }]);
    open(null);
    await expect(repository[method](value)).resolves.toBeNull();
  });

  it.each([
    ['markPaid', 'mark_order_paid', { target_id: order.id, target_hash: 'provider-hash', changed_at: changedAt }],
    ['markFailed', 'mark_order_unpaid', { target_id: order.id, target_status: 'failed', changed_at: changedAt }],
    ['markExpired', 'mark_order_unpaid', { target_id: order.id, target_status: 'expired', changed_at: changedAt }],
  ] as const)('delegates %s guards to the atomic RPC and preserves rejected transitions', async (method, rpc, args) => {
    const { repository, requests } = open(true);
    const change = () => method === 'markPaid'
      ? repository.markPaid(order.id, 'provider-hash', changedAt)
      : repository[method](order.id, changedAt);
    await expect(change()).resolves.toBe(true);
    expect(requests).toEqual([{ name: '/rest/v1/rpc/' + rpc, args }]);
    open(false);
    await expect(change()).resolves.toBe(false);
  });

  it('rejects an empty creation response', async () => {
    const { repository } = open(null);
    await expect(repository.createOrder(order)).rejects.toThrow('Order storage is unavailable.');
  });

  it.each(['createOrder', 'findById', 'findByRequestId', 'findByProviderReference', 'markPaid', 'markFailed', 'markExpired'] as const)(
    'sanitizes %s database errors', async (method) => {
      const { repository } = open(null);
      vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
        code: '23505', message: 'private database detail and test-service-role-key', details: 'transaction_hash duplicate', hint: null,
      }), { status: 409, headers: { 'Content-Type': 'application/json' } })));
      const operation = method === 'createOrder' ? repository.createOrder(order)
        : method === 'markPaid' ? repository.markPaid(order.id, 'reused-provider-hash', changedAt)
          : method === 'markFailed' || method === 'markExpired' ? repository[method](order.id, changedAt)
            : repository[method](order.id);
      await expect(operation).rejects.toThrow(/^Order storage is unavailable[.]$/);
    },
  );

  it('sanitizes rejected transport promises', async () => {
    const rpc = vi.fn().mockRejectedValue(new Error('private transport detail and test-service-role-key'));
    const repository = new SupabaseOrderRepository('https://project.supabase.co', 'test-service-role-key', { rpc });
    await expect(repository.findById(order.id)).rejects.toThrow(/^Order storage is unavailable[.]$/);
    await expect(repository.markPaid(order.id, 'provider-hash', changedAt)).rejects.toThrow(/^Order storage is unavailable[.]$/);
  });

  it('closes asynchronously without requiring a database connection', async () => {
    const repository = new SupabaseOrderRepository('https://project.supabase.co', 'test-service-role-key');
    await expect(repository.close()).resolves.toBeUndefined();
  });
});
