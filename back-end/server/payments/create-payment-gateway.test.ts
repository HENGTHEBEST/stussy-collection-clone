// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { BakongCredentials } from '../config.js';
import { BakongGateway } from './bakong-gateway.js';
import { createPaymentGateway } from './create-payment-gateway.js';
import { MockBakongGateway } from './mock-bakong-gateway.js';

const credentials: BakongCredentials = {
  apiBaseUrl: 'https://api.example.test', apiToken: 'synthetic-token',
  bakongAccountId: 'shop@example', merchantId: 'merchant-1', acquiringBank: 'TEST BANK',
  merchantName: 'Test Shop', merchantCity: 'PHNOM PENH',
};

describe('createPaymentGateway', () => {
  it('selects mock without credentials and Bakong for configured provider modes', () => {
    expect(createPaymentGateway('mock', null)).toBeInstanceOf(MockBakongGateway);
    expect(createPaymentGateway('sit', credentials)).toBeInstanceOf(BakongGateway);
    expect(createPaymentGateway('production', credentials)).toBeInstanceOf(BakongGateway);
  });

  it.each(['sit', 'production'] as const)('requires credentials in %s mode', mode => {
    expect(() => createPaymentGateway(mode, null)).toThrow('Bakong credentials are required.');
  });
});
