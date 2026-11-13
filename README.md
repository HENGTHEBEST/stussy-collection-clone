# Stussy Collection Showcase

An editorial React storefront with a server-backed Bakong KHQR checkout. Catalog prices, stock and delivery are illustrative.

## Local mock checkout

Use Node.js 24 and npm. Every running API uses Supabase, including local mock mode. SQLite remains an isolated test adapter.

1. If `.env.local` does not exist, copy `.env.example` to `.env.local` (PowerShell: `Copy-Item .env.example .env.local`). Set `STORAGE_MODE=supabase`, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for a development Supabase project. For a new database, apply `supabase/migrations/202611110001_orders.sql` once before checkout; do not reapply an already applied migration.
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the printed Vite URL, normally `http://localhost:5173`, and complete product variant → cart → checkout → simulated KHQR.
5. Enter fictional contact details and street address, but use a real city, region (if entered), and country. Choose **Continue to payment**. KHQR is selected by default and the pending QR appears inside `/checkout`. Refresh the same tab to restore the pending order from the API. For local mock success testing, open `/order/<orderId>` using the displayed order ID and choose **Simulate successful payment**; refresh that URL to retrieve the persisted paid state.

Mock KHQR never contacts Bakong and never moves money. PayWay follows its separate environment setting. Do not add a real token to any
`VITE_*` variable. Server-only credentials belong in an ignored environment file.
The generated QR encodes a mock payload; it cannot initiate a real Bakong payment.

