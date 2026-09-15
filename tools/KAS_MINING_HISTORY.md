# KAS mining history indexer — prepared contract

This is intentionally separate from the working ZKAS mining-history pipeline.
Nothing in this file changes `tools/zkas-mining-indexer.rs`, `/api/mining-rankings`,
or `public/data/zkas-mining-rankings.json`.

## Goal

Produce a verified snapshot of **accepted Kaspa coinbase payout outputs**, aggregated
by original `kaspa:` destination address, for the ZKAS.stream History page.

The public REST API test proved the required semantics:

- Kaspa coinbase subnetwork id: `0100000000000000000000000000000000000000`
- accepted rewards must have `is_accepted = true` / a row in `transactions_acceptances`
- coinbase transactions have no normal inputs
- one accepted coinbase transaction may contain several payout outputs
- the same address may appear in more than one output of the same coinbase

Therefore the indexer must track **three different counts**:

1. network accepted coinbase transactions (distinct transaction ids)
2. payout outputs (individual accepted coinbase outputs)
3. per-address accepted coinbases (distinct transaction ids that paid that address)

Do not obtain the network accepted-coinbase total by summing per-address counts.
That would double-count transactions that pay multiple addresses.

## Preferred source

Use a local PostgreSQL database populated by `simply-kaspa-indexer` / the Kaspa
REST database dump. Bulk backfill must not crawl `api.kaspa.org`; a 100-request
test reached Cloudflare rate limiting.

The relevant database shape is:

- `transactions(transaction_id, subnetwork_id, block_time, outputs, ...)`
- `transactions_acceptances(transaction_id, block_hash)`
- each transaction output includes `amount`, `script_public_key`, and optionally
  `script_public_key_address`

Some published database dumps are built with
`--exclude-fields=tx_out_script_public_key_address`. In that case the indexer must
derive the `kaspa:` address from `script_public_key` using Kaspa's canonical
address/script utilities. Do not invent or hand-roll addresses from hex.

## Acceptance filter

Conceptually:

```sql
SELECT t.transaction_id, t.block_time, t.outputs
FROM transactions t
JOIN transactions_acceptances a
  ON a.transaction_id = t.transaction_id
WHERE t.subnetwork_id = decode('0100000000000000000000000000000000000000', 'hex');
```

Expand `outputs` with `unnest`, discard zero/invalid outputs, resolve each output
to its canonical `kaspa:` address, then aggregate.

## Required snapshot schema

`/api/kas-mining-rankings` accepts schema version 1:

```json
{
  "schemaVersion": 1,
  "status": "complete",
  "complete": true,
  "updatedAt": 0,
  "indexedThrough": 0,
  "backfill": {
    "processedAcceptedCoinbases": 0,
    "coveragePercent": 100,
    "coverageLabel": "Complete from <date>; recovered historical coverage before <date>"
  },
  "source": {
    "kind": "simply-kaspa-indexer-postgres",
    "acceptanceFiltered": true,
    "notes": ""
  },
  "totals": {
    "addresses": 0,
    "acceptedCoinbases": 0,
    "payoutOutputs": 0,
    "kasMined": "0.00000000",
    "kasMinedSompi": "0"
  },
  "rows": [
    {
      "rank": 1,
      "address": "kaspa:...",
      "acceptedCoinbases": 1,
      "payoutOutputs": 1,
      "kasMined": "2.18267645",
      "kasMinedSompi": "218267645",
      "firstMinedAt": 0,
      "lastMinedAt": 0
    }
  ]
}
```

Rows are ranked by:

1. `kasMinedSompi` descending
2. `acceptedCoinbases` descending
3. address ascending

Amounts remain integer sompi during indexing. Decimal KAS strings are formatting
only; never aggregate with floating-point arithmetic.

## Historical coverage

KAS coverage must be reported separately from ZKAS. Do not copy ZKAS's
`historyComplete/from genesis = 100%` assertion into the KAS snapshot unless the
actual Kaspa dataset proves it.

The API deliberately accepts a dataset-reported `coveragePercent` rather than
requiring 100%, so early recovered Kaspa history can be labeled accurately.

## Cloudflare isolation

Prepared endpoint: `/api/kas-mining-rankings`

- storage key: `kas-all-time:v1`
- preferred KV binding: `KAS_MINING_RANKINGS`
- optional remote source: `KAS_MINING_RANKINGS_API_URL`
- upload authorization: `KAS_MINING_RANKINGS_UPLOAD_SHA256`
- optional static fallback: `/data/kas-mining-rankings.json`

The endpoint may fall back to an existing KV binding for storage, but the key is
separate from ZKAS. It cannot overwrite `all-time:v1` used by the working ZKAS
ranking.

Prepared component: `src/components/KasMiningPayoutRanking.tsx`

It is intentionally **not imported or mounted in `App.tsx`**. The live History
page remains ZKAS-only until a verified KAS snapshot is generated and reviewed.

## Before activation

1. Obtain/restore the Kaspa historical PostgreSQL dataset.
2. Confirm how `script_public_key_address` is populated in that exact dump.
3. Build the extractor with canonical Kaspa address conversion if addresses are omitted.
4. Validate totals against several known accepted transactions, including one with multiple outputs.
5. Generate a snapshot and test `/api/kas-mining-rankings` on the prep branch.
6. Only then mount the KAS component/toggle in the History page.
