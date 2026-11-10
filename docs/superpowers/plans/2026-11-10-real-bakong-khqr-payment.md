# Real Bakong KHQR Payment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in production Bakong KHQR gateway, price every test unit at USD 0.01 with free shipping, and display a scannable KHQR payment card without exposing credentials or allowing the browser to confirm payment.

**Architecture:** Keep the existing `PaymentGateway`, `OrderService`, SQLite repository, and polling routes. Add a production adapter that uses NBC's documented `bakong-khqr` package for dynamic merchant payloads and calls Bakong's MD5 status endpoint with server-only credentials; inject a small pricing policy into the existing server pricing function. The frontend continues to call only this application's API and renders public order data.

**Tech Stack:** Node.js 24, TypeScript 7, Express 5, React 19, SQLite, Vitest, Testing Library, `bakong-khqr` 1.0.20, `qrcode` 1.5.

**Spec:** `docs/superpowers/specs/2026-11-10-real-bakong-khqr-payment-design.md`

## Global Constraints

- Keep `PAYMENT_MODE=mock` until every production credential is filled and validated.
- The production API base URL is `https://api-bakong.nbc.gov.kh` and must use HTTPS.
- Each test unit costs exactly one USD minor unit (`USD 0.01`); standard and express shipping both cost zero while test pricing is enabled.
- Store and compare money as integer minor units; convert to a decimal only at the SDK/API boundary.
- The API token remains server-only and never appears in source, browser code, responses, logs, fixtures, screenshots, or commits.
- The QR expires within ten minutes and payment confirmation comes only from Bakong's MD5 status response.
- A paid response must match the configured Bakong account ID, `USD`, the exact stored total, and a unique 64-character transaction hash.
- Treat missing transactions as pending until expiration; transport, authorization, malformed-response, and mismatch failures must never mark an order paid.
- Do not copy ABA branding, account numbers, or surrounding app UI; use only the approved red KHQR header/dark-card visual direction.
- The human user performs the final banking-app scan and confirmation. Automated tools must not initiate or confirm a money transfer.

## File map

- `server/config.ts`: public runtime settings, secret credential loading, and pricing policy validation.
- `server/config.test.ts`: configuration and secret-boundary tests.
- `.env.example`: non-secret documentation with blank credential placeholders.
- `.env.local`: gitignored local placeholders; remains in mock mode until the user fills values.
- `package.json`, `package-lock.json`: add the NBC-documented KHQR package.
- `server/types/bakong-khqr.d.ts`: narrow declarations for the untyped package surface actually used.
- `server/catalog/order-pricing.ts`: trusted pricing with an injected test policy.
- `server/catalog/order-pricing.test.ts`: one-cent quantity and free-shipping coverage.
- `server/payments/payment-gateway.ts`: expected-order context for provider status verification.
- `server/payments/mock-bakong-gateway.ts`: adapt mock checks to the new interface without behavior changes.
- `server/payments/bakong-gateway.ts`: KHQR generation, QR rendering, Bakong request, response validation, and status normalization.
- `server/payments/bakong-gateway.test.ts`: adapter contract tests with a local fetch double; no network calls.
- `server/payments/create-payment-gateway.ts`: select mock or production gateway from validated mode.
- `server/payments/create-payment-gateway.test.ts`: mode-selection and fail-closed tests.
- `server/orders/order-service.ts`: pass pricing policy and expected order facts to the gateway; expose the safe merchant name.
- `server/orders/order-service.test.ts`: trusted total, matching-payment, and public-field tests.
- `server/index.ts`, `server/index.test.ts`: production runtime composition and sanitized startup behavior.
- `shared/commerce.ts`: add public `merchantName` to `PublicOrder`.
- `src/pages/OrderPage.tsx`, `src/styles/commerce.css`: KHQR payment card presentation.
- `src/pages/OrderPage.test.tsx`: mock/production card rendering and simulation-control coverage.
- `src/pages/CheckoutPage.test.tsx`, `server/http/app.test.ts`, `src/app/App.test.tsx`, `src/lib/api.test.ts`: update complete order fixtures and exact one-cent totals.

---

### Task 1: Secure Bakong configuration and SDK boundary

