const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded recovery for the 46 new reviewed Sep. 5 trades.
// The last two rows in the supplied screenshots already exist in storage.
// Remove after production storage reports 576 rows.
const reviewedSep5Trades = [
  { timestamp: Date.parse('2026-09-05T17:46:00Z'), side: 'sell', zkasAmount: 3954, priceKas: 100.0362 / 3954, totalKas: 100.0362 },
  { timestamp: Date.parse('2026-09-05T17:25:00Z'), side: 'buy', zkasAmount: 100, priceKas: 1.875 / 100, totalKas: 1.875 },
  { timestamp: Date.parse('2026-09-05T17:24:00Z'), side: 'sell', zkasAmount: 100, priceKas: 2.53 / 100, totalKas: 2.53 },
  { timestamp: Date.parse('2026-09-05T17:23:00Z'), side: 'sell', zkasAmount: 100, priceKas: 2.53 / 100, totalKas: 2.53 },
  { timestamp: Date.parse('2026-09-05T16:25:00Z'), side: 'sell', zkasAmount: 3800, priceKas: 96.14 / 3800, totalKas: 96.14 },
  { timestamp: Date.parse('2026-09-05T16:24:00Z'), side: 'sell', zkasAmount: 201, priceKas: 57.42857229 / 201, totalKas: 57.42857229 },
  { timestamp: Date.parse('2026-09-05T16:23:00Z'), side: 'sell', zkasAmount: 10000, priceKas: 253 / 10000, totalKas: 253 },
  { timestamp: Date.parse('2026-09-05T15:25:00Z'), side: 'sell', zkasAmount: 30000, priceKas: 780.444 / 30000, totalKas: 780.444 },
  { timestamp: Date.parse('2026-09-05T15:24:00Z'), side: 'sell', zkasAmount: 700000, priceKas: 18210.36 / 700000, totalKas: 18210.36 },
  { timestamp: Date.parse('2026-09-05T15:23:00Z'), side: 'sell', zkasAmount: 100000, priceKas: 2600 / 100000, totalKas: 2600 },
  { timestamp: Date.parse('2026-09-05T15:22:00Z'), side: 'sell', zkasAmount: 500, priceKas: 13 / 500, totalKas: 13 },
  { timestamp: Date.parse('2026-09-05T15:21:00Z'), side: 'sell', zkasAmount: 166000, priceKas: 4275.17562 / 166000, totalKas: 4275.17562 },
  { timestamp: Date.parse('2026-09-05T15:20:00Z'), side: 'sell', zkasAmount: 200000, priceKas: 5000 / 200000, totalKas: 5000 },
  { timestamp: Date.parse('2026-09-05T15:19:00Z'), side: 'buy', zkasAmount: 54000, priceKas: 999 / 54000, totalKas: 999 },
  { timestamp: Date.parse('2026-09-05T15:18:00Z'), side: 'buy', zkasAmount: 40000, priceKas: 740 / 40000, totalKas: 740 },
  { timestamp: Date.parse('2026-09-05T15:17:00Z'), side: 'buy', zkasAmount: 100000, priceKas: 1875 / 100000, totalKas: 1875 },
  { timestamp: Date.parse('2026-09-05T15:16:00Z'), side: 'sell', zkasAmount: 15000, priceKas: 386.31105 / 15000, totalKas: 386.31105 },
  { timestamp: Date.parse('2026-09-05T15:15:00Z'), side: 'sell', zkasAmount: 250000, priceKas: 6438.5175 / 250000, totalKas: 6438.5175 },
  { timestamp: Date.parse('2026-09-05T15:14:00Z'), side: 'sell', zkasAmount: 200000, priceKas: 5150 / 200000, totalKas: 5150 },
  { timestamp: Date.parse('2026-09-05T15:13:00Z'), side: 'sell', zkasAmount: 200000, priceKas: 5100 / 200000, totalKas: 5100 },
  { timestamp: Date.parse('2026-09-05T14:25:00Z'), side: 'sell', zkasAmount: 300000, priceKas: 6600 / 300000, totalKas: 6600 },
  { timestamp: Date.parse('2026-09-05T14:24:00Z'), side: 'sell', zkasAmount: 100000, priceKas: 2150 / 100000, totalKas: 2150 },
  { timestamp: Date.parse('2026-09-05T14:23:00Z'), side: 'sell', zkasAmount: 145000, priceKas: 3300.00135 / 145000, totalKas: 3300.00135 },
  { timestamp: Date.parse('2026-09-05T14:22:00Z'), side: 'sell', zkasAmount: 150000, priceKas: 3250.0005 / 150000, totalKas: 3250.0005 },
  { timestamp: Date.parse('2026-09-05T14:21:00Z'), side: 'sell', zkasAmount: 300000, priceKas: 6500.001 / 300000, totalKas: 6500.001 },
  { timestamp: Date.parse('2026-09-05T13:25:00Z'), side: 'sell', zkasAmount: 100000, priceKas: 2100 / 100000, totalKas: 2100 },
  { timestamp: Date.parse('2026-09-05T13:24:00Z'), side: 'sell', zkasAmount: 100000, priceKas: 2100 / 100000, totalKas: 2100 },
  { timestamp: Date.parse('2026-09-05T13:23:00Z'), side: 'sell', zkasAmount: 100000, priceKas: 2100 / 100000, totalKas: 2100 },
  { timestamp: Date.parse('2026-09-05T11:25:00Z'), side: 'sell', zkasAmount: 50000, priceKas: 1050 / 50000, totalKas: 1050 },
  { timestamp: Date.parse('2026-09-05T11:24:00Z'), side: 'sell', zkasAmount: 50000, priceKas: 1000 / 50000, totalKas: 1000 },
  { timestamp: Date.parse('2026-09-05T11:23:00Z'), side: 'sell', zkasAmount: 140000, priceKas: 3000.0012 / 140000, totalKas: 3000.0012 },
  { timestamp: Date.parse('2026-09-05T11:22:00Z'), side: 'buy', zkasAmount: 1000, priceKas: 18 / 1000, totalKas: 18 },
  { timestamp: Date.parse('2026-09-05T10:25:00Z'), side: 'sell', zkasAmount: 50000, priceKas: 900 / 50000, totalKas: 900 },
  { timestamp: Date.parse('2026-09-05T10:24:00Z'), side: 'sell', zkasAmount: 45891, priceKas: 863.24366934 / 45891, totalKas: 863.24366934 },
  { timestamp: Date.parse('2026-09-05T10:23:00Z'), side: 'sell', zkasAmount: 147827, priceKas: 2900.00060731 / 147827, totalKas: 2900.00060731 },
  { timestamp: Date.parse('2026-09-05T09:25:00Z'), side: 'sell', zkasAmount: 100000, priceKas: 2000 / 100000, totalKas: 2000 },
  { timestamp: Date.parse('2026-09-05T09:24:00Z'), side: 'sell', zkasAmount: 80, priceKas: 1.5048592 / 80, totalKas: 1.5048592 },
  { timestamp: Date.parse('2026-09-05T09:23:00Z'), side: 'sell', zkasAmount: 10, priceKas: 0.1881074 / 10, totalKas: 0.1881074 },
  { timestamp: Date.parse('2026-09-05T09:22:00Z'), side: 'sell', zkasAmount: 49500, priceKas: 1287 / 49500, totalKas: 1287 },
  { timestamp: Date.parse('2026-09-05T09:21:00Z'), side: 'sell', zkasAmount: 24773, priceKas: 465.99846202 / 24773, totalKas: 465.99846202 },
  { timestamp: Date.parse('2026-09-05T08:25:00Z'), side: 'sell', zkasAmount: 210000, priceKas: 3950.2554 / 210000, totalKas: 3950.2554 },
  { timestamp: Date.parse('2026-09-05T08:24:00Z'), side: 'sell', zkasAmount: 1000, priceKas: 18.81074 / 1000, totalKas: 18.81074 },
  { timestamp: Date.parse('2026-09-05T07:25:00Z'), side: 'sell', zkasAmount: 15900, priceKas: 267.227007 / 15900, totalKas: 267.227007 },
  { timestamp: Date.parse('2026-09-05T07:24:00Z'), side: 'sell', zkasAmount: 115000, priceKas: 1932.77395 / 115000, totalKas: 1932.77395 },
  { timestamp: Date.parse('2026-09-05T07:23:00Z'), side: 'buy', zkasAmount: 1, priceKas: 1, totalKas: 1 },
  { timestamp: Date.parse('2026-09-05T01:25:00Z'), side: 'buy', zkasAmount: 220000, priceKas: 2333.3332 / 220000, totalKas: 2333.3332 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 530) {
        stored = { schemaVersion: 1, updatedAt, trades: [...stored.trades, ...reviewedSep5Trades] };
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
