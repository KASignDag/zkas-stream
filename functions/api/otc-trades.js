const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded import for the 19 newest reviewed Discord trades.
// The desk reports 839 rows; the public history excludes 11 historical
// test/outlier rows, so this advances the stored public total from 809 to 828.
const reviewedSep8AfternoonTrades = [
  { timestamp: Date.parse('2026-09-08T12:02:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 5150, priceKas: 5150 / 100000 },
  { timestamp: Date.parse('2026-09-08T13:43:00Z'), side: 'sell', zkasAmount: 18000, totalKas: 1278, priceKas: 1278 / 18000 },
  { timestamp: Date.parse('2026-09-08T13:44:00Z'), side: 'sell', zkasAmount: 10500, totalKas: 693, priceKas: 693 / 10500 },
  { timestamp: Date.parse('2026-09-08T13:45:00Z'), side: 'buy', zkasAmount: 53150, totalKas: 2657.5, priceKas: 2657.5 / 53150 },
  { timestamp: Date.parse('2026-09-08T14:41:00Z'), side: 'sell', zkasAmount: 21900, totalKas: 1400.000205, priceKas: 1400.000205 / 21900 },
  { timestamp: Date.parse('2026-09-08T14:42:00Z'), side: 'sell', zkasAmount: 20000, totalKas: 1280, priceKas: 1280 / 20000 },
  { timestamp: Date.parse('2026-09-08T14:43:00Z'), side: 'buy', zkasAmount: 30000, totalKas: 1514.2857, priceKas: 1514.2857 / 30000 },
  { timestamp: Date.parse('2026-09-08T14:44:00Z'), side: 'buy', zkasAmount: 9575, totalKas: 483.30951925, priceKas: 483.30951925 / 9575 },
  { timestamp: Date.parse('2026-09-08T14:45:00Z'), side: 'buy', zkasAmount: 8938, totalKas: 451.15618622, priceKas: 451.15618622 / 8938 },
  { timestamp: Date.parse('2026-09-08T15:45:00Z'), side: 'sell', zkasAmount: 39000, totalKas: 2369.6205, priceKas: 2369.6205 / 39000 },
  { timestamp: Date.parse('2026-09-08T16:45:00Z'), side: 'sell', zkasAmount: 5000, totalKas: 290, priceKas: 290 / 5000 },
  { timestamp: Date.parse('2026-09-08T16:46:00Z'), side: 'buy', zkasAmount: 46850, totalKas: 2342.5, priceKas: 2342.5 / 46850 },
  { timestamp: Date.parse('2026-09-08T17:41:00Z'), side: 'sell', zkasAmount: 1, totalKas: 1.4, priceKas: 1.4 },
  { timestamp: Date.parse('2026-09-08T17:42:00Z'), side: 'buy', zkasAmount: 1098, totalKas: 54.9, priceKas: 54.9 / 1098 },
  { timestamp: Date.parse('2026-09-08T17:43:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 5900, priceKas: 5900 / 100000 },
  { timestamp: Date.parse('2026-09-08T17:44:00Z'), side: 'sell', zkasAmount: 500, totalKas: 30.37975, priceKas: 30.37975 / 500 },
  { timestamp: Date.parse('2026-09-08T17:45:00Z'), side: 'buy', zkasAmount: 18902, totalKas: 945.1, priceKas: 945.1 / 18902 },
  { timestamp: Date.parse('2026-09-08T18:57:00Z'), side: 'sell', zkasAmount: 4900, totalKas: 284.2, priceKas: 284.2 / 4900 },
  { timestamp: Date.parse('2026-09-08T19:03:00Z'), side: 'sell', zkasAmount: 100, totalKas: 5.8, priceKas: 5.8 / 100 },
];

function first(record, keys) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
  }
  return null;
}

function numberish(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampish(value) {
  const numeric = numberish(value);
  if (numeric !== null) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sideish(value) {
  if (typeof value !== 'string') return 'unknown';
  const side = value.trim().toLowerCase();
  if (['buy', 'bid', 'buyer', 'bought'].includes(side)) return 'buy';
  if (['sell', 'ask', 'seller', 'sold'].includes(side)) return 'sell';
  return 'unknown';
}

function tradeArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;
  for (const key of commonTradeArrays) {
    if (Array.isArray(payload[key])) return payload[key];
  }
  if (payload.data && typeof payload.data === 'object') {
    for (const key of commonTradeArrays) {
      if (Array.isArray(payload.data[key])) return payload.data[key];
    }
  }
  return null;
}

function normalizeTrade(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const zkasAmount = numberish(first(value, ['zkasAmount', 'zkas_amount', 'amount', 'quantity', 'tokenAmount', 'token_amount']));
  let priceKas = numberish(first(value, ['priceKas', 'price_kas', 'price', 'unitPrice', 'unit_price', 'rate']));
  let totalKas = numberish(first(value, ['totalKas', 'total_kas', 'kasAmount', 'kas_amount', 'total', 'notional']));

  if (priceKas === null && totalKas !== null && zkasAmount !== null && zkasAmount !== 0) priceKas = totalKas / zkasAmount;
  if (totalKas === null && priceKas !== null && zkasAmount !== null) totalKas = priceKas * zkasAmount;

  return {
    timestamp: timestampish(first(value, ['timestamp', 'createdAt', 'created_at', 'completedAt', 'completed_at', 'time', 'date'])),
    side: sideish(first(value, ['side', 'type', 'direction', 'action'])),
    zkasAmount,
    priceKas,
    totalKas,
  };
}

function json(body, status = 200, cacheControl = 'private, no-store, max-age=0') {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function handleGet({ request, env, waitUntil }) {
  const updatedAt = Date.now();
  const endpoint = env.ZKAS_OTC_API_URL;
  if (!endpoint) {
    if (env.OTC_TRADES) {
      let stored = await env.OTC_TRADES.get('trades:v1', 'json');
      if (Array.isArray(stored?.trades) && stored.trades.length === 809) {
        const trades = [...stored.trades, ...reviewedSep8AfternoonTrades].sort((a, b) => a.timestamp - b.timestamp);
        stored = { schemaVersion: 1, updatedAt, trades };
        await env.OTC_TRADES.put('trades:v1', JSON.stringify(stored));
      }
      const trades = Array.isArray(stored?.trades) ? stored.trades.map(normalizeTrade).filter(Boolean).slice(-5000) : [];
      if (trades.length) {
        return json({ schemaVersion: 1, status: 'live', source: 'screenshot-import', updatedAt: stored.updatedAt || updatedAt, trades }, 200, 'public, max-age=10, s-maxage=30, stale-while-revalidate=120');
      }
      return json({
        schemaVersion: 1,
        status: 'awaiting_configuration',
        source: 'screenshot-import',
        updatedAt,
        trades: [],
        message: 'The private screenshot importer is ready for its first reviewed trade.',
      });
    }
    return json({
      schemaVersion: 1,
      status: 'awaiting_configuration',
      source: 'not-configured',
      updatedAt,
      trades: [],
      message: 'The private OTC API endpoint has not been configured yet.',
    });
  }

  const cacheUrl = new URL(request?.url || 'https://zkas.stream/api/otc-trades');
  cacheUrl.search = '';
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const edgeCache = typeof caches !== 'undefined' ? caches.default : null;
  const cached = edgeCache ? await edgeCache.match(cacheKey) : null;
  if (cached) return cached;

  let upstreamUrl;
  try {
    upstreamUrl = new URL(endpoint);
    if (upstreamUrl.protocol !== 'https:') throw new Error('HTTPS required');
  } catch {
    return json({
      schemaVersion: 1,
      status: 'invalid_upstream_response',
      source: 'not-configured',
      updatedAt,
      trades: [],
      message: 'The configured OTC API endpoint is invalid.',
    }, 500);
  }

  const headers = new Headers({ Accept: 'application/json' });
  const accessKey = env.ZKAS_OTC_API_KEY;
  if (accessKey) {
    const headerName = env.ZKAS_OTC_API_HEADER || 'Authorization';
    const configuredPrefix = env.ZKAS_OTC_API_PREFIX === undefined ? 'Bearer' : env.ZKAS_OTC_API_PREFIX;
    const prefix = configuredPrefix && !configuredPrefix.endsWith(' ') ? `${configuredPrefix} ` : configuredPrefix;
    headers.set(headerName, `${prefix}${accessKey}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(upstreamUrl, { headers, signal: controller.signal, redirect: 'follow' });
    if (!response.ok) {
      return json({
        schemaVersion: 1,
        status: 'upstream_unavailable',
        source: 'ronnie-api',
        updatedAt,
        trades: [],
        message: `The private OTC service returned status ${response.status}.`,
      }, 502);
    }

    const payload = await response.json();
    const rows = tradeArray(payload);
    if (!rows) {
      return json({
        schemaVersion: 1,
        status: 'invalid_upstream_response',
        source: 'ronnie-api',
        updatedAt,
        trades: [],
        message: 'The OTC API response needs a small field-mapping adjustment.',
      }, 502);
    }

    const trades = rows.map(normalizeTrade).filter(Boolean).slice(-5000);
    const liveResponse = json(
      { schemaVersion: 1, status: 'live', source: 'ronnie-api', updatedAt, trades },
      200,
      'public, max-age=10, s-maxage=30, stale-while-revalidate=120',
    );
    if (edgeCache && waitUntil) waitUntil(edgeCache.put(cacheKey, liveResponse.clone()));
    return liveResponse;
  } catch {
    return json({
      schemaVersion: 1,
      status: 'upstream_unavailable',
      source: 'ronnie-api',
      updatedAt,
      trades: [],
      message: 'The private OTC service could not be reached.',
    }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function onRequest(context) {
  if (context.request.method === 'GET') return handleGet(context);
  return json({ error: 'method_not_allowed' }, 405);
}