**Files:**
- Modify: `.env.example`
- Modify locally, do not stage: `.env.local`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `server/config.ts`
- Modify: `server/config.test.ts`
- Create: `server/types/bakong-khqr.d.ts`

**Interfaces:**
- Produces: `PricingPolicy { unitPriceMinor: number | null; freeShipping: boolean }`.
- Produces: `BakongCredentials { apiBaseUrl; apiToken; bakongAccountId; merchantId; acquiringBank; merchantName; merchantCity }`.
- Produces: `loadBakongCredentials(env, paymentMode): BakongCredentials | null`.
- Produces the typed package surface `BakongKHQR`, `MerchantInfo`, and `khqrData.currency.usd`.

- [ ] **Step 1: Write failing configuration tests**

Add tests that prove mock mode needs no secret, production requires every merchant value, production rejects non-HTTPS or credential-bearing API URLs, lengths follow the SDK contract, the one-cent policy parses exactly, and sanitized config output excludes `secret-token`.

```ts
it('loads explicit one-cent pricing without retaining a token in public config', () => {
  const env = { TEST_UNIT_PRICE_MINOR: '1', TEST_FREE_SHIPPING: 'true' };
  expect(loadConfig(env).pricing).toEqual({ unitPriceMinor: 1, freeShipping: true });
  expect(JSON.stringify(loadConfig({ ...env, BAKONG_API_TOKEN: 'secret-token' }))).not.toContain('secret-token');
});

it('requires the complete production merchant contract', () => {
  const complete = {
    PAYMENT_MODE: 'production', BAKONG_API_BASE_URL: 'https://api-bakong.nbc.gov.kh',
    BAKONG_API_TOKEN: 'secret-token', BAKONG_ACCOUNT_ID: 'merchant@bank',
    BAKONG_MERCHANT_ID: 'merchant-1', BAKONG_ACQUIRING_BANK: 'Example Bank',
    MERCHANT_NAME: 'Stussy Collection', MERCHANT_CITY: 'Phnom Penh',
  };
  expect(loadBakongCredentials(complete, 'production')).toMatchObject({
    apiBaseUrl: 'https://api-bakong.nbc.gov.kh', bakongAccountId: 'merchant@bank',
  });
  for (const key of Object.keys(complete).filter(key => key !== 'PAYMENT_MODE')) {
    expect(() => loadBakongCredentials({ ...complete, [key]: '' }, 'production')).toThrow();
  }
});
```

- [ ] **Step 2: Run the configuration tests and verify RED**

Run: `npm test -- server/config.test.ts`

Expected: FAIL because `pricing`, `BakongCredentials`, and `loadBakongCredentials` do not exist.

- [ ] **Step 3: Install the exact SDK version and add its narrow declaration**

Run: `npm install bakong-khqr@1.0.20`

Create `server/types/bakong-khqr.d.ts` with only the package members used by the gateway:

```ts
declare module 'bakong-khqr' {
  export const khqrData: { currency: { usd: 840 } };
  export interface MerchantOptions {
    currency: number;
    amount: number;
    billNumber: string;
    expirationTimestamp: number;
  }
  export class MerchantInfo {
    constructor(accountId: string, merchantName: string, merchantCity: string,
      merchantId: string, acquiringBank: string, options: MerchantOptions);
  }
  export interface KHQRResponse {
    status: { code: number; errorCode: number | null; message: string | null };
    data: { qr: string; md5: string } | null;
  }
  export class BakongKHQR {
    generateMerchant(info: MerchantInfo): KHQRResponse;
    static verify(qr: string): { isValid: boolean };
  }
}
```

- [ ] **Step 4: Implement configuration parsing**

Keep `ServerConfig` non-secret and add `pricing`. Add a separate secret loader so health responses and ordinary config serialization cannot include the token.

