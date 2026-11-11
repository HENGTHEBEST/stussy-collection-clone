# Vercel, Supabase, KHQR, and PayWay Checkout Design

Date: 2026-11-11

## Purpose

Move the shop from local SQLite storage to an empty production Supabase database, deploy the storefront and API on Vercel, retain Bakong KHQR and ABA PayWay as the payment processors, and improve the hero and checkout flows. This design intentionally does not use Stripe because the merchant operates in Cambodia and cannot open a direct Cambodian Stripe account.

## Confirmed decisions

- Vercel is the production deployment target.
- Supabase starts empty; no local SQLite orders are migrated.
- KHQR remains the QR payment option.
- ABA PayWay remains the card processor and hosts the card-entry page.
- Card numbers, expiration dates, and CVC values never enter this application.
- The browser never accesses the Supabase service-role key or order tables directly.

## Scope

### Included

- position `SUMMER CLASSICS` between the hero establishment line and scroll cue;
- a dedicated, centered KHQR payment screen after checkout;
- a shared contact and delivery form for KHQR and card payments;
- a server-only Supabase order repository and versioned SQL migrations;
- Vercel-compatible API routes and deployment configuration;
- a PayWay card redirect and verified server callback;
- automated coverage for the changed user and provider boundaries.

### Excluded

- Stripe integration or unsupported-country account workarounds;
- migration of local SQLite data;
- locally rendered card-number inputs;
- refunds, subscriptions, customer accounts, inventory management, or email notifications;
- a live financial transaction performed by automation.

## Architecture

The React/Vite storefront remains the client. Vercel serves the built static site and invokes a Node serverless API for `/api/*`. API initialization is separated from local `listen()` startup so the same trusted order service works in local development and on Vercel.

The API is the only Supabase client allowed to read or write operational order tables. It uses the Supabase service-role key held in server environment variables. Database mutations that must be atomic, especially idempotent order creation and guarded payment transitions, run through PostgreSQL functions invoked by the repository. The browser retains the existing same-origin `/api/*` client contract.

Bakong creates and checks KHQR payments server-side. PayWay creates a signed hosted checkout form server-side and sends its callback to a public Vercel API route. A redirect, browser message, or QR rendering never marks an order paid; each provider must be verified by the server.

## Hero layout

`HeroSection` keeps the logo, establishment line, side labels, and scroll link. The title receives its own responsive vertical anchor between the establishment line and scroll cue, rather than sharing the scroll cue's lower position. It must not overlap the establishment text or `SCROLL` at desktop or mobile breakpoints. The existing logo-only scale and its layout size stay unchanged.

## Checkout and payment flow

All customers fill in the same contact, shipping address, and delivery fields before selecting a payment method.

### KHQR

1. The customer selects KHQR and submits valid contact and delivery information.
2. The API prices the cart, creates the order and dynamic KHQR attempt, and returns the public order.
3. The client clears the cart only after that success and routes to `/payment/khqr/:orderId`.
4. The new page centers a high-contrast QR image inside a bounded payment section. The image uses responsive sizing with a safe maximum; it never fills the full viewport or crops.
5. The page polls only the shop API for status. It transitions to the order confirmation once the server verifies payment, and shows pending, expired, failed, missing, and connection states without falsely claiming success.

The visual focus is the QR. Supporting amount, expiry, and accessible live status may remain near it because a QR alone does not tell the buyer what they are approving.

### Credit or debit card

1. The customer selects Credit / debit card and submits the same validated shop information.
2. The API creates a trusted order and signed PayWay checkout payload.
3. The order page posts the signed fields to PayWay's hosted payment page, where the buyer enters card details.
4. PayWay returns the buyer to the shop and calls the server callback. The callback signature and transaction data are verified before the order status changes.

The storefront labels the choice clearly as a secure card checkout. It may name ABA PayWay where needed for processor transparency, but it never presents it as Stripe or requests card data itself.

## Supabase data model

The database begins empty and replaces the SQLite implementation behind the existing `OrderRepository` boundary.

- `orders`: immutable customer, address, delivery, money, public ID, request ID, current status, payment expiry, and timestamps. `request_id` is unique.
- `order_lines`: immutable product, slug, name, colour, size, quantity, and integer minor-unit price snapshots linked to an order.
- `payment_attempts`: one active attempt per order, provider name/reference, QR metadata or PayWay reference, trusted amount/currency, status, expiry, and verified provider transaction ID. Provider transaction IDs are unique when present.

SQL constraints restrict order and payment statuses to the application state machine. A migration creates tables, indexes, constraints, and server-only RPC functions for create/read/update operations. Row-level security denies anonymous access; only the server's service-role client performs operational mutations.

## Configuration

`.env.example` documents names and empty values only. `.env.local` and Vercel environment variables hold the values.

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PAYMENT_MODE=mock
BAKONG_API_BASE_URL=
BAKONG_API_TOKEN=
BAKONG_ACCOUNT_ID=
BAKONG_MERCHANT_ID=
BAKONG_ACQUIRING_BANK=
PAYWAY_MERCHANT_ID=
PAYWAY_API_KEY=
PAYWAY_ENVIRONMENT=sandbox
APP_ORIGIN=
```

No value above receives a `VITE_` prefix. Secrets are absent from source control, browser bundles, API responses, logs, screenshots, and chat.

## Vercel deployment

Vercel serves the Vite `dist` output and routes `/api/*` to the Node API entry point. SPA fallback preserves direct visits to shop, order, and payment routes. The deployment uses the production site URL as `APP_ORIGIN`; local development continues to use the local Vite origin.

Before production activation, configure the public PayWay callback/return URLs to the deployed HTTPS domain. Vercel environment variables must be added for Preview and Production separately, with production provider credentials restricted to Production.

## Security and failure behavior

- The server recalculates catalog prices and accepts only valid variants and quantities.
- Money remains integer minor units.
- Duplicate browser submissions return the original request-ID order without replacing it.
- Provider callbacks authenticate and verify order reference, amount, currency, and final status before a guarded transition to `paid`.
- A paid order cannot return to pending, failed, or expired.
- Provider transport errors retain a pending order and surface a safe retryable state.
- Supabase failure prevents order creation; the cart remains in the browser.
- CORS continues to allow only the configured storefront origin.

## Testing and verification

Tests cover the Supabase repository's idempotency, ordering, state transitions, and rejection of duplicate provider references; API startup with required production configuration; PayWay signing/callback verification; KHQR routing and bounded QR rendering; shared checkout validation; and the hero layout at desktop and mobile sizes.

Verification includes the complete test suite, typecheck, production Vite build, SQL migration application to the empty Supabase project, local PayWay sandbox callback testing, Vercel Preview validation, and a manual production payment acceptance test. A human performs any actual payment confirmation.

## Completion criteria

1. The hero title remains visually centered between the establishment line and scroll cue on desktop and mobile.
2. KHQR checkout routes to its own centered, scan-safe QR page.
3. Card checkout collects shop details here and card details only on the PayWay hosted page.
4. An empty Supabase database persists orders and payment attempts through server-only code.
5. Vercel hosts the SPA and API routes, including the verified payment callback.
6. Provider redirects and browser claims cannot mark an order paid.
7. Automated checks and the stated preview/production verification complete without exposing secrets.
