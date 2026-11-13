// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderRequest } from '../../shared/commerce.js';
import type { PaymentGateway } from '../payments/payment-gateway.js';
import { MockBakongGateway } from '../payments/mock-bakong-gateway.js';
import { PayWayGateway } from '../payments/payway-gateway.js';
import { createOrderRequest, fixedExpiry, fixedNow } from '../test/fixtures.js';
import { SqliteOrderRepository } from './sqlite-order-repository.js';
import { OrderService, OrderValidationError } from './order-service.js';

let repository: SqliteOrderRepository;
let gateway: MockBakongGateway;
let service: OrderService;
let time: Date;
beforeEach(() => {
  time = new Date(fixedNow);
  repository = new SqliteOrderRepository(':memory:');
  gateway = new MockBakongGateway(() => time);
  service = new OrderService(repository, gateway, () => time);
});
afterEach(() => repository.close());

describe('OrderService', () => {
  it('rejects invented delivery locations before creating a payment', async () => {
    const createPayment = vi.spyOn(gateway, 'createPayment');
    const request = createOrderRequest();
    request.address.city = 'Madeup City';
    await expect(service.createOrder(request)).rejects.toThrow(OrderValidationError);
    expect(createPayment).not.toHaveBeenCalled();
    expect(await repository.findByRequestId(request.requestId)).toBeNull();
  });
  it('accepts blank optional address fields but rejects non-text values', async () => {
    const request = createOrderRequest();
    request.address.region = ''; request.address.postalCode = '';
    const order = await service.createOrder(request);
    expect((await repository.findById(order.id))?.address).toMatchObject({ region: '', postalCode: '' });
    await expect(service.createOrder({ ...request, address: { ...request.address, region: 123 as unknown as string } })).rejects.toThrow(OrderValidationError);
  });
  it('reconciles a PayWay reference through the trusted payment check and keeps repeats idempotent', async () => {
    const fetcher = vi.fn(async (_url: unknown, options?: RequestInit) => {
      const { tran_id } = JSON.parse(options!.body as string);
      return new Response(JSON.stringify({ status: { code: '00', tran_id },
        data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 108, payment_currency: 'USD' } }));
    });
    const cardGateway = new PayWayGateway({ merchantId: 'sandbox-merchant', apiKey: 'synthetic-key', environment: 'sandbox' },
      'https://shop.example.test', fetcher as typeof fetch, () => time);
    service = new OrderService(repository, gateway, () => time, undefined, 'Test Shop', cardGateway);
    const order = await service.createOrder({ ...createOrderRequest(), paymentMethod: 'card' });
    const check = vi.spyOn(cardGateway, 'checkPayment');
    const paid = await service.reconcilePayWay(order.payment.providerReference);
    expect(paid).toMatchObject({ id: order.id, status: 'paid', payment: { status: 'paid' } });
    expect(check).toHaveBeenCalledExactlyOnceWith({ providerReference: order.payment.providerReference,
      totalMinor: 10800, currency: 'USD', expiresAt: fixedExpiry });
    expect(await repository.findById(order.id)).toMatchObject({ status: 'paid',
      payment: { transactionHash: order.payment.providerReference } });
    expect(await service.reconcilePayWay(order.payment.providerReference)).toEqual(paid);
    expect(check).toHaveBeenCalledTimes(1);
  });

  it.each(['', 'mock-order-1', 'payway-1234', 'payway-1234567890ABCDEF1234', 'payway-1234567890abcdef1234/extra'])
    ('rejects invalid callback reference %j before repository lookup', async reference => {
      const lookup = vi.spyOn(repository, 'findByProviderReference');
      expect(await service.reconcilePayWay(reference)).toBeNull();
      expect(lookup).not.toHaveBeenCalled();
    });

  it('returns null for an unknown PayWay reference', async () => {
    expect(await service.reconcilePayWay('payway-1234567890abcdef1234')).toBeNull();
  });

  it('creates a card order through PayWay and confirms it only after a verified provider result', async () => {
    const paywayFetch = vi.fn(async () => new Response(JSON.stringify({ status: { code: 6, message: 'tran_id not found', tran_id: '' } })));
    const cardGateway = new PayWayGateway({ merchantId: 'sandbox-merchant', apiKey: 'synthetic-key', environment: 'sandbox' },
      'http://localhost:5173', paywayFetch as typeof fetch, () => time);
    service = new OrderService(repository, gateway, () => time, { unitPriceMinor: 1, freeShipping: true }, 'Test Shop', cardGateway);
    const request = { ...createOrderRequest(), paymentMethod: 'card' as const };
    const order = await service.createOrder(request);
    expect(order).toMatchObject({ totalMinor: 2, mockMode: false, payment: { method: 'card', status: 'pending',
      checkout: { fields: { amount: '0.02', payment_option: 'cards' } } } });
    expect(order.payment.qrDataUrl).toBe('');
    expect(JSON.stringify(order)).not.toContain('synthetic-key');
    expect((await repository.findById(order.id))?.payment.providerReference).toMatch(/^payway-/);
    expect(await service.getOrder(order.id)).toMatchObject({ status: 'awaiting_payment' });
    const tranId = order.payment.providerReference.slice('payway-'.length);
    paywayFetch.mockImplementationOnce(async () => new Response(JSON.stringify({ status: { code: '00', tran_id: tranId },
      data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 0.02, payment_currency: 'USD' } })));
    expect(await service.getOrder(order.id)).toMatchObject({ status: 'paid', payment: { method: 'card', status: 'paid' } });
    expect((await repository.findById(order.id))?.payment.transactionHash).toBe(order.payment.providerReference);
  });

  it('rejects card orders while PayWay is unconfigured', async () => {
    await expect(service.createOrder({ ...createOrderRequest(), paymentMethod: 'card' })).rejects.toThrow('not configured');
    expect(await repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
  });

  it('closes card checkout before its payment deadline but accepts a late verified settlement', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: { code: 6, message: 'tran_id not found' } })));
    const cardGateway = new PayWayGateway({ merchantId: 'sandbox-merchant', apiKey: 'synthetic-key', environment: 'sandbox' },
      'http://localhost:5173', fetcher as typeof fetch, () => time);
    service = new OrderService(repository, gateway, () => time, undefined, 'Test Shop', cardGateway);
    const order = await service.createOrder({ ...createOrderRequest(), paymentMethod: 'card' });
    time = new Date(Date.parse(fixedExpiry) - 5 * 60 * 1000);
    expect((await service.getOrder(order.id))?.payment.checkout).toBeUndefined();
    time = new Date(Date.parse(fixedExpiry) + 60_000);
    const tranId = order.payment.providerReference.slice('payway-'.length);
    fetcher.mockImplementationOnce(async () => new Response(JSON.stringify({ status: { code: '00', tran_id: tranId },
      data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 108, payment_currency: 'USD' } })));
    expect(await service.getOrder(order.id)).toMatchObject({ status: 'paid' });
  });
  it('uses the trusted one-cent policy for the order, storage, and provider amount', async () => {
    service = new OrderService(repository, gateway, () => time, { unitPriceMinor: 1, freeShipping: true });
    const createPayment = vi.spyOn(gateway, 'createPayment');
    const input = createOrderRequest();
    Object.assign(input, { totalMinor: 999999, shippingMinor: 999999 });
    Object.assign(input.lines[0], { unitPriceMinor: 999999 });
    const order = await service.createOrder(input);
    expect(order).toMatchObject({
      currency: 'USD', subtotalMinor: 2, shippingMinor: 0, totalMinor: 2,
      lines: [{ unitPriceMinor: 1, quantity: 2 }], payment: { status: 'pending' },
    });
    expect(await repository.findById(order.id)).toMatchObject({ subtotalMinor: 2, shippingMinor: 0, totalMinor: 2 });
    expect(createPayment).toHaveBeenCalledExactlyOnceWith({
      orderId: order.id, totalMinor: 2, currency: 'USD', expiresAt: fixedExpiry,
    });
    const payment = (await repository.findById(order.id))!.payment;
    expect(JSON.parse(payment.qrPayload.slice('mock-khqr:'.length))).toMatchObject({ totalMinor: 2, currency: 'USD' });
  });

  it.each([
    { productId: 999, size: 'M', color: 'Black', quantity: 1 },
    { productId: 6, size: 'M', color: 'Black', quantity: 1 },
    { productId: 1, size: 'XXL', color: 'Black', quantity: 1 },
    { productId: 1, size: 'M', color: 'White', quantity: 1 },
    { productId: 1, size: 'M', color: 'Black', quantity: 0 },
    { productId: 1, size: 'M', color: 'Black', quantity: 11 },
    { productId: 1, size: 'M', color: 'Black', quantity: 1.5 },
  ])('rejects invalid acceptance-price items before provider or storage: %j', async line => {
    service = new OrderService(repository, gateway, () => time, { unitPriceMinor: 1, freeShipping: true });
    const createPayment = vi.spyOn(gateway, 'createPayment');
    await expect(service.createOrder(createOrderRequest({ lines: [line] as CreateOrderRequest['lines'] }))).rejects.toThrow();
    expect(createPayment).not.toHaveBeenCalled();
    expect(await repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
  });

  it('ignores browser money and status, computes trusted USD totals, and persists trimmed details', async () => {
    const input = createOrderRequest();
    input.customer = { name: ' Sam Test ', email: ' sam@example.test ', phone: ' +85512345678 ' };
    input.address = { street: ' 12 Test Street ', city: ' Phnom Penh ', region: ' Phnom Penh ', postalCode: ' 12000 ', country: ' Cambodia ' };
    Object.assign(input, { totalMinor: 1, status: 'paid', mockMode: false });
    Object.assign(input.lines[0], { unitPrice: 0.01, unitPriceMinor: 1 });
    const order = await service.createOrder(input);
    expect(order).toMatchObject({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/), status: 'awaiting_payment',
      currency: 'USD', subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800,
      createdAt: fixedNow, updatedAt: fixedNow, deliveryLabel: 'Standard delivery', mockMode: true,
      lines: [{ productId: 1, unitPriceMinor: 4800, quantity: 2 }],
      payment: { status: 'pending', expiresAt: fixedExpiry },
    });
    expect(await repository.findById(order.id)).toMatchObject({
      customer: { name: 'Sam Test', email: 'sam@example.test', phone: '+85512345678' },
      address: createOrderRequest().address,
      payment: { qrPayload: expect.stringMatching(/^mock-khqr:/), md5: expect.stringMatching(/^[0-9a-f]{32}$/), transactionHash: null },
    });
  });

  it('only exposes the declared public fields on create and read', async () => {
    const order = await service.createOrder(createOrderRequest());
    for (const result of [order, await service.getOrder(order.id)]) {
      expect(Object.keys(result!).sort()).toEqual([
        'createdAt', 'currency', 'deliveryLabel', 'id', 'lines', 'merchantName', 'mockMode', 'payment',
        'shippingMinor', 'status', 'subtotalMinor', 'totalMinor', 'updatedAt',
      ]);
      expect(result!.merchantName).toBe('Stussy Collection');
      expect(Object.keys(result!.payment).sort()).toEqual(['expiresAt', 'providerReference', 'qrDataUrl', 'status']);
      expect(Object.keys(result!.lines[0]).sort()).toEqual(['color', 'image', 'name', 'productId', 'quantity', 'size', 'slug', 'unitPriceMinor']);
    }
  });

  it('exposes the configured display name without provider credentials', async () => {
    service = new OrderService(repository, gateway, () => time, undefined, 'Test Shop');
    const order = await service.createOrder(createOrderRequest());
    expect(order.merchantName).toBe('Test Shop');
    expect(JSON.stringify(order)).not.toMatch(/apiToken|merchantId|bakongAccountId|acquiringBank/);
  });

  it('reuses the original order for repeated or concurrent request IDs', async () => {
    const createPayment = vi.spyOn(gateway, 'createPayment');
    const input = createOrderRequest();
    const [first, concurrent] = await Promise.all([service.createOrder(input), service.createOrder(input)]);
    const retry = await service.createOrder(createOrderRequest({ delivery: 'express' }));
    expect(concurrent).toEqual(first);
    expect(retry).toEqual(first);
    expect(createPayment).toHaveBeenCalledTimes(1);
  });

  it('returns express pricing from the trusted catalogue', async () => {
    const order = await service.createOrder(createOrderRequest({ delivery: 'express' }));
    expect(order).toMatchObject({ deliveryLabel: 'Express delivery', subtotalMinor: 9600, shippingMinor: 2000, totalMinor: 11600 });
  });

  it.each<[string, unknown]>([
    ['null request', null],
    ['missing request UUID', { requestId: '' }],
    ['invalid request UUID', { requestId: 'request-1' }],
    ['missing customer', { customer: null }],
    ['empty name', { customer: { ...createOrderRequest().customer, name: '  ' } }],
    ['wrong name type', { customer: { ...createOrderRequest().customer, name: 123 } }],
    ['malformed email', { customer: { ...createOrderRequest().customer, email: 'sam@' } }],
    ['short phone', { customer: { ...createOrderRequest().customer, phone: '123' } }],
    ['long phone', { customer: { ...createOrderRequest().customer, phone: '1'.repeat(31) } }],
    ['missing address', { address: null }],
    ...['street', 'city', 'country'].map<[string, unknown]>(field => ['empty ' + field, { address: { ...createOrderRequest().address, [field]: '  ' } }]),
    ['invalid delivery', { delivery: 'teleport' }],
    ['missing cart', { lines: undefined }],
    ['object cart', { lines: {} }],
    ['empty cart', { lines: [] }],
    ['null cart line', { lines: [null] }],
    ['array cart line', { lines: [[]] }],
    ['missing product', { lines: [{ size: 'M', color: 'Black', quantity: 1 }] }],
    ['non-number product', { lines: [{ productId: '1', size: 'M', color: 'Black', quantity: 1 }] }],
    ['non-number quantity', { lines: [{ productId: 1, size: 'M', color: 'Black', quantity: '1' }] }],
  ])('rejects %s before asking the provider or persisting', async (_label, override) => {
    const createPayment = vi.spyOn(gateway, 'createPayment');
    const input = override === null ? null : { ...createOrderRequest(), ...override as object };
    await expect(service.createOrder(input as CreateOrderRequest)).rejects.toBeInstanceOf(OrderValidationError);
    expect(createPayment).not.toHaveBeenCalled();
    expect(await repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
  });

  it.each([
    { productId: 999, size: 'M', color: 'Black', quantity: 1 },
    { productId: 1, size: 'XXL', color: 'Black', quantity: 1 },
    { productId: 1, size: 'M', color: 'White', quantity: 1 },
    { productId: 1, size: 'M', color: 'Black', quantity: 0 },
    { productId: 1, size: 'M', color: 'Black', quantity: 11 },
  ])('rejects unavailable catalogue variants or quantity: %j', async line => {
    await expect(service.createOrder(createOrderRequest({ lines: [line] as CreateOrderRequest['lines'] }))).rejects.toThrow();
    expect(await repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
  });

  it('persists provider-verified success and returns it after replacing the gateway', async () => {
    const order = await service.createOrder(createOrderRequest());
    time = new Date('2026-11-09T10:01:00.000Z');
    const paid = await service.simulateSuccess(order.id);
    expect(paid).toMatchObject({ status: 'paid', updatedAt: time.toISOString(), payment: { status: 'paid' } });
    expect((await repository.findById(order.id))?.payment.transactionHash).toMatch(/^mock-/);
    const restarted = new OrderService(repository, new MockBakongGateway(() => time), () => time);
    expect(await restarted.getOrder(order.id)).toEqual(paid);
    expect(await restarted.simulateSuccess(order.id)).toEqual(paid);
  });

  it('checks provider success on reads and persists it before returning', async () => {
    const order = await service.createOrder(createOrderRequest());
    gateway.simulateSuccess(order.payment.providerReference);
    expect(await service.getOrder(order.id)).toMatchObject({ status: 'paid' });
    expect((await repository.findById(order.id))?.status).toBe('paid');
  });

  it('checks payment with the stored reference, expiry, total, and currency', async () => {
    const order = await service.createOrder(createOrderRequest());
    const check = vi.spyOn(gateway, 'checkPayment');
    await service.getOrder(order.id);
    expect(check).toHaveBeenCalledExactlyOnceWith({
      providerReference: order.payment.providerReference,
      expiresAt: order.payment.expiresAt,
      totalMinor: order.totalMinor,
      currency: order.currency,
    });
  });

  it('expires at the deadline before accepting simulation or polling a provider', async () => {
    const order = await service.createOrder(createOrderRequest());
    time = new Date(fixedExpiry);
    const check = vi.spyOn(gateway, 'checkPayment');
    expect(await service.simulateSuccess(order.id)).toMatchObject({ status: 'expired', payment: { status: 'expired' } });
    expect(check).not.toHaveBeenCalled();
    expect(await repository.findById(order.id)).toMatchObject({ status: 'expired', payment: { transactionHash: null } });
  });

  it('returns null for an unknown order', async () => {
    expect(await service.getOrder('missing')).toBeNull();
    expect(await service.simulateSuccess('missing')).toBeNull();
  });

  it('does not persist an order when payment creation fails', async () => {
    vi.spyOn(gateway, 'createPayment').mockRejectedValue(new Error('QR provider unavailable'));
    await expect(service.createOrder(createOrderRequest())).rejects.toThrow('QR provider unavailable');
    expect(await repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
  });

  it('cannot simulate success for a provider that does not support mock simulation', async () => {
    const provider: PaymentGateway = {
      createPayment: order => gateway.createPayment(order),
      checkPayment: input => gateway.checkPayment(input),
    };
    const liveService = new OrderService(repository, provider, () => time);
    const order = await liveService.createOrder(createOrderRequest());
    expect(order.mockMode).toBe(false);
    await expect(liveService.simulateSuccess(order.id)).rejects.toThrow(/mock/i);
    expect((await repository.findById(order.id))?.status).toBe('awaiting_payment');
  });
  it.each(['pending', 'paid'] as const)('expires if a delayed %s provider result arrives at the deadline', async status => {
    const order = await service.createOrder(createOrderRequest());
    vi.spyOn(gateway, 'checkPayment').mockImplementation(async () => {
      time = new Date(fixedExpiry);
      return { status, transactionHash: 'mock-late-payment' };
    });
    expect(await service.getOrder(order.id)).toMatchObject({ status: 'expired', payment: { status: 'expired' } });
    expect((await repository.findById(order.id))?.payment.transactionHash).toBeNull();
  });

  it.each(['failed', 'expired'] as const)('persists a provider %s result and keeps it terminal', async status => {
    const order = await service.createOrder(createOrderRequest());
    const check = vi.spyOn(gateway, 'checkPayment').mockResolvedValue({ status });
    expect(await service.getOrder(order.id)).toMatchObject({ status, payment: { status } });
    check.mockClear();
    expect(await service.simulateSuccess(order.id)).toMatchObject({ status });
    expect(check).not.toHaveBeenCalled();
  });

  it('refuses a paid provider result without a transaction hash', async () => {
    const order = await service.createOrder(createOrderRequest());
    vi.spyOn(gateway, 'checkPayment').mockResolvedValue({ status: 'paid' });
    await expect(service.getOrder(order.id)).rejects.toThrow(/transaction hash/i);
    expect(await repository.findById(order.id)).toMatchObject({ status: 'awaiting_payment', payment: { status: 'pending', transactionHash: null } });
  });

  it('allows a request to be retried after a gateway failure', async () => {
    vi.spyOn(gateway, 'createPayment').mockRejectedValueOnce(new Error('Temporary QR failure'));
    await expect(service.createOrder(createOrderRequest())).rejects.toThrow('Temporary QR failure');
    expect(await service.createOrder(createOrderRequest())).toMatchObject({ status: 'awaiting_payment' });
  });

});

it('keeps live KHQR recoverable through a verification outage after QR expiry and accepts a verified settlement', async () => {
  const checkPayment = vi.fn().mockRejectedValueOnce(new Error('Verification unavailable')).mockResolvedValue({ status: 'paid', transactionHash: 'verified-settlement' });
  const live = new OrderService(repository, { createPayment: input => gateway.createPayment(input), checkPayment }, () => time);
  const order = await live.createOrder(createOrderRequest());
  time = new Date(Date.parse(fixedExpiry) + 60_000);
  await expect(live.getOrder(order.id)).rejects.toThrow('Verification unavailable');
  expect((await repository.findById(order.id))?.status).toBe('awaiting_payment');
  expect(await live.getOrder(order.id)).toMatchObject({ status: 'paid' });
});
