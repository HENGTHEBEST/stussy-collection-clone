# Bakong KHQR Mock and SIT-Ready Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fake card checkout with a server-backed, persistent, visibly simulated KHQR order flow that is ready for a future official Bakong SIT adapter.

**Architecture:** Keep the React/Vite storefront and add a Node API using Express and Node 24's built-in SQLite module. Shared contracts and catalog data sit outside the browser-only tree; an `OrderService` coordinates trusted pricing, persistence, and a `PaymentGateway` adapter whose first implementation is `MockBakongGateway`.

**Tech Stack:** React 19, Vite 8, TypeScript 7, Express, Node 24 `node:sqlite`, `qrcode`, Vitest, React Testing Library, Supertest

**Spec:** `docs/superpowers/specs/2026-11-09-bakong-khqr-checkout-design.md`

## Global Constraints

- `PAYMENT_MODE=mock`; no official Bakong network call is made in this phase.
- Use the installed Node.js 24 runtime and `node:sqlite` for local persistence.
- Keep the initial order currency `USD`; do not add conversion or dual-currency behavior.
- QR payment attempts expire ten minutes after creation.
- Recalculate all prices, shipping, and totals on the server from the shared catalog.
- Store money as integer minor units in the server and API contracts.
- Never expose or commit an API token, bank credential, PIN, OTP, or recovery QR.
- The browser never decides whether an order is paid.
- The UI must say `Simulation only - no money will move` while mock mode is active.
- Preserve the existing showcase, catalog, wishlist, cart behavior, neutral theme, accessibility, and responsive targets.
- Keep the SQLite database under a gitignored `data/` directory.

---

## File map

### Shared contracts and catalog

- `shared/commerce.ts`: product, cart-input, delivery, money, order, and payment public types.
- `shared/catalog.ts`: the thirteen illustrative products, imported by both browser and server.
- `src/types/commerce.ts`: compatibility re-export for existing frontend imports.
- `src/data/products.ts`: compatibility re-export for existing frontend imports.

### Server

- `server/config.ts`: validated server-only environment configuration.
- `server/catalog/order-pricing.ts`: variant validation and trusted integer totals.
- `server/orders/order-repository.ts`: persistence interface and stored record types.
- `server/orders/sqlite-order-repository.ts`: schema creation, transactions, reads, and guarded updates.
- `server/payments/payment-gateway.ts`: provider-neutral gateway contracts.
- `server/payments/mock-bakong-gateway.ts`: clearly simulated QR generation and outcomes.
- `server/orders/order-service.ts`: orchestration and public response mapping.
- `server/http/app.ts`: Express routes, validation, CORS, body limit, and error mapping.
- `server/index.ts`: runtime composition and listener startup.
- `server/test/fixtures.ts`: reusable server test checkout payloads.

### Frontend

- `src/lib/api.ts`: typed HTTP client and safe API error type.
- `src/lib/checkout.ts`: contact/address validation only; all card logic removed.
- `src/pages/CheckoutPage.tsx`: creates a server order and keeps the cart on failure.
- `src/pages/OrderPage.tsx`: loads server state, renders QR/countdown, polls, and simulates success only in mock mode.
- `src/components/commerce/OrderSummary.tsx`: real checkout labels and currency formatting helpers.
- `src/styles/commerce.css`: QR, status, countdown, and connection-state styling.

### Tooling and documentation

- `.env.example`: non-secret local settings.
- `.gitignore`: ignore `data/` while keeping `.env.example` tracked.
- `vite.config.ts`: `/api` development proxy.
- `tsconfig.app.json`: include `shared/`.
- `tsconfig.server.json`: strict Node/server type-check configuration.
- `tsconfig.json`: add server project reference.
- `package.json` and `package-lock.json`: backend runtime, scripts, and test dependencies.
- `README.md`: local mock checkout instructions and SIT credential boundary.

---

### Task 1: Shared commerce contracts and catalog

**Files:**
- Create: `shared/commerce.ts`
- Create: `shared/catalog.ts`
- Modify: `src/types/commerce.ts`
- Modify: `src/data/products.ts`
- Modify: `tsconfig.app.json`
- Test: `src/data/products.test.ts`

