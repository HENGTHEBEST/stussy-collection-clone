import { describe, expect, it } from 'vitest';
import { products as sharedProducts } from '../../shared/catalog';
import { products } from './products';

describe('demo catalog integrity', () => {
  it('uses the same catalog object in browser and server code', () => {
    expect(products).toBe(sharedProducts);
    expect(products.every((product) => Number.isInteger(product.demoPrice * 100))).toBe(true);
  });

  it('preserves thirteen distinct products in source order', () => {
    expect(products).toHaveLength(13);
    expect(new Set(products.map((product) => product.id)).size).toBe(13);
    expect(new Set(products.map((product) => product.slug)).size).toBe(13);
    expect(products[0].name).toBe('8-Ball Tee — Black');
    expect(products[12].name).toBe('Tough Gear Tee — Black');
  });

  it('provides local images and complete demo variants for every product', () => {
    for (const product of products) {
      expect(product.image).toMatch(/^\/assets\/[^/]+\.(jpg|webp)$/);
      expect(product.demoPrice).toBeGreaterThan(0);
      expect(product.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(product.label.length).toBeGreaterThan(0);
      expect(product.description.length).toBeGreaterThan(0);
      expect(product.sizes.length).toBeGreaterThan(0);
      expect(new Set(product.sizes).size).toBe(product.sizes.length);
      expect(product.features.length).toBeGreaterThan(0);
      expect(typeof product.available).toBe('boolean');
      expect(['T-Shirts', 'Crops']).toContain(product.category);
      expect(['Black', 'White', 'Natural']).toContain(product.color);
      expect(['wide', 'medium', 'standard']).toContain(product.gridSpan);
      expect(['top', 'center']).toContain(product.objectPosition);
      expect(product.sizes.every((size) => ['XS', 'S', 'M', 'L', 'XL'].includes(size))).toBe(true);
    }
    expect(products.map((product) => product.featuredRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  });

  it('reuses the source hero image for Basic Logo Tee — Men', () => {
    expect(products.find((product) => product.name === 'Basic Logo Tee — Men')?.image).toBe('/assets/hero-man.jpg');
  });
});