```ts
export interface PricingPolicy { unitPriceMinor: number | null; freeShipping: boolean }
export interface BakongCredentials {
  apiBaseUrl: string; apiToken: string; bakongAccountId: string; merchantId: string;
  acquiringBank: string; merchantName: string; merchantCity: string;
}

export function loadBakongCredentials(env: NodeJS.ProcessEnv, mode: ServerConfig['paymentMode']): BakongCredentials | null {
  if (mode === 'mock') return null;
  const required = (key: string, max: number) => {
    const value = env[key]?.trim();
    if (!value || value.length > max) throw new Error('Invalid server setting: ' + key);
    return value;
  };
  const apiBaseUrl = required('BAKONG_API_BASE_URL', 255);
  const url = new URL(apiBaseUrl);
  if (url.protocol !== 'https:' || url.origin !== apiBaseUrl || url.username || url.password) {
    throw new Error('Invalid server setting: BAKONG_API_BASE_URL');
  }
  return {
    apiBaseUrl, apiToken: required('BAKONG_API_TOKEN', 4096),
    bakongAccountId: required('BAKONG_ACCOUNT_ID', 32),
    merchantId: required('BAKONG_MERCHANT_ID', 32),
    acquiringBank: required('BAKONG_ACQUIRING_BANK', 32),
    merchantName: required('MERCHANT_NAME', 25), merchantCity: required('MERCHANT_CITY', 15),
  };
}
```

Parse `TEST_UNIT_PRICE_MINOR` as either absent (`null`) or an integer from 1 through 999999, and parse `TEST_FREE_SHIPPING` as exactly `true` or `false` with a default of `false`.

- [ ] **Step 5: Document local environment keys without activating production**

Use this exact safe shape in `.env.example` and append missing keys to the gitignored `.env.local`; do not overwrite any user value and do not stage `.env.local`:

```env
PAYMENT_MODE=mock
BAKONG_API_BASE_URL=https://api-bakong.nbc.gov.kh
BAKONG_API_TOKEN=
BAKONG_ACCOUNT_ID=
BAKONG_MERCHANT_ID=
BAKONG_ACQUIRING_BANK=
MERCHANT_NAME=Stussy Collection
MERCHANT_CITY=Phnom Penh
ORDER_CURRENCY=USD
TEST_UNIT_PRICE_MINOR=1
TEST_FREE_SHIPPING=true
```

- [ ] **Step 6: Run tests and type-check**

Run: `npm test -- server/config.test.ts && npm run typecheck`

Expected: configuration tests PASS and TypeScript accepts the local SDK declaration.

- [ ] **Step 7: Commit**

```bash
git add .env.example package.json package-lock.json server/config.ts server/config.test.ts server/types/bakong-khqr.d.ts
git commit -m "feat: configure production Bakong credentials"
```

Do not add `.env.local`.

---

### Task 2: Trusted one-cent pricing with free shipping

**Files:**
- Modify: `server/catalog/order-pricing.ts`
- Modify: `server/catalog/order-pricing.test.ts`
- Modify: `server/orders/order-service.ts`
- Modify: `server/orders/order-service.test.ts`

**Interfaces:**
- Consumes: `PricingPolicy` from `server/config.ts`.
- Produces: `priceOrder(lines, delivery, policy?: PricingPolicy): PricedOrder`.
- Produces: `new OrderService(repository, gateway, now?, pricing?, merchantName?)` with defaults preserving existing tests.

- [ ] **Step 1: Write failing one-cent pricing tests**

```ts
const testPricing = { unitPriceMinor: 1, freeShipping: true };

it.each([
  [1, 1], [2, 2], [10, 10],
])('prices %i units at one cent each', (quantity, totalMinor) => {
  const priced = priceOrder(
    [{ productId: 1, size: 'M', color: 'Black', quantity }], 'express', testPricing,
  );
  expect(priced).toMatchObject({ subtotalMinor: totalMinor, shippingMinor: 0, totalMinor });
  expect(priced.lines[0].unitPriceMinor).toBe(1);
});

it('sums one-cent quantities across variants', () => {
  const priced = priceOrder([
    { productId: 1, size: 'M', color: 'Black', quantity: 2 },
    { productId: 2, size: 'L', color: 'White', quantity: 3 },
  ], 'standard', testPricing);
  expect(priced).toMatchObject({ subtotalMinor: 5, shippingMinor: 0, totalMinor: 5 });
});
```

- [ ] **Step 2: Run pricing tests and verify RED**

Run: `npm test -- server/catalog/order-pricing.test.ts`

Expected: FAIL because `priceOrder` ignores the third argument and returns catalog prices plus shipping.

