const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded recovery for 102 reviewed trades visible between the
// 576-row site snapshot and the 689-row desk snapshot. The desk total includes
// 11 older rows intentionally absent from the public history, so the expected
// public total after this migration is 678. Remove after production confirms it.
const reviewedSep6Trades = [
  // First wave: 55 rows newer than the last already-stored 3,954 ZKAS trade.
  { timestamp: Date.parse('2026-09-06T03:18:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 800 },
  { timestamp: Date.parse('2026-09-06T02:25:00Z'), side: 'sell', zkasAmount: 2500, totalKas: 350 },
  { timestamp: Date.parse('2026-09-06T02:24:00Z'), side: 'sell', zkasAmount: 409675, totalKas: 15157.975 },
  { timestamp: Date.parse('2026-09-06T02:23:00Z'), side: 'sell', zkasAmount: 15325, totalKas: 567.025 },
  { timestamp: Date.parse('2026-09-06T02:22:00Z'), side: 'sell', zkasAmount: 75000, totalKas: 2775 },
  { timestamp: Date.parse('2026-09-06T02:21:00Z'), side: 'sell', zkasAmount: 72000, totalKas: 2592 },
  { timestamp: Date.parse('2026-09-06T02:20:00Z'), side: 'sell', zkasAmount: 500000, totalKas: 19300 },
  { timestamp: Date.parse('2026-09-06T02:19:00Z'), side: 'sell', zkasAmount: 75000, totalKas: 2650.0005 },
  { timestamp: Date.parse('2026-09-06T01:25:00Z'), side: 'sell', zkasAmount: 103445, totalKas: 3387.82375 },
  { timestamp: Date.parse('2026-09-06T01:24:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 327 },
  { timestamp: Date.parse('2026-09-06T01:23:00Z'), side: 'sell', zkasAmount: 90000, totalKas: 2947.5 },
  { timestamp: Date.parse('2026-09-06T01:22:00Z'), side: 'sell', zkasAmount: 46851.2, totalKas: 1499.2384 },
  { timestamp: Date.parse('2026-09-06T01:21:00Z'), side: 'sell', zkasAmount: 1548.8, totalKas: 49.5616 },
  { timestamp: Date.parse('2026-09-06T01:20:00Z'), side: 'sell', zkasAmount: 1600, totalKas: 51.2 },
  { timestamp: Date.parse('2026-09-06T01:19:00Z'), side: 'sell', zkasAmount: 6555, totalKas: 214.67625 },
  { timestamp: Date.parse('2026-09-06T01:18:00Z'), side: 'sell', zkasAmount: 3000, totalKas: 108 },
  { timestamp: Date.parse('2026-09-06T00:25:00Z'), side: 'sell', zkasAmount: 65000, totalKas: 2340 },
  { timestamp: Date.parse('2026-09-06T00:24:00Z'), side: 'sell', zkasAmount: 63865, totalKas: 2299.14 },
  { timestamp: Date.parse('2026-09-06T00:23:00Z'), side: 'sell', zkasAmount: 2385, totalKas: 85.86 },
  { timestamp: Date.parse('2026-09-06T00:22:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 360 },
  { timestamp: Date.parse('2026-09-05T23:25:00Z'), side: 'sell', zkasAmount: 250, totalKas: 9 },
  { timestamp: Date.parse('2026-09-05T23:24:00Z'), side: 'sell', zkasAmount: 1200, totalKas: 43.2 },
  { timestamp: Date.parse('2026-09-05T23:23:00Z'), side: 'sell', zkasAmount: 12300, totalKas: 442.8 },
  { timestamp: Date.parse('2026-09-05T23:22:00Z'), side: 'sell', zkasAmount: 250467, totalKas: 8260.03347351 },
  { timestamp: Date.parse('2026-09-05T23:21:00Z'), side: 'sell', zkasAmount: 188000, totalKas: 6157 },
  { timestamp: Date.parse('2026-09-05T22:25:00Z'), side: 'sell', zkasAmount: 12000, totalKas: 393 },
  { timestamp: Date.parse('2026-09-05T22:24:00Z'), side: 'sell', zkasAmount: 190, totalKas: 9.405 },
  { timestamp: Date.parse('2026-09-05T22:23:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 2377.75 },
  { timestamp: Date.parse('2026-09-05T22:22:00Z'), side: 'sell', zkasAmount: 4245, totalKas: 139.99385985 },
  { timestamp: Date.parse('2026-09-05T21:25:00Z'), side: 'sell', zkasAmount: 369937, totalKas: 12199.97845261 },
  { timestamp: Date.parse('2026-09-05T21:24:00Z'), side: 'sell', zkasAmount: 98000, totalKas: 2900.00032 },
  { timestamp: Date.parse('2026-09-05T21:23:00Z'), side: 'sell', zkasAmount: 20, totalKas: 0.520296 },
  { timestamp: Date.parse('2026-09-05T21:22:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 2900 },
  { timestamp: Date.parse('2026-09-05T21:21:00Z'), side: 'sell', zkasAmount: 488533, totalKas: 12709.0882884 },
  { timestamp: Date.parse('2026-09-05T21:20:00Z'), side: 'sell', zkasAmount: 472792, totalKas: 12299.5893216 },
  { timestamp: Date.parse('2026-09-05T21:19:00Z'), side: 'sell', zkasAmount: 146, totalKas: 3.6938 },
  { timestamp: Date.parse('2026-09-05T21:18:00Z'), side: 'sell', zkasAmount: 100, totalKas: 2.53 },
  { timestamp: Date.parse('2026-09-05T21:17:00Z'), side: 'sell', zkasAmount: 300, totalKas: 7.59 },
  { timestamp: Date.parse('2026-09-05T21:16:00Z'), side: 'sell', zkasAmount: 500, totalKas: 12.65 },
  { timestamp: Date.parse('2026-09-05T21:15:00Z'), side: 'sell', zkasAmount: 4000, totalKas: 101.2 },
  { timestamp: Date.parse('2026-09-05T21:14:00Z'), side: 'sell', zkasAmount: 64000, totalKas: 1600 },
  { timestamp: Date.parse('2026-09-05T21:13:00Z'), side: 'sell', zkasAmount: 172000, totalKas: 4300 },
  { timestamp: Date.parse('2026-09-05T21:12:00Z'), side: 'sell', zkasAmount: 400, totalKas: 10 },
  { timestamp: Date.parse('2026-09-05T21:11:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 2500 },
  { timestamp: Date.parse('2026-09-05T21:10:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 250 },
  { timestamp: Date.parse('2026-09-05T21:09:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 2500 },
  { timestamp: Date.parse('2026-09-05T21:08:00Z'), side: 'sell', zkasAmount: 150000, totalKas: 3800.001 },
  { timestamp: Date.parse('2026-09-05T20:25:00Z'), side: 'sell', zkasAmount: 800, totalKas: 20 },
  { timestamp: Date.parse('2026-09-05T20:24:00Z'), side: 'sell', zkasAmount: 800, totalKas: 20 },
  { timestamp: Date.parse('2026-09-05T20:23:00Z'), side: 'sell', zkasAmount: 80000, totalKas: 2000 },
  { timestamp: Date.parse('2026-09-05T20:22:00Z'), side: 'sell', zkasAmount: 20000, totalKas: 500 },
  { timestamp: Date.parse('2026-09-05T20:21:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 25 },
  { timestamp: Date.parse('2026-09-05T20:20:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 25 },
  { timestamp: Date.parse('2026-09-05T20:19:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 1250 },
  { timestamp: Date.parse('2026-09-05T17:47:00Z'), side: 'sell', zkasAmount: 150000, totalKas: 4000.0005 },

  // Second wave: 47 rows newer than the repeated 10,000 ZKAS / 800 KAS row.
  { timestamp: Date.parse('2026-09-06T11:45:00Z'), side: 'sell', zkasAmount: 30338.40262, totalKas: 1537.14583388 },
  { timestamp: Date.parse('2026-09-06T11:35:00Z'), side: 'buy', zkasAmount: 37785, totalKas: 1096.6045827 },
  { timestamp: Date.parse('2026-09-06T10:25:00Z'), side: 'sell', zkasAmount: 150, totalKas: 7.6000005 },
  { timestamp: Date.parse('2026-09-06T10:24:00Z'), side: 'sell', zkasAmount: 500, totalKas: 25.333335 },
  { timestamp: Date.parse('2026-09-06T10:23:00Z'), side: 'sell', zkasAmount: 63000, totalKas: 3192.00021 },
  { timestamp: Date.parse('2026-09-06T10:22:00Z'), side: 'sell', zkasAmount: 96667, totalKas: 4350.015 },
  { timestamp: Date.parse('2026-09-06T10:21:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 4500 },
  { timestamp: Date.parse('2026-09-06T10:20:00Z'), side: 'sell', zkasAmount: 157250, totalKas: 5970.1707975 },
  { timestamp: Date.parse('2026-09-06T09:25:00Z'), side: 'sell', zkasAmount: 22, totalKas: 0.99 },
  { timestamp: Date.parse('2026-09-06T09:24:00Z'), side: 'sell', zkasAmount: 311, totalKas: 13.995 },
  { timestamp: Date.parse('2026-09-06T09:23:00Z'), side: 'sell', zkasAmount: 3000, totalKas: 135 },
  { timestamp: Date.parse('2026-09-06T09:22:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 37.96611 },
  { timestamp: Date.parse('2026-09-06T09:21:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 37.96611 },
  { timestamp: Date.parse('2026-09-06T09:20:00Z'), side: 'sell', zkasAmount: 3000, totalKas: 113.89833 },
  { timestamp: Date.parse('2026-09-06T09:19:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 37.96611 },
  { timestamp: Date.parse('2026-09-06T09:18:00Z'), side: 'sell', zkasAmount: 170000, totalKas: 6454.2387 },
  { timestamp: Date.parse('2026-09-06T09:17:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 379.6611 },
  { timestamp: Date.parse('2026-09-06T09:16:00Z'), side: 'sell', zkasAmount: 20000, totalKas: 759.3222 },
  { timestamp: Date.parse('2026-09-06T08:25:00Z'), side: 'sell', zkasAmount: 1100, totalKas: 308 },
  { timestamp: Date.parse('2026-09-06T08:24:00Z'), side: 'sell', zkasAmount: 5500, totalKas: 208.813605 },
  { timestamp: Date.parse('2026-09-06T08:23:00Z'), side: 'sell', zkasAmount: 348000, totalKas: 11745 },
  { timestamp: Date.parse('2026-09-06T07:25:00Z'), side: 'sell', zkasAmount: 2000, totalKas: 67.5 },
  { timestamp: Date.parse('2026-09-06T07:24:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 1687.5 },
  { timestamp: Date.parse('2026-09-06T07:23:00Z'), side: 'buy', zkasAmount: 38300, totalKas: 1097.427135 },
  { timestamp: Date.parse('2026-09-06T07:22:00Z'), side: 'sell', zkasAmount: 30000, totalKas: 1080 },
  { timestamp: Date.parse('2026-09-06T07:21:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 3550 },
  { timestamp: Date.parse('2026-09-06T07:20:00Z'), side: 'sell', zkasAmount: 166800, totalKas: 5500.001484 },
  { timestamp: Date.parse('2026-09-06T07:19:00Z'), side: 'buy', zkasAmount: 60000, totalKas: 1749.9972 },
  { timestamp: Date.parse('2026-09-06T07:18:00Z'), side: 'sell', zkasAmount: 1250, totalKas: 45 },
  { timestamp: Date.parse('2026-09-06T07:17:00Z'), side: 'sell', zkasAmount: 500, totalKas: 21.25 },
  { timestamp: Date.parse('2026-09-06T07:16:00Z'), side: 'sell', zkasAmount: 40000, totalKas: 1458.6712 },
  { timestamp: Date.parse('2026-09-06T07:15:00Z'), side: 'sell', zkasAmount: 40000, totalKas: 1458.6712 },
  { timestamp: Date.parse('2026-09-06T07:14:00Z'), side: 'sell', zkasAmount: 300000, totalKas: 11000.001 },
  { timestamp: Date.parse('2026-09-06T06:25:00Z'), side: 'sell', zkasAmount: 1200, totalKas: 51 },
  { timestamp: Date.parse('2026-09-06T06:24:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 2916.662 },
  { timestamp: Date.parse('2026-09-06T06:23:00Z'), side: 'sell', zkasAmount: 500, totalKas: 140 },
  { timestamp: Date.parse('2026-09-06T06:22:00Z'), side: 'sell', zkasAmount: 99810, totalKas: 4940.595 },
  { timestamp: Date.parse('2026-09-06T06:21:00Z'), side: 'sell', zkasAmount: 3200, totalKas: 128 },
  { timestamp: Date.parse('2026-09-06T06:20:00Z'), side: 'sell', zkasAmount: 110000, totalKas: 4033.3337 },
  { timestamp: Date.parse('2026-09-06T06:19:00Z'), side: 'sell', zkasAmount: 190000, totalKas: 6966.6673 },
  { timestamp: Date.parse('2026-09-06T05:25:00Z'), side: 'sell', zkasAmount: 499, totalKas: 142.57143071 },
  { timestamp: Date.parse('2026-09-06T04:25:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 5000 },
  { timestamp: Date.parse('2026-09-06T04:24:00Z'), side: 'sell', zkasAmount: 23000, totalKas: 1136.1448 },
  { timestamp: Date.parse('2026-09-06T04:23:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 493.976 },
  { timestamp: Date.parse('2026-09-06T04:22:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 2469.88 },
  { timestamp: Date.parse('2026-09-06T04:21:00Z'), side: 'sell', zkasAmount: 300000, totalKas: 12000 },
  { timestamp: Date.parse('2026-09-06T04:20:00Z'), side: 'sell', zkasAmount: 400000, totalKas: 15200 },
].map((trade) => ({ ...trade, priceKas: trade.totalKas / trade.zkasAmount }));

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
      if (Array.isArray(stored?.trades) && stored.trades.length === 576) {
        const trades = [...stored.trades, ...reviewedSep6Trades].sort((a, b) => a.timestamp - b.timestamp);
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
