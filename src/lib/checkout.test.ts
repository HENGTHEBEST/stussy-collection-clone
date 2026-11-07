import { describe, expect, it } from 'vitest';
import { createOrderSummary, isOrderSummaryRecord, validateCheckout, type CheckoutFields } from './checkout';

const fields: CheckoutFields = {
  name: 'Private Buyer', email: 'private@example.test', phone: '+855 (12) 345-678',
  street: 'Secret Street 987', city: 'Private City', region: 'Private Region',
  postalCode: 'PRIVATE-987', country: 'Private Country', delivery: 'standard',
  cardholder: 'Private Cardholder', cardNumber: '4242 4242 4242 4242', expiry: '12/39', cvc: '987',
};
const lines = [{ productId: 1, size: 'M' as const, color: 'Black' as const, quantity: 2, unitPrice: 45 }];
const totals = { subtotal: 90, shipping: 12, total: 102 };
const now = new Date(2026, 10, 7);

describe('checkout validation', () => {
  it('requires each contact, address, delivery and payment field', () => {
    for (const key of Object.keys(fields) as (keyof CheckoutFields)[]) {
      expect(validateCheckout({ ...fields, [key]: ' ' }, now)[key], key).toBeTruthy();
    }
  });
  it('accepts formatted demo card and phone while rejecting malformed values', () => {
    expect(validateCheckout(fields, now)).toEqual({});
    expect(validateCheckout({ ...fields, cardNumber: '4242424242424242' }, now)).toEqual({});
    expect(validateCheckout({ ...fields, email: 'bad@host', phone: '(12)-34', cvc: '12a' }, now)).toMatchObject({
      email: expect.any(String), phone: expect.any(String), cvc: expect.any(String),
    });
    expect(validateCheckout({ ...fields, cardNumber: '5555 5555 5555 4444' }, now)).toEqual({ cardNumber: 'Use the documented demo card number.' });
  });
  it('distinguishes malformed expiry from an expired local-calendar month', () => {
    const malformed = validateCheckout({ ...fields, expiry: '13/26' }, now).expiry;
    expect(malformed).toMatch(/MM\/YY/);
    expect(validateCheckout({ ...fields, expiry: '10/26' }, now).expiry).toMatch(/expired/i);
    expect(validateCheckout({ ...fields, expiry: '11/26' }, new Date(2026, 10, 30, 23, 59, 59, 998))).toEqual({});
    expect(validateCheckout({ ...fields, expiry: '11/26' }, new Date(2026, 10, 30, 23, 59, 59, 999)).expiry).toMatch(/expired/i);
    expect(validateCheckout({ ...fields, expiry: '11/26' }, new Date(2026, 11, 1)).expiry).toMatch(/expired/i);
  });
});

describe('non-personal order summary', () => {
  it('copies only allowlisted fields and never serializes personal data or field names', () => {
    const pollutedLine = { ...lines[0], email: fields.email };
    const pollutedTotals = { ...totals, cardNumber: fields.cardNumber };
    const order = createOrderSummary(fields, [pollutedLine], pollutedTotals);
    expect(order).toMatchObject({ ...totals, deliveryLabel: 'Standard demo delivery', lines });
    expect(order.orderId).toMatch(/^DEMO-[0-9A-F]{8}$/);
    expect(new Date(order.createdAt).toISOString()).toBe(order.createdAt);
    expect(order.lines[0]).not.toBe(pollutedLine);
    const serialized = JSON.stringify(order);
    for (const key of Object.keys(fields).filter((key) => key !== 'delivery')) {
      expect(Object.keys(order)).not.toContain(key);
      expect(serialized).not.toContain(`"${key}":`);
      expect(serialized).not.toContain(JSON.stringify(fields[key as keyof CheckoutFields]));
    }
    expect(isOrderSummaryRecord(order)).toBe(true);
    expect(createOrderSummary({ ...fields, delivery: 'express' }, lines, totals).deliveryLabel).toBe('Express demo delivery');
  });
  it('rejects corrupt or extra order data wholesale, including unknown products and inconsistent totals', () => {
    const order = createOrderSummary(fields, lines, totals);
    for (const bad of [null, {}, { ...order, email: fields.email }, { ...order, orderId: 'bad' },
      { ...order, createdAt: 'yesterday' }, { ...order, lines: [] },
      { ...order, lines: [{ ...lines[0], productId: 999 }] },
      { ...order, lines: [{ ...lines[0], cvc: '987' }] },
      { ...order, lines: [{ ...lines[0], quantity: 1.5 }] },
      { ...order, lines: [{ ...lines[0], size: 'XXL' }] },
      { ...order, lines: [{ ...lines[0], color: 'Red' }] },
      { ...order, lines: [{ ...lines[0], unitPrice: Infinity }] },
      { ...order, lines: [lines[0], lines[0]] },
      { ...order, subtotal: 91 }, { ...order, shipping: 13, total: 103 },
      { ...order, total: 103 }, { ...order, total: NaN }, { ...order, deliveryLabel: 'Real delivery' },
    ]) expect(isOrderSummaryRecord(bad), JSON.stringify(bad)).toBe(false);
  });
});