- [ ] **Step 3: Implement the injected pricing policy**

```ts
const catalogPricing: PricingPolicy = { unitPriceMinor: null, freeShipping: false };

export function priceOrder(lines: CheckoutLineInput[], delivery: DeliveryMethod,
  policy: PricingPolicy = catalogPricing): PricedOrder {
  // Keep the existing product, availability, variant, and quantity validation.
  const unitPriceMinor = policy.unitPriceMinor ?? Math.round(product.demoPrice * 100);
  // Build each line with unitPriceMinor.
  const baseShipping = policy.freeShipping || subtotalMinor >= 15000 ? 0 : 1200;
  const shippingMinor = policy.freeShipping ? 0 : delivery === 'express' ? baseShipping + 800 : baseShipping;
  return { lines: pricedLines, subtotalMinor, shippingMinor, totalMinor: subtotalMinor + shippingMinor };
}
```

Inject the policy into `OrderService` and call `priceOrder(request.lines, request.delivery, this.pricing)`; default to catalog pricing so unit tests unrelated to the acceptance mode keep their original expectations.

- [ ] **Step 4: Add an order-service assertion for the provider amount**

Construct `OrderService` with `testPricing`, create a two-quantity order, and assert both the public order and `gateway.createPayment` receive `totalMinor: 2` and `shippingMinor: 0`.

- [ ] **Step 5: Run pricing and service tests**

Run: `npm test -- server/catalog/order-pricing.test.ts server/orders/order-service.test.ts`

Expected: PASS with catalog-default tests unchanged and explicit test-policy cases at one cent.

- [ ] **Step 6: Commit**

```bash
git add server/catalog/order-pricing.ts server/catalog/order-pricing.test.ts server/orders/order-service.ts server/orders/order-service.test.ts
git commit -m "feat: add one-cent acceptance pricing"
```

---

### Task 3: Real Bakong gateway generation and verification

**Files:**
- Modify: `server/payments/payment-gateway.ts`
- Modify: `server/payments/mock-bakong-gateway.ts`
- Modify: `server/payments/mock-bakong-gateway.test.ts`
- Create: `server/payments/bakong-gateway.ts`
- Create: `server/payments/bakong-gateway.test.ts`

**Interfaces:**
- Consumes: `BakongCredentials` from `server/config.ts`.
- Produces: `GatewayCheckInput { providerReference; expiresAt; totalMinor; currency }`.
- Produces: `BakongGateway implements PaymentGateway`.
- `providerReference` is the SDK-returned MD5 value for production KHQR.

- [ ] **Step 1: Extend the gateway contract with expected order facts**

```ts
export interface GatewayCheckInput {
  providerReference: string;
  expiresAt: string;
  totalMinor: number;
  currency: 'USD';
}
export interface PaymentGateway {
  createPayment(order: GatewayOrder): Promise<GatewayPayment>;
  checkPayment(input: GatewayCheckInput): Promise<GatewayCheckResult>;
}
```

Update `MockBakongGateway.checkPayment` and its tests to accept the object while preserving its exact pending/paid/expired behavior.

- [ ] **Step 2: Write failing production-gateway tests**

Use a fetch double that captures URL, headers, body, and signal. Cover:

```ts
it('generates a valid dynamic USD merchant KHQR for the exact minor total', async () => {
  const gateway = new BakongGateway(credentials, fetchDouble);
  const payment = await gateway.createPayment({
    orderId: 'order-1', totalMinor: 3, currency: 'USD', expiresAt: '2026-11-10T10:10:00.000Z',
  });
  expect(BakongKHQR.verify(payment.qrPayload).isValid).toBe(true);
  expect(payment).toMatchObject({ providerReference: expect.stringMatching(/^[a-f0-9]{32}$/),
    md5: expect.stringMatching(/^[a-f0-9]{32}$/), status: 'pending' });
  expect(payment.qrDataUrl).toMatch(/^data:image\/png;base64,iVBOR/);
});

it('accepts only a matching Bakong transaction', async () => {
  fetchDouble.mockResolvedValue(jsonResponse({ responseCode: 0, responseMessage: 'Getting transaction successfully.',
    data: { hash: 'a'.repeat(64), fromAccountId: 'buyer@bank', toAccountId: 'merchant@bank',
      currency: 'USD', amount: 0.03, description: 'order-1' } }));
  await expect(gateway.checkPayment({ providerReference: 'b'.repeat(32),
    expiresAt: future, totalMinor: 3, currency: 'USD' }))
    .resolves.toEqual({ status: 'paid', transactionHash: 'a'.repeat(64) });
});
```

