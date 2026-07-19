# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`sarmaye-man` ("سرمایه من") is a single product: a Persian, RTL, mobile-first, **local-first PWA** for tracking personal assets (gold, silver, coins, currencies, crypto) and profit/loss in تومان. All user data lives in the browser's **IndexedDB** — there is no backend for user data.

### Services / commands
Standard commands are already documented in `README.md`, `CONTRIBUTING.md`, and `package.json` scripts. Node `>=22.13.0` is required (the VM already has a compatible Node).

- Dev server: `npm run dev` (vinext/Vite) → serves on `http://localhost:3000/`.
- Lint: `npm run lint`. Tests: `npm test`. Build: `npm run build`.
- The only strictly-required service to exercise the product is the web dev server; the app is fully functional offline against IndexedDB.

### Non-obvious caveats
- `npm test` runs `npm run build` first, then the Node test runner — it is not just unit tests.
- **Live prices do not work in local dev.** The client POSTs to `/api/prices/sync`, but the dev server has no route handler and `vite.config.ts` defines no proxy for it. So price sync fails silently and the app degrades gracefully (this is by design). As a result, the dashboard "current value" / total can show `۰ تومان` when no daily prices are stored — this is expected in dev, not a bug. The registration/purchase value of each asset is still computed and stored correctly. To exercise live prices end-to-end you must run the standalone TGJU service (`npm run build:tgju-service` then `node build/tgju-service.mjs`, default `127.0.0.1:5780`, path `/sarmaye-man-api/prices/sync`), wire a proxy from `/api/prices/sync` to it, and have outbound access to `tgju.org`.
- Add-asset form gotcha: the "مقدار" (amount) and "قیمت واحد" (unit price) inputs display **grey placeholder** Persian digits that are NOT real values. You must type real values into BOTH fields or saving fails with "مقدار و قیمت باید بزرگ‌تر از صفر باشد" (amount and price must be greater than zero).
- First launch shows a 4-step onboarding flow; advance with the bottom-center buttons ("بعدا" → "بعدی" → "بهی" → "شروع استفاده") to reach the main app.
- The Android/Capacitor build (`build:android-web`, `cap sync android`, Gradle) is optional and only used by the manual, owner-gated `Android Release` GitHub Action (needs JDK 21 + Android SDK 36). It is not needed for web development.
