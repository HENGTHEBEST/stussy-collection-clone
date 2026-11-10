# Real Bakong KHQR Payment Design

Date: 2026-11-10

## Purpose

Replace the mock-only payment adapter with an opt-in production Bakong KHQR adapter while preserving the existing server-owned order, trusted pricing, persistence, polling, and checkout flow. During the first live acceptance test, every product unit costs USD 0.01 and shipping is free, so the payable total is `quantity x USD 0.01` across all cart lines.

This phase prepares and validates the integration but does not activate production mode without user-supplied merchant credentials.

## Scope

Included:

- server-only Bakong production configuration;
- dynamic merchant KHQR generation with the official JavaScript SDK documented by NBC;
- transaction-status checks through the Bakong Open API;
- one-cent-per-unit acceptance pricing and free shipping;
- a KHQR payment card inspired by the supplied reference without ABA branding;
- validation, error handling, and automated tests for the real adapter boundary.

Excluded:

- merchant onboarding, token issuance, or bank approval;
- refunds, reconciliation dashboards, webhooks, and multi-currency checkout;
- copying ABA branding, private account numbers, or the surrounding ABA application UI;
- automatic activation before the credentials are complete and verified.

## Chosen approach

Use the NBC-documented `bakong-khqr` JavaScript package to generate and validate dynamic merchant KHQR payloads. The server calls the Bakong Open API directly to check transactions by the SDK-returned MD5 value. This fits the existing `PaymentGateway` boundary and avoids implementing the EMV/KHQR payload format by hand.

Alternatives rejected:

- Hand-building the KHQR payload has less dependency code but creates unnecessary payment-format and checksum risk.
- A static personal QR cannot reliably bind an exact order total to a unique, server-verified payment.
- A community relay adds an unapproved party to the payment and credential trust boundary.

Official references:

- KHQR SDK: https://bakong.nbc.gov.kh/download/KHQR/integration/KHQR%20SDK%20Document.pdf
- QR payment integration: https://bakong.nbc.gov.kh/download/KHQR/integration/QR%20Payment%20Integration.pdf
- Production Open API: https://api-bakong.nbc.gov.kh/

## Configuration

`.env.example` documents placeholders only:

```env
PAYMENT_MODE=mock
BAKONG_API_BASE_URL=https://api-bakong.nbc.gov.kh
BAKONG_API_TOKEN=
BAKONG_ACCOUNT_ID=
BAKONG_MERCHANT_ID=
BAKONG_ACQUIRING_BANK=
MERCHANT_NAME=
MERCHANT_CITY=Phnom Penh
ORDER_CURRENCY=USD
TEST_UNIT_PRICE_MINOR=1
TEST_FREE_SHIPPING=true
```

`.env.local` remains gitignored. The API token is required only when `PAYMENT_MODE=production`, must never have a `VITE_` prefix, and must never appear in API responses, browser bundles, logs, tests, screenshots, or committed files.

Production mode fails closed during startup unless the token, Bakong account ID, merchant ID, acquiring bank, merchant name, supported currency, and valid API URL are present. `PAYMENT_MODE=mock` remains the default until the user fills the credentials and deliberately changes the mode.

## Test pricing

The server remains the authority for all totals. When the explicit test-pricing settings are enabled:

- each product unit is priced at one minor USD unit, or USD 0.01;
- quantity multiplies the unit price normally;
- cart lines are summed normally;
- standard and express shipping both cost USD 0.00;
- the QR amount exactly equals the stored server order total.

The browser may display the test estimate but cannot submit or override a price. Test pricing is explicit configuration rather than a permanent rewrite of the catalog, making the temporary live-acceptance rule visible and reversible.

## Payment adapter

Add `BakongGateway` beside `MockBakongGateway` and select the adapter at startup from `PAYMENT_MODE`.

### Create payment

For a trusted stored order, the adapter builds the SDK merchant input with:

- Bakong account ID;
- merchant ID;
- acquiring bank;
- merchant name and city;
- USD currency;
- the exact stored total converted from integer minor units;
- the public order ID as a bill number or purpose reference;
- a dynamic expiration no longer than ten minutes.

The SDK response must contain a valid QR payload and a 32-character MD5 value. The server renders the payload to the existing QR image format and stores the payload, MD5, provider reference, amount, currency, and expiration. SDK validation failures leave the cart intact and return a sanitized retryable error.

### Check payment

The adapter posts the stored MD5 to the configured Bakong `/v1/check_transaction_by_md5` endpoint with the token in the server-side authorization header.

