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
- a centered KHQR payment panel inside the checkout Payment step;
- a shared contact and delivery form for KHQR and card payments;
- a server-only Supabase order repository and versioned SQL migrations;
- Vercel-compatible API routes and deployment configuration;
- a PayWay card redirect and callback that triggers signed server-to-server status reconciliation;
- automated coverage for the changed user and provider boundaries.

### Excluded

- Stripe integration or unsupported-country account workarounds;
- migration of local SQLite data;
- locally rendered card-number inputs;
- refunds, subscriptions, customer accounts, inventory management, or email notifications;
- a live financial transaction performed by automation.

## Architecture

The React/Vite storefront remains the client. Vercel serves the built static site and invokes a Node serverless API for `/api/*`. API initialization is separated from local `listen()` startup so the same trusted order service works in local development and on Vercel.

The API is the only Supabase client allowed to read or write operational order tables. Every running API uses Supabase, including local mock mode; SQLite is an isolated test adapter. It uses the Supabase service-role key held in server environment variables. Database mutations that must be atomic, especially idempotent order creation and guarded payment transitions, run through PostgreSQL functions invoked by the repository. The browser retains the existing same-origin `/api/*` client contract.

Bakong creates and checks KHQR payments server-side. PayWay creates a signed hosted checkout form server-side and sends its callback to a public Vercel API route. A redirect, browser message, or QR rendering never marks an order paid; each provider must be verified by the server.

## Hero layout

`HeroSection` keeps the logo, establishment line, side labels, and scroll link. The title receives its own responsive vertical anchor between the establishment line and scroll cue, rather than sharing the scroll cue's lower position. It must not overlap the establishment text or `SCROLL` at desktop or mobile breakpoints. The existing logo-only scale and its layout size stay unchanged.

## Checkout and payment flow

All customers fill in the same contact, shipping address, and delivery fields before selecting a payment method.

### KHQR

1. The customer submits valid contact and delivery information and advances to Payment with KHQR selected by default.
2. The API prices the cart, creates the order and dynamic KHQR attempt, and returns the public order.
3. The client clears the cart only after that success and remains at `/checkout`, showing the Payment step with KHQR selected by default.
4. The panel centers a high-contrast QR image inside a bounded payment section. The image uses responsive sizing with a safe maximum; it never fills the full viewport or crops. Tab session storage remembers only pending order IDs, so a same-tab reload retrieves trusted state from the API. `/order/:orderId` supports a direct status/QR visit; there is no separate `/payment/khqr/:orderId` route.
5. The panel polls only the shop API for status, and `I've Paid` requests the same status check. It transitions to the order confirmation once the server verifies payment, and shows pending, expired, failed, missing, and connection states without falsely claiming success.

The visual focus is the QR. Supporting amount, expiry, and accessible live status may remain near it because a QR alone does not tell the buyer what they are approving.

### Credit or debit card

1. After submitting the shared contact and delivery form, the customer selects Credit / debit card in the Payment step.
2. The API creates a trusted order and signed PayWay checkout payload.
3. The checkout Payment panel (or direct order page) posts the signed fields to PayWay's hosted payment page, where the buyer enters card details.
4. PayWay returns the buyer to `/order/:orderId` and calls `POST /api/payway/callback`. Callback fields are not trusted as payment evidence: the transaction reference triggers a signed server-to-server PayWay status query. Its reference, amount, currency and approved status must match before a guarded paid transition. Returning to the shop alone cannot confirm payment.

The storefront labels the choice clearly as a secure card checkout. It may name ABA PayWay where needed for processor transparency, but it never presents it as Stripe or requests card data itself.

## Supabase data model

The database begins empty and replaces the SQLite implementation behind the existing `OrderRepository` boundary.

- `orders`: immutable customer, address, delivery, money, public ID, request ID, current status, payment expiry, and timestamps. `request_id` is unique.
- `order_lines`: immutable product, slug, name, colour, size, quantity, and integer minor-unit price snapshots linked to an order.
- `payment_attempts`: one active attempt per order, provider name/reference, QR metadata or PayWay reference, trusted amount/currency, status, expiry, and verified provider transaction ID. Provider transaction IDs are unique when present.

SQL constraints restrict order and payment statuses to the application state machine. A migration creates tables, indexes, constraints, and server-only RPC functions for create/read/update operations. Row-level security denies anonymous access; only the server's service-role client performs operational mutations.

## Configuration

`.env.example` documents names, non-secret defaults and empty credential placeholders. `.env.local` and Vercel environment variables hold the actual credentials.

