# Vercel, Supabase, KHQR, and PayWay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a Vercel-hosted storefront with server-only Supabase orders, a focused KHQR payment page, and ABA PayWay hosted card checkout.

**Architecture:** Preserve the existing React client and trusted `OrderService`, while replacing the synchronous SQLite repository with an asynchronous Supabase-backed repository. Run the same Express app locally and as a Vercel serverless handler; the browser uses the same-origin `/api/*` contract throughout.

**Tech Stack:** React 19, TypeScript, Vite, Express 5, Vitest, Supertest, Supabase Postgres and `@supabase/supabase-js`, Vercel Functions, Bakong KHQR, ABA PayWay.

**Spec:** `docs/superpowers/specs/2026-11-11-vercel-supabase-khqr-payway-design.md`

## Global Constraints

- Use ABA PayWay for hosted card entry; do not add Stripe or collect card numbers, expiry dates, or CVC values in the app.
- The browser must not receive `SUPABASE_SERVICE_ROLE_KEY`, provider keys, or raw provider payloads.
- Apply the schema only to an empty Supabase production database; do not migrate local SQLite rows.
- Preserve server-authoritative catalog pricing, integer minor-unit totals, request-ID idempotency, and guarded payment transitions.
- A provider redirect, QR rendering, or client claim must never mark an order paid.
- Keep the existing mock-payment route restricted to `PAYMENT_MODE=mock`.
- Do not commit `.env.local` or production credentials.

---

## File structure

- `supabase/migrations/202611110001_orders.sql`: Empty-production schema, indexes, RLS, and transactional RPC functions.
- `server/orders/supabase-order-repository.ts`: Server-only implementation of the repository contract using Supabase RPC and typed row mapping.
- `server/orders/order-repository.ts`: Promise-based shared persistence interface, including provider-reference lookup.
- `server/orders/sqlite-order-repository.ts`: Async-compatible local development implementation retained until Supabase configuration is supplied locally.
- `server/orders/order-service.ts`: Await repository operations and expose safe PayWay callback reconciliation.
- `server/bootstrap.ts`: Build the configuration, gateways, repository, service, and Express app without binding a TCP port.
- `api/[...path].ts`: Vercel Function export that delegates requests to the Express app.
- `server/index.ts`: Local-only listener that imports the bootstrap function and owns shutdown.
- `server/config.ts` and `.env.example`: Supabase configuration and an origin model appropriate for local and Vercel environments.
- `server/http/app.ts`: PayWay callback route before the not-found handler and safe handling of form posts.
- `src/pages/CheckoutPage.tsx`: Contact & Delivery and in-place Payment states, including KHQR polling and ABA PayWay launch.
- `src/pages/OrderPage.tsx`: Server-verified confirmation/recovery route; retains PayWay hosted form flow.
- `src/styles/commerce.css`: Three-step checkout, scan-safe KHQR panel, and responsive editorial styling.
- `src/components/showcase/HeroSection.tsx`, `src/styles/showcase.css`: Non-overlapping hero title position.
- `vercel.json`: Static SPA and `/api/*` function routing.

### Task 1: Create the empty Supabase schema and asynchronous repository boundary

