import { Link } from 'react-router-dom';
import type { Product } from '../../types/commerce';
import { useWishlist } from '../../state/WishlistProvider';
import { useFeedback } from '../../state/FeedbackProvider';
import { SafeImage } from '../shared/SafeImage';

export function ProductCard({ product }: { product: Product }) {
  const { has, toggle } = useWishlist(); const { announce } = useFeedback();
  const saved = has(product.id);
  return <article className="product-card">
    <Link to={`/product/${product.slug}`} aria-label={product.name}>
      <SafeImage src={product.image} alt={product.name} fallbackLabel={`${product.name} image unavailable`} loading="lazy" style={{ objectPosition: product.objectPosition }} />
      <h3>{product.name}</h3>
    </Link>
    <p>Demo price: ${product.demoPrice.toFixed(2)}</p>
    <p>Demo availability: {product.available ? 'Available' : 'Unavailable'}</p>
    <button aria-pressed={saved} aria-label={saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`}
      onClick={() => { toggle(product.id); announce(`${saved ? 'Removed from' : 'Added to'} wishlist: ${product.name}`); }}>
      {saved ? 'Saved · Remove' : 'Save to wishlist'}
    </button>
  </article>;
}
