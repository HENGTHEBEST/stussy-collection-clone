export type ProductSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type ProductColor = 'Black' | 'White' | 'Natural';

export interface Product {
  id: number;
  slug: string;
  label: string;
  name: string;
  description: string;
  image: string;
  category: 'T-Shirts' | 'Crops';
  color: ProductColor;
  sizes: ProductSize[];
  demoPrice: number;
  available: boolean;
  featuredRank: number;
  features: string[];
  gridSpan: 'wide' | 'medium' | 'standard';
  objectPosition: 'top' | 'center';
}

export interface CatalogFilters {
  query: string;
  categories: Product['category'][];
  colors: ProductColor[];
  sizes: ProductSize[];
  availableOnly: boolean;
}

export type CatalogSort = 'featured' | 'name-asc' | 'price-asc' | 'price-desc';
