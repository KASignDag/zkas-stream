import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Boxes,
  CircleDollarSign,
  Clock3,
  Coins,
  Database,
  Gauge,
  GitMerge,
  Globe2,
  Hash,
  History,
  LockKeyhole,
  Menu,
  Moon,
  Network,
  Search,
  Server,
  ShieldCheck,
  Sun,
  TimerReset,
  TrendingUp,
  Waves,
  X,
  Zap,
} from 'lucide-react';
import {
  fetchDashboard,
  fetchMiningDistribution,
  searchChain,
  type BlockRow,
  type DashboardData,
  type MiningDistributionData,
  type PublicNodeRow,
  type TxRow,
} from './api';
import { MetricCard } from './components/MetricCard';
import { SparkChart } from './components/SparkChart';

type Tab = 'intelligence' | 'merged' | 'health' | 'nodes' | 'events' | 'history' | 'supply' | 'reference';
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
  history: 'Historical intelligence',
  supply: 'Supply & privacy intelligence',
  reference: 'ZKas quick reference',
};

function App() {
  const [tab, setTab] = useState<Tab>('intelligence');
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
    ['history', 'History'],
    ['supply', 'Supply & Privacy'],
    ['reference', 'Reference'],
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setTab('intelligence')} aria-label="ZKAS Stream home">
          <span className="brand-mark"><ShieldCheck size={22} /></span>
          <span><b>ZKAS</b><em>.stream</em></span>
          <small>INTELLIGENCE</small>
        </button>

        <nav className={`nav ${menuOpen ? 'open' : ''}`}>
          {nav.map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setMenuOpen(false); }}>{label}</button>
          ))}
        </nav>

        <div className="header-actions">
          <span className="public-pill"><Globe2 size={14} /> PUBLIC ONLY</span>
          <span className={`live-pill ${status}`}><i />{status === 'live' ? 'MAINNET LIVE' : status === 'stale' ? 'LIVE · RETRYING' : 'CONNECTING'}</span>
          <button className="icon-btn" onClick={() => setDark((v) => !v)} aria-label="Toggle theme">{dark ? <Sun size={18} /> : <Moon size={18} />}</button>
          <button className="icon-btn mobile-menu" onClick={() => setMenuOpen((v) => !v)} aria-label="Open navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      <main>
        <section className="hero-strip">
          <div>
            <div className="eyebrow"><span className="pulse-dot" /> ZKas public network intelligence</div>
            <h1>{heroTitles[tab]}</h1>
            <p>Public ZKas intelligence with a focus on Kaspa ↔ ZKas merged mining, network work, peer signals and security context. Explorer data remains available as supporting reference, not the main product.</p>
          </div>
          <div className="sync-box">
            <span>Network</span><b>{data.network}</b>
            <span>Updated</span><b>{new Date(data.updatedAt).toLocaleTimeString()}</b>
          </div>
        </section>

        <form className="searchbar" onSubmit={onSearch}>
          <Search size={21} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search public block hash or transaction ID" aria-label="Search public block hash or transaction ID" />
          <button disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
        </form>
        {searchError && <div className="inline-error">{searchError}</div>}
        {status === 'stale' && <div className="demo-banner"><b>Live refresh delayed.</b> Showing the last good public mainnet snapshot while the API retries. {error && <span>{error}</span>}</div>}
        {status === 'connecting' && <div className="demo-banner"><b>Connecting to ZKas mainnet.</b> Waiting for the first public API snapshot. {error && <span>{error}</span>}</div>}

        {tab === 'intelligence' && (
          <IntelligenceHome data={data} txValues={txValues} pulseTimes={pulseTimes} onReference={() => setTab('reference')} />
        )}

        {tab === 'merged' && <MergedIntelligencePage data={data} />}
        {tab === 'health' && <NetworkHealthPage data={data} diffValues={diffValues} txValues={txValues} pulseTimes={pulseTimes} onOpenNodes={() => setTab('nodes')} />}
        {tab === 'nodes' && <NodesPage data={data} />}
        {tab === 'events' && <EventsPage data={data} history={history} />}
        {tab === 'history' && <HistoryPage data={data} history={history} range={historyRange} onRange={setHistoryRange} />}
        {tab === 'supply' && <SupplyPrivacyPage data={data} history={history} range={historyRange} onRange={setHistoryRange} />}
        {tab === 'reference' && <ReferencePage data={data} txs={txs} onSelect={(value) => void doSearch(value)} />}
      </main>

      <footer>
        <div className="footer-brand"><ShieldCheck size={17} /> ZKAS Stream <span>v0.6.14</span></div>
        <div>Merged-mining & network intelligence • Public data only • Explorer reference included</div>
      </footer>

      {detail && <DetailDrawer detail={detail} onClose={() => setDetail(null)} />}
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
        <div><span className="panel-icon"><Network size={20} /></span><h2>Mining producer & hashrate distribution</h2></div>
        <div className="distribution-range-tabs" role="group" aria-label="Hashrate distribution range">
          {(['1h', '6h', '12h'] as MiningDistributionWindow[]).map((range) => (
            <button key={range} type="button" className={windowRange === range ? 'active' : ''} onClick={() => setWindowRange(range)}>{range}</button>
          ))}
        </div>
      </div>
      <p className="distribution-intro">Observed block-producer share from public coinbase attribution. Named pools remain named; unidentified payout addresses remain unidentified.</p>

      {official ? <>
        <div className="distribution-summary-grid">
          <div><span>Blocks measured</span><b>{displayNumber(distribution.blocksMeasured, true)}</b><small>whole DAG, not just the chain</small></div>
          <div><span>Producers</span><b>{displayNumber(distribution.producerCount)}</b><small>{distribution.distinctAddresses ?? distribution.producerCount} payout addresses</small></div>
          <div><span>Largest</span><b>{displayMiningPercent(distribution.largestSharePercent)}</b><small>{producerLabel(distribution.producers[0])}</small></div>
          <div><span>Network hashrate</span><b>{displayHashrate(networkHashrate)}</b><small>consensus work estimate</small></div>
          <div><span>Window</span><b>{windowText}</b><small>{distribution.majorityCount === null ? 'majority unavailable' : `${distribution.majorityCount} producer${distribution.majorityCount === 1 ? '' : 's'} to majority`}</small></div>
        </div>
        <div className="distribution-bars">
          {rows.map((row, index) => {
            const share = row.sharePercent ?? 0;
            return <div className="distribution-row" key={row.key}>
              <div className="distribution-row-label">
                <span className="distribution-rank">{index + 1}</span>
                <div><b>{producerLabel(row)}</b><small>{row.source === 'tag' ? 'named itself in its coinbase' : row.source === 'known' ? 'published payout address' : row.source === 'derived' ? 'linked via merge-mining proof' : 'no self-declared name'}{row.addresses && row.addresses > 1 ? ` · ${row.addresses} addresses` : ''}</small></div>
              </div>
              <div className="distribution-row-value"><b>{displayMiningPercent(row.sharePercent)}</b><small>{row.blocks === null ? 'block count unavailable' : `${displayNumber(row.blocks, true)} blocks`}</small></div>
              <i className="distribution-track"><span style={{ width: `${Math.max(1.5, Math.min(100, share))}%` }} /></i>
            </div>;
          })}
          {distribution.producers.length > rows.length && <div className="distribution-tail">+ {distribution.producers.length - rows.length} additional observed producers</div>}
        </div>
        <p className="source-note"><ShieldCheck size={15} /> Distribution is inferred from the producer/payout identity each observed block publicly names in its coinbase. This measures block-production share over the selected window; it does not enumerate individual ASICs or prove how many people operate behind a pool.</p>
      </> : <div className="distribution-unavailable">
        <Network size={24} />
        <div><b>{loading ? 'Loading public producer distribution…' : 'Official miner-distribution feed is temporarily unavailable'}</b><span>ZKAS.stream keeps the rest of the merged-mining and solo intelligence live while the explorer feed retries.</span></div>
      </div>}
    </section>
  );
}

