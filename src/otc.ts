export type OtcTradeSide = 'buy' | 'sell' | 'unknown';

export type OtcTrade = {
  timestamp: number | null;
  side: OtcTradeSide;
  zkasAmount: number | null;
  priceKas: number | null;
  totalKas: number | null;
};

export type OtcFeedStatus =
  | 'live'
  | 'awaiting_configuration'
  | 'upstream_unavailable'
  | 'invalid_upstream_response';

export type OtcTradeFeed = {
  schemaVersion: 1;
  status: OtcFeedStatus;
  source: 'ronnie-api' | 'screenshot-import' | 'not-configured';
  updatedAt: number;
  trades: OtcTrade[];
  message?: string;
};

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

export async function fetchOtcTrades(signal?: AbortSignal): Promise<OtcTradeFeed> {
  const response = await fetch('/api/otc-trades', {
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
