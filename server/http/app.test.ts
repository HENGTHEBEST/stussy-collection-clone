// @vitest-environment node
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../config.js';
import { OrderService } from '../orders/order-service.js';
import { SqliteOrderRepository } from '../orders/sqlite-order-repository.js';
import { MockBakongGateway } from '../payments/mock-bakong-gateway.js';
import { createOrderRequest, fixedNow } from '../test/fixtures.js';
import { createApp } from './app.js';

let repository: SqliteOrderRepository;
let gateway: MockBakongGateway;
let service: OrderService;
const config = () => loadConfig({});
const invalidCheckout = { error: { code: 'invalid_checkout', message: 'Check the highlighted checkout information.' } };
function expectSafe(text: string) {
  expect(text).not.toMatch(/"(?:apiToken|street|stack)"|secret-token|12 Test Street|Error:|\n\s+at /);
}
beforeEach(() => {
  repository = new SqliteOrderRepository(':memory:');
  gateway = new MockBakongGateway(() => new Date(fixedNow));
  service = new OrderService(repository, gateway, () => new Date(fixedNow));
});
afterEach(() => { repository.close(); vi.restoreAllMocks(); });

describe('order HTTP API', () => {
  it('reports mock readiness without configuration secrets', async () => {
    const response = await request(createApp({ service, config: config() })).get('/api/health')
      .expect(200, { ready: true, paymentMode: 'mock' });
    expectSafe(response.text);
  });
  it('creates, reads, and persists simulated payment through public summaries', async () => {
    const app = createApp({ service, config: config() });
    const created = await request(app).post('/api/orders').send({ ...createOrderRequest(), apiToken: 'secret-token', totalMinor: 1 }).expect(201);
    expect(created.body).toMatchObject({ status: 'awaiting_payment', totalMinor: 10800, currency: 'USD', mockMode: true });
    const read = await request(app).get('/api/orders/' + created.body.id).expect(200);
    expect(read.body).toEqual(created.body);
    const paid = await request(app).post('/api/orders/' + created.body.id + '/mock-payment').expect(200);
    expect(paid.body).toMatchObject({ status: 'paid', payment: { status: 'paid' } });
    expect(repository.findById(created.body.id)?.status).toBe('paid');
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
    expect(repository.findById(order.id)?.status).toBe('awaiting_payment');
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
    expect(repository.findByRequestId(createOrderRequest().requestId)).toBeNull();
    expectSafe(response.text);
  });
});