function SoloMiningIntelligence({ data }: { data: DashboardData }) {
  const [minerHashrate, setMinerHashrate] = useState('1');
  const [hashUnit, setHashUnit] = useState<SoloHashUnit>('TH/s');

  const entered = Number(minerHashrate);
  const minerHps = Number.isFinite(entered) && entered > 0 ? entered * SOLO_HASH_SCALES[hashUnit] : null;
  const networkHps = data.hashrate !== null && data.hashrate > 0 ? data.hashrate : null;
  const liveBps = data.bps !== null && data.bps > 0 ? data.bps : null;
  const grossReward = validNumber(data.reward);
  const payout = minerPayout(grossReward);
  const nextPayout = minerPayout(validNumber(data.nextReward));

  const shareFraction = minerHps !== null && networkHps !== null ? Math.min(1, minerHps / networkHps) : null;
  const sharePct = shareFraction === null ? null : shareFraction * 100;
  const expectedBlocksDay = shareFraction !== null && liveBps !== null ? shareFraction * liveBps * 86400 : null;
  const expectedSeconds = expectedBlocksDay !== null && expectedBlocksDay > 0 ? 86400 / expectedBlocksDay : null;
  const chance24h = expectedBlocksDay === null ? null : (1 - Math.exp(-expectedBlocksDay)) * 100;
  const chance7d = expectedBlocksDay === null ? null : (1 - Math.exp(-expectedBlocksDay * 7)) * 100;
  const expectedPayoutDay = expectedBlocksDay !== null && payout !== null ? expectedBlocksDay * payout : null;

  return (
    <section className="solo-mining-section">
      <section className="panel solo-mining-panel">
        <div className="panel-head">
          <div><span className="panel-icon"><Gauge size={20} /></span><h2>Solo mining intelligence</h2></div>
          <span className="range-chip">LOCAL CALCULATOR</span>
        </div>
        <p className="solo-intro">Estimate solo-mining odds from the live public ZKas network conditions. Enter only hashrate; the calculator runs in this browser and does not connect to a wallet, worker or miner.</p>

        <div className="solo-controls">
          <label>
            <span>Your hashrate</span>
            <div className="solo-input-wrap">
              <input inputMode="decimal" type="number" min="0" step="any" value={minerHashrate} onChange={(e) => setMinerHashrate(e.target.value)} aria-label="Your mining hashrate" />
              <select value={hashUnit} onChange={(e) => setHashUnit(e.target.value as SoloHashUnit)} aria-label="Hashrate unit">
                <option>GH/s</option><option>TH/s</option><option>PH/s</option>
              </select>
            </div>
          </label>
          <div className="solo-live-condition"><span>Network hashrate</span><b>{displayHashrate(networkHps)}</b><small>public consensus work estimate</small></div>
          <div className="solo-live-condition"><span>Block flow</span><b>{liveBps === null ? '—' : `${fmt.format(liveBps)} BPS`}</b><small>observed public rate</small></div>
          <div className="solo-live-condition"><span>Difficulty</span><b>{displayNumber(data.difficulty, true)}</b><small>current consensus target difficulty</small></div>
          <div className="solo-live-condition"><span>Current miner payout</span><b>{payout === null ? '—' : `${fmt.format(payout)} ZKAS`}</b><small>95% of gross block emission</small></div>
        </div>

        <div className="solo-result-grid">
          <div><span>Estimated network share</span><b>{displayMiningPercent(sharePct)}</b><small>chosen hashrate ÷ network estimate</small></div>
          <div><span>Average time to a block</span><b>{expectedSeconds === null ? '—' : duration(expectedSeconds)}</b><small>statistical average, not a countdown</small></div>
          <div><span>Expected blocks / day</span><b>{displayMiningEstimate(expectedBlocksDay)}</b><small>long-run expectation</small></div>
          <div><span>Chance ≥1 block in 24h</span><b>{displayMiningPercent(chance24h)}</b><small>Poisson estimate</small></div>
          <div><span>Chance ≥1 block in 7d</span><b>{displayMiningPercent(chance7d)}</b><small>Poisson estimate</small></div>
          <div><span>Expected ZKAS / day</span><b>{displayMiningEstimate(expectedPayoutDay, ' ZKAS')}</b><small>probability-weighted, not guaranteed</small></div>
        </div>

        <div className="solo-reward-strip">
          <div><span>Gross block emission</span><b>{grossReward === null ? '—' : `${fmt.format(grossReward)} ZKAS`}</b></div>
          <div><span>Miner payout (95%)</span><b>{payout === null ? '—' : `${fmt.format(payout)} ZKAS`}</b></div>
          <div><span>Development allocation (5%)</span><b>{grossReward === null ? '—' : `${fmt.format(developmentAllocation(grossReward) ?? 0)} ZKAS`}</b></div>
          <div><span>Next miner payout</span><b>{nextPayout === null ? '—' : `${fmt.format(nextPayout)} ZKAS`}</b><small>{data.nextReductionSeconds === null ? 'schedule unavailable' : `in ${countdown(data.nextReductionSeconds)}`}</small></div>
        </div>

        <p className="source-note"><ShieldCheck size={15} /> Solo estimates use the public network hashrate and observed BPS currently shown by ZKAS.stream. Mining luck is random: an average time of 3 days can still produce a block sooner, much later, or not at all during that period.</p>
      </section>

      <section className="two-col solo-info-row">
        <section className="panel solo-mode-panel">
          <div className="panel-head"><div><span className="panel-icon"><GitMerge size={20} /></span><h2>Solo, solo-merged and pool mining</h2></div></div>
          <div className="solo-mode-grid">
            <div><b>Solo ZKas</b><span>Your own node/Stratum stack submits work. You receive the miner payout only when your own hashrate finds a valid ZKas block.</span></div>
            <div><b>Solo merged mining</b><span>Your own stack also uses Kaspa parent proof-of-work for ZKas AuxPoW. The same hashing work can participate in both chains while each chain still has its own validity target and reward event.</span></div>
            <div><b>Pool mining</b><span>A pool aggregates many miners and usually pays smaller, smoother rewards according to its payout method, fees and thresholds.</span></div>
          </div>
          <p className="source-note"><ShieldCheck size={15} /> Public payout attribution does not reliably identify whether a source is a solo miner, private group or public pool unless that identity is independently known.</p>
        </section>

        <section className="panel solo-checklist-panel">
          <div className="panel-head"><div><span className="panel-icon"><Server size={20} /></span><h2>Solo-mining readiness</h2></div><span className="range-chip">CHECKLIST</span></div>
          <div className="solo-checklist">
            <div><i>1</i><span><b>Synced ZKas node</b><small>Consensus and RPC must stay current before work is served or blocks are submitted.</small></span></div>
            <div><i>2</i><span><b>Kaspa parent-work source</b><small>Required when you want the merged-mining / AuxPoW path rather than ZKas-only work.</small></span></div>
            <div><i>3</i><span><b>Stratum bridge or solo gateway</b><small>ASICs need a mining endpoint that converts node work into the protocol the miner understands.</small></span></div>
            <div><i>4</i><span><b>Payout addresses configured</b><small>Verify both ZKas and Kaspa destinations before leaving a solo stack unattended.</small></span></div>
            <div><i>5</i><span><b>Healthy share flow</b><small>Accepted shares should continue increasing; invalid and stale shares should stay low.</small></span></div>
            <div><i>6</i><span><b>Block submission + uptime monitoring</b><small>Watch submission errors, node sync, bridge health and miner connectivity—not just displayed hashrate.</small></span></div>
          </div>
        </section>
      </section>
    </section>
  );
}

