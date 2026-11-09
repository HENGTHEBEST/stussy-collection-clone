# Bakong KHQR Mock and SIT-Ready Checkout Design

Date: 2026-11-09

## Purpose

Replace the browser-only demonstration card checkout with a server-backed order and payment flow shaped like a real Bakong KHQR integration. This phase must work without a merchant account or Bakong API token, remain visibly simulated, and create a clean boundary where official SIT credentials can be connected later without rewriting the storefront.

The existing editorial showcase, catalog, wishlist, cart, and neutral visual system remain intact. The checkout changes from fake card entry to a dynamic QR payment experience.

## Scope classification

This is an architectural change. The current application has no server, database, trusted price calculation, or payment-provider boundary. The work adds those subsystems and changes the checkout and order-confirmation contracts.

## Chosen approach

Use a small Node.js API alongside the existing Vite application, Node's built-in SQLite support for local persistent orders, and an adapter interface for payment providers.

The initial adapter is `MockBakongGateway`. It creates a QR-shaped payment attempt, exposes pending/success/failed/expired states, and never contacts Bakong or moves money. A later `BakongGateway` can use the same interface with SIT or production credentials.

This approach is preferred over:

- a client-only QR, because the browser cannot protect tokens or authoritatively confirm payment;
- a third-party payment relay, because it introduces an unapproved intermediary and additional trust boundary;
- a hosted commerce-platform checkout, because the requested primary method is direct Cambodian KHQR rather than card checkout.

## Runtime and development model

- The existing React/Vite frontend remains the storefront.
- A Node.js server owns `/api/*` routes.
- Vite proxies `/api` to the Node server during local development.
- The Node server uses the built-in `node:sqlite` module available in the installed Node 24 runtime.
- The server database is stored under a gitignored local data directory.
- Frontend and backend run together through one development command.
- Production build continues to emit the Vite frontend and separately type-checks the server.

The local SQLite repository is appropriate for this credential-free development phase. Before multi-instance production deployment, the repository interface must receive a PostgreSQL implementation or the application must run on a single Node host with durable storage and backups.

## Configuration

An `.env.example` documents non-secret settings:

- `PAYMENT_MODE=mock`
- `API_PORT=8787`
- `APP_ORIGIN=http://localhost:5173`
- `MERCHANT_NAME=Stussy Collection Showcase`
- `MERCHANT_CITY=Phnom Penh`
- `BAKONG_ACCOUNT_ID=demo@mock`
- `ORDER_CURRENCY=USD`
- `SQLITE_PATH=./data/store.sqlite`

Real credentials are never committed. A later SIT configuration will add `BAKONG_API_BASE_URL` and `BAKONG_API_TOKEN` only to the server environment. The token must never use a `VITE_` prefix and must never be returned to the browser.

## Trusted catalog and totals

The server imports a server-safe product catalog containing the same IDs, variants, availability, and prices as the frontend catalog. The browser submits only product ID, selected size, selected color, and quantity.

The server:

1. rejects unknown or unavailable products and variants;
2. enforces quantity bounds;
3. recalculates unit prices, subtotal, shipping, and total;
4. stores immutable order-line snapshots;
5. ignores any price or total supplied by the browser.

The existing demo catalog uses USD values, so this phase keeps `USD` as the configured order currency. KHR or dual-currency support requires an explicit merchant price list or conversion policy and is outside this phase.

## Data model

### Orders

- `id`: public random order identifier
- `status`: `awaiting_payment`, `paid`, `failed`, `expired`, or `cancelled`
- customer name, email, and phone
- delivery address fields
- delivery method
- currency
- subtotal, shipping, and total stored in integer minor units
- created, updated, and payment-expiration timestamps

### Order lines

- order ID
- product ID and slug
- product-name snapshot
- size and color
- quantity
- unit-price snapshot in integer minor units

### Payment attempts

- order ID
- provider name and provider-reference value
- QR payload and its MD5 reference
- amount and currency
- status
- expiration timestamp
- provider transaction hash when available
- created and updated timestamps

The schema enforces one current payment attempt per order in this phase and unique provider transaction hashes to prevent reuse.

## Backend boundaries

### `OrderRepository`

Creates orders, retrieves an order by ID, stores payment attempts, and performs guarded status transitions. UI and provider code do not issue SQL directly.

### `PaymentGateway`

Exposes:

- `createPayment(order)`
- `checkPayment(paymentAttempt)`

The result uses normalized statuses so the rest of the application is independent of Bakong response shapes.

### `MockBakongGateway`

Creates a non-production QR payload containing a mock provider reference, exact amount, currency, and expiration. The checkout visibly labels it as simulated. In mock mode only, a development control can mark the payment successful through a server endpoint so the complete order flow is testable.

### Future `BakongGateway`

The official adapter will generate a standards-compliant dynamic KHQR, compute and persist its MD5 reference, and check transaction status from the server with `Authorization: Bearer <token>`. A successful provider response will be accepted only when destination account, amount, and currency match the stored order and the transaction hash has not been used.

