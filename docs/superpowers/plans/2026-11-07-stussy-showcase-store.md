# Stussy Collection Showcase and Demo Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-contained, source-faithful Stussy Collection showcase with a complete local demo catalog, wishlist, cart, checkout, and order-confirmation flow.

**Architecture:** A Vite React TypeScript single-page application owns all routes and UI state. Typed product data feeds both the source-faithful showcase and commerce routes; cart, wishlist, and order-summary stores use validated `localStorage` adapters, while checkout contact and payment fields remain ephemeral.

**Tech Stack:** React, TypeScript, Vite, React Router, Framer Motion, Lucide React, Vitest, React Testing Library, jsdom, authored responsive CSS

**Spec:** `docs/superpowers/specs/2026-11-07-stussy-showcase-store-design.md`

## Global Constraints

- Keep every implementation file under `D:\Personal Project\Stussy Collection Clone`.
- Preserve the thirteen observed product names, labels, descriptions, and images.
- Store source imagery locally under `public/assets`; the running app must not depend on Base44 media URLs.
- Clearly label constructed prices, variants, stock, newsletter behavior, and checkout as demonstration content.
- Do not add a backend, authentication, analytics, payment provider, external commerce API, or email delivery.
- Never transmit or persist checkout name, email, phone, address, or payment fields.
- Persist only validated cart lines, wishlist IDs, and the latest non-personal simulated order summary.
- Accept only demo card `4242 4242 4242 4242`, a future `MM/YY`, and any three-digit security code.
- Support widths 360, 390, 768, 1024, and 1440 pixels without horizontal overflow.
- Disable nonessential motion for `prefers-reduced-motion: reduce` and custom-cursor behavior for coarse pointers.
- The folder is not currently a Git repository. Initialize it before the first commit; do not add a remote.

---

## File map

### Tooling and entry files