function MergedIntelligencePage({ data }: { data: DashboardData }) {
  const groups = attributionGroups(data);
  const ratio = pct(data.merged.found, data.merged.checked);
  const weightedConfidence = weightedAttributionConfidence(groups);
  const topShare = fractionPercent(groups[0]?.share ?? null);
  const matched = data.merged.attributionMatched ?? (groups.reduce((sum, g) => sum + g.blocks, 0) || null);
  const mergedNodes = data.merged.nodes.filter((n) => n.kaspaDetected);
  return (
    <section className="page-stack">
      <div className="privacy-callout"><GitMerge size={21} /><div><b>Merged-mining evidence + solo estimates, kept separate</b><span>Block attribution links observed merge-mined blocks to Kaspa payout attribution; the peer co-location probe is supporting evidence. The solo calculator is probability math based on the hashrate you enter and live public network estimates—it does not identify or monitor any specific miner.</span></div></div>
      <div className="metric-grid mining-metrics attribution-metrics">
        <MetricCard icon={<Boxes size={19} />} label="Attributed blocks" value={displayNumber(matched, true)} sub="Deduplicated public pipeline" accent />
        <MetricCard icon={<GitMerge size={19} />} label="Attribution groups" value={displayNumber(groups.length || null)} sub="Unique payout groupings" />
        <MetricCard icon={<ShieldCheck size={19} />} label="Weighted confidence" value={weightedConfidence === null ? '—' : `${fmt.format(fractionPercent(weightedConfidence) ?? 0)}%`} sub="Block-weighted API confidence" />
        <MetricCard icon={<Zap size={19} />} label="Largest observed share" value={topShare === null ? '—' : `${fmt.format(topShare)}%`} sub="Of attributed blocks" />
      </div>
      <NativeMergedVisibility matched={matched} />
      <MiningDistributionPanel data={data} />
      <SoloMiningIntelligence data={data} />
      <AttributionBreakdown data={data} />
      <MergedPanel data={data} />
      <div className="metric-grid mining-metrics co-location-metrics">
        <MetricCard icon={<GitMerge size={19} />} label="Co-located peers" value={displayNumber(data.merged.found)} sub="Kaspa node detected in last probe" />
        <MetricCard icon={<Network size={19} />} label="Peers checked" value={displayNumber(data.merged.checked)} sub={`of ${displayNumber(data.merged.peers)} visible peers`} />
        <MetricCard icon={<Zap size={19} />} label="Observable co-location" value={ratio === null ? '—' : `${fmt.format(ratio)}%`} sub="Probe signal, not block share" />
        <MetricCard icon={<Clock3 size={19} />} label="Last completed probe" value={scanAge(data.merged.scannedAt)} sub="Public scanner cadence" />
      </div>
      <section className="two-col"><MergedCountryBreakdown data={data} /><MergedClientSummary nodes={mergedNodes} /></section>
      <MergedPeersTable nodes={data.merged.nodes} ports={data.merged.ports} />
    </section>
  );
}

function MergedClientSummary({ nodes }: { nodes: DashboardData['merged']['nodes'] }) {
  const groups = new Map<string, number>();
  nodes.forEach((n) => groups.set(n.userAgent || 'Unknown client', (groups.get(n.userAgent || 'Unknown client') || 0) + 1));
  const rows = [...groups.entries()].sort((a, b) => b[1] - a[1]);
  return (
    <section className="panel table-panel">
      <div className="panel-head"><div><span className="panel-icon"><Server size={20} /></span><h2>Co-located peer clients</h2></div><span className="range-chip">PUBLIC</span></div>
      <div className="table-scroll"><table><thead><tr><th>Client</th><th>Detected peers</th></tr></thead><tbody>
        {rows.map(([client, count]) => <tr key={client}><td><code className="soft-code">{client}</code></td><td>{count}</td></tr>)}
        {!rows.length && <tr><td colSpan={2} className="empty-cell">No client attribution available yet.</td></tr>}
      </tbody></table></div>
    </section>
  );
}

