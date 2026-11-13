import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderRequest, PublicOrder } from '../../shared/commerce';
import { ApiError, checkAddress, createOrder, getCheckoutPricing, getOrder, simulateMockPayment } from './api';

const input: CreateOrderRequest = {
  requestId: '019a6215-d300-4000-8000-000000000001',
  customer: { name: 'Buyer', email: 'buyer@example.test', phone: '+85512345678' },
  address: { street: 'Street 1', city: 'Phnom Penh', region: 'Phnom Penh', postalCode: '12000', country: 'Cambodia' },
  delivery: 'standard', lines: [{ productId: 1, size: 'M', color: 'Black', quantity: 2 }],
};
const order: PublicOrder = {
  id: 'order-1', status: 'awaiting_payment', createdAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z',
  merchantName: 'Stussy Collection',
  deliveryLabel: 'Standard delivery', currency: 'USD', subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800,
  lines: [{ productId: 1, slug: 'tee', name: 'Tee', image: '/tee.png', size: 'M', color: 'Black', quantity: 2, unitPriceMinor: 4800 }],
  payment: { status: 'pending', qrDataUrl: 'data:image/png;base64,AAAA', expiresAt: '2026-11-09T00:15:00.000Z', providerReference: 'mock-1' }, mockMode: true,
};
afterEach(() => vi.unstubAllGlobals());

describe('shop API client', () => {
  it('checks the delivery location before advancing checkout', async () => {
    const address = { city: 'Phnom Penh', region: 'Phnom Penh', country: 'Cambodia' };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ address, errors: {} })));
    vi.stubGlobal('fetch', fetch);
    expect(await checkAddress(address)).toEqual({ address, errors: {} });
    expect(fetch).toHaveBeenCalledWith('/api/validate-address', expect.objectContaining({
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(address),
    }));
  });
  it('loads and validates the public checkout pricing contract', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ unitPriceMinor: 1, freeShipping: true })));
    vi.stubGlobal('fetch', fetch);
    expect(await getCheckoutPricing()).toEqual({ unitPriceMinor: 1, freeShipping: true });
    expect(fetch).toHaveBeenCalledWith('/api/checkout-pricing', { signal: undefined });
  });
  it.each([null, {}, { unitPriceMinor: 0, freeShipping: true }, { unitPriceMinor: 1, freeShipping: 'true' }])('rejects malformed public pricing: %j', async pricing => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(pricing))));
    await expect(getCheckoutPricing()).rejects.toMatchObject({ status: 500, message: 'The shop service is temporarily unavailable.' });
  });
  it('posts a typed checkout request as JSON and returns the server order', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(order), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    expect(await createOrder(input)).toEqual(order);
    expect(fetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }));
  });
  it('encodes order identifiers and forwards abort signals when loading orders', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(order)));
    vi.stubGlobal('fetch', fetch);
    const signal = new AbortController().signal;
    expect(await getOrder('order/with ?#', signal)).toEqual(order);
    expect(fetch).toHaveBeenCalledWith('/api/orders/order%2Fwith%20%3F%23', expect.objectContaining({ signal }));
  });
  it('posts mock payment to the encoded order endpoint', async () => {
    const paid = { ...order, status: 'paid', payment: { ...order.payment, status: 'paid' } };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify(paid)));
    vi.stubGlobal('fetch', fetch);
    expect(await simulateMockPayment('order/1')).toEqual(paid);
    expect(fetch).toHaveBeenCalledWith('/api/orders/order%2F1/mock-payment', expect.objectContaining({ method: 'POST' }));
  });
  it('exposes a structured 404 as an ApiError with the public message and status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'not_found', message: 'Order or endpoint not found.' } }), { status: 404 })));
    const error = await getOrder('missing').catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, message: 'Order or endpoint not found.' });
  });
  it.each(['<html>Internal database secret</html>', '{broken', JSON.stringify({ error: { message: 123 } }), JSON.stringify({ message: 'private trace' })])('uses a safe message for malformed service errors: %s', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { status: 500 })));
    await expect(createOrder(input)).rejects.toMatchObject({ status: 500, message: 'The shop service is temporarily unavailable.' });
  });
  it('turns transport failures into safe errors without leaking their details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private transport detail')));
    await expect(getOrder('order-1')).rejects.toMatchObject({ status: 0, message: 'The shop service is temporarily unavailable.' });
  });
  it('preserves cancellation so a polling caller can ignore an aborted request', async () => {
    const error = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
    await expect(getOrder('order-1', new AbortController().signal)).rejects.toBe(error);
  });
});
