import { Link } from 'react-router-dom';
import type { CartLine } from '../../state/cartReducer';

export function calculateTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 150 ? 0 : 12;
  return { subtotal, shipping, total: subtotal + shipping };
}

export function formatCurrency(value: number) { return `$${value.toFixed(2)}`; }

export function formatMinorCurrency(value: number, currency: 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100);
}

export function OrderSummary({ lines, showCheckoutLink = true }: { lines: CartLine[]; showCheckoutLink?: boolean }) {
  const { subtotal, shipping, total } = calculateTotals(lines);
  return <section className="product-card" aria-labelledby="order-summary-title">
    <h2 id="order-summary-title" className="detail-subheading">Order summary</h2>
    <dl><dt>Subtotal</dt><dd>{formatCurrency(subtotal)}</dd>
      <dt>Estimated shipping</dt><dd>{shipping === 0 ? 'Free' : formatCurrency(shipping)}</dd>
      <dt>Total</dt><dd>{formatCurrency(total)}</dd></dl>
    {subtotal > 0 && subtotal < 150 && <p>{formatCurrency(150 - subtotal)} away from free shipping.</p>}
    <p>Estimates only. Final prices and delivery are confirmed by the shop service.</p>
    {showCheckoutLink && (lines.length ? <Link to="/checkout">Checkout</Link> : <button type="button" disabled>Checkout</button>)}
  </section>;
}