function MergedPeersTable({ nodes, ports }: { nodes: DashboardData['merged']['nodes']; ports: number[] }) {
  return (
    <section className="panel table-panel expanded">
      <div className="panel-head"><div><span className="panel-icon"><GitMerge size={20} /></span><h2>Visible co-location signals</h2></div><span className="privacy-chip"><ShieldCheck size={14} /> MASKED</span></div>
      <div className="table-scroll"><table><thead><tr><th>Peer</th><th>Country</th><th>Masked net</th><th>Probe</th><th>Kaspa co-location</th><th>Attributed blocks</th><th>Share</th><th>Confidence</th><th>Payout attribution</th></tr></thead><tbody>
        {nodes.map((n, i) => {
          const share = fractionPercent(n.attributionShare);
          const confidence = fractionPercent(n.attributionConfidence);
          const payout = (n.attributionAddresses ?? [])[0]?.address;
          return <tr key={`${n.id}-${i}`}><td><code className="soft-code">{short(n.id, 6)}</code></td><td>{n.countryName || n.countryCode || 'Unknown'}</td><td><code className="soft-code">{n.network || '—'}</code></td><td><span className="pill">{n.checked === null ? 'Waiting' : n.checked ? 'Checked' : 'Pending'}</span></td><td><span className={`pill ${n.kaspaDetected ? 'positive-pill' : ''}`}>{n.kaspaDetected ? 'Observed' : '—'}</span></td><td>{displayNumber(n.attributedBlocks, true)}</td><td>{share === null ? '—' : `${fmt.format(share)}%`}</td><td>{confidence === null ? '—' : `${fmt.format(confidence)}%`}</td><td><code className="soft-code">{payout ? short(payout, 8) : '—'}</code></td></tr>;
        })}
        {!nodes.length && <tr><td colSpan={9} className="empty-cell">Waiting for public merged-mining data.</td></tr>}
      </tbody></table></div>
      <p className="table-footnote">Kaspa ports scanned by the peer-probe backend: {ports.length ? ports.join(', ') : 'not reported'}. Attribution values come from the separate public block-observation pipeline; identical payout attributions can appear on multiple peer rows and are deduplicated in the share charts above.</p>
    </section>
  );
}

function NetworkHealthPage({ data, diffValues, txValues, pulseTimes, onOpenNodes }: { data: DashboardData; diffValues: Array<number | null>; txValues: Array<number | null>; pulseTimes: number[]; onOpenNodes: () => void }) {
  return (
    <section className="page-stack">
      <div className="privacy-callout"><Activity size={21} /><div><b>Observed health signals, not an authoritative global score</b><span>These metrics come from the public explorer vantage point and consensus data. They are intended to show changes and anomalies without claiming to see every node on the network.</span></div></div>
      <div className="metric-grid nodes-metrics">
        <MetricCard icon={<Activity size={19} />} label="BPS" value={displayNumber(data.bps)} sub="15m block flow" accent />
        <MetricCard icon={<Gauge size={19} />} label="Hashrate" value={displayHashrate(data.hashrate)} sub="Consensus work estimate" />
        <MetricCard icon={<Gauge size={19} />} label="Difficulty" value={displayNumber(data.difficulty, true)} sub="Current difficulty" />
        <MetricCard icon={<Server size={19} />} label="Active peers" value={displayNumber(data.relay.activePeers ?? data.nodes)} sub="Public node metric" />
        <MetricCard icon={<Boxes size={19} />} label="Tip hashes" value={displayNumber(data.relay.tipHashes)} sub="Consensus tips" />
        <MetricCard icon={<Database size={19} />} label="Mempool" value={displayNumber(data.mempool)} sub="Transactions waiting" />
        <MetricCard icon={<Globe2 size={19} />} label="Countries" value={displayNumber(data.publicNodes.totals.countries)} sub="Visible geography" />
        <MetricCard icon={<Network size={19} />} label="Visible nodes" value={displayNumber(data.publicNodes.totals.nodes ?? data.nodes)} sub="Explorer vantage point" />
      </div>
      <section className="two-col">
        <div className="panel"><div className="panel-head"><div><span className="panel-icon"><Gauge size={20} /></span><h2>Difficulty signal</h2></div><span className="range-chip">15M</span></div><SparkChart values={diffValues} labels={pulseTimes} height={240} /></div>
        <div className="panel"><div className="panel-head"><div><span className="panel-icon"><Waves size={20} /></span><h2>Transaction signal</h2></div><span className="range-chip">15M</span></div><SparkChart values={txValues} labels={pulseTimes} height={240} /></div>
      </section>
      <PublicNodeSummary data={data} onOpen={onOpenNodes} />
      <section className="two-col"><CountriesTable data={data} /><NodeClientSummary nodes={data.publicNodes.nodes} /></section>
    </section>
  );
}


type NetworkEvent = {
  key: string;
  title: string;
  detail: string;
  tone: 'info' | 'positive' | 'watch';
};

