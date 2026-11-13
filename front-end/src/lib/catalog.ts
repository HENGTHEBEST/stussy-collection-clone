import { products } from '../data/products';
import type { CatalogFilters, CatalogSort, Product } from '../types/commerce';

export function findProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug);
}

export function filterProducts(source: readonly Product[], filters: CatalogFilters): Product[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return source.filter((product) => {
    const searchable = [product.name, product.label, product.description, product.category]
      .join(' ')
      .toLocaleLowerCase();

    return (!query || searchable.includes(query))
      && (!filters.categories.length || filters.categories.includes(product.category))
      && (!filters.colors.length || filters.colors.includes(product.color))
      && (!filters.sizes.length || filters.sizes.some((size) => product.sizes.includes(size)))
      && (!filters.availableOnly || product.available);
  });
}

export function sortProducts(source: readonly Product[], sort: CatalogSort): Product[] {
  return [...source].sort((a, b) => {
    switch (sort) {
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'price-asc': return a.demoPrice - b.demoPrice;
      case 'price-desc': return b.demoPrice - a.demoPrice;
      case 'featured': return a.featuredRank - b.featuredRank;
    }
  });
}

export function relatedProducts(product: Product, limit = 3): Product[] {
  return products
    .filter((candidate) => candidate.id !== product.id)
    .sort((a, b) =>
      Number(b.category === product.category) - Number(a.category === product.category)
      || Number(b.color === product.color) - Number(a.color === product.color)
      || a.featuredRank - b.featuredRank)
    .slice(0, Math.max(0, Math.floor(limit)));
}
