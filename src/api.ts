export type TxRow = {
  id: string;
  kind: string;
  shieldedActions: number | null;
};

export type BlockRow = {
  hash: string;
  daaScore: number | null;
  blueScore: number | null;
  timestamp: number;
  difficulty: number | null;
  txCount: number;
  txs: TxRow[];
};


export type PulsePoint = {
  time: number;
  difficulty: number | null;
  blocks: number | null;
  txs: number | null;
};

export type ChainWorkPoint = {
  time: number;
  difficulty: number | null;
  hashrate: number | null;
};

export type PublicNodeRow = {
  id: string;
  countryCode: string | null;
  countryName: string | null;
  network: string | null;
  userAgent: string | null;
  protocolVersion: number | null;
  pingMs: number | null;
  outbound: boolean | null;
  connectedForSec: number | null;
  blocksRelayed: number | null;
  ibd: boolean | null;
  isSelf: boolean | null;
};

export type CountryRow = {
  code: string;
  name: string;
  count: number;
  percent: number | null;
};

export type PublicNodesData = {
  updatedAt: number | null;
  totals: {
    nodes: number | null;
    peers: number | null;
    countries: number | null;
    located: number | null;
    inbound: number | null;
    outbound: number | null;
    ipv4: number | null;
    ipv6: number | null;
    blocksRelayed: number | null;
  };
  countries: CountryRow[];
  nodes: PublicNodeRow[];
};

export type AttributionAddressRow = {
  address: string;
  blocks: number | null;
  dominance: number | null;
};

export type MergedNodeRow = {
  id: string;
  countryCode: string | null;
  countryName: string | null;
  network: string | null;
  zkasPort: number | null;
  userAgent: string | null;
  blocksRelayed: number | null;
  checked: boolean | null;
  reachable: boolean | null;
  kaspaDetected: boolean;
  kaspaAddress: string | null;
  attributed: boolean;
  attributedBlocks: number | null;
  attributionConfidence: number | null;
  attributionShare: number | null;
  attributionAddresses: AttributionAddressRow[];
};

export type RelayData = {
  activePeers: number | null;
  mempoolSize: number | null;
  tipHashes: number | null;
  difficulty: number | null;
  blocksIngested: number | null;
  transactionsProcessed: number | null;
  databaseBlocks: number | null;
};

export type DashboardData = {
  source: 'live' | 'demo';
  updatedAt: number;
  network: string;
  bps: number | null;
  nodes: number | null;
  mempool: number | null;
  hashrate: number | null;
  blockCount: number | null;
  daaScore: number | null;
  supply: number | null;
  reward: number | null;
  nextReward: number | null;
  nextReductionSeconds: number | null;
  txCount: number | null;
  shieldedNotes: number | null;
  nullifiers: number | null;
  shieldedValue: number | null;
  stateRoot: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  merged: {
    scannedAt: number | null;
    peers: number | null;
    checked: number | null;
    reachable: number | null;
    found: number | null;
    attributionMatched: number | null;
    attributionUpdatedAt: number | null;
    ports: number[];
    nodes: MergedNodeRow[];
  };
  relay: RelayData;
  difficulty: number | null;
  publicNodes: PublicNodesData;
  pulse: PulsePoint[];
  chainWorkHistory: ChainWorkPoint[];
  blocks: BlockRow[];
};


export type MiningProducerRow = {
  key: string;
  name: string | null;
  address: string | null;
  source: string | null;
  blocks: number | null;
  sharePercent: number | null;
  hashrate: number | null;
  addresses: number | null;
  selfDeclared: boolean | null;
};

export type MiningDistributionData = {
  source: 'official' | 'unavailable';
  endpoint: string | null;
  window: string;
  windowSeconds: number | null;
  blocksMeasured: number | null;
  producerCount: number | null;
  distinctAddresses: number | null;
  majorityCount: number | null;
  largestSharePercent: number | null;
  networkHashrate: number | null;
  updatedAt: number | null;
  producers: MiningProducerRow[];
};