**Files:**
- Create: `supabase/migrations/202611110001_orders.sql`
- Create: `server/orders/supabase-order-repository.ts`
- Create: `server/orders/supabase-order-repository.test.ts`
- Modify: `server/orders/order-repository.ts`
- Modify: `server/orders/sqlite-order-repository.ts`
- Modify: `server/orders/sqlite-order-repository.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `CreateStoredOrderInput`, `StoredOrder`, and `StoredPaymentAttempt` from `server/orders/order-repository.ts`.
- Produces: `OrderRepository` methods returning `Promise`, including `findByProviderReference(providerReference: string): Promise<StoredOrder | null>`.
- Produces: PostgreSQL RPCs `create_order(payload jsonb)`, `get_order(order_id uuid)`, `get_order_by_request_id(request_id uuid)`, `get_order_by_provider_reference(provider_reference text)`, `mark_order_paid(order_id uuid, transaction_hash text, changed_at timestamptz)`, and `mark_order_unpaid(order_id uuid, next_status text, changed_at timestamptz)`.

- [ ] **Step 1: Add a failing repository-contract test for idempotency and payment guards**

```ts
it('returns the original request-id order and rejects a reused provider transaction', async () => {
  const first = await repository.createOrder(fixture());
  await expect(repository.createOrder({ ...fixture('new-id'), requestId: first.requestId }))
    .resolves.toMatchObject({ id: first.id });
  expect(await repository.markPaid(first.id, 'provider-hash', fixedNow)).toBe(true);
  await expect(repository.markPaid(second.id, 'provider-hash', fixedNow)).rejects.toThrow();
});
```

- [ ] **Step 2: Run the affected repository tests to verify the async contract fails before implementation**

Run: `npm test -- server/orders/sqlite-order-repository.test.ts server/orders/supabase-order-repository.test.ts`

Expected: FAIL because the new async API and Supabase implementation do not exist.

- [ ] **Step 3: Add the Supabase dependency and SQL migration**

```json
"dependencies": {
  "@supabase/supabase-js": "^2.0.0"
}
```

```sql
create table public.orders (... request_id uuid not null unique, status text not null check (...));
create table public.order_lines (... order_id uuid not null references public.orders(id));
create table public.payment_attempts (... order_id uuid primary key references public.orders(id));
alter table public.orders enable row level security;
alter table public.order_lines enable row level security;
alter table public.payment_attempts enable row level security;
```

Implement `create_order` as one PL/pgSQL transaction: return the existing order for a duplicate `request_id`; otherwise insert the order, JSON line snapshots, and one payment attempt. Add unique indexes for request IDs and non-null provider transaction hashes. Use RPC functions for all transitions so a `paid` row cannot return to a non-paid status.

- [ ] **Step 4: Make the repository contract asynchronous and implement both adapters**

```ts
export interface OrderRepository {
  createOrder(input: CreateStoredOrderInput): Promise<StoredOrder>;
  findById(id: string): Promise<StoredOrder | null>;
  findByRequestId(requestId: string): Promise<StoredOrder | null>;
  findByProviderReference(providerReference: string): Promise<StoredOrder | null>;
  markPaid(id: string, transactionHash: string, updatedAt: string): Promise<boolean>;
  markFailed(id: string, updatedAt: string): Promise<boolean>;
  markExpired(id: string, updatedAt: string): Promise<boolean>;
  close(): Promise<void>;
}
```

Wrap the current SQLite implementation results in `Promise` values and preserve its transactions. In `SupabaseOrderRepository`, create a service-role Supabase client only in the constructor, call the migration RPCs, map database rows to the existing stored types, and throw generic repository errors without logging key material.

- [ ] **Step 5: Run repository tests and typecheck**

Run: `npm test -- server/orders/sqlite-order-repository.test.ts server/orders/supabase-order-repository.test.ts && npm run typecheck`

Expected: PASS; both implementations preserve idempotency, line snapshots, and state-transition guards.

- [ ] **Step 6: Commit the persistence boundary**

```bash
git add package.json package-lock.json supabase/migrations/202611110001_orders.sql server/orders
git commit -m "feat: add Supabase order repository"
```

### Task 2: Move trusted order creation and PayWay reconciliation onto the asynchronous boundary

**Files:**
- Modify: `server/orders/order-service.ts`
- Modify: `server/orders/order-service.test.ts`
- Modify: `server/payments/payway-gateway.ts`
- Modify: `server/payments/payway-gateway.test.ts`
- Modify: `server/http/app.ts`
- Modify: `server/http/app.test.ts`

**Interfaces:**
- Consumes: Promise-based `OrderRepository` from Task 1 and existing `PaymentGateway.checkPayment`.
- Produces: `OrderService.reconcilePayWay(providerReference: string): Promise<PublicOrder | null>`.
- Produces: `POST /api/payway/callback`, which accepts only a PayWay transaction reference and redirects to the existing public order route after server verification.

- [ ] **Step 1: Write failing service and HTTP tests for a callback that cannot trust browser data**

```ts
it('reconciles a PayWay callback through the provider check before marking paid', async () => {
  const response = await request(app).post('/api/payway/callback').type('form')
    .send({ tran_id: cardReference }).expect(303);
  expect(cardGateway.checkPayment).toHaveBeenCalledWith(expect.objectContaining({ providerReference: 'payway-' + cardReference }));
  expect((await repository.findByProviderReference('payway-' + cardReference))?.status).toBe('paid');
});
```

- [ ] **Step 2: Run those tests to verify the route and service method are absent**

Run: `npm test -- server/orders/order-service.test.ts server/http/app.test.ts server/payments/payway-gateway.test.ts`

Expected: FAIL because `reconcilePayWay` and `/api/payway/callback` do not exist.

- [ ] **Step 3: Await every repository operation in `OrderService` and add callback reconciliation**

```ts
async reconcilePayWay(providerReference: string): Promise<PublicOrder | null> {
  if (!/^payway-[a-f0-9]{20}$/.test(providerReference)) return null;
  const order = await this.repository.findByProviderReference(providerReference);
  if (!order) return null;
  return this.getOrder(order.id);
}
```

Keep `getOrder` as the single path that calls `PayWayGateway.checkPayment`, checks amount and currency, and invokes guarded repository transitions. Do not accept `payment_status`, `amount`, or success claims from the callback body.

- [ ] **Step 4: Add the callback route before the 404 handler**

```ts
app.post('/api/payway/callback', express.urlencoded({ extended: false }), async (req, res) => {
  const tranId = typeof req.body.tran_id === 'string' ? req.body.tran_id : '';
  const order = await service.reconcilePayWay('payway-' + tranId);
  if (!order) { notFound(res); return; }
  res.redirect(303, '/order/' + encodeURIComponent(order.id));
});
```

Limit the accepted body size, keep CORS restrictions, and preserve sanitized error responses. Point `PayWayGateway.checkout` return and cancel URLs at the deployed order route and register the callback URL during provider setup.

- [ ] **Step 5: Run payment, service, and HTTP tests**

Run: `npm test -- server/orders/order-service.test.ts server/payments/payway-gateway.test.ts server/http/app.test.ts`

Expected: PASS; only verified provider checks transition a card order to paid.

- [ ] **Step 6: Commit the trusted payment flow**

```bash
git add server/orders/order-service.ts server/orders/order-service.test.ts server/payments/payway-gateway.ts server/payments/payway-gateway.test.ts server/http/app.ts server/http/app.test.ts
git commit -m "feat: reconcile PayWay callbacks server-side"
```

### Task 3: Make API startup Vercel-compatible and document production configuration

**Files:**
- Create: `server/bootstrap.ts`
- Create: `api/[...path].ts`
- Create: `vercel.json`
- Modify: `server/index.ts`
- Modify: `server/config.ts`
- Modify: `server/config.test.ts`
- Modify: `server/index.test.ts`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Consumes: `SupabaseOrderRepository`, existing payment gateways, and `createApp`.
- Produces: `buildApp(env?: NodeJS.ProcessEnv): Promise<express.Express>` and a default Vercel request handler.
- Produces: `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` validation, with no secret retained in `ServerConfig` or API responses.

- [ ] **Step 1: Write failing bootstrap/configuration tests**

```ts
it('rejects incomplete Supabase configuration outside the local SQLite development adapter', async () => {
  expect(() => loadConfig({ STORAGE_MODE: 'supabase', SUPABASE_URL: 'https://project.supabase.co' }))
    .toThrow('SUPABASE_SERVICE_ROLE_KEY');
});
```

```ts
it('exports a handler without binding a listener', async () => {
  const app = await buildApp(testEnvironment);
  await request(app).get('/api/health').expect(200);
});
```

- [ ] **Step 2: Run the startup tests to verify the factory does not yet exist**

Run: `npm test -- server/config.test.ts server/index.test.ts`

Expected: FAIL because `buildApp` and Supabase configuration are absent.

- [ ] **Step 3: Separate bootstrap from local process lifecycle**

```ts
export async function buildApp(env = process.env) {
  const config = loadConfig(env);
  const repository = config.storageMode === 'supabase'
    ? new SupabaseOrderRepository(config.supabase)
    : new SqliteOrderRepository(config.sqlitePath);
  return createApp({ service: new OrderService(repository, gateway, undefined, config.pricing, config.merchantName, cardGateway), config });
}
```

Keep `server/index.ts` responsible only for loading `.env.local`, invoking `buildApp`, binding `127.0.0.1` for local development, and closing the local SQLite adapter during shutdown. Export the built app from `api/[...path].ts` without calling `listen`.

- [ ] **Step 4: Add Vercel routing and configuration documentation**

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/[...path]" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Document the Vercel Preview and Production variable names, set `APP_ORIGIN` to the deployed HTTPS origin, and state that production uses `STORAGE_MODE=supabase`. Keep `.env.example` values blank for Supabase and provider secrets.

- [ ] **Step 5: Run API startup tests, typecheck, and production build**

Run: `npm test -- server/config.test.ts server/index.test.ts && npm run typecheck && npm run build`

Expected: PASS; local development retains its listener while the Vercel entry imports without a port bind.

- [ ] **Step 6: Commit the deployment boundary**

```bash
git add api server/bootstrap.ts server/index.ts server/config.ts server/config.test.ts server/index.test.ts vercel.json .env.example README.md
git commit -m "feat: prepare API for Vercel and Supabase"
```

### Task 4: Add the in-place Payment step and preserve hosted card checkout

**Files:**
- Modify: `src/app/App.tsx`
- Modify: `src/pages/CheckoutPage.tsx`
- Modify: `src/pages/CheckoutPage.test.tsx`
- Modify: `src/pages/OrderPage.tsx`
- Modify: `src/pages/OrderPage.test.tsx`
- Modify: `src/styles/commerce.css`

**Interfaces:**
- Consumes: `getOrder(orderId, signal)` from `src/lib/api.ts` and `PublicOrder`.
- Produces: `CheckoutPage` states `delivery` and `payment`; entering Payment selects KHQR by default, creates the pending order, and shows the QR panel in place.

- [ ] **Step 1: Write failing route and checkout tests**

```tsx
it('routes a created KHQR order to the dedicated QR screen and clears the cart once', async () => {
  seedCart(); render(<App initialEntries={['/checkout']} />); await fillAndSubmitKhqr();
  await waitFor(() => expect(window.location.pathname).toBe('/payment/khqr/' + order.id));
  expect(screen.getByRole('img', { name: 'Bakong KHQR payment code' })).toBeVisible();
  expect(screen.queryByText('Server snapshot tee')).not.toBeInTheDocument();
});
```

```tsx
it('keeps card checkout as a hosted PayWay form and never renders card-number inputs', async () => {
  showCardOrder();
  expect(screen.getByRole('button', { name: /pay securely/i })).toBeVisible();
  expect(screen.queryByLabelText(/card number|cvc|expiry/i)).toBeNull();
});
```

- [ ] **Step 2: Run the focused UI tests to confirm the dedicated route is absent**

Run: `npm test -- src/pages/CheckoutPage.test.tsx src/pages/OrderPage.test.tsx src/pages/KhqrPaymentPage.test.tsx`

Expected: FAIL because the in-place Payment state and KHQR panel do not exist.

- [ ] **Step 3: Implement the KHQR page and route**

```tsx
<Route path="/payment/khqr/:orderId" element={<KhqrPaymentPage />} />
```

Use the existing abortable polling and countdown behavior from `OrderPage`, but render the QR, trusted amount, expiry, and live status inside the Payment state. Set QR dimensions with `width: min(72vw, 300px)` and `height: auto`; preserve quiet space and an informative image alternative. Navigate to `/order/:orderId` with `replace` only after the API returns a paid or terminal order.

- [ ] **Step 4: Route by selected method without changing card security**

```ts
setStep('payment');
setOrder(order);
```

Keep current contact/delivery fields independent of the selection. Rename customer-facing card copy to “Secure card checkout” and ABA PayWay only where processor disclosure is required. Preserve the signed hidden-field form on `OrderPage`; do not add client-side card fields.

- [ ] **Step 5: Run the focused frontend tests and typecheck**

Run: `npm test -- src/pages/CheckoutPage.test.tsx src/pages/OrderPage.test.tsx src/pages/KhqrPaymentPage.test.tsx && npm run typecheck`

Expected: PASS; KHQR routing, centered QR bounds, terminal/retry states, and PayWay card redirection are covered.

- [ ] **Step 6: Commit the checkout split**

```bash
git add src/app/App.tsx src/pages/CheckoutPage.tsx src/pages/CheckoutPage.test.tsx src/pages/OrderPage.tsx src/pages/OrderPage.test.tsx src/styles/commerce.css
git commit -m "feat: add in-place KHQR payment step"
```

### Task 5: Correct the hero title position without changing the logo scale

**Files:**
- Modify: `src/components/showcase/HeroSection.tsx`
- Modify: `src/components/showcase/HeroSection.test.tsx`
- Modify: `src/styles/showcase.css`

**Interfaces:**
- Consumes: existing `.hero-est`, `.hero-content h1`, and `.hero-scroll` elements.
- Produces: a title layout class that positions `SUMMER CLASSICS` between the establishment line and scroll cue at both responsive breakpoints.

- [ ] **Step 1: Add a failing semantic markup test for independently positionable hero layers**

```tsx
it('keeps the establishment line, title, and scroll cue as separate hero layers', () => {
  render(<HeroSection />);
  expect(screen.getByText(/est\. 1980/i)).toHaveClass('hero-est');
  expect(screen.getByRole('heading', { name: 'Summer Classics' })).toHaveClass('hero-title');
  expect(screen.getByRole('link', { name: /scroll/i })).toHaveClass('hero-scroll');
});
```

- [ ] **Step 2: Run the hero test to verify `hero-title` is absent**

Run: `npm test -- src/components/showcase/HeroSection.test.tsx`

Expected: FAIL because the title has no independent layout class.

- [ ] **Step 3: Add the title class and position it between its neighbors**

```tsx
<h1 className="hero-title" aria-label="Summer Classics">...</h1>
```

Replace the shared lower absolute rule with separate anchors: retain `hero-scroll` at the bottom, set `.hero-title` above it with a responsive `bottom` clamp, and retain the existing `.hero-logo` dimensions and `scale: 1.4`. Set a mobile title bottom value that preserves a gap above the scroll cue instead of relying on overlap.

- [ ] **Step 4: Run the hero test, production build, and visual checks**

Run: `npm test -- src/components/showcase/HeroSection.test.tsx && npm run build`

Expected: PASS. Inspect desktop (1440px wide) and mobile (390px wide) renderings to confirm the title is visually between the EST line and `SCROLL`, without changing painted logo size or cropping title text.

- [ ] **Step 5: Commit the hero correction**

```bash
git add src/components/showcase/HeroSection.tsx src/components/showcase/HeroSection.test.tsx src/styles/showcase.css
git commit -m "fix: position hero title above scroll cue"
```

### Task 6: Apply the migration and verify a Vercel Preview without a live charge

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-11-11-vercel-supabase-khqr-payway-design.md`