```env
STORAGE_MODE=supabase
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

Before production activation, configure the public PayWay callback/return URLs to the deployed HTTPS domain. Vercel environment variables must be added for Preview and Production separately, with production provider credentials restricted to Production. Use a development Supabase database, `PAYMENT_MODE=mock` and `PAYWAY_ENVIRONMENT=sandbox` for Preview. These settings are independent: mock mode applies to Bakong, while PayWay follows its own environment setting. Omit both PayWay credentials to disable card payments. `APP_ORIGIN` must match the exact browser origin; use a stable Preview domain and redeploy after environment changes.

### Repeatable rollout and evidence

The full executable PowerShell checklist is maintained in [README: Staging-to-production checklist](../../../README.md#staging-to-production-checklist). For each target, record the deployment URL/ID, environment scope, check date, results and remaining checks without secrets or customer details.

1. The migration `supabase/migrations/202611110001_orders.sql` was reported manually applied for this rollout; local checks do not verify remote schema. Do not reapply it to that project. For a new empty project, apply it once in the Supabase SQL editor and confirm the three tables, RLS and service-only RPC functions. No SQLite data is migrated.
2. Run `npm test`, `npm run typecheck`, `npm run build` and the per-command `safe.directory` diff check shown in the README, stopping on failure. These checks use test doubles/synthetic credentials, not a live checkout. Do not run the visual checkout script against production: it writes orders and simulates paid state.
3. The account owner sets Vercel Preview variables, authenticates/links the intended project with `npx vercel link`, then runs `npx vercel --yes`. Check `/api/health` returns ready/mock and `/api/checkout-pricing` accepts the configured browser origin. Health proves initialization only, not database connectivity or provider readiness. Deployment protection may require an authenticated browser for probes and a separate approved arrangement for PayWay callback access.
4. On Preview, a user creates a mock KHQR checkout using fictional details in the development database, verifies pending order/line/attempt persistence in Supabase, reloads `/checkout` in the same tab to restore the same pending QR, and directly refreshes `/order/<orderId>`. There is no dedicated QR route. Check mobile/desktop QR framing and that `I've Paid` cannot claim payment. Serverless mock provider memory is not shared; use the local API for repeatable success simulation.
5. With approved sandbox credentials, configure PayWay's callback to `<preview-origin>/api/payway/callback` and allow success/cancel returns under `<preview-origin>/order/<orderId>`. A user launches the hosted page, verifies `checkout-sandbox.payway.com.kh`, and stops before payment authorization for a non-financial handoff check. Sandbox callback/transaction acceptance requires a separate test with provider-issued data; a hosted redirect alone does not prove it.
6. Only after merchant approval, set Production-only Supabase and provider credentials, `PAYMENT_MODE=production`, `PAYWAY_ENVIRONMENT=production` if cards are enabled, and exact production `APP_ORIGIN`. Remove `TEST_UNIT_PRICE_MINOR` rather than leaving it empty and set `TEST_FREE_SHIPPING=false` for normal pricing. Configure the public production callback/return domain with PayWay, then the account owner runs `npx vercel --prod` and rechecks health, pricing, assets and direct routes.
7. The user manually authorizes any live bank/card payment and checks provider dashboard/delivery records against server-persisted results. Keep actual callback delivery and live acceptance incomplete until observed. If acceptance fails, stop new payment intake using deployment controls and reconcile existing orders before resuming; preserve order records.

Documentation and local checks do not establish a hosted deployment, remote schema inspection, merchant approval, sandbox callback delivery or live payment acceptance. No deployment, live Supabase/PayWay request, order creation or financial action is performed as part of the local documentation task.

## Security and failure behavior

- The server recalculates catalog prices and accepts only valid variants and quantities.
- Money remains integer minor units.
- Duplicate browser submissions return the original request-ID order without replacing it.
- Provider callbacks trigger signed server-side reconciliation; callback-supplied status is never accepted. The verified provider reference, amount, currency, and final status must match before a guarded transition to `paid`.
- A paid order cannot return to pending, failed, or expired.
- Provider transport errors retain a pending order and surface a safe retryable state.
- Supabase failure prevents order creation; the cart remains in the browser.
- CORS continues to allow only the configured storefront origin.

## Testing and verification

Tests cover the Supabase repository's idempotency, ordering, state transitions, and rejection of duplicate provider references; API startup with required production configuration; PayWay request signing and callbacks as untrusted reconciliation triggers; KHQR routing and bounded QR markup; shared checkout validation; and the hero's semantic layout contract. Only a signed server-to-server PayWay status query with matching transaction data can transition a card order to paid. Actual desktop/mobile hero positioning and QR rendering remain manual visual QA.

Local verification includes the complete test suite, typecheck, production Vite build and diff whitespace check. Remote schema inspection, sandbox callback delivery, Vercel Preview validation and manual production payment acceptance remain separate account-owner checks in the rollout checklist. The migration was reported manually applied; it is not re-run by local verification. A human performs any actual payment confirmation.

## Completion criteria

1. The hero title remains visually centered between the establishment line and scroll cue on desktop and mobile.
2. KHQR checkout renders a centered, scan-safe QR in the in-place Payment step and restores the pending order after a same-tab refresh.
3. Card checkout collects shop details here and card details only on the PayWay hosted page.
4. An empty Supabase database persists orders and payment attempts through server-only code.
5. Vercel hosts the SPA and API routes, including the untrusted PayWay callback trigger; only signed server-to-server status reconciliation with matching transaction data can transition a card order to paid.
6. Provider redirects and browser claims cannot mark an order paid.
7. Automated checks and the stated preview/production verification complete without exposing secrets.

## Approved checkout-flow amendment

The checkout is a single routed experience with three visual steps: Contact & Delivery, Payment, and Confirmation. The previous dedicated `/payment/khqr/:orderId` route is not used.

After valid delivery details, the UI advances to Payment with KHQR selected by default. That selection creates the pending order and dynamic QR through the server, then renders the QR in the Payment panel beside the order summary. Choosing Credit / debit card replaces the QR panel with a secure ABA PayWay hosted-checkout launch; this application never collects raw card number, expiry, or CVC fields.

The Payment panel follows the supplied reference: a white editorial layout, centered three-step progress indicator, subtle Stussy-logo watermarks, rounded light-border cards, QR instructions, scan-safe QR frame, actual expiration countdown, amount, order identifier, and an `I've Paid` status-refresh action. Confirmation remains a server-verified third state and is not shown from a redirect or client claim.
