import { Link, useLocation, useParams } from 'react-router-dom';
import type { PublicOrder } from '../../shared/commerce';
import { formatMinorCurrency } from '../components/commerce/OrderSummary';
import { SafeImage } from '../components/shared/SafeImage';

export function OrderPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const current = location.state?.order as PublicOrder | undefined;
  const order = current?.id === orderId ? current : null;
  if (!order) return <div className="page-shell commerce-page"><h1>Order not available</h1>
    <p>Open an order from checkout to view its details.</p>
    <Link to="/shop">Shop</Link>
  </div>;

  return <div className="page-shell commerce-page"><h1>Order confirmation</h1>
    <p>Your order is awaiting KHQR payment.</p>
    <p>{order.id}</p><p><time dateTime={order.createdAt}>{order.createdAt}</time></p>
    <p>{order.deliveryLabel}</p>
    {order.lines.map((line) => {
      return <article key={line.productId + ':' + line.color + ':' + line.size} className="product-card product-detail">
        <Link to={`/product/${line.slug}`}><SafeImage src={line.image} alt={line.name} fallbackLabel={`${line.name} image unavailable`} /></Link>
        <div><h2 className="detail-subheading">{line.name}</h2><p>{line.color} / {line.size}</p>
          <p>Quantity: {line.quantity}</p><p>Unit price: {formatMinorCurrency(line.unitPriceMinor, order.currency)}</p>
          <p>Line total: {formatMinorCurrency(line.unitPriceMinor * line.quantity, order.currency)}</p></div>
      </article>;
    })}
    <section className="product-card" aria-labelledby="confirmation-totals-title">
      <h2 className="detail-subheading" id="confirmation-totals-title">Order totals</h2>
      <dl><dt>Subtotal</dt><dd>{formatMinorCurrency(order.subtotalMinor, order.currency)}</dd>
        <dt>Shipping</dt><dd>{formatMinorCurrency(order.shippingMinor, order.currency)}</dd>
        <dt>Total</dt><dd>{formatMinorCurrency(order.totalMinor, order.currency)}</dd></dl>
    </section>
    <Link to="/shop">Continue shopping</Link>
  </div>;
}