function percentMove(current: number | null, baseline: number | null) {
  if (current === null || baseline === null || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function signedPercent(value: number | null) {
  if (value === null) return '—';
  return `${value >= 0 ? '+' : ''}${fmt.format(value)}%`;
}

function buildNetworkEvents(data: DashboardData, history: HistorySnapshot[]): NetworkEvent[] {
  const now = Date.now();
  const lastHour = history.filter((row) => row.t >= now - 60 * 60 * 1000).sort((a, b) => a.t - b.t);
  const baseline = lastHour[0] ?? null;
  const groups = attributionGroups(data);
  const attributedNow = data.merged.attributionMatched ?? (groups.reduce((sum, row) => sum + row.blocks, 0) || null);
  const topShareNow = fractionPercent(groups[0]?.share ?? null);
  const currentNodes = validNumber(data.publicNodes.totals.nodes ?? data.nodes);
  const hashrateMove = percentMove(validNumber(data.hashrate), baseline?.hashrate ?? null);
  const nodeMove = baseline?.visibleNodes !== null && baseline?.visibleNodes !== undefined && currentNodes !== null
    ? currentNodes - baseline.visibleNodes
    : null;
  const attributedMove = baseline?.attributedBlocks !== null && baseline?.attributedBlocks !== undefined && attributedNow !== null
    ? attributedNow - baseline.attributedBlocks
    : null;
  const shareMove = baseline?.largestSharePct !== null && baseline?.largestSharePct !== undefined && topShareNow !== null
    ? topShareNow - baseline.largestSharePct
    : null;
  const events: NetworkEvent[] = [];

  if (data.nextReductionSeconds !== null && data.nextReductionSeconds <= 48 * 60 * 60) {
    const nextMiner = minerPayout(data.nextReward);
    events.push({
      key: 'reward-step',
      title: 'Emission step approaching',
      detail: `${countdown(data.nextReductionSeconds)} until the next gross reward of ${data.nextReward === null ? '—' : `${fmt.format(data.nextReward)} ZKAS`}${nextMiner === null ? '' : ` (${fmt.format(nextMiner)} ZKAS miner payout)`}.`,
      tone: data.nextReductionSeconds <= 6 * 60 * 60 ? 'watch' : 'info',
    });
  }

  if (hashrateMove !== null) {
    events.push({
      key: 'hashrate',
      title: `Network work ${Math.abs(hashrateMove) < 1 ? 'holding steady' : hashrateMove > 0 ? 'increased' : 'decreased'}`,
      detail: `${signedPercent(hashrateMove)} versus the earliest ZKAS.stream observer snapshot available in the last hour. Current estimate: ${displayHashrate(data.hashrate)}.`,
      tone: Math.abs(hashrateMove) >= 10 ? 'watch' : Math.abs(hashrateMove) < 1 ? 'positive' : 'info',
    });
  }

  if (nodeMove !== null) {
    events.push({
      key: 'nodes',
      title: nodeMove === 0 ? 'Visible peer set unchanged' : `Visible nodes ${nodeMove > 0 ? 'increased' : 'decreased'}`,
      detail: `${nodeMove > 0 ? '+' : ''}${nodeMove} from the earliest observer snapshot in the last hour; ${displayNumber(currentNodes)} visible now from the explorer vantage point.`,
      tone: Math.abs(nodeMove) >= 6 ? 'watch' : nodeMove === 0 ? 'positive' : 'info',
    });
  }

  if (attributedMove !== null) {
    events.push({
      key: 'attribution',
      title: attributedMove > 0 ? 'New merge-mining attribution observed' : 'Attribution total unchanged',
      detail: `${attributedMove > 0 ? '+' : ''}${displayNumber(attributedMove, true)} attributed blocks since the earliest observer snapshot in the last hour; ${displayNumber(attributedNow, true)} currently matched.`,
      tone: attributedMove > 0 ? 'positive' : 'info',
    });
  }

  if (shareMove !== null) {
    events.push({
      key: 'share',
      title: 'Largest observed attribution share moved',
      detail: `${shareMove >= 0 ? '+' : ''}${fmt.format(shareMove)} percentage points over the available last-hour observer window; largest observed share is ${topShareNow === null ? '—' : `${fmt.format(topShareNow)}%`}.`,
      tone: Math.abs(shareMove) >= 5 ? 'watch' : 'info',
    });
  }

  const scanSeconds = data.merged.scannedAt
    ? Math.max(0, Math.floor(Date.now() / 1000) - (data.merged.scannedAt > 10_000_000_000 ? Math.floor(data.merged.scannedAt / 1000) : data.merged.scannedAt))
    : null;
  if (scanSeconds !== null) {
    events.push({
      key: 'co-location',
      title: scanSeconds > 20 * 60 ? 'Peer co-location scan is aging' : 'Peer co-location scan current',
      detail: `${scanAge(data.merged.scannedAt)} · ${displayNumber(data.merged.found)} Kaspa co-located peers observed from ${displayNumber(data.merged.checked)} checked.`,
      tone: scanSeconds > 20 * 60 ? 'watch' : 'positive',
    });
  }

  const tipCount = data.relay.tipHashes;
  if (tipCount !== null) {
    events.push({
      key: 'tips',
      title: `${displayNumber(tipCount)} consensus tip${tipCount === 1 ? '' : 's'} visible`,
      detail: 'BlockDAG tips are a live consensus metric; multiple tips are normal on a DAG and are not automatically an error.',
      tone: 'info',
    });
  }

  if (data.mempool !== null) {
    events.push({
      key: 'mempool',
      title: data.mempool > 0 ? 'Transactions waiting in mempool' : 'Mempool currently clear',
      detail: `${displayNumber(data.mempool)} transaction${data.mempool === 1 ? '' : 's'} waiting at the public explorer node.`,
      tone: data.mempool > 25 ? 'watch' : 'info',
    });
  }

  return events.slice(0, 8);
}

function EventsPage({ data, history }: { data: DashboardData; history: HistorySnapshot[] }) {
  const events = useMemo(() => buildNetworkEvents(data, history), [data, history]);
  const recentBlocks = data.blocks.slice(0, 8);

  return (
    <section className="page-stack">
      <div className="privacy-callout">
        <Activity size={21} />
        <div>
          <b>Live event intelligence — stable public signals only</b>
          <span>
            This page tracks consensus, block flow, peer changes, merged-mining attribution and ZKAS.stream observer events.
            It intentionally does not reconstruct an animated live BlockDAG from intermittent block-relationship endpoints.
          </span>
        </div>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><span className="panel-icon"><Activity size={20} /></span><h2>Event intelligence</h2></div>
          <span className="range-chip">LIVE + OBSERVED</span>
        </div>
        <p className="source-note" style={{ marginTop: 0 }}>
          <ShieldCheck size={15} /> Events combine current consensus/public-API data with ZKAS.stream observer snapshots.
          They describe observed changes, not authoritative network-wide incidents.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12, marginTop: 16 }}>
          {events.map((event) => <EventCard key={event.key} event={event} />)}
          {!events.length && <div className="empty-mini">Collecting enough observer data to describe network changes.</div>}
        </div>
      </section>

      <div className="metric-grid nodes-metrics">
        <MetricCard icon={<Boxes size={19} />} label="Recent public blocks" value={displayNumber(data.blocks.length)} sub="Latest explorer snapshot" accent />
        <MetricCard icon={<Network size={19} />} label="Consensus tips" value={displayNumber(data.relay.tipHashes)} sub="Current public node metric" />
        <MetricCard icon={<Activity size={19} />} label="BPS" value={displayNumber(data.bps)} sub="15m observed block flow" />
        <MetricCard icon={<Database size={19} />} label="Mempool" value={displayNumber(data.mempool)} sub="Transactions waiting" />
      </div>

      <section className="panel table-panel">
        <div className="panel-head">
          <div><span className="panel-icon"><Boxes size={20} /></span><h2>Recent public block activity</h2></div>
          <span className="live-mini"><i /> LIVE SNAPSHOT</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Hash</th><th>Age</th><th>DAA</th><th>Blue score</th><th>Txs</th><th>Difficulty</th></tr></thead>
            <tbody>
              {recentBlocks.map((block, index) => (
                <tr key={`${block.hash}-${index}`}>
                  <td><code className="soft-code">{short(block.hash, 8)}</code></td>
                  <td>{age(block.timestamp)}</td>
                  <td>{displayNumber(block.daaScore, true)}</td>
                  <td>{displayNumber(block.blueScore, true)}</td>
                  <td><span className="pill">{block.txCount}</span></td>
                  <td>{displayNumber(block.difficulty, true)}</td>
                </tr>
              ))}
              {!recentBlocks.length && <tr><td colSpan={6} className="empty-cell">Waiting for recent public block data.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="table-footnote">
          This is a stable recent-block snapshot, not a reconstructed live DAG. Parent relationships are intentionally omitted.
        </p>
      </section>
    </section>
  );
}

function EventCard({ event }: { event: NetworkEvent }) {
  const tone = event.tone === 'watch'
    ? { border: 'rgba(202, 139, 20, .35)', bg: 'rgba(202, 139, 20, .07)', dot: '#c58b18' }
    : event.tone === 'positive'
      ? { border: 'rgba(11, 158, 130, .35)', bg: 'rgba(11, 158, 130, .07)', dot: '#0b9e82' }
      : { border: 'rgba(105, 92, 255, .28)', bg: 'rgba(105, 92, 255, .05)', dot: '#6d5dfc' };
  return (
    <div style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: 16, padding: '15px 16px', minHeight: 112 }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 8 }}><i style={{ width: 8, height: 8, borderRadius: 999, background: tone.dot, display: 'block' }} /><b>{event.title}</b></div>
      <span style={{ display: 'block', opacity: .72, lineHeight: 1.45, fontSize: 13 }}>{event.detail}</span>
    </div>
  );
}

