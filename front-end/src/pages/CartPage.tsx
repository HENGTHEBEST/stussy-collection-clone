import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Headphones, LockKeyhole, ShieldCheck, ShoppingBag, Trash2, Truck } from 'lucide-react';
import type { CheckoutPricing } from '../../../shared/commerce';
import { products } from '../data/products';
import { useCart } from '../state/CartProvider';
import { useFeedback } from '../state/FeedbackProvider';
import { cartLineKey, clampQuantity } from '../state/cartReducer';
import { QuantityControl } from '../components/commerce/QuantityControl';
import { calculateTotals, formatCurrency } from '../components/commerce/OrderSummary';
import { CheckoutWatermarks } from '../components/commerce/CheckoutPresentation';
import { SafeImage } from '../components/shared/SafeImage';
import { getCheckoutPricing } from '../lib/api';
import { clearCheckoutOrderIds } from '../lib/checkoutRecovery';

export function CartPage() {
  const { lines, selectedLines, select, setQuantity, remove } = useCart();
  const { announce } = useFeedback();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pricing, setPricing] = useState<CheckoutPricing>();
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const selectAll = useRef<HTMLInputElement>(null);
  const emptyAction = useRef<HTMLAnchorElement>(null);
  const resolved = lines.flatMap(line => { const product = products.find(item => item.id === line.productId); return product ? [{ line, product }] : []; });
  const eligible = selectedLines.filter(line => products.find(product => product.id === line.productId)?.available);
  const selectedKeys = new Set(eligible.map(cartLineKey));
  const totals = calculateTotals(eligible, pricing);
  const count = eligible.reduce((sum, line) => sum + line.quantity, 0);
  useEffect(() => {
    const controller = new AbortController();
    void getCheckoutPricing(controller.signal).then(setPricing).catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => { if (selectAll.current) selectAll.current.indeterminate = eligible.length > 0 && eligible.length < resolved.length; }, [eligible.length, resolved.length]);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; cancel.current?.focus();
    return () => { document.body.style.overflow = previous; (trigger.current ?? emptyAction.current)?.focus(); };
  }, [open]);
  function checkout() {
    if (!eligible.length) return;
    clearCheckoutOrderIds();
    navigate('/checkout');
  }
  return <div className={'page-shell commerce-page cart-page' + (resolved.length ? ' cart-has-items' : '')}><CheckoutWatermarks />
    <header className="checkout-page-heading"><h1>{resolved.length ? 'Your Cart' : 'Cart'}</h1><p>Review your {resolved.length ? 'selected ' : ''}items and proceed to checkout.</p></header>
    {resolved.length ? <div className="cart-layout"><div><section className="checkout-card cart-items-card" aria-label="Cart items">
      <div className="cart-selection-bar"><label><input ref={selectAll} type="checkbox" checked={eligible.length === resolved.length} onChange={event => resolved.forEach(({ line, product }) => select(cartLineKey(line), event.target.checked && product.available))} />Select All ({lines.reduce((sum, line) => sum + line.quantity, 0)} items)</label><button ref={trigger} disabled={!eligible.length} onClick={() => setOpen(true)} aria-haspopup="dialog"><Trash2 size={20} aria-hidden="true" />Remove Selected</button></div>
      <div className="cart-items">{resolved.map(({ line, product }) => {
        const key = cartLineKey(line);
        const label = `${product.name} (${line.color} / ${line.size})`;
        const price = pricing?.unitPriceMinor == null ? line.unitPrice : pricing.unitPriceMinor / 100;
        return <article className="cart-product-row" key={key} aria-label={label}>
          <input type="checkbox" aria-label={`Select ${label}`} checked={selectedKeys.has(key)} disabled={!product.available} onChange={event => select(key, event.target.checked)} />
          <Link to={`/product/${product.slug}`} aria-label={product.name}><SafeImage src={product.image} alt={product.name} fallbackLabel={`${product.name} image unavailable`} /></Link>
          <div className="cart-product-copy"><Link to={`/product/${product.slug}`}><h2>{product.name}</h2></Link><p>{line.color} / {line.size}</p><span className="cart-stock">{product.available ? 'Available' : 'Unavailable'}</span><small>Unit price: {formatCurrency(price)}</small></div>
          <QuantityControl quantity={line.quantity} onChange={value => { const quantity = clampQuantity(value); setQuantity(key, quantity); announce(`Updated ${label} to ${quantity}.`); }} />
          <strong className="cart-line-price" aria-label={`Line total: ${formatCurrency(price * line.quantity)}`}>{formatCurrency(price * line.quantity)}</strong>
          <button className="cart-remove" type="button" aria-label={`Remove ${label} from cart`} onClick={() => { remove(key); announce(`Removed ${label} from cart.`); }}><Trash2 size={21} aria-hidden="true" /></button>
        </article>;
      })}</div>
    </section><CartBenefits /></div>
      <section className="checkout-card cart-summary" aria-labelledby="cart-summary-title"><h2 id="cart-summary-title"><ShoppingBag aria-hidden="true" />Order summary</h2><dl className="checkout-totals"><div><dt>Subtotal ({count} {count === 1 ? 'item' : 'items'})</dt><dd>{formatCurrency(totals.subtotal)}</dd></div><div><dt>Estimated delivery</dt><dd>{formatCurrency(totals.shipping)}</dd></div><div className="checkout-grand-total"><dt>Total</dt><dd>{formatCurrency(totals.total)}</dd></div></dl>
        <button className="checkout-primary" disabled={!eligible.length} onClick={checkout}><LockKeyhole aria-hidden="true" />Proceed to checkout<ArrowRight aria-hidden="true" /></button><Link className="checkout-secondary" to="/shop">Continue shopping</Link>
        <p className="cart-estimate-note">{!eligible.length ? 'Select at least one item to continue.' : 'Prices and delivery are verified by the shop at checkout.'}</p>
      </section>
    </div> : <><section className="checkout-card cart-empty"><ShoppingBag className="empty-bag" aria-hidden="true" /><h2>Your cart is empty</h2><p>Looks like you haven’t added anything to your cart yet.<br />Explore our latest collection and find something you love.</p><Link ref={emptyAction} className="checkout-primary" to="/shop">Continue shopping<ArrowRight aria-hidden="true" /></Link></section><CartBenefits /></>}
    {open && <div className="filter-backdrop cart-dialog-backdrop"><div className="checkout-card cart-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-cart-title" aria-describedby="clear-cart-description" onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
      if (event.key === 'Tab' && event.shiftKey && document.activeElement === cancel.current) { event.preventDefault(); confirm.current?.focus(); }
      if (event.key === 'Tab' && !event.shiftKey && document.activeElement === confirm.current) { event.preventDefault(); cancel.current?.focus(); }
    }}><h2 id="clear-cart-title">Remove selected items?</h2><p id="clear-cart-description">Remove {count} selected {count === 1 ? 'item' : 'items'} from your cart?</p><div><button ref={cancel} onClick={() => setOpen(false)}>Cancel</button><button ref={confirm} onClick={() => { eligible.forEach(line => remove(cartLineKey(line))); setOpen(false); announce(`Removed ${count} selected ${count === 1 ? 'item' : 'items'}.`); }}>Remove selected</button></div></div></div>}
  </div>;
}

function CartBenefits() {
  return <div className="cart-benefits"><div><Truck aria-hidden="true" /><span><strong>Delivery options</strong><small>Standard and express at checkout</small></span></div><div><ShieldCheck aria-hidden="true" /><span><strong>Secure Payment</strong><small>KHQR and ABA PayWay</small></span></div><Link to="/#contact"><Headphones aria-hidden="true" /><span><strong>Need Help?</strong><small>Contact our support team</small></span></Link></div>;
}