- `package.json`: dependencies and project scripts.
- `package-lock.json`: resolved dependency versions.
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`: TypeScript configuration.
- `vite.config.ts`: Vite and Vitest configuration.
- `index.html`: document metadata and application mount point.
- `.gitignore`: dependency, build, coverage, and local-environment exclusions.
- `src/main.tsx`: browser entry point.
- `src/test/setup.ts`: DOM matcher and storage cleanup setup.

### Application shell

- `src/app/App.tsx`: providers, browser router, scroll restoration, and route table.
- `src/app/AppErrorBoundary.tsx`: branded render-failure fallback.
- `src/app/ScrollManager.tsx`: path reset and hash scrolling.
- `src/components/shared/SiteHeader.tsx`: desktop navigation, mobile menu, wishlist, and cart indicators.
- `src/components/shared/SiteFooter.tsx`: reusable contact/footer content and demo newsletter.
- `src/components/shared/Feedback.tsx`: live-region status and empty/error-state primitives.
- `src/components/shared/DemoBadge.tsx`: consistent demo-data disclosure.

### Data and commerce domain

- `src/types/commerce.ts`: product, variant, cart, wishlist, checkout, and order types.
- `src/data/products.ts`: thirteen typed products and catalog filter options.
- `src/lib/catalog.ts`: search, filter, sort, slug lookup, and related-product functions.
- `src/lib/storage.ts`: schema-checked local-storage adapters.
- `src/lib/checkout.ts`: ephemeral checkout validation and order-summary creation.
- `src/state/cartReducer.ts`: pure cart operations.
- `src/state/CartProvider.tsx`: cart persistence and public hook.
- `src/state/WishlistProvider.tsx`: wishlist persistence and public hook.
- `src/state/FeedbackProvider.tsx`: transient global feedback messages.

### Source-faithful showcase

- `src/components/showcase/CustomCursor.tsx`: fine-pointer cursor dot, ring, and logo trail.
- `src/components/showcase/GrainOverlay.tsx`: decorative fixed grain.
- `src/components/showcase/HeroSection.tsx`: split model hero and pointer parallax.
- `src/components/showcase/MarqueeStrip.tsx`: looping collection text.
- `src/components/showcase/LookbookSection.tsx`: original asymmetric thirteen-card grid.
- `src/components/showcase/ManifestoSection.tsx`: Escape parallax section.
- `src/components/showcase/MotifsSection.tsx`: animated Lucky Dice and 8-Ball Flame panels.
- `src/components/showcase/AboutSection.tsx`: brand copy and timeline.
- `src/pages/HomePage.tsx`: home-section composition.

### Commerce UI and pages

- `src/components/commerce/ProductCard.tsx`: reusable product card.
- `src/components/commerce/FilterPanel.tsx`: desktop and mobile catalog controls.
- `src/components/commerce/VariantSelector.tsx`: accessible color and size controls.
- `src/components/commerce/QuantityControl.tsx`: bounded quantity input.
- `src/components/commerce/OrderSummary.tsx`: shared totals display.
- `src/pages/ShopPage.tsx`: URL-synchronized catalog.
- `src/pages/ProductPage.tsx`: product detail and related products.
- `src/pages/WishlistPage.tsx`: saved-product list.
- `src/pages/CartPage.tsx`: editable cart.
- `src/pages/CheckoutPage.tsx`: local-only checkout form.
- `src/pages/OrderPage.tsx`: restorable non-personal order summary.
- `src/pages/NotFoundPage.tsx`: branded recovery route.

### Styling and assets

- `src/styles/tokens.css`: colors, typography, spacing, and z-index tokens.
- `src/styles/base.css`: reset, global typography, focus, and reduced-motion rules.
- `src/styles/showcase.css`: source-faithful showcase layout and animations.
- `src/styles/commerce.css`: catalog and checkout layouts.
- `scripts/fetch-assets.mjs`: deterministic public-source asset downloader.
- `scripts/verify-assets.mjs`: required-file and non-empty-byte validation.
- `public/assets/*`: local logos, model photography, product photography, and motifs.

### Tests

- `src/data/products.test.ts`
- `src/lib/catalog.test.ts`
- `src/lib/storage.test.ts`
- `src/lib/checkout.test.ts`
- `src/state/cartReducer.test.ts`
- `src/app/App.test.tsx`
- `src/pages/ShopPage.test.tsx`
- `src/pages/ProductPage.test.tsx`
- `src/pages/CartPage.test.tsx`
- `src/pages/CheckoutPage.test.tsx`
- `src/components/showcase/CustomCursor.test.tsx`

---

### Task 1: Create the tested application foundation and local asset pipeline

**Files:**
- Create: `.gitignore`
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/app/App.tsx`
- Create: `src/test/setup.ts`
- Create: `src/app/App.test.tsx`
- Create: `scripts/fetch-assets.mjs`
- Create: `scripts/verify-assets.mjs`
- Create: `public/assets/.gitkeep`

**Interfaces:**
- Consumes: Approved design specification.
- Produces: `App(): JSX.Element`, scripts `npm run assets:fetch`, `npm run assets:verify`, `npm test`, and `npm run build`.

- [ ] **Step 1: Initialize source control and scaffold the package**

Run:

```powershell
git init
npm.cmd init -y
npm.cmd install react react-dom react-router-dom framer-motion lucide-react
npm.cmd install --save-dev vite typescript @types/react @types/react-dom @vitejs/plugin-react
npm.cmd install --save-dev vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: `package.json` and `node_modules` exist. Create the listed Vite, TypeScript, HTML, and source entry files directly so the existing `docs` folder is preserved.

- [ ] **Step 2: Add test and asset scripts**

Set the package scripts to:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "assets:fetch": "node scripts/fetch-assets.mjs",
    "assets:verify": "node scripts/verify-assets.mjs"
  }
}
```

Configure Vitest in `vite.config.ts`:

```ts
test: {
  environment: 'jsdom',
  setupFiles: './src/test/setup.ts',
  css: true,
}
```

- [ ] **Step 3: Write the failing application smoke test**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App';

it('renders the Stussy application shell', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /summer classics/i })).toBeInTheDocument();
});
```

- [ ] **Step 4: Run the smoke test and verify failure**

Run: `npm.cmd test -- src/app/App.test.tsx`

Expected: FAIL because `App` does not yet export the requested shell heading.

- [ ] **Step 5: Implement the minimal application shell**

```tsx
export function App() {
  return (
    <main id="main-content">
      <h1>Summer Classics</h1>
    </main>
  );
}
```

Update `src/main.tsx` to render `<App />` into `#root`.

- [ ] **Step 6: Implement deterministic asset scripts**

In `fetch-assets.mjs`, define the exact source URL-to-filename map for the logo, two hero models, thirteen lookbook image references, manifesto image, dice image, and 8-ball image recovered in the spec investigation. Fetch each response, require `response.ok`, and write bytes beneath `public/assets`.

```js
const assets = new Map([
  ['stussy-logo.png', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/c97919ae4_Logo-Stussy.png'],
  ['hero-man.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/24c850c67_can_you_replace_the_man_202606021542.jpg'],
  ['hero-woman.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/29c2a14ae_GirlModel1.jpg'],
  ['lookbook-8-ball-black.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/5fa09e26f_can_you_replace_the_model_202606022153.jpg'],
  ['lookbook-summer-back.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/37f6030f6_so_can_you_put_the_202606021334.jpg'],
  ['lookbook-basic-back.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/3694b2b4e_can_you_make_the_sleeve_202606021432.jpg'],
  ['lookbook-summer-crop.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/3ca94a911_can_you_make_the_t-shirt__202606021507.jpg'],
  ['lookbook-basic-front.webp', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/ae8686b94_Classict-shirtfrontview.webp'],
  ['lookbook-dsm-crop.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/7f51b6f1e_can_you_replace_the_girl_202606021520.jpg'],
  ['lookbook-dsm-tee.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/e1811e5a5_black_t-shirt2.jpg'],
  ['lookbook-la-back.webp', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/acddfb48e_WHitet-shirtbackview.webp'],
  ['lookbook-8-ball-natural.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/0dadb3974_can_you_replace_the_model_202606022202.jpg'],
  ['lookbook-summer-women.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/ce869d1e7_can_you_make_the_model_202606021547.jpg'],
  ['lookbook-summer-front.webp', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/d7c156a9c_WHitet-shirtFrontview.webp'],
  ['lookbook-tough-gear.jpg', 'https://media.base44.com/images/public/6a1fd044e02063c5fc67d52a/016455682_t-shirt1.jpg'],
  ['manifesto.jpg', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/346cceffe_StussClothforDecoration.jpg'],
  ['motif-dice.png', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/3bc6dff4f_Design2.png'],
  ['motif-8-ball.jpg', 'https://media.base44.com/images/public/user_68f09dbd211a6584f1c093c7/dbc15a74d_Design1.jpg'],
]);
```

The Basic Logo Tee — Men record reuses `hero-man.jpg`, matching the source bundle's duplicate URL. `verify-assets.mjs` imports this exact required filename list, checks every file exists, and rejects zero-byte files.

- [ ] **Step 7: Fetch and verify the local assets**

Run:

```powershell
npm.cmd run assets:fetch
npm.cmd run assets:verify
```

Expected: both commands exit 0 and report the complete required asset count.

- [ ] **Step 8: Run the test and build**

Run:

```powershell
npm.cmd test -- src/app/App.test.tsx
npm.cmd run build
```

Expected: PASS and Vite writes `dist/index.html`.

- [ ] **Step 9: Commit the foundation**

```powershell
git add .
git commit -m "chore: scaffold stussy showcase store"
```

---

### Task 2: Define the thirteen-product catalog and query functions

**Files:**
- Create: `src/types/commerce.ts`
- Create: `src/data/products.ts`
- Create: `src/data/products.test.ts`
- Create: `src/lib/catalog.ts`
- Create: `src/lib/catalog.test.ts`

**Interfaces:**
- Consumes: local asset paths from Task 1.
- Produces: `Product`, `ProductColor`, `ProductSize`, `products`, `findProductBySlug`, `filterProducts`, `sortProducts`, and `relatedProducts`.

- [ ] **Step 1: Write failing catalog integrity tests**

```ts
expect(products).toHaveLength(13);
expect(new Set(products.map((product) => product.slug)).size).toBe(13);
expect(products.every((product) => product.image.startsWith('/assets/'))).toBe(true);
expect(products.every((product) => product.demoPrice > 0)).toBe(true);
```

Add a test that checks the first observed product is `8-Ball Tee — Black` and the thirteenth is `Tough Gear Tee — Black`.

- [ ] **Step 2: Run catalog tests and verify failure**

Run: `npm.cmd test -- src/data/products.test.ts`

Expected: FAIL because the types and `products` export do not exist.

- [ ] **Step 3: Define exact commerce types**

```ts
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
```

Define `CatalogFilters` with `query`, `categories`, `colors`, `sizes`, and `availableOnly`, plus `CatalogSort = 'featured' | 'name-asc' | 'price-asc' | 'price-desc'`.

- [ ] **Step 4: Populate all thirteen records**

Copy the observed names, labels, descriptions, image mapping, grid span, and object position from the specification evidence. Add explicit demo prices, variants, stock flags, and features. Every constructed record uses the same typed shape and a local `/assets/...` image.

- [ ] **Step 5: Run catalog integrity tests**

Run: `npm.cmd test -- src/data/products.test.ts`

Expected: PASS.

- [ ] **Step 6: Write failing filter and sort tests**

```ts
expect(filterProducts(products, { ...emptyFilters, query: '8-ball' })).toHaveLength(2);
expect(filterProducts(products, { ...emptyFilters, colors: ['Natural'] }).every((p) => p.color === 'Natural')).toBe(true);
expect(sortProducts(products, 'price-asc')[0].demoPrice).toBeLessThanOrEqual(sortProducts(products, 'price-asc')[1].demoPrice);
expect(findProductBySlug('missing-product')).toBeUndefined();
expect(relatedProducts(products[0], 3)).toHaveLength(3);
```

- [ ] **Step 7: Implement pure catalog functions**

Normalize search with `toLocaleLowerCase()`, require every selected filter family to match, clone arrays before sorting, and exclude the current product from related results. Related products prefer matching category, then color, then `featuredRank`.

- [ ] **Step 8: Run tests and commit**

Run: `npm.cmd test -- src/data/products.test.ts src/lib/catalog.test.ts`

Expected: PASS.

```powershell
git add src/types src/data src/lib/catalog.ts src/lib/catalog.test.ts
git commit -m "feat: define demo product catalog"
```

---

### Task 3: Implement validated persistence, cart, wishlist, and feedback state

**Files:**
- Create: `src/lib/storage.ts`
- Create: `src/lib/storage.test.ts`
- Create: `src/state/cartReducer.ts`
- Create: `src/state/cartReducer.test.ts`
- Create: `src/state/CartProvider.tsx`
- Create: `src/state/WishlistProvider.tsx`
- Create: `src/state/FeedbackProvider.tsx`

**Interfaces:**
- Consumes: `ProductSize` and product IDs from Task 2.
- Produces: `CartLine`, `CartState`, `cartReducer`, `useCart()`, `useWishlist()`, `useFeedback()`, and storage adapters `readJson`, `writeJson`, `removeValue`.

- [ ] **Step 1: Define state types and write failing reducer tests**

```ts
export interface CartLine {
  productId: number;
  size: ProductSize;
  color: Product['color'];
  quantity: number;
  unitPrice: number;
}

export interface CartState {
  lines: CartLine[];
}
```

Test that identical variants merge, different sizes remain separate, quantity clamps to 1–10, remove deletes one line, and clear returns `{ lines: [] }`.

- [ ] **Step 2: Verify reducer tests fail**

Run: `npm.cmd test -- src/state/cartReducer.test.ts`

Expected: FAIL because `cartReducer` is missing.

- [ ] **Step 3: Implement the pure reducer**

Use actions:

```ts
type CartAction =
  | { type: 'add'; line: CartLine }
  | { type: 'setQuantity'; key: string; quantity: number }
  | { type: 'remove'; key: string }
  | { type: 'clear' }
  | { type: 'replace'; state: CartState };
```

Export `cartLineKey(line)` as `${productId}:${color}:${size}` and clamp all quantities through one `clampQuantity` helper.

- [ ] **Step 4: Run reducer tests**

Run: `npm.cmd test -- src/state/cartReducer.test.ts`

Expected: PASS.

- [ ] **Step 5: Write failing storage recovery tests**

Test malformed JSON, wrong schema version, missing product IDs, invalid sizes, and quantities outside 1–10. Every invalid payload must return the supplied fallback without throwing.

- [ ] **Step 6: Implement schema-checked storage**

```ts
export interface StoredEnvelope<T> {
  version: 1;
  value: T;
}

export function readJson<T>(key: string, validate: (value: unknown) => value is T, fallback: T): T;
export function writeJson<T>(key: string, value: T): void;
export function removeValue(key: string): void;
```

Catch unavailable-storage and quota errors. Validate values before returning them. Use keys `stussy-demo-cart-v1`, `stussy-demo-wishlist-v1`, and `stussy-demo-order-v1`.

- [ ] **Step 7: Implement providers**

`useCart()` returns `lines`, `itemCount`, `subtotal`, `add`, `setQuantity`, `remove`, and `clear`. `useWishlist()` returns `ids`, `has`, `toggle`, and `clear`. Persist only after initial storage hydration. `useFeedback()` exposes `announce(message)` and renders one polite live region.

- [ ] **Step 8: Run state tests and commit**

Run: `npm.cmd test -- src/state/cartReducer.test.ts src/lib/storage.test.ts`

Expected: PASS.

```powershell
git add src/lib/storage* src/state
git commit -m "feat: add persistent cart and wishlist state"
```

---

### Task 4: Build the application shell, routes, navigation, footer, and error states

**Files:**
- Modify: `src/app/App.tsx`
- Create: `src/app/AppErrorBoundary.tsx`
- Create: `src/app/ScrollManager.tsx`
- Create: `src/components/shared/SiteHeader.tsx`
- Create: `src/components/shared/SiteFooter.tsx`
- Create: `src/components/shared/Feedback.tsx`
- Create: `src/components/shared/DemoBadge.tsx`
- Create: `src/pages/NotFoundPage.tsx`
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `CartProvider`, `WishlistProvider`, and `FeedbackProvider` from Task 3.
- Produces: route shell, `SiteHeader`, `SiteFooter`, `DemoBadge`, `ScrollManager`, and common styles used by every page.

- [ ] **Step 1: Replace the smoke test with failing routing tests**

Render `App` with `interface AppProps { initialEntries?: string[] }`. Assert `/` shows Home, `/shop` shows Shop, `/cart` shows Cart, and an unknown route shows a `Page not found` heading. Assert the header has visible Shop, Wishlist, and Cart links and a skip link.

- [ ] **Step 2: Verify routing tests fail**

Run: `npm.cmd test -- src/app/App.test.tsx`

Expected: FAIL because the providers, routes, and shared navigation are missing.

- [ ] **Step 3: Implement router and providers**

Use `BrowserRouter` in production and `MemoryRouter` when `initialEntries` is supplied for tests. Wrap routes in this order: error boundary, router, feedback, wishlist, cart, scroll manager, header, main, footer.

```tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/shop" element={<ShopPage />} />
  <Route path="/product/:slug" element={<ProductPage />} />
  <Route path="/wishlist" element={<WishlistPage />} />
  <Route path="/cart" element={<CartPage />} />
  <Route path="/checkout" element={<CheckoutPage />} />
  <Route path="/order/:orderId" element={<OrderPage />} />
  <Route path="*" element={<NotFoundPage />} />
</Routes>
```

Temporary route components may contain only named headings until their dedicated tasks.

- [ ] **Step 4: Implement header and mobile menu**

Desktop shows logo, Home, Collection, About Us, Contact, Shop, Wishlist count, and Cart count. Mobile uses a button with `aria-expanded`, `aria-controls="mobile-navigation"`, Escape-to-close behavior, focus return to the trigger, and body-scroll locking while open.

- [ ] **Step 5: Implement footer newsletter and disclosures**

Validate email with `^[^\s@]+@[^\s@]+\.[^\s@]+$`. On submit, prevent default, do not write storage or call `fetch`, clear the field, and announce `Demo signup complete — no email was sent.` Unknown social destinations render as disabled text, not links.

- [ ] **Step 6: Implement tokens, base styles, and error states**

Define the observed palette, Bebas Neue/Inter/Space Mono fallbacks, square radius, focus outline, skip link, black body, and demo badge. The error boundary provides `Reload page` and `Return home` actions. The not-found page links to Home and Shop.

- [ ] **Step 7: Run routing tests and commit**

Run: `npm.cmd test -- src/app/App.test.tsx`

Expected: PASS.

```powershell
git add src/app src/components/shared src/pages/NotFoundPage.tsx src/styles
git commit -m "feat: add application shell and navigation"
```

---

### Task 5: Recreate the complete source-faithful showcase home page

**Files:**
- Create: `src/components/showcase/CustomCursor.tsx`
- Create: `src/components/showcase/CustomCursor.test.tsx`
- Create: `src/components/showcase/GrainOverlay.tsx`
- Create: `src/components/showcase/HeroSection.tsx`
- Create: `src/components/showcase/MarqueeStrip.tsx`
- Create: `src/components/showcase/LookbookSection.tsx`
- Create: `src/components/showcase/ManifestoSection.tsx`
- Create: `src/components/showcase/MotifsSection.tsx`
- Create: `src/components/showcase/AboutSection.tsx`
- Create: `src/pages/HomePage.tsx`
- Create: `src/styles/showcase.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `products`, `SiteHeader`, `SiteFooter`, local assets, and route links.
- Produces: the complete home page with IDs `hero`, `collection`, `escape`, `motifs`, `about`, and `contact`.

- [ ] **Step 1: Write failing home-composition tests**

Assert the document contains `Summer Classics`, `The Lookbook`, `Escape`, `The Motifs`, `Born on the Board`, all thirteen product names, and section IDs for every navigation anchor.

- [ ] **Step 2: Write failing custom-cursor capability tests**

Mock `matchMedia` so `(pointer: fine)` is false and assert cursor elements are absent. Mock fine pointer plus reduced motion and assert they remain absent. Mock fine pointer without reduced motion and assert `cursor-dot` and `cursor-ring` render.

- [ ] **Step 3: Verify tests fail**

Run: `npm.cmd test -- src/app/App.test.tsx src/components/showcase/CustomCursor.test.tsx`

Expected: FAIL because showcase components are missing.

- [ ] **Step 4: Implement hero, marquee, and custom cursor**

Use the observed local hero images, dark filters, split center line, logo, letter-staggered `SUMMER CLASSICS`, establishment copy, HIM/HER labels, and scroll indicator. Pointer parallax must be requestAnimationFrame-throttled and capped at the observed small translation range. Cursor trails remove themselves after 1.2 seconds and never exceed 24 simultaneous nodes.

- [ ] **Step 5: Implement the thirteen-card lookbook**

Map `gridSpan` to the observed desktop 12-column spans and retain two mobile columns. Each card shows label, name, and description over a dark gradient, zooms the image on hover, and links to `/product/:slug`. Use `whileInView` with `viewport={{ once: true, margin: '-80px' }}`.

- [ ] **Step 6: Implement manifesto, motifs, and about timeline**

Recreate the Escape photography, layered gradients, large heading, source manifesto text, logo watermark, animated dice, animated 8-ball, timeline years 1980/1991/2001/2026, and observed brand copy. Keep the original source numbering even where two sections use `04`.

- [ ] **Step 7: Implement source-faithful CSS and reduced motion**

Create the grain data URI, marquee loop, pendulum, float-breathe, letter reveal, hover zoom, hero clamps, asymmetric grid spans, and mobile stacking. Under reduced motion, remove parallax transforms, stop infinite loops, show final reveal states, and retain content visibility.

- [ ] **Step 8: Run showcase tests and commit**

Run: `npm.cmd test -- src/app/App.test.tsx src/components/showcase/CustomCursor.test.tsx`

Expected: PASS.

```powershell
git add src/components/showcase src/pages/HomePage.tsx src/styles/showcase.css src/app/App.test.tsx
git commit -m "feat: recreate stussy showcase experience"
```

---

### Task 6: Build searchable shop and product-detail routes

**Files:**
- Create: `src/components/commerce/ProductCard.tsx`
- Create: `src/components/commerce/FilterPanel.tsx`
- Create: `src/components/commerce/VariantSelector.tsx`
- Create: `src/components/commerce/QuantityControl.tsx`
- Create: `src/pages/ShopPage.tsx`
- Create: `src/pages/ShopPage.test.tsx`
- Create: `src/pages/ProductPage.tsx`
- Create: `src/pages/ProductPage.test.tsx`
- Create: `src/styles/commerce.css`

**Interfaces:**
- Consumes: catalog functions, product data, cart/wishlist hooks, and feedback hook.
- Produces: URL-synchronized shop, product details, variant selection, quantity selection, and related products.

- [ ] **Step 1: Write failing shop interaction tests**

Start at `/shop?q=8-ball&color=Black&sort=name-asc`. Assert only the black 8-Ball result is visible, the controls reflect URL state, clearing filters restores thirteen results, and selecting Natural writes `color=Natural` to the URL.

- [ ] **Step 2: Write failing product interaction tests**

Render `/product/8-ball-tee-black`. Assert Add to cart initially reports a size error, selecting `M` and quantity `2` adds two items, wishlist toggles, related products exclude the current slug, and an unknown slug shows a product-not-found recovery state.

- [ ] **Step 3: Verify tests fail**

Run: `npm.cmd test -- src/pages/ShopPage.test.tsx src/pages/ProductPage.test.tsx`

Expected: FAIL because the pages and controls are missing.

- [ ] **Step 4: Implement the shop route**

Parse query keys `q`, repeated `category`, repeated `color`, repeated `size`, `available=1`, and `sort`. Ignore unknown values. Update `URLSearchParams` with `replace: true`, preserve unrelated valid keys, show result count, and render a clear empty-results action.

- [ ] **Step 5: Implement accessible filters**

Desktop renders a persistent fieldset rail. Mobile renders a dialog drawer with focus trap, Escape close, labelled checkboxes, Apply, and Clear all. Search uses a visible label. Sort uses a native select.

- [ ] **Step 6: Implement product details and variant controls**

Size controls use a `radiogroup`; color controls include text labels; quantity is a labelled numeric input with decrement/increment buttons and 1–10 bounds. On invalid add, set a visible error and focus the size legend. On success, call `add` and `announce`.

- [ ] **Step 7: Run page tests and commit**

Run: `npm.cmd test -- src/pages/ShopPage.test.tsx src/pages/ProductPage.test.tsx`

Expected: PASS.

```powershell
git add src/components/commerce src/pages/ShopPage* src/pages/ProductPage* src/styles/commerce.css
git commit -m "feat: add shop and product browsing"
```

---

### Task 7: Build wishlist and cart routes with totals and recovery states

**Files:**
- Create: `src/components/commerce/OrderSummary.tsx`
- Create: `src/pages/WishlistPage.tsx`
- Create: `src/pages/CartPage.tsx`
- Create: `src/pages/CartPage.test.tsx`

**Interfaces:**
- Consumes: cart/wishlist hooks, `products`, and product lookup.
- Produces: editable cart, wishlist, `calculateTotals(lines)`, and shared order summary.

- [ ] **Step 1: Write failing cart-page tests**

Seed one line, render `/cart`, change quantity from 1 to 3, assert subtotal changes, remove the line, and assert the empty state. Add two lines, choose Clear cart, assert an in-app confirmation appears, cancel once, then confirm and assert the cart empties.

- [ ] **Step 2: Verify cart tests fail**

Run: `npm.cmd test -- src/pages/CartPage.test.tsx`

Expected: FAIL because the page and summary are missing.

- [ ] **Step 3: Implement totals and cart route**

```ts
export function calculateTotals(lines: CartLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shipping = subtotal === 0 || subtotal >= 150 ? 0 : 12;
  return { subtotal, shipping, total: subtotal + shipping };
}
```

Render line image, name, color, size, unit price, quantity, and line total. Use the existing quantity control. The checkout link is disabled for an empty cart.

- [ ] **Step 4: Implement explicit clear confirmation**

Use an accessible dialog titled `Clear your cart?` with Cancel and `Clear cart` actions. Return focus to the trigger after either action.

- [ ] **Step 5: Implement wishlist route**

Map valid saved IDs to products, discard unknown IDs through provider validation, show ProductCard controls, and provide `Clear wishlist` plus an empty-state link to `/shop`.

- [ ] **Step 6: Run cart tests and commit**

Run: `npm.cmd test -- src/pages/CartPage.test.tsx`

Expected: PASS.

```powershell
git add src/components/commerce/OrderSummary.tsx src/pages/WishlistPage.tsx src/pages/CartPage*
git commit -m "feat: add wishlist and cart pages"
```

---

### Task 8: Implement ephemeral checkout and restorable non-personal orders

**Files:**
- Create: `src/lib/checkout.ts`
- Create: `src/lib/checkout.test.ts`
- Create: `src/pages/CheckoutPage.tsx`
- Create: `src/pages/CheckoutPage.test.tsx`
- Create: `src/pages/OrderPage.tsx`

**Interfaces:**
- Consumes: cart lines, `calculateTotals`, storage adapter, and router navigation.
- Produces: `CheckoutFields`, `validateCheckout`, `createOrderSummary`, `CheckoutPage`, and `OrderPage`.

- [ ] **Step 1: Write failing checkout validation tests**

Test required contact/address fields, email format, phone length, postal-code presence, exact demo card, future expiry, and three-digit CVC. Assert a valid payload returns `{}` and card `5555 5555 5555 4444` returns `{ cardNumber: 'Use the documented demo card number.' }`.

- [ ] **Step 2: Write failing order privacy tests**

Call `createOrderSummary(fields, lines, totals)` and assert serialized output contains product IDs and totals but does not contain name, email, phone, street, postal code, card number, expiry, or CVC.

- [ ] **Step 3: Verify library tests fail**

Run: `npm.cmd test -- src/lib/checkout.test.ts`

Expected: FAIL because validation and order creation do not exist.

- [ ] **Step 4: Implement checkout functions**

```ts
export interface CheckoutFields {
  name: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  delivery: 'standard' | 'express';
  cardholder: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
}

export interface OrderSummaryRecord {
  orderId: string;
  createdAt: string;
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  total: number;
  deliveryLabel: 'Standard demo delivery' | 'Express demo delivery';
}
```

Generate `orderId` as `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`. Parse expiry as the final day of the selected month and require it to be in the future.

- [ ] **Step 5: Write failing checkout-page tests**

Assert an empty cart redirects to `/cart`; invalid submit renders associated errors; valid demo input navigates to `/order/:orderId`; cart clears; the stored envelope excludes every personal/payment field; and refreshing the matching order route restores the summary.

- [ ] **Step 6: Implement checkout and order pages**

Use controlled fields held only in component state. Add `autoComplete="off"` to demo payment fields and `inputMode` hints. On valid submit, create and persist the summary, clear the cart, replace-navigate to the order route, then let component unmount discard form state.

OrderPage accepts only the latest stored order whose `orderId` matches the route. Mismatch shows `Order not available` and links to Shop.

- [ ] **Step 7: Run checkout tests and commit**

Run: `npm.cmd test -- src/lib/checkout.test.ts src/pages/CheckoutPage.test.tsx`

Expected: PASS.

```powershell
git add src/lib/checkout* src/pages/CheckoutPage* src/pages/OrderPage.tsx
git commit -m "feat: add private demo checkout flow"
```

---

### Task 9: Complete accessibility, responsive behavior, and resilient media

**Files:**
- Modify: `src/components/shared/SiteHeader.tsx`
- Modify: `src/components/showcase/*.tsx`
- Modify: `src/components/commerce/*.tsx`
- Modify: `src/styles/base.css`
- Modify: `src/styles/showcase.css`
- Modify: `src/styles/commerce.css`
- Create: `src/components/shared/SafeImage.tsx`
- Modify: relevant tests from Tasks 4–8

**Interfaces:**
- Consumes: all completed UI.
- Produces: `SafeImage`, final keyboard/focus behavior, touch behavior, responsive layouts, and missing-image recovery.

- [ ] **Step 1: Add failing resilience and accessibility tests**

Test that SafeImage swaps to a labelled neutral fallback after `error`; mobile menu closes on Escape; focus returns to its trigger; cart dialog does the same; all form errors use `aria-describedby`; and reduced-motion mode does not render custom cursor nodes.

- [ ] **Step 2: Run the focused test suite and verify failures**

Run:

```powershell
npm.cmd test -- src/app/App.test.tsx src/components/showcase/CustomCursor.test.tsx src/pages/ProductPage.test.tsx src/pages/CartPage.test.tsx src/pages/CheckoutPage.test.tsx
```

Expected: at least the new SafeImage and focus assertions FAIL.

- [ ] **Step 3: Implement SafeImage and replace user-facing images**

```tsx
export function SafeImage({ fallbackLabel, ...props }: SafeImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div role="img" aria-label={fallbackLabel} className="media-fallback" />;
  return <img {...props} onError={() => setFailed(true)} />;
}
```

Decorative logos remain `aria-hidden`; meaningful product and model images use descriptive alt text.

- [ ] **Step 4: Finish focus, keyboard, and announcement behavior**

Ensure every icon-only action has an accessible name, every dialog traps focus, Escape closes transient UI, route changes focus the page heading, and add/remove/submit events announce through the shared live region.

- [ ] **Step 5: Finish responsive CSS**

At 360/390 widths: prevent header overflow, keep the hero title within the viewport, retain two lookbook columns, stack motifs, convert cart lines to cards, and use one-column checkout fields. At 768/1024/1440: restore asymmetric lookbook spans, two motif columns, timeline split, and multi-column footer. Add `overflow-wrap: anywhere` where long values may appear.

- [ ] **Step 6: Finish motion and pointer capability CSS**

Use `@media (pointer: coarse)` to restore the native cursor and hide cursor UI. Use `@media (prefers-reduced-motion: reduce)` to set scroll behavior to auto, animation duration to near-zero, stop marquee/pendulum/float loops, and remove parallax transforms.

- [ ] **Step 7: Run the complete tests and commit**

Run: `npm.cmd test`

Expected: PASS.

```powershell
git add src
git commit -m "fix: harden accessibility and responsive behavior"
```

---

### Task 10: Verify the complete production experience

**Files:**
- Modify only files required by observed verification failures.
- Create: `docs/verification/2026-11-07-stussy-store-verification.md`

**Interfaces:**
- Consumes: complete application.
- Produces: verified production build and evidence-backed verification report.

- [ ] **Step 1: Run all automated checks from a clean dependency state**

Run:

```powershell
npm.cmd ci
npm.cmd run assets:verify
npm.cmd test
npm.cmd run build
```

Expected: every command exits 0; `dist/index.html` exists; no test is skipped.

- [ ] **Step 2: Start the production preview**

Run: `npm.cmd run dev -- --host 127.0.0.1`

Expected: Vite reports a local URL. Keep the process running for browser QA.

- [ ] **Step 3: Verify source-faithful rendering**

At 1440×900 and 390×844, compare the home page against the captured target. Record results for fixed navigation, split hero, logo/title scale, marquee, thirteen-card grid, Escape section, motif panels, About timeline, footer, grain, and cursor capability behavior.

- [ ] **Step 4: Verify the full commerce journey**

Perform this exact flow:

1. Open `/shop`.
2. Search `8-ball`.
3. Filter color `Black`.
4. Open `8-Ball Tee — Black`.
5. Choose size `M`, quantity `2`, add to cart, and toggle wishlist.
6. Reload and confirm cart/wishlist persistence.
7. Change cart quantity to `3`.
8. Continue to checkout.
9. Confirm invalid card rejection.
10. Submit with `4242 4242 4242 4242`, future expiry, and three-digit CVC.
11. Confirm the order page, empty cart, non-personal stored order, and direct matching-route reload.

- [ ] **Step 5: Verify keyboard, reduced-motion, touch, and failure states**

Use keyboard-only navigation through the skip link, header, mobile menu, filters, product variants, dialogs, cart, and checkout. Emulate reduced motion and a coarse pointer. Trigger a missing image, corrupt storage payload, unknown product slug, unknown order ID, and unknown route. Confirm each recovery state matches the spec.

- [ ] **Step 6: Write the verification report**

Record command results, browser sizes, route coverage, issues found and fixed, and remaining verification limits. Do not claim real payments, backend delivery, live inventory, or production deployment.

- [ ] **Step 7: Stop the preview and commit verified fixes/report**

```powershell
git add .
git commit -m "test: verify complete showcase store"
git status --short
```

Expected: final status is clean.

---

## Final acceptance checklist

- [ ] Thirteen source-observed products use local assets and retain original names and descriptions.
- [ ] Home page reproduces every observed section and motion family.
- [ ] Mobile navigation does not overflow.
- [ ] Shop URL state, filters, sorting, product pages, wishlist, and cart work.
- [ ] Cart and wishlist survive reload with corrupt-data recovery.
- [ ] Demo checkout accepts only the documented test card.
- [ ] Contact, address, and payment fields are never transmitted or persisted.
- [ ] Newsletter remains local-only and says no email was sent.
- [ ] Reduced-motion, coarse-pointer, keyboard, empty, missing-image, and not-found states work.
- [ ] `npm.cmd run assets:verify`, `npm.cmd test`, and `npm.cmd run build` pass.
- [ ] Desktop and mobile browser verification is recorded without overstating deployment status.