**Interfaces:**
- Produces: `Product`, `ProductSize`, `ProductColor`, `CheckoutCustomer`, `DeliveryAddress`, `DeliveryMethod`, `CreateOrderRequest`, `OrderStatus`, `PaymentStatus`, `PublicOrder`, `PublicPaymentAttempt`, and `products`.
- Consumes: none.

- [ ] **Step 1: Extend the catalog test to require shared data identity**

Add assertions to `src/data/products.test.ts`:

```ts
import { products as sharedProducts } from '../../shared/catalog';
import { products } from './products';

it('uses the same catalog object in browser and server code', () => {
  expect(products).toBe(sharedProducts);
  expect(products.every((product) => Number.isInteger(product.demoPrice * 100))).toBe(true);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/data/products.test.ts`

Expected: FAIL because `shared/catalog` does not exist.

- [ ] **Step 3: Define shared API contracts**

Create `shared/commerce.ts` with these exact public shapes:

```ts
export type ProductSize = 'XS' | 'S' | 'M' | 'L' | 'XL';
export type ProductColor = 'Black' | 'White' | 'Natural';
export type DeliveryMethod = 'standard' | 'express';
export type OrderStatus = 'awaiting_payment' | 'paid' | 'failed' | 'expired' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'expired';

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

export interface CheckoutCustomer { name: string; email: string; phone: string }
export interface DeliveryAddress {
  street: string; city: string; region: string; postalCode: string; country: string;
}
export interface CheckoutLineInput {
  productId: number; size: ProductSize; color: ProductColor; quantity: number;
}
export interface CreateOrderRequest {
  requestId: string;
  customer: CheckoutCustomer;
  address: DeliveryAddress;
  delivery: DeliveryMethod;
  lines: CheckoutLineInput[];
}
export interface PublicOrderLine {
  productId: number; slug: string; name: string; image: string;
  size: ProductSize; color: ProductColor; quantity: number; unitPriceMinor: number;
}
export interface PublicPaymentAttempt {
  status: PaymentStatus; qrDataUrl: string; expiresAt: string; providerReference: string;
}
export interface PublicOrder {
  id: string; status: OrderStatus; createdAt: string; updatedAt: string;
  deliveryLabel: 'Standard delivery' | 'Express delivery'; currency: 'USD';
  subtotalMinor: number; shippingMinor: number; totalMinor: number;
  lines: PublicOrderLine[]; payment: PublicPaymentAttempt;
  mockMode: boolean;
}
```

- [ ] **Step 4: Move the catalog without changing product values**

Move the complete array from `src/data/products.ts` into `shared/catalog.ts`, importing `Product` from `./commerce`. Replace frontend compatibility files with:

```ts
// src/data/products.ts
export { products } from '../../shared/catalog';
```

```ts
// src/types/commerce.ts
export type {
  Product, ProductSize, ProductColor, DeliveryMethod, OrderStatus, PaymentStatus,
  CheckoutCustomer, DeliveryAddress, CheckoutLineInput, CreateOrderRequest,
  PublicOrderLine, PublicPaymentAttempt, PublicOrder,
} from '../../shared/commerce';
```

Add `../shared` to `tsconfig.app.json`'s `include` list.

- [ ] **Step 5: Run catalog and full frontend tests**

Run: `npm test -- src/data/products.test.ts src/lib/catalog.test.ts src/pages/ShopPage.test.tsx src/pages/ProductPage.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared src/data/products.ts src/types/commerce.ts tsconfig.app.json
git commit -m "refactor: share catalog and order contracts"
```

---

### Task 2: Trusted server pricing

**Files:**
- Create: `server/catalog/order-pricing.ts`
- Test: `server/catalog/order-pricing.test.ts`

**Interfaces:**
- Consumes: `CheckoutLineInput`, `PublicOrderLine`, and `products` from Task 1.
- Produces: `priceOrder(lines, delivery): PricedOrder` and `OrderPricingError`.

- [ ] **Step 1: Write failing tests for trusted prices and invalid variants**

