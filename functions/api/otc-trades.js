const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded import for the 57 newest reviewed Discord trades.
// The desk reports 1,082 rows; the public history excludes 11 historical
// test/outlier rows, so this advances the stored public total from 1,014 to 1,071.
const reviewedSep12MorningTrades = [
  { timestamp: Date.parse('2026-09-11T18:20:00Z'), side: 'buy', zkasAmount: 1000, totalKas: 60, priceKas: 60 / 1000 },
  { timestamp: Date.parse('2026-09-11T18:25:00Z'), side: 'buy', zkasAmount: 140000, totalKas: 8199.9988, priceKas: 8199.9988 / 140000 },
  { timestamp: Date.parse('2026-09-11T18:26:00Z'), side: 'buy', zkasAmount: 45593, totalKas: 2735.58, priceKas: 2735.58 / 45593 },
  { timestamp: Date.parse('2026-09-11T18:27:00Z'), side: 'buy', zkasAmount: 31317, totalKas: 1659.801, priceKas: 1659.801 / 31317 },
  { timestamp: Date.parse('2026-09-11T20:30:00Z'), side: 'sell', zkasAmount: 400000, totalKas: 29900, priceKas: 29900 / 400000 },
  { timestamp: Date.parse('2026-09-11T20:31:00Z'), side: 'sell', zkasAmount: 14800, totalKas: 1036, priceKas: 1036 / 14800 },
  { timestamp: Date.parse('2026-09-11T20:32:00Z'), side: 'sell', zkasAmount: 11900, totalKas: 833, priceKas: 833 / 11900 },
  { timestamp: Date.parse('2026-09-11T20:33:00Z'), side: 'sell', zkasAmount: 29219, totalKas: 2350.00001928, priceKas: 2350.00001928 / 29219 },
  { timestamp: Date.parse('2026-09-11T20:34:00Z'), side: 'sell', zkasAmount: 2000, totalKas: 140, priceKas: 140 / 2000 },
  { timestamp: Date.parse('2026-09-11T20:35:00Z'), side: 'buy', zkasAmount: 912, totalKas: 52.07210832, priceKas: 52.07210832 / 912 },
  { timestamp: Date.parse('2026-09-11T21:30:00Z'), side: 'sell', zkasAmount: 1.12345678, totalKas: 0.08931482, priceKas: 0.08931482 / 1.12345678 },
  { timestamp: Date.parse('2026-09-11T21:31:00Z'), side: 'sell', zkasAmount: 1.87654321, totalKas: 0.15340741, priceKas: 0.15340741 / 1.87654321 },
  { timestamp: Date.parse('2026-09-11T21:32:00Z'), side: 'sell', zkasAmount: 25000, totalKas: 1666.66675, priceKas: 1666.66675 / 25000 },
  { timestamp: Date.parse('2026-09-11T21:33:00Z'), side: 'buy', zkasAmount: 1317, totalKas: 87.79999122, priceKas: 87.79999122 / 1317 },
  { timestamp: Date.parse('2026-09-11T21:34:00Z'), side: 'buy', zkasAmount: 5000, totalKas: 333.3333, priceKas: 333.3333 / 5000 },
  { timestamp: Date.parse('2026-09-11T22:30:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 3484.8485, priceKas: 3484.8485 / 50000 },
  { timestamp: Date.parse('2026-09-11T22:31:00Z'), side: 'sell', zkasAmount: 5500, totalKas: 383.333335, priceKas: 383.333335 / 5500 },
  { timestamp: Date.parse('2026-09-11T23:30:00Z'), side: 'sell', zkasAmount: 8100, totalKas: 564.545457, priceKas: 564.545457 / 8100 },
  { timestamp: Date.parse('2026-09-11T23:31:00Z'), side: 'sell', zkasAmount: 15782, totalKas: 1099.95758054, priceKas: 1099.95758054 / 15782 },
  { timestamp: Date.parse('2026-09-11T23:32:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 7000, priceKas: 7000 / 100000 },
  { timestamp: Date.parse('2026-09-12T01:30:00Z'), side: 'sell', zkasAmount: 9397, totalKas: 638.996, priceKas: 638.996 / 9397 },
  { timestamp: Date.parse('2026-09-12T03:30:00Z'), side: 'buy', zkasAmount: 3267, totalKas: 186.53462487, priceKas: 186.53462487 / 3267 },
  { timestamp: Date.parse('2026-09-12T03:31:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 680, priceKas: 680 / 10000 },
  { timestamp: Date.parse('2026-09-12T03:32:00Z'), side: 'sell', zkasAmount: 2500, totalKas: 170, priceKas: 170 / 2500 },
  { timestamp: Date.parse('2026-09-12T05:30:00Z'), side: 'sell', zkasAmount: 28103, totalKas: 1911.004, priceKas: 1911.004 / 28103 },
  { timestamp: Date.parse('2026-09-12T05:31:00Z'), side: 'sell', zkasAmount: 14000, totalKas: 950.0001, priceKas: 950.0001 / 14000 },
  { timestamp: Date.parse('2026-09-12T05:32:00Z'), side: 'sell', zkasAmount: 8000, totalKas: 557.57576, priceKas: 557.57576 / 8000 },
  { timestamp: Date.parse('2026-09-12T06:30:00Z'), side: 'buy', zkasAmount: 13738, totalKas: 784.39322818, priceKas: 784.39322818 / 13738 },
  { timestamp: Date.parse('2026-09-12T09:10:00Z'), side: 'sell', zkasAmount: 15000, totalKas: 885, priceKas: 885 / 15000 },
  { timestamp: Date.parse('2026-09-12T09:11:00Z'), side: 'buy', zkasAmount: 30000, totalKas: 1549.9998, priceKas: 1549.9998 / 30000 },
  { timestamp: Date.parse('2026-09-12T09:12:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 61.8074, priceKas: 61.8074 / 1000 },
  { timestamp: Date.parse('2026-09-12T09:13:00Z'), side: 'sell', zkasAmount: 2500, totalKas: 154.5185, priceKas: 154.5185 / 2500 },
  { timestamp: Date.parse('2026-09-12T09:14:00Z'), side: 'buy', zkasAmount: 8524, totalKas: 440.09778532, priceKas: 440.09778532 / 8524 },
  { timestamp: Date.parse('2026-09-12T09:15:00Z'), side: 'buy', zkasAmount: 65000, totalKas: 3298.9996, priceKas: 3298.9996 / 65000 },
  { timestamp: Date.parse('2026-09-12T09:16:00Z'), side: 'buy', zkasAmount: 50000, totalKas: 2500, priceKas: 2500 / 50000 },
  { timestamp: Date.parse('2026-09-12T09:17:00Z'), side: 'buy', zkasAmount: 200000, totalKas: 9528, priceKas: 9528 / 200000 },
  { timestamp: Date.parse('2026-09-12T09:18:00Z'), side: 'buy', zkasAmount: 311675, totalKas: 14720.647123, priceKas: 14720.647123 / 311675 },
  { timestamp: Date.parse('2026-09-12T09:19:00Z'), side: 'buy', zkasAmount: 13325, totalKas: 629.349877, priceKas: 629.349877 / 13325 },
  { timestamp: Date.parse('2026-09-12T09:20:00Z'), side: 'buy', zkasAmount: 25000, totalKas: 1200, priceKas: 1200 / 25000 },
  { timestamp: Date.parse('2026-09-12T09:21:00Z'), side: 'buy', zkasAmount: 15818, totalKas: 744.37641476, priceKas: 744.37641476 / 15818 },
  { timestamp: Date.parse('2026-09-12T09:22:00Z'), side: 'buy', zkasAmount: 90000, totalKas: 3999.9996, priceKas: 3999.9996 / 90000 },
  { timestamp: Date.parse('2026-09-12T09:23:00Z'), side: 'buy', zkasAmount: 59000, totalKas: 2404.99989, priceKas: 2404.99989 / 59000 },
  { timestamp: Date.parse('2026-09-12T09:24:00Z'), side: 'buy', zkasAmount: 10000, totalKas: 400, priceKas: 400 / 10000 },
  { timestamp: Date.parse('2026-09-12T09:25:00Z'), side: 'buy', zkasAmount: 121656.925, totalKas: 4812.80026547, priceKas: 4812.80026547 / 121656.925 },
  { timestamp: Date.parse('2026-09-12T10:20:00Z'), side: 'buy', zkasAmount: 50000, totalKas: 2000, priceKas: 2000 / 50000 },
  { timestamp: Date.parse('2026-09-12T10:21:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 3956.043, priceKas: 3956.043 / 100000 },
  { timestamp: Date.parse('2026-09-12T10:22:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 2850, priceKas: 2850 / 50000 },
  { timestamp: Date.parse('2026-09-12T10:23:00Z'), side: 'sell', zkasAmount: 200000, totalKas: 11500, priceKas: 11500 / 200000 },
  { timestamp: Date.parse('2026-09-12T11:20:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 5500, priceKas: 5500 / 100000 },
  { timestamp: Date.parse('2026-09-12T11:21:00Z'), side: 'buy', zkasAmount: 11621, totalKas: 459.73175703, priceKas: 459.73175703 / 11621 },
  { timestamp: Date.parse('2026-09-12T11:37:00Z'), side: 'sell', zkasAmount: 200000, totalKas: 11800, priceKas: 11800 / 200000 },
  { timestamp: Date.parse('2026-09-12T11:38:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 6000, priceKas: 6000 / 100000 },
  { timestamp: Date.parse('2026-09-12T11:39:00Z'), side: 'sell', zkasAmount: 60570, totalKas: 3743.674218, priceKas: 3743.674218 / 60570 },
  { timestamp: Date.parse('2026-09-12T11:40:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 3150, priceKas: 3150 / 50000 },
  { timestamp: Date.parse('2026-09-12T11:42:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 6500, priceKas: 6500 / 100000 },
  { timestamp: Date.parse('2026-09-12T11:48:00Z'), side: 'sell', zkasAmount: 5000, totalKas: 350, priceKas: 350 / 5000 },
  { timestamp: Date.parse('2026-09-12T12:20:00Z'), side: 'buy', zkasAmount: 1084, totalKas: 44.52141928, priceKas: 44.52141928 / 1084 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 1014) {
        const trades = [...stored.trades, ...reviewedSep12MorningTrades].sort((a, b) => a.timestamp - b.timestamp);
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
