import type { CreateOrderRequest } from '../../shared/commerce.js';

export const fixedNow = '2026-11-09T10:00:00.000Z';
export const fixedExpiry = '2026-11-09T10:10:00.000Z';

export function createOrderRequest(overrides: Partial<CreateOrderRequest> = {}): CreateOrderRequest {
  return {
    requestId: '2def1451-71be-4ef0-a8da-f07b5da46018',
    customer: { name: 'Sam Test', email: 'sam@example.test', phone: '+85512345678' },
    address: { street: '12 Test Street', city: 'Phnom Penh', region: 'Phnom Penh', postalCode: '12000', country: 'Cambodia' },
    delivery: 'standard',
    lines: [{ productId: 1, size: 'M', color: 'Black', quantity: 2 }],
    ...overrides,
  };
}