Create `server/catalog/order-pricing.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { OrderPricingError, priceOrder } from './order-pricing';

describe('priceOrder', () => {
  it('ignores browser prices by accepting only variant inputs', () => {
    const priced = priceOrder([{ productId: 1, size: 'M', color: 'Black', quantity: 2 }], 'standard');
    expect(priced).toMatchObject({ subtotalMinor: 9600, shippingMinor: 1200, totalMinor: 10800 });
    expect(priced.lines[0]).toMatchObject({ unitPriceMinor: 4800, quantity: 2 });
  });

  it.each([
    [{ productId: 999, size: 'M', color: 'Black', quantity: 1 }],
    [{ productId: 6, size: 'M', color: 'Black', quantity: 1 }],
    [{ productId: 1, size: 'XS', color: 'Black', quantity: 1 }],
    [{ productId: 1, size: 'M', color: 'White', quantity: 1 }],
    [{ productId: 1, size: 'M', color: 'Black', quantity: 0 }],
  ] as const)('rejects an invalid or unavailable line', (line) => {
    expect(() => priceOrder([line], 'standard')).toThrow(OrderPricingError);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- server/catalog/order-pricing.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement server-owned pricing**

Create `server/catalog/order-pricing.ts` with:

```ts
import { products } from '../../shared/catalog';
import type { CheckoutLineInput, DeliveryMethod, PublicOrderLine } from '../../shared/commerce';

export class OrderPricingError extends Error {}
export interface PricedOrder {
  lines: PublicOrderLine[];
  subtotalMinor: number;
  shippingMinor: number;
  totalMinor: number;
}

export function priceOrder(lines: CheckoutLineInput[], delivery: DeliveryMethod): PricedOrder {
  if (!Array.isArray(lines) || lines.length === 0) throw new OrderPricingError('Cart is empty.');
  const pricedLines = lines.map((line) => {
    const product = products.find((candidate) => candidate.id === line.productId);
    if (!product || !product.available || !product.sizes.includes(line.size)
      || product.color !== line.color || !Number.isInteger(line.quantity)
      || line.quantity < 1 || line.quantity > 10) {
      throw new OrderPricingError('Cart contains an unavailable item or variant.');
    }
    return {
      productId: product.id, slug: product.slug, name: product.name, image: product.image,
      size: line.size, color: line.color, quantity: line.quantity,
      unitPriceMinor: Math.round(product.demoPrice * 100),
    } satisfies PublicOrderLine;
  });
  const subtotalMinor = pricedLines.reduce((sum, line) => sum + line.unitPriceMinor * line.quantity, 0);
  const baseShipping = subtotalMinor >= 15000 ? 0 : 1200;
  const shippingMinor = delivery === 'express' ? baseShipping + 800 : baseShipping;
  return { lines: pricedLines, subtotalMinor, shippingMinor, totalMinor: subtotalMinor + shippingMinor };
}
```

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- server/catalog/order-pricing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/catalog
git commit -m "feat: add trusted server order pricing"
```

---

### Task 3: SQLite order repository

