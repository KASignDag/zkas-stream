const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded import for the 16 newest reviewed Discord trades.
// The desk reports 871 rows; the public history excludes 11 historical
// test/outlier rows, so this advances the stored public total from 844 to 860.
const reviewedSep9MorningTrades = [
  { timestamp: Date.parse('2026-09-09T02:40:00Z'), side: 'sell', zkasAmount: 500000, totalKas: 36200, priceKas: 36200 / 500000 },
  { timestamp: Date.parse('2026-09-09T03:34:00Z'), side: 'sell', zkasAmount: 4578, totalKas: 306.726, priceKas: 306.726 / 4578 },
  { timestamp: Date.parse('2026-09-09T03:35:00Z'), side: 'sell', zkasAmount: 20000, totalKas: 1360, priceKas: 1360 / 20000 },
  { timestamp: Date.parse('2026-09-09T03:36:00Z'), side: 'sell', zkasAmount: 3500, totalKas: 238, priceKas: 238 / 3500 },
  { timestamp: Date.parse('2026-09-09T03:37:00Z'), side: 'sell', zkasAmount: 76500, totalKas: 5202, priceKas: 5202 / 76500 },
  { timestamp: Date.parse('2026-09-09T03:38:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 7000, priceKas: 7000 / 100000 },
  { timestamp: Date.parse('2026-09-09T03:39:00Z'), side: 'sell', zkasAmount: 240000, totalKas: 17300.0016, priceKas: 17300.0016 / 240000 },
  { timestamp: Date.parse('2026-09-09T03:40:00Z'), side: 'sell', zkasAmount: 500000, totalKas: 39000, priceKas: 39000 / 500000 },
  { timestamp: Date.parse('2026-09-09T04:40:00Z'), side: 'buy', zkasAmount: 2440, totalKas: 130.1333252, priceKas: 130.1333252 / 2440 },
  { timestamp: Date.parse('2026-09-09T05:40:00Z'), side: 'sell', zkasAmount: 5000, totalKas: 400, priceKas: 400 / 5000 },
  { timestamp: Date.parse('2026-09-09T06:38:00Z'), side: 'sell', zkasAmount: 45000, totalKas: 3600, priceKas: 3600 / 45000 },
  { timestamp: Date.parse('2026-09-09T06:39:00Z'), side: 'sell', zkasAmount: 19000, totalKas: 1510.00011, priceKas: 1510.00011 / 19000 },
  { timestamp: Date.parse('2026-09-09T06:40:00Z'), side: 'sell', zkasAmount: 8500, totalKas: 694.38778, priceKas: 694.38778 / 8500 },
  { timestamp: Date.parse('2026-09-09T08:38:00Z'), side: 'buy', zkasAmount: 50000, totalKas: 2700, priceKas: 2700 / 50000 },
  { timestamp: Date.parse('2026-09-09T08:39:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 3300, priceKas: 3300 / 50000 },
  { timestamp: Date.parse('2026-09-09T08:40:00Z'), side: 'sell', zkasAmount: 38000, totalKas: 2533.33346, priceKas: 2533.33346 / 38000 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 844) {
        const trades = [...stored.trades, ...reviewedSep9MorningTrades].sort((a, b) => a.timestamp - b.timestamp);
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
