import { Link } from 'react-router-dom';
import { products } from '../data/products';
import { ProductCard } from '../components/commerce/ProductCard';
import { useWishlist } from '../state/WishlistProvider';
import { useFeedback } from '../state/FeedbackProvider';

export function WishlistPage() {
  const { ids, clear } = useWishlist();
  const { announce } = useFeedback();
  const saved = ids.flatMap((id) => { const product = products.find((item) => item.id === id); return product ? [product] : []; });
  return <div className="page-shell commerce-page"><h1>Wishlist</h1>
    <p>Save your favorite demo products for another look.</p>
    {saved.length ? <>
      <button type="button" onClick={() => { clear(); announce(`Cleared wishlist: removed ${saved.length} ${saved.length === 1 ? 'product' : 'products'}.`); }}>Clear wishlist</button>
      <div className="product-grid">{saved.map((product) => <ProductCard key={product.id} product={product} />)}</div>
    </> : <section><h2 className="detail-subheading">Your wishlist is empty</h2><p>Find a favorite in the demo collection.</p><Link to="/shop">Explore shop</Link></section>}
  </div>;
}