**Files:**
- Create: `server/orders/order-repository.ts`
- Create: `server/orders/sqlite-order-repository.ts`
- Test: `server/orders/sqlite-order-repository.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: shared order types and `PricedOrder` from Task 2.
- Produces: `OrderRepository`, `StoredOrder`, `StoredPaymentAttempt`, and `SqliteOrderRepository`.

- [ ] **Step 1: Write failing persistence and transition tests**

Test an in-memory database (`:memory:`) for: atomic order/line/payment creation, retrieval after a new repository instance uses the same file, duplicate `requestId` returning the original order, paid transition idempotency, rejection of paid-to-failed regression, and unique transaction hashes.

Core assertion:

```ts
const created = repository.createOrder(fixture);
expect(repository.findById(created.id)).toMatchObject({
  id: created.id,
  status: 'awaiting_payment',
  lines: [{ productId: 1, unitPriceMinor: 4800 }],
  payment: { status: 'pending' },
});
expect(repository.markPaid(created.id, 'mock-hash')).toBe(true);
expect(repository.markPaid(created.id, 'mock-hash')).toBe(true);
expect(() => repository.markFailed(created.id)).toThrow(/paid/i);
```

- [ ] **Step 2: Run the repository test and verify RED**

Run: `npm test -- server/orders/sqlite-order-repository.test.ts`

Expected: FAIL because repository modules do not exist.

- [ ] **Step 3: Define repository records and methods**

In `server/orders/order-repository.ts`, define:

```ts
export interface StoredPaymentAttempt extends PublicPaymentAttempt {
  qrPayload: string;
  md5: string;
  transactionHash: string | null;
}
export interface StoredOrder extends Omit<PublicOrder, 'payment'> {
  requestId: string;
  customer: CheckoutCustomer;
  address: DeliveryAddress;
  delivery: DeliveryMethod;
  payment: StoredPaymentAttempt;
}
export interface CreateStoredOrderInput extends Omit<StoredOrder, 'id' | 'createdAt' | 'updatedAt'> {
  id: string; createdAt: string; updatedAt: string;
}
export interface OrderRepository {
  createOrder(input: CreateStoredOrderInput): StoredOrder;
  findById(id: string): StoredOrder | null;
  findByRequestId(requestId: string): StoredOrder | null;
  markPaid(id: string, transactionHash: string, updatedAt: string): boolean;
  markFailed(id: string, updatedAt: string): boolean;
  markExpired(id: string, updatedAt: string): boolean;
  close(): void;
}
```

- [ ] **Step 4: Implement schema and transactional mapping**

Use `DatabaseSync` and create `orders`, `order_lines`, and `payment_attempts` tables. Enable foreign keys and WAL for file-backed databases. Store contact/address only in `orders`, line snapshots in `order_lines`, and provider details in `payment_attempts`. Wrap creation in one SQLite transaction. Use parameterized statements exclusively.

Guard status updates with SQL conditions such as:

```sql
UPDATE orders
SET status = 'paid', updated_at = ?
WHERE id = ? AND status IN ('awaiting_payment', 'paid')
```

Create a unique index on non-null `transaction_hash`.

- [ ] **Step 5: Ignore runtime data**

Append to `.gitignore`:

```gitignore
data/
```

- [ ] **Step 6: Run repository and pricing tests**

Run: `npm test -- server/orders/sqlite-order-repository.test.ts server/catalog/order-pricing.test.ts`

Expected: PASS with no database files left outside test temporary directories.

- [ ] **Step 7: Commit**

```bash
git add .gitignore server/orders
git commit -m "feat: persist checkout orders in sqlite"
```

---

### Task 4: Mock Bakong gateway and order service

**Files:**
- Create: `server/payments/payment-gateway.ts`
- Create: `server/payments/mock-bakong-gateway.ts`
- Create: `server/orders/order-service.ts`
- Create: `server/test/fixtures.ts`
- Test: `server/payments/mock-bakong-gateway.test.ts`
- Test: `server/orders/order-service.test.ts`

**Interfaces:**
- Consumes: `OrderRepository`, `priceOrder`, and shared request/response types.
- Produces: `PaymentGateway`, `MockBakongGateway`, `OrderService.createOrder`, `OrderService.getOrder`, and `OrderService.simulateSuccess`.

- [ ] **Step 1: Write failing gateway tests**

Use a fixed clock and assert that `createPayment` produces a ten-minute expiration, a `mock-khqr:` payload encoded as a QR data URL, a stable provider reference, and an MD5 reference. Assert `checkPayment` is pending until `simulateSuccess(reference)` and paid afterward.

- [ ] **Step 2: Run gateway tests and verify RED**

Run: `npm test -- server/payments/mock-bakong-gateway.test.ts`

Expected: FAIL because gateway modules do not exist.

- [ ] **Step 3: Implement the provider-neutral gateway**

Define:

```ts
export interface GatewayOrder {
  orderId: string; totalMinor: number; currency: 'USD'; expiresAt: string;
}
export interface GatewayPayment {
  providerReference: string; qrPayload: string; qrDataUrl: string;
  md5: string; expiresAt: string; status: PaymentStatus;
}
export interface GatewayCheckResult {
  status: PaymentStatus; transactionHash?: string;
}
export interface PaymentGateway {
  createPayment(order: GatewayOrder): Promise<GatewayPayment>;
  checkPayment(providerReference: string, expiresAt: string): Promise<GatewayCheckResult>;
}
```

Implement `MockBakongGateway` with injected `now`, `qrcode.toDataURL`, `node:crypto` MD5, and an in-memory set of simulated references. Prefix the payload with `mock-khqr:` so it cannot be mistaken for a genuine EMV KHQR payload.

- [ ] **Step 4: Write failing service tests**

Cover server validation, trusted totals, duplicate request idempotency, sanitized public response, mock success, expiration, and unknown order behavior. Assert a browser-supplied extra `unitPrice` property has no effect.

- [ ] **Step 5: Run service tests and verify RED**

Run: `npm test -- server/orders/order-service.test.ts`

Expected: FAIL because `OrderService` does not exist.

- [ ] **Step 6: Implement `OrderService`**

Constructor:

```ts
constructor(
  private readonly repository: OrderRepository,
  private readonly gateway: PaymentGateway,
  private readonly now: () => Date = () => new Date(),
) {}
```

Methods:

```ts
createOrder(input: CreateOrderRequest): Promise<PublicOrder>
getOrder(id: string): Promise<PublicOrder | null>
simulateSuccess(id: string): Promise<PublicOrder | null>
```

Validate trimmed customer/address fields, email syntax, phone length, delivery value, request UUID format, and cart shape. Use `crypto.randomUUID()` for the public order ID. Call the gateway, persist in one repository operation, and return only the `PublicOrder` fields. On reads, expire pending attempts after `expiresAt`; otherwise check the gateway and persist success before returning.

- [ ] **Step 7: Run gateway, service, pricing, and repository tests**

Run: `npm test -- server/payments server/orders server/catalog`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server/payments server/orders/order-service.ts server/test
git commit -m "feat: add mock Bakong payment service"
```

