# سرمایه من

نسخه وب: [https://sarmayeman.farshadfard.com](https://sarmayeman.farshadfard.com)

Persian, mobile-first, local-first PWA for recording personal assets and tracking current value and profit/loss in تومان.

## Features

- Record gold, silver, Iranian market coins, paper currencies, and crypto assets.
- Add either a quick current holding or detailed buy/sell transactions.
- See portfolio value, current value per asset, purchase value, profit amount, and profit percentage.
- Fetch and store 90 days of daily prices from TGJU through the app server endpoint.
- Edit fetched prices, restore TGJU values, and add manual prices only for missing days.
- Auto-update prices on app launch with an in-app loading banner.
- Export and import a JSON backup of local data.
- First-launch install guide, onboarding, RTL Persian UI, dark mode, Persian date display, and PWA install support.
- Optional fully bundled Android app build through Capacitor.

## Privacy Model

User portfolio data is stored locally on the device in IndexedDB. The app does not send asset records, transactions, backups, or settings to any server.

The only intentional network price source is TGJU, called through the configured app API endpoint. If TGJU cannot be reached, the app keeps previous daily prices and retries only missing days later.

## Technical Details

- Framework: React + TypeScript on Vinext/Vite.
- UI: Tailwind CSS with local shadcn-style components and Radix primitives where needed.
- Runtime target: Vinext production server behind nginx, plus a bundled Capacitor Android shell.
- Price API: standalone Node.js TGJU service, typically served behind a separate API domain.
- Persistence: IndexedDB stores `assets`, `transactions`, `dailyPrices`, price edits, missing-day statuses, and `settings`.
- PWA: local manifest, local SVG icons, service worker, offline app shell.
- Android: Vite builds a static web bundle into `dist-android`, then Capacitor packages it into a native APK.
- Assets: optimized onboarding WebP images and SVG icons are bundled locally.
- Fonts/styles/scripts: app code, Estedad font files, and static assets are bundled locally.
- Tests: Node test runner covers portfolio calculations, TGJU parsing, rendered shell/metadata, and static resource checks.

## Requirements

- Node.js `>=22.13.0`
- npm

## Local Development

```bash
npm install
npm run dev
```

Useful checks:

```bash
npm run lint
npm test
npm run build
```

## Android Release

Android releases are built only from the manual GitHub Actions workflow named `Android Release`. The workflow is guarded so only the repository owner account can run the release job.

Required repository secrets:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Run the workflow manually with a semantic version such as `1.0.0`. It builds the static Android web bundle, syncs Capacitor, signs the APK, and attaches the APK plus a SHA-256 checksum to a GitHub Release.

## Data Backup

The app includes JSON export/import from the settings screen. Backups are plain JSON files intended for personal migration between devices. Treat exported backups as private financial data.

## License

BSD 3-Clause. You may use, modify, and fork this project freely. If you redistribute or publish a fork, keep the license/copyright notice and mention this project as the original source.
