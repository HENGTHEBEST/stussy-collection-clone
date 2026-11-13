// @vitest-environment node
import request from 'supertest';
import { BakongVerificationLimitError } from '../payments/bakong-gateway.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { OrderService } from '../orders/order-service.js';
import { SqliteOrderRepository } from '../orders/sqlite-order-repository.js';
import { MockBakongGateway } from '../payments/mock-bakong-gateway.js';
import { PayWayGateway } from '../payments/payway-gateway.js';
import { createOrderRequest, fixedNow } from '../test/fixtures.js';
import { createApp } from './app.js';

let repository: SqliteOrderRepository;
let gateway: MockBakongGateway;
let service: OrderService;
const config = (env: NodeJS.ProcessEnv = {}) => loadConfig({
  SUPABASE_URL: 'https://supabase.example.test', SUPABASE_SERVICE_ROLE_KEY: 'synthetic-test-key', ...env,
});
const invalidCheckout = { error: { code: 'invalid_checkout', message: 'Check the highlighted checkout information.' } };
function expectSafe(text: string) {
  expect(text).not.toMatch(/"(?:apiToken|merchantId|bakongAccountId|acquiringBank|street|stack)"|secret-token|12 Test Street|Error:|\n\s+at /);
}
beforeEach(() => {
  repository = new SqliteOrderRepository(':memory:');
  gateway = new MockBakongGateway(() => new Date(fixedNow));
  service = new OrderService(repository, gateway, () => new Date(fixedNow));
});
afterEach(async () => { await repository.close(); vi.restoreAllMocks(); });