---

### Task 5: HTTP API and runtime wiring

**Files:**
- Create: `server/config.ts`
- Create: `server/http/app.ts`
- Create: `server/index.ts`
- Create: `server/http/app.test.ts`
- Create: `tsconfig.server.json`
- Create: `.env.example`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.json`
- Modify: `tsconfig.node.json`
- Modify: `vite.config.ts`

**Interfaces:**
- Consumes: `OrderService` from Task 4.
- Produces: `createApp({ service, config })`, executable API server, `/api/health`, `/api/orders`, `/api/orders/:id`, and mock-only success route.

- [ ] **Step 1: Install minimal backend dependencies**

Run:

```bash
npm install express qrcode
npm install --save-dev @types/express @types/node @types/qrcode supertest @types/supertest tsx concurrently
```

Expected: `package.json` and `package-lock.json` update without audit errors that block installation.

- [ ] **Step 2: Write failing Supertest API tests**

Cover:

```ts
await request(app).get('/api/health').expect(200, { ready: true, paymentMode: 'mock' });
await request(app).post('/api/orders').send(validRequest).expect(201);
await request(app).post('/api/orders').send({}).expect(400);
await request(app).get(`/api/orders/${orderId}`).expect(200);
await request(app).get('/api/orders/unknown').expect(404);
await request(app).post(`/api/orders/${orderId}/mock-payment`).expect(200);
```

Build a second app with `paymentMode: 'sit'` and assert the mock route returns 404. Assert response bodies never contain `apiToken`, `street`, or stack traces.

- [ ] **Step 3: Run API tests and verify RED**

Run: `npm test -- server/http/app.test.ts`

Expected: FAIL because the app module does not exist.

- [ ] **Step 4: Implement validated configuration**

`server/config.ts` exports:

```ts
export interface ServerConfig {
  port: number; appOrigin: string; paymentMode: 'mock' | 'sit' | 'production';
  merchantName: string; merchantCity: string; bakongAccountId: string;
  currency: 'USD'; sqlitePath: string;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig;
```

Reject invalid ports, origins, payment modes, empty merchant fields, unsupported currency, and non-mock modes without a server-side token. Do not log configuration values.

- [ ] **Step 5: Implement Express routes and sanitized errors**

Use `express.json({ limit: '32kb' })`, an exact-origin CORS header, and explicit route handlers. Return:

```json
{ "error": { "code": "invalid_checkout", "message": "Check the highlighted checkout information." } }
```

for validation failures. Log only error class, route, method, and order ID; omit bodies and customer fields.

- [ ] **Step 6: Add runtime and TypeScript wiring**

Add `tsconfig.server.json` with NodeNext module resolution, strict mode, Node types, `noEmit: true`, and includes for `server` and `shared`. Add it to root project references.

Update scripts:

```json
{
  "dev": "concurrently -k -n api,web \"npm:dev:api\" \"npm:dev:web\"",
  "dev:web": "vite",
  "dev:api": "tsx watch server/index.ts",
  "start:api": "tsx server/index.ts",
  "typecheck": "tsc -b",
  "build": "npm run typecheck && vite build"
}
```

Configure Vite proxy target `http://127.0.0.1:8787` for `/api`.
Set `server.strictPort: true` so the configured `APP_ORIGIN=http://localhost:5173`
cannot silently drift to another development port.

At the top of `server/index.ts`, load `.env.local` when present without failing when
it is absent:

```ts
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (existsSync('.env.local')) loadEnvFile('.env.local');
```

- [ ] **Step 7: Add safe example configuration**

Create `.env.example`:

```dotenv
PAYMENT_MODE=mock
API_PORT=8787
APP_ORIGIN=http://localhost:5173
MERCHANT_NAME=Stussy Collection Showcase
MERCHANT_CITY=Phnom Penh
BAKONG_ACCOUNT_ID=demo@mock
ORDER_CURRENCY=USD
SQLITE_PATH=./data/store.sqlite
```

- [ ] **Step 8: Run API tests and type checks**

Run: `npm test -- server/http/app.test.ts server/orders server/payments server/catalog`

Run: `npm run typecheck`

Expected: both commands PASS.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json tsconfig.node.json tsconfig.server.json vite.config.ts .env.example server
git commit -m "feat: expose mock Bakong order API"
```

---

### Task 6: Frontend API client and card-free checkout

**Files:**
- Create: `src/lib/api.ts`
- Test: `src/lib/api.test.ts`
- Modify: `src/lib/checkout.ts`
- Modify: `src/lib/checkout.test.ts`
- Modify: `src/pages/CheckoutPage.tsx`
- Rewrite: `src/pages/CheckoutPage.test.tsx`
- Modify: `src/components/commerce/OrderSummary.tsx`

**Interfaces:**
- Consumes: `CreateOrderRequest` and `PublicOrder` from Task 1; HTTP API from Task 5.
- Produces: `createOrder`, `getOrder`, `simulateMockPayment`, contact/address validation, and the migrated checkout UI.

- [ ] **Step 1: Write failing API-client tests**

Mock `fetch` and verify JSON request bodies, `Content-Type`, typed success parsing, 404 handling, non-JSON 500 handling, and `ApiError` with `status` and safe message.

- [ ] **Step 2: Run API-client tests and verify RED**

Run: `npm test -- src/lib/api.test.ts`

Expected: FAIL because `src/lib/api.ts` does not exist.

- [ ] **Step 3: Implement the typed API client**

Export:

```ts
export class ApiError extends Error { constructor(message: string, readonly status: number) { super(message); } }
export function createOrder(input: CreateOrderRequest): Promise<PublicOrder>;
export function getOrder(orderId: string, signal?: AbortSignal): Promise<PublicOrder>;
export function simulateMockPayment(orderId: string): Promise<PublicOrder>;
```

Use `encodeURIComponent(orderId)`, accept an optional abort signal, and convert malformed/non-JSON failures into `ApiError('The shop service is temporarily unavailable.', status)`.

- [ ] **Step 4: Rewrite checkout validation tests before implementation**

Replace card tests with assertions that contact, address, and delivery are required; email and phone are validated; and no returned error key or serialized source contains `cardholder`, `cardNumber`, `expiry`, or `cvc`.

- [ ] **Step 5: Run checkout tests and verify RED**

Run: `npm test -- src/lib/checkout.test.ts src/pages/CheckoutPage.test.tsx`

Expected: FAIL because the existing page still renders card fields and stores local orders.

- [ ] **Step 6: Remove card-domain logic**

Change `CheckoutFields` to contact, address, and delivery only. Keep `validateCheckout(fields)` focused on required fields, email, and phone. Delete `createOrderSummary`, `OrderSummaryRecord`, and `isOrderSummaryRecord`. Remove `ORDER_STORAGE_KEY` from browser storage when no remaining test imports it.

- [ ] **Step 7: Migrate checkout submission**

On submit:

```ts
const request: CreateOrderRequest = {
  requestId: crypto.randomUUID(),
  customer: { name: fields.name, email: fields.email, phone: fields.phone },
  address: {
    street: fields.street, city: fields.city, region: fields.region,
    postalCode: fields.postalCode, country: fields.country,
  },
  delivery: fields.delivery,
  lines: lines.map(({ productId, size, color, quantity }) => ({ productId, size, color, quantity })),
};
const order = await createOrder(request);
clear();
navigate(`/order/${order.id}`, { replace: true, state: { order } });
```

Keep the cart when the request fails. Prevent duplicate submission, focus the first invalid field, announce network errors once, and expose `aria-busy` while submitting. Change copy and button labels to `Continue to KHQR` and remove every card reference.

- [ ] **Step 8: Update summary labels**

Keep browser totals as estimates, rename `Demo checkout` to `Checkout`, remove fake-card language, and add:

```ts
export function formatMinorCurrency(value: number, currency: 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value / 100);
}
```

- [ ] **Step 9: Run checkout and cart tests**

Run: `npm test -- src/lib/api.test.ts src/lib/checkout.test.ts src/pages/CheckoutPage.test.tsx src/pages/CartPage.test.tsx`

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib src/pages/CheckoutPage.tsx src/pages/CheckoutPage.test.tsx src/components/commerce/OrderSummary.tsx
git commit -m "feat: create server-backed checkout orders"
```

