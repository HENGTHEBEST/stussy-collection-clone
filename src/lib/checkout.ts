import { calculateTotals } from '../components/commerce/OrderSummary';
import { isCartState, type CartLine } from '../state/cartReducer';

export interface CheckoutFields {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  delivery: 'standard' | 'express';
  cardholder: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

export interface OrderSummaryRecord {
  orderId: string;
  createdAt: string;
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
  deliveryLabel: 'Standard demo delivery' | 'Express demo delivery';
}

export type CheckoutErrors = Partial<Record<keyof CheckoutFields, string>>;

export function validateCheckout(fields: CheckoutFields, now = new Date()): CheckoutErrors {
  const errors: CheckoutErrors = {};
  for (const key of Object.keys(fields) as (keyof CheckoutFields)[]) {
    if (!fields[key].trim()) errors[key] = 'This field is required.';
  }
  if (fields.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) errors.email = 'Enter a valid email address.';
  if (fields.phone.trim() && fields.phone.replace(/\D/g, '').length < 7) errors.phone = 'Enter a phone number with at least 7 digits.';
  if (!['standard', 'express'].includes(fields.delivery)) errors.delivery = 'Choose a demo delivery option.';
  if (fields.cardNumber.trim() && fields.cardNumber.replace(/[\s-]/g, '') !== '4242424242424242') errors.cardNumber = 'Use the documented demo card number.';
  if (fields.expiry.trim()) {
    const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(fields.expiry.trim());
    if (!match) errors.expiry = 'Enter expiry as MM/YY.';
    else if (new Date(2000 + Number(match[2]), Number(match[1]), 0, 23, 59, 59, 999).getTime() <= now.getTime()) errors.expiry = 'This demo card expiry has expired.';
  }
  if (fields.cvc.trim() && !/^\d{3}$/.test(fields.cvc.trim())) errors.cvc = 'Enter exactly 3 digits.';
  return errors;
}

export function createOrderSummary(fields: CheckoutFields, lines: CartLine[], totals: ReturnType<typeof calculateTotals>): OrderSummaryRecord {
  return {
    orderId: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    lines: lines.map(({ productId, size, color, quantity, unitPrice }) => ({ productId, size, color, quantity, unitPrice })),
    subtotal: totals.subtotal, shipping: totals.shipping, total: totals.total,
    deliveryLabel: fields.delivery === 'express' ? 'Express demo delivery' : 'Standard demo delivery',
  };
}

export function isOrderSummaryRecord(value: unknown): value is OrderSummaryRecord {
  if (typeof value !== 'object' || value === null) return false;
  const order = value as Record<string, unknown>;
  const keys = ['orderId', 'createdAt', 'lines', 'subtotal', 'shipping', 'total', 'deliveryLabel'];
  if (Object.keys(order).length !== keys.length || !Object.keys(order).every((key) => keys.includes(key))
    || typeof order.orderId !== 'string' || !/^DEMO-[0-9A-F]{8}$/.test(order.orderId)
    || typeof order.createdAt !== 'string' || !Number.isFinite(Date.parse(order.createdAt))
    || new Date(order.createdAt).toISOString() !== order.createdAt
    || !isCartState({ lines: order.lines }) || !Array.isArray(order.lines) || !order.lines.length
    || !['Standard demo delivery', 'Express demo delivery'].includes(order.deliveryLabel as string)) return false;
  const totals = calculateTotals(order.lines);
  return (['subtotal', 'shipping', 'total'] as const).every((key) => typeof order[key] === 'number'
    && Number.isFinite(order[key]) && Number.isFinite(totals[key]) && order[key] === totals[key]);
}
