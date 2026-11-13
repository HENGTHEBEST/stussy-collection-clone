import { useSearchParams } from 'react-router-dom';
import { products } from '../data/products';
import { filterProducts, sortProducts } from '../lib/catalog';
import { categories, colors, sizes, FilterPanel } from '../components/commerce/FilterPanel';
import { ProductCard } from '../components/commerce/ProductCard';
import type { CatalogFilters, CatalogSort } from '../types/commerce';

const sortModes: CatalogSort[] = ['featured', 'name-asc', 'price-asc', 'price-desc'];
function supported<T extends string>(values: string[], allowed: readonly T[]): T[] {
  return allowed.filter((value) => values.includes(value));
}
export function ShopPage() {
  const [params, setParams] = useSearchParams();
  const filters: CatalogFilters = {
    query: params.get('q') ?? '', categories: supported(params.getAll('category'), categories),
    colors: supported(params.getAll('color'), colors), sizes: supported(params.getAll('size'), sizes),
    availableOnly: params.get('available') === '1',
  };
  const sort = supported([params.get('sort') ?? ''], sortModes)[0] ?? 'featured';
  const update = (next: CatalogFilters, nextSort = sort) => {
    const query = new URLSearchParams();
    if (next.query) query.set('q', next.query);
    next.categories.forEach((value) => query.append('category', value));
    next.colors.forEach((value) => query.append('color', value));
    next.sizes.forEach((value) => query.append('size', value));
    if (next.availableOnly) query.set('available', '1');
    if (nextSort !== 'featured') query.set('sort', nextSort);
    setParams(query, { replace: true });
  };
  const clear = () => setParams({}, { replace: true });
  const results = sortProducts(filterProducts(products, filters), sort);
  return <div className="page-shell commerce-page shop-page"><h1>Shop</h1>
    <p>Illustrative prices, sizes, colors, and availability. No live inventory or purchases.</p>
    <div className="shop-toolbar"><label>Search products<input type="search" value={filters.query} onChange={(event) => update({ ...filters, query: event.target.value })} /></label>
      <label>Sort products<select value={sort} onChange={(event) => update(filters, supported([event.target.value], sortModes)[0] ?? 'featured')}>
        <option value="featured">Featured</option><option value="name-asc">Name A–Z</option><option value="price-asc">Demo price: low to high</option><option value="price-desc">Demo price: high to low</option>
      </select></label></div>
    <div className="shop-layout"><FilterPanel filters={filters} onChange={update} onClear={clear} /><div>
      <p aria-label="Product results" aria-live="polite" aria-atomic="true">{results.length} {results.length === 1 ? 'product' : 'products'}</p>
      {results.length ? <div className="product-grid">{results.map((product) => <ProductCard key={product.id} product={product} />)}</div>
        : <section aria-label="Empty results"><h2>No products found</h2><p>Try a different search or clear your filters to see the collection.</p><button onClick={clear}>Clear all</button></section>}
    </div></div>
  </div>;
}
