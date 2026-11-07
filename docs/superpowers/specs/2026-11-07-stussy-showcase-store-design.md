# Stussy Collection Showcase and Demo Store Design

Date: 2026-11-07

## Purpose

Build a local, self-contained recreation of the public Stussy Collection Base44 website and extend it into a polished demonstration storefront. The original single-page showcase remains the visual and narrative foundation. Commerce features are added as a clearly simulated experience with no real payments, accounts, inventory, or order fulfillment.

## Evidence and reconstruction boundary

The source application was inspected from its public HTML, CSS, manifest, JavaScript bundle, media references, and rendered desktop/mobile output.

Observed source behavior includes:

- a fixed black navigation bar with Home, Collection, About Us, and Contact anchors;
- a split-model, full-viewport hero with pointer parallax;
- animated Stussy logo and letter-reveal title;
- a continuously scrolling collection marquee;
- a responsive thirteen-card lookbook;
- scroll-triggered entrance animations and image hover zoom;
- a parallax brand-manifesto section;
- animated Lucky Dice and 8-Ball Flame motif panels;
- a brand-history timeline;
- a contact, social-link, newsletter, and copyright footer;
- a desktop custom cursor, cursor ring, and fading logo trail;
- a fixed grain overlay and black, white, concrete, coral, and orange visual system.

The shipped application exposes no product prices, purchasable variants, stock levels, cart, checkout, working newsletter submission, or working social destinations. Any such data in the reconstruction is therefore demo content rather than a claim about Stussy's actual catalog or operations.

REA Evidence `ev_90541c5c91a48163f839fec28c67f400c16539fb3639fa0597bc37b0e6d03426` confirms the delivered JavaScript artifact identity and incomplete static-analysis boundary. Deep semantic analysis was partial because the minified bundle exhausted the default one-gigabyte worker heap; a changed two-gigabyte retry reached its five-minute provider deadline. Page structure and content were recovered from the delivered bundle without executing its JavaScript during static inspection.

## Product direction

The application combines two experiences:

1. **Faithful showcase:** The home page recreates the source composition, copy, imagery, responsive grid, motion language, and interactions.
2. **Demo store:** Visitors can browse products, inspect variants, save favorites, manage a cart, and complete a simulated checkout.

Commerce features must feel like extensions of the source design rather than a separate template. The home page remains presentation-led and does not become a dense product catalog.

## Technology

- Vite
- React
- TypeScript
- React Router
- Framer Motion
- CSS variables and authored responsive CSS
- Lucide icons where icons are required
- Browser `localStorage` for cart, wishlist, and the latest simulated order
- Vitest and React Testing Library for behavior tests

No server, database, authentication system, analytics service, payment provider, or third-party commerce API is required.

## Project structure

The implementation will use focused modules:

- `src/app`: router, application shell, error boundary, and global providers.
- `src/components/showcase`: source-faithful home-page sections.
- `src/components/commerce`: product cards, filters, variant controls, cart controls, and checkout UI.
- `src/components/shared`: navigation, footer, motion helpers, feedback states, and accessible primitives.
- `src/pages`: Home, Shop, Product, Wishlist, Cart, Checkout, Order Confirmation, and Not Found pages.
- `src/data`: product records and navigation content.
- `src/state`: cart and wishlist state with persistence adapters.
- `src/lib`: formatting, validation, identifiers, and storage utilities.
- `src/styles`: design tokens, typography, layout, animation, and accessibility rules.
- `public/assets`: locally stored source images and branding assets.

Each state module exposes a typed public interface so UI components do not manipulate storage directly.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Faithful showcase home page |
| `/shop` | Searchable and filterable catalog |
| `/product/:slug` | Product details and variant selection |
| `/wishlist` | Saved demo products |
| `/cart` | Cart lines, quantities, and order summary |
| `/checkout` | Simulated customer, delivery, and payment form |
| `/order/:orderId` | Simulated order confirmation |
| `*` | Branded not-found page |

Home-page anchor links remain available through `/#hero`, `/#collection`, `/#about`, and `/#contact`. Router navigation must restore scroll position and correctly scroll to a supplied anchor.

## Home page

The home page preserves the source order:

1. Fixed navigation
2. Split-image hero
3. Collection marquee
4. Thirteen-item lookbook
5. Escape brand manifesto
6. Graphic heritage motif panels
7. About and timeline section
8. Contact and newsletter footer

The lookbook cards retain their original asymmetric desktop spans and two-column mobile grid. Each card gains a visible, accessible product action without replacing the source title and description overlay. Selecting a card navigates to its product page. A compact quick-add control is shown only when a default size can be selected safely; otherwise it opens the product page.

The main navigation adds Shop, Wishlist, and Cart without overcrowding the source anchors. On mobile, the links move into an accessible menu rather than overflowing the viewport.

## Catalog and product data

The thirteen observed lookbook items form the demo catalog. Their original names, labels, descriptions, and images are preserved. Constructed fields include:

- slug;
- demo price;
- category;
- color name;
- available sizes;
- demo stock state;
- feature bullets;
- related-product identifiers.

The UI labels prices, availability, and checkout as demonstration data where users could otherwise mistake them for a live Stussy offer. Product records live in one typed data module and are reused by every route.

## Shop experience

The shop supports:

- case-insensitive search across names, labels, descriptions, and categories;
- category, color, size, and availability filters;
- featured, name, and demo-price sorting;
- a clear-all action;
- visible result counts;
- meaningful empty results;
- shareable query-string state for search, filters, and sort order.

