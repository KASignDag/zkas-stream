export type OtcTradeSide = 'buy' | 'sell' | 'unknown';
export type OtcMarketSource = 'discord' | 'telegram';

export type OtcTrade = {
  timestamp: number | null;
  side: OtcTradeSide;
  zkasAmount: number | null;
  priceKas: number | null;
  totalKas: number | null;
  makerVia?: OtcMarketSource | null;
  takerVia?: OtcMarketSource | null;
};

export type OtcFeedStatus =
  | 'live'
  | 'awaiting_configuration'
  | 'upstream_unavailable'
  | 'invalid_upstream_response';

export type OtcTradeFeed = {
  schemaVersion: 1;
  status: OtcFeedStatus;
  source: 'ronnie-api' | 'screenshot-import' | 'not-configured' | 'shared-otc-api' | 'screenshot-fallback';
  updatedAt: number;
  trades: OtcTrade[];
  message?: string;
};

export type OtcOrderMarket = 'KAS' | 'USD';

export type OtcOpenOrder = {
  market: OtcOrderMarket;
  side: 'buy' | 'sell';
  price: number;
  zkasRemaining: number;
  totalQuote: number;
  via: OtcMarketSource | null;
};

export type OtcOpenOrderFeed = {
  schemaVersion: 1;
  status: 'live' | 'upstream_unavailable';
  source: 'shared-otc-api';
  updatedAt: number;
  orders: OtcOpenOrder[];
  message?: string;
};

const excludedSharedTestTimestamps = new Set([
  1787495298851, 1787497853961, 1787498655454, 1787498871400,
  1787502384097, 1787503314996, 1787503919556, 1789721677580,
  1789721692546, 1789721715827, 1789721755210,
]);

function sharedNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value.replace(/[$,\s]/g, '')) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSharedTrade(value: unknown): OtcTrade | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const timestamp = sharedNumber(row.ts ?? row.timestamp);
  if (timestamp === null || excludedSharedTestTimestamps.has(timestamp)) return null;
  const zkasAmount = sharedNumber(row.zkas ?? row.zkasAmount);
  const totalKas = sharedNumber(row.total ?? row.totalKas);
  const priceKas = sharedNumber(row.price ?? row.priceKas) ?? (totalKas !== null && zkasAmount ? totalKas / zkasAmount : null);
  if (zkasAmount === null || totalKas === null || priceKas === null) return null;
  const side = row.makerSide === 'buy' || row.side === 'buy' ? 'buy' : row.makerSide === 'sell' || row.side === 'sell' ? 'sell' : 'unknown';
  const route = (routeValue: unknown): OtcMarketSource | null => routeValue === 'discord' || routeValue === 'telegram' ? routeValue : null;
  return { timestamp, side, zkasAmount, priceKas, totalKas, makerVia: route(row.makerVia), takerVia: route(row.takerVia) };
}

export type KasUsdQuote = {
  priceUsd: number;
  updatedAt: number;
  source: string;
};

function isFeed(value: unknown): value is OtcTradeFeed {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OtcTradeFeed>;
  return candidate.schemaVersion === 1
    && typeof candidate.status === 'string'
    && typeof candidate.updatedAt === 'number'
    && Array.isArray(candidate.trades);
}

export async function fetchOtcTrades(source: OtcMarketSource = 'discord', signal?: AbortSignal): Promise<OtcTradeFeed> {
  const response = await fetch(`/api/otc-trades?source=${source}`, {
    signal,
    headers: { Accept: 'application/json' },
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error('The OTC trade feed returned an unreadable response.');
  }

  if (isFeed(payload)) return payload;
  throw new Error('The OTC trade feed returned an unexpected format.');
}

export async function fetchSharedOtcTrades(signal?: AbortSignal): Promise<OtcTradeFeed> {
  if (!import.meta.env.DEV) {
    const response = await fetch('/api/otc-shared-trades', { signal, headers: { Accept: 'application/json' } });
    const payload: unknown = await response.json();
    if (isFeed(payload)) return payload;
    throw new Error('The shared OTC trade feed returned an unexpected format.');
  }

  const rows: unknown[] = [];
  let since = 0;
  for (let page = 0; page < 10; page += 1) {
    const response = await fetch(`https://mining-pool.zkas.info/api/otc/trades?market=KAS&since=${since}&limit=500`, { signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`The shared OTC API returned status ${response.status}.`);
    const payload = await response.json() as { trades?: unknown[]; data?: unknown[]; next?: number } | unknown[];
    const pageRows = Array.isArray(payload) ? payload : Array.isArray(payload.trades) ? payload.trades : Array.isArray(payload.data) ? payload.data : [];
    if (!pageRows.length) break;
    rows.push(...pageRows);
    const last = pageRows.at(-1) as Record<string, unknown> | undefined;
    const next = !Array.isArray(payload) ? sharedNumber(payload.next) : null;
    const lastTimestamp = sharedNumber(last?.ts);
    const nextSince = next ?? (lastTimestamp === null ? null : lastTimestamp + 1);
    if (pageRows.length < 500 || nextSince === null || nextSince <= since) break;
    since = nextSince;
  }
  const trades = rows.map(normalizeSharedTrade).filter((trade): trade is OtcTrade => trade !== null);
  return { schemaVersion: 1, status: 'live', source: 'shared-otc-api', updatedAt: Date.now(), trades };
}

export async function fetchOtcOpenOrders(signal?: AbortSignal): Promise<OtcOpenOrderFeed> {
  const response = await fetch('/api/otc-open-orders', { signal, headers: { Accept: 'application/json' } });
  const payload = await response.json() as Partial<OtcOpenOrderFeed>;
  if (payload.schemaVersion === 1 && typeof payload.status === 'string' && typeof payload.updatedAt === 'number' && Array.isArray(payload.orders)) {
    return payload as OtcOpenOrderFeed;
  }
  throw new Error('The open ZKAS order feed returned an unexpected format.');
}

export async function fetchKasUsd(signal?: AbortSignal): Promise<KasUsdQuote> {
  const response = await fetch('/api/kas-price', {
    signal,
    headers: { Accept: 'application/json' },
  });
  const payload = await response.json() as Partial<KasUsdQuote>;
  if (response.ok && typeof payload.priceUsd === 'number' && Number.isFinite(payload.priceUsd) && payload.priceUsd > 0) {
    return payload as KasUsdQuote;
  }
  throw new Error('The KAS/USD quote is temporarily unavailable.');
}
