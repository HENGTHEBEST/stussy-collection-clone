import { Link } from 'react-router-dom';
import type { CartLine } from '../../state/cartReducer';

export function calculateTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 150 ? 0 : 12;
  return { subtotal, shipping, total: subtotal + shipping };
}

export function formatCurrency(value: number) { return `$${value.toFixed(2)}`; }

export function OrderSummary({ lines }: { lines: CartLine[] }) {
  const { subtotal, shipping, total } = calculateTotals(lines);
  return <section className="product-card" aria-labelledby="order-summary-title">
    <h2 id="order-summary-title" className="detail-subheading">Order summary</h2>
    <dl><dt>Subtotal</dt><dd>{formatCurrency(subtotal)}</dd>
      <dt>Demo shipping</dt><dd>{shipping === 0 ? 'Free' : formatCurrency(shipping)}</dd>
      <dt>Total</dt><dd>{formatCurrency(total)}</dd></dl>
    {subtotal > 0 && subtotal < 150 && <p>{formatCurrency(150 - subtotal)} away from free demo shipping.</p>}
    <p>Demo only. No real payment or fulfillment.</p>
    {lines.length ? <Link to="/checkout">Demo checkout</Link> : <button type="button" disabled>Demo checkout</button>}
  </section>;
}
