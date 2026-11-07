import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { products } from '../data/products';
import { useCart } from '../state/CartProvider';
import { useFeedback } from '../state/FeedbackProvider';
import { cartLineKey, clampQuantity } from '../state/cartReducer';
import { QuantityControl } from '../components/commerce/QuantityControl';
import { formatCurrency, OrderSummary } from '../components/commerce/OrderSummary';

export function CartPage() {
  const { lines, setQuantity, remove, clear } = useCart();
  const { announce } = useFeedback();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [cleared, setCleared] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const resolved = lines.flatMap((line) => { const product = products.find((item) => item.id === line.productId); return product ? [{ line, product }] : []; });
  const validLines = resolved.map(({ line }) => line);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancel.current?.focus();
    return () => { document.body.style.overflow = previous; trigger.current?.focus(); };
  }, [open]);

  return <div className="page-shell commerce-page"><h1>Cart</h1>
    <p>Your selected demo products. Prices are captured when added.</p>
    {(resolved.length > 0 || cleared) && <button ref={trigger} type="button"
      aria-haspopup={resolved.length ? 'dialog' : undefined}
      onClick={() => resolved.length ? setOpen(true) : navigate('/shop')}>
      {resolved.length ? 'Clear cart' : 'Explore shop'}
    </button>}
    {resolved.length ? <div>{resolved.map(({ line, product }) => {
      const key = cartLineKey(line);
      const label = `${product.name} (${line.color} / ${line.size})`;
      return <article className="product-card product-detail" key={key} aria-label={label}>
        <Link to={`/product/${product.slug}`} aria-label={product.name}><img src={product.image} alt={product.name} /><h2 className="detail-subheading">{product.name}</h2></Link>
        <div><p>{line.color} / {line.size}</p><p>Unit price: {formatCurrency(line.unitPrice)}</p>
        <QuantityControl quantity={line.quantity} onChange={(value) => {
          const quantity = clampQuantity(value); setQuantity(key, quantity);
          announce(`Updated ${label} to ${quantity}.`);
        }} />
        <p>Line total: {formatCurrency(line.unitPrice * line.quantity)}</p>
        <button type="button" aria-label={`Remove ${label} from cart`} onClick={() => { remove(key); announce(`Removed ${label} from cart.`); }}>Remove</button></div>
      </article>;
    })}</div> : <section><h2 className="detail-subheading">Your cart is empty</h2><p>Explore the collection and select your demo favorites.</p><Link to="/shop">{cleared ? 'Continue shopping' : 'Explore shop'}</Link></section>}
    <OrderSummary lines={validLines} />
    {open && <div className="filter-backdrop"><div className="filter-drawer" role="dialog" aria-modal="true" aria-labelledby="clear-cart-title"
      aria-describedby="clear-cart-description" onKeyDown={(event) => {
        if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
        if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancel.current) { event.preventDefault(); confirm.current?.focus(); }
        if (event.key === 'Tab' && !event.shiftKey && document.activeElement === confirm.current) { event.preventDefault(); cancel.current?.focus(); }
      }}>
      <h2 id="clear-cart-title">Clear your cart?</h2><p id="clear-cart-description">Remove every selected demo item from your cart?</p>
      <button ref={cancel} type="button" onClick={() => setOpen(false)}>Cancel</button>
      <button ref={confirm} type="button" onClick={() => {
        const count = validLines.reduce((sum, line) => sum + line.quantity, 0);
        clear(); setCleared(true); setOpen(false);
        announce(`Cleared cart: removed ${count} ${count === 1 ? 'item' : 'items'}.`);
      }}>Clear cart</button>
    </div></div>}
  </div>;
}
