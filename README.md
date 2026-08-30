# ZKAS Stream v0.7.0

Independent, privacy-aware ZKas public-network intelligence frontend.

## Product focus

ZKAS Stream is not intended to duplicate the official ZKas explorer. Its main focus is merged-mining attribution, mining-producer and hashrate distribution, solo-mining intelligence, network intelligence, historical observer data, supply/privacy intelligence, and event intelligence.

The site is **public-network only**. It does not connect to or display a user's home node, mining bridge, miners, worker names, wallet balances, local RPC endpoints, LAN addresses, or private mining telemetry.

## Current sections

- Intelligence
  - observed merged-mining attribution
  - public network signals
  - mining-share attribution
  - co-location observations
- Merged Mining
  - payout-attribution groups and confidence
  - peer co-location supporting signals
  - native vs merged visibility
  - mining producer & hashrate distribution with 1H / 6H / 12H windows
  - Solo Mining Intelligence calculator using live public network hashrate/BPS
  - expected block time, daily expectation, 24h/7d probability and expected ZKAS/day
  - current/next miner payout and emission split
  - solo vs solo-merged vs pool explanation and readiness checklist
- Network Health
  - BPS, hashrate, difficulty, peers, tips, mempool
  - country and client observations
- Events
  - live + observer-derived event intelligence
  - recent public block activity
  - stable consensus/network signal cards
  - no animated BlockDAG reconstruction
- OTC Price
  - completed-trade price chart with 1D / 7D / 30D / ALL ranges
  - current-price guide line and buy/sell trade markers
  - dated completed-trades table and automatic 30-second refresh
  - private server-side connector for the OTC bot trade log
- History
  - browser/VPS observer history
  - chain-work backfill where the public API supports it
- Supply & Privacy
  - consensus supply and emission schedule
  - aggregate shielded activity
  - no rich-list or individual holder claims
- Reference
  - convenient chain information and links to the official explorer

## Why the animated BlockDAG was removed

The public recent block-relationship endpoints are intermittent. Reconstructing a continuously animated DAG from those endpoints produced unstable motion and unnecessary API pressure. The visualization and its dedicated relationship-hydration loop were removed; stable event and consensus intelligence remain.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm run dev
```

Open the local URL shown by Vite, normally `http://localhost:5173/`.

## Configuration

The local development setup can use the Vite proxy:

```env
VITE_ZKAS_API_BASE=/zkas-api
VITE_POLL_MS=15000
```

Copy `.env.example` to `.env.local` for local development if desired. `.env.local` is intentionally not committed.

The OTC connector uses server-only Cloudflare environment variables:

```env
ZKAS_OTC_API_URL=
ZKAS_OTC_API_KEY=
ZKAS_OTC_API_HEADER=Authorization
ZKAS_OTC_API_PREFIX=Bearer
```

The API URL and access key are read only by `functions/api/otc-trades.js`. They are never included in the browser bundle or returned to visitors. Live responses are held in a short shared edge cache so website traffic does not create one request to Ronnie's service per visitor. Until the endpoint is configured, the OTC page displays a ready-to-connect state without fabricated trades.

## Production

The frontend is built with:

```bash
npm run build
```

The generated site is written to `dist/`. Production deploys to Cloudflare from the repository's `main` branch.

## Data boundaries

ZKAS Stream reports only what public ZKas endpoints and its own observer snapshots can support. It does not infer hidden wallet balances, holders, senders, recipients, transfer amounts, or unavailable historical peer state.

This project is an independent frontend and is not the official ZKas explorer.