No official Bakong network call is made in this phase.

## HTTP API

### `POST /api/orders`

Accepts checkout contact, address, delivery option, and cart variants. Returns the trusted order summary plus its pending mock KHQR payment.

Expected failures include invalid customer fields, empty cart, invalid variants, and unavailable items.

### `GET /api/orders/:orderId`

Returns a public-safe order summary and current payment state. It never returns provider tokens, database internals, or unnecessary customer details.

### `POST /api/orders/:orderId/mock-payment`

Available only when `PAYMENT_MODE=mock`. It simulates a successful provider confirmation for development and automated tests. The route does not exist in SIT or production modes.

### `GET /api/health`

Reports server readiness without revealing configuration values.

## Checkout experience

The checkout retains contact, delivery-address, and delivery-option fields. Cardholder, card number, expiry, and CVC fields are removed.

Submitting a valid checkout:

1. sends cart and delivery data to the server;
2. receives a server-created order and mock payment attempt;
3. clears the cart only after order creation succeeds;
4. navigates to `/order/:orderId`;
5. displays the QR, exact amount, currency, and countdown;
6. polls the application's own order-status endpoint at a conservative interval;
7. displays paid, failed, or expired outcomes.

The QR section includes a prominent `Simulation only - no money will move` notice. Mock mode provides a clearly labeled `Simulate successful payment` control. No UI suggests that the QR is a genuine Bakong payment.

Order confirmation no longer depends on browser local storage. Refreshing or directly revisiting the order URL loads the order from the server database.

## State transitions and idempotency

- New orders start as `awaiting_payment`.
- Repeated order-status reads are side-effect free.
- A mock success transition is idempotent.
- Paid orders cannot transition back to pending, failed, or expired.
- Pending orders become expired after the payment expiration time.
- Duplicate form submissions are blocked in the client and guarded on the server by a request identifier.
- The cart clears only once the server confirms that it created an order.

## Validation and security

- All inputs are validated again on the server.
- Totals use integer minor units rather than floating-point comparison.
- Request bodies have a small size limit.
- API responses use generic error messages while server logs retain safe diagnostics.
- CORS accepts only the configured application origin.
- Provider and database errors never expose stack traces to the browser.
- Secrets remain server-only and gitignored.
- Payment confirmation comes only from the provider adapter, never from a client claim or receipt screenshot.
- Logs exclude tokens and full customer addresses.

## Failure and recovery behavior

- If order creation fails, the cart remains intact and checkout shows a retryable error.
- If QR creation fails, the order remains unpaid and the user receives a retry action.
- If the API is unavailable, the order page shows a recoverable connection state without claiming payment failure.
- If the QR expires, the order is marked expired and cannot be fulfilled.
- Unknown order IDs show an order-specific not-found state.
- Database startup failures make the health endpoint unavailable and prevent orders rather than falling back to browser-only checkout.

## Testing

Server tests cover:

- catalog and variant validation;
- trusted total calculation and integer money handling;
- SQLite order persistence and retrieval;
- status-transition guards and idempotency;
- mock payment creation, success, failure, and expiration;
- API validation, sanitized responses, and disabled mock routes outside mock mode.

Frontend tests cover:

- removal of all card fields;
- checkout order creation and server-error recovery;
- cart retention on failure and clearing on success;
- QR/payment-state rendering;
- countdown expiration;
- refreshed order retrieval;
- mock success flow and accessible status announcements.

Full verification includes existing tests, new server and frontend tests, TypeScript checks, production builds, and a browser pass through cart, checkout, pending payment, simulated success, refresh, and unknown-order behavior.

## Migration boundary

This phase prepares but does not activate real payments. Moving to SIT requires:

1. a Bakong SIT token stored only in server configuration;
2. a confirmed merchant/Bakong account ID;
3. approved merchant name, city, and currency;
4. implementation and contract testing of the official adapter;
5. SIT tests for success, not-found, failed, expired, wrong amount, wrong currency, and duplicate transaction responses.

Production activation additionally requires bank approval for commercial use, production credentials, confirmed API limits, durable production storage, HTTPS, monitoring, reconciliation procedures, and a small live-payment acceptance test.

## Completion criteria

This phase is complete when:

1. the application runs with a local Node API and persistent SQLite database;
2. checkout creates trusted server-side orders without accepting card data;
3. a simulated dynamic QR and countdown appear on the order route;
4. mock payment success is confirmed through the server and survives refresh;
5. prices and totals cannot be controlled by browser input;
6. tokens and real account details are absent from source and Git history;
7. all existing and new automated tests pass;
8. production frontend and server builds succeed;
9. the real Bakong integration remains disabled until credentials and merchant approval exist.

## Exclusions

- Real Bakong SIT or production network calls
- Real merchant onboarding or bank approval
- KHR conversion or dual-currency pricing
- Inventory administration
- Customer accounts and authentication
- Shipping-carrier integration
- Refund automation
- Email or SMS delivery
- Multi-instance production database deployment
