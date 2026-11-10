# Stussy Collection Showcase

An editorial React storefront with a server-backed Bakong KHQR checkout. Catalog prices, stock and delivery are illustrative.

## Local mock checkout

Use Node.js 24 (the API uses built-in `node:sqlite`) and npm.

1. Copy `.env.example` to `.env.local` (PowerShell: `Copy-Item .env.example .env.local`).
2. Run `npm install`.
3. Run `npm run dev`.
4. Open the printed Vite URL, normally `http://localhost:5173`, and complete product variant → cart → checkout → simulated KHQR.
5. Enter fictional contact/delivery details, choose **Continue to KHQR**, and use **Simulate successful payment**. Refresh the order URL to retrieve the paid order from the API.

Mock mode never contacts Bakong and never moves money. Do not add a real token to any
`VITE_*` variable. Server-only credentials belong in an ignored environment file.
The generated QR encodes a mock payload; it cannot initiate a real Bakong payment.

The API binds to `127.0.0.1:8787`. Vite proxies `/api` to it. Keep `APP_ORIGIN` equal to the exact browser origin (including hostname and port); `localhost` and `127.0.0.1` differ. If 5173 is occupied, set `APP_ORIGIN=http://localhost:5174` in `.env.local` and run `npm run dev:api` and `npm run dev:web -- --port 5174` in separate terminals. `npm run start:api` starts the API without file watching. Changing `API_PORT` also requires changing the development proxy target in `vite.config.ts`.

## Checks

- `npm test` runs the complete frontend, pricing, SQLite, gateway, API and runtime test suite.
- `npm run typecheck` checks the frontend, server, shared contracts and configuration with TypeScript.
- `npm run build` type-checks everything and builds the frontend into `dist/`. It does not deploy or start the API; Vite preview alone does not proxy checkout requests.
- `npm run assets:verify` verifies the local asset files.
- With both local services running, `node scripts/verify-visual-regressions.mjs` exercises the showcase and mock checkout at 360, 390, 768, 1024 and 1440 pixels. It creates fictional orders and marks them paid. Install Playwright separately for QA and install its Chromium browser if unavailable; the app has no Playwright runtime dependency. `PLAYWRIGHT_MODULE` can point to an existing Playwright module file URL. `QA_URL` overrides the default `http://localhost:5173` and must match `APP_ORIGIN`. Optional `QA_SCREENSHOT_DIR` retains checkout, pending and paid screenshots.

## Local order data and privacy

`SQLITE_PATH=./data/store.sqlite` stores orders and immutable price snapshots in the ignored `data/` directory, including SQLite WAL/SHM files. The database contains the submitted customer name, email, phone and delivery address; use fictional details for local testing. Public order responses omit these details. Payment state is loaded from the server database rather than browser order storage. Cart and wishlist still use browser local storage. Treat an order URL as a private lookup link.

Keep `data/`, `.env` and `.env.local` out of Git. Stop the API before removing a local database to reset mock orders. The mock provider's pending simulation references live in memory, while completed paid state persists in SQLite. No email, carrier, live inventory or real payment is connected.

## Bakong SIT and production

Keep `PAYMENT_MODE=mock` for local development. SIT and production fail closed unless every server-only Bakong variable from `.env.example` is set. Never place the API token in a `VITE_*` variable, browser storage, source file or chat.

The temporary live-payment test policy charges USD $0.01 for each item unit and ignores shipping. For example, three units total USD $0.03. The server generates a dynamic KHQR and marks an order paid only after the provider response matches the stored recipient, USD amount, currency and unique transaction hash.

Real acceptance is manual and user-controlled: verify the displayed merchant and amount before scanning, then confirm the payment in the banking app. Automated checks never scan a QR or authorize a transfer. Production additionally requires bank commercial approval, production credentials and limits, HTTPS, durable storage/backups, monitoring and reconciliation. SQLite requires a single durable Node host or replacement with a shared production repository before multiple instances.

See [the checkout design](docs/superpowers/specs/2026-11-09-bakong-khqr-checkout-design.md) and [verification evidence](docs/verification/2026-11-07-stussy-store-verification.md) for scope and limits.
