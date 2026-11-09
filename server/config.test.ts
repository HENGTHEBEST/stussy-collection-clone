// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

describe('server configuration', () => {
  it('defaults to the credential-free local mock server', () => {
    expect(loadConfig({})).toEqual({
      port: 8787, appOrigin: 'http://localhost:5173', paymentMode: 'mock',
      merchantName: 'Stussy Collection Showcase', merchantCity: 'Phnom Penh',
      bakongAccountId: 'demo@mock', currency: 'USD', sqlitePath: './data/store.sqlite',
    });
  });
  it('loads valid explicit settings without retaining the token', () => {
    const config = loadConfig({ API_PORT: '9000', APP_ORIGIN: 'https://shop.example.test', PAYMENT_MODE: 'sit',
      MERCHANT_NAME: ' Test Merchant ', MERCHANT_CITY: ' Kampot ', BAKONG_ACCOUNT_ID: ' test@merchant ',
      ORDER_CURRENCY: 'USD', SQLITE_PATH: ':memory:', BAKONG_API_TOKEN: 'secret-token' });
    expect(config).toMatchObject({ port: 9000, appOrigin: 'https://shop.example.test', paymentMode: 'sit',
      merchantName: 'Test Merchant', merchantCity: 'Kampot', bakongAccountId: 'test@merchant', sqlitePath: ':memory:' });
    expect(JSON.stringify(config)).not.toContain('secret-token');
  });
  it.each(['', '0', '-1', '65536', '1.5', 'abc', '8787oops', '1e3'])('rejects invalid API port %j', value => {
    expect(() => loadConfig({ API_PORT: value })).toThrow();
  });
  it.each(['', 'localhost:5173', 'ftp://example.test', 'https://example.test/path',
    'https://user:password@example.test', 'https://example.test?token=secret-token', 'https://example.test#hash'])('rejects invalid app origin %j', value => {
    expect(() => loadConfig({ APP_ORIGIN: value })).toThrow();
  });
  it.each(['', 'live', 'MOCK'])('rejects unsupported payment mode %j', value => {
    expect(() => loadConfig({ PAYMENT_MODE: value })).toThrow();
  });
  it.each(['MERCHANT_NAME', 'MERCHANT_CITY', 'BAKONG_ACCOUNT_ID', 'SQLITE_PATH'])('rejects empty %s', key => {
    expect(() => loadConfig({ [key]: ' ' })).toThrow();
  });
  it.each(['', 'KHR', 'usd'])('rejects unsupported currency %j', value => {
    expect(() => loadConfig({ ORDER_CURRENCY: value })).toThrow();
  });
  it.each(['sit', 'production'])('requires a server token for %s', mode => {
    expect(() => loadConfig({ PAYMENT_MODE: mode })).toThrow();
    expect(() => loadConfig({ PAYMENT_MODE: mode, BAKONG_API_TOKEN: ' ' })).toThrow();
    expect(loadConfig({ PAYMENT_MODE: mode, BAKONG_API_TOKEN: 'secret-token' }).paymentMode).toBe(mode);
  });
});