Filters update without a full page reload. Desktop uses an inline filter rail; mobile uses a focus-managed filter drawer.

## Product details

Product pages contain:

- local product imagery;
- observed title, label, and description;
- demo price and stock language;
- color and size selection;
- quantity control;
- add-to-cart and wishlist controls;
- shipping and returns demonstration copy;
- related products;
- breadcrumb navigation.

Adding to the cart requires a size when the product has size variants. Invalid attempts move focus to the size group and display an inline message. Successful actions provide both visual and screen-reader feedback.

## Cart and wishlist

The wishlist stores product identifiers. The cart stores product identifier, selected size, selected color, quantity, and the demo unit price captured when the line is created.

Cart behavior includes:

- merging identical product and variant combinations;
- incrementing, decrementing, and directly changing quantity;
- removing individual lines;
- clearing the cart through an explicit confirmation inside the application;
- subtotal and demo shipping calculations;
- a free-shipping threshold indicator;
- empty states with a route back to the shop.

Cart and wishlist data persist in `localStorage`. Invalid or outdated stored data is ignored safely and replaced with a valid empty state rather than breaking application startup.

## Checkout

Checkout is explicitly simulated. It collects:

- name;
- email;
- phone;
- street address;
- city;
- region;
- postal code;
- country;
- delivery option;
- a fake cardholder name, card number, expiry, and security code.

Payment fields are never transmitted or persisted. Validation runs locally. The checkout accepts only the documented demonstration card number `4242 4242 4242 4242`, a future `MM/YY` expiry, and any three-digit security code. Other card numbers produce an inline demonstration-mode error.

Submitting a valid order creates a local order identifier, stores only the order ID, timestamp, purchased lines, totals, and delivery-option label, clears the cart, and navigates to the confirmation route. Customer name, email, phone, street address, and all payment fields are discarded after submission and are never persisted. Refreshing the confirmation page can restore the latest matching simulated order summary from local storage.

## Newsletter and outbound links

The newsletter form validates the email locally and displays a success state. It does not transmit or persist the address. The copy states that this is a demonstration signup.

Source social links with unknown destinations remain visibly disabled or are omitted. The clone must not invent links that appear official.

## Motion and visual behavior

The implementation reproduces the observed motion language:

- navigation entrance;
- split-hero pointer parallax;
- letter reveal;
- scroll indicator loop;
- marquee movement;
- viewport-triggered section reveals;
- image hover zoom;
- manifesto background and heading parallax;
- pendulum and floating motif animations;
- desktop cursor dot, ring, and fading logo trail;
- grain overlay.

`prefers-reduced-motion: reduce` disables or simplifies nonessential movement. The custom cursor is enabled only for fine-pointer devices and never hides the native cursor on touch devices or when reduced motion is requested.

## Responsive behavior

Target widths include 360, 390, 768, 1024, and 1440 pixels.

- The hero keeps the split composition while protecting central text from clipping.
- Navigation becomes a keyboard-accessible mobile menu.
- The lookbook retains two columns on small screens and the observed twelve-column asymmetric grid on desktop.
- Motif panels stack vertically on smaller screens.
- Timeline and footer columns collapse without horizontal overflow.
- Cart tables become stacked line cards on narrow screens.
- Checkout becomes one column while preserving logical field order.

## Accessibility

- All navigation and controls are keyboard operable.
- Visible focus styles use the existing white/coral design language.
- Menu, drawer, dialog, and feedback patterns use appropriate labels and focus management.
- Product images have descriptive alternative text; decorative logos and grain are hidden from assistive technology.
- Form errors are associated with their fields and announced.
- Color is never the only indication of selection or error.
- Contrast remains readable over photography and translucent overlays.
- A skip link targets the main content.

## Failure and recovery behavior

- Unknown product slugs show a product-specific not-found state.
- Corrupt persistent state falls back to empty state.
- Missing local images show a branded neutral placeholder and retain text content.
- Checkout cannot begin with an empty cart.
- Direct visits to an unknown order ID show a recovery action to the shop.
- Rendering failures are contained by a branded application error boundary.

## Testing and verification

Automated tests cover:

- search, filters, sorting, and query-string synchronization;
- cart line merging and quantity limits;
- cart and wishlist persistence and corrupt-data recovery;
- required variant selection;
- checkout validation;
- simulated order creation and customer/payment-field non-persistence;
- route and not-found behavior;
- reduced-motion and touch-cursor conditions where practical.

Manual browser verification covers:

- faithful visual composition against the captured source at desktop and mobile widths;
- every navigation and anchor target;
- product, wishlist, cart, and checkout flows;
- keyboard-only navigation;
- absence of horizontal overflow;
- hover, touch, reduced-motion, loading, empty, and error states;
- production build output and direct-route reload behavior.

## Completion criteria

The project is complete when:

1. All observed source sections and supplied local assets render in the intended order.
2. The responsive home page preserves the source's visual language without the original mobile navigation overflow.
3. Every catalog product has a working detail route and demo variants.
4. Search, filters, wishlist, cart persistence, and simulated checkout work end to end.
5. No payment or personal checkout data is transmitted externally.
6. Constructed commerce information is clearly presented as demo content.
7. Automated tests and the production build pass.
8. Desktop and mobile browser verification covers the agreed routes and interactions.

## Exclusions

- Real Stussy pricing, inventory, promotions, or fulfillment claims
- Real payment processing
- User accounts or authentication
- A production database or backend
- Administrative inventory management
- Email delivery
- Analytics or visitor tracking
- Claims that the project is an official Stussy property
