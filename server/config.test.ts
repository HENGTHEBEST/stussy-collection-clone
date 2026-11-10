// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadBakongCredentials, loadConfig } from './config.js';

const realEnv = {
  BAKONG_API_BASE_URL: 'https://api-bakong.nbc.gov.kh',
  BAKONG_API_TOKEN: 'test-only-token',
  BAKONG_ACCOUNT_ID: 'test@merchant',
  BAKONG_MERCHANT_ID: 'test-merchant',
  BAKONG_ACQUIRING_BANK: 'Test Bank',
  MERCHANT_NAME: 'Test Merchant',
  MERCHANT_CITY: 'Phnom Penh',
};

const credentialLimits = [
  ['BAKONG_API_BASE_URL', 255], ['BAKONG_API_TOKEN', 4096], ['BAKONG_ACCOUNT_ID', 32],
  ['BAKONG_MERCHANT_ID', 32], ['BAKONG_ACQUIRING_BANK', 32],
  ['MERCHANT_NAME', 25], ['MERCHANT_CITY', 15],
] as const;

describe('server configuration', () => {
  it('defaults to the credential-free local mock server', () => {
    expect(loadConfig({})).toEqual({
      port: 8787, appOrigin: 'http://localhost:5173', paymentMode: 'mock',
      merchantName: 'Stussy Collection Showcase', merchantCity: 'Phnom Penh',
      bakongAccountId: 'demo@mock', currency: 'USD', sqlitePath: './data/store.sqlite',
      pricing: { unitPriceMinor: null, freeShipping: false },
    });
  });
  it('loads valid explicit settings without retaining the token', () => {
    const config = loadConfig({ ...realEnv, API_PORT: '9000', APP_ORIGIN: 'https://shop.example.test', PAYMENT_MODE: 'sit',
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
  it('uses the mock account default when the documented real credentials are blank', () => {
    expect(loadConfig({ BAKONG_ACCOUNT_ID: '', BAKONG_API_TOKEN: '', BAKONG_MERCHANT_ID: '',
      BAKONG_ACQUIRING_BANK: '', TEST_UNIT_PRICE_MINOR: '1', TEST_FREE_SHIPPING: 'true' }))
      .toMatchObject({ paymentMode: 'mock', bakongAccountId: 'demo@mock',
        pricing: { unitPriceMinor: 1, freeShipping: true } });
  });
  it.each(['MERCHANT_NAME', 'MERCHANT_CITY', 'SQLITE_PATH'])('rejects empty %s', key => {
    expect(() => loadConfig({ [key]: ' ' })).toThrow();
  });
  it.each(['', 'KHR', 'usd'])('rejects unsupported currency %j', value => {
    expect(() => loadConfig({ ORDER_CURRENCY: value })).toThrow();
  });
  it.each(['sit', 'production'] as const)('requires complete real credentials for %s', mode => {
    expect(() => loadConfig({ PAYMENT_MODE: mode })).toThrow();
    expect(loadConfig({ ...realEnv, PAYMENT_MODE: mode }).paymentMode).toBe(mode);
    for (const [key] of credentialLimits) {
      for (const value of [undefined, '', ' ']) {
        expect(() => loadConfig({ ...realEnv, PAYMENT_MODE: mode, [key]: value })).toThrow(key);
        expect(() => loadBakongCredentials({ ...realEnv, [key]: value }, mode)).toThrow(key);
      }
    }
  });
  it('keeps real credentials out of public configuration serialization', () => {
    expect(JSON.stringify(loadConfig({ ...realEnv, PAYMENT_MODE: 'production' }))).not.toContain('test-only-token');
  });
  it.each([['1', 1], ['999999', 999999]] as const)('accepts test unit price %s in minor units', (value, expected) => {
    expect(loadConfig({ TEST_UNIT_PRICE_MINOR: value }).pricing.unitPriceMinor).toBe(expected);
  });
  it.each(['', '0', '-1', '1000000', '1.5', '1e3', 'NaN', 'Infinity', 'abc'])('rejects invalid test unit price %j', value => {
    expect(() => loadConfig({ TEST_UNIT_PRICE_MINOR: value })).toThrow('TEST_UNIT_PRICE_MINOR');
  });
  it.each([['true', true], ['false', false]] as const)('parses free shipping %s', (value, expected) => {
    expect(loadConfig({ TEST_FREE_SHIPPING: value }).pricing.freeShipping).toBe(expected);
  });
  it.each(['', 'TRUE', 'False', '1', '0', ' true '])('rejects invalid free shipping flag %j', value => {
    expect(() => loadConfig({ TEST_FREE_SHIPPING: value })).toThrow('TEST_FREE_SHIPPING');
  });
});

describe('Bakong credentials', () => {
  it('needs no credentials in mock mode', () => {
    expect(loadBakongCredentials({}, 'mock')).toBeNull();
    expect(loadBakongCredentials({ BAKONG_API_BASE_URL: 'invalid' }, 'mock')).toBeNull();
  });
  it.each(['sit', 'production'] as const)('parses and trims real credentials for %s', mode => {
    expect(loadBakongCredentials(Object.fromEntries(Object.entries(realEnv).map(([key, value]) => [key, ` ${value} `])), mode))
      .toEqual({ apiBaseUrl: 'https://api-bakong.nbc.gov.kh', apiToken: 'test-only-token',
        bakongAccountId: 'test@merchant', merchantId: 'test-merchant', acquiringBank: 'Test Bank',
        merchantName: 'Test Merchant', merchantCity: 'Phnom Penh' });
  });
  it.each(credentialLimits)('rejects %s exceeding its maximum length %i', (key, maximum) => {
    const value = key === 'BAKONG_API_BASE_URL'
      ? `https://${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(60)}.test`
      : 'x'.repeat(maximum + 1);
    expect(() => loadBakongCredentials({ ...realEnv, [key]: value }, 'production')).toThrow(key);
  });
  it('accepts credentials at each maximum length', () => {
    const apiBaseUrl = `https://${'a'.repeat(60)}.${'b'.repeat(60)}.${'c'.repeat(60)}.${'d'.repeat(59)}.test`;
    const env = Object.fromEntries(credentialLimits.map(([key, maximum]) => [key, key === 'BAKONG_API_BASE_URL' ? apiBaseUrl : 'x'.repeat(maximum)]));
    expect(apiBaseUrl).toHaveLength(255);
    expect(loadBakongCredentials(env, 'production')).not.toBeNull();
  });
  it.each(['not-a-url', 'http://example.test', 'ftp://example.test', 'https://example.test/',
    'https://example.test/path', 'https://user:password@example.test', 'https://example.test?token=test',
    'https://example.test#hash'])('rejects a non-HTTPS or non-origin API URL %j', value => {
    expect(() => loadBakongCredentials({ ...realEnv, BAKONG_API_BASE_URL: value }, 'sit')).toThrow('BAKONG_API_BASE_URL');
  });
  it('does not include a rejected token in its error message', () => {
    const token = 'private-test-token'.repeat(300);
    try {
      loadBakongCredentials({ ...realEnv, BAKONG_API_TOKEN: token }, 'production');
      expect.fail('Expected oversized token rejection');
    } catch (error) {
      expect(String(error)).toContain('BAKONG_API_TOKEN');
      expect(String(error)).not.toContain(token);
    }
  });
});
