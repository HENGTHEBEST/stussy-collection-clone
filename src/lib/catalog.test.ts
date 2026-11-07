import { describe, expect, it } from 'vitest';
import { products } from '../data/products';
import type { CatalogFilters, Product } from '../types/commerce';
import { filterProducts, findProductBySlug, relatedProducts, sortProducts } from './catalog';

const emptyFilters: CatalogFilters = {
  query: '', categories: [], colors: [], sizes: [], availableOnly: false,
};

describe('catalog lookup and filtering', () => {
  it('finds known slugs and returns undefined for unknown slugs', () => {
    expect(findProductBySlug('8-ball-tee-black')?.id).toBe(1);
    expect(findProductBySlug('missing-product')).toBeUndefined();
  });

  it('matches trimmed case-insensitive search across all searchable fields', () => {
    expect(filterProducts(products, { ...emptyFilters, query: '  8-BALL  ' }).map((p) => p.id)).toEqual([1, 9]);
    // Label-only term, description-only term, then category-only term.
    expect(filterProducts(products, { ...emptyFilters, query: 'STUSSY' })).toHaveLength(13);
    expect(filterProducts(products, { ...emptyFilters, query: 'PURE COTTON' }).map((p) => p.id)).toEqual([3]);
    expect(filterProducts(products, { ...emptyFilters, query: 'T-SHIRTS' })).toHaveLength(11);
  });

  it('returns all items with empty filters and no results for unmatched search', () => {
    expect(filterProducts(products, emptyFilters)).toEqual(products);
    expect(filterProducts(products, { ...emptyFilters, query: 'nonexistent graphic' })).toEqual([]);
  });

  it('matches any selection within a family and every selected family together', () => {
    expect(filterProducts(products, { ...emptyFilters, colors: ['Natural'] }).map((p) => p.id)).toEqual([9]);
    expect(filterProducts(products, {
      query: 'tee', categories: ['T-Shirts'], colors: ['Black', 'Natural'], sizes: ['XS', 'XL'], availableOnly: true,
    }).map((p) => p.id)).toEqual([1, 9, 11, 13]);
    expect(filterProducts(products, {
      ...emptyFilters, categories: ['Crops'], sizes: ['XL'],
    })).toEqual([]);
    expect(filterProducts(products, { ...emptyFilters, availableOnly: true }).map((p) => p.id)).not.toContain(7);
    expect(filterProducts(products, { ...emptyFilters, categories: ['T-Shirts', 'Crops'] })).toHaveLength(13);
  });
});

describe('catalog sorting', () => {
  const sample: Product[] = [
    { ...products[0], id: 101, name: 'Zulu', demoPrice: 30, featuredRank: 3 },
    { ...products[0], id: 102, name: 'Alpha', demoPrice: 20, featuredRank: 1 },
    { ...products[0], id: 103, name: 'Bravo', demoPrice: 10, featuredRank: 2 },
  ];

  it.each([
    ['featured', [102, 103, 101]],
    ['name-asc', [102, 103, 101]],
    ['price-asc', [103, 102, 101]],
    ['price-desc', [101, 102, 103]],
  ] as const)('sorts %s without mutating its input', (sort, expected) => {
    const frozen = Object.freeze([...sample]);
    const sorted = sortProducts(frozen, sort);
    expect(sorted.map((p) => p.id)).toEqual(expected);
    expect(frozen.map((p) => p.id)).toEqual([101, 102, 103]);
    expect(sorted).not.toBe(frozen);
  });
});

describe('related products', () => {
  it('excludes the current ID and prioritizes category, then color, then featured rank', () => {
    // Tee/Black first, then other tees, then Black crops despite their earlier ranks.
    expect(relatedProducts({ ...products[0] }, 5).map((p) => p.id)).toEqual([7, 11, 13, 2, 3]);
    expect(relatedProducts(products[3], 3).map((p) => p.id)).toEqual([6, 1, 7]);
    expect(relatedProducts(products[0], 20)).toHaveLength(12);
    expect(relatedProducts(products[0], 20).some((p) => p.id === 1)).toBe(false);
    expect(products.map((p) => p.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('honors zero, negative, fractional, and default limits', () => {
    expect(relatedProducts(products[0], 0)).toEqual([]);
    expect(relatedProducts(products[0], -1)).toEqual([]);
    expect(relatedProducts(products[0], 2.9)).toHaveLength(2);
    expect(relatedProducts(products[0])).toHaveLength(3);
  });
});
