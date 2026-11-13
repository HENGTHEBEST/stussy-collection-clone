// @vitest-environment node
import request from 'supertest';
import { Server } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { buildApp } from './bootstrap.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it('builds a Supabase application without binding a listener or contacting storage', async () => {
  const listen = vi.spyOn(Server.prototype, 'listen');
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'));
  const app = await buildApp({ PAYMENT_MODE: 'mock', SUPABASE_URL: 'https://project.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-key' });
  expect(listen).not.toHaveBeenCalled();
  await request(app).get('/api/health').expect(200, { ready: true, paymentMode: 'mock' });
  expect(network).not.toHaveBeenCalled();
});

it('exports the Vercel application without binding a local listener', async () => {
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-key');
  vi.stubEnv('PAYMENT_MODE', 'mock');
  vi.stubEnv('APP_ORIGIN', 'https://shop.example.test');
  vi.stubEnv('PAYWAY_MERCHANT_ID', '');
  vi.stubEnv('PAYWAY_API_KEY', '');
  const listen = vi.spyOn(Server.prototype, 'listen');
  const network = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected external request'));
  const { default: handler } = await import('../../api/[...path].js');
  expect(listen).not.toHaveBeenCalled();
  await request(handler).get('/api/health?probe=1').expect(200, { ready: true, paymentMode: 'mock' });
  await request(handler).get('/api/checkout-pricing').set('Origin', 'https://shop.example.test').expect(200);
  await request(handler).get('/api/health').set('Origin', 'https://other.example.test').expect(403);
  expect(network).not.toHaveBeenCalled();
});