function HistoryPage({ data, history, range, onRange }: { data: DashboardData; history: HistorySnapshot[]; range: HistoryRange; onRange: (range: HistoryRange) => void }) {
  const cutoff = Date.now() - rangeMs(range);
  const rows = history.filter((row) => row.t >= cutoff);
  const first = rows[0] ?? null;
  const last = rows.at(-1) ?? null;
  const oldest = history[0]?.t ?? null;
  const sampleSpan = first && last ? Math.max(0, last.t - first.t) : 0;
  const pointsExpected = Math.max(1, Math.floor(rangeMs(range) / HISTORY_SAMPLE_MS));
  const coverage = Math.min(100, (rows.length / pointsExpected) * 100);
  const ranges: HistoryRange[] = ['1h', '24h', '7d', '30d'];

  const chainWork = (data.chainWorkHistory ?? []).filter((point) => point.time >= cutoff);
  const hashrateSeries = combinedChainSeries(
    rows.map((row) => ({ time: row.t, value: row.hashrate })),
    chainWork.map((point) => ({ time: point.time, value: point.hashrate })),
    cutoff,
  );
  const difficultySeries = combinedChainSeries(
    rows.map((row) => ({ time: row.t, value: row.difficulty })),
    chainWork.map((point) => ({ time: point.time, value: point.difficulty })),
    cutoff,
  );

  const hashrateDelta = seriesDelta(hashrateSeries);
  const difficultyDelta = seriesDelta(difficultySeries);
  const nodesDelta = deltaAbsolute(first?.visibleNodes ?? null, last?.visibleNodes ?? null);
  const attributedDelta = deltaAbsolute(first?.attributedBlocks ?? null, last?.attributedBlocks ?? null);
  const shareDelta = deltaAbsolute(first?.largestSharePct ?? null, last?.largestSharePct ?? null);
  const coLocationDelta = deltaAbsolute(first?.coLocationPct ?? null, last?.coLocationPct ?? null);
  const chainSpan = Math.max(seriesSpan(hashrateSeries), seriesSpan(difficultySeries));
  const chainSamples = Math.max(hashrateSeries.length, difficultySeries.length);
  const latestHashrate = hashrateSeries.at(-1)?.value ?? last?.hashrate ?? null;
  const latestDifficulty = difficultySeries.at(-1)?.value ?? last?.difficulty ?? null;
  const observerStarted = oldest ? dateStamp(oldest) : 'Not started';

  return (
    <section className="page-stack history-page">
      <div className="privacy-callout"><History size={21} /><div><b>Historical intelligence, with source boundaries</b><span>Chain-reconstructable work data and observer-only network data are kept separate. ZKAS.stream never invents peer, geography, attribution or co-location history from before it was actually observed.</span></div></div>

      <section className="two-col">
        <div className="privacy-callout">
          <TrendingUp size={21} />
          <div><b>CHAIN BACKFILL · HASHRATE + DIFFICULTY</b><span>The public ZKas explorer reconstructs compact work-history bins from selected-parent chain data. The current public backend seeds up to the most recent 24 hours, so these two charts can fill immediately instead of starting from zero today.</span></div>
        </div>
        <div className="privacy-callout">
          <Network size={21} />
          <div><b>OBSERVER HISTORY · TRACKING BEGAN {observerStarted.toUpperCase()}</b><span>Visible nodes, countries, mining attribution, confidence and Kaspa co-location are observations from an explorer vantage point. Their history begins when ZKAS.stream recorded them and is not retroactively fabricated.</span></div>
        </div>
      </section>

      <section className="panel history-toolbar">
        <div>
          <span className="eyebrow">TIME RANGE</span>
          <h2>{range.toUpperCase()} intelligence</h2>
          <p>
            {rows.length >= 2 ? `${rows.length} observer snapshots · ${duration(sampleSpan / 1000)} observed span` : 'Observer history is still collecting.'}
            {chainSamples >= 2 ? ` · ${chainSamples} chain-work samples · ${duration(chainSpan / 1000)} chain span` : ''}
          </p>
        </div>
        <div className="history-range-tabs">
          {ranges.map((value) => <button key={value} className={range === value ? 'active' : ''} onClick={() => onRange(value)}>{value.toUpperCase()}</button>)}
        </div>
      </section>

      <div className="metric-grid history-metrics">
        <HistoryMetric icon={<Gauge size={19} />} label="Hashrate" value={displayHashrate(latestHashrate)} delta={hashrateDelta === null ? 'Chain history loading' : `${signed(hashrateDelta)} · chain-derived`} />
        <HistoryMetric icon={<Gauge size={19} />} label="Difficulty" value={displayNumber(latestDifficulty, true)} delta={difficultyDelta === null ? 'Chain history loading' : `${signed(difficultyDelta)} · chain-derived`} />
        <HistoryMetric icon={<Network size={19} />} label="Visible nodes" value={displayNumber(last?.visibleNodes ?? null)} delta={signed(nodesDelta, '')} />
        <HistoryMetric icon={<GitMerge size={19} />} label="Attributed blocks" value={displayNumber(last?.attributedBlocks ?? null, true)} delta={signed(attributedDelta, '')} />
        <HistoryMetric icon={<TrendingUp size={19} />} label="Largest observed share" value={last?.largestSharePct === null || last?.largestSharePct === undefined ? '—' : `${fmt.format(last.largestSharePct)}%`} delta={shareDelta === null ? 'Collecting observer history' : `${signed(shareDelta, '')} pts`} />
        <HistoryMetric icon={<ShieldCheck size={19} />} label="Weighted confidence" value={last?.weightedConfidencePct === null || last?.weightedConfidencePct === undefined ? '—' : `${fmt.format(last.weightedConfidencePct)}%`} delta="Observer-tracked attribution confidence" />
        <HistoryMetric icon={<Zap size={19} />} label="Observable co-location" value={last?.coLocationPct === null || last?.coLocationPct === undefined ? '—' : `${fmt.format(last.coLocationPct)}%`} delta={coLocationDelta === null ? 'Collecting observer history' : `${signed(coLocationDelta, '')} pts`} />
        <HistoryMetric icon={<Server size={19} />} label="Co-located peers" value={displayNumber(last?.coLocatedPeers ?? null)} delta={last?.peersChecked ? `${displayNumber(last.coLocatedPeers)} of ${displayNumber(last.peersChecked)} checked · observer history` : 'Observer history'} />
      </div>

      <section className="two-col history-charts">
        <HistoryChart title="Network hashrate · chain backfill" chip={range.toUpperCase()} values={hashrateSeries.map((point) => point.value)} labels={hashrateSeries.map((point) => point.time)} />
        <HistoryChart title="Difficulty · chain backfill" chip={range.toUpperCase()} values={difficultySeries.map((point) => point.value)} labels={difficultySeries.map((point) => point.time)} />
        <HistoryChart title="Visible nodes · observer history" chip={range.toUpperCase()} values={rows.map((row) => row.visibleNodes)} labels={rows.map((row) => row.t)} />
        <HistoryChart title="Largest attributed share · observer history" chip={range.toUpperCase()} values={rows.map((row) => row.largestSharePct)} labels={rows.map((row) => row.t)} />
        <HistoryChart title="Observable co-location · observer history" chip={range.toUpperCase()} values={rows.map((row) => row.coLocationPct)} labels={rows.map((row) => row.t)} />
        <HistoryChart title="Attributed blocks · observer history" chip={range.toUpperCase()} values={rows.map((row) => row.attributedBlocks)} labels={rows.map((row) => row.t)} />
      </section>

      <section className="panel history-storage">
        <div className="panel-head"><div><span className="panel-icon"><Database size={20} /></span><h2>History source status</h2></div><span className="range-chip">HYBRID</span></div>
        <div className="merge-stats node-stats">
          <div><span>Observer snapshots</span><b>{displayNumber(history.length)}</b></div>
          <div><span>Observer tracking since</span><b>{oldest ? dateStamp(oldest) : 'Just started'}</b></div>
          <div><span>Chain-work samples</span><b>{displayNumber((data.chainWorkHistory ?? []).length)}</b></div>
          <div><span>Chain backfill span</span><b>{chainSpan > 0 ? duration(chainSpan / 1000) : 'Loading'}</b></div>
          <div><span>Observer coverage</span><b>{rows.length ? `${fmt.format(coverage)}%` : '0%'}</b></div>
          <div><span>Local retention</span><b>30 days</b></div>
        </div>
        <p className="source-note"><ShieldCheck size={15} /> Current public API limitation: chain-work backfill is available for roughly the last 24 hours, not mainnet day one. Extending trustworthy chain backfill to 7D/30D/launch requires a longer historical endpoint or archival backend. Observer-only metrics remain truthful from their recorded start date.</p>
      </section>
    </section>
  );
}

