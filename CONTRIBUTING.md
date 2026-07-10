# Contributing

Thanks for considering a contribution to سرمایه من.

## Development Setup

1. Install Node.js `>=22.13.0`.
2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

## Checks

Run these before opening a pull request:

```bash
npm run lint
npm test
```

## Contribution Guidelines

- Keep the user interface Persian and RTL-first.
- Keep portfolio data local-first; do not add telemetry or external data storage.
- Do not add remote static assets, analytics, CDN scripts, or third-party font packages without a clear reason.
- Keep TGJU as the only live market-price source unless a change is discussed first.
- Include focused tests for portfolio calculations, parsing, storage, or public app shell behavior when those areas change.

## Attribution

Forks and redistributed versions must keep the BSD 3-Clause license notice and mention this repository as the original source.
