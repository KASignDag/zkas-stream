Warning: truncated output (original token count: 45224)
Total output lines: 3069

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Coins,
  CodeXml,
  Database,
  Download,
  ExternalLink,
  Gauge,
  GitMerge,
  Globe2,
  Hash,
  History,
  Link2,
  LockKeyhole,
  Menu,
  MessageCircle,
  Moon,
  Network,
  Search,
  Send,
  Server,
  ShieldCheck,
  Sun,
  TimerReset,
  TrendingUp,
  UsersRound,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import {
  API_BASE,
  fetchBlockRelationships,
  fetchDashboard,
  fetchMiningDistribution,
  searchChain,
  type BlockRelationships,
  type BlockRow,
  type DashboardData,
  type MiningDistributionData,
  type PublicNodeRow,
  type TxRow,
} from './api';
import { MetricCard } from './components/MetricCard';
import { OtcMarketPage } from './components/OtcMarketPage';
import { OtcScreenshotImporter } from './components/OtcScreenshotImporter';
import { SparkChart } from './components/SparkChart';
import { GenesisSupportersPage } from './components/GenesisSupportersPage';
import { MiningPayoutRanking } from './components/MiningPayoutRanking';
import { ExchangesPage } from './components/ExchangesPage';
import { NetworkMap } from './components/NetworkMap';
import { ShareZkasUpdate } from './components/ShareZkasUpdate';
import { useGenesisArchive } from './genesisHistory';

type Tab = 'intelligence' | 'merged' | 'health' | 'nodes' | 'events' | 'explorer' | 'otc' | 'otcPreview' | 'exchanges' | 'importer' | 'history' | 'supply' | 'reference' | 'supporters';

const tabHashes: Record<Tab, string> = {
  intelligence: '',
  merged: 'merged-mining',
  health: 'network-health',
  nodes: 'nodes',
  events: 'events',
  explorer: 'explorer',
  otc: 'otc',
  otcPreview: 'otc-api-preview',
  exchanges: 'exchanges',
  importer: 'otc-import',
  history: 'history',
  supply: 'supply-privacy',
  reference: 'reference',
  supporters: 'genesis-supporters',
};

function tabFromHash(hash: string): Tab {
  const route = hash.replace(/^#\/?/, '').toLowerCase();
  return (Object.entries(tabHashes).find(([, value]) => value === route)?.[0] as Tab | undefined) ?? 'intelligence';
}
type Detail = { type: 'block' | 'transaction' | 'privacy'; query: string; data: unknown };

const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

const MINER_REWARD_SHARE = 0.95;
const DEVELOPMENT_SHARE = 0.05;

function minerPayout(gross: number | null) {
  return gross === null ? null : gross * MINER_REWARD_SHARE;
}

function developmentAllocation(gross: number | null) {
  return gross === null ? null : gross * DEVELOPMENT_SHARE;
}

function displayNumber(v: number | null, compactMode = false) {
  if (v === null || !Number.isFinite(v)) return '—';
  return compactMode ? compact.format(v) : fmt.format(v);
}

function displayHashrate(v: number | null) {
  if (v === null) return '—';
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
  let n = v;
  let i = 0;
  while (Math.abs(n) >= 1000 && i < units.length - 1) { n /= 1000; i += 1; }
  return `${fmt.format(n)} ${units[i]}`;
}

function age(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function duration(seconds: number | null) {
  if (seconds === null) return '—';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function short(value: string, n = 10) {
  return value.length > n * 2 ? `${value.slice(0, n)}…${value.slice(-n)}` : value;
}

function countdown(seconds: number | null) {
  if (seconds === null) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function displayMiningEstimate(value: number | null, suffix = '') {
  if (value === null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  let text: string;
  if (abs > 0 && abs < 0.01) text = value.toFixed(4);
  else if (abs < 1) text = value.toFixed(3);
  else text = fmt.format(value);
  return `${text}${suffix}`;
}

function displayMiningPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs > 0 && abs < 0.01) return `${value.toFixed(4)}%`;
  if (abs < 1) return `${value.toFixed(3)}%`;
  return `${fmt.format(value)}%`;
}

function displayUsd(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const digits = Math.abs(value) < 1 ? 6 : 2;
  return '$' + value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: digits });
}

function objectEntries(data: unknown): Array<[string, string]> {
  if (!data || typeof data !== 'object') return [['Result', String(data ?? '—')]];
  return Object.entries(data as Record<string, unknown>).slice(0, 24).map(([key, value]) => {
    if (typeof value === 'string') return [key, value];
    if (typeof value === 'number' || typeof value === 'boolean') return [key, String(value)];
    return [key, JSON.stringify(value)];
  });
}


const emptyDashboard: DashboardData = {
  source: 'live',
  updatedAt: Date.now(),
  network: 'mainnet',
  bps: null,
  nodes: null,
  mempool: null,
  hashrate: null,
  blockCount: null,
  daaScore: null,
  supply: null,
  reward: null,
  nextReward: null,
  nextReductionSeconds: null,
  txCount: null,
  shieldedNotes: null,
  nullifiers: null,
  shieldedValue: null,
  stateRoot: null,
  priceUsd: null,
  marketCapUsd: null,
  merged: { scannedAt: null, peers: null, checked: null, reachable: null, found: null, attributionMatched: null, attributionUpdatedAt: null, ports: [], nodes: [] },
  relay: { activePeers: null, mempoolSize: null, tipHashes: null, difficulty: null, blocksIngested: null, transactionsProcessed: null, databaseBlocks: null },
  difficulty: null,
  publicNodes: {
    updatedAt: null,
    totals: {
      nodes: null,
      peers: null,
      countries: null,
      located: null,
      inbound: null,
      outbound: null,
      ipv4: null,
      ipv6: null,
      blocksRelayed: null,
    },
    countries: [],
    nodes: [],
  },
  pulse: [],
  chainWorkHistory: [],
  blocks: [],
};

const LIVE_CACHE_KEY = 'zkas-stream:v033:last-live-dashboard';
const MERGED_CACHE_KEY = 'zkas-stream:v033:last-completed-merged-scan';
const ATTRIBUTION_CACHE_KEY = 'zkas-stream:v034:last-attribution-snapshot';
const HISTORY_CACHE_KEY = 'zkas-stream:v040:history';
const HISTORY_SAMPLE_MS = 5 * 60 * 1000;
const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

type HistoryRange = '1h' | '24h' | '7d' | '30d';
type HistorySnapshot = {
  t: number;
  hashrate: number | null;
  bps: number | null;
  difficulty: number | null;
  visibleNodes: number | null;
  countries: number | null;
  activePeers: number | null;
  tipHashes: number | null;
  mempool: number | null;
  attributedBlocks: number | null;
  attributionGroups: number | null;
  weightedConfidencePct: number | null;
  largestSharePct: number | null;
  coLocatedPeers: number | null;
  peersChecked: number | null;
  coLocationPct: number | null;
  supply?: number | null;
  reward?: number | null;
  nextReward?: number | null;
  shieldedNotes?: number | null;
  nullifiers?: number | null;
  shieldedValue?: number | null;
};

function validNumber(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readHistory(): HistorySnapshot[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistorySnapshot[];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - HISTORY_RETENTION_MS;
    return parsed.filter((row) => row && Number.isFinite(row.t) && row.t >= cutoff);
  } catch {
    return [];
  }
}

function makeHistorySnapshot(data: DashboardData): HistorySnapshot {
  const groups = attributionGroups(data);
  const attributedBlocks = data.merged.attributionMatched ?? (groups.reduce((sum, g) => sum + g.blocks, 0) || null);
  const weightedConfidence = weightedAttributionConfidence(groups);
  const topShare = fractionPercent(groups[0]?.share ?? null);
  return {
    t: Date.now(),
    hashrate: validNumber(data.hashrate),
    bps: validNumber(data.bps),
    difficulty: validNumber(data.difficulty),
    visibleNodes: validNumber(data.publicNodes.totals.nodes ?? data.nodes),
    countries: validNumber(data.publicNodes.totals.countries),
    activePeers: validNumber(data.relay.activePeers ?? data.nodes),
    tipHashes: validNumber(data.relay.tipHashes),
    mempool: validNumber(data.mempool),
    attributedBlocks: validNumber(attributedBlocks),
    attributionGroups: groups.length || null,
    weightedConfidencePct: fractionPercent(weightedConfidence),
    largestSharePct: topShare,
    coLocatedPeers: validNumber(data.merged.found),
    peersChecked: validNumber(data.merged.checked),
    coLocationPct: pct(data.merged.found, data.merged.checked),
    supply: validNumber(data.supply),
    reward: validNumber(data.reward),
    nextReward: validNumber(data.nextReward),
    shieldedNotes: validNumber(data.shieldedNotes),
    nullifiers: validNumber(data.nullifiers),
    shieldedValue: validNumber(data.shieldedValue),
  };
}

function appendHistorySnapshot(history: HistorySnapshot[], data: DashboardData): HistorySnapshot[] {
  if (data.source !== 'live' || !data.network) return history;
  const next = makeHistorySnapshot(data);
  const cutoff = next.t - HISTORY_RETENTION_MS;
  const kept = history.filter((row) => row.t >= cutoff);
  const last = kept.at(-1);
  let result: HistorySnapshot[];
  // Keep the timestamp of the current 5-minute bucket stable while refreshing
  // its values. Resetting the timestamp on every 15-second poll would prevent
  // the bucket from ever reaching five minutes and history would remain stuck
  // at one snapshot forever.
  if (last && next.t - last.t < HISTORY_SAMPLE_MS) {
    result = [...kept.slice(0, -1), { ...next, t: last.t }];
  } else {
    result = [...kept, next];
  }
  try { window.localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(result)); } catch { /* optional history cache */ }
  return result;
}

function rangeMs(range: HistoryRange) {
  if (range === '1h') return 60 * 60 * 1000;
  if (range === '24h') return 24 * 60 * 60 * 1000;
  if (range === '7d') return 7 * 24 * 60 * 60 * 1000;
  return 30 * 24 * 60 * 60 * 1000;
}

