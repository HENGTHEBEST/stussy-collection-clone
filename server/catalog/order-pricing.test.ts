// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OrderPricingError, priceOrder } from './order-pricing';

describe('priceOrder', () => {
  it('ignores browser prices by accepting only variant inputs', () => {
    const priced = priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity: 2 }], 'standard');
    expect(priced).toMatchObject({ subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800 });
    expect(priced.lines[0]).toMatchObject({ unitPriceMinor: 4800, quantity: 2 });
  });

  it.each([
    [{ productId: 999, size: 'M', color: 'Black', quantity: 1 }],
    [{ productId: 6, size: 'M', color: 'Black', quantity: 1 }],
    [{ productId: 1, size: 'XS', color: 'Black', quantity: 1 }],
    [{ productId: 1, size: 'M', color: 'White', quantity: 1 }],
    [{ productId: 1, size: 'M', color: 'Black', quantity: 0 }],
  ] as const)('rejects an invalid or unavailable line', (line) => {
    expect(() => priceOrder([line], 'standard')).toThrow(OrderPricingError);
  });
});