---

### Task 7: QR order status and refresh-safe confirmation

**Files:**
- Modify: `src/pages/OrderPage.tsx`
- Create: `src/pages/OrderPage.test.tsx`
- Modify: `src/styles/commerce.css`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Consumes: `getOrder`, `simulateMockPayment`, `PublicOrder`, and `formatMinorCurrency` from prior tasks.
- Produces: refresh-safe pending/paid/failed/expired order experience.

- [ ] **Step 1: Write failing order-page tests**

Mock API calls and fake timers to cover:

- location-state order renders immediately, then refreshes from API;
- direct route fetches and renders the order;
- pending order shows QR, exact USD amount, countdown, and simulation notice;
- polling calls `getOrder` every five seconds while pending and stops after paid;
- mock-success button calls the API once and renders paid confirmation;
- expired order offers checkout/shop recovery without claiming payment;
- aborted requests do not display an error;
- 404 renders `Order not available`;
- connection failure renders a retry control and does not show `failed`.

Core expectations:

```ts
expect(screen.getByText('Simulation only - no money will move')).toBeVisible();
expect(screen.getByRole('img', { name: 'Simulated Bakong KHQR payment code' })).toBeVisible();
expect(screen.getByText('$108.00')).toBeVisible();
```

- [ ] **Step 2: Run order tests and verify RED**

