import { describe, expect, it } from 'vitest';
import { validateCheckout, type CheckoutFields } from './checkout';
import checkoutSource from './checkout?raw';

const fields: CheckoutFields = {
  name: 'Buyer', email: 'buyer@example.test', phone: '+855 (12) 345-678',
  street: 'Street 1', city: 'Phnom Penh', region: 'Phnom Penh',
  postalCode: '12000', country: 'Cambodia', delivery: 'standard',
};

describe('checkout validation', () => {
  it('requires contact, street, city, country, and delivery', () => {
    for (const key of ['name', 'email', 'phone', 'street', 'city', 'country', 'delivery'] as (keyof CheckoutFields)[]) {
      expect(validateCheckout({ ...fields, [key]: ' ' })[key], key).toBeTruthy();
    }
  });
  it('accepts valid contact information for either delivery option', () => {
    expect(validateCheckout(fields)).toEqual({});
    expect(validateCheckout({ ...fields, region: '', postalCode: '' })).toEqual({});
    expect(validateCheckout({ ...fields, delivery: 'express' })).toEqual({});
  });
  it('rejects malformed email, short phone, and unsupported delivery', () => {
    expect(validateCheckout({ ...fields, email: 'bad@host', phone: '(12)-34', delivery: 'pickup' as CheckoutFields['delivery'] })).toMatchObject({
      email: expect.any(String), phone: expect.any(String), delivery: expect.any(String),
    });
  });
  it('has no removed payment fields in its source or validation output', () => {
    const errors = validateCheckout(Object.fromEntries(Object.keys(fields).map((key) => [key, ''])) as unknown as CheckoutFields);
    for (const key of ['cardholder', 'cardNumber', 'expiry', 'cvc']) {
      expect(Object.keys(errors)).not.toContain(key);
      expect(JSON.stringify(errors)).not.toContain(key);
      expect(checkoutSource).not.toContain(key);
    }
  });
});