Also add table tests for wrong `toAccountId`, currency, amount, malformed hash, malformed JSON, HTTP 400/401/500, timeout/abort, explicit failed response, not-found-before-expiry, and not-found-at-expiry. Mismatches and malformed successes must reject; not found remains pending until expiration.

- [ ] **Step 3: Run gateway tests and verify RED**

Run: `npm test -- server/payments/mock-bakong-gateway.test.ts server/payments/bakong-gateway.test.ts`

Expected: FAIL because `BakongGateway` and the object-shaped check contract do not exist.

- [ ] **Step 4: Implement KHQR creation**

```ts
const sdk = new BakongKHQR();
const info = new MerchantInfo(
  credentials.bakongAccountId, credentials.merchantName, credentials.merchantCity,
  credentials.merchantId, credentials.acquiringBank,
  { currency: khqrData.currency.usd, amount: order.totalMinor / 100,
    billNumber: order.orderId, expirationTimestamp: Date.parse(order.expiresAt) },
);
const generated = sdk.generateMerchant(info);
if (generated.status.code !== 0 || !generated.data
  || !/^[a-f0-9]{32}$/.test(generated.data.md5)
  || !BakongKHQR.verify(generated.data.qr).isValid) {
  throw new Error('Bakong KHQR generation failed.');
}
return {
  providerReference: generated.data.md5, qrPayload: generated.data.qr,
  qrDataUrl: await QRCode.toDataURL(generated.data.qr, { errorCorrectionLevel: 'M', margin: 4, width: 640 }),
  md5: generated.data.md5, expiresAt: order.expiresAt, status: 'pending',
};
```

- [ ] **Step 5: Implement Bakong status checks and exact matching**

POST `{ md5: input.providerReference }` to `${apiBaseUrl}/v1/check_transaction_by_md5` with `Authorization: Bearer <token>`, `Content-Type: application/json`, and `AbortSignal.timeout(5000)`.

For `responseCode === 0`, require a complete data object, a 64-hex-character `hash`, `toAccountId === credentials.bakongAccountId`, `currency === input.currency`, and `Math.round(amount * 100) === input.totalMinor`. Return paid only after every check passes.

For `responseCode === 1` with a response message equal to `Transaction failed.` after case-folding and trimming, return failed. Other code-1/null-data responses remain pending until `Date.now() >= Date.parse(expiresAt)`, then return expired. Non-2xx and malformed responses throw sanitized errors.

- [ ] **Step 6: Run gateway tests and type-check**

Run: `npm test -- server/payments/mock-bakong-gateway.test.ts server/payments/bakong-gateway.test.ts && npm run typecheck`

Expected: PASS with no real network calls.

- [ ] **Step 7: Commit**

```bash
git add server/payments/payment-gateway.ts server/payments/mock-bakong-gateway.ts server/payments/mock-bakong-gateway.test.ts server/payments/bakong-gateway.ts server/payments/bakong-gateway.test.ts
git commit -m "feat: add verified Bakong KHQR gateway"
```

---

### Task 4: Runtime composition and public order contract

**Files:**
- Create: `server/payments/create-payment-gateway.ts`
- Create: `server/payments/create-payment-gateway.test.ts`
- Modify: `server/orders/order-service.ts`
- Modify: `server/orders/order-service.test.ts`
- Modify: `server/index.ts`
- Modify: `server/index.test.ts`
- Modify: `server/http/app.test.ts`
- Modify: `shared/commerce.ts`
- Modify: `src/lib/api.test.ts`
- Modify: `src/app/App.test.tsx`
- Modify: `src/pages/CheckoutPage.test.tsx`
- Modify: `src/pages/OrderPage.test.tsx`