Delivery city, region, and country names are checked against the offline [Countries States Cities dataset](https://github.com/dr5hn/countrystatecity-npm) (ODbL 1.0; upstream source and licence notices are included in the npm package). This checks known place names and their relationship, not the street address or whether a place is currently deliverable.

The API binds to `127.0.0.1:8787`. Vite proxies `/api` to it. Keep `APP_ORIGIN` equal to the exact browser origin (including hostname and port); `localhost` and `127.0.0.1` differ. If 5173 is occupied, set `APP_ORIGIN=http://localhost:5174` in `.env.local` and run `npm run dev:api` and `npm run dev:web -- --port 5174` in separate terminals. `npm run start:api` starts the API without file watching. Changing `API_PORT` also requires changing the development proxy target in `vite.config.ts`.

## ABA PayWay card checkout

Add the supplied Merchant ID as `PAYWAY_MERCHANT_ID` and the supplied Public Key (HMAC signing key) as `PAYWAY_API_KEY` to the ignored `.env.local`. Do not use the RSA Public Key for `PAYWAY_API_KEY`; the RSA key pair is not used by this hosted checkout flow. Keep `PAYWAY_ENVIRONMENT=sandbox` for testing, then restart the API. The card option stays unavailable until both values exist. Card details are entered on PayWay's hosted page; this shop only stores the order and checks PayWay's transaction result. The sandbox does not charge a live card. Configure the checkout return domain in your PayWay merchant profile before testing a hosted return, and use production credentials only after sandbox payment and status checks succeed.

## Checks

- `npm test` runs the complete frontend, pricing, repository, gateway, API and runtime test suite. Startup tests use synthetic Supabase settings and health requests; they do not write production orders.
- `npm run typecheck` checks the frontend, server, shared contracts and configuration with TypeScript.
- `npm run build` type-checks everything and builds the frontend into `dist/`. It does not deploy or start the API; Vite preview alone does not proxy checkout requests.
- `npm run assets:verify` verifies the local asset files.
- With both local services running against a development Supabase project, `node scripts/verify-visual-regressions.mjs` exercises the showcase and mock checkout at 360, 390, 768, 1024 and 1440 pixels. It writes fictional orders to the configured database and marks them paid; do not point this check at production. Install Playwright separately for QA and install its Chromium browser if unavailable; the app has no Playwright runtime dependency. `PLAYWRIGHT_MODULE` can point to an existing Playwright module file URL. `QA_URL` overrides the default `http://localhost:5173` and must match `APP_ORIGIN`. Optional `QA_SCREENSHOT_DIR` retains checkout, pending and paid screenshots.

## Order data and privacy

Supabase stores orders and immutable price snapshots. The database contains the submitted customer name, email, phone and delivery address; use fictional personal and street details with real city, region, and country names in a separate development database for local testing. Public order responses omit the customer and address records, but pending card orders include customer name, email and phone in the signed hosted-checkout fields needed by PayWay. Only the API uses the service-role key; the browser never accesses the order tables directly. Payment state is loaded from the server database rather than browser order storage. Cart and wishlist still use browser local storage. Treat an order URL as a private lookup link.

Keep `data/`, `.env` and `.env.local` out of Git. Existing local SQLite orders are not migrated or read by the runtime. The mock provider's pending simulation references live in memory, while completed paid state persists in Supabase. Use the local API for repeatable mock simulation; serverless instances do not share the mock provider's memory. No email, carrier or live inventory is connected. Mock KHQR is non-payable; card payments use the configured PayWay environment.

## Vercel configuration

`vercel.json` builds the Vite frontend into `dist`, routes `/api/*` to `api/[...path].ts`, and sends frontend routes to `index.html`. The API entry exports the Express app without starting a listener. `server/index.ts` alone loads `.env.local`, listens on localhost and closes the local server on shutdown. This follows Vercel's [Node function](https://vercel.com/docs/functions/runtimes/node-js) and [rewrite](https://vercel.com/docs/routing/rewrites) configuration.

Choose Node.js **24.x** in Vercel's project settings. Configure Preview and Production environment variables separately; use a development Supabase project for Preview. Set `APP_ORIGIN` to each deployment's exact HTTPS browser origin, with no trailing slash or path. A stable preview domain makes this value predictable. Vercel does not receive the ignored local environment file.

| Variables | Preview | Production |
| --- | --- | --- |
| `STORAGE_MODE` | `supabase` | `supabase` |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Development project, server-only | Production project, server-only |
| `APP_ORIGIN` | Exact preview HTTPS origin | Exact production HTTPS origin |
| `PAYMENT_MODE` | `mock` or `sit` with approved test credentials | `production` after provider approval |
| `MERCHANT_NAME`, `MERCHANT_CITY`, `ORDER_CURRENCY` | Test merchant details; `USD` | Approved merchant details; `USD` |
| `BAKONG_API_BASE_URL`, `BAKONG_API_TOKEN`, `BAKONG_ACCOUNT_ID`, `BAKONG_MERCHANT_ID`, `BAKONG_ACQUIRING_BANK` | Required for `sit`; use test values | Required for real KHQR; server-only |
| `PAYWAY_ENVIRONMENT`, `PAYWAY_MERCHANT_ID`, `PAYWAY_API_KEY` | `sandbox` and sandbox credentials if cards are enabled | `production` and approved production credentials if cards are enabled |
| `TEST_UNIT_PRICE_MINOR`, `TEST_FREE_SHIPPING` | `1` and `true` only for intentional one-cent testing | Remove the price override and use `false` for normal pricing |

Keep Supabase and payment secrets out of `VITE_*`, source files and browser storage. An incomplete configuration prevents API startup. `/api/health` confirms application initialization only; it does not check database connectivity, migrations or provider approval. Before a future deployment, prepare the target database and provider callback/return domain (`APP_ORIGIN`), then verify those separately. A successful local build is not a hosted deployment.

## Staging-to-production checklist

The SQL migration was reported manually applied for this rollout. Its remote state has not been checked by local tests. Do not rerun it on that database. For a new, empty development or production project, apply `supabase/migrations/202611110001_orders.sql` once in the Supabase SQL editor and record the project and application date. Before checkout, use the dashboard to confirm `orders`, `order_lines`, `payment_attempts`, enabled RLS with anonymous/authenticated table access revoked, and the migration's service-only RPC functions. Runtime storage is always Supabase; SQLite is test-only and existing local orders are not imported.

Run local checks first, stopping on any failure. These PowerShell commands do not deploy or create remote orders:

```powershell
npm test
if ($LASTEXITCODE -ne 0) { throw 'Tests failed' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw 'Typecheck failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
git -c safe.directory='D:/Personal Project/Stussy Collection Clone' diff --check
if ($LASTEXITCODE -ne 0) { throw 'Diff check failed' }
```

### Preview: user-run deployment and non-financial checks

1. In the Vercel dashboard, select the intended project, Node.js 24.x, and a stable Preview HTTPS domain. Set the **Preview** variables from the table above, starting with `PAYMENT_MODE=mock`, the development Supabase project, `PAYWAY_ENVIRONMENT=sandbox`, sandbox-only PayWay credentials if testing cards, and `APP_ORIGIN` equal to the exact stable Preview origin. Credentials require Supabase project access and an approved PayWay sandbox account. The two payment settings are independent: `PAYMENT_MODE=mock` disables live Bakong only; PayWay uses `PAYWAY_ENVIRONMENT`. Leave card credentials unset to disable card payments.
2. Run these commands yourself from this repository after installing/authenticating the Vercel CLI when prompted. Confirm the linked team/project before deployment. `npx vercel --yes` publishes a Preview and may use the existing project link:

   ```powershell
   npx vercel link
   npx vercel --yes
   $previewOrigin = 'https://YOUR-STABLE-PREVIEW-DOMAIN'
   Invoke-RestMethod -Uri "$previewOrigin/api/health"
   Invoke-RestMethod -Uri "$previewOrigin/api/checkout-pricing" -Headers @{ Origin = $previewOrigin }
   ```

   Expect health `{ "ready": true, "paymentMode": "mock" }` and a successful pricing response. Browse the exact domain configured in `APP_ORIGIN`; a different deployment URL will fail browser-origin checks. After any environment change, redeploy and repeat these checks. Deployment protection may require an authenticated browser to reach Preview; do not disable it just to run a probe. Health alone does not establish database or provider connectivity.
3. Using fictional personal and street details with real city, region, and country names, add a valid variant to the cart and continue through Contact & delivery to Payment. This step **writes test orders to the development Supabase database**. Confirm KHQR remains in `/checkout`, the QR is bounded and uncropped on desktop/mobile, the amount/expiry match, and **I've Paid** only refreshes status. In the Supabase dashboard, confirm the order, line snapshots and pending payment attempt were persisted. Refresh `/checkout` in the same tab before expiry: the API must restore the same pending order/QR without creating another order. Recovery uses tab session storage containing order IDs only; a fresh tab or blocked storage may need `/order/<orderId>`. Also load and refresh that direct order URL to check SPA fallback. There is no `/payment/khqr/:orderId` route.
4. If sandbox card testing is enabled, configure PayWay's merchant profile for the Preview domain: server callback `https://YOUR-STABLE-PREVIEW-DOMAIN/api/payway/callback` (POST); success/cancel returns use `https://YOUR-STABLE-PREVIEW-DOMAIN/order/<orderId>`. The application signs those order-specific return URLs; configure their domain with PayWay. The callback must be reachable by PayWay despite any deployment protection. Select Credit / debit card and **Pay securely with ABA PayWay**, verify the destination is `checkout-sandbox.payway.com.kh`, then stop before authorizing a payment. This checks the hosted handoff only. Sandbox transaction/callback acceptance needs provider-issued test credentials/data and a separate user-run test; no real card is needed.
5. Record the Preview URL, deployment ID, environment scope, check date, observed statuses and outstanding checks without copying secrets or customer details. A QR, hosted card page, return redirect or callback request is not proof of payment. The callback's `tran_id` only triggers a signed server-to-server PayWay status query; matching reference, amount, currency and approved status are required before payment is persisted as paid. Mock success simulation is most repeatable on the local API; serverless instances do not share its in-memory provider state.

### Production: user-run activation after approval

1. Obtain merchant/bank approval and production provider credentials. Prepare the production Supabase database and backups separately from Preview; confirm the migration is applied once. Keep production secrets in Vercel's **Production** scope only. Set production `APP_ORIGIN`, `PAYMENT_MODE=production`, the approved Bakong settings, and `PAYWAY_ENVIRONMENT=production` plus approved card credentials if cards are enabled. Remove `TEST_UNIT_PRICE_MINOR` entirely (an empty string is invalid), set `TEST_FREE_SHIPPING=false`, and verify normal catalog totals; the example file enables one-cent testing and must not be copied blindly into production.
2. In the PayWay merchant dashboard, configure the production HTTPS domain and public POST callback `/api/payway/callback`; allow order-specific success/cancel returns at `/order/<orderId>`. Confirm the production callback is publicly reachable and use the provider's dashboard/delivery records and server-verified transaction result to check acceptance. A fabricated callback does not validate a payment.
3. After reviewing the linked Vercel project and Production variable scope, publish manually:

   ```powershell
   npx vercel --prod
   $productionOrigin = 'https://YOUR-PRODUCTION-DOMAIN'
   Invoke-RestMethod -Uri "$productionOrigin/api/health"
   Invoke-RestMethod -Uri "$productionOrigin/api/checkout-pricing" -Headers @{ Origin = $productionOrigin }
   ```

4. Expect production health mode and intended pricing; verify storefront assets and direct SPA URLs. A user performs any live checkout, bank transfer or card authorization, checks the displayed merchant/amount, and reconciles the provider dashboard with the server's stored status. Keep merchant approval, actual callback delivery and live payment acceptance marked incomplete until directly observed. If acceptance fails, stop taking new payments using Vercel's deployment controls, investigate, and reconcile pending/paid orders before resuming; do not delete order records.

Local tests/builds do not prove a deployed Preview, applied remote schema, provider dashboard configuration, callback delivery or live payment acceptance. Those checks require the account owner and are separate from local completion.

## Bakong SIT and production

Keep `PAYMENT_MODE=mock` for local development. SIT and production fail closed unless every server-only Bakong variable from `.env.example` is set. Never place the API token in a `VITE_*` variable, browser storage, source file or chat.

For intentional payment testing only, setting `TEST_UNIT_PRICE_MINOR=1` and `TEST_FREE_SHIPPING=true` charges USD $0.01 per item unit with no shipping charge; three units total USD $0.03. For normal Production pricing, remove the unit-price override and set `TEST_FREE_SHIPPING=false`. The server generates a dynamic KHQR and marks an order paid only after the provider response matches the stored recipient, USD amount, currency and unique transaction hash.

Real acceptance is manual and user-controlled: verify the displayed merchant and amount before scanning, then confirm the payment in the banking app. Automated checks never scan a QR or authorize a transfer. Production additionally requires bank commercial approval, production credentials and limits, HTTPS, Supabase backups, monitoring and reconciliation.

See [the checkout design](docs/superpowers/specs/2026-11-09-bakong-khqr-checkout-design.md) and [verification evidence](docs/verification/2026-11-07-stussy-store-verification.md) for scope and limits.
