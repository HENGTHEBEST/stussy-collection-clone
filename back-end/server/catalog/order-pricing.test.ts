// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OrderPricingError, priceOrder } from './order-pricing.js';

describe('priceOrder', () => {
  it.each([1, 2, 10])('prices %i units at one cent with free shipping', quantity => {
    const priced = priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity }], 'standard', {
      unitPriceMinor: 1, freeShipping: true,
    });
    expect(priced).toMatchObject({ subtotalMinor: quantity, shippingMinor: 0, totalMinor: quantity });
    expect(priced.lines[0]).toMatchObject({ unitPriceMinor: 1, quantity });
  });

  it.each(['standard', 'express'] as const)('prices mixed variants with free %s shipping', delivery => {
    const priced = priceOrder([
      { productId: 1, size: 'M', color: 'Black', quantity: 2 },
      { productId: 13, size: 'L', color: 'Black', quantity: 3 },
    ], delivery, { unitPriceMinor: 1, freeShipping: true });
    expect(priced).toMatchObject({
      subtotalMinor: 5, shippingMinor: 0, totalMinor: 5,
      lines: [{ unitPriceMinor: 1, quantity: 2 }, { unitPriceMinor: 1, quantity: 3 }],
    });
  });

  it('can waive shipping while retaining catalog prices', () => {
    const priced = priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity: 2 }], 'express', {
      unitPriceMinor: null, freeShipping: true,
    });
    expect(priced).toMatchObject({ subtotalMinor: 9600, shippingMinor: 0, totalMinor: 9600 });
  });

  it('retains normal shipping when only unit pricing is overridden', () => {
    const priced = priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity: 2 }], 'express', {
      unitPriceMinor: 1, freeShipping: false,
    });
    expect(priced).toMatchObject({ subtotalMinor: 2, shippingMinor: 2000, totalMinor: 2002 });
  });

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