**Interfaces:**
- Consumes: the SQL migration from Task 1, Vercel configuration from Task 3, and deployed API routes.
- Produces: documented, repeatable staging-to-production activation steps.

- [ ] **Step 1: Record the deployment checklist as executable commands and checks**

```text
1. Apply supabase/migrations/202611110001_orders.sql in the empty Supabase project.
2. Set Vercel Preview variables with sandbox PayWay credentials and PAYMENT_MODE=mock.
3. Deploy Preview and request GET /api/health through the Preview URL.
4. Submit a mock KHQR checkout; verify the order persists in Supabase and the QR route loads after refresh.
5. Set production-only provider credentials and APP_ORIGIN after merchant approval.
```

- [ ] **Step 2: Verify local automated checks before deployment**

Run: `npm test && npm run typecheck && npm run build && git diff --check`

Expected: PASS with no secrets in output or tracked files.

- [ ] **Step 3: Deploy a Vercel Preview and test non-financial paths**

Run: `npx vercel --yes`

Expected: deployment URL is returned. Verify `/api/health`, cart-to-KHQR routing, direct QR-route refresh, and a PayWay sandbox card redirect. Do not submit a real card charge.

- [ ] **Step 4: Configure production only after merchant approval**

Set Production environment variables in Vercel, set PayWay's callback/return URLs to the production HTTPS domain, deploy production, and use the documented provider dashboard to verify the callback. The user manually confirms any live bank or card payment.

- [ ] **Step 5: Commit the final operational documentation**

```bash
git add README.md docs/superpowers/specs/2026-11-11-vercel-supabase-khqr-payway-design.md
git commit -m "docs: add production checkout rollout steps"
```

## Plan self-review

- Supabase schema, atomic persistence, and service-only access are covered by Tasks 1 and 3.
- PayWay callback verification and hosted card flow are covered by Task 2 and Task 4.
- In-place KHQR creation, bounded QR presentation, and payment polling are covered by Task 4.
- Hero positioning is isolated in Task 5 and preserves the previous logo-only scale constraint.
- Vercel configuration, Preview deployment, and production safeguards are covered by Tasks 3 and 6.
- The plan contains no Stripe integration, card-data handling, local-order migration, or committed secrets.
