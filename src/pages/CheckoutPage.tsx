import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { CreateOrderRequest } from '../../shared/commerce';
import { OrderSummary } from '../components/commerce/OrderSummary';
import { ApiError, createOrder } from '../lib/api';
import { validateCheckout, type CheckoutErrors, type CheckoutFields } from '../lib/checkout';
import { useCart } from '../state/CartProvider';
import { useFeedback } from '../state/FeedbackProvider';

const initialFields: CheckoutFields = {
  name: '', email: '', phone: '', street: '', city: '', region: '', postalCode: '', country: '', delivery: 'standard',
};
const contactFields = [
  ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['street', 'Street address'],
  ['city', 'City'], ['region', 'Region'], ['postalCode', 'Postal code'], ['country', 'Country'],
] as const;
const invalidMessage = 'Check the highlighted fields before continuing to KHQR.';

export function CheckoutPage() {
  const { lines, clear } = useCart();
  const { announce } = useFeedback();
  const navigate = useNavigate();
  const [fields, setFields] = useState<CheckoutFields>(initialFields);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [networkError, setNetworkError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submitted = useRef(false);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const form = useRef<HTMLFormElement>(null);

  // Cart clearing can render before the router's order transition commits.
  if (!lines.length && !submitted.current) return <Navigate to="/cart" replace />;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current) return;
    const nextErrors = validateCheckout(fields);
    setErrors(nextErrors);
    setNetworkError('');
    const firstError = (Object.keys(initialFields) as (keyof CheckoutFields)[]).find((key) => nextErrors[key]);
    if (firstError) {
      announce(invalidMessage);
      form.current?.querySelector<HTMLElement>('#checkout-' + firstError)?.focus();
      return;
    }
    submitted.current = true;
    setSubmitting(true);
    try {
      const request: CreateOrderRequest = {
        requestId: crypto.randomUUID(),
        customer: { name: fields.name, email: fields.email, phone: fields.phone },
        address: { street: fields.street, city: fields.city, region: fields.region, postalCode: fields.postalCode, country: fields.country },
        delivery: fields.delivery,
        lines: lines.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity })),
      };
      const order = await createOrder(request);
      if (!active.current) return;
      clear();
      navigate('/order/' + order.id, { replace: true, state: { order } });
    } catch (error) {
      if (!active.current) return;
      const message = error instanceof ApiError ? error.message : 'The shop service is temporarily unavailable.';
      setNetworkError(message);
      announce(message);
      submitted.current = false;
      setSubmitting(false);
    }
  }

  function input(key: Exclude<keyof CheckoutFields, 'delivery'>, label: string) {
    const id = 'checkout-' + key;
    const inputMode = key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text';
    return <label key={key} htmlFor={id}><span id={id + '-label'}>{label}</span>
      <input id={id} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
        autoComplete="off" inputMode={inputMode} required aria-labelledby={id + '-label'}
        value={fields[key]} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
        aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? id + '-error' : undefined} />
      {errors[key] && <span id={id + '-error'} className="field-error">{errors[key]}</span>}
    </label>;
  }

  return <div className="page-shell commerce-page"><h1>Checkout</h1>
    <p>Continue to KHQR to review your server order and payment details.</p>
    <form ref={form} noValidate autoComplete="off" onSubmit={submit} aria-busy={submitting}>
      <h2 className="detail-subheading">Contact and delivery</h2>
      <div className="shop-toolbar">{contactFields.map(([key, label]) => input(key, label))}
        <label htmlFor="checkout-delivery">Delivery option
          <select id="checkout-delivery" value={fields.delivery} required
            onChange={(event) => setFields((current) => ({ ...current, delivery: event.target.value as CheckoutFields['delivery'] }))}
            aria-invalid={Boolean(errors.delivery)} aria-describedby={errors.delivery ? 'checkout-delivery-error' : undefined}>
            <option value="standard">Standard delivery</option><option value="express">Express delivery</option>
          </select>
          {errors.delivery && <span id="checkout-delivery-error">{errors.delivery}</span>}
        </label>
      </div>
      {Object.keys(errors).length > 0 && <p>{invalidMessage}</p>}
      {networkError && <p className="field-error">{networkError}</p>}
      <button type="submit" disabled={submitting}>Continue to KHQR</button>
    </form>
    <OrderSummary lines={lines} />
  </div>;
}
