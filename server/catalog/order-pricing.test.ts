// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OrderPricingError, priceOrder } from './order-pricing.js';

describe('priceOrder', () => {
  it('ignores browser prices by accepting only variant inputs', () => {
    const priced = priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity: 2 }], 'standard');
    expect(priced).toMatchObject({ subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800 });
    expect(priced.lines[0]).toMatchObject({ unitPriceMinor: 4800, quantity: 2 });
  });

  it.each([
    ['standard', 2, 10000, 1200, 11200],
    ['standard', 3, 15000, 0, 15000],
    ['express', 3, 15000, 800, 15800],
    ['express', 4, 20000, 800, 20800],
  ] as const)('prices %s shipping for %i $50 tees', (delivery, quantity, subtotalMinor, shippingMinor, totalMinor) => {
    const priced = priceOrder([{ productId: 13, size: 'M', color: 'Black', quantity }], delivery);
    expect(priced).toMatchObject({ subtotalMinor, shippingMinor, totalMinor });
  });

  it('accepts the maximum quantity of 10', () => {
    const priced = priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity: 10 }], 'standard');
    expect(priced).toMatchObject({ subtotalMinor: 48000, shippingMinor: 0, totalMinor: 48000 });
    expect(priced.lines[0].quantity).toBe(10);
  });

  it.each([
    [{ productId: 999, size: 'M', color: 'Black', quantity: 1 }],
    [{ productId: 6, size: 'M', color: 'Black', quantity: 1 }],
    [{ productId: 1, size: 'XS', color: 'Black', quantity: 1 }],
    [{ productId: 1, size: 'M', color: 'White', quantity: 1 }],
    [{ productId: 1, size: 'M', color: 'Black', quantity: 0 }],
    [{ productId: 1, size: 'M', color: 'Black', quantity: 1.5 }],
  ] as const)('rejects an invalid or unavailable line', (line) => {
    expect(() => priceOrder([line], 'standard')).toThrow(OrderPricingError);
  });
});