The adapter normalizes responses to the existing payment states:

- a matching successful transaction becomes `paid`;
- not found before expiration remains `pending`;
- an elapsed expiration becomes `expired`;
- provider rejection becomes `failed` only when the provider explicitly reports failure;
- network errors remain retryable and do not claim success or failure.

Before marking an order paid, the server validates the destination merchant identity, USD currency, exact amount, and unique transaction hash whenever those fields are present in the provider response. A transaction hash already attached to another order is rejected. The browser can never report or force a successful payment.

## HTTP and order flow

The public HTTP routes stay unchanged:

1. `POST /api/orders` validates checkout data, applies server pricing, stores the order, and creates a dynamic payment.
2. The browser clears the cart only after order creation succeeds and navigates to `/order/:orderId`.
3. `GET /api/orders/:orderId` invokes the selected gateway status check for pending orders and returns a public-safe normalized order.
4. The order page polls the application server, never Bakong directly.

The mock-success route remains available only in mock mode and is absent in production mode.

## KHQR interface

The order page keeps its existing state handling and receives a focused visual update:

- dark payment card;
- red `KHQR` header band;
- merchant name from server-safe public order data;
- exact USD amount;
- large white QR frame with high contrast and adequate quiet space;
- expiration countdown and payment status;
- no ABA logo, ABA name, account numbers, download/share controls, or copied banking-app background.

The generated QR stays plain without a center logo overlay for maximum scan reliability. The payment card clearly distinguishes mock mode from production mode. Production mode removes all simulation text and controls.

## Validation and security

- Validate configuration lengths and required fields against the SDK contract before server startup.
- Restrict the API base URL to HTTPS in production mode.
- Apply request timeouts and abort stalled provider requests.
- Never log authorization headers, tokens, full QR payloads, or complete provider responses.
- Return generic transport and provider errors to the browser.
- Continue storing and comparing money as integer minor units.
- Generate QR and check payment only on the server.
- Preserve idempotent order creation and guarded payment-state transitions.
- Do not mark an order paid from screenshots, client claims, or an unverified redirect.

## Failure behavior

- Missing or invalid credentials prevent production startup.
- KHQR generation failure leaves the cart unchanged and exposes a retryable checkout error.
- Bakong timeouts keep a pending order visible with a retry option.
- Unauthorized provider responses are logged without secrets and surfaced as service unavailable.
- Expired QR codes cannot be fulfilled or reused.
- Wrong amount, currency, merchant, or duplicate transaction data never confirms an order.

## Testing

Unit and integration tests cover:

- production configuration requirements and secret redaction;
- USD 0.01 unit pricing, quantity multiplication, multiple lines, and zero shipping;
- SDK input mapping and QR/MD5 validation;
- pending, paid, failed, expired, unauthorized, malformed, and timeout provider responses;
- exact amount, currency, merchant, and duplicate transaction guards;
- production startup selecting `BakongGateway` and mock startup retaining `MockBakongGateway`;
- mock-success route absence in production mode;
- KHQR card content and removal of simulation controls in production;
- cart retention on QR creation failure and clearing after successful order creation.

Full verification includes all automated tests, TypeScript checks, the production build, a QR scan using a real banking app, and one controlled USD 0.01 live payment. The human user performs the final scan and payment confirmation; automated tools do not transfer money.

## Activation procedure

1. User fills the gitignored `.env.local` values without sharing the token in chat.
2. Keep `PAYMENT_MODE=mock` while automated and local UI checks run.
3. Verify the merchant account and token against the production API without exposing secrets.
4. Change `PAYMENT_MODE=production` and restart the server.
5. Create one single-quantity order with a USD 0.01 total.
6. User scans the QR, verifies the recipient and USD 0.01 amount in their banking app, and manually confirms payment.
7. Confirm that the server changes the order to paid exactly once and retains the provider transaction hash.
8. Return to mock mode immediately if any recipient, amount, currency, or status result is wrong.

## Completion criteria

The work is complete when:

1. mock mode continues to pass all existing behavior;
2. production mode cannot start with incomplete credentials;
3. each unit is priced at USD 0.01 and shipping is zero under explicit test pricing;
4. production orders contain valid dynamic merchant KHQR payloads for the exact trusted total;
5. payment confirmation comes only from a matching Bakong server response;
6. the QR card follows the approved KHQR visual direction without ABA branding;
7. secrets are absent from source, logs, responses, and browser assets;
8. automated verification passes;
9. the user successfully completes one controlled USD 0.01 acceptance payment.