function HistoryMetric({ icon, label, value, delta }: { icon: ReactNode; label: string; value: string; delta: string }) {
  return (
    <section className="panel history-metric">
      <div className="history-metric-label"><span>{icon}</span><b>{label}</b></div>
      <strong>{value}</strong>
      <small>{delta}</small>
    </section>
  );
}

function HistoryChart({ title, chip, values, labels }: { title: string; chip: string; values: Array<number | null>; labels: number[] }) {
  return (
    <section className="panel">
      <div className="panel-head"><div><span className="panel-icon"><TrendingUp size={20} /></span><h2>{title}</h2></div><span className="range-chip">{chip}</span></div>
      <SparkChart values={values} labels={labels} height={230} />
    </section>
  );
}

function SupplyPrivacyPage({ data, history, range, onRange }: { data: DashboardData; history: HistorySnapshot[]; range: HistoryRange; onRange: (range: HistoryRange) => void }) {
  const cutoff = Date.now() - rangeMs(range);
  const rows = history.filter((row) => row.t >= cutoff);
  const first = rows[0];
  const last = rows.at(-1);
  const ranges: HistoryRange[] = ['1h', '24h', '7d', '30d'];

  const supplyDelta = first?.supply != null && last?.supply != null ? last.supply - first.supply : null;
  const notesDelta = first?.shieldedNotes != null && last?.shieldedNotes != null && last.shieldedNotes >= first.shieldedNotes ? last.shieldedNotes - first.shieldedNotes : null;
  const nullifierReset = first?.nullifiers != null && last?.nullifiers != null && last.nullifiers < first.nullifiers;
  const nullifierDelta = first?.nullifiers != null && last?.nullifiers != null && !nullifierReset ? last.nullifiers - first.nullifiers : null;

  return (
    <section className="page-stack">
      <div className="privacy-callout"><ShieldCheck size={21} /><div><b>Supply intelligence without a rich list</b><span>ZKas is shielded by design. This page reports public consensus supply, reward schedule and aggregate shielded-pool activity without claiming to identify holders, balances, senders, recipients or transfer amounts.</span></div></div>

      <div className="history-range-tabs">
        {ranges.map((item) => <button key={item} className={range === item ? 'on' : ''} onClick={() => onRange(item)}>{item.toUpperCase()}</button>)}
      </div>

      <div className="metric-grid nodes-metrics">
        <MetricCard icon={<Coins size={19} />} label="Circulating supply" value={displayNumber(data.supply, true)} sub={supplyDelta === null ? 'Consensus-derived issued supply' : `${signed(supplyDelta, ' ZKAS')} in selected observer window`} />
        <MetricCard icon={<CircleDollarSign size={19} />} label="Gross block emission" value={data.reward === null ? '—' : `${displayNumber(data.reward)} ZKAS`} sub="Consensus emission per block" />
        <MetricCard icon={<Coins size={19} />} label="Miner payout (95%)" value={minerPayout(data.reward) === null ? '—' : `${displayNumber(minerPayout(data.reward))} ZKAS`} sub="Expected accepted-block miner credit" />
        <MetricCard icon={<CircleDollarSign size={19} />} label="Development allocation (5%)" value={developmentAllocation(data.reward) === null ? '—' : `${displayNumber(developmentAllocation(data.reward))} ZKAS`} sub="Per accepted block" />
        <MetricCard icon={<TimerReset size={19} />} label="Next reduction" value={countdown(data.nextReductionSeconds)} sub={data.nextReward === null ? 'Consensus schedule' : `Next gross ${displayNumber(data.nextReward)} · miner ${displayNumber(minerPayout(data.nextReward))} ZKAS`} />
        <MetricCard icon={<LockKeyhole size={19} />} label="Shielded notes" value={displayNumber(data.shieldedNotes, true)} sub={notesDelta === null ? 'Backend-observed aggregate' : `+${displayNumber(notesDelta, true)} in selected window`} />
        <MetricCard icon={<LockKeyhole size={19} />} label="Nullifiers / spends" value={displayNumber(data.nullifiers, true)} sub={nullifierReset ? 'Backend counter reset observed' : nullifierDelta === null ? 'Backend-observed aggregate' : `+${displayNumber(nullifierDelta, true)} in selected window`} />
        <MetricCard icon={<Database size={19} />} label="Cumulative shielded issuance" value={displayNumber(data.shieldedValue ?? data.supply, true)} sub="Consensus-derived aggregate · not wallet balances" />
      </div>

      <section className="two-col">
        <div className="panel">
          <div className="panel-head"><div><span className="panel-icon"><TrendingUp size={20} /></span><h2>Supply growth · observer history</h2></div><span className="range-chip">{range.toUpperCase()}</span></div>
          <HistoryChart title="Circulating ZKAS" chip="CONSENSUS SUPPLY" values={rows.map((row) => row.supply ?? null)} labels={rows.map((row) => row.t)} />
        </div>
        <div className="panel">
          <div className="panel-head"><div><span className="panel-icon"><LockKeyhole size={20} /></span><h2>Shielded activity · observer history</h2></div><span className="range-chip">{range.toUpperCase()}</span></div>
          <HistoryChart title="Shielded notes" chip="AGGREGATE" values={rows.map((row) => row.shieldedNotes ?? null)} labels={rows.map((row) => row.t)} />
          <HistoryChart title="Nullifiers / spends" chip="AGGREGATE" values={rows.map((row) => row.nullifiers ?? null)} labels={rows.map((row) => row.t)} />
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><div><span className="panel-icon"><TimerReset size={20} /></span><h2>Emission schedule</h2></div><span className="range-chip">CONSENSUS</span></div>
        <div className="merge-stats node-stats">
          <div><span>Gross block emission</span><b>{data.reward === null ? '—' : `${displayNumber(data.reward)} ZKAS`}</b></div>
          <div><span>Miner payout (95%)</span><b>{minerPayout(data.reward) === null ? '—' : `${displayNumber(minerPayout(data.reward))} ZKAS`}</b></div>
          <div><span>Development allocation (5%)</span><b>{developmentAllocation(data.reward) === null ? '—' : `${displayNumber(developmentAllocation(data.reward))} ZKAS`}</b></div>
          <div><span>Next gross emission</span><b>{data.nextReward === null ? '—' : `${displayNumber(data.nextReward)} ZKAS`}</b></div>
          <div><span>Next miner payout</span><b>{minerPayout(data.nextReward) === null ? '—' : `${displayNumber(minerPayout(data.nextReward))} ZKAS`}</b></div>
          <div><span>Next reduction</span><b>{countdown(data.nextReductionSeconds)}</b></div>
          <div><span>DAA score</span><b>{displayNumber(data.daaScore, true)}</b></div>
        </div>
        <p className="source-note"><ShieldCheck size={15} /> No annualized inflation estimate is shown. Reward and reduction values come from the public ZKas consensus/explorer API.</p>
      </section>

      <div className="reference-callout">
        <div><span className="eyebrow">PRIVACY BOUNDARY</span><h2>What this page intentionally cannot show</h2><p>Top holders, richest wallets, wallet concentration and individual address balances are not inferred. The public explorer backend does not expose a transparent rich-list dataset for the shielded-by-default chain.</p></div>
      </div>
    </section>
  );
}