function deltaPercent(first: number | null, last: number | null) {
  if (first === null || last === null || first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function deltaAbsolute(first: number | null, last: number | null) {
  if (first === null || last === null) return null;
  return last - first;
}

function signed(value: number | null, suffix = '%') {
  if (value === null || !Number.isFinite(value)) return 'Collecting history';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${fmt.format(value)}${suffix}`;
}

function dateStamp(ts: number | null) {
  if (!ts) return 'Not started';
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

type TimedValue = { time: number; value: number | null };

function combinedChainSeries(
  local: TimedValue[],
  chain: TimedValue[],
  cutoff: number,
): TimedValue[] {
  const chainRows = chain.filter((point) => point.time >= cutoff && point.value !== null);
  if (!chainRows.length) return local.filter((point) => point.time >= cutoff && point.value !== null);

  // The public chain-work endpoint reconstructs the recent work window directly
  // from chain data. Use locally recorded points only BEFORE that backfill starts,
  // then let the chain-derived bins own the overlapping recent period.
  const chainStart = chainRows[0].time;
  const localOlder = local.filter((point) => point.time >= cutoff && point.time < chainStart && point.value !== null);
  return [...localOlder, ...chainRows].sort((a, b) => a.time - b.time);
}

function seriesDelta(series: TimedValue[]) {
  if (series.length < 2) return null;
  return deltaPercent(series[0].value, series.at(-1)?.value ?? null);
}

function seriesSpan(series: TimedValue[]) {
  if (series.length < 2) return 0;
  return Math.max(0, series.at(-1)!.time - series[0].time);
}

function readCachedLive(): DashboardData | null {
  try {
    const raw = window.sessionStorage.getItem(LIVE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardData;
    if (!parsed || parsed.source !== 'live' || !parsed.network) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readCachedMerged(): DashboardData['merged'] | null {
  try {
    const raw = window.localStorage.getItem(MERGED_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardData['merged'];
    if ((parsed.scannedAt ?? 0) <= 0 || (parsed.checked ?? 0) <= 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

function hasCompletedMergedValue(value: DashboardData['merged']) {
  return (value.scannedAt ?? 0) > 0 && (value.checked ?? 0) > 0;
}

function hasCompletedMergedScan(value: DashboardData) {
  return hasCompletedMergedValue(value.merged);
}

function hasProbeNodeDetails(value: DashboardData['merged']) {
  const found = value.found ?? 0;
  if (found <= 0) return true;
  return value.nodes.filter((node) => node.kaspaDetected).length >= found;
}

function hasAttributionValue(value: DashboardData['merged']) {
  return (value.attributionMatched ?? 0) > 0 && value.nodes.some((node) =>
    node.attributed && ((node.attributedBlocks ?? 0) > 0 || node.attributionShare !== null),
  );
}

function readCachedAttribution(): DashboardData['merged'] | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardData['merged'];
    return hasAttributionValue(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function blankIncompleteMerged(value: DashboardData['merged']): DashboardData['merged'] {
  // Blank only the active peer-probe fields. Attribution is produced by a separate
  // public block-observation pipeline and can remain valid while the probe scanner
  // is warming up or restarting.
  return {
    ...value,
    scannedAt: null,
    checked: null,
    reachable: null,
    found: null,
  };
}

function applyCachedAttribution(incoming: DashboardData['merged'], cached: DashboardData['merged']): DashboardData['merged'] {
  const incomingById = new Map(incoming.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const nodes = cached.nodes.map((old) => {
    const current = incomingById.get(old.id);
    seen.add(old.id);
    if (!current) return old;
    if (current.attributed) return current;
    return {
      ...current,
      attributed: old.attributed,
      attributedBlocks: old.attributedBlocks,
      attributionConfidence: old.attributionConfidence,
      attributionShare: old.attributionShare,
      attributionAddresses: old.attributionAddresses ?? [],
    };
  });
  for (const node of incoming.nodes) if (!seen.has(node.id)) nodes.push(node);
  return {
    ...incoming,
    attributionMatched: incoming.attributionMatched && incoming.attributionMatched > 0 ? incoming.attributionMatched : cached.attributionMatched,
    attributionUpdatedAt: incoming.attributionUpdatedAt && incoming.attributionUpdatedAt > 0 ? incoming.attributionUpdatedAt : cached.attributionUpdatedAt,
    nodes,
  };
}

function applyCachedScan(incoming: DashboardData['merged'], cached: DashboardData['merged']): DashboardData['merged'] {
  const incomingById = new Map(incoming.nodes.map((node) => [node.id, node]));
  const seen = new Set<string>();
  const nodes = cached.nodes.map((old) => {
    const current = incomingById.get(old.id);
    seen.add(old.id);
    if (!current) return old;
    // Keep the freshest attribution/location data, but restore the last completed
    // probe result. This also keeps geography/client views aligned with the last
    // completed probe instead of briefly falling back to an empty current scan.
    return {
      ...old,
      ...current,
      checked: old.checked,
      reachable: old.reachable,
      kaspaDetected: old.kaspaDetected,
      kaspaAddress: old.kaspaAddress,
    };
  });
  for (const node of incoming.nodes) if (!seen.has(node.id)) nodes.push(node);
  return {
    ...incoming,
    scannedAt: cached.scannedAt,
    checked: cached.checked,
    reachable: cached.reachable,
    found: cached.found,
    ports: incoming.ports.length ? incoming.ports : cached.ports,
    nodes,
  };
}

const rawInitialCachedLive = readCachedLive();
const initialCachedMerged = readCachedMerged();
const initialCachedLive = rawInitialCachedLive
  ? {
      ...rawInitialCachedLive,
      merged: hasCompletedMergedScan(rawInitialCachedLive) && hasProbeNodeDetails(rawInitialCachedLive.merged)
        ? rawInitialCachedLive.merged
        : (initialCachedMerged ? applyCachedScan(rawInitialCachedLive.merged, initialCachedMerged) : blankIncompleteMerged(rawInitialCachedLive.merged)),
    }
  : null;

function stabilizeLiveSnapshot(previous: DashboardData, incoming: DashboardData): DashboardData {
  let next = incoming;

  // Block attribution is produced by a separate public pipeline. Cache it
  // independently so a short attribution refresh/reset cannot make the homepage
  // and mining-share panel disagree with each other.
  if (hasAttributionValue(incoming.merged)) {
    try { window.localStorage.setItem(ATTRIBUTION_CACHE_KEY, JSON.stringify(incoming.merged)); } catch { /* optional cache */ }
  } else if ((incoming.nodes ?? 0) > 0) {
    const attributionFallback = hasAttributionValue(previous.merged) ? previous.merged : readCachedAttribution();
    if (attributionFallback) next = { ...next, merged: applyCachedAttribution(next.merged, attributionFallback) };
  }

  // Peer probing and block attribution are separate signals. Persist completed
  // probe results, but never let an incomplete scan replace the last completed
  // probe geography/client view.
  if (hasCompletedMergedValue(next.merged)) {
    try { window.localStorage.setItem(MERGED_CACHE_KEY, JSON.stringify(next.merged)); } catch { /* optional cache */ }
  } else if ((incoming.nodes ?? 0) > 0) {
    const previousProbe = hasCompletedMergedScan(previous) && hasProbeNodeDetails(previous.merged) ? previous.merged : null;
    const fallback = previousProbe ?? readCachedMerged() ?? (hasCompletedMergedScan(previous) ? previous.merged : null);
    next = {
      ...next,
      merged: fallback ? applyCachedScan(next.merged, fallback) : blankIncompleteMerged(next.merged),
    };
  }

  // The pulse/work-history cache can also be empty for a short period after an
  // upstream restart. The tell is BPS=0 together with no hashrate estimate while
  // the rest of the network is clearly online. Keep the last good short-term work
  // signals until the public pulse history refills.
  const pulseLooksUnseeded = incoming.bps === 0 && incoming.hashrate === null && (incoming.nodes ?? 0) > 0;
  if (pulseLooksUnseeded && previous.bps !== null && previous.bps > 0 && previous.hashrate !== null) {
    next = {
      ...next,
      bps: previous.bps,
      hashrate: previous.hashrate,
      pulse: previous.pulse.length ? previous.pulse : incoming.pulse,
    };
  }

  // The convenience/reference endpoints are noncritical and can occasionally miss
  // one poll while the core network endpoints remain live. Keep the last reported
  // values instead of flashing rows of dashes in Reference.
  next = {
    ...next,
    supply: next.supply ?? previous.supply,
    reward: next.reward ?? previous.reward,
    nextReward: next.nextReward ?? previous.nextReward,
    nextReductionSeconds: next.nextReductionSeconds ?? previous.nextReductionSeconds,
    txCount: next.txCount ?? previous.txCount,
    shieldedNotes: next.shieldedNotes ?? previous.shieldedNotes,
    nullifiers: next.nullifiers ?? previous.nullifiers,
    shieldedValue: next.shieldedValue ?? previous.shieldedValue,
    stateRoot: next.stateRoot ?? previous.stateRoot,
    blockCount: next.blockCount ?? previous.blockCount,
    daaScore: next.daaScore ?? previous.daaScore,
    chainWorkHistory: next.chainWorkHistory?.length ? next.chainWorkHistory : (previous.chainWorkHistory ?? []),
  };

  return next;
}

const heroTitles: Record<Tab, string> = {
  intelligence: 'Merged-mining & network intelligence',
  merged: 'Mining & merged-mining intelligence',
  health: 'Network health signals',
  nodes: 'Public node view',
  events: 'Live event intelligence',
  explorer: 'Privacy-aware chain explorer',
  otc: 'ZKAS OTC market price',
  otcPreview: 'ZKAS OTC shared-market preview',
  exchanges: 'ZKAS exchange markets',
  importer: 'OTC screenshot importer',
  history: 'Historical intelligence',
  supply: 'Supply & privacy intelligence',
  reference: 'ZKas quick reference',
  supporters: 'Genesis Supporters',
};

const heroDescriptions: Record<Tab, string> = {
  intelligence: 'Public ZKas intelligence with a focus on Kaspa ↔ ZKas merged mining, network work, peer signals and security context.',
  merged: 'Public mining signals, producer distribution and practical solo merged-mining estimates for the ZKas network.',
  health: 'Current public network capacity, consensus activity, peer reachability and relay health in one view.',
  nodes: 'Privacy-aware observations of the public nodes currently visible to the ZKas network scanner.',
  events: 'Recent public block and network activity, organized into stable signals instead of a reconstructed animated DAG.',
  explorer: 'Inspect recent BlockDAG activity, blocks and transactions without exposing shielded addresses, balances or transferred amounts.',
  otc: 'View the shared ZKAS OTC order book, completed-trade price chart and live buy and sell offers across the official Discord and Telegram bots.',
  otcPreview: 'Preview the unified completed-trade market powered by the shared Discord and Telegram OTC order-book API.',
  exchanges: 'Live ZKAS exchange prices, bid and ask liquidity, actual trading volume and real-time market charts.',
  importer: 'Privately read trade-log screenshots, review the detected facts and publish completed trades to the OTC chart.',
  history: 'Chain-derived work history and observer history, kept separate so unavailable historical data is never invented.',
  supply: 'Consensus supply, emission and aggregate shielded-activity intelligence without exposing individual holders.',
  reference: 'Convenient public chain information and links to the official ZKas explorer.',
  supporters: 'A transparent view of the ZKAS community fund, supporter recognition and public wallet activity.',
};

function App() {
  const [tab, setTab] = useState<Tab>(() => tabFromHash(window.location.hash));
  const [data, setData] = useState<DashboardData>(initialCachedLive ?? emptyDashboard);
  const [status, setStatus] = useState<'connecting' | 'live' | 'stale'>(initialCachedLive ? 'live' : 'connecting');
  const [error, setError] = useState<string | null>(null);
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [detail, setDetail] = useState<Detail | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistorySnapshot[]>(() => readHistory());
  const [historyRange, setHistoryRange] = useState<HistoryRange>('24h');
  const abortRef = useRef<AbortController | null>(null);
  const inFlightRef = useRef(false);
  const hasLiveRef = useRef(Boolean(initialCachedLive));
  const consecutiveFailuresRef = useRef(0);
  const lastSuccessAtRef = useRef(initialCachedLive?.updatedAt ?? 0);

  // The public pulse data is already binned at 15-second intervals. Polling all
  // explorer endpoints every 5 seconds creates unnecessary load and can cause
  // transient failures. A 15-second default keeps the dashboard fresh without
  // hammering the public API.
  const pollMs = Number(import.meta.env.VITE_POLL_MS || 15000);

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);

  useEffect(() => {
    const onHashChange = () => setTab(tabFromHash(window.location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function navigateToTab(nextTab: Tab) {
    setTab(nextTab);
    const nextHash = tabHashes[nextTab];
    if (nextHash) window.location.hash = nextHash;
    else window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  useEffect(() => {
    if (status !== 'live') return;
    setHistory((previous) => appendHistorySnapshot(previous, data));
  }, [data, status]);

  useEffect(() => {
    let stopped = false;

    async function refresh() {
      // Never overlap a full dashboard refresh. Some public endpoints can take
      // longer than one polling interval, and aborting an in-flight request was
      // what made the UI flip between LIVE and DEMO.
      if (inFlightRef.current) return;
      inFlightRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const live = await fetchDashboard(controller.signal);
        if (!stopped) {
          setData((previous: DashboardData) => {
            const stable = stabilizeLiveSnapshot(previous, live);
            try { window.sessionStorage.setItem(LIVE_CACHE_KEY, JSON.stringify(stable)); } catch { /* cache is optional */ }
            return stable;
          });
          hasLiveRef.current = true;
          consecutiveFailuresRef.current = 0;
          lastSuccessAtRef.current = live.updatedAt;
          setStatus('live');
          setError(null);
        }
      } catch (e) {
        if (controller.signal.aborted || stopped) return;
        const message = e instanceof Error ? e.message : 'API unavailable';
        setError(message);

        // Never replace public-network data with fabricated/demo values.
        // If we already have a live snapshot, keep it and mark it stale while
        // the next refresh retries. Before the first successful snapshot, remain
        // in CONNECTING state with blank metrics.
        if (hasLiveRef.current) {
          consecutiveFailuresRef.current += 1;
          const lastGoodAge = Date.now() - lastSuccessAtRef.current;

          // A single missed poll (or several short misses) is not an outage. Keep
          // MAINNET LIVE and the last good values. Only mark the snapshot stale if
          // the entire core API has failed repeatedly for at least two minutes.
          if (consecutiveFailuresRef.current >= 8 && lastGoodAge >= 120_000) {
            setStatus('stale');
          } else {
            setStatus('live');
          }
        } else {
          setStatus('connecting');
        }
      } finally {
        inFlightRef.current = false;
      }
    }

    void refresh();
    const id = window.setInterval(refresh, Math.max(10000, pollMs));
    return () => {
      stopped = true;
      window.clearInterval(id);
      abortRef.current?.abort();
      inFlightRef.current = false;
    };
  }, [pollMs]);


  const txs = useMemo(() => {
    const rows: Array<TxRow & { blockHash: string; timestamp: number }> = [];
    for (const block of data.blocks) {
      for (const tx of block.txs) rows.push({ ...tx, blockHash: block.hash, timestamp: block.timestamp });
    }
    return rows.slice(0, 500);
  }, [data.blocks]);

  const pulseTimes = data.pulse.map((p) => p.time);
  const diffValues = data.pulse.map((p) => p.difficulty);
  const txValues = data.pulse.map((p) => p.txs);

  async function doSearch(text = query) {
    const q = text.trim();
    if (!q) return;
    setSearching(true);
    setSearchError(null);
    try {
      const result = await searchChain(q);
      setDetail(result);
      setQuery(q);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setSearching(false);
    }
  }

  function onSearch(e: FormEvent) { e.preventDefault(); void doSearch(); }

  const nav: Array<[Tab, string]> = [
    ['intelligence', 'Intelligence'],
    ['merged', 'Merged Mining'],
    ['health', 'Network Health'],
    ['events', 'Events'],
    ['explorer', 'Explorer'],
    ['otc', 'OTC Price'],
    ['exchanges', 'Exchanges'],
    ['history', 'History'],
    ['supply', 'Supply & Privacy'],
    ['reference', 'Reference'],
    ['supporters', 'Supporters'],
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => navigateToTab('intelligence')} aria-label="ZKAS Stream home">
          <span className="brand-mark"><ShieldCheck size={22} /></span>
          <span><b>ZKAS</b><em>.stream</em></span>
          <small>INTELLIGENCE</small>
        </button>

        <nav className={`nav ${menuOpen ? 'open' : ''}`}>
          {nav.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => { navigateToTab(id); setMenuOpen(false); }}>{label}</button>
          ))}
          <a className="discord-nav-link" href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}><MessageCircle size={17} /> Join Discord</a>
          <a className="telegram-nav-link" href="https://t.me/zkasofficial" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}><Send size={17} /> Join Telegram</a>
          <a className="x-nav-link" href="https://x.com/zkas_x" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}><span className="x-mark" aria-hidden="true">X</span> Follow @zkas_x</a>
        </nav>

        <div className="header-actions">
          <span className="public-pill"><Globe2 size={14} /> PUBLIC ONLY</span>
          <span className={`live-pill ${status}`}><i />{status === 'live' ? 'MAINNET LIVE' : status === 'stale' ? 'LIVE · RETRYING' : 'CONNECTING'}</span>
          <a className="icon-btn header-discord" href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noreferrer" aria-label="Join ZKAS Discord" title="Join ZKAS Discord"><MessageCircle size={19} /></a>
          <a className="icon-btn header-telegram" href="https://t.me/zkasofficial" target="_blank" rel="noreferrer" aria-label="Join ZKAS Telegram" title="Join ZKAS Telegram"><Send size={18} /></a>
          <a className="icon-btn header-x" href="https://x.com/zkas_x" target="_blank" rel="noreferrer" aria-label="Follow ZKAS on X" title="Follow @zkas_x on X"><span className="x-mark" aria-hidden="true">X</span></a>
          <button className="icon-btn" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-btn mobile-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Open navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      <main>
        <section className="hero-strip">
          <div>
            <div className="eyebrow"><span className="pulse-dot" /> ZKas public network intelligence</div>
            <h1>{heroTitles[tab]}</h1>
            <p>{heroDescriptions[tab]}</p>
          </div>
          <div className="hero-tools">
            <div className="desktop-social-links" aria-label="ZKAS social media links">
              <a href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noreferrer" aria-label="Join ZKAS Discord"><MessageCircle size={17} /><span>Discord</span></a>
              <a href="https://t.me/zkasofficial" target="_blank" rel="noreferrer" aria-label="Join ZKAS Telegram"><Send size={17} /><span>Telegram</span></a>
              <a href="https://x.com/zkas_x" target="_blank" rel="noreferrer" aria-label="Follow ZKAS on X"><span className="x-mark" aria-hidden="true">X</span><span>@zkas_x</span></a>
              <details className="desktop-resources">
                <summary><Link2 size={17} /><span>Resources</span><ChevronDown size={14} className="resources-chevron" /></summary>
                <div className="desktop-resources-menu">
                  <a href="https://zkas.info" target="_blank" rel="noreferrer"><span>ZKAS website</span><small>zkas.info</small></a>
                  <a href="https://services.zkas.info" target="_blank" rel="noreferrer"><span>Services index</span><small>services.zkas.info</small></a>
                  <a href="https://services.zkas.info/?filter=store" target="_blank" rel="noreferrer"><span>Wallets</span><small>Available wallets</small></a>
                  <a href="https://explorer.zkas.info" target="_blank" rel="noreferrer"><span>Block explorer</span><small>explorer.zkas.info</small></a>
                  <a href="https://github.com/firecash/zkas-rusty" target="_blank" rel="noreferrer"><span>Core source</span><small>GitHub repository</small></a>
                  <a href="https://zkas.info/whitepaper.html" target="_blank" rel="noreferrer"><span>Whitepaper</span><small>Project documentation</small></a>
                </div>
              </details>
            </div>
            {tab !== 'otc' && tab !== 'otcPreview' && tab !== 'exchanges' && tab !== 'importer' && tab !== 'supporters' && <div className="sync-box">
              <span>Network</span><b>{data.network}</b>
              <span>Updated</span><b>{new Date(data.updatedAt).toLocaleTimeString()}</b>
            </div>}
          </div>
        </section>

        {tab !== 'otc' && tab !== 'otcPreview' && tab !== 'exchanges' && tab !== 'importer' && tab !== 'supporters' && <>
          <form className="searchbar" onSubmit={onSearch}>
            <Search size={21} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search public block hash or transaction ID" aria-label="Search public block hash or transaction ID" />
            <button disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
          </form>
          {searchError && <div className="inline-error">{searchError}</div>}
        </>}
        {tab !== 'otc' && tab !== 'otcPreview' && tab !== 'exchanges' && tab !== 'importer' && tab !== 'supporters' && status === 'stale' && <div className="demo-banner"><b>Live refresh delayed.</b> Showing the last good public mainnet snapshot while the API retries. {error && <span>{error}</span>}</div>}
        {tab !== 'otc' && tab !== 'otcPreview' && tab !== 'exchanges' && tab !== 'importer' && tab !== 'supporters' && status === 'connecting' && <div className="demo-banner"><b>Connecting to ZKas mainnet.</b> Waiting for the first public API snapshot. {error && <span>{error}</span>}</div>}

        {tab === 'intelligence' && (
          <IntelligenceHome data={data} txValues={txValues} pulseTimes={pulseTimes} onReference={() => navigateToTab('reference')} />
        )}

        {tab === 'merged' && <MergedIntelligencePage data={data} />}
        {tab === 'health' && <NetworkHealthPage data={data} diffValues={diffValues} txValues={txValues} pulseTimes={pulseTimes} onOpenNodes={() => navigateToTab('nodes')} />}
        {tab === 'nodes' && <NodesPage data={data} />}
        {tab === 'events' && <EventsPage data={data} history={history} />}
        {tab === 'explorer' && <ExplorerPage data={data} txs={txs} onSelect={(value) => void doSearch(value)} />}
        {tab === 'otc' && <OtcMarketPage circulatingSupply={data.supply} mode="shared-preview" />}
        {tab === 'otcPreview' && <OtcMarketPage circulatingSupply={data.supply} mode="shared-preview" previewNotice />}
        {tab === 'exchanges' && <ExchangesPage circulatingSupply={data.supply} />}
        {tab === 'importer' && <OtcScreenshotImporter />}
        {tab === 'history' && <HistoryPage data={data} history={history} range={historyRange} onRange={setHistoryRange} />}
        {tab === 'supply' && <SupplyPrivacyPage data={data} history={history} range={historyRange} onRange={setHistoryRange} />}
        {tab === 'reference' && <ReferencePage data={data} txs={txs} onSelect={(value) => void doSearch(value)} />}
        {tab === 'supporters' && <GenesisSupportersPage />}
      </main>

      <ShareZkasUpdate data={data} />

      <footer>
        <div className="footer-brand"><ShieldCheck size={17} /> ZKAS Stream <span>v0.8.0</span></div>
        <div>Merged-mining, network & OTC intelligence • Public display • Private API credentials remain server-side</div>
        <VisitorCounter />
        <div className="footer-socials">
          <a className="footer-social" href="https://x.com/zkas_x" target="_blank" rel="noreferrer"><span className="x-mark" aria-hidden="true">X</span> Follow @zkas_x</a>
          <a className="footer-social" href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noreferrer"><MessageCircle size={15} /> Join ZKAS Discord</a>
          <a className="footer-social" href="https://t.me/zkasofficial" target="_blank" rel="noreferrer"><Send size={15} /> Join ZKAS Telegram</a>
        </div>
      </footer>

      {detail && <DetailDrawer detail={detail} onClose={() => setDetail(null)} onSelect={(value) => void doSearch(value)} />}
    </div>
  );
}

function VisitorCounter() {
  const [visitors, setVisitors] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch('https://counterapi.com/api/zkas.stream/view/site-visitors?unique=true', {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('Visitor counter unavailable');
        return response.json() as Promise<{ value?: number }>;
      })
      .then((result) => {
        if (Number.isFinite(result.value)) setVisitors(result.value ?? null);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, []);

  return (
    <div className="desktop-visitor-count" title="Unique visitors counted since September 2026">
      <UsersRound size={15} />
      <span>Visitors</span>
      <b>{visitors === null ? '—' : visitors.toLocaleString()}</b>
    </div>
  );
}

function pct(part: number | null, total: number | null) {
  if (part === null || total === null || total <= 0) return null;
  return Math.min(100, Math.max(0, (part / total) * 100));
}

function scanAge(ts: number | null) {
  if (!ts) return 'Scanner warming up';
  return age(ts < 10_000_000_000 ? ts * 1000 : ts);
}

function fractionPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return value <= 1.5 ? value * 100 : value;
}

type AttributionGroup = {
  key: string;
  addresses: string[];
  blocks: number;
  share: number | null;
  confidence: number | null;
  countries: string[];
  networks: string[];
  peerRecords: number;
};

function attributionGroups(data: DashboardData): AttributionGroup[] {
  const groups = new Map<string, AttributionGroup>();
  for (const node of data.merged.nodes) {
    if (!node.attributed) continue;
    const addresses = (node.attributionAddresses ?? []).map((a) => a.address).filter(Boolean).sort();
    const fallback = `${node.attributedBlocks ?? 'x'}|${node.attributionShare ?? 'x'}|${node.attributionConfidence ?? 'x'}`;
    const key = addresses.length ? addresses.join('|') : fallback;
    const country = node.countryName || node.countryCode || 'Unknown';
    const network = node.network || 'Unknown';
    const existing = groups.get(key);
    if (existing) {
      existing.peerRecords += 1;
      if (!existing.countries.includes(country)) existing.countries.push(country);
      if (!existing.networks.includes(network)) existing.networks.push(network);
      existing.blocks = Math.max(existing.blocks, node.attributedBlocks ?? 0);
      if (node.attributionShare !== null) existing.share = Math.max(existing.share ?? 0, node.attributionShare);
      if (node.attributionConfidence !== null) existing.confidence = Math.max(existing.confidence ?? 0, node.attributionConfidence);
    } else {
      groups.set(key, {
        key,
        addresses,
        blocks: node.attributedBlocks ?? 0,
        share: node.attributionShare,
        confidence: node.attributionConfidence,
        countries: [country],
        networks: [network],
        peerRecords: 1,
      });
    }
  }
  return [...groups.values()].sort((a, b) => (b.share ?? 0) - (a.share ?? 0) || b.blocks - a.blocks);
}

function weightedAttributionConfidence(groups: AttributionGroup[]) {
  const rows = groups.filter((g) => g.blocks > 0 && g.confidence !== null);
  const total = rows.reduce((sum, g) => sum + g.blocks, 0);
  if (!total) return null;
  return rows.reduce((sum, g) => sum + g.blocks * (g.confidence ?? 0), 0) / total;
}

function attributionLabel(group: AttributionGroup, index: number) {
  const country = group.countries.length === 1 ? group.countries[0] : `${group.countries.length} locations`;
  return `${country} · Source ${index + 1}`;
}

function IntelligenceHome({ data, txValues, pulseTimes, onReference }: { data: DashboardData; txValues: Array<number | null>; pulseTimes: number[]; onReference: () => void }) {
  const groups = attributionGroups(data);
  const attributedBlocks = data.merged.attributionMatched ?? (groups.reduce((sum, g) => sum + g.blocks, 0) || null);
  const weightedConfidence = weightedAttributionConfidence(groups);
  const topShare = fractionPercent(groups[0]?.share ?? null);
  const mergeRate = pct(data.merged.found, data.merged.checked);
  const attributionActive = (attributedBlocks ?? 0) > 0 && groups.length > 0;
  const countries = data.publicNodes.totals.countries;
  return (
    <>
      <section className="intel-hero-grid">
        <section className="panel intelligence-primary attribution-primary">
          <div className="panel-head">
            <div><span className="panel-icon"><GitMerge size={22} /></span><h2>Observed merged-mining attribution</h2></div>
            <span className={`security-chip ${attributionActive ? 'good' : ''}`}><i />{attributionActive ? 'BLOCK ATTRIBUTION ACTIVE' : 'WAITING FOR ATTRIBUTION'}</span>
          </div>
          <div className="attribution-flow">
            <div className="chain kas"><span>KASPA</span><b>Parent proof-of-work</b></div>
            <div className="merge-arrow"><Zap size={25} /><span>AuxPoW</span></div>
            <div className="chain zkas"><span>ZKAS</span><b>Observed child blocks</b></div>
            <div className="attribution-arrow">→</div>
            <div className="chain attribution"><span>PUBLIC PIPELINE</span><b>Attribution groups</b></div>
          </div>
          <div className="intel-stat-row attribution-stat-row">
            <div><span>Attributed blocks</span><b>{displayNumber(attributedBlocks, true)}</b></div>
            <div><span>Unique attribution groups</span><b>{displayNumber(groups.length || null)}</b></div>
            <div><span>Weighted confidence</span><b>{weightedConfidence === null ? '—' : `${fmt.format(fractionPercent(weightedConfidence) ?? 0)}%`}</b></div>
            <div><span>Largest observed share</span><b>{topShare === null ? '—' : `${fmt.format(topShare)}%`}</b></div>
          </div>
          <div className="attribution-mini-list">
            {groups.slice(0, 4).map((group, index) => {
              const share = fractionPercent(group.share) ?? 0;
              const confidence = fractionPercent(group.confidence);
              return <div className="attribution-mini" key={group.key}>
                <div><span>{attributionLabel(group, index)}</span><b>{fmt.format(share)}%</b></div>
                <i><span style={{ width: `${Math.max(1, Math.min(100, share))}%` }} /></i>
                <small>{displayNumber(group.blocks, true)} blocks · {confidence === null ? 'confidence unavailable' : `${fmt.format(confidence)}% confidence`}</small>
              </div>;
            })}
            {!groups.length && <div className="empty-mini">Waiting for public block-attribution data.</div>}
          </div>
          <p className="source-note"><ShieldCheck size={15} /> Shares are deduplicated by public Kaspa payout attribution so duplicate peer rows are not counted twice. Confidence is the API-reported attribution confidence.</p>
        </section>

        <section className="panel signal-board">
          <div className="panel-head"><div><span className="panel-icon"><Activity size={20} /></span><h2>Live network signals</h2></div><span className="live-mini"><i /> PUBLIC</span></div>
          <div className="signal-list">
            <Signal label="Block flow" value={data.bps === null ? '—' : `${fmt.format(data.bps)} BPS`} note="15-minute observed rate" />
            <Signal label="Network work" value={displayHashrate(data.hashrate)} note="public consensus estimate" />
            <Signal label="Visible peers" value={displayNumber(data.relay.activePeers ?? data.nodes)} note={`${displayNumber(countries)} countries in public view`} />
            <Signal label="Attributed blocks" value={displayNumber(attributedBlocks, true)} note={`${displayNumber(groups.length || null)} unique attribution groups`} />
            <Signal label="Attribution updated" value={scanAge(data.merged.attributionUpdatedAt)} note="public attribution pipeline" />
          </div>
        </section>
      </section>

      <section className="metric-grid intel-metrics">
        <MetricCard icon={<Gauge size={19} />} label="Hashrate" value={displayHashrate(data.hashrate)} sub="Network work estimate" accent />
        <MetricCard icon={<Activity size={19} />} label="BPS" value={displayNumber(data.bps)} sub="15m observed" />
        <MetricCard icon={<Gauge size={19} />} label="Difficulty" value={displayNumber(data.difficulty, true)} sub="Consensus difficulty" />
        <MetricCard icon={<Network size={19} />} label="Visible nodes" value={displayNumber(data.publicNodes.totals.nodes ?? data.nodes)} sub="Explorer vantage point" />
        <MetricCard icon={<GitMerge size={19} />} label="Co-located peers" value={displayNumber(data.merged.found)} sub="Last completed probe" />
        <MetricCard icon={<Network size={19} />} label="Peers checked" value={displayNumber(data.merged.checked)} sub="Co-location probe" />
        <MetricCard icon={<Zap size={19} />} label="Observable co-location" value={mergeRate === null ? '—' : `${fmt.format(mergeRate)}%`} sub="Probe signal, not mining share" />
        <MetricCard icon={<Clock3 size={19} />} label="Last probe" value={scanAge(data.merged.scannedAt)} sub="Public co-location scanner" />
      </section>

      <AttributionBreakdown data={data} limit={8} />

      <section className="two-col intel-charts">
        <div className="panel"><div className="panel-head"><div><span className="panel-icon"><Waves size={20} /></span><h2>Transaction activity</h2></div><span className="range-chip">15M</span></div><SparkChart values={txValues} labels={pulseTimes} /></div>
        <MergedCountryBreakdown data={data} />
      </section>

      <section className="panel feature-panel">
        <div className="panel-head">
          <div><span className="panel-icon"><ShieldCheck size={20} /></span><h2>Why ZKAS</h2></div>
          <a className="secondary-link" href="https://zkas.info/whitepaper.html" target="_blank" rel="noreferrer">Official whitepaper ↗</a>
        </div>
        <div className="feature-facts">
          <div><span>Privacy</span><b>Mandatory shielded payments</b><small>Orchard-based transfers are private by default.</small></div>
          <div><span>Speed</span><b>~1 second target</b><small>Fast block production for practical payments.</small></div>
          <div><span>Proof system</span><b>No trusted setup</b><small>Halo 2 removes the need for a trusted ceremony.</small></div>
          <div><span>Security</span><b>Kaspa merged mining</b><small>The same kHeavyHash work can secure both networks.</small></div>
        </div>
      </section>

      <section className="panel latest-video-strip wallet-download-strip">
        <div className="latest-video-icon"><Download size={24} /></div>
        <div>
          <span className="eyebrow">STREAM WALLET</span>
          <h2>Android community test</h2>
          <p>Install the public Android test build directly, or review the open-source wallet on GitHub. Use only 1–2 ZKAS during the pilot.</p>
        </div>
        <div className="wallet-download-actions">
          <a className="primary-link" href="https://github.com/KASignDag/stream-wallet/releases/download/v0.3.11-android-beta/Stream-Wallet-Android-Community-Test.apk"><Download size={15} /> Download Android APK</a>
          <a className="secondary-link" href="https://github.com/KASignDag/stream-wallet" target="_blank" rel="noreferrer"><CodeXml size={15} /> View on GitHub</a>
        </div>
        <WalletFeedbackForm />
      </section>

      <section className="panel reference-strip">
        <div>
          <span className="eyebrow">ALL-IN-ONE REFERENCE</span>
          <h2>Need chain details too?</h2>
          <p>Supply, reward schedule, shielded activity, latest blocks and transactions stay here as supporting information. For deep block-by-block exploration, the official ZKas explorer remains the specialist tool.</p>
        </div>
        <div className="reference-actions">
          <button className="primary-link" onClick={onReference}>Open quick reference →</button>
          <a className="secondary-link" href="https://explorer.zkas.info" target="_blank" rel="noreferrer">Official explorer ↗</a>
        </div>
      </section>
    </>
  );
}

function WalletFeedbackForm() {
  const [feedbackStatus, setFeedbackStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState('');

  async function submitFeedback(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFeedbackStatus('sending');
    setFeedbackMessage('');
    try {
      const response = await fetch('/api/wallet-feedback', { method: 'POST', body: new FormData(form) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result?.message || 'Feedback could not be sent.');
      form.reset();
      setFeedbackStatus('sent');
      setFeedbackMessage('Thank you—your report was sent to the Stream Wallet testing channel.');
    } catch (error) {
      setFeedbackStatus('error');
      setFeedbackMessage(error instanceof Error ? error.message : 'Feedback could not be sent.');
    }
  }

  return (
    <details className="wallet-feedback">
      <summary><MessageCircle size={16} /> Send feedback or screenshots</summary>
      <form onSubmit={submitFeedback}>
        <div className="wallet-feedback-grid">
          <label><span>Name or Discord username <small>optional</small></span><input name="name" maxLength={80} autoComplete="nickname" /></label>
          <label><span>Android phone and version</span><input name="device" maxLength={120} placeholder="Example: Pixel 8 · Android 15" required /></label>
        </div>
        <label><span>What happened?</span><textarea name="message" maxLength={1500} rows={4} placeholder="Tell us what you tested and what went wrong." required /></label>
        <label className="wallet-feedback-files"><span>Attach screenshots <small>optional · up to 3 images, 6 MB total</small></span><input name="screenshots" type="file" accept="image/png,image/jpeg,image/webp" multiple /></label>
        <label className="feedback-honeypot" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
        <p className="feedback-safety"><ShieldCheck size={14} /> Never attach or type your recovery phrase, private key or wallet password.</p>
        <div className="wallet-feedback-submit">
          <button className="primary-link" disabled={feedbackStatus === 'sending'}>{feedbackStatus === 'sending' ? 'Sending…' : 'Send feedback'}</button>
          {feedbackMessage && <span className={feedbackStatus === 'sent' ? 'feedback-success' : 'feedback-error'} role="status">{feedbackMessage}</span>}
        </div>
      </form>
    </details>
  );
}

function AttributionBreakdown({ data, limit }: { data: DashboardData; limit?: number }) {
  const groups = attributionGroups(data);
  const visible = typeof limit === 'number' ? groups.slice(0, limit) : groups;
  const matched = data.merged.attributionMatched ?? (groups.reduce((sum, g) => sum + g.blocks, 0) || null);
  return (
    <section className="panel attribution-breakdown">
      <div className="panel-head">
        <div><span className="panel-icon"><GitMerge size={20} /></span><h2>Observed mining-share attribution</h2></div>
        <span className="range-chip">{matched === null ? 'WAITING' : `${compact.format(matched)} BLOCKS`}</span>
      </div>
      <div className="attribution-bars">
        {visible.map((group, index) => {
          const share = fractionPercent(group.share) ?? 0;
          const confidence = fractionPercent(group.confidence);
          const address = group.addresses[0];
          return <div className="attribution-row" key={group.key}>
            <div className="attribution-row-head">
              <div><b>{attributionLabel(group, index)}</b><span>{address ? short(address, 9) : 'Payout address unavailable'}</span></div>
              <div className="attribution-numbers"><b>{fmt.format(share)}%</b><span>{displayNumber(group.blocks, true)} blocks</span></div>
            </div>
            <div className="attribution-track"><i style={{ width: `${Math.max(0.5, Math.min(100, share))}%` }} /></div>
            <div className="attribution-meta"><span>Confidence {confidence === null ? '—' : `${fmt.format(confidence)}%`}</span><span>{group.peerRecords > 1 ? `${group.peerRecords} peer records deduplicated` : '1 peer record'}</span><span>{group.networks[0] || 'Masked network unavailable'}</span></div>
          </div>;
        })}
        {!visible.length && <div className="empty-mini">No public block-attribution groups are currently available.</div>}
      </div>
      <p className="source-note"><ShieldCheck size={15} /> “Share” is the public attribution pipeline’s observed share of matched merge-mined blocks, not total ZKas network hashrate. Duplicate peer rows with the same payout attribution are deduplicated here.</p>
    </section>
  );
}

function Signal({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="signal-row"><span>{label}</span><div><b>{value}</b><small>{note}</small></div></div>;
}

function MergedCountryBreakdown({ data }: { data: DashboardData }) {
  const counts = new Map<string, number>();
  data.merged.nodes.filter((n) => n.kaspaDetected).forEach((n) => {
    const name = n.countryName || n.countryCode || 'Unknown';
    counts.set(name, (counts.get(name) || 0) + 1);
  });
  const rows = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  const total = rows.reduce((sum, [, count]) => sum + count, 0);
  return (
    <section className="panel merged-country">
      <div className="panel-head"><div><span className="panel-icon"><Globe2 size={20} /></span><h2>Kaspa co-location geography</h2></div><span className="range-chip">OBSERVED</span></div>
      <div className="country-bars">
        {rows.map(([name, count]) => <div className="country-bar" key={name}><div><span>{name}</span><b>{count}</b></div><i style={{ width: total ? `${Math.max(5, count / total * 100)}%` : '0%' }} /></div>)}
        {!rows.length && <div className="empty-mini">Waiting for the next completed public co-location scan.</div>}
      </div>
    </section>
  );
}

type SoloHashUnit = 'GH/s' | 'TH/s' | 'PH/s';

const SOLO_HASH_SCALES: Record<SoloHashUnit, number> = {
  'GH/s': 1e9,
  'TH/s': 1e12,
  'PH/s': 1e15,
};

const KASPA_BLOCKS_PER_SECOND = 10;

type KaspaMiningSnapshot = {
  hashrateHps: number | null;
  blockRewardKas: number | null;
  priceUsd: number | null;
  status: 'loading' | 'live' | 'unavailable';
  source: string | null;
};

function NativeMergedVisibility({ matched }: { matched: number | null }) {
  return (
    <section className="panel mining-visibility-panel">
      <div className="panel-head">
        <div><span className="panel-icon"><GitMerge size={20} /></span><h2>Native vs merged visibility</h2></div>
        <span className="range-chip">PUBLIC LIMITS</span>
      </div>
      <div className="mining-visibility-grid">
        <div><span>Native ZKas mining</span><b>Supported</b><small>Native kHeavyHash remains consensus-valid.</small></div>
        <div><span>AuxPoW merged mining</span><b>Supported</b><small>Kaspa parent proof-of-work can secure ZKas.</small></div>
        <div><span>Observed merged attribution</span><b>{displayNumber(matched, true)}</b><small>Matched blocks in the public attribution pipeline.</small></div>
        <div><span>Solo miner count</span><b>Not public</b><small>Unique native miners cannot be enumerated reliably.</small></div>
      </div>
      <p className="source-note"><ShieldCheck size={15} /> The current public explorer API does not expose an authoritative per-block native-vs-AuxPoW classification, so ZKAS.stream does not invent a native block share or a solo-miner count.</p>
    </section>
  );
}


type MiningDistributionWindow = '1h' | '6h' | '12h';

function producerLabel(row: MiningDistributionData['producers'][number]) {
  if (row.name) return row.name;
  if (row.address) return short(row.address, 10);
  return 'Unidentified producer';
}

function MiningDistributionPanel({ data }: { data: DashboardData }) {
  const [windowRange, setWindowRange] = useState<MiningDistributionWindow>('1h');
  const [distribution, setDistribution] = useState<MiningDistributionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const load = async () => {
      try {
        const next = await fetchMiningDistribution(windowRange, controller.signal);
        if (!stopped) setDistribution(next);
      } catch {
        if (!stopped) setDistribution(null);
      } finally {
        if (!stopped) setLoading(false);
      }
    };
    setLoading(true);
    load();
    const timer = window.setInterval(load, 30_000);
    return () => { stopped = true; controller.abort(); window.clearInterval(timer); };
  }, [windowRange]);

  const official = distribution?.source === 'official' && distribution.producers.length > 0;
  const rows = official ? distribution.producers.slice(0, 6) : [];
  const networkHashrate = distribution?.networkHashrate ?? data.hashrate;
  const windowText = distribution?.windowSeconds !== null && distribution?.windowSeconds !== undefined
    ? duration(distribution.windowSeconds)
    : windowRange === '1h' ? '60 min' : windowRange === '6h' ? '6 hours' : '12 hours';

  return (
    <section className="panel mining-distribution-panel">
      <div className="panel-head mining-distribution-head">
        <div><span className="panel-icon"><Network size={20} /></span><h2…15224 tokens truncated…b>6 ZKAS / block</b><small>First tail-emission floor begins</small></div>
          <div><span>Month 24 onward</span><b>0.6 ZKAS / block</b><small>Permanent tail · about 18.9M ZKAS yearly</small></div>
        </div>
        <p className="source-note"><ShieldCheck size={15} /> ZKAS has no fixed maximum supply. The permanent tail emission is designed to continue funding proof-of-work security.</p>
      </section>

      <section className="panel feature-panel">
        <div className="panel-head">
          <div><span className="panel-icon"><Link2 size={20} /></span><h2>Get started with ZKAS</h2></div>
          <a className="secondary-link" href="https://services.zkas.info" target="_blank" rel="noreferrer">All official services ↗</a>
        </div>
        <div className="get-started-grid">
          <a href="https://github.com/firecash/zkas-wallet/releases" target="_blank" rel="noreferrer"><span className="status-badge live">OFFICIAL DOWNLOAD</span><b>ZKAS Wallet</b><small>Download the current self-custody wallet release from the official repository.</small></a>
          <a href="https://zkas.info/paper-wallet.html" target="_blank" rel="noreferrer"><span className="status-badge live">OFFLINE OPTION</span><b>Paper Wallet</b><small>Generate a shielded address and seed locally for offline storage.</small></a>
          <a href="https://services.zkas.info" target="_blank" rel="noreferrer"><span className="status-badge live">LIVE OPTIONS</span><b>Mining Pools</b><small>Compare the official directory of ZKAS-compatible pools and payout options.</small></a>
          <a href="https://github.com/firecash/zkas-rusty#run-a-node" target="_blank" rel="noreferrer"><span className="status-badge live">SELF-HOSTED</span><b>Node & Solo Mining</b><small>Use the official node, wallet-daemon and solo-mining instructions.</small></a>
          <a href="https://services.zkas.info" target="_blank" rel="noreferrer"><span className="status-badge preview">PREVIEW / TESTING</span><b>Developer Tools</b><small>Find the ZKAS SDK and the payment-gateway project with their current status.</small></a>
          <a href="https://zkas.info/legal/zkas-legal-position-draft-v2.pdf" target="_blank" rel="noreferrer"><span className="status-badge roadmap">DRAFT V2</span><b>Legal Position Memorandum</b><small>Read the project’s August 29, 2026 draft—not final legal advice.</small></a>
        </div>
      </section>

      <section className="panel feature-panel">
        <div className="panel-head">
          <div><span className="panel-icon"><Activity size={20} /></span><h2>Development & security status</h2></div>
          <span className="range-chip">OFFICIAL ROADMAP</span>
        </div>
        <div className="roadmap-grid">
          <div><span className="status-badge live">LIVE</span><b>Available today</b><ul><li>Mandatory Orchard shielded transfers</li><li>Native and Kaspa merged mining</li><li>Public explorer and wallet tools</li></ul></div>
          <div><span className="status-badge roadmap">ROADMAP · NOT LIVE</span><b>Still in development</b><ul><li>Independent security audit</li><li>Expanded light-client infrastructure</li><li>Recursive verification and full-chain membership</li><li>Private programmability</li></ul></div>
        </div>
        <p className="source-note"><ShieldCheck size={15} /> Roadmap items are shown as future work, not as completed capabilities. Status follows the official whitepaper and services directory.</p>
      </section>

      <div className="metric-grid nodes-metrics">
        {data.supply !== null && <MetricCard icon={<Coins size={19} />} label="Circulating" value={displayNumber(data.supply, true)} sub="ZKAS issued" />}
        {data.reward !== null && <MetricCard icon={<CircleDollarSign size={19} />} label="Gross emission" value={`${displayNumber(data.reward)} ZKAS`} sub="Per block" />}
        {data.reward !== null && <MetricCard icon={<Coins size={19} />} label="Miner payout" value={`${displayNumber(minerPayout(data.reward))} ZKAS`} sub="95% of gross emission" />}
        {data.nextReductionSeconds !== null && <MetricCard icon={<TimerReset size={19} />} label="Next reduction" value={countdown(data.nextReductionSeconds)} sub={data.nextReward === null ? 'Consensus schedule' : `Next gross ${displayNumber(data.nextReward)} · miner ${displayNumber(minerPayout(data.nextReward))} ZKAS`} />}
        {data.blockCount !== null && <MetricCard icon={<Boxes size={19} />} label="Blocks" value={displayNumber(data.blockCount, true)} sub="Observed chain total" />}
        {data.txCount !== null && <MetricCard icon={<Activity size={19} />} label="Transactions" value={displayNumber(data.txCount, true)} sub="Public aggregate" />}
        {data.shieldedNotes !== null && <MetricCard icon={<LockKeyhole size={19} />} label="Shielded notes" value={displayNumber(data.shieldedNotes, true)} sub="Notes minted" />}
        {data.nullifiers !== null && <MetricCard icon={<LockKeyhole size={19} />} label="Nullifiers" value={displayNumber(data.nullifiers, true)} sub="Shielded spends" />}
        {data.daaScore !== null && <MetricCard icon={<Boxes size={19} />} label="DAA score" value={displayNumber(data.daaScore, true)} sub="Consensus progress" />}
      </div>
      <p className="source-note"><ShieldCheck size={15} /> Reference cards appear only when the public API reports that field. Last good values are retained across short endpoint misses instead of flashing unavailable data.</p>
      <section className="two-col tables-row"><BlocksTable blocks={data.blocks.slice(0, 10)} onSelect={onSelect} /><TransactionsTable txs={txs.slice(0, 10)} onSelect={onSelect} /></section>
      {hasShielded && <ShieldedPanel data={data} />}
    </section>
  );
}

function PublicNodeSummary({ data, onOpen }: { data: DashboardData; onOpen?: () => void }) {
  const t = data.publicNodes.totals;
  return (
    <section className="panel node-summary">
      <div className="panel-head">
        <div><span className="panel-icon"><Globe2 size={20} /></span><h2>Public node view</h2></div>
        {onOpen && <button className="text-btn" onClick={onOpen}>View nodes →</button>}
      </div>
      <div className="merge-stats node-stats">
        <div><span>Visible nodes</span><b>{displayNumber(t.nodes ?? data.nodes)}</b></div>
        <div><span>Countries</span><b>{displayNumber(t.countries)}</b></div>
        <div><span>Inbound</span><b>{displayNumber(t.inbound)}</b></div>
        <div><span>Outbound</span><b>{displayNumber(t.outbound)}</b></div>
      </div>
      <p className="source-note"><ShieldCheck size={15} /> Node data is privacy-preserving: the ZKas API reports country and masked network information rather than publicizing exact peer addresses.</p>
    </section>
  );
}

function ShieldedPanel({ data }: { data: DashboardData }) {
  return (
    <div className="panel privacy-panel">
      <div className="panel-head"><div><span className="panel-icon"><LockKeyhole size={20} /></span><h2>Shielded pool</h2></div><span className="privacy-chip"><ShieldCheck size={14} /> PRIVATE</span></div>
      <div className="privacy-grid">
        <div><span>Notes minted</span><b>{displayNumber(data.shieldedNotes, true)}</b></div>
        <div><span>Nullifiers spent</span><b>{displayNumber(data.nullifiers, true)}</b></div>
      </div>
      <div className="state-root"><span>Shielded state root</span><code>{data.stateRoot ? short(data.stateRoot, 16) : '—'}</code></div>
      <p className="privacy-note"><ShieldCheck size={17} /> Sender, recipient and transfer amounts remain shielded by design. The explorer reports public consensus activity instead.</p>
    </div>
  );
}

function MergedPanel({ data }: { data: DashboardData }) {
  const ratio = data.merged.checked && data.merged.found !== null ? Math.min(100, (data.merged.found / data.merged.checked) * 100) : null;
  return (
    <section className="panel merged-panel">
      <div className="panel-head"><div><span className="panel-icon"><GitMerge size={20} /></span><h2>Peer co-location probe</h2></div><span className="range-chip">SUPPORTING SIGNAL</span></div>
      <div className="merged-layout">
        <div className="merge-visual"><div className="chain kas"><span>KASPA</span><b>Parent PoW</b></div><div className="merge-arrow"><Zap size={22} /><span>AuxPoW</span></div><div className="chain zkas"><span>ZKAS</span><b>Child block</b></div></div>
        <div className="merge-stats">
          <div><span>Peers checked</span><b>{displayNumber(data.merged.checked)}</b></div>
          <div><span>Probe-reachable</span><b>{displayNumber(data.merged.reachable)}</b></div>
          <div><span>Kaspa co-located</span><b>{displayNumber(data.merged.found)}</b></div>
          <div><span>Observable co-location</span><b>{ratio === null ? '—' : `${fmt.format(ratio)}%`}</b></div>
        </div>
      </div>
      <p className="source-note">This peer probe is separate from block attribution. A failed probe is not proof of non-merged mining because firewalls and inbound-only peers can be unprobeable.</p>
    </section>
  );
}

type ExplorerView = 'dag' | 'blocks' | 'transactions';

type HashrateComparisonPoint = {
  time: number;
  kaspa: number | null;
  zkas: number | null;
};

type RustyKaspaPoolData = {
  source: string;
  sourceUrl: string;
  fetchedAt: number;
  status: string;
  scheme: string;
  activeMiners: number | null;
  poolHashrateHps: number | null;
  blocksMatured: number | null;
  blocksOrphaned: number | null;
  totalPaidKas: number | null;
  totalOwedKas: number | null;
  sharesLastHour: number | null;
  lastBlockFoundAt: number | null;
  poolFeePercent: number | null;
  totalDistributedKas: number | null;
  pendingSweepKas: number | null;
  feeAllocation: Array<{
    key: string;
    label: string;
    percent: number | null;
    sweptKas: number | null;
    pendingKas: number | null;
  }>;
  stale?: boolean;
};

type RustyKaspaMinerData = {
  found: true;
  fetchedAt: number;
  status: 'online' | 'offline';
  currentHashrateHps: number | null;
  oneHourHashrateHps: number | null;
  sharesLastHour: number | null;
  unpaidKas: number | null;
  totalPaidKas: number | null;
  totalEarnedKas: number | null;
  mergeMiningEnabled: boolean;
  workerCount: number;
  updatedAt: number | null;
  recentPayments: Array<{
    txId: string | null;
    amountKas: number | null;
    paidAt: number | null;
    status: string | null;
  }>;
};

type RustyKaspaSoloData = {
  found: true;
  fetchedAt: number;
  findCount: number;
  findsLast24h: number | null;
  findsLast7d: number | null;
  returned: number;
  hasMore: boolean;
  finds: Array<{
    blockHash: string;
    acceptedAt: number | null;
    role: string;
  }>;
};

const KASPA_HASHRATE_HISTORY_URL = 'https://api.kaspa.org/info/hashrate/history';
const ZKAS_LAUNCH_TIME = Date.parse('2026-07-26T00:00:00Z');
const HASHRATE_HISTORY_START = Date.parse('2026-07-20T00:00:00Z');

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function finiteNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function timeNumber(value: unknown) {
  const numeric = finiteNumber(value);
  if (numeric !== null) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function utcDate(time: number) {
  return new Date(time).toISOString().slice(0, 10);
}

function dailyAverage(rows: Array<{ time: number; value: number }>) {
  const days = new Map<string, { sum: number; count: number }>();
  rows.forEach(({ time, value }) => {
    if (!Number.isFinite(time) || !Number.isFinite(value) || value <= 0) return;
    const day = utcDate(time);
    const current = days.get(day) ?? { sum: 0, count: 0 };
    current.sum += value;
    current.count += 1;
    days.set(day, current);
  });
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, time: Date.parse(`${day}T12:00:00Z`), value: value.sum / value.count }));
}

function compactTerahash(value: number) {
  if (value >= 1_000_000) return `${fmt.format(value / 1_000_000)}M T`;
  if (value >= 1_000) return `${fmt.format(value / 1_000)}K T`;
  return `${fmt.format(value)} T`;
}

const dagRelationshipCache = new Map<string, BlockRelationships>();

function ExplorerPage({ data, txs, onSelect }: {
  data: DashboardData;
  txs: Array<TxRow & { blockHash: string; timestamp: number }>;
  onSelect: (value: string) => void;
}) {
  const [view, setView] = useState<ExplorerView>('dag');
  const recentBlocks = data.blocks.slice(0, 48);
  const recentTxs = txs.slice(0, 100);

  return (
    <section className="page-stack explorer-page">
      <div className="privacy-callout">
        <LockKeyhole size={21} />
        <div>
          <b>Explore the public chain without weakening ZKas privacy</b>
          <span>Block hashes, transaction IDs and consensus relationships are public. Wallet balances, sender and recipient identities, and transferred amounts remain shielded.</span>
        </div>
      </div>

      <div className="metric-grid explorer-metrics">
        <MetricCard icon={<Boxes size={19} />} label="Recent blocks" value={displayNumber(recentBlocks.length)} sub="Current explorer window" accent />
        <MetricCard icon={<LockKeyhole size={19} />} label="Recent transactions" value={displayNumber(recentTxs.length)} sub="Public transaction IDs" />
        <MetricCard icon={<Activity size={19} />} label="Block flow" value={data.bps === null ? '—' : `${fmt.format(data.bps)} BPS`} sub="15m observed" />
        <MetricCard icon={<Gauge size={19} />} label="DAA tip" value={displayNumber(data.daaScore, true)} sub="Current consensus score" />
      </div>

      <div className="explorer-switcher" role="tablist" aria-label="Explorer views">
        <button role="tab" aria-selected={view === 'dag'} className={view === 'dag' ? 'on' : ''} onClick={() => setView('dag')}><GitMerge size={16} /> DAG snapshot</button>
        <button role="tab" aria-selected={view === 'blocks'} className={view === 'blocks' ? 'on' : ''} onClick={() => setView('blocks')}><Boxes size={16} /> Blocks</button>
        <button role="tab" aria-selected={view === 'transactions'} className={view === 'transactions' ? 'on' : ''} onClick={() => setView('transactions')}><LockKeyhole size={16} /> Transactions</button>
      </div>

      {view === 'dag' && <>
        <DagSnapshot blocks={recentBlocks} onSelect={onSelect} />
        <HashrateComparison />
        <RustyKaspaPoolMonitor />
      </>}
      {view === 'blocks' && <BlocksPage blocks={recentBlocks} onSelect={onSelect} />}
      {view === 'transactions' && <TransactionsPage txs={recentTxs} onSelect={onSelect} />}
    </section>
  );
}

function RustyKaspaPoolMonitor() {
  const [snapshot, setSnapshot] = useState<RustyKaspaPoolData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [minerAddress, setMinerAddress] = useState('');
  const [minerResult, setMinerResult] = useState<RustyKaspaMinerData | null>(null);
  const [minerLoading, setMinerLoading] = useState(false);
  const [minerError, setMinerError] = useState('');
  const [soloAddress, setSoloAddress] = useState('');
  const [soloResult, setSoloResult] = useState<RustyKaspaSoloData | null>(null);
  const [soloLoading, setSoloLoading] = useState(false);
  const [soloError, setSoloError] = useState('');

  useEffect(() => {
    let active = true;
    let controller = new AbortController();

    const load = () => {
      controller.abort();
      controller = new AbortController();
      fetch('/api/rustykaspa-pool', { headers: { Accept: 'application/json' }, signal: controller.signal })
        .then((response) => {
          if (!response.ok) throw new Error('RustyKaspa pool data unavailable');
          return response.json() as Promise<RustyKaspaPoolData>;
        })
        .then((data) => {
          if (!active) return;
          setSnapshot(data);
          setFailed(false);
        })
        .catch(() => {
          if (active && !controller.signal.aborted) setFailed(true);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    load();
    const interval = window.setInterval(load, 300_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  const sourceUrl = snapshot?.sourceUrl || 'https://rkstratum.rustykaspa.org/bridges/rkstratum-pool';
  const statusLabel = snapshot?.stale ? 'STALE SNAPSHOT' : snapshot?.status === 'online' ? 'ONLINE' : failed ? 'UNAVAILABLE' : 'LOADING';
  const stats = snapshot ? [
    { label: 'Active miners', value: displayNumber(snapshot.activeMiners), icon: <UsersRound size={18} /> },
    { label: 'Pool hashrate', value: displayHashrate(snapshot.poolHashrateHps), icon: <Gauge size={18} /> },
    { label: 'Blocks matured', value: displayNumber(snapshot.blocksMatured), icon: <Boxes size={18} /> },
    { label: 'Total paid', value: `${displayNumber(snapshot.totalPaidKas)} KAS`, icon: <CircleDollarSign size={18} /> },
    { label: 'KAS owed', value: `${displayNumber(snapshot.totalOwedKas)} KAS`, icon: <Coins size={18} /> },
    { label: 'Pool fee', value: snapshot.poolFeePercent === null ? '—' : `${fmt.format(snapshot.poolFeePercent)}%`, icon: <Activity size={18} /> },
  ] : [];

  const lookupMiner = (event: FormEvent) => {
    event.preventDefault();
    const address = minerAddress.trim();
    if (!address) return;
    setMinerLoading(true);
    setMinerError('');
    setMinerResult(null);
    fetch('/api/rustykaspa-miner', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ address }),
    }).then(async (response) => {
      const data = await response.json() as RustyKaspaMinerData | { error?: string };
      if (!response.ok) {
        const code = 'error' in data ? data.error : '';
        if (code === 'invalid_kaspa_address') throw new Error('Enter a valid kaspa: payout address.');
        if (code === 'miner_not_found') throw new Error('No RustyKaspa PPLNS miner was found for that address.');
        throw new Error('Miner lookup is temporarily unavailable.');
      }
      setMinerResult(data as RustyKaspaMinerData);
    }).catch((error) => {
      setMinerError(error instanceof Error ? error.message : 'Miner lookup is temporarily unavailable.');
    }).finally(() => setMinerLoading(false));
  };

  const lookupSoloMiner = (event: FormEvent) => {
    event.preventDefault();
    const address = soloAddress.trim();
    if (!address) return;
    setSoloLoading(true);
    setSoloError('');
    setSoloResult(null);
    fetch('/api/rustykaspa-solo', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ address }),
    }).then(async (response) => {
      const data = await response.json() as RustyKaspaSoloData | { error?: string };
      if (!response.ok) {
        const code = 'error' in data ? data.error : '';
        if (code === 'invalid_zkas_address') throw new Error('Enter a valid mainnet zkas: payout address.');
        throw new Error('Solo-mining lookup is temporarily unavailable.');
      }
      setSoloResult(data as RustyKaspaSoloData);
    }).catch((error) => {
      setSoloError(error instanceof Error ? error.message : 'Solo-mining lookup is temporarily unavailable.');
    }).finally(() => setSoloLoading(false));
  };

  return (
    <section className="panel rustykaspa-pool-panel">
      <div className="panel-head rustykaspa-pool-head">
        <div><span className="panel-icon"><Server size={20} /></span><h2>RustyKaspa community pool</h2></div>
        <span className={`pool-status ${snapshot?.status === 'online' && !snapshot.stale ? 'online' : ''}`}><i /> {statusLabel}</span>
      </div>
      <p className="rustykaspa-pool-intro">Live aggregate statistics for the public KAS + ZKAS {snapshot?.scheme || 'PPLNS'} pool.</p>

      {loading && !snapshot ? <div className="hashrate-chart-loading">Loading public pool statistics…</div> : failed && !snapshot ? (
        <div className="hashrate-chart-loading error">RustyKaspa pool statistics are temporarily unavailable.</div>
      ) : snapshot && <>
        <div className="rustykaspa-stat-grid">
          {stats.map((stat) => <div key={stat.label}><span>{stat.icon}{stat.label}</span><b>{stat.value}</b></div>)}
        </div>

        <div className="rustykaspa-fee-card">
          <div className="rustykaspa-fee-title">
            <div><span>Pool-fee allocation</span><b>{snapshot.poolFeePercent === null ? '—' : `${fmt.format(snapshot.poolFeePercent)}% of block rewards`}</b></div>
            <div className="rustykaspa-fee-totals"><span>Distributed <b>{displayNumber(snapshot.totalDistributedKas)} KAS</b></span><span>Pending <b>{displayNumber(snapshot.pendingSweepKas)} KAS</b></span></div>
          </div>
          <div className="rustykaspa-allocation-bar" aria-label="Pool fee allocation">
            {snapshot.feeAllocation.map((item) => <i key={item.key} className={item.key} style={{ width: `${item.percent || 0}%` }} />)}
          </div>
          <div className="rustykaspa-allocation-list">
            {snapshot.feeAllocation.map((item) => <span key={item.key}><i className={item.key} /><b>{item.label}</b> {item.percent === null ? '—' : `${fmt.format(item.percent)}%`}</span>)}
          </div>
        </div>

        <div className="miner-lookup-card">
          <div className="miner-lookup-head">
            <div><span className="panel-icon"><Search size={19} /></span><div><h3>Look up my PPLNS miner</h3><p>Enter the Kaspa payout address used on the RustyKaspa PPLNS pool.</p></div></div>
            <span className="privacy-chip"><ShieldCheck size={14} /> PRIVATE LOOKUP</span>
          </div>
          <form className="miner-lookup-form" onSubmit={lookupMiner}>
            <input
              value={minerAddress}
              onChange={(event) => setMinerAddress(event.target.value)}
              placeholder="kaspa:your-payout-address"
              aria-label="Kaspa payout address"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <button type="submit" disabled={minerLoading || !minerAddress.trim()}>{minerLoading ? 'Looking up…' : 'Look up miner'}</button>
          </form>
          <p className="miner-lookup-privacy"><LockKeyhole size={14} /> The address is sent by POST, is not placed in the URL, and is not saved or cached by ZKAS.stream.</p>
          {minerError && <p className="miner-lookup-error">{minerError}</p>}

          {minerResult && <div className="miner-result">
            <div className="miner-result-head">
              <div><b>Miner found</b><span>Updated {minerResult.updatedAt ? age(minerResult.updatedAt) : 'just now'}</span></div>
              <div className="miner-result-badges"><span className={minerResult.status}>{minerResult.status}</span><span className={minerResult.mergeMiningEnabled ? 'merge-on' : ''}>{minerResult.mergeMiningEnabled ? 'KAS + ZKAS' : 'KAS only'}</span></div>
            </div>
            <div className="miner-result-grid">
              <div><span>Current hashrate</span><b>{displayHashrate(minerResult.currentHashrateHps)}</b></div>
              <div><span>1-hour hashrate</span><b>{displayHashrate(minerResult.oneHourHashrateHps)}</b></div>
              <div><span>Shares last hour</span><b>{displayNumber(minerResult.sharesLastHour)}</b></div>
              <div><span>Workers</span><b>{displayNumber(minerResult.workerCount)}</b></div>
              <div><span>Unpaid balance</span><b>{displayNumber(minerResult.unpaidKas)} KAS</b></div>
              <div><span>Total paid</span><b>{displayNumber(minerResult.totalPaidKas)} KAS</b></div>
              <div><span>Total earned</span><b>{displayNumber(minerResult.totalEarnedKas)} KAS</b></div>
            </div>
            <div className="miner-payments">
              <h4>Recent payments</h4>
              {minerResult.recentPayments.length ? minerResult.recentPayments.map((payment, index) => <div key={payment.txId || index}>
                <span>{payment.paidAt ? new Date(payment.paidAt).toLocaleString() : 'Time unavailable'}</span>
                <b>{displayNumber(payment.amountKas)} KAS</b>
                <code>{payment.txId ? short(payment.txId, 7) : payment.status || 'sent'}</code>
              </div>) : <p>No recent payment records were returned for this miner.</p>}
            </div>
          </div>}
        </div>

        <div className="miner-lookup-card solo-lookup-card">
          <div className="miner-lookup-head">
            <div><span className="panel-icon"><GitMerge size={19} /></span><div><h3>Verify my solo ZKAS finds</h3><p>Enter the ZKAS payout address used as the password on the KAS + ZKAS solo Stratum.</p></div></div>
            <span className="privacy-chip"><ShieldCheck size={14} /> PRIVATE LOOKUP</span>
          </div>
          <form className="miner-lookup-form" onSubmit={lookupSoloMiner}>
            <input
              type="password"
              value={soloAddress}
              onChange={(event) => setSoloAddress(event.target.value)}
              placeholder="zkas:your-payout-address"
              aria-label="ZKAS solo payout address"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            <button type="submit" disabled={soloLoading || !soloAddress.trim()}>{soloLoading ? 'Verifying…' : 'Verify solo finds'}</button>
          </form>
          <p className="miner-lookup-privacy"><LockKeyhole size={14} /> The address is sent by POST, is not placed in the URL, and is not saved, cached, or returned by ZKAS.stream.</p>

          <div className="solo-lookup-limits">
            <div><b>Can be shown</b><span>Accepted ZKAS block finds, find totals, recent activity, acceptance times, and ZKAS block hashes.</span></div>
            <div><b>Not included in the solo result</b><span>Hashrate, Kaspa wallet, worker name, and reward amounts cannot be derived from this ZKAS lookup. PPLNS balances and payments use the separate pool lookup.</span></div>
          </div>

          {soloError && <p className="miner-lookup-error">{soloError}</p>}
          {soloResult && <div className="miner-result solo-result">
            <div className="miner-result-head">
              <div><b>{soloResult.findCount ? 'Solo finds verified' : 'No solo finds recorded'}</b><span>Checked {age(soloResult.fetchedAt)}</span></div>
              <div className="miner-result-badges"><span className="merge-on">KAS + ZKAS SOLO</span></div>
            </div>
            <div className="miner-result-grid solo-finds-grid">
              <div><span>All recorded finds</span><b>{displayNumber(soloResult.findCount)}</b></div>
              <div><span>Last 24 hours</span><b>{displayNumber(soloResult.findsLast24h)}</b></div>
              <div><span>Last 7 days</span><b>{displayNumber(soloResult.findsLast7d)}</b></div>
              <div><span>Newest shown</span><b>{displayNumber(soloResult.returned)}</b></div>
            </div>
            <div className="miner-payments solo-finds-list">
              <h4>Accepted ZKAS blocks</h4>
              {soloResult.finds.length ? soloResult.finds.map((find) => <div key={find.blockHash}>
                <span>{find.acceptedAt ? new Date(find.acceptedAt).toLocaleString() : 'Time unavailable'}</span>
                <b>{find.role || 'miner'}</b>
                <code title={find.blockHash}>{short(find.blockHash, 10)}</code>
              </div>) : <p>No ZKAS blocks were returned for this solo payout address.</p>}
            </div>
          </div>}
        </div>

        <div className="rustykaspa-pool-foot">
          <p><ShieldCheck size={16} /> The public panel contains pool-wide totals only. Individual details appear only after a user enters the exact payout address and are not retained by ZKAS.stream. Pool totals update every five minutes{snapshot.fetchedAt ? ` · ${age(snapshot.fetchedAt)}` : ''}.</p>
          <a href={sourceUrl} target="_blank" rel="noreferrer">Open official pool dashboard <ExternalLink size={15} /></a>
        </div>
      </>}
    </section>
  );
}

function HashrateComparison() {
  const [points, setPoints] = useState<HashrateComparisonPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setFailed(false);

    void Promise.all([
      fetch(KASPA_HASHRATE_HISTORY_URL, { headers: { Accept: 'application/json' }, signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error('Kaspa hashrate history unavailable');
        return response.json() as Promise<unknown>;
      }),
      fetch(`${API_BASE}/info/work-history`, { headers: { Accept: 'application/json' }, signal: controller.signal }).then((response) => {
        if (!response.ok) throw new Error('ZKAS work history unavailable');
        return response.json() as Promise<unknown>;
      }),
    ]).then(([kaspaPayload, zkasPayload]) => {
      if (controller.signal.aborted) return;
      const kaspaRows = Array.isArray(kaspaPayload) ? kaspaPayload : [];
      const zkasRows = Array.isArray(zkasPayload) ? zkasPayload : [];
      const kaspa = dailyAverage(kaspaRows.flatMap((value) => {
        const row = record(value);
        const time = timeNumber(row.timestamp);
        const kh = finiteNumber(row.hashrate_kh ?? row.hashrateKh);
        return time !== null && time >= HASHRATE_HISTORY_START && kh !== null ? [{ time, value: kh / 1e9 }] : [];
      }));
      const zkas = dailyAverage(zkasRows.flatMap((value) => {
        const row = record(value);
        const time = timeNumber(row.timestamp);
        const difficulty = finiteNumber(row.difficulty);
        return time !== null && time >= ZKAS_LAUNCH_TIME && difficulty !== null ? [{ time, value: difficulty * 2 / 1e12 }] : [];
      }));
      const kaspaByDay = new Map(kaspa.map((point) => [point.day, point.value]));
      const zkasByDay = new Map(zkas.map((point) => [point.day, point.value]));
      const days = [...new Set([...kaspaByDay.keys(), ...zkasByDay.keys()])].sort();
      const merged = days.map((day) => ({
        time: Date.parse(`${day}T12:00:00Z`),
        kaspa: kaspaByDay.get(day) ?? null,
        zkas: zkasByDay.get(day) ?? null,
      }));
      setPoints(merged);
      setHovered(merged.length ? merged.length - 1 : null);
      setFailed(!merged.some((point) => point.kaspa !== null) || !merged.some((point) => point.zkas !== null));
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, []);

  const width = 1000;
  const height = 360;
  const pad = { left: 82, right: 28, top: 32, bottom: 48 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const allValues = points.flatMap((point) => [point.kaspa, point.zkas]).filter((value): value is number => value !== null && value > 0);
  const minTime = points[0]?.time ?? HASHRATE_HISTORY_START;
  const maxTime = points.at(-1)?.time ?? Date.now();
  const minValue = allValues.length ? Math.min(...allValues) : 1;
  const maxValue = allValues.length ? Math.max(...allValues) : 10;
  const logMin = Math.log10(Math.max(1, minValue * 0.72));
  const logMax = Math.log10(Math.max(minValue * 1.1, maxValue * 1.18));
  const x = (time: number) => pad.left + ((time - minTime) / Math.max(1, maxTime - minTime)) * chartWidth;
  const y = (value: number) => pad.top + (1 - (Math.log10(value) - logMin) / Math.max(0.001, logMax - logMin)) * chartHeight;
  const pathFor = (key: 'kaspa' | 'zkas') => points.reduce((path, point) => {
    const value = point[key];
    if (value === null || value <= 0) return path;
    return `${path}${path ? ' L' : 'M'} ${x(point.time).toFixed(2)} ${y(value).toFixed(2)}`;
  }, '');
  const yTicks = Array.from({ length: 5 }, (_, index) => 10 ** (logMin + ((logMax - logMin) * index) / 4));
  const xTicks = points.length ? Array.from(new Set([0, Math.floor((points.length - 1) / 4), Math.floor((points.length - 1) / 2), Math.floor(((points.length - 1) * 3) / 4), points.length - 1])) : [];
  const launchX = x(ZKAS_LAUNCH_TIME);
  const active = hovered === null ? null : points[hovered] ?? null;
  const latestKaspa = [...points].reverse().find((point) => point.kaspa !== null)?.kaspa ?? null;
  const latestZkas = [...points].reverse().find((point) => point.zkas !== null)?.zkas ?? null;
  const latestShare = latestKaspa && latestZkas ? (latestZkas / latestKaspa) * 100 : null;

  return (
    <section className="panel hashrate-comparison-panel">
      <div className="panel-head hashrate-comparison-head">
        <div><span className="panel-icon"><TrendingUp size={20} /></span><h2>Kaspa vs. ZKAS network hashrate</h2></div>
        <span className="live-mini"><i /> DAILY LIVE DATA</span>
      </div>
      <p className="hashrate-comparison-intro">Daily network hashrate averages since ZKAS launched. The logarithmic scale keeps both networks readable despite their different sizes.</p>

      {loading ? <div className="hashrate-chart-loading">Loading official network history…</div> : failed || points.length < 2 ? (
        <div className="hashrate-chart-loading error">Historical hashrate data is temporarily unavailable. The chart will retry when the page is reloaded.</div>
      ) : <>
        <div className="hashrate-summary-grid">
          <div><span>Kaspa latest daily average</span><b>{latestKaspa === null ? '—' : compactTerahash(latestKaspa)}</b><small>Official Kaspa REST history</small></div>
          <div><span>ZKAS latest daily average</span><b>{latestZkas === null ? '—' : compactTerahash(latestZkas)}</b><small>Consensus difficulty estimate</small></div>
          <div><span>ZKAS share of Kaspa</span><b>{latestShare === null ? '—' : `${fmt.format(latestShare)}%`}</b><small>Hashrate also securing ZKAS</small></div>
        </div>
        <div className="hashrate-chart-shell">
          <div className="hashrate-chart-legend"><span><i className="kaspa" /> Kaspa</span><span><i className="zkas" /> ZKAS</span></div>
          <svg
            className="hashrate-comparison-chart"
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Daily Kaspa and ZKAS network hashrate comparison since ZKAS launch"
            onPointerMove={(event) => {
              const bounds = event.currentTarget.getBoundingClientRect();
              const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
              const index = Math.round(((pointerX - pad.left) / chartWidth) * (points.length - 1));
              setHovered(Math.max(0, Math.min(points.length - 1, index)));
            }}
            onPointerLeave={() => setHovered(points.length - 1)}
          >
            {yTicks.map((tick) => <g key={tick}>
              <line x1={pad.left} y1={y(tick)} x2={width - pad.right} y2={y(tick)} className="hashrate-grid-line" />
              <text x={pad.left - 12} y={y(tick) + 5} textAnchor="end" className="hashrate-axis-label">{compactTerahash(tick)}</text>
            </g>)}
            {xTicks.map((index) => <text key={points[index].time} x={x(points[index].time)} y={height - 14} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'} className="hashrate-axis-label">{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(points[index].time)}</text>)}
            {launchX >= pad.left && launchX <= width - pad.right && <g>
              <line x1={launchX} y1={pad.top} x2={launchX} y2={height - pad.bottom} className="hashrate-launch-line" />
              <text x={launchX + 9} y={pad.top + 15} className="hashrate-launch-label">ZKAS launch</text>
            </g>}
            <path d={pathFor('kaspa')} className="hashrate-series kaspa" />
            <path d={pathFor('zkas')} className="hashrate-series zkas" />
            {active && <g className="hashrate-focus">
              <line x1={x(active.time)} y1={pad.top} x2={x(active.time)} y2={height - pad.bottom} />
              {active.kaspa !== null && <circle cx={x(active.time)} cy={y(active.kaspa)} r="5" className="kaspa" />}
              {active.zkas !== null && <circle cx={x(active.time)} cy={y(active.zkas)} r="5" className="zkas" />}
            </g>}
          </svg>
          {active && <div className="hashrate-chart-readout">
            <b>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(active.time)}</b>
            <span><i className="kaspa" /> Kaspa {active.kaspa === null ? '—' : compactTerahash(active.kaspa)}</span>
            <span><i className="zkas" /> ZKAS {active.zkas === null ? '—' : compactTerahash(active.zkas)}</span>
          </div>}
        </div>
        <p className="table-footnote">Kaspa data comes from its official hashrate-history REST endpoint. ZKAS hashrate is derived from accepted-block consensus difficulty. Missing ZKAS samples are omitted rather than displayed as zero.</p>
      </>}
    </section>
  );
}

function DagSnapshot({ blocks, onSelect }: { blocks: BlockRow[]; onSelect: (hash: string) => void }) {
  const graphBlocks = useMemo(() => blocks.slice(0, 18), [blocks]);
  const graphKey = graphBlocks.map((block) => block.hash).join('|');
  const [relationships, setRelationships] = useState<Map<string, BlockRelationships>>(() => new Map());
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [showAllParents, setShowAllParents] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const missing = graphBlocks.map((block) => block.hash).filter((hash) => !dagRelationshipCache.has(hash));
    setRelationships(new Map(dagRelationshipCache));
    setPending(missing.length);
    setFailed(0);
    if (!missing.length) return () => controller.abort();

    let cursor = 0;
    const worker = async () => {
      while (!controller.signal.aborted && cursor < missing.length) {
        const hash = missing[cursor++];
        try {
          const relation = await fetchBlockRelationships(hash, controller.signal);
          dagRelationshipCache.set(hash, relation);
          setRelationships((current) => new Map(current).set(hash, relation));
        } catch {
          if (!controller.signal.aborted) setFailed((count) => count + 1);
        } finally {
          if (!controller.signal.aborted) setPending((count) => Math.max(0, count - 1));
        }
      }
    };
    void Promise.all(Array.from({ length: Math.min(5, missing.length) }, worker));
    return () => controller.abort();
  }, [graphKey]);

  const graph = useMemo(() => {
    const groups = new Map<string, BlockRow[]>();
    graphBlocks.forEach((block) => {
      const key = block.daaScore === null ? 'Unknown' : String(block.daaScore);
      groups.set(key, [...(groups.get(key) ?? []), block]);
    });
    const rows = [...groups.entries()].sort(([a], [b]) => {
      if (a === 'Unknown') return 1;
      if (b === 'Unknown') return -1;
      return Number(b) - Number(a);
    });
    const positions = new Map<string, { x: number; y: number; parallel: boolean }>();
    let visualRow = 0;

    rows.forEach(([, rowBlocks]) => {
      for (let start = 0; start < rowBlocks.length; start += 3) {
        const chunk = rowBlocks.slice(start, start + 3);
        const lanes = chunk.length === 1 ? [520] : chunk.length === 2 ? [335, 705] : [205, 520, 835];
        chunk.forEach((block, blockIndex) => {
          positions.set(block.hash, { x: lanes[blockIndex], y: 78 + visualRow * 116, parallel: rowBlocks.length > 1 });
        });
        visualRow += 1;
      }
    });
    const height = Math.max(230, visualRow * 116 + 36);

    const edges = graphBlocks.flatMap((block) => {
      const child = positions.get(block.hash);
      const relation = relationships.get(block.hash);
      if (!child || !relation) return [];
      return relation.parents.flatMap((parentHash) => {
        const parent = positions.get(parentHash);
        if (!parent) return [];
        return [{ childHash: block.hash, parentHash, child, parent, selected: relation.selectedParent === parentHash }];
      });
    });

    return { rows, height, positions, edges };
  }, [graphBlocks, relationships]);

  return (
    <section className="panel dag-panel">
      <div className="panel-head">
        <div><span className="panel-icon"><GitMerge size={20} /></span><h2>Recent BlockDAG snapshot</h2></div>
        <span className="live-mini"><i /> LIVE SNAPSHOT</span>
      </div>
      <div className="dag-key">
        <span><i className="dag-key-line selected" /> Selected-parent link</span>
        <span><i className="dag-key-line parent" /> Direct parent link</span>
        <span><i className="dag-key-dot parallel" /> Parallel DAA score</span>
      </div>
      <div className="dag-link-filter" role="group" aria-label="Visible DAG links">
        <button className={!showAllParents ? 'on' : ''} aria-pressed={!showAllParents} onClick={() => setShowAllParents(false)}>Selected links</button>
        <button className={showAllParents ? 'on' : ''} aria-pressed={showAllParents} onClick={() => setShowAllParents(true)}>All parent links</button>
      </div>
      {graphBlocks.length ? (
        <div className="dag-graph-scroll">
          <div className="dag-graph-status">
            <span><i /> Newest</span>
            <b>{pending ? `Verifying ${pending} parent record${pending === 1 ? '' : 's'}…` : failed ? `${failed} parent record${failed === 1 ? '' : 's'} unavailable` : 'Parent links verified'}</b>
          </div>
          <div className="dag-graph" style={{ height: graph.height }}>
            <svg viewBox={`0 0 1000 ${graph.height}`} preserveAspectRatio="none" aria-hidden="true">
              {graph.edges.filter((edge) => showAllParents || edge.selected).map((edge) => {
                const bend = (edge.child.y + edge.parent.y) / 2;
                return (
                  <path
                    key={`${edge.childHash}-${edge.parentHash}`}
                    className={edge.selected ? 'selected' : 'parent'}
                    d={`M ${edge.child.x} ${edge.child.y + 30} C ${edge.child.x} ${bend}, ${edge.parent.x} ${bend}, ${edge.parent.x} ${edge.parent.y - 30}`}
                  />
                );
              })}
            </svg>
            {[...graph.positions.entries()].map(([hash, position], index) => {
              const block = graphBlocks.find((candidate) => candidate.hash === hash)!;
              return (
                <button
                  key={hash}
                  className={`dag-graph-node ${position.parallel ? 'parallel' : ''} ${index === 0 ? 'tip' : ''}`}
                  style={{ left: `${position.x / 10}%`, top: position.y }}
                  onClick={() => onSelect(hash)}
                  title={`Inspect block ${hash}`}
                >
                  <span><Hash size={12} /> {short(hash, 5)}</span>
                  <b>DAA {block.daaScore === null ? '—' : fmt.format(block.daaScore)}</b>
                  <small>{block.txCount} tx{block.txCount === 1 ? '' : 's'}</small>
                </button>
              );
            })}
          </div>
        </div>
      ) : <div className="empty-cell dag-empty">Waiting for recent public BlockDAG data.</div>}
      <p className="table-footnote">Selected-parent links are shown by default for a clearer view. Choose “All parent links” to add every direct parent relationship reported by the ZKas explorer API. Select a block for its complete public consensus record.</p>
    </section>
  );
}

function BlocksPage({ blocks, onSelect }: { blocks: BlockRow[]; onSelect: (hash: string) => void }) {
  const [filter, setFilter] = useState('');
  const visible = blocks.filter((b) => b.hash.toLowerCase().includes(filter.trim().toLowerCase()));
  return (
    <section className="page-stack">
      <div className="page-tools"><div><b>{visible.length}</b><span> recent public blocks</span></div><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter recent hashes" /></div>
      <BlocksTable blocks={visible} onSelect={onSelect} expanded />
    </section>
  );
}

function TransactionsPage({ txs, onSelect }: { txs: Array<TxRow & { blockHash: string; timestamp: number }>; onSelect: (id: string) => void }) {
  const [mode, setMode] = useState<'all' | 'shielded' | 'coinbase'>('all');
  const visible = txs.filter((t) => mode === 'all' || t.kind.toLowerCase() === mode);
  return (
    <section className="page-stack">
      <div className="privacy-callout"><LockKeyhole size={21} /><div><b>Privacy-aware transaction view</b><span>Transaction IDs and public confirmation data are visible; sender, recipient and transferred amount remain shielded.</span></div></div>
      <div className="page-tools"><div><b>{visible.length}</b><span> recent transactions</span></div><div className="segmented"><button className={mode === 'all' ? 'on' : ''} onClick={() => setMode('all')}>All</button><button className={mode === 'shielded' ? 'on' : ''} onClick={() => setMode('shielded')}>Shielded</button><button className={mode === 'coinbase' ? 'on' : ''} onClick={() => setMode('coinbase')}>Coinbase</button></div></div>
      <TransactionsTable txs={visible} onSelect={onSelect} expanded />
    </section>
  );
}

function NodesPage({ data }: { data: DashboardData }) {
  const t = data.publicNodes.totals;
  const locatedPct = t.nodes && t.located !== null ? (t.located / t.nodes) * 100 : null;
  return (
    <section className="page-stack">
      <div className="privacy-callout"><Globe2 size={21} /><div><b>Public network view, not a global crawler</b><span>This is the public peer view exposed by the ZKas explorer backend. Exact peer addresses are not displayed; country and masked network labels preserve operator privacy.</span></div></div>
      <div className="metric-grid nodes-metrics">
        <MetricCard icon={<Server size={19} />} label="Visible nodes" value={displayNumber(t.nodes ?? data.nodes)} sub="Explorer vantage point" accent />
        <MetricCard icon={<Globe2 size={19} />} label="Countries" value={displayNumber(t.countries)} sub={locatedPct === null ? 'Location aggregate' : `${fmt.format(locatedPct)}% located`} />
        <MetricCard icon={<Network size={19} />} label="Inbound" value={displayNumber(t.inbound)} sub="Observed connections" />
        <MetricCard icon={<Network size={19} />} label="Outbound" value={displayNumber(t.outbound)} sub="Observed connections" />
        <MetricCard icon={<Activity size={19} />} label="IPv4" value={displayNumber(t.ipv4)} sub="Visible peers" />
        <MetricCard icon={<Activity size={19} />} label="IPv6" value={displayNumber(t.ipv6)} sub="Visible peers" />
        <MetricCard icon={<Boxes size={19} />} label="Blocks relayed" value={displayNumber(t.blocksRelayed, true)} sub="First-delivered to vantage node" />
        <MetricCard icon={<Clock3 size={19} />} label="Peer records" value={displayNumber(data.publicNodes.nodes.length)} sub="Privacy-safe rows" />
      </div>
      <section className="two-col node-columns">
        <CountriesTable data={data} />
        <NodeClientSummary nodes={data.publicNodes.nodes} />
      </section>
      <NodesTable nodes={data.publicNodes.nodes} />
    </section>
  );
}

function CountriesTable({ data }: { data: DashboardData }) {
  return (
    <section className="panel table-panel">
      <div className="panel-head"><div><span className="panel-icon"><Globe2 size={20} /></span><h2>Country distribution</h2></div><span className="range-chip">PUBLIC</span></div>
      <div className="table-scroll"><table><thead><tr><th>Country</th><th>Code</th><th>Nodes</th><th>Share</th></tr></thead><tbody>
        {data.publicNodes.countries.map((c) => <tr key={`${c.code}-${c.name}`}><td>{c.name}</td><td><span className="pill">{c.code}</span></td><td>{c.count}</td><td>{c.percent === null ? '—' : `${fmt.format(c.percent)}%`}</td></tr>)}
        {!data.publicNodes.countries.length && <tr><td colSpan={4} className="empty-cell">Country aggregates are not available from this API response.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function NodeClientSummary({ nodes }: { nodes: PublicNodeRow[] }) {
  const groups = new Map<string, number>();
  nodes.forEach((n) => groups.set(n.userAgent || 'Unknown client', (groups.get(n.userAgent || 'Unknown client') || 0) + 1));
  const rows = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <section className="panel table-panel">
      <div className="panel-head"><div><span className="panel-icon"><Server size={20} /></span><h2>Client versions</h2></div><span className="range-chip">PUBLIC</span></div>
      <div className="table-scroll"><table><thead><tr><th>Client / user agent</th><th>Count</th></tr></thead><tbody>
        {rows.map(([client, count]) => <tr key={client}><td><code className="soft-code">{client}</code></td><td>{count}</td></tr>)}
        {!rows.length && <tr><td colSpan={2} className="empty-cell">Client-version aggregates are not available.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function NodesTable({ nodes }: { nodes: PublicNodeRow[] }) {
  return (
    <section className="panel table-panel expanded">
      <div className="panel-head"><div><span className="panel-icon"><Network size={20} /></span><h2>Visible public peers</h2></div><span className="privacy-chip"><ShieldCheck size={14} /> MASKED</span></div>
      <div className="table-scroll"><table><thead><tr><th>Peer</th><th>Country</th><th>Network</th><th>Client</th><th>Direction</th><th>Protocol</th><th>Ping</th><th>Connected</th><th>Relayed</th></tr></thead><tbody>
        {nodes.map((n, i) => <tr key={`${n.id}-${i}`}><td><code className="soft-code">{short(n.id, 6)}</code></td><td>{n.countryName || n.countryCode || 'Unknown'}</td><td><code className="soft-code">{n.network || '—'}</code></td><td>{n.userAgent || '—'}</td><td><span className="pill">{n.outbound === null ? '—' : n.outbound ? 'Outbound' : 'Inbound'}</span></td><td>{displayNumber(n.protocolVersion)}</td><td>{n.pingMs === null ? '—' : `${displayNumber(n.pingMs)} ms`}</td><td>{duration(n.connectedForSec)}</td><td>{displayNumber(n.blocksRelayed)}</td></tr>)}
        {!nodes.length && <tr><td colSpan={9} className="empty-cell">No privacy-safe peer rows were returned.</td></tr>}
      </tbody></table></div>
      <p className="table-footnote">“Relayed” means the peer was first to deliver a block to the explorer vantage node; it does not identify the miner that found that block.</p>
    </section>
  );
}

function MiningPage({ data, diffValues, pulseTimes }: { data: DashboardData; diffValues: Array<number | null>; pulseTimes: number[] }) {
  return (
    <section className="mining-layout page-stack">
      <div className="privacy-callout"><GitMerge size={21} /><div><b>Public network mining only</b><span>This page has no connection to any personal miner, bridge, worker name, wallet, local node or Prometheus endpoint.</span></div></div>
      <div className="metric-grid mining-metrics">
        <MetricCard icon={<Gauge size={19} />} label="Network hashrate" value={displayHashrate(data.hashrate)} sub="Public network estimate" accent />
        <MetricCard icon={<Activity size={19} />} label="BPS" value={displayNumber(data.bps)} sub="Block production" />
        <MetricCard icon={<CircleDollarSign size={19} />} label="Miner payout" value={`${displayNumber(minerPayout(data.reward))} ZKAS`} sub="95% of gross block emission" />
        <MetricCard icon={<GitMerge size={19} />} label="Co-located peers" value={displayNumber(data.merged.found)} sub="Kaspa node detected" />
      </div>
      <div className="panel"><div className="panel-head"><div><span className="panel-icon"><Gauge size={20} /></span><h2>Network difficulty</h2></div><span className="range-chip">15M</span></div><SparkChart values={diffValues} labels={pulseTimes} height={240} /></div>
      <MergedPanel data={data} />
    </section>
  );
}

function BlocksTable({ blocks, onSelect, expanded = false }: { blocks: BlockRow[]; onSelect: (hash: string) => void; expanded?: boolean }) {
  return (
    <section className={`panel table-panel ${expanded ? 'expanded' : ''}`}>
      <div className="panel-head"><div><span className="panel-icon"><Boxes size={20} /></span><h2>Blocks</h2></div><span className="live-mini"><i /> LIVE</span></div>
      <div className="table-scroll"><table><thead><tr><th>Hash</th><th>Age</th><th>DAA</th><th>Blue score</th><th>Txs</th><th>Difficulty</th></tr></thead><tbody>
        {blocks.map((b, i) => <tr key={`${b.hash}-${i}`}><td><button className="hash-link" onClick={() => onSelect(b.hash)}><Hash size={14} />{short(b.hash, 8)}</button></td><td>{age(b.timestamp)}</td><td>{displayNumber(b.daaScore, true)}</td><td>{displayNumber(b.blueScore, true)}</td><td><span className="pill">{b.txCount}</span></td><td>{displayNumber(b.difficulty, true)}</td></tr>)}
        {!blocks.length && <tr><td colSpan={6} className="empty-cell">No recent public block data.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function TransactionsTable({ txs, onSelect, expanded = false }: { txs: Array<TxRow & { blockHash: string; timestamp: number }>; onSelect: (id: string) => void; expanded?: boolean }) {
  return (
    <section className={`panel table-panel ${expanded ? 'expanded' : ''}`}>
      <div className="panel-head"><div><span className="panel-icon"><LockKeyhole size={20} /></span><h2>Transactions</h2></div><span className="privacy-chip"><ShieldCheck size={14} /> PRIVACY-AWARE</span></div>
      <div className="table-scroll"><table><thead><tr><th>Tx ID</th><th>Age</th><th>Type</th><th>Actions</th><th>Block</th></tr></thead><tbody>
        {txs.map((tx, i) => <tr key={`${tx.id}-${i}`}><td><button className="hash-link" onClick={() => onSelect(tx.id)}><LockKeyhole size={14} />{short(tx.id, 8)}</button></td><td>{age(tx.timestamp)}</td><td><span className="shield-pill">{tx.kind}</span></td><td>{tx.shieldedActions ?? '—'}</td><td><code className="soft-code">{short(tx.blockHash, 6)}</code></td></tr>)}
        {!txs.length && <tr><td colSpan={5} className="empty-cell">No recent public transaction data.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function blockRelationships(data: unknown) {
  const root = recordValue(data);
  const header = recordValue(root.header);
  const verbose = recordValue(root.verboseData);
  const parentGroups = Array.isArray(header.parents) ? header.parents : [];
  const parents = [...new Set(parentGroups.flatMap((group) => stringList(recordValue(group).parentHashes)))];
  return {
    header,
    verbose,
    parents,
    selectedParent: typeof verbose.selectedParentHash === 'string' ? verbose.selectedParentHash : null,
    mergeBlues: stringList(verbose.mergeSetBluesHashes),
    mergeReds: stringList(verbose.mergeSetRedsHashes),
    children: stringList(verbose.childrenHashes),
  };
}

function RelationshipHashes({ label, values, onSelect }: { label: string; values: string[]; onSelect: (value: string) => void }) {
  return (
    <div className="relationship-group">
      <span>{label}</span>
      <div>
        {values.slice(0, 16).map((value) => <button key={value} onClick={() => onSelect(value)}><Hash size={12} />{short(value, 7)}</button>)}
        {!values.length && <em>None reported</em>}
      </div>
    </div>
  );
}

function BlockDetailContent({ data, onSelect }: { data: unknown; onSelect: (value: string) => void }) {
  const relationships = blockRelationships(data);
  const { header, verbose } = relationships;
  const txs = Array.isArray(recordValue(data).transactions) ? recordValue(data).transactions as unknown[] : [];
  const timestamp = typeof header.timestamp === 'number' || typeof header.timestamp === 'string'
    ? new Date(normalizeDetailTimestamp(header.timestamp)).toLocaleString()
    : '—';

  return (
    <div className="block-detail-content">
      <div className="detail-summary-grid">
        <div><span>DAA score</span><b>{String(header.daaScore ?? '—')}</b></div>
        <div><span>Blue score</span><b>{String(header.blueScore ?? '—')}</b></div>
        <div><span>Transactions</span><b>{txs.length}</b></div>
        <div><span>Timestamp</span><b>{timestamp}</b></div>
      </div>
      {relationships.selectedParent && <div className="selected-parent"><span>Selected parent</span><button onClick={() => onSelect(relationships.selectedParent!)}><GitMerge size={14} />{short(relationships.selectedParent, 10)}</button></div>}
      <RelationshipHashes label="Unique parents" values={relationships.parents} onSelect={onSelect} />
      <RelationshipHashes label="Merge-set blues" values={relationships.mergeBlues} onSelect={onSelect} />
      <RelationshipHashes label="Merge-set reds" values={relationships.mergeReds} onSelect={onSelect} />
      <RelationshipHashes label="Children" values={relationships.children} onSelect={onSelect} />
      <p className="privacy-note"><ShieldCheck size={16} /> These are public consensus relationships. Shielded wallet identities, balances and transferred amounts are not shown.</p>
    </div>
  );
}

function normalizeDetailTimestamp(value: string | number) {
  const n = Number(value);
  if (Number.isFinite(n)) return n < 10_000_000_000 ? n * 1000 : n;
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function DetailDrawer({ detail, onClose, onSelect }: { detail: Detail; onClose: () => void; onSelect: (value: string) => void }) {
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Search result">
        <div className="drawer-head"><div><span className="eyebrow">{detail.type === 'privacy' ? 'Privacy notice' : `${detail.type} result`}</span><h2>{short(detail.query, 14)}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        {detail.type === 'privacy'
          ? <div className="privacy-result"><ShieldCheck size={34} /><h3>Address activity stays private</h3><p>{String((detail.data as { message?: string }).message || '')}</p></div>
          : detail.type === 'block'
            ? <BlockDetailContent data={detail.data} onSelect={onSelect} />
            : <div className="detail-list">{objectEntries(detail.data).map(([key, value]) => <div key={key}><span>{key}</span><code>{value}</code></div>)}</div>}
      </aside>
    </div>
  );
}

export default App;
