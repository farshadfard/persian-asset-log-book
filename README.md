# سرمایه من

Persian, mobile-first, local-first PWA for recording personal assets and tracking current value and profit/loss in تومان.

## Features

- Record gold, silver, Iranian market coins, paper currencies, and crypto assets.
- Add either a quick current holding or detailed buy/sell transactions.
- See portfolio value, current value per asset, purchase value, profit amount, and profit percentage.
- Fetch live prices from TGJU through the app server endpoint.
- Use manual prices when live prices are unavailable or intentionally overridden.
- Clear manual prices when online price refresh succeeds.
- Auto-update prices on app launch with an in-app loading banner.
- Export and import a JSON backup of local data.
- First-launch onboarding, RTL Persian UI, dark mode, Persian date display, and PWA install support.

## Privacy Model

User portfolio data is stored locally on the device in IndexedDB. The app does not send asset records, transactions, backups, or settings to any server.

The only intentional network price source is TGJU, called through `/api/prices`. If TGJU cannot be reached, the app falls back to cached or manual prices.

## Technical Details

- Framework: React + TypeScript on Vinext/Vite.
- UI: Tailwind CSS with local shadcn-style components and Radix primitives where needed.
- Runtime target: Cloudflare Worker.
- Persistence: IndexedDB stores `assets`, `transactions`, `priceCache`, `manualPrices`, and `settings`.
- PWA: local manifest, local SVG icons, service worker, offline app shell.
- Assets: onboarding PNGs and SVG icons are bundled locally.
- Fonts/styles/scripts: app code and static assets are bundled locally, except the configured Estedad Google Fonts stylesheet.
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

## Data Backup

The app includes JSON export/import from the settings screen. Backups are plain JSON files intended for personal migration between devices. Treat exported backups as private financial data.

## License

BSD 3-Clause. You may use, modify, and fork this project freely. If you redistribute or publish a fork, keep the license/copyright notice and mention this project as the original source.
