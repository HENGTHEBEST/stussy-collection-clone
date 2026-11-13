import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Check, CreditCard, Globe, House, Info, LockKeyhole, Mail, MapPin, Package, Phone, QrCode, ShieldCheck, ShoppingBag, Ticket, Truck, UserRound, Zap } from 'lucide-react';
import { CheckoutItems, CheckoutProgress, CheckoutWatermarks } from '../components/commerce/CheckoutPresentation';
import { KhqrPaymentModal, type KhqrModalStatus } from '../components/commerce/KhqrPaymentModal';
import { products } from '../data/products';
import type { CheckoutPricing, CreateOrderRequest, PublicOrder } from '../../../shared/commerce';
import { calculateTotals, formatCurrency, formatMinorCurrency } from '../components/commerce/OrderSummary';
import { ApiError, checkAddress, createOrder, getCheckoutPricing, getOrder } from '../lib/api';
import { validateCheckout, type CheckoutErrors, type CheckoutFields } from '../lib/checkout';
import { readCheckoutOrderIds, removeCheckoutOrderId, saveCheckoutOrderIds } from '../lib/checkoutRecovery';
import { useCart } from '../state/CartProvider';
import { useFeedback } from '../state/FeedbackProvider';

const initialFields: CheckoutFields = {
  name: '', email: '', phone: '', street: '', city: '', region: '', postalCode: '', country: 'Cambodia', delivery: 'standard',
};
const fieldDetails = {
  name: [UserRound, 'Your full name', 'name'], email: [Mail, 'you@example.com', 'email'],
  phone: [Phone, '+855 12 345 678', 'tel'], street: [House, 'House number, street, building', 'street-address'],
  city: [MapPin, 'Phnom Penh', 'address-level2'], region: [MapPin, 'Province / region', 'address-level1'],
  postalCode: [Ticket, 'e.g. 12000', 'postal-code'], country: [Globe, 'Cambodia', 'country-name'],
} as const;
const invalidMessage = 'Check the highlighted fields before continuing.';

function CardBrands() {
  return <span className="card-brands" aria-hidden="true">
    <span className="card-brand-chip"><img className="visa-mark" src="/assets/payment/visa.svg" alt="" /></span>
    <span className="card-brand-chip"><img className="mastercard-mark" src="/assets/payment/mastercard.svg" alt="" /></span>
  </span>;
}