function ReferencePage({ data, txs, onSelect }: { data: DashboardData; txs: Array<TxRow & { blockHash: string; timestamp: number }>; onSelect: (value: string) => void }) {
  const hasShielded = data.shieldedNotes !== null || data.nullifiers !== null || data.stateRoot !== null;
  return (
    <section className="page-stack">
      <div className="reference-callout">
        <div><span className="eyebrow">SUPPORTING REFERENCE</span><h2>Chain information in one place</h2><p>Useful ZKas chain facts stay here for convenience. ZKAS.stream does not try to duplicate every explorer feature.</p></div>
        <a className="secondary-link" href="https://explorer.zkas.info" target="_blank" rel="noreferrer">Open official ZKas Explorer ↗</a>
      </div>
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

function DetailDrawer({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  return (
    <div className="drawer-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}>
      <aside className="drawer" role="dialog" aria-modal="true" aria-label="Search result">
        <div className="drawer-head"><div><span className="eyebrow">{detail.type === 'privacy' ? 'Privacy notice' : `${detail.type} result`}</span><h2>{short(detail.query, 14)}</h2></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        {detail.type === 'privacy' ? <div className="privacy-result"><ShieldCheck size={34} /><h3>Address activity stays private</h3><p>{String((detail.data as { message?: string }).message || '')}</p></div> : <div className="detail-list">{objectEntries(detail.data).map(([key, value]) => <div key={key}><span>{key}</span><code>{value}</code></div>)}</div>}
      </aside>
    </div>
  );
}

export default App;
