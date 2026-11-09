import type { Product } from './commerce';

// Prices, sizes, colors, availability, features, and ranks are illustrative demo
// data, not live Stussy pricing or inventory. Source copy and imagery are preserved.
export const products: Product[] = [
  {
    id: 1, slug: '8-ball-tee-black', label: 'STUSSY — 8-BALL TEE', name: '8-Ball Tee — Black',
    description: 'Heavyweight cotton. Iconic 8-ball chest graphic. Unisex cut.',
    image: '/assets/lookbook-8-ball-black.jpg', category: 'T-Shirts', color: 'Black',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 48, available: true, featuredRank: 1,
    features: ['Demo heavyweight cotton style', 'Demo unisex sizing'], gridSpan: 'wide', objectPosition: 'top',
  },
  {
    id: 2, slug: 'summer-classics-tee-white', label: 'STUSSY — SUMMER CLASSICS', name: 'Summer Classics Tee — White',
    description: 'Back print. Crown & script. Los Angeles, CA — Est. 1980.',
    image: '/assets/lookbook-summer-back.jpg', category: 'T-Shirts', color: 'White',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 46, available: true, featuredRank: 2,
    features: ['Demo relaxed sizing', 'Crown and script back graphic'], gridSpan: 'medium', objectPosition: 'center',
  },
  {
    id: 3, slug: 'basic-logo-tee-white', label: 'STUSSY — BASIC LOGO TEE', name: 'Basic Logo Tee — White',
    description: 'Graffiti back logo. Relaxed fit. Pure cotton.',
    image: '/assets/lookbook-basic-back.jpg', category: 'T-Shirts', color: 'White',
    sizes: ['XS', 'S', 'M', 'L', 'XL'], demoPrice: 40, available: true, featuredRank: 3,
    features: ['Demo cotton style', 'Graffiti back logo'], gridSpan: 'standard', objectPosition: 'top',
  },
  {
    id: 4, slug: 'summer-classics-crop-black', label: 'STUSSY — SUMMER CLASSICS CROP', name: 'Summer Classics Crop — Black',
    description: 'Cropped silhouette. Summer Classics chest print.',
    image: '/assets/lookbook-summer-crop.jpg', category: 'Crops', color: 'Black',
    sizes: ['XS', 'S', 'M', 'L'], demoPrice: 38, available: true, featuredRank: 4,
    features: ['Demo cropped fit', 'Summer Classics chest graphic'], gridSpan: 'standard', objectPosition: 'top',
  },
  {
    id: 5, slug: 'basic-classic-tee-white', label: 'STUSSY — BASIC TEE', name: 'Basic Classic Tee — White',
    description: 'Minimal script chest logo. Oversized, clean silhouette.',
    image: '/assets/lookbook-basic-front.webp', category: 'T-Shirts', color: 'White',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 40, available: true, featuredRank: 5,
    features: ['Demo oversized sizing', 'Minimal chest script'], gridSpan: 'standard', objectPosition: 'center',
  },
  {
    id: 6, slug: 'dsm-new-york-crop-black', label: 'STUSSY — DSM NEW YORK', name: 'DSM New York Crop — Black',
    description: 'Dover Street Market collab. Graffiti back print.',
    image: '/assets/lookbook-dsm-crop.jpg', category: 'Crops', color: 'Black',
    sizes: ['XS', 'S', 'M', 'L'], demoPrice: 44, available: false, featuredRank: 6,
    features: ['Demo cropped fit', 'Graffiti back graphic'], gridSpan: 'medium', objectPosition: 'top',
  },
  {
    id: 7, slug: 'dsm-new-york-tee-black', label: 'STUSSY — DSM NEW YORK', name: 'DSM New York Tee — Black',
    description: 'Dover Street Market. Heavyweight back print.',
    image: '/assets/lookbook-dsm-tee.jpg', category: 'T-Shirts', color: 'Black',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 52, available: false, featuredRank: 7,
    features: ['Demo heavyweight style', 'Dover Street Market graphic'], gridSpan: 'standard', objectPosition: 'center',
  },
  {
    id: 8, slug: 'los-angeles-tee-white', label: 'STUSSY — LOS ANGELES', name: 'Los Angeles Tee — White',
    description: 'City signature back print. Classic graffiti script.',
    image: '/assets/lookbook-la-back.webp', category: 'T-Shirts', color: 'White',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 44, available: true, featuredRank: 8,
    features: ['Demo relaxed sizing', 'Los Angeles back graphic'], gridSpan: 'standard', objectPosition: 'center',
  },
  {
    id: 9, slug: '8-ball-tee-natural', label: 'STUSSY — 8-BALL TEE', name: '8-Ball Tee — Natural',
    description: 'Washed natural. Bold back 8-ball. For him & her.',
    image: '/assets/lookbook-8-ball-natural.jpg', category: 'T-Shirts', color: 'Natural',
    sizes: ['XS', 'S', 'M', 'L', 'XL'], demoPrice: 48, available: true, featuredRank: 9,
    features: ['Demo unisex sizing', 'Bold 8-ball back graphic'], gridSpan: 'wide', objectPosition: 'top',
  },
  {
    id: 10, slug: 'summer-classics-tee-white-women', label: 'STUSSY — SUMMER CLASSICS', name: 'Summer Classics Tee — White (Women)',
    description: 'Crown graphic. Relaxed oversized fit. S/S 2026.',
    image: '/assets/lookbook-summer-women.jpg', category: 'T-Shirts', color: 'White',
    sizes: ['XS', 'S', 'M', 'L'], demoPrice: 46, available: true, featuredRank: 10,
    features: ['Demo oversized sizing', 'Crown graphic'], gridSpan: 'medium', objectPosition: 'top',
  },
  {
    id: 11, slug: 'basic-logo-tee-men', label: 'STUSSY — BASIC LOGO TEE', name: 'Basic Logo Tee — Men',
    description: 'Front chest logo. Boxy fit. Classic everyday wear.',
    image: '/assets/hero-man.jpg', category: 'T-Shirts', color: 'Black',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 40, available: true, featuredRank: 11,
    features: ['Demo boxy sizing', 'Front chest logo'], gridSpan: 'standard', objectPosition: 'top',
  },
  {
    id: 12, slug: 'summer-classics-tee-white-front', label: 'STUSSY — SUMMER CLASSICS', name: 'Summer Classics Tee — White (Front)',
    description: 'Crown chest badge. Clean premium cotton.',
    image: '/assets/lookbook-summer-front.webp', category: 'T-Shirts', color: 'White',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 46, available: true, featuredRank: 12,
    features: ['Demo cotton style', 'Crown chest badge'], gridSpan: 'standard', objectPosition: 'center',
  },
  {
    id: 13, slug: 'tough-gear-tee-black', label: 'STUSSY — TOUGH GEAR', name: 'Tough Gear Tee — Black',
    description: 'Graffiti "Tough Gear" back print. Heavyweight drop shoulder.',
    image: '/assets/lookbook-tough-gear.jpg', category: 'T-Shirts', color: 'Black',
    sizes: ['S', 'M', 'L', 'XL'], demoPrice: 50, available: true, featuredRank: 13,
    features: ['Demo drop shoulder fit', 'Tough Gear back graphic'], gridSpan: 'standard', objectPosition: 'center',
  },
];
