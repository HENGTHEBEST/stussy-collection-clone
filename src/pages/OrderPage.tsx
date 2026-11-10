import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import type { PublicOrder } from '../../shared/commerce';
import { ApiError, getOrder, simulateMockPayment } from '../lib/api';
import { formatMinorCurrency } from '../components/commerce/OrderSummary';
import { SafeImage } from '../components/shared/SafeImage';

type LoadState = 'loading' | 'ready' | 'not-found' | 'connection-error';
interface OrderView { id: string | undefined; state: LoadState; order?: PublicOrder }

export function OrderPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const seed = location.state?.order as PublicOrder | undefined;
  const [view, setView] = useState<OrderView>(() => ({ id: orderId, state: seed?.id === orderId ? 'ready' : 'loading', order: seed?.id === orderId ? seed : undefined }));
  const [now, setNow] = useState(Date.now);
  const [simulating, setSimulating] = useState(false);
  const active = useRef<AbortController | null>(null);
  const simulationBusy = useRef(false);
  const order = view.id === orderId ? view.order : undefined;
  const state = view.id === orderId ? view.state : 'loading';

  const refresh = useCallback(async (simulate = false) => {
    if (!orderId || (simulate && simulationBusy.current)) return;
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    simulationBusy.current = simulate;
    setSimulating(simulate);
    setView((current) => ({ ...current, state: current.order ? 'ready' : 'loading' }));
    try {
      const updated = await (simulate ? simulateMockPayment(orderId) : getOrder(orderId, controller.signal));
      if (!controller.signal.aborted) setView({ id: orderId, state: 'ready', order: updated });
    } catch (error) {
      if (controller.signal.aborted || (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')) return;
      if (error instanceof ApiError && error.status === 404) setView({ id: orderId, state: 'not-found' });
      else setView((current) => ({ ...current, state: 'connection-error' }));
    } finally {
      if (active.current === controller) {
        active.current = null;
        simulationBusy.current = false;
        setSimulating(false);
      }
    }
  }, [orderId]);

  useEffect(() => {
    const initial = seed?.id === orderId ? seed : undefined;
    setView({ id: orderId, state: initial ? 'ready' : 'loading', order: initial });
    void refresh();
    return () => { active.current?.abort(); active.current = null; simulationBusy.current = false; };
  }, [orderId, seed, refresh]);

  const pending = order?.status === 'awaiting_payment';
  useEffect(() => {
    if (!pending || state !== 'ready') return;
    const interval = window.setInterval(() => { if (!active.current) void refresh(); }, 5000);
    return () => window.clearInterval(interval);
  }, [pending, state, refresh]);

  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [pending, orderId]);

  const connectionError = state === 'connection-error' && <div className="connection-error">
    <p role="alert">Unable to refresh this order. Please try again.</p>
    <button type="button" onClick={() => void refresh()}>Retry</button>
  </div>;
  if (state === 'not-found') return <div className="page-shell commerce-page"><h1>Order not available</h1>
    <p>This order could not be found.</p><Link to="/shop">Continue shopping</Link>
  </div>;
  if (!order) return <div className="page-shell commerce-page"><h1>{state === 'loading' ? 'Loading order' : 'Order status unavailable'}</h1>
    {connectionError}<Link to="/shop">Continue shopping</Link>
  </div>;

  const remaining = Math.max(0, Math.ceil((Date.parse(order.payment.expiresAt) - now) / 1000));
  const countdown = Math.floor(remaining / 60) + ':' + String(remaining % 60).padStart(2, '0');
  const heading = pending ? 'Awaiting payment' : order.status === 'paid' ? 'Order confirmation' : 'Order ' + order.status;
  return <div className="page-shell commerce-page"><h1>{heading}</h1>
    <p>{order.id}</p><p>Created <time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString()}</time></p>
    {connectionError}
    <section className="khqr-payment-card" aria-label="KHQR payment">
      <header className="khqr-card-header" aria-hidden="true">KHQR</header>
      <div className="khqr-card-body">
        <p className="khqr-merchant">{order.merchantName}</p>
        <p className="khqr-amount">{formatMinorCurrency(order.totalMinor, order.currency)}</p>
        {pending && <div className="khqr-frame"><img src={order.payment.qrDataUrl} alt={order.mockMode ? 'Simulated Bakong KHQR payment code' : 'Bakong KHQR payment code'} /></div>}
        <div className="khqr-card-status">
        <h2 id="payment-title" className="detail-subheading">Payment status</h2>
        <p className="payment-status" role="status" aria-live="polite">{pending ? 'Awaiting KHQR payment' : order.status === 'paid' ? 'Payment confirmed' : 'Payment not confirmed'}</p>
        {order.mockMode && <p>Simulation only - no money will move</p>}
        {pending && <>
          <p>Payment currency: <strong>{order.currency}</strong></p>
          <p>Expires <time dateTime={order.payment.expiresAt}>{new Date(order.payment.expiresAt).toLocaleString()}</time></p>
          <p className="payment-countdown">Time remaining: {countdown}</p>
          {remaining === 0 && <p>Waiting for the shop to confirm expiration.</p>}
          {order.mockMode && <button type="button" disabled={simulating || remaining === 0 || state !== 'ready'} onClick={() => void refresh(true)}>Simulate successful payment</button>}
        </>}
        {!pending && order.status !== 'paid' && <><p>No payment confirmation is available for this order.</p><Link to="/checkout">Return to checkout</Link></>}
        </div>
      </div>
    </section>
    <p>{order.deliveryLabel}</p>
    {order.lines.map((line) => <article key={line.productId + ':' + line.color + ':' + line.size} className="product-card product-detail">
      <Link to={'/product/' + line.slug}><SafeImage src={line.image} alt={line.name} fallbackLabel={line.name + ' image unavailable'} /></Link>
      <div><h2 className="detail-subheading">{line.name}</h2><p>{line.color} / {line.size}</p>
        <p>Quantity: {line.quantity}</p><p>Unit price: {formatMinorCurrency(line.unitPriceMinor, order.currency)}</p>
        <p>Line total: {formatMinorCurrency(line.unitPriceMinor * line.quantity, order.currency)}</p></div>
    </article>)}
    <section className="product-card" aria-labelledby="confirmation-totals-title">
      <h2 className="detail-subheading" id="confirmation-totals-title">Order totals</h2>
      <dl><dt>Subtotal</dt><dd>{formatMinorCurrency(order.subtotalMinor, order.currency)}</dd>
        <dt>Shipping</dt><dd>{formatMinorCurrency(order.shippingMinor, order.currency)}</dd>
        <dt>Total</dt><dd>{formatMinorCurrency(order.totalMinor, order.currency)}</dd></dl>
    </section>
    <Link to="/shop">Continue shopping</Link>
  </div>;
}