**Interfaces:**
- Consumes: `loadConfig`, `loadBakongCredentials`, `BakongGateway`, and `PricingPolicy`.
- Produces: `createPaymentGateway(mode, credentials): PaymentGateway`.
- Produces: `PublicOrder.merchantName: string`.
- Updates: `OrderService.getOrder` calls `gateway.checkPayment({ providerReference, expiresAt, totalMinor, currency })`.

- [ ] **Step 1: Write failing factory and runtime tests**

```ts
it('selects mock without credentials and production with complete credentials', () => {
  expect(createPaymentGateway('mock', null)).toBeInstanceOf(MockBakongGateway);
  expect(createPaymentGateway('production', credentials)).toBeInstanceOf(BakongGateway);
  expect(() => createPaymentGateway('production', null)).toThrow('Bakong credentials are required.');
});
```

Replace the existing `server/index.test.ts` expectation that production always fails. Its new production runtime test must use complete non-secret fixture credentials, `BAKONG_API_BASE_URL=https://api.example.test`, and `SQLITE_PATH=:memory:`; request only `/api/health`, which performs no provider call, and assert it returns `{ ready: true, paymentMode: 'production' }` without including token or merchant identifiers. Keep a separate incomplete-credentials startup test that exits 1 without stack traces or secret text.

- [ ] **Step 2: Run factory/runtime tests and verify RED**

Run: `npm test -- server/payments/create-payment-gateway.test.ts server/index.test.ts`

Expected: FAIL because production is still rejected by `UnsupportedPaymentModeError`.

- [ ] **Step 3: Implement gateway selection and runtime wiring**

```ts
export function createPaymentGateway(mode: ServerConfig['paymentMode'], credentials: BakongCredentials | null): PaymentGateway {
  if (mode === 'mock') return new MockBakongGateway();
  if (!credentials) throw new Error('Bakong credentials are required.');
  return new BakongGateway(credentials);
}
```

In `server/index.ts`, load config and credentials, create the selected gateway, and pass `config.pricing` plus `config.merchantName` into `OrderService`. Delete `UnsupportedPaymentModeError`.

- [ ] **Step 4: Pass stored expected values to status checks**

Update the service call exactly:

```ts
const result = await this.gateway.checkPayment({
  providerReference: order.payment.providerReference,
  expiresAt: order.payment.expiresAt,
  totalMinor: order.totalMinor,
  currency: order.currency,
});
```

Keep repository uniqueness as the final duplicate-transaction guard. A duplicate hash must throw and leave the second order awaiting payment.

- [ ] **Step 5: Add the safe merchant name to public orders**

Add `merchantName: string` to `PublicOrder`. Store it as an `OrderService` constructor value and add it in the `publicOrder` mapper; do not put credentials or account IDs in the public type. Update every complete `PublicOrder` fixture to include `merchantName: 'Stussy Collection'` (or the fixture-specific safe name) and update the exact public-key assertion.

- [ ] **Step 6: Run the affected backend and frontend contract tests**

Run: `npm test -- server/payments/create-payment-gateway.test.ts server/orders/order-service.test.ts server/http/app.test.ts server/index.test.ts src/lib/api.test.ts src/app/App.test.tsx src/pages/CheckoutPage.test.tsx src/pages/OrderPage.test.tsx`

Expected: PASS; mock-success routes remain absent when `paymentMode` is production.

- [ ] **Step 7: Commit**

```bash
git add server/payments/create-payment-gateway.ts server/payments/create-payment-gateway.test.ts server/orders/order-service.ts server/orders/order-service.test.ts server/index.ts server/index.test.ts server/http/app.test.ts shared/commerce.ts src/lib/api.test.ts src/app/App.test.tsx src/pages/CheckoutPage.test.tsx src/pages/OrderPage.test.tsx
git commit -m "feat: compose production KHQR orders"
```

---

### Task 5: KHQR payment card and safe acceptance handoff

**Files:**
- Modify: `src/pages/OrderPage.tsx`
- Modify: `src/pages/OrderPage.test.tsx`
- Modify: `src/styles/commerce.css`
- Modify: `README.md` if it exists; otherwise modify: `.env.example` comments only

**Interfaces:**
- Consumes: `PublicOrder.merchantName`, `order.totalMinor`, `order.currency`, `order.payment.qrDataUrl`, `order.payment.expiresAt`, and `order.mockMode`.
- Produces no payment state; presentation continues to use existing API polling.

