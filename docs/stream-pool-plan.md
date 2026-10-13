# Stream Pool: proposed KAS + ZKAS pool

The user wants a pool on ZKAS.stream similar to the KAS + ZKAS settings builder and payout dashboard at https://pool.rabidmining.com/kas#connect. The initial deliverable is `public/pool-preview.html`, an unlisted, clearly labeled interactive design preview. It does not accept mining work, submit blocks, hold funds, or send payments.

## What the preview implements

- Responsive ZKAS.stream branding and four keyboard-accessible sections: overview, connect, reward explanation, and launch requirements.
- PPLNS/SOLO selection and a draft address/worker settings builder for ASICs or hashrate rentals.
- Basic address structure and worker-name checks, with explicit disclosure that full address checksums are not verified.
- Copying an explicitly labeled draft, with no operational hostname or port until an endpoint is verified.
- A weighted-work allocation example that explains reward sharing without claiming projected earnings.
- Empty pool-specific statistics and undecided operating terms. Existing bridge counters and Rabid Pool statistics are not substituted for Stream Pool statistics.
- No wallet uploads, browser storage, third-party analytics, private-key input, or outgoing payment actions. Public payout addresses remain in page memory; the copy button places the requested draft on the user's clipboard.

## Existing infrastructure verified in source

As of the inspected `KASignDag/zkas-stream` main commit `7be9ad4de1a4d7ea7861de80357aaaae6f32ff87`:

- The site is a Vite/React frontend with Cloudflare Pages functions.
- `public/community-mining.html` publishes a community solo merged-mining connection. Its address layout is ZKAS address plus worker in the username, and Kaspa address in the password.
- `functions/api/community-mining.js` ingests privacy-filtered telemetry and preserves lifetime block counters in KV. It is not a transactional share ledger or a payout service.
- `functions/api/rabid-pool.js` fetches the external pool's public summary. That external service remains a separate operator.

The preview's ZKAS-first login layout is provisional. A new pool may require another layout; do not turn the draft into connection instructions until its server has been tested. Existing node synchronization, merge-mining compatibility, and actual reward receipt must be verified directly on the mining server.

## Public backend readiness

The current `firecash/zkas-pool` README describes direct, solo-style rewards as the live mode and explicitly says its custodial reward-sharing path is still in development. Its proposed shared accounting uses PROP, which is a different reward-window scheme from the PPLNS design shown in this preview. The existence of accountant and payout crates is not proof that shared payouts are production-ready. Do not enable `coinbase_address_override` solely because the website preview exists.

This backend is a candidate for further review, not a verified production dependency. The pool integration guide and the current ZKAS fork rules must be checked against the selected source revision and running server. Rabid's website does not establish that its proprietary server implementation is available for reuse.

## Proposed operating architecture

1. Compatible miners connect through raw TCP to a separately provisioned Stratum server.
2. The Stratum service validates work, records accepted difficulty, and submits qualifying work through compatible Kaspa and ZKas node integrations.
3. The mining server stores shares, block/finder records, chain reward observations, ledger entries, and payment state in a durable transactional database.
4. Pool-controlled wallets receive confirmed mining rewards. A reward reconciler associates received rewards with the eligible work window or SOLO finder before allocating balances.
5. A payout service signs and sends per-coin payouts, with persisted transaction state and confirmation reconciliation.
6. A read-only HTTPS API exposes sanitized pool aggregates and authorized miner views to ZKAS.stream. Cloudflare hosts the website; it is not the long-lived inbound Stratum server.

Credentials, signing keys, and local node RPC stay server-side. Miner IP addresses and full wallet addresses are excluded from public tables. A wallet address is an identifier, not sufficient authorization for sensitive payout changes or private balance access.

## Decisions still needed

| Decision | Why it matters |
| --- | --- |
| Mining server host and operating system | Determines installation, uptime, public TCP access, and backups. |
| Maintained pool backend compatible with current ZKAS consensus | Existing solo bridges do not automatically provide shared-payout accounting. |
| PPLNS window definition for each coin | Reward rules must be deterministic, published, and testable. |
| Pool fee, minimum payouts, and schedule | These must be the operator's tested terms, not copied from another pool. |
| Pool wallets and signing arrangement | The operator must control receipt and disbursement without exposing keys to the website. |
| Miner authentication and address-change rules | Prevent unauthorized balance access, payout redirection, and worker hijacking. |

The initial plan is native KAS + ZKAS payouts. BTC/USDC/USDT conversion requires a separate exchange and settlement integration and is outside this preview.

## Accounting and recovery requirements

- Store accepted share difficulty, not just the count of shares. Reject duplicate submissions, stale work, and invalid proofs consistently.
- Attribute KAS and ZKAS work and rewards independently, using the applicable network difficulty and verified merge-mining protocol.
- Treat submitted blocks as pending observations. Credit only actual reconciled rewards received by the pool.
- Use fixed integer base units for amounts and deterministic rounding; balance all allocations, fees, and remainders exactly against received rewards.
- Preserve share-window and SOLO-finder state across restarts. Keep separate eligibility rules for PPLNS and SOLO work.
- Make ledger allocations unique by confirmed reward identity. Reprocessing a reward must not credit it twice.
- Reserve balances in a database transaction before constructing a payout. Persist the transaction identifier and signed transaction before broadcasting. Reconcile ambiguous send results by transaction identity rather than blindly constructing another payment.
- Define behavior for failed, delayed, conflicting, or reorganized transactions using each chain's verified confirmation rules.
- Keep a durable audit trail and reconcile wallet balances, unpaid miner liabilities, reserved payments, operating fees, and confirmations.
- Restore database and wallet recovery state together; test backups and reconciliation after interrupted sends.

## Minimum launch validation

The pool becomes operational only after a real test miner connects, accepted shares are recorded, qualifying work is submitted through both compatible node integrations, actual rewards are received and attributed, and small native payouts are confirmed on each coin.

Test two miners with different share difficulties; PPLNS window boundaries; SOLO/PPLNS separation; invalid addresses; node disconnections; duplicate rewards; process restarts; payout retries after uncertain broadcasts; exact amount conservation; and restoration from backups. Confirm the latest ZKAS upgrade rules against the running node and bridge software before accepting public mining work.

## Sources used for the design and feasibility review

- Reference pool and its operator's descriptions: https://pool.rabidmining.com/kas
- Current frontend and telemetry implementation: https://github.com/KASignDag/zkas-stream
- Public bridge/pool software readiness: https://github.com/firecash/zkas-pool
- Cloudflare's inbound protocol support: https://developers.cloudflare.com/workers/reference/protocols/

These sources establish the reference experience and current website capabilities. They do not establish that Stream Pool has a production backend or verified payouts.
