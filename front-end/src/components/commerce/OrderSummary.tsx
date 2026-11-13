import { Link } from 'react-router-dom';
import { shippingPriceMinor, type CheckoutPricing, type DeliveryMethod } from '../../../../shared/commerce';
import type { CartLine } from '../../state/cartReducer';

export function calculateTotals(lines: CartLine[], pricing?: CheckoutPricing, delivery: DeliveryMethod = 'standard') {
  const subtotal = lines.reduce((sum, line) => sum + (pricing?.unitPriceMinor == null ? line.unitPrice : pricing.unitPriceMinor / 100) * line.quantity, 0);
  const shipping = shippingPriceMinor(Math.round(subtotal * 100), delivery, pricing?.freeShipping) / 100;
  return { subtotal, shipping, total: subtotal + shipping };
}

export function formatCurrency(value: number) { return `$${value.toFixed(2)}`; }

export function formatMinorCurrency(value: number, currency: 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100);
}

export function OrderSummary({ lines, showCheckoutLink = true, pricing }: { lines: CartLine[]; showCheckoutLink?: boolean; pricing?: CheckoutPricing }) {
  const { subtotal, shipping, total } = calculateTotals(lines, pricing);
  return <section className="product-card" aria-labelledby="order-summary-title">
    <h2 id="order-summary-title" className="detail-subheading">Order summary</h2>
    <dl><dt>Subtotal</dt><dd>{formatCurrency(subtotal)}</dd>
      <dt>Estimated shipping</dt><dd>{shipping === 0 ? 'Free' : formatCurrency(shipping)}</dd>
      <dt>Total</dt><dd>{formatCurrency(total)}</dd></dl>
    {!pricing?.freeShipping && subtotal > 0 && subtotal < 150 && <p>{formatCurrency(150 - subtotal)} away from free shipping.</p>}
    <p>Estimates only. Final prices and delivery are confirmed by the shop service.</p>
    {showCheckoutLink && (lines.length ? <Link className="checkout-action" to="/checkout">Proceed to checkout</Link> : <button type="button" disabled>Checkout</button>)}
  </section>;
}
