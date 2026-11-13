import { ArrowRight, CalendarDays, CircleAlert, CreditCard, Headphones, Info, ReceiptText, RotateCw, ShoppingBag, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import type { PublicOrder } from '../../../shared/commerce';
import { useCart } from '../../state/CartProvider';
import { cartLineKey } from '../../state/cartReducer';
import { clearCheckoutOrderIds } from '../../lib/checkoutRecovery';
import { CheckoutItems, CheckoutProgress, CheckoutWatermarks } from './CheckoutPresentation';
import { formatMinorCurrency } from './OrderSummary';

export function OrderFailure({ order }: { order: PublicOrder }) {
  const { lines, add, select } = useCart();
  const navigate = useNavigate();
  const title = order.status === 'expired' ? 'Payment Expired' : order.status === 'cancelled' ? 'Payment Cancelled' : 'Payment Failed';
  function retry() {
    lines.forEach(line => select(cartLineKey(line), order.lines.some(item => cartLineKey({ ...item, unitPrice: item.unitPriceMinor / 100 }) === cartLineKey(line))));
    order.lines.forEach(line => {
      const cartLine = { ...line, unitPrice: line.unitPriceMinor / 100 };
      if (!lines.some(item => cartLineKey(item) === cartLineKey(cartLine))) add(cartLine);
      select(cartLineKey(cartLine), true);
    });
    clearCheckoutOrderIds();
    navigate('/checkout');
  }
  return <><CheckoutWatermarks /><CheckoutProgress step={3} />
    <header className="confirmation-heading"><span className="confirmation-check failure-check"><X aria-hidden="true" /></span><h1>{title}</h1>
      <p>Your payment was not completed. Please try again or use a different payment method.</p></header>
    <div className="failure-reason"><CircleAlert aria-hidden="true" /><div><strong>Reason: {order.status === 'expired' ? 'The payment window expired.' : order.status === 'cancelled' ? 'Payment was cancelled.' : 'Payment could not be processed.'}</strong><p>Your items are still available to review before trying again.</p></div></div>
    <dl className="failure-facts checkout-card"><div><ReceiptText aria-hidden="true" /><span><dt>Order ID</dt><dd>{order.id}</dd></span></div><div><CreditCard aria-hidden="true" /><span><dt>Payment Status</dt><dd className="failure-status" role="status">{order.status}</dd></span></div><div><CalendarDays aria-hidden="true" /><span><dt>Order Date</dt><dd>{new Date(order.createdAt).toLocaleString()}</dd></span></div></dl>
    <div className="failure-grid"><section className="checkout-card" aria-labelledby="failed-order-summary"><h2 id="failed-order-summary"><ShoppingBag aria-hidden="true" />Order Summary</h2><CheckoutItems lines={order.lines} />
      <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{formatMinorCurrency(order.subtotalMinor, order.currency)}</dd></div><div><dt>Delivery</dt><dd>{formatMinorCurrency(order.shippingMinor, order.currency)}</dd></div><div className="checkout-grand-total"><dt>Total</dt><dd>{formatMinorCurrency(order.totalMinor, order.currency)}</dd></div></dl></section>
      <section className="checkout-card failure-help"><h2><Info aria-hidden="true" />What can you do?</h2><button onClick={retry}><RotateCw aria-hidden="true" /><span><strong>Try the payment again</strong><small>Review your details and start a new payment.</small></span><ArrowRight aria-hidden="true" /></button>
        <button onClick={retry}><CreditCard aria-hidden="true" /><span><strong>Use another payment method</strong><small>Choose KHQR or a different card at checkout.</small></span><ArrowRight aria-hidden="true" /></button>
        <Link to="/#contact"><Headphones aria-hidden="true" /><span><strong>Need help?</strong><small>Contact the shop if the problem continues.</small></span><ArrowRight aria-hidden="true" /></Link></section></div>
    <div className="confirmation-actions"><button className="checkout-primary" onClick={retry}><RotateCw aria-hidden="true" />Retry Payment<ArrowRight aria-hidden="true" /></button><Link className="checkout-secondary" to="/shop">Back to Shop</Link></div>
  </>;
}
