import type { BakongCredentials, ServerConfig } from '../config.js';
import { BakongGateway } from './bakong-gateway.js';
import { MockBakongGateway } from './mock-bakong-gateway.js';
import type { PaymentGateway } from './payment-gateway.js';

export function createPaymentGateway(
  mode: ServerConfig['paymentMode'],
  credentials: BakongCredentials | null,
): PaymentGateway {
  if (mode === 'mock') return new MockBakongGateway();
  if (!credentials) throw new Error('Bakong credentials are required.');
  return new BakongGateway(credentials);
}
