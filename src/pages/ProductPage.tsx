import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { findProductBySlug, relatedProducts } from '../lib/catalog';
import type { Product, ProductSize } from '../types/commerce';
import { ProductCard } from '../components/commerce/ProductCard';
import { QuantityControl } from '../components/commerce/QuantityControl';
import { VariantSelector } from '../components/commerce/VariantSelector';
import { useCart } from '../state/CartProvider';
import { useWishlist } from '../state/WishlistProvider';
import { useFeedback } from '../state/FeedbackProvider';
import { SafeImage } from '../components/shared/SafeImage';

export function ProductPage() {
  const { slug = '' } = useParams(); const product = findProductBySlug(slug);
  if (!product) return <div className="page-shell"><h1>Product not found</h1><p>This product is not in our demo collection.</p><div className="action-row"><Link to="/shop">Explore shop</Link><Link to="/">Return home</Link></div></div>;
  return <ProductDetails key={product.id} product={product} />;
}
function ProductDetails({ product }: { product: Product }) {
  const [size, setSize] = useState<ProductSize | ''>(''); const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState(''); const [message, setMessage] = useState('');
  const sizeRef = useRef<HTMLDivElement>(null);
  const { add, lines } = useCart(); const { has, toggle } = useWishlist(); const { announce } = useFeedback();
  const saved = has(product.id);
  return <div className="page-shell commerce-page">
    <nav aria-label="Breadcrumb" className="breadcrumb"><Link to="/">Home</Link> / <Link to="/shop">Shop</Link> / <span>{product.name}</span></nav>
    <section aria-label="Product details" className="product-detail"><SafeImage className="product-image" src={product.image} alt={product.name} fallbackLabel={`${product.name} image unavailable`} style={{ objectPosition: product.objectPosition }} />
      <div><p className="eyebrow">{product.label}</p><h1>{product.name}</h1><p>{product.description}</p>
        <p>Demo price: ${product.demoPrice.toFixed(2)}</p><p>Demo availability: {product.available ? 'Available' : 'Unavailable'}</p>
        <p>Illustrative variants and pricing; no live inventory or purchases.</p>
        <VariantSelector product={product} size={size} onSizeChange={(value) => { setSize(value); setError(''); }} error={error} sizeRef={sizeRef} />
        <QuantityControl quantity={quantity} onChange={setQuantity} />
        <div className="action-row"><button disabled={!product.available} onClick={() => {
          if (!product.available) return;
          if (!size) { setError('Choose a size before adding to cart.'); setMessage(''); sizeRef.current?.focus(); return; }
          const existing = lines.find((line) => line.productId === product.id && line.size === size && line.color === product.color);
          const addedQuantity = Math.min(quantity, 10 - (existing?.quantity ?? 0));
          if (addedQuantity > 0) add({ productId: product.id, size, color: product.color, quantity: addedQuantity, unitPrice: product.demoPrice });
          const confirmation = addedQuantity > 0 ? `Added ${addedQuantity} ${product.name} to the demo cart.` : 'Quantity limit reached: 10 per variant.';
          setMessage(confirmation); announce(confirmation);
        }}>{product.available ? 'Add to cart' : 'Unavailable'}</button>
          <button aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`} onClick={() => {
            toggle(product.id); const confirmation = `${saved ? 'Removed from' : 'Added to'} wishlist: ${product.name}`; setMessage(confirmation); announce(confirmation);
          }}>{saved ? 'Saved · Remove' : 'Save to wishlist'}</button></div>
        {message && <p className="product-feedback">{message}</p>}
        <h2 className="detail-subheading">Demo features</h2><ul>{product.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
        <p>Demo shipping and returns: this simulated store does not ship products or process returns.</p>
      </div></section>
    <section aria-labelledby="related-heading" className="related-products"><h2 id="related-heading">Related products</h2><div className="product-grid">{relatedProducts(product).map((related) => <ProductCard key={related.id} product={related} />)}</div></section>
  </div>;
}