- [ ] **Step 1: Write failing production-card tests**

```ts
it('renders a branded-neutral KHQR card for production orders', async () => {
  get.mockResolvedValue({ ...order, merchantName: 'Stussy Collection', mockMode: false,
    totalMinor: 1, subtotalMinor: 1, shippingMinor: 0 });
  show(); await settle();
  const card = within(screen.getByRole('region', { name: 'KHQR payment' }));
  expect(card.getByText('KHQR')).toBeVisible();
  expect(card.getByText('Stussy Collection')).toBeVisible();
  expect(card.getByText('$0.01')).toBeVisible();
  expect(card.getByRole('img', { name: 'Bakong KHQR payment code' })).toBeVisible();
  expect(card.queryByText(/ABA|simulation/i)).not.toBeInTheDocument();
  expect(card.queryByRole('button', { name: /simulate/i })).not.toBeInTheDocument();
});
```

Keep the mock test and assert that it still displays `Simulation only - no money will move` plus its simulation button.

- [ ] **Step 2: Run the page test and verify RED**

Run: `npm test -- src/pages/OrderPage.test.tsx`

Expected: FAIL because the current region is named `Payment status` and lacks the KHQR card header and merchant name.

- [ ] **Step 3: Implement the focused KHQR card markup**

Use one `section.khqr-payment-card` named `KHQR payment` containing:

```tsx
<header className="khqr-card-header" aria-hidden="true">KHQR</header>
<div className="khqr-card-body">
  <p className="khqr-merchant">{order.merchantName}</p>
  <p className="khqr-amount">{formatMinorCurrency(order.totalMinor, order.currency)}</p>
  {pending && <div className="khqr-frame"><img src={order.payment.qrDataUrl}
    alt={order.mockMode ? 'Simulated Bakong KHQR payment code' : 'Bakong KHQR payment code'} /></div>}
</div>
```

Keep the status, countdown, retry behavior, and mock-only button adjacent inside the same named section. Do not add download/share/payment controls.

- [ ] **Step 4: Implement responsive styling**

Add a maximum-width payment card with a red header, dark teal body, white QR frame, four-module-equivalent visual quiet space, and readable merchant/amount text. At widths below 767px, the card must fit without horizontal scrolling; the QR remains square and no smaller than the available card width minus padding.

- [ ] **Step 5: Run frontend tests**

Run: `npm test -- src/pages/OrderPage.test.tsx src/pages/CheckoutPage.test.tsx`

Expected: PASS for mock and production rendering, countdown, polling, retries, and one-cent totals.

- [ ] **Step 6: Run the complete automated verification**

Run:

```bash
npm test
npm run build
npm run assets:verify
git diff --check
```

Expected: all tests pass, production build succeeds, assets verify, and the diff has no whitespace errors. Inspect desktop 1440x900 and mobile 390x844 screenshots of checkout and pending KHQR states; confirm no clipping, horizontal overflow, weak QR contrast, ABA branding, simulation controls in production, or missing primary amount/status information.

- [ ] **Step 7: Commit the UI and documentation**

```bash
git add src/pages/OrderPage.tsx src/pages/OrderPage.test.tsx src/styles/commerce.css README.md .env.example
git commit -m "feat: present production KHQR payment card"
```

If `README.md` does not exist, omit it from `git add`.

- [ ] **Step 8: Prepare the human-controlled live acceptance check**

Stop before money moves. Ask the user to fill the blank values in `.env.local`, keep the token out of chat, and confirm they are ready to switch from mock to production. After they explicitly confirm:

1. Restart the server with `PAYMENT_MODE=production`.
2. Verify `/api/health` reports production without secrets.
3. Create one quantity-one order and verify the site shows USD 0.01, the intended merchant name, and the expected recipient.
4. Hand control to the user to scan and confirm the USD 0.01 payment in their banking app.
5. After the user reports confirmation, poll the order and verify it becomes paid exactly once with a stored unique transaction hash.
6. If recipient, currency, amount, or status is wrong, stop the server and return to `PAYMENT_MODE=mock`.

The acceptance payment is not part of automated execution and must never be confirmed by the agent.