Run: `npm test -- src/pages/OrderPage.test.tsx src/app/App.test.tsx`

Expected: FAIL because the page still reads local storage.

- [ ] **Step 3: Implement the order loader and polling lifecycle**

Use `useParams`, optional location-state seed, an abort controller per request, and a five-second interval only for `awaiting_payment`. Keep explicit `loading`, `ready`, `not-found`, and `connection-error` UI states. Compute countdown from `payment.expiresAt` once per second and rely on the server state for authoritative expiration.

- [ ] **Step 4: Render payment states accessibly**

Pending state includes QR image, amount, currency, expiration time, countdown, simulation notice, and mock-success control. Paid state uses an `aria-live` confirmation and order summary. Failed/expired states never show fulfillment language. Use product snapshots from the API rather than looking up mutable catalog prices.

- [ ] **Step 5: Add neutral responsive styles**

Add `.payment-panel`, `.khqr-frame`, `.payment-status`, `.payment-countdown`, and `.connection-error` styles using existing black, white, and gray tokens. Limit QR width to 20rem, preserve a white quiet zone, and stack the panel below 768px. Do not introduce red/coral accents.

- [ ] **Step 6: Update route-level tests**

Mock `getOrder` in `App.test.tsx` so direct `/order/:orderId` routing remains covered without local storage. Assert unknown routes and the error boundary still behave unchanged.

