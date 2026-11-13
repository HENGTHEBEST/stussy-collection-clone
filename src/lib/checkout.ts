import type { DeliveryMethod } from '../../shared/commerce';

export interface CheckoutFields {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  delivery: DeliveryMethod;
}

export type CheckoutErrors = Partial<Record<keyof CheckoutFields, string>>;

export function validateCheckout(fields: CheckoutFields): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const required: (keyof CheckoutFields)[] = ['name', 'email', 'phone', 'street', 'city', 'country', 'delivery'];
  for (const key of required) {
    if (!fields[key].trim()) errors[key] = 'This field is required.';
  }
  if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (fields.phone.trim() && fields.phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a phone number with at least 7 digits.';
  if (fields.delivery.trim() && !['standard', 'express'].includes(fields.delivery)) errors.delivery = 'Choose a delivery option.';
  return errors;
}
