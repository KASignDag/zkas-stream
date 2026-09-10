const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded import for the 36 newest reviewed Discord trades.
// The desk reports 944 rows; the public history excludes 11 historical
// test/outlier rows, so this advances the stored public total from 897 to 933.
const reviewedSep10MiddayTrades = [
  { timestamp: Date.parse('2026-09-10T03:10:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 3900, priceKas: 3900 / 50000 },
  { timestamp: Date.parse('2026-09-10T03:11:00Z'), side: 'sell', zkasAmount: 30000, totalKas: 2261.5386, priceKas: 2261.5386 / 30000 },
  { timestamp: Date.parse('2026-09-10T03:12:00Z'), side: 'sell', zkasAmount: 151575, totalKas: 11426.4237765, priceKas: 11426.4237765 / 151575 },
  { timestamp: Date.parse('2026-09-10T03:13:00Z'), side: 'sell', zkasAmount: 172, totalKas: 12.96615464, priceKas: 12.96615464 / 172 },
  { timestamp: Date.parse('2026-09-10T05:10:00Z'), side: 'sell', zkasAmount: 380000, totalKas: 25080, priceKas: 25080 / 380000 },
  { timestamp: Date.parse('2026-09-10T05:11:00Z'), side: 'sell', zkasAmount: 53361, totalKas: 3521.826, priceKas: 3521.826 / 53361 },
  { timestamp: Date.parse('2026-09-10T08:10:00Z'), side: 'buy', zkasAmount: 50000, totalKas: 3299.869, priceKas: 3299.869 / 50000 },
  { timestamp: Date.parse('2026-09-10T08:11:00Z'), side: 'sell', zkasAmount: 11000, totalKas: 828.00003, priceKas: 828.00003 / 11000 },
  { timestamp: Date.parse('2026-09-10T08:12:00Z'), side: 'buy', zkasAmount: 16639, totalKas: 1098.13040582, priceKas: 1098.13040582 / 16639 },
  { timestamp: Date.parse('2026-09-10T10:10:00Z'), side: 'sell', zkasAmount: 330, totalKas: 21.78, priceKas: 21.78 / 330 },
  { timestamp: Date.parse('2026-09-10T10:11:00Z'), side: 'sell', zkasAmount: 20, totalKas: 1.32, priceKas: 1.32 / 20 },
  { timestamp: Date.parse('2026-09-10T10:12:00Z'), side: 'sell', zkasAmount: 25000, totalKas: 1999, priceKas: 1999 / 25000 },
  { timestamp: Date.parse('2026-09-10T10:13:00Z'), side: 'sell', zkasAmount: 25000, totalKas: 1650, priceKas: 1650 / 25000 },
  { timestamp: Date.parse('2026-09-10T10:14:00Z'), side: 'sell', zkasAmount: 3500, totalKas: 231, priceKas: 231 / 3500 },
  { timestamp: Date.parse('2026-09-10T10:15:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 66, priceKas: 66 / 1000 },
  { timestamp: Date.parse('2026-09-10T10:16:00Z'), side: 'sell', zkasAmount: 500, totalKas: 33, priceKas: 33 / 500 },
  { timestamp: Date.parse('2026-09-10T10:17:00Z'), side: 'sell', zkasAmount: 600, totalKas: 39.6, priceKas: 39.6 / 600 },
  { timestamp: Date.parse('2026-09-10T10:18:00Z'), side: 'sell', zkasAmount: 500, totalKas: 33, priceKas: 33 / 500 },
  { timestamp: Date.parse('2026-09-10T10:19:00Z'), side: 'sell', zkasAmount: 200, totalKas: 13.2, priceKas: 13.2 / 200 },
  { timestamp: Date.parse('2026-09-10T10:20:00Z'), side: 'buy', zkasAmount: 25190, totalKas: 1397.9999099, priceKas: 1397.9999099 / 25190 },
  { timestamp: Date.parse('2026-09-10T10:21:00Z'), side: 'buy', zkasAmount: 60000, totalKas: 3300, priceKas: 3300 / 60000 },
  { timestamp: Date.parse('2026-09-10T10:22:00Z'), side: 'buy', zkasAmount: 14810, totalKas: 791.5945, priceKas: 791.5945 / 14810 },
  { timestamp: Date.parse('2026-09-10T11:10:00Z'), side: 'sell', zkasAmount: 8000, totalKas: 528, priceKas: 528 / 8000 },
  { timestamp: Date.parse('2026-09-10T11:11:00Z'), side: 'sell', zkasAmount: 430, totalKas: 28.32625, priceKas: 28.32625 / 430 },
  { timestamp: Date.parse('2026-09-10T11:12:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 5262.908, priceKas: 5262.908 / 100000 },
  { timestamp: Date.parse('2026-09-10T12:10:00Z'), side: 'buy', zkasAmount: 4631, totalKas: 248.32894658, priceKas: 248.32894658 / 4631 },
  { timestamp: Date.parse('2026-09-10T12:11:00Z'), side: 'buy', zkasAmount: 50000, totalKas: 2681.159, priceKas: 2681.159 / 50000 },
  { timestamp: Date.parse('2026-09-10T13:10:00Z'), side: 'buy', zkasAmount: 50000, totalKas: 2681.159, priceKas: 2681.159 / 50000 },
  { timestamp: Date.parse('2026-09-10T13:11:00Z'), side: 'buy', zkasAmount: 12000, totalKas: 645.16128, priceKas: 645.16128 / 12000 },
  { timestamp: Date.parse('2026-09-10T13:12:00Z'), side: 'buy', zkasAmount: 25000, totalKas: 1344.086, priceKas: 1344.086 / 25000 },
  { timestamp: Date.parse('2026-09-10T13:13:00Z'), side: 'buy', zkasAmount: 25000, totalKas: 1340.5795, priceKas: 1340.5795 / 25000 },
  { timestamp: Date.parse('2026-09-10T14:10:00Z'), side: 'buy', zkasAmount: 200, totalKas: 10.752688, priceKas: 10.752688 / 200 },
  { timestamp: Date.parse('2026-09-10T14:11:00Z'), side: 'buy', zkasAmount: 8369, totalKas: 448.77239342, priceKas: 448.77239342 / 8369 },
  { timestamp: Date.parse('2026-09-10T14:12:00Z'), side: 'buy', zkasAmount: 5190, totalKas: 277.4055, priceKas: 277.4055 / 5190 },
  { timestamp: Date.parse('2026-09-10T14:13:00Z'), side: 'buy', zkasAmount: 153670, totalKas: 8087.5107236, priceKas: 8087.5107236 / 153670 },
  { timestamp: Date.parse('2026-09-10T14:14:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 5262.908, priceKas: 5262.908 / 100000 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 897) {
        const trades = [...stored.trades, ...reviewedSep10MiddayTrades].sort((a, b) => a.timestamp - b.timestamp);
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