- [ ] **Step 7: Run frontend payment-flow tests**

Run: `npm test -- src/pages/OrderPage.test.tsx src/pages/CheckoutPage.test.tsx src/app/App.test.tsx`

Expected: PASS with no timer or act warnings.

- [ ] **Step 8: Commit**

```bash
git add src/pages/OrderPage.tsx src/pages/OrderPage.test.tsx src/styles/commerce.css src/app/App.test.tsx
git commit -m "feat: add simulated KHQR payment status flow"
```

---

### Task 8: Documentation and end-to-end verification

**Files:**
- Create: `README.md`
- Modify: `scripts/verify-visual-regressions.mjs`
- Modify: `docs/verification/2026-11-07-stussy-store-verification.md`

**Interfaces:**
- Consumes: completed frontend and server flow.
- Produces: reproducible local instructions and final verification evidence.

- [ ] **Step 1: Document local startup and credential safety**

Create `README.md` with:

```md
## Local mock checkout

1. Copy `.env.example` to `.env.local`.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the Vite URL and complete cart -> checkout -> simulated KHQR.

Mock mode never contacts Bakong and never moves money. Do not add a real token to any
`VITE_*` variable. Server-only credentials belong in an ignored environment file.
```

Also describe `npm test`, `npm run typecheck`, `npm run build`, the `data/` database, and the exact missing inputs before SIT activation.

- [ ] **Step 2: Extend browser regression assertions**

Update `scripts/verify-visual-regressions.mjs` to assert that checkout contains no card-number or CVC fields, the order route displays the simulation notice and QR after order creation, simulated success survives refresh, and no red/coral theme values reappear.

- [ ] **Step 3: Run the complete automated suite**

Run: `npm test`

Expected: all existing and new tests PASS.

- [ ] **Step 4: Run static and production checks**

Run: `npm run typecheck`

Run: `npm run build`

Run: `npm run assets:verify`

Expected: all commands exit 0.

- [ ] **Step 5: Run browser verification**

Start: `npm run dev`

Run: `node scripts/verify-visual-regressions.mjs`

Manually verify at 360, 390, 768, 1024, and 1440 pixels:

1. Add an available product variant to cart.
2. Open checkout and confirm there are no card fields.
3. Submit contact/delivery information.
4. Confirm cart clears only after server success.
5. Confirm QR, amount, simulation notice, and countdown.
6. Simulate success and confirm paid state.
7. Refresh the order route and confirm it remains paid.
8. Visit an unknown order ID and confirm recovery UI.
9. Stop the API and confirm the page reports a connection problem rather than a failed payment.

- [ ] **Step 6: Verify secrets and repository state**

Run:

```bash
git status --short
git grep -nE "BAKONG_API_TOKEN=.+|Bearer [A-Za-z0-9._-]{20,}|BEGIN (RSA|PRIVATE) KEY"
git ls-files data .env .env.local
```

Expected: no secret matches; no database or local environment file is tracked.

- [ ] **Step 7: Commit documentation and verification changes**

```bash
git add README.md scripts/verify-visual-regressions.mjs docs/verification
git commit -m "docs: verify mock Bakong checkout flow"
```

- [ ] **Step 8: Request final code review**

Use `superpowers:requesting-code-review` against the complete branch diff. Resolve findings through test-first fixes, rerun all commands from Steps 3-6, and only then use `superpowers:finishing-a-development-branch` to integrate or publish the work.
