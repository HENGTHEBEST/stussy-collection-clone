import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Check, CircleCheck, Copy, CreditCard, Package, ReceiptText, Truck } from 'lucide-react';
import type { PublicOrder } from '../../../../shared/commerce';
import { CheckoutItems, CheckoutProgress, CheckoutWatermarks } from './CheckoutPresentation';
import { formatMinorCurrency } from './OrderSummary';

export function OrderConfirmation({ order }: { order: PublicOrder }) {
  const [copyMessage, setCopyMessage] = useState('');
  async function copyOrderId() {
    try { await navigator.clipboard.writeText(order.id); setCopyMessage('Order ID copied'); }
    catch { setCopyMessage('Unable to copy. Select the order ID to copy it.'); }
  }
  return <>
    <CheckoutWatermarks /><CheckoutProgress step={3} />
    <header className="confirmation-heading">
      <span className="confirmation-check"><Check aria-hidden="true" /></span>
      <h1>Order Confirmed!</h1>
      <p>Thank you for your purchase. Your payment has been successful<br className="desktop-break" /> and your order is now being processed.</p>
      <div className="confirmation-order-id"><span>Order ID: <strong>{order.id}</strong></span><button type="button" aria-label="Copy order ID" onClick={() => void copyOrderId()}><Copy size={20} aria-hidden="true" /></button></div>
      {copyMessage && <p aria-live="polite">{copyMessage}</p>}
    </header>
    <div className="confirmation-grid">
      <section className="checkout-card" aria-labelledby="confirmed-details"><h2 id="confirmed-details"><Package aria-hidden="true" />Order Details</h2>
        <CheckoutItems lines={order.lines} />
        <dl className="confirmation-facts"><div><dt><CalendarDays aria-hidden="true" />Order Date</dt><dd><time dateTime={order.createdAt}>{new Date(order.createdAt).toLocaleString()}</time></dd></div>
          <div><dt><CreditCard aria-hidden="true" />Payment Method</dt><dd>{order.payment.method === 'card' ? 'Credit / Debit Card (ABA PayWay)' : 'KHQR'}</dd></div></dl>
      </section>
      <section className="checkout-card" aria-labelledby="confirmation-totals-title"><h2 id="confirmation-totals-title"><ReceiptText aria-hidden="true" />Payment Summary</h2>
        <dl className="checkout-totals"><div><dt>Subtotal</dt><dd>{formatMinorCurrency(order.subtotalMinor, order.currency)}</dd></div>
          <div><dt>Delivery</dt><dd>{formatMinorCurrency(order.shippingMinor, order.currency)}</dd></div>
          <div className="checkout-grand-total"><dt>Total Paid</dt><dd>{formatMinorCurrency(order.totalMinor, order.currency)}</dd></div></dl>
        <p className="confirmation-success" role="status"><CircleCheck aria-hidden="true" />Payment confirmed</p>
        {order.mockMode && <p className="confirmation-mode">Simulation only - no money will move</p>}
        {order.payment.sandbox && <p className="confirmation-mode">ABA PayWay sandbox test — no live card charge.</p>}
      </section>
      <section className="checkout-card" id="delivery-information" aria-labelledby="confirmed-delivery"><h2 id="confirmed-delivery"><Truck aria-hidden="true" />Delivery Information</h2>
        <dl className="confirmation-facts"><div><dt><Package aria-hidden="true" />Delivery Method</dt><dd>{order.deliveryLabel}</dd></div>
          <div><dt><Truck aria-hidden="true" />Order Status</dt><dd>Processing</dd></div></dl>
        <p className="fulfillment-note">Your payment is confirmed. Delivery updates will be available from the shop.</p>
      </section>
    </div>
    <div className="confirmation-actions"><a className="checkout-primary" href="#delivery-information"><Truck aria-hidden="true" />View Order Status<ArrowRight aria-hidden="true" /></a><Link className="checkout-secondary" to="/shop">Continue shopping</Link></div>
  </>;
}
