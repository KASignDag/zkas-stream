//! Build a network-wide ZKAS mining-payout ranking from a trusted local node.
//!
//! This reads only the canonical shielded-history RPC. It does not inspect wallet
//! balances or follow later private transfers: each row records where public
//! coinbase issuance was originally sent.
//!
//! Usage:
//!   zkas-mining-indexer [host:port] [output.json]
//!
//! Defaults:
//!   host:port   127.0.0.1:16810
//!   output.json zkas-mining-rankings.json

use kaspa_addresses::{Address, Prefix, Version};
use kaspa_consensus_core::config::params::MAINNET_PARAMS;
use kaspa_grpc_client::GrpcClient;
use kaspa_rpc_core::{api::rpc::RpcApi, notify::mode::NotificationMode, RpcHash};
use serde::Serialize;
use std::{
    collections::{BTreeMap, HashMap, HashSet},
    error::Error,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const PAGE_SIZE: u64 = 2_000;
const ORCHARD_SCRIPT_LEN: usize = 43;
const COMPACT_ACTION_RECORD_LEN: usize = 148;
const DAY_MS: u64 = 86_400_000;
const SOMPI_PER_ZKAS: u128 = 100_000_000;

#[derive(Default)]
struct Aggregate {
    blocks: u64,
    sompi: u128,
    first_mined_at: Option<u64>,
    last_mined_at: Option<u64>,
    first_daa_score: Option<u64>,
    last_daa_score: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RankingRow {
    rank: usize,
    address: String,
    blocks: u64,
    zkas_mined: String,
    zkas_mined_sompi: String,
    first_mined_at: Option<u64>,
    last_mined_at: Option<u64>,
    first_daa_score: Option<u64>,
    last_daa_score: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BackfillStatus {
    processed_blocks: u64,
    target_blocks: u64,
    coverage_percent: f64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SourceMetadata {
    genesis_hash: String,
    checkpoint_hash: String,
    checkpoint_daa_score: u64,
    history_from_daa_score: u64,
    history_complete: bool,
}

#[derive(Default)]
struct DailyAggregate {
    blocks: u64,
    coinbase_sompi: u128,
    new_payout_addresses: u64,
    shielded_transactions: u64,
    shielded_actions: u64,
    coinbase_notes: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DailyHistoryRow {
    time: u64,
    blocks: u64,
    coinbase_zkas: String,
    coinbase_sompi: String,
    cumulative_coinbase_zkas: String,
    cumulative_coinbase_sompi: String,
    new_payout_addresses: u64,
    payout_addresses: u64,
    shielded_transactions: u64,
    shielded_actions: u64,
    note_commitments: u64,
    nullifiers: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoryTotals {
    blocks: u64,
    coinbase_zkas: String,
    coinbase_sompi: String,
    payout_addresses: usize,
    shielded_transactions: u64,
    shielded_actions: u64,
    note_commitments: u64,
    nullifiers: u64,
    first_timestamp: Option<u64>,
    last_timestamp: Option<u64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HistoryArchive {
    granularity: &'static str,
    totals: HistoryTotals,
    daily: Vec<DailyHistoryRow>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Snapshot {
    schema_version: u32,
    status: &'static str,
    complete: bool,
    updated_at: u64,
    indexed_through: Option<u64>,
    indexed_through_daa_score: Option<u64>,
    indexed_through_hash: String,
    backfill: BackfillStatus,
    source: SourceMetadata,
    history: HistoryArchive,
    rows: Vec<RankingRow>,
}

fn unix_time_ms() -> Result<u64, Box<dyn Error>> {
    Ok(SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis().try_into()?)
}

fn update_min(slot: &mut Option<u64>, value: u64) {
    if value == 0 {
        return;
    }
    *slot = Some(slot.map_or(value, |current| current.min(value)));
}

fn update_max(slot: &mut Option<u64>, value: u64) {
    if value == 0 {
        return;
    }
    *slot = Some(slot.map_or(value, |current| current.max(value)));
}

fn format_zkas(sompi: u128) -> String {
    format!("{}.{:08}", sompi / SOMPI_PER_ZKAS, sompi % SOMPI_PER_ZKAS)
}

fn write_snapshot(path: &Path, snapshot: &Snapshot) -> Result<(), Box<dyn Error>> {
    let bytes = serde_json::to_vec_pretty(snapshot)?;
    let tmp = path.with_extension("json.tmp");
    std::fs::write(&tmp, bytes)?;
    if path.exists() {
        std::fs::remove_file(path)?;
    }
    std::fs::rename(tmp, path)?;
    Ok(())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let rpc = std::env::args().nth(1).unwrap_or_else(|| "127.0.0.1:16810".to_string());
    let output = PathBuf::from(std::env::args().nth(2).unwrap_or_else(|| "zkas-mining-rankings.json".to_string()));

    println!("Connecting read-only to {rpc}...");
    let client = GrpcClient::connect_with_args(
        NotificationMode::Direct,
        format!("grpc://{rpc}"),
        None,
        true,
        None,
        false,
        Some(500_000),
        Default::default(),
    )
    .await?;

    // Freeze the target before scanning so blocks arriving during a long backfill
    // cannot turn a complete run into a moving-target snapshot.
    let state = client.get_shielded_tree_state(None).await?;
    if !state.history_complete || state.history_from_daa_score != 0 {
        return Err(format!(
            "node history is not complete from genesis (from DAA {}, complete {})",
            state.history_from_daa_score, state.history_complete
        )
        .into());
    }

    let checkpoint = state.block_hash;
    let genesis: RpcHash = MAINNET_PARAMS.genesis.hash;
    println!("Verified history: genesis -> {checkpoint} (DAA {})", state.daa_score);

    let mut cursor = genesis;
    let mut reached_checkpoint = genesis == checkpoint;
    let mut processed_blocks = 0u64;
    let mut pages = 0u64;
    let mut indexed_through = None;
    let mut indexed_through_daa_score = None;
    let mut indexed_through_hash = genesis.to_string();
    let mut totals: HashMap<String, Aggregate> = HashMap::new();
    let mut daily: BTreeMap<u64, DailyAggregate> = BTreeMap::new();
    let mut seen_payout_addresses = HashSet::new();
    let mut first_timestamp = None;
    let mut last_timestamp = None;

    while !reached_checkpoint {
        let response = client.get_shielded_blocks(cursor, PAGE_SIZE).await?;
        if response.reorged {
            return Err(format!("selected-chain reorg invalidated cursor {cursor}; rerun the indexer").into());
        }
        if response.blocks.is_empty() {
            return Err(format!("history ended at {cursor} before checkpoint {checkpoint}").into());
        }

        pages += 1;
        for block in response.blocks {
            let day = block.timestamp / DAY_MS * DAY_MS;
            let daily_row = daily.entry(day).or_default();
            daily_row.blocks = daily_row.blocks.checked_add(1).ok_or("daily block count overflow")?;
            update_min(&mut first_timestamp, block.timestamp);
            update_max(&mut last_timestamp, block.timestamp);

            daily_row.shielded_transactions = daily_row
                .shielded_transactions
                .checked_add(block.accepted_actions.len().try_into()?)
                .ok_or("shielded transaction count overflow")?;
            for compact_actions in &block.accepted_actions {
                if compact_actions.len() % COMPACT_ACTION_RECORD_LEN != 0 {
                    return Err(format!(
                        "block {} contains malformed compact shielded actions ({} bytes)",
                        block.hash,
                        compact_actions.len()
                    )
                    .into());
                }
                daily_row.shielded_actions = daily_row
                    .shielded_actions
                    .checked_add((compact_actions.len() / COMPACT_ACTION_RECORD_LEN).try_into()?)
                    .ok_or("shielded action count overflow")?;
            }

            let mut touched_in_block = HashSet::new();
            for output in &block.coinbase_outputs {
                if output.script_public_key.len() != ORCHARD_SCRIPT_LEN {
                    continue;
                }
                let address = String::from(&Address::new(
                    Prefix::Mainnet,
                    Version::ShieldedOrchard,
                    &output.script_public_key,
                ));
                let aggregate = totals.entry(address.clone()).or_default();
                aggregate.sompi = aggregate
                    .sompi
                    .checked_add(u128::from(output.value))
                    .ok_or("coinbase total overflow")?;
                daily_row.coinbase_sompi = daily_row
                    .coinbase_sompi
                    .checked_add(u128::from(output.value))
                    .ok_or("daily coinbase total overflow")?;
                daily_row.coinbase_notes = daily_row.coinbase_notes.checked_add(1).ok_or("coinbase note count overflow")?;
                if seen_payout_addresses.insert(address.clone()) {
                    daily_row.new_payout_addresses = daily_row
                        .new_payout_addresses
                        .checked_add(1)
                        .ok_or("daily payout address count overflow")?;
                }
                if touched_in_block.insert(address) {
                    aggregate.blocks = aggregate.blocks.checked_add(1).ok_or("block count overflow")?;
                }
                update_min(&mut aggregate.first_mined_at, block.timestamp);
                update_max(&mut aggregate.last_mined_at, block.timestamp);
                update_min(&mut aggregate.first_daa_score, block.daa_score);
                update_max(&mut aggregate.last_daa_score, block.daa_score);
            }

            processed_blocks += 1;
            cursor = block.hash;
            indexed_through = (block.timestamp != 0).then_some(block.timestamp);
            indexed_through_daa_score = Some(block.daa_score);
            indexed_through_hash = block.hash.to_string();
            if block.hash == checkpoint {
                reached_checkpoint = true;
                break;
            }
        }

        println!(
            "page {pages}: {:>10} blocks, {:>8} payout addresses, through DAA {}",
            processed_blocks,
            totals.len(),
            indexed_through_daa_score.unwrap_or_default()
        );
    }

    let mut ranked: Vec<(String, Aggregate)> = totals.into_iter().collect();
    ranked.sort_by(|(address_a, a), (address_b, b)| {
        b.sompi
            .cmp(&a.sompi)
            .then_with(|| b.blocks.cmp(&a.blocks))
            .then_with(|| address_a.cmp(address_b))
    });
    let rows = ranked
        .into_iter()
        .enumerate()
        .map(|(index, (address, aggregate))| RankingRow {
            rank: index + 1,
            address,
            blocks: aggregate.blocks,
            zkas_mined: format_zkas(aggregate.sompi),
            zkas_mined_sompi: aggregate.sompi.to_string(),
            first_mined_at: aggregate.first_mined_at,
            last_mined_at: aggregate.last_mined_at,
            first_daa_score: aggregate.first_daa_score,
            last_daa_score: aggregate.last_daa_score,
        })
        .collect();

    let mut cumulative_coinbase_sompi = 0u128;
    let mut cumulative_payout_addresses = 0u64;
    let mut total_shielded_transactions = 0u64;
    let mut total_shielded_actions = 0u64;
    let mut total_coinbase_notes = 0u64;
    let daily_rows = daily
        .into_iter()
        .map(|(time, value)| -> Result<DailyHistoryRow, Box<dyn Error>> {
            cumulative_coinbase_sompi = cumulative_coinbase_sompi
                .checked_add(value.coinbase_sompi)
                .ok_or("cumulative coinbase total overflow")?;
            cumulative_payout_addresses = cumulative_payout_addresses
                .checked_add(value.new_payout_addresses)
                .ok_or("cumulative payout address count overflow")?;
            total_shielded_transactions = total_shielded_transactions
                .checked_add(value.shielded_transactions)
                .ok_or("shielded transaction total overflow")?;
            total_shielded_actions = total_shielded_actions
                .checked_add(value.shielded_actions)
                .ok_or("shielded action total overflow")?;
            total_coinbase_notes = total_coinbase_notes
                .checked_add(value.coinbase_notes)
                .ok_or("coinbase note total overflow")?;
            let note_commitments = value.coinbase_notes
                .checked_add(value.shielded_actions)
                .ok_or("daily note commitment count overflow")?;
            Ok(DailyHistoryRow {
                time,
                blocks: value.blocks,
                coinbase_zkas: format_zkas(value.coinbase_sompi),
                coinbase_sompi: value.coinbase_sompi.to_string(),
                cumulative_coinbase_zkas: format_zkas(cumulative_coinbase_sompi),
                cumulative_coinbase_sompi: cumulative_coinbase_sompi.to_string(),
                new_payout_addresses: value.new_payout_addresses,
                payout_addresses: cumulative_payout_addresses,
                shielded_transactions: value.shielded_transactions,
                shielded_actions: value.shielded_actions,
                note_commitments,
                nullifiers: value.shielded_actions,
            })
        })
        .collect::<Result<Vec<_>, _>>()?;
    let total_note_commitments = total_coinbase_notes
        .checked_add(total_shielded_actions)
        .ok_or("note commitment total overflow")?;

    let snapshot = Snapshot {
        schema_version: 2,
        status: "complete",
        complete: true,
        updated_at: unix_time_ms()?,
        indexed_through,
        indexed_through_daa_score,
        indexed_through_hash,
        backfill: BackfillStatus {
            processed_blocks,
            target_blocks: processed_blocks,
            coverage_percent: 100.0,
        },
        source: SourceMetadata {
            genesis_hash: genesis.to_string(),
            checkpoint_hash: checkpoint.to_string(),
            checkpoint_daa_score: state.daa_score,
            history_from_daa_score: state.history_from_daa_score,
            history_complete: state.history_complete,
        },
        history: HistoryArchive {
            granularity: "utc_day",
            totals: HistoryTotals {
                blocks: processed_blocks,
                coinbase_zkas: format_zkas(cumulative_coinbase_sompi),
                coinbase_sompi: cumulative_coinbase_sompi.to_string(),
                payout_addresses: seen_payout_addresses.len(),
                shielded_transactions: total_shielded_transactions,
                shielded_actions: total_shielded_actions,
                note_commitments: total_note_commitments,
                nullifiers: total_shielded_actions,
                first_timestamp,
                last_timestamp,
            },
            daily: daily_rows,
        },
        rows,
    };

    write_snapshot(&output, &snapshot)?;
    println!(
        "COMPLETE: {} blocks, {} payout addresses -> {}",
        snapshot.backfill.processed_blocks,
        snapshot.rows.len(),
        output.display()
    );
    Ok(())
}