describe('order HTTP API', () => {
  describe('PayWay callback', () => {
    let cardGateway: PayWayGateway;
    let fetcher: ReturnType<typeof vi.fn<typeof fetch>>;
    beforeEach(() => {
      fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ status: { code: 6, message: 'tran_id not found' } })));
      cardGateway = new PayWayGateway({ merchantId: 'sandbox-merchant', apiKey: 'synthetic-key', environment: 'sandbox' },
        'https://shop.example.test', fetcher, () => new Date(fixedNow));
      service = new OrderService(repository, gateway, () => new Date(fixedNow), undefined, 'Test Shop', cardGateway);
    });

    it('checks the provider before redirecting to the persisted paid order and accepts repeated callbacks', async () => {
      const order = await service.createOrder({ ...createOrderRequest(), paymentMethod: 'card' });
      const tranId = order.payment.providerReference.slice('payway-'.length);
      fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ status: { code: '00', tran_id: tranId },
        data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 108, payment_currency: 'USD' } })));
      const check = vi.spyOn(cardGateway, 'checkPayment');
      const app = createApp({ service, config: config() });
      for (let attempt = 0; attempt < 2; attempt++) {
        await request(app).post('/api/payway/callback').type('form').send({ tran_id: tranId })
          .expect(303).expect('Location', '/order/' + order.id);
      }
      expect(check).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ providerReference: order.payment.providerReference,
        totalMinor: 10800, currency: 'USD' }));
      expect(await repository.findByProviderReference(order.payment.providerReference)).toMatchObject({ status: 'paid' });
    });

    it('ignores callback payment status, amount, currency, success, and redirect claims', async () => {
      const order = await service.createOrder({ ...createOrderRequest(), paymentMethod: 'card' });
      await request(createApp({ service, config: config() })).post('/api/payway/callback').type('form')
        .send({ tran_id: order.payment.providerReference.slice('payway-'.length), payment_status: 'APPROVED',
          payment_status_code: 0, status: 'paid', amount: '108.00', currency: 'USD', success: true,
          return_url: 'https://evil.example.test' }).expect(303).expect('Location', '/order/' + order.id);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(await repository.findById(order.id)).toMatchObject({ status: 'awaiting_payment', payment: { status: 'pending' } });
    });

    it.each([{}, { tran_id: 'invalid' }, { tran_id: ['1234567890abcdef1234', '1234567890abcdef1234'] },
      { tran_id: '1234567890abcdef1234' }])('rejects missing, malformed, or unknown references: %j', async body => {
      await request(createApp({ service, config: config() })).post('/api/payway/callback').type('form').send(body).expect(404);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it.each([{ total_amount: 1 }, { payment_currency: 'KHR' }, { tran_id: 'ffffffffffffffffffff' }])
      ('does not mark paid when provider verification mismatches %j', async mismatch => {
        const order = await service.createOrder({ ...createOrderRequest(), paymentMethod: 'card' });
        const { tran_id = order.payment.providerReference.slice('payway-'.length), ...data } = mismatch;
        fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ status: { code: '00', tran_id },
          data: { payment_status_code: 0, payment_status: 'APPROVED', total_amount: 108, payment_currency: 'USD', ...data } })));
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const response = await request(createApp({ service, config: config() })).post('/api/payway/callback').type('form')
          .send({ tran_id: order.payment.providerReference.slice('payway-'.length), status: 'paid' }).expect(500);
        expectSafe(response.text);
        expect(await repository.findById(order.id)).toMatchObject({ status: 'awaiting_payment', payment: { status: 'pending' } });
      });

    it('sanitizes callback errors without logging submitted fields', async () => {
      const order = await service.createOrder({ ...createOrderRequest(), paymentMethod: 'card' });
      fetcher.mockRejectedValueOnce(new Error('secret-token 12 Test Street'));
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const response = await request(createApp({ service, config: config() })).post('/api/payway/callback').type('form')
        .send({ tran_id: order.payment.providerReference.slice('payway-'.length), apiToken: 'secret-token' }).expect(500);
      expect(response.body).toEqual({ error: { code: 'internal_error', message: 'Unable to process the request.' } });
      expectSafe(response.text);
      expect(log.mock.calls).toEqual([[{ errorClass: 'Error', route: '/api/payway/callback', method: 'POST' }]]);
      expect(await repository.findById(order.id)).toMatchObject({ status: 'awaiting_payment' });
    });

    it('bounds form bodies and preserves origin restrictions before reconciliation', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const app = createApp({ service, config: config() });
      const response = await request(app).post('/api/payway/callback').type('form')
        .send({ padding: 'x'.repeat(33 * 1024), apiToken: 'secret-token' }).expect(413);
      expect(response.body.error.code).toBe('request_too_large');
      expectSafe(response.text);
      await request(app).post('/api/payway/callback').set('Origin', 'https://evil.example.test')
        .type('form').send({ tran_id: '1234567890abcdef1234' }).expect(403);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('handles a missing body as an invalid reference', async () => {
      await request(createApp({ service, config: config() })).post('/api/payway/callback').expect(404);
    });
  });

  it('reports mock readiness without configuration secrets', async () => {
    const response = await request(createApp({ service, config: config() })).get('/api/health')
      .expect(200, { ready: true, paymentMode: 'mock' });
    expectSafe(response.text);
  });
  it('checks real delivery locations without creating an order', async () => {
    const app = createApp({ service, config: config() });
    const valid = await request(app).post('/api/validate-address')
      .send({ city: 'Phnom Penh', region: 'Phnom Penh', country: 'Cambodia' }).expect(200);
    expect(valid.body).toEqual({ address: { city: 'Phnom Penh', region: 'Phnom Penh', country: 'Cambodia' }, errors: {} });
    const invalid = await request(app).post('/api/validate-address')
      .send({ city: 'Madeup City', region: 'Phnom Penh', country: 'Cambodia' }).expect(200);
    expect(invalid.body.errors.city).toMatch(/real city/i);
    await request(app).post('/api/validate-address').send({ city: ['Phnom Penh'], country: 'Cambodia' }).expect(400);
    expect(await repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
  });
  it('publishes only the non-secret checkout pricing policy', async () => {
    const response = await request(createApp({ service, config: config({ TEST_UNIT_PRICE_MINOR: '1', TEST_FREE_SHIPPING: 'true' }) }))
      .get('/api/checkout-pricing').expect(200, { unitPriceMinor: 1, freeShipping: true });
    expect(Object.keys(response.body).sort()).toEqual(['freeShipping', 'unitPriceMinor']);
    expectSafe(response.text);
  });
  it('creates, reads, and persists simulated payment through public summaries', async () => {
    const app = createApp({ service, config: config() });
    const created = await request(app).post('/api/orders').send({ ...createOrderRequest(), apiToken: 'secret-token', totalMinor: 1 }).expect(201);
    expect(created.body).toMatchObject({
      status: 'awaiting_payment', totalMinor: 10800, currency: 'USD',
      merchantName: 'Stussy Collection', mockMode: true,
    });
    const read = await request(app).get('/api/orders/' + created.body.id).expect(200);
    expect(read.body).toEqual(created.body);
    const paid = await request(app).post('/api/orders/' + created.body.id + '/mock-payment').expect(200);
    expect(paid.body).toMatchObject({ status: 'paid', payment: { status: 'paid' } });
    expect((await repository.findById(created.body.id))?.status).toBe('paid');
    for (const response of [created, read, paid]) expectSafe(response.text);
  });
  it.each([{}, { ...createOrderRequest(), lines: [{ productId: 999, size: 'M', color: 'Black', quantity: 1 }] }])('sanitizes invalid checkout: %j', async body => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(createApp({ service, config: config() })).post('/api/orders').send(body).expect(400, invalidCheckout);
    expectSafe(response.text);
    expectSafe(JSON.stringify(log.mock.calls));
  });
  it.each(['/api/orders/unknown', '/api/orders/unknown/mock-payment', '/api/unknown'])('returns safe JSON for missing resource %s', async route => {
    const app = createApp({ service, config: config() });
    const response = route.endsWith('/mock-payment')
      ? await request(app).post(route).expect(404)
      : await request(app).get(route).expect(404);
    expect(response.body.error.code).toBe('not_found');
    expectSafe(response.text);
  });
  it.each(['sit', 'production'] as const)('hides mock success in %s mode', async paymentMode => {
    const order = await service.createOrder(createOrderRequest());
    const app = createApp({ service, config: { ...config(), paymentMode } });
    await request(app).post('/api/orders/' + order.id + '/mock-payment').expect(404);
    expect((await repository.findById(order.id))?.status).toBe('awaiting_payment');
  });
  it('sanitizes provider failures and logs only safe request context', async () => {
    const order = await service.createOrder(createOrderRequest());
    vi.spyOn(gateway, 'checkPayment').mockRejectedValue(new Error('secret-token 12 Test Street'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(createApp({ service, config: config() }))
      .get('/api/orders/' + order.id + '?apiToken=secret-token').expect(500);
    expect(response.body).toEqual({ error: { code: 'internal_error', message: 'Unable to process the request.' } });
    expectSafe(response.text);
    expect(log.mock.calls).toEqual([[{ errorClass: 'Error', route: '/api/orders/:id', method: 'GET', orderId: order.id }]]);
  });
  it('rejects malformed JSON without echoing its contents', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(createApp({ service, config: config() })).post('/api/orders')
      .set('Content-Type', 'application/json').send('{"street":"12 Test Street",').expect(400, invalidCheckout);
    expectSafe(response.text);
  });
  it('limits request bodies to 32kb with a sanitized response', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = await request(createApp({ service, config: config() })).post('/api/orders')
      .send({ street: '12 Test Street', apiToken: 'secret-token', padding: 'x'.repeat(33 * 1024) }).expect(413);
    expect(response.body.error.code).toBe('request_too_large');
    expectSafe(response.text);
  });
  it('allows the exact configured origin and supports JSON preflight', async () => {
    const app = createApp({ service, config: config() });
    await request(app).get('/api/health').set('Origin', 'http://localhost:5173')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173').expect('Vary', 'Origin').expect(200);
    await request(app).options('/api/orders').set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type')
      .expect('Access-Control-Allow-Headers', 'Content-Type').expect(204);
  });
  it('rejects another origin before creating orders', async () => {
    const response = await request(createApp({ service, config: config() })).post('/api/orders')
      .set('Origin', 'http://localhost:5173.evil.test').send(createOrderRequest()).expect(403);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
    expect(await repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
    expectSafe(response.text);
  });
});

it('returns a safe quota error so clients can pause verification without claiming failure', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(service, 'getOrder').mockRejectedValue(new BakongVerificationLimitError());
  const response = await request(createApp({ service, config: config() })).get('/api/orders/12345678-1234-4234-8234-123456789abc');
  expect(response.status).toBe(429);
  expect(response.headers['retry-after']).toBe('60');
  expect(response.body.error.code).toBe('verification_limit');
  expect(response.body.error.message).toContain('do not pay again');
  expectSafe(response.text);
});
