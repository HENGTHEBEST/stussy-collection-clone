import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { products } from '../data/products';
import { formatCurrency } from '../components/commerce/OrderSummary';
import { isOrderSummaryRecord, type OrderSummaryRecord } from '../lib/checkout';
import { ORDER_STORAGE_KEY, readJson } from '../lib/storage';
import { cartLineKey } from '../state/cartReducer';

export function OrderPage() {
  const { orderId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const stored = readJson<OrderSummaryRecord | null>(ORDER_STORAGE_KEY, isOrderSummaryRecord, null);
  const [current] = useState<unknown>(() => location.state?.order);
  useEffect(() => {
    // Browser history survives reload, so keep the unsaved fallback only in React memory.
    if (location.state?.order) navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate]);
  const order = stored?.orderId === orderId ? stored
    : isOrderSummaryRecord(current) && current.orderId === orderId ? current : null;
  if (!order) return <div className="page-shell commerce-page"><h1>Order not available</h1>
    <p>Only your latest saved demo order can be restored. It may be unavailable if browser storage was cleared or blocked.</p>
    <Link to="/shop">Shop</Link>
  </div>;

  return <div className="page-shell commerce-page"><h1>Order confirmation</h1>
    <p>Demo only. No payment was sent and no order will be fulfilled.</p>
    <p>{order.orderId}</p><p><time dateTime={order.createdAt}>{order.createdAt}</time></p>
    <p>{order.deliveryLabel}</p>
    <p>Refreshing this confirmation depends on browser storage retaining this latest demo summary.</p>
    {order.lines.map((line) => {
      const product = products.find((item) => item.id === line.productId)!;
      return <article key={cartLineKey(line)} className="product-card product-detail">
        <Link to={`/product/${product.slug}`}><img src={product.image} alt={product.name} /></Link>
        <div><h2 className="detail-subheading">{product.name}</h2><p>{line.color} / {line.size}</p>
          <p>Quantity: {line.quantity}</p><p>Unit price: {formatCurrency(line.unitPrice)}</p>
          <p>Line total: {formatCurrency(line.unitPrice * line.quantity)}</p></div>
      </article>;
    })}
    <section className="product-card" aria-labelledby="confirmation-totals-title">
      <h2 className="detail-subheading" id="confirmation-totals-title">Order totals</h2>
      <dl><dt>Subtotal</dt><dd>{formatCurrency(order.subtotal)}</dd>
        <dt>Demo shipping</dt><dd>{formatCurrency(order.shipping)}</dd>
        <dt>Total</dt><dd>{formatCurrency(order.total)}</dd></dl>
    </section>
    <Link to="/shop">Continue shopping</Link>
  </div>;
}