export function CheckoutPage() {
  const { selectedLines: lines, settlePaidOrder } = useCart();
  const { announce } = useFeedback();
  const navigate = useNavigate();
  const [recoveryIds] = useState(readCheckoutOrderIds);
  const [restoring, setRestoring] = useState(recoveryIds.length > 0);
  const [recoveryError, setRecoveryError] = useState('');
  const checkoutLines = useRef(lines);
  const [fields, setFields] = useState<CheckoutFields>(initialFields);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [networkError, setNetworkError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkingAddress, setCheckingAddress] = useState(false);
  const [pricing, setPricing] = useState<CheckoutPricing | null>(null);
  const [pricingError, setPricingError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'khqr' | 'card'>('khqr');
  const [step, setStep] = useState<'delivery' | 'payment'>(recoveryIds.length ? 'payment' : 'delivery');
  const [qrOpen, setQrOpen] = useState(false);
  const payButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!qrOpen) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = overflow; };
  }, [qrOpen]);
  const [order, setOrder] = useState<PublicOrder>();
  const [refreshError, setRefreshError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const submitted = useRef(false);
  const addressCheckPending = useRef(false);
  const created = useRef(recoveryIds.length > 0);
  const pendingOrderIds = useRef(recoveryIds);
  const paymentOrders = useRef<Partial<Record<'khqr' | 'card', PublicOrder>>>({});
  const orderData = useRef<Omit<CreateOrderRequest, 'requestId' | 'paymentMethod'> | undefined>(undefined);
  const requests = useRef<Partial<Record<'khqr' | 'card', { payload: string; request: CreateOrderRequest }>>>({});
  const statusRequest = useRef<AbortController | null>(null);
  const verificationPaused = useRef(false);
  const settleTimer = useRef<number | null>(null);
  const active = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      statusRequest.current?.abort();
      if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void getCheckoutPricing(controller.signal).then(setPricing).catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setPricingError(error instanceof ApiError ? error.message : 'The shop service is temporarily unavailable.');
      }
    });
    return () => controller.abort();
  }, []);
  const form = useRef<HTMLFormElement>(null);
  const paymentHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (step === 'payment') paymentHeading.current?.focus();
  }, [step]);

  function rememberOrder(selected: PublicOrder) {
    pendingOrderIds.current = [selected.id, ...pendingOrderIds.current.filter((id) => id !== selected.id)];
    saveCheckoutOrderIds(pendingOrderIds.current);
  }

  const restorePayment = useCallback(async () => {
    const ids = pendingOrderIds.current;
    if (!ids.length || statusRequest.current) return;
    const controller = new AbortController();
    statusRequest.current = controller;
    setRestoring(true); setRecoveryError('');
    try {
      const results = await Promise.allSettled(ids.map((id) => getOrder(id, controller.signal)));
      if (controller.signal.aborted || !active.current) return;
      const selected = results[0];
      if (selected.status === 'rejected') throw selected.reason;
      if (selected.value.id !== ids[0]) throw new ApiError('Invalid order', 404);
      if (selected.value.status !== 'awaiting_payment') {
        settlePaidOrder(selected.value);
        pendingOrderIds.current = removeCheckoutOrderId(selected.value.id);
        navigate('/order/' + selected.value.id, { replace: true, state: { order: selected.value } });
        return;
      }
      pendingOrderIds.current = ids.filter((id, index) => {
        const result = results[index];
        return result.status === 'rejected'
          ? !(result.reason instanceof ApiError && result.reason.status === 404)
          : result.value.id !== id || result.value.status === 'awaiting_payment';
      });
      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value.id === ids[index] && result.value.status === 'awaiting_payment') {
          paymentOrders.current[result.value.payment.method ?? 'khqr'] = result.value;
        }
      });
      const restored = selected.value;
      paymentOrders.current[restored.payment.method ?? 'khqr'] = restored;
      setPaymentMethod(restored.payment.method ?? 'khqr');
      setOrder(restored); setNow(Date.now());
      rememberOrder(restored);
    } catch (error) {
      if (controller.signal.aborted || !active.current) return;
      if (error instanceof ApiError && error.status === 404) {
        pendingOrderIds.current = removeCheckoutOrderId(ids[0]); created.current = false;
      } else setRecoveryError(error instanceof ApiError && error.status === 429 ? error.message : 'Unable to restore your payment. Please try again.');
    } finally {
      if (statusRequest.current === controller) {
        statusRequest.current = null;
        if (active.current) setRestoring(false);
      }
    }
  }, [recoveryIds, navigate]);

  useEffect(() => {
    void restorePayment();
    return () => { statusRequest.current?.abort(); statusRequest.current = null; };
  }, [restorePayment]);

  const refresh = useCallback(async () => {
    if (!order || statusRequest.current || verificationPaused.current) return;
    const controller = new AbortController();
    statusRequest.current = controller;
    setRefreshing(true);
    try {
      const updated = await getOrder(order.id, controller.signal);
      if (controller.signal.aborted || !active.current) return;
      setRefreshError('');
      paymentOrders.current[paymentMethod] = updated;
      setOrder(updated);
      if (updated.status !== 'awaiting_payment') {
        settlePaidOrder(updated);
        pendingOrderIds.current = removeCheckoutOrderId(updated.id);
        if (settleTimer.current === null) {
          settleTimer.current = window.setTimeout(() => {
            settleTimer.current = null;
            if (active.current) navigate('/order/' + updated.id, { replace: true, state: { order: updated } });
          }, 700);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && active.current) {
        if (error instanceof ApiError && error.status === 404) {
          pendingOrderIds.current = removeCheckoutOrderId(order.id); created.current = false; setOrder(undefined);
        } else {
          verificationPaused.current = error instanceof ApiError && error.status === 429;
          setRefreshError(verificationPaused.current && error instanceof ApiError ? error.message : 'Unable to refresh this order. Please try again.');
        }
      }
    } finally {
      if (statusRequest.current === controller) {
        statusRequest.current = null;
        if (active.current) setRefreshing(false);
      }
    }
  }, [order?.id, paymentMethod, navigate]);

  useEffect(() => {
    if (!order) return;
    void refresh();
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, !order.mockMode && paymentMethod === 'khqr' ? 30000 : 5000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);
    const onVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(poll); window.clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisibility);
      statusRequest.current?.abort(); statusRequest.current = null;
    };
  }, [order?.id, refresh]);

  // Keep cart items until a trusted paid response reconciles purchased quantities.
  if (!lines.length && !created.current && !submitting && !restoring) return <Navigate to="/cart" replace />;
  if (restoring || recoveryError) return <div className="page-shell commerce-page checkout-page">
    {restoring && createPortal(<div className="brand-loading-screen" role="status" aria-label="Restoring your payment"><img src="/assets/stussy-loading.gif" alt="" /></div>, document.body)}
    <h1>Checkout</h1><section className="checkout-card">
      <h2 className="detail-subheading">Restoring payment</h2>
      {restoring ? <p role="status">Checking your saved order with the shop...</p> : <>
        <p role="alert">{recoveryError}</p>
        <button type="button" onClick={() => void restorePayment()}>Retry restoring payment</button>
      </>}
    </section>
  </div>;

  async function preparePayment(method: 'khqr' | 'card') {
    if (submitted.current || restoring) return;
    statusRequest.current?.abort(); statusRequest.current = null;
    if (settleTimer.current !== null) { window.clearTimeout(settleTimer.current); settleTimer.current = null; }
    verificationPaused.current = false;
    setRefreshing(false); setRefreshError(''); setNetworkError('');
    setPaymentMethod(method);
    setOrder(paymentOrders.current[method]);
    if (paymentOrders.current[method]) { rememberOrder(paymentOrders.current[method]); if (method === 'khqr') setQrOpen(true); return; }
    if (!orderData.current || (method === 'card' && !pricing?.cardAvailable)) return;
    submitted.current = true;
    setSubmitting(true);
    try {
      const data = { ...orderData.current, ...(method === 'card' ? { paymentMethod: method } : {}) };
      const payload = JSON.stringify(data);
      if (requests.current[method]?.payload !== payload) {
        requests.current[method] = { payload, request: { requestId: crypto.randomUUID(), ...data } };
      }
      const nextOrder = await createOrder(requests.current[method]!.request);
      if (!active.current) return;
      paymentOrders.current[method] = nextOrder;
      rememberOrder(nextOrder);
      setOrder(nextOrder); setNow(Date.now());
      created.current = true;
      if (method === 'khqr') setQrOpen(true);
    } catch (error) {
      if (!active.current) return;
      const message = error instanceof ApiError ? error.message : 'The shop service is temporarily unavailable.';
      setNetworkError(message); announce(message);
      if (!created.current) setStep('delivery');
    } finally {
      submitted.current = false;
      if (active.current) setSubmitting(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitted.current || addressCheckPending.current || !pricing) return;
    if (created.current) { setStep('payment'); return; }
    const nextErrors = validateCheckout(fields);
    setErrors(nextErrors); setNetworkError('');
    const firstError = (Object.keys(initialFields) as (keyof CheckoutFields)[]).find((key) => nextErrors[key]);
    if (firstError) {
      announce(invalidMessage);
      form.current?.querySelector<HTMLElement>('#checkout-' + firstError)?.focus();
      return;
    }
    addressCheckPending.current = true;
    setCheckingAddress(true);
    try {
      const checked = await checkAddress({ city: fields.city, region: fields.region, country: fields.country });
      if (!active.current) return;
      const firstLocationError = (['city', 'region', 'country'] as const).find(key => checked.errors[key]);
      if (firstLocationError) {
        setErrors(checked.errors);
        announce(invalidMessage);
        form.current?.querySelector<HTMLElement>('#checkout-' + firstLocationError)?.focus();
        return;
      }
      if (!checked.address) throw new ApiError('Unable to check this address. Please try again.', 500);
      setFields(current => ({ ...current, ...checked.address }));
      orderData.current = {
        customer: { name: fields.name, email: fields.email, phone: fields.phone },
        address: { street: fields.street, ...checked.address, postalCode: fields.postalCode },
        delivery: fields.delivery,
        lines: lines.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity })),
      };
      setStep('payment');
      setPaymentMethod('khqr');
      setOrder(paymentOrders.current.khqr);
    } catch (error) {
      if (active.current) { const message = error instanceof ApiError ? error.message : 'Unable to check this address. Please try again.';
        setNetworkError(message); announce(message); }
    } finally {
      addressCheckPending.current = false;
      if (active.current) setCheckingAddress(false);
    }
  }

  function input(key: Exclude<keyof CheckoutFields, 'delivery'>, label: string) {
    const id = 'checkout-' + key;
    const [Icon, placeholder, autoComplete] = fieldDetails[key];
    const required = key !== 'region' && key !== 'postalCode';
    return <label key={key} htmlFor={id} className={'checkout-field field-' + key}><span id={id + '-label'}>{label}</span>{required && <span className="required-mark" aria-hidden="true">*</span>}
      <span className="checkout-input"><Icon size={20} aria-hidden="true" />
        <input id={id} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'}
          autoComplete={autoComplete} placeholder={placeholder} required={required} aria-labelledby={id + '-label'} readOnly={created.current || checkingAddress}
          value={fields[key]} onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
          aria-invalid={Boolean(errors[key])} aria-describedby={errors[key] ? id + '-error' : undefined} />
      </span>{errors[key] && <span id={id + '-error'} className="field-error">{errors[key]}</span>}
    </label>;
  }

  const remaining = order ? Math.max(0, Math.ceil((Date.parse(order.payment.expiresAt) - now) / 1000)) : 0;
  const countdown = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  const khqrStatus: KhqrModalStatus = order
    ? order.status === 'paid' ? 'success'
      : order.status !== 'awaiting_payment' ? 'failed'
        : refreshError ? 'unavailable' : 'pending'
    : 'pending';
  const summaryOrder = order ?? paymentOrders.current.khqr ?? paymentOrders.current.card;
  const needsMethodRecovery = pendingOrderIds.current.some((id) => !Object.values(paymentOrders.current).some((pending) => pending.id === id));
  const estimated = calculateTotals(checkoutLines.current, pricing ?? undefined, fields.delivery);
  const total = summaryOrder ? formatMinorCurrency(summaryOrder.totalMinor, summaryOrder.currency)
    : pricing ? formatCurrency(estimated.total) : '—';
  const reviewLines = summaryOrder?.lines ?? checkoutLines.current.map(line => {
    const product = products.find(product => product.id === line.productId)!;
    return { ...line, slug: product.slug, name: product.name, image: product.image, unitPriceMinor: pricing?.unitPriceMinor ?? Math.round(line.unitPrice * 100) };
  });
  const summary = <aside className="checkout-summary checkout-card" aria-labelledby="checkout-summary-title">
    <h2 id="checkout-summary-title" className="detail-subheading"><ShoppingBag aria-hidden="true" />Order Summary</h2>
    {pricing || summaryOrder ? <CheckoutItems lines={reviewLines} /> : <p>{pricingError || 'Loading price...'}</p>}
    <dl className="checkout-totals">
      <div><dt>Subtotal</dt><dd>{summaryOrder ? formatMinorCurrency(summaryOrder.subtotalMinor, 'USD') : pricing ? formatCurrency(estimated.subtotal) : '—'}</dd></div>
      <div><dt>Delivery <small>({(summaryOrder?.deliveryLabel ?? fields.delivery).startsWith('Express') || fields.delivery === 'express' ? 'Express' : 'Standard'})</small></dt><dd>{summaryOrder ? formatMinorCurrency(summaryOrder.shippingMinor, 'USD') : pricing ? formatCurrency(estimated.shipping) : '—'}</dd></div>
      <div className="checkout-grand-total"><dt>Total</dt><dd>{total}</dd></div>
    </dl>
    {step === 'delivery' ? <p className="checkout-notice"><Info aria-hidden="true" />You'll review your payment details in the next step.</p> : <>
      {paymentMethod === 'khqr' && <button ref={payButton} className="checkout-primary" type="button" disabled={submitting} onClick={() => void preparePayment('khqr')}><QrCode aria-hidden="true" />{submitting ? 'Creating payment...' : `Pay ${total}`}<ArrowRight aria-hidden="true" /></button>}
      {order && paymentMethod === 'card' && order.payment.checkout && remaining > 5 * 60 && <form action={order.payment.checkout.action} method="post">
        {Object.entries(order.payment.checkout.fields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
        <button className="checkout-primary" type="submit" aria-label="Pay securely with ABA PayWay"><LockKeyhole aria-hidden="true" />Pay {total}<ArrowRight aria-hidden="true" /></button>
      </form>}
      {orderData.current && <button type="button" className="checkout-back" onClick={() => { setQrOpen(false); setStep('delivery'); }}><ArrowLeft aria-hidden="true" />Back to Contact &amp; Delivery</button>}
    </>}
  </aside>;

  return <div className="page-shell commerce-page checkout-page">
    {(checkingAddress || submitting) && createPortal(<div className="brand-loading-screen" role="status" aria-label={checkingAddress ? 'Checking delivery address' : 'Creating payment'}><img src="/assets/stussy-loading.gif" alt="" /></div>, document.body)}
    <CheckoutWatermarks /><CheckoutProgress step={step === 'delivery' ? 1 : 2} />
    <header className="checkout-page-heading"><h1>{step === 'delivery' ? 'Contact & Delivery' : 'Payment'}</h1>
      <p>{step === 'delivery' ? 'Tell us where to send your order.' : 'Choose your preferred payment method and complete your purchase securely.'}</p></header>
    {step === 'delivery' ? <div className="checkout-layout">
      <form id="checkout-form" className="checkout-fields checkout-card" ref={form} noValidate onSubmit={submit} aria-busy={submitting || checkingAddress}>
        {created.current && <p className="checkout-notice"><Info aria-hidden="true" />These details are saved with your pending order. Contact the shop if they need changing.</p>}
        <h2 className="detail-subheading"><UserRound aria-hidden="true" />Contact Information</h2>
        <div className="checkout-form-grid">{input('name', 'Name')}{input('email', 'Email')}{input('phone', 'Phone')}</div>
        <h2 className="detail-subheading checkout-section-heading"><Truck aria-hidden="true" />Delivery Address</h2>
        <div className="checkout-form-grid">{input('street', 'Street address')}{input('city', 'City')}{input('region', 'Region')}{input('postalCode', 'Postal code')}{input('country', 'Country')}</div>
        <h2 className="detail-subheading"><Package aria-hidden="true" />Delivery Option</h2>
        <div className="delivery-options" role="radiogroup" aria-label="Delivery option">
          {(['standard', 'express'] as const).map(method => <label key={method} className={fields.delivery === method ? 'selected' : ''}>
            <input type="radio" name="delivery" value={method} checked={fields.delivery === method} disabled={created.current || checkingAddress} onChange={() => setFields(current => ({ ...current, delivery: method }))} />
            {method === 'standard' ? <Truck aria-hidden="true" /> : <Zap aria-hidden="true" />}<span><strong>{method === 'standard' ? 'Standard delivery' : 'Express delivery'}</strong><small>{method === 'standard' ? '3–5' : '1–2'} business days</small></span>
            <strong>{pricing ? formatCurrency(calculateTotals(checkoutLines.current, pricing, method).shipping) : '—'}</strong>
          </label>)}
        </div>
        {Object.keys(errors).length > 0 && <p className="field-error">{invalidMessage}</p>}
        {networkError && <p className="field-error">{networkError}</p>}
        <button className="checkout-primary" type="submit" disabled={submitting || checkingAddress || !pricing}>Continue to payment<ArrowRight aria-hidden="true" /></button>
      </form>{summary}
    </div> : <div className="checkout-layout">
      <section className="checkout-card checkout-payment" aria-label="Payment" aria-busy={submitting}>
        <h2 id="payment-title" className="detail-subheading" ref={paymentHeading} tabIndex={-1}><CreditCard aria-hidden="true" />Payment Method</h2>
        <p className="payment-intro">Select how you would like to pay.</p>
        <div className="payment-options" role="radiogroup" aria-label="Payment method">
          {(['khqr', 'card'] as const).map(method => <label key={method} className={paymentMethod === method ? 'selected' : ''}>
            <input type="radio" name="payment-method" value={method} checked={paymentMethod === method} disabled={submitting || (!orderData.current && !paymentOrders.current[method])} onChange={() => { setQrOpen(false); if (method === 'card') void preparePayment(method); else { setPaymentMethod(method); setOrder(paymentOrders.current.khqr); if (paymentOrders.current.khqr) rememberOrder(paymentOrders.current.khqr); } }} />
            {method === 'khqr' ? <QrCode className="khqr-symbol" aria-hidden="true" /> : <CreditCard aria-hidden="true" />}
            <span>{method === 'khqr' ? 'KHQR' : 'Credit / debit card'}<small>{method === 'khqr' ? 'Scan to pay with your banking app' : 'Pay securely with ABA PayWay'}</small></span>
            <span className="payment-selection" aria-hidden="true">{paymentMethod === method && <Check size={16} />}</span>
          </label>)}
        </div>
        {needsMethodRecovery ? <div><p>Another saved payment method is temporarily unavailable.</p><button type="button" disabled={refreshing} onClick={() => void restorePayment()}>Retry restoring payment methods</button></div>
          : !orderData.current && (!paymentOrders.current.khqr || !paymentOrders.current.card) && <p>To use a different payment method after reopening checkout, contact the shop with your order ID.</p>}
        {submitting && <p role="status">Creating your payment...</p>}
        {networkError && <><p className="field-error">{networkError}</p><button type="button" onClick={() => void preparePayment(paymentMethod)}>Retry payment setup</button></>}
        {paymentMethod === 'card' && !pricing?.cardAvailable && <p>Card checkout is temporarily unavailable. Please choose KHQR or try again later.</p>}
        {!order && paymentMethod === 'khqr' && !submitting && <div className="khqr-ready"><QrCode size={48} aria-hidden="true" /><h3>Ready when you are</h3><p>Click Pay to generate your secure KHQR code.<br />Your order amount will be included automatically.</p></div>}
        {order && <section className="checkout-payment-panel" aria-label={paymentMethod === 'card' ? 'Card payment' : 'KHQR payment'}>
          {paymentMethod === 'khqr' ? <>
            <p>Your payment is ready. Click Pay to view your QR code.</p><p className="checkout-order-id">Order ID <strong>{order.id}</strong></p>
            {qrOpen && <KhqrPaymentModal
              order={order} countdown={countdown} remaining={remaining}
              status={khqrStatus} refreshError={refreshError} error={networkError}
              onClose={() => { setQrOpen(false); payButton.current?.focus(); }}
            />}
          </> : <div className="hosted-card-details">
            <div className="card-details-heading"><h3><LockKeyhole aria-hidden="true" />Card Details</h3><CardBrands /></div>
            <div className="hosted-card-launch"><CreditCard size={44} aria-hidden="true" /><h3>Secure card checkout</h3><p>Continue to ABA PayWay to enter your cardholder name, card number, expiry date and CVC securely.</p><p>Your card details stay with the payment provider.</p></div>
            {remaining <= 5 * 60 && <p>Card checkout has closed. Waiting for PayWay to confirm the final status.</p>}
            <p className="checkout-notice"><ShieldCheck aria-hidden="true" />Your payment is processed securely by ABA PayWay.</p>
            <p className="checkout-order-id">Order ID <strong>{order.id}</strong></p>
          </div>}
          <div className="checkout-payment-status"><p className="payment-status">Awaiting {paymentMethod === 'card' ? 'card' : 'KHQR'} payment</p>
            <p className="khqr-merchant">{order.merchantName}</p>
            {order.mockMode && <p>Simulation only - no money will move</p>}
            {paymentMethod === 'card' && order.payment.sandbox && <p>ABA PayWay sandbox test - use an <a href="https://developer.payway.com.kh/resources-3305682f0" target="_blank" rel="noreferrer">ABA approved test card</a>. Real cards are not supported in sandbox. No live card charge.</p>}
            <p>Expires <time dateTime={order.payment.expiresAt}>{new Date(order.payment.expiresAt).toLocaleString()}</time></p>
            {remaining === 0 && <p>Waiting for the shop to confirm expiration.</p>}
            {refreshError && !qrOpen && <p role="alert">{refreshError}</p>}
          </div>
        </section>}
        <p className="checkout-notice"><Info aria-hidden="true" />After you complete payment, we’ll verify it and take you to the confirmation page.</p>
      </section>{summary}
    </div>}
  </div>;
}
