import { useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { calculateTotals, OrderSummary } from '../components/commerce/OrderSummary';
import { createOrderSummary, isOrderSummaryRecord, validateCheckout, type CheckoutErrors, type CheckoutFields, type OrderSummaryRecord } from '../lib/checkout';
import { ORDER_STORAGE_KEY, readJson, writeJson } from '../lib/storage';
import { useCart } from '../state/CartProvider';
import { useFeedback } from '../state/FeedbackProvider';

const initialFields: CheckoutFields = {
  name: '', email: '', phone: '', street: '', city: '', region: '', postalCode: '', country: '',
  delivery: 'standard', cardholder: '', cardNumber: '', expiry: '', cvc: '',
};
const contactFields = [
  ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['street', 'Street address'],
  ['city', 'City'], ['region', 'Region'], ['postalCode', 'Postal code'], ['country', 'Country'],
] as const;
const paymentFields = [
  ['cardholder', 'Cardholder name'], ['cardNumber', 'Demo card number'], ['expiry', 'Expiry (MM/YY)'], ['cvc', 'CVC'],
] as const;

export function CheckoutPage() {
  const { lines, clear } = useCart();
  const { announce } = useFeedback();
  const navigate = useNavigate();
  const [fields, setFields] = useState<CheckoutFields>(initialFields);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const form = useRef<HTMLFormElement>(null);

  // Cart clearing can render before the router's confirmation transition commits.
  if (!lines.length && !submitted.current) return <Navigate to="/cart" replace />;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const nextErrors = validateCheckout(fields);
    setErrors(nextErrors);
    const firstError = (Object.keys(initialFields) as (keyof CheckoutFields)[]).find((key) => nextErrors[key]);
    if (firstError) {
      announce('Check the highlighted fields before placing your demo order.');
      form.current?.querySelector<HTMLElement>(`#checkout-${firstError}`)?.focus(); return;
    }
    submitted.current = true;
    setSubmitting(true);
    const order = createOrderSummary(fields, lines, calculateTotals(lines));
    writeJson(ORDER_STORAGE_KEY, order);
    const saved = readJson<OrderSummaryRecord | null>(ORDER_STORAGE_KEY, isOrderSummaryRecord, null);
    clear();
    announce('Demo order placed. No payment was sent.');
    navigate(`/order/${order.orderId}`, { replace: true, state: saved?.orderId === order.orderId ? null : { order } });
  }

  function input(key: Exclude<keyof CheckoutFields, 'delivery'>, label: string, payment = false) {
    const id = `checkout-${key}`;
    const inputMode = key === 'email' ? 'email' : key === 'phone' ? 'tel'
      : ['cardNumber', 'expiry', 'cvc'].includes(key) ? 'numeric' : 'text';
    return <label key={key} htmlFor={id}><span id={`${id}-label`}>{label}</span>
      <input id={id} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
        autoComplete="off" inputMode={inputMode} required spellCheck={payment ? false : undefined}
        aria-labelledby={`${id}-label`}
        value={fields[key]} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
        aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? `${id}-error` : undefined} />
      {errors[key] && <span id={`${id}-error`} className="field-error">{errors[key]}</span>}
    </label>;
  }

  return <div className="page-shell commerce-page"><h1>Checkout</h1>
    <section className="product-card" aria-labelledby="checkout-demo-title">
      <h2 id="checkout-demo-title" className="detail-subheading">Demo simulation only</h2>
      <p>Use fictional details and demo card 4242 4242 4242 4242, a future MM/YY expiry, and any three-digit CVC.</p>
      <p>No payment is sent. No personal or payment data is saved. No order will be fulfilled.</p>
    </section>
    <form ref={form} noValidate autoComplete="off" onSubmit={submit}>
      <h2 className="detail-subheading">Contact and delivery</h2>
      <div className="shop-toolbar">{contactFields.map(([key, label]) => input(key, label))}
        <label htmlFor="checkout-delivery">Delivery option
          <select id="checkout-delivery" value={fields.delivery}
            onChange={(event) => setFields((current) => ({ ...current, delivery: event.target.value as CheckoutFields['delivery'] }))}
            aria-invalid={Boolean(errors.delivery)} aria-describedby={errors.delivery ? 'checkout-delivery-error' : undefined}>
            <option value="standard">Standard demo delivery</option><option value="express">Express demo delivery</option>
          </select>
          {errors.delivery && <span id="checkout-delivery-error">{errors.delivery}</span>}
        </label>
      </div>
      <h2 className="detail-subheading">Demo payment</h2>
      <div className="shop-toolbar">{paymentFields.map(([key, label]) => input(key, label, true))}</div>
      {Object.keys(errors).length > 0 && <p role="alert">Check the highlighted fields before placing your demo order.</p>}
      <button type="submit" disabled={submitting}>Place demo order</button>
    </form>
    <OrderSummary lines={lines} />
  </div>;
}