export const API_BASE = (import.meta.env.VITE_ZKAS_API_BASE || 'https://explorer.zkas.info/api').replace(/\/$/, '');

function numberish(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function stringish(value: unknown): string | null {
  return typeof value === 'string' && value.length ? value : null;
}

function boolish(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pick(root: unknown, paths: string[]): unknown {
  for (const path of paths) {
    let cur: unknown = root;
    let ok = true;
    for (const part of path.split('.')) {
      if (!cur || typeof cur !== 'object' || !(part in (cur as Record<string, unknown>))) {
        ok = false;
        break;
      }
      cur = (cur as Record<string, unknown>)[part];
    }
    if (ok && cur !== undefined && cur !== null) return cur;
  }
  return undefined;
}

function pickNumber(root: unknown, paths: string[]) {
  return numberish(pick(root, paths));
}

function pickString(root: unknown, paths: string[]) {
  return stringish(pick(root, paths));
}

function pickBool(root: unknown, paths: string[]) {
  return boolish(pick(root, paths));
}

async function getJson(path: string, signal?: AbortSignal, timeoutMs = 8000): Promise<unknown> {
  // Give each public endpoint its own timeout. One slow endpoint should never hold
  // the entire dashboard refresh open indefinitely. DAG live polling can opt into
  // a much shorter timeout so one weak upstream response never freezes the graph.
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener('abort', forwardAbort, { once: true });

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', forwardAbort);
  }
}

function normalizeTimestamp(value: unknown): number {
  const n = numberish(value);
  if (n !== null) return n < 10_000_000_000 ? n * 1000 : n;
  const s = stringish(value);
  const parsed = s ? Date.parse(s) : NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeTx(raw: unknown, index = 0): TxRow {
  const r = obj(raw);
  const outputs = array(r.outputs);
  const shielded = outputs.find((x) => Array.isArray(x) && String(x[1]).toLowerCase().includes('shielded')) as unknown[] | undefined;
  return {
    id: pickString(r, ['txId', 'transactionId', 'transaction_id', 'id']) || 'unknown',
    kind: index === 0 ? 'Coinbase' : shielded ? 'Shielded' : 'Transaction',
    shieldedActions: shielded ? numberish(shielded[0]) : null,
  };
}

function normalizeBlock(raw: unknown): BlockRow {
  const r = obj(raw);
  const txs = array(pick(r, ['txs', 'transactions'])).map((tx, index) => normalizeTx(tx, index));
  const txCount = pickNumber(r, ['txCount', 'transactionCount', 'transactionsCount']) ?? txs.length;
  return {
    hash: pickString(r, ['block_hash', 'blockHash', 'hash']) || 'unknown',
    daaScore: pickNumber(r, ['daaScore', 'daa_score', 'verboseData.daaScore']),
    blueScore: pickNumber(r, ['blueScore', 'blue_score', 'verboseData.blueScore']),
    timestamp: normalizeTimestamp(pick(r, ['timestamp', 'time', 'header.timestamp'])),
    difficulty: pickNumber(r, ['difficulty', 'verboseData.difficulty']),
    txCount,
    txs,
  };
}

function extractBlockArray(raw: unknown): BlockRow[] {
  if (Array.isArray(raw)) return raw.map(normalizeBlock);
  const r = obj(raw);
  for (const key of ['blocks', 'data', 'items', 'results']) {
    if (Array.isArray(r[key])) return (r[key] as unknown[]).map(normalizeBlock);
  }
  return [];
}

function normalizePulse(raw: unknown, blocks: BlockRow[]): PulsePoint[] {
  const r = obj(raw);

  // Native ZKas pulse schema. These are privacy-safe aggregate bins from the
  // public explorer API. The short activity bins are 15 seconds each.
  const txBins = array(r.transactionBins).map(numberish);
  const diffBins = array(r.difficultyBins).map(numberish);
  const blockBins = array(r.blockBins).map(numberish);
  const binSeconds = pickNumber(r, ['binSeconds']) ?? 15;
  const endTime = pickNumber(r, ['timestamp']) ?? Date.now();
  const nativeLen = Math.max(txBins.length, diffBins.length, blockBins.length);
  if (nativeLen >= 2) {
    const align = (values: Array<number | null>, i: number) => {
      const sourceIndex = values.length - nativeLen + i;
      return sourceIndex >= 0 && sourceIndex < values.length ? values[sourceIndex] : null;
    };
    return Array.from({ length: nativeLen }, (_, i) => ({
      time: endTime - (nativeLen - 1 - i) * binSeconds * 1000,
      difficulty: align(diffBins, i),
      blocks: align(blockBins, i),
      txs: align(txBins, i),
    }));
  }

  const candidates = [raw, r.points, r.history, r.work, r.bins, r.data];
  for (const candidate of candidates) {
    if (!Array.isArray(candidate) || candidate.length < 2) continue;
    const parsed = candidate.map((entry) => {
      const p = obj(entry);
      return {
        time: normalizeTimestamp(pick(p, ['timestamp', 'time', 't', 'start'])),
        difficulty: pickNumber(p, ['difficulty', 'diff', 'work']),
        blocks: pickNumber(p, ['blocks', 'blockCount', 'count']),
        txs: pickNumber(p, ['transactions', 'txs', 'txCount']),
      };
    });
    if (parsed.some((p) => p.difficulty !== null || p.blocks !== null || p.txs !== null)) return parsed;
  }

  if (blocks.length > 1) {
    return [...blocks]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((b, i) => ({ time: b.timestamp, difficulty: b.difficulty, blocks: i + 1, txs: b.txCount }));
  }
  return [];
}


function normalizeChainWork(raw: unknown): ChainWorkPoint[] {
  const r = obj(raw);
  const difficulty = array(r.workDifficultyBins).map(numberish);
  const hashrate = array(r.workHashrateBins).map(numberish);
  const length = Math.max(difficulty.length, hashrate.length);
  if (length < 2) return [];

  const binSeconds = pickNumber(r, ['workBinSeconds']) ?? 360;
  const endTime = pickNumber(r, ['timestamp']) ?? Date.now();

  const align = (values: Array<number | null>, i: number) => {
    const sourceIndex = values.length - length + i;
    return sourceIndex >= 0 && sourceIndex < values.length ? values[sourceIndex] : null;
  };

  return Array.from({ length }, (_, i) => ({
    time: endTime - (length - 1 - i) * binSeconds * 1000,
    difficulty: align(difficulty, i),
    hashrate: align(hashrate, i),
  })).filter((point) => point.difficulty !== null || point.hashrate !== null);
}

function normalizePublicNodes(raw: unknown): PublicNodesData {
  const root = obj(raw);
  const totals = obj(root.totals);
  const nodeRows = array(root.nodes).map((entry): PublicNodeRow => {
    const n = obj(entry);
    return {
      id: pickString(n, ['id', 'peerId', 'peer_id']) || 'unknown',
      countryCode: pickString(n, ['country', 'countryCode', 'code']),
      countryName: pickString(n, ['countryName', 'country_name']),
      network: pickString(n, ['net', 'network', 'maskedNetwork']),
      userAgent: pickString(n, ['userAgent', 'user_agent', 'client']),
      protocolVersion: pickNumber(n, ['protocolVersion', 'protocol_version']),
      pingMs: pickNumber(n, ['pingMs', 'ping_ms']),
      outbound: pickBool(n, ['outbound', 'isOutbound']),
      connectedForSec: pickNumber(n, ['connectedForSec', 'connected_for_sec']),
      blocksRelayed: pickNumber(n, ['blocksRelayed', 'blocks_relayed']),
      ibd: pickBool(n, ['ibd', 'isIbdPeer']),
      isSelf: pickBool(n, ['isSelf', 'is_self']),
    };
  });

  const countryRows = array(root.countries).map((entry): CountryRow => {
    const c = obj(entry);
    return {
      code: pickString(c, ['code', 'country']) || '—',
      name: pickString(c, ['name', 'countryName']) || 'Unknown',
      count: pickNumber(c, ['count', 'nodes', 'value']) ?? 0,
      percent: pickNumber(c, ['percent', 'percentage', 'share']),
    };
  });

  return {
    updatedAt: pickNumber(root, ['updatedAt', 'timestamp']),
    totals: {
      nodes: pickNumber(totals, ['nodes']) ?? (nodeRows.length || null),
      peers: pickNumber(totals, ['peers', 'connectedPeers']),
      countries: pickNumber(totals, ['countries']) ?? (countryRows.length || null),
      located: pickNumber(totals, ['located']),
      inbound: pickNumber(totals, ['inbound']),
      outbound: pickNumber(totals, ['outbound']),
      ipv4: pickNumber(totals, ['ipv4']),
      ipv6: pickNumber(totals, ['ipv6']),
      blocksRelayed: pickNumber(totals, ['blocksRelayed', 'blocks_relayed']),
    },
    countries: countryRows.sort((a, b) => b.count - a.count),
    nodes: nodeRows,
  };
}

function normalizeMerged(raw: unknown) {
  const root = obj(raw);
  const rows: MergedNodeRow[] = array(root.nodes).map((entry) => {
    const n = obj(entry);
    const kaspa = pick(n, ['kaspa']);
    const mergeMinedRaw = pick(n, ['mergeMined']);
    const mergeMined = obj(mergeMinedRaw);
    const attributionAddresses: AttributionAddressRow[] = array(mergeMined.addresses).map((entry) => {
      const a = obj(entry);
      return {
        address: pickString(a, ['address']) || '',
        blocks: pickNumber(a, ['blocks']),
        dominance: pickNumber(a, ['dominance']),
      };
    }).filter((a) => a.address.length > 0);
    return {
      id: pickString(n, ['id']) || 'unknown',
      countryCode: pickString(n, ['country', 'countryCode']),
      countryName: pickString(n, ['countryName', 'country_name']),
      network: pickString(n, ['net', 'network']),
      zkasPort: pickNumber(n, ['zkasPort']),
      userAgent: pickString(n, ['userAgent', 'user_agent']),
      blocksRelayed: pickNumber(n, ['blocksRelayed', 'blocks_relayed']),
      checked: pickBool(n, ['checked']),
      reachable: pickBool(n, ['reachable']),
      kaspaDetected: Array.isArray(kaspa) ? kaspa.length > 0 : Boolean(kaspa),
      kaspaAddress: pickString(n, ['kaspaAddress']),
      attributed: Boolean(mergeMinedRaw),
      attributedBlocks: pickNumber(mergeMined, ['blocks']),
      attributionConfidence: pickNumber(mergeMined, ['confidence']),
      attributionShare: pickNumber(mergeMined, ['share']),
      attributionAddresses,
    };
  });
  const ports = array(root.ports).map(numberish).filter((v): v is number => v !== null);
  return {
    scannedAt: pickNumber(root, ['scannedAt', 'scanned_at']),
    peers: pickNumber(root, ['peers']) ?? (rows.length || null),
    checked: pickNumber(root, ['checked']) ?? (rows.filter((r) => r.checked).length || null),
    reachable: rows.length ? rows.filter((r) => r.reachable).length : null,
    found: pickNumber(root, ['merged', 'foundCount', 'mergedCount', 'peersFound']) ?? (rows.filter((r) => r.kaspaDetected).length || null),
    attributionMatched: pickNumber(root, ['attributionMatched']),
    attributionUpdatedAt: pickNumber(root, ['attribution', 'attributionUpdatedAt']),
    ports,
    nodes: rows,
  };
}

function normalizeRelay(raw: unknown): RelayData {
  const r = obj(raw);
  return {
    activePeers: pickNumber(r, ['activePeers']),
    mempoolSize: pickNumber(r, ['mempoolSize']),
    tipHashes: pickNumber(r, ['tipHashes']),
    difficulty: pickNumber(r, ['difficulty']),
    blocksIngested: pickNumber(r, ['blocksIngested']),
    transactionsProcessed: pickNumber(r, ['transactionsProcessed']),
    databaseBlocks: pickNumber(r, ['databaseBlocks']),
  };
}


function normalizeSharePercent(value: unknown): number | null {
  const n = numberish(value);
  if (n === null || !Number.isFinite(n)) return null;
  // APIs commonly report shares either as 0..1 fractions or 0..100 percentages.
  return n >= 0 && n <= 1.000001 ? n * 100 : n;
}

function normalizeHashrateValue(value: unknown, root?: Record<string, unknown>): number | null {
  const direct = numberish(value);
  if (direct !== null) return direct;
  if (typeof value === 'string') {
    const match = value.trim().match(/^([0-9.,]+)\s*([kKmMgGtTpPeE]?)\s*[hH](?:\/s|ps)?$/);
    if (match) {
      const n = Number(match[1].replace(/,/g, ''));
      if (!Number.isFinite(n)) return null;
      const scales: Record<string, number> = { '': 1, k: 1e3, m: 1e6, g: 1e9, t: 1e12, p: 1e15, e: 1e18 };
      return n * (scales[match[2].toLowerCase()] ?? 1);
    }
  }
  if (root) {
    const ph = pickNumber(root, ['networkHashratePhs', 'hashratePhs', 'networkHashratePHs']);
    if (ph !== null) return ph * 1e15;
    const th = pickNumber(root, ['networkHashrateThs', 'hashrateThs', 'networkHashrateTHs']);
    if (th !== null) return th * 1e12;
  }
  return null;
}

function objectRows(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) return null;
  return entries.map(([key, raw]) => {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { key, ...(raw as Record<string, unknown>) };
    return { key, share: raw };
  });
}

function normalizeMiningDistribution(raw: unknown, window: string, endpoint: string): MiningDistributionData | null {
  const root = obj(raw);
  const minersRaw = array(pick(root, ['miners']));
  if (!minersRaw.length) return null;

  const totalBlocks = pickNumber(root, ['windowBlocks']);
  const producers: MiningProducerRow[] = minersRaw.map((entry, index) => {
    const r = obj(entry);
    const label = pickString(r, ['label', 'name']);
    const key = pickString(r, ['key']) || `producer-${index + 1}`;
    const explicitAddress = pickString(r, ['address', 'payoutAddress', 'payout']);
    const address = explicitAddress || (key.startsWith('zkas:') ? key : null);
    const source = pickString(r, ['source']);
    const blocks = pickNumber(r, ['blocks']);
    const sharePercent = normalizeSharePercent(pick(r, ['share']));
    const hashrate = normalizeHashrateValue(pick(r, ['hashrate']));
    const addresses = pickNumber(r, ['addresses']);
    const selfDeclared = source === 'tag' ? true : source === 'unidentified' ? false : null;
    return {
      key,
      name: label,
      address,
      source,
      blocks,
      sharePercent,
      hashrate,
      addresses,
      selfDeclared,
    };
  }).filter((row) => row.sharePercent !== null || row.blocks !== null);
  if (!producers.length) return null;

  producers.sort((a, b) => (b.sharePercent ?? -1) - (a.sharePercent ?? -1));
  return {
    source: 'official',
    endpoint,
    window,
    windowSeconds: pickNumber(root, ['coveredSeconds']),
    blocksMeasured: totalBlocks,
    producerCount: producers.length,
    distinctAddresses: pickNumber(root, ['distinctAddresses']),
    majorityCount: pickNumber(root, ['nakamotoCoefficient']),
    largestSharePercent: producers[0]?.sharePercent ?? null,
    networkHashrate: normalizeHashrateValue(pick(root, ['networkHashrate']), root),
    updatedAt: pickNumber(root, ['toTimestamp']),
    producers,
  };
}

/**
 * Official explorer hashrate-distribution feed.
 * Production frontend uses GET /info/miners?window=<seconds> with
 * 3600 (1h), 21600 (6h), or 43200 (12h), refreshed every 30 seconds.
 */
export async function fetchMiningDistribution(window = '1h', signal?: AbortSignal): Promise<MiningDistributionData> {
  const seconds = window === '12h' ? 43200 : window === '6h' ? 21600 : 3600;
  const path = `/info/miners?window=${seconds}`;
  try {
    const raw = await getJson(path, signal, 5000);
    const normalized = normalizeMiningDistribution(raw, window, path);
    if (normalized) return normalized;
  } catch {
    // Keep this panel honest if the public explorer endpoint is temporarily unavailable.
  }
  return {
    source: 'unavailable', endpoint: path, window, windowSeconds: null,
    blocksMeasured: null, producerCount: null, distinctAddresses: null, majorityCount: null,
    largestSharePercent: null, networkHashrate: null, updatedAt: null, producers: [],
  };
}

export async function fetchDashboard(signal?: AbortSignal): Promise<DashboardData> {
  const endpoints = {
    dag: '/info/blockdag',
    pulse: '/info/pulse?window=24h',
    network: '/info/network',
    relay: '/info/relay',
    nodes: '/info/nodes',
    merged: '/info/merged-mining',
    supply: '/info/coinsupply',
    reward: '/info/blockreward',
    halving: '/info/halving',
    shielded: '/info/shielded',
    market: '/info/market-data',
    txCount: '/transactions/count',
    blocks: '/blocks/recent',
  } as const;

  // Do not burst all public endpoints at the server simultaneously. Fetching in
  // small batches is friendlier to the explorer API and avoids transient browser /
  // proxy connection failures from turning a healthy network into a false outage.
  const endpointEntries = Object.entries(endpoints) as Array<[keyof typeof endpoints, string]>;
  const entries: Array<readonly [keyof typeof endpoints, unknown]> = [];
  const BATCH_SIZE = 4;
  for (let i = 0; i < endpointEntries.length; i += BATCH_SIZE) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = endpointEntries.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ([key, path]) => {
        try {
          return [key, await getJson(path, signal)] as const;
        } catch {
          return [key, null] as const;
        }
      }),
    );
    entries.push(...batchResults);
  }
  const data = Object.fromEntries(entries) as Record<keyof typeof endpoints, unknown>;
  if (!data.dag && !data.blocks && !data.network) throw new Error('ZKas public API is unreachable');

  const blocks = extractBlockArray(data.blocks);
  const dag = obj(data.dag);
  const network = obj(data.network);
  const merged = normalizeMerged(data.merged);
  const relay = normalizeRelay(data.relay);
  const supply = obj(data.supply);
  const reward = obj(data.reward);
  const halving = obj(data.halving);
  const shielded = obj(data.shielded);
  const market = obj(data.market);
  const txCount = obj(data.txCount);
  const pulseRaw = obj(data.pulse);
  const publicNodes = normalizePublicNodes(data.nodes);

  const currentHashrate = (() => {
    const bins = [
      ...array(pick(pulseRaw, ['workHashrateBins'])),
      ...array(pick(pulseRaw, ['hashrateBins'])),
    ].map(numberish).filter((v): v is number => v !== null && v > 0);
    return bins.length ? bins[bins.length - 1] : null;
  })();

  const circulatingSompi = pickNumber(supply, ['circulatingSupply']);
  const circulatingZkas = circulatingSompi !== null
    ? circulatingSompi / 100_000_000
    : pickNumber(supply, ['circulating', 'supply', 'amount', 'coins']) ?? numberish(data.supply);

  const transactionTotal = (() => {
    const direct = pickNumber(txCount, ['count', 'transactions', 'total']);
    if (direct !== null) return direct;
    const coinbase = pickNumber(txCount, ['coinbase']);
    const regular = pickNumber(txCount, ['regular']);
    return coinbase !== null || regular !== null ? (coinbase ?? 0) + (regular ?? 0) : numberish(data.txCount);
  })();

  return {
    source: 'live',
    updatedAt: Date.now(),
    network: pickString(dag, ['networkName', 'network']) || pickString(network, ['networkName', 'network']) || 'zkas-mainnet',
    bps: pickNumber(pulseRaw, ['bps15m']) ?? pickNumber(dag, ['blocksPerSecond', 'bps']) ?? pickNumber(network, ['bps', 'blocksPerSecond']),
    nodes: pickNumber(network, ['nodes', 'nodeCount', 'peers']) ?? publicNodes.totals.nodes,
    mempool: relay.mempoolSize ?? pickNumber(network, ['mempoolSize', 'mempool', 'transactionsInMempool']) ?? pickNumber(dag, ['mempoolSize']),
    hashrate: pickNumber(network, ['hashrate', 'networkHashrate', 'hashRate']) ?? pickNumber(dag, ['hashrate', 'networkHashrate']) ?? currentHashrate,
    difficulty: relay.difficulty ?? pickNumber(dag, ['difficulty']),
    blockCount: pickNumber(dag, ['blockCount', 'blocks']),
    daaScore: pickNumber(dag, ['virtualDaaScore', 'daaScore', 'daa_score']) ?? (blocks[0]?.daaScore ?? null),
    supply: circulatingZkas,
    reward: pickNumber(reward, ['blockreward', 'blockReward', 'reward', 'current', 'subsidy', 'currentAmount'])
      ?? pickNumber(shielded, ['emissionPerBlock'])
      ?? numberish(data.reward),
    nextReward: pickNumber(halving, ['nextReward', 'next_reward', 'rewardAfter', 'nextSubsidy', 'nextHalvingAmount']),
    nextReductionSeconds: pickNumber(halving, ['secondsRemaining', 'seconds', 'remainingSeconds', 'countdownSeconds']) ?? (() => {
      const ts = pickNumber(halving, ['nextHalvingTimestamp']);
      return ts ? Math.max(0, ts - Math.floor(Date.now() / 1000)) : null;
    })(),
    txCount: transactionTotal,
    shieldedNotes: pickNumber(shielded, ['noteCount', 'notes', 'notesMinted', 'shieldedNotes']),
    nullifiers: pickNumber(shielded, ['nullifierCount', 'nullifiers', 'nullifiersSpent']),
    shieldedValue: (() => {
      const sompi = pickNumber(shielded, ['turnstileIn']);
      return sompi !== null ? sompi / 100_000_000 : null;
    })(),
    stateRoot: pickString(shielded, ['stateRoot', 'state_root', 'anchor']),
    priceUsd: pickNumber(market, ['priceUsd', 'price', 'usd', 'quote.USD.price']),
    marketCapUsd: pickNumber(market, ['marketCapUsd', 'marketCap', 'market_cap', 'quote.USD.market_cap']),
    merged,
    relay,
    publicNodes,
    pulse: normalizePulse(data.pulse, blocks),
    chainWorkHistory: normalizeChainWork(data.pulse),
    blocks,
  };
}

export async function searchChain(query: string, signal?: AbortSignal) {
  const q = query.trim();
  if (!q) throw new Error('Enter a block hash or transaction ID.');
  if (q.toLowerCase().startsWith('zkas:')) {
    return {
      type: 'privacy' as const,
      query: q,
      data: {
        message: 'ZKas addresses are shielded. Public address balances and transaction history are intentionally not exposed by this explorer.',
      },
    };
  }

  try {
    return { type: 'block' as const, query: q, data: await getJson(`/blocks/${encodeURIComponent(q)}`, signal) };
  } catch {
    try {
      return { type: 'transaction' as const, query: q, data: await getJson(`/transactions/${encodeURIComponent(q)}`, signal) };
    } catch {
      throw new Error('No matching block or transaction was found.');
    }
  }
}
