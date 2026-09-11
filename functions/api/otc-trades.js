const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded import for the 74 newest reviewed Discord trades.
// The desk reports 1,018 rows; the public history excludes 11 historical
// test/outlier rows, so this advances the stored public total from 933 to 1,007.
const reviewedSep11MorningTrades = [
  { timestamp: Date.parse('2026-09-10T16:00:00Z'), side: 'sell', zkasAmount: 8000, totalKas: 500, priceKas: 500 / 8000 },
  { timestamp: Date.parse('2026-09-10T16:01:00Z'), side: 'sell', zkasAmount: 75000, totalKas: 4700.00025, priceKas: 4700.00025 / 75000 },
  { timestamp: Date.parse('2026-09-10T16:02:00Z'), side: 'sell', zkasAmount: 79500, totalKas: 5000.000655, priceKas: 5000.000655 / 79500 },
  { timestamp: Date.parse('2026-09-10T16:03:00Z'), side: 'sell', zkasAmount: 55000, totalKas: 3480.00015, priceKas: 3480.00015 / 55000 },
  { timestamp: Date.parse('2026-09-10T16:04:00Z'), side: 'sell', zkasAmount: 55200, totalKas: 3496.000368, priceKas: 3496.000368 / 55200 },
  { timestamp: Date.parse('2026-09-10T16:05:00Z'), side: 'sell', zkasAmount: 68.5, totalKas: 4.33833379, priceKas: 4.33833379 / 68.5 },
  { timestamp: Date.parse('2026-09-10T16:06:00Z'), side: 'sell', zkasAmount: 4731.5, totalKas: 299.66169821, priceKas: 299.66169821 / 4731.5 },
  { timestamp: Date.parse('2026-09-10T16:07:00Z'), side: 'buy', zkasAmount: 26329, totalKas: 1385.67104732, priceKas: 1385.67104732 / 26329 },
  { timestamp: Date.parse('2026-09-10T16:08:00Z'), side: 'buy', zkasAmount: 63476, totalKas: 3277.29317468, priceKas: 3277.29317468 / 63476 },
  { timestamp: Date.parse('2026-09-10T16:09:00Z'), side: 'sell', zkasAmount: 55000, totalKas: 3520, priceKas: 3520 / 55000 },
  { timestamp: Date.parse('2026-09-10T17:00:00Z'), side: 'sell', zkasAmount: 45000, totalKas: 2880, priceKas: 2880 / 45000 },
  { timestamp: Date.parse('2026-09-10T17:01:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 6450, priceKas: 6450 / 100000 },
  { timestamp: Date.parse('2026-09-10T17:02:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 6500, priceKas: 6500 / 100000 },
  { timestamp: Date.parse('2026-09-10T17:03:00Z'), side: 'sell', zkasAmount: 26989, totalKas: 1781.274, priceKas: 1781.274 / 26989 },
  { timestamp: Date.parse('2026-09-10T18:00:00Z'), side: 'sell', zkasAmount: 82194, totalKas: 5500.000000284, priceKas: 5500.000000284 / 82194 },
  { timestamp: Date.parse('2026-09-10T18:01:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 1000, priceKas: 1000 / 10000 },
  { timestamp: Date.parse('2026-09-10T19:00:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 7100, priceKas: 7100 / 100000 },
  { timestamp: Date.parse('2026-09-10T19:01:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 7200, priceKas: 7200 / 100000 },
  { timestamp: Date.parse('2026-09-10T19:02:00Z'), side: 'sell', zkasAmount: 129000, totalKas: 9417, priceKas: 9417 / 129000 },
  { timestamp: Date.parse('2026-09-10T19:03:00Z'), side: 'sell', zkasAmount: 437, totalKas: 31.464, priceKas: 31.464 / 437 },
  { timestamp: Date.parse('2026-09-10T20:00:00Z'), side: 'sell', zkasAmount: 49563, totalKas: 3568.536, priceKas: 3568.536 / 49563 },
  { timestamp: Date.parse('2026-09-10T20:01:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 7200, priceKas: 7200 / 100000 },
  { timestamp: Date.parse('2026-09-10T20:02:00Z'), side: 'sell', zkasAmount: 331000, totalKas: 24163, priceKas: 24163 / 331000 },
  { timestamp: Date.parse('2026-09-10T20:03:00Z'), side: 'sell', zkasAmount: 40000, totalKas: 2920, priceKas: 2920 / 40000 },
  { timestamp: Date.parse('2026-09-10T20:04:00Z'), side: 'sell', zkasAmount: 143243, totalKas: 10798.31912266, priceKas: 10798.31912266 / 143243 },
  { timestamp: Date.parse('2026-09-10T20:05:00Z'), side: 'sell', zkasAmount: 10, totalKas: 0.7538462, priceKas: 0.7538462 / 10 },
  { timestamp: Date.parse('2026-09-10T20:06:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 8000, priceKas: 8000 / 100000 },
  { timestamp: Date.parse('2026-09-10T20:07:00Z'), side: 'sell', zkasAmount: 150000, totalKas: 12500.001, priceKas: 12500.001 / 150000 },
  { timestamp: Date.parse('2026-09-10T20:08:00Z'), side: 'sell', zkasAmount: 70000, totalKas: 5950, priceKas: 5950 / 70000 },
  { timestamp: Date.parse('2026-09-10T20:09:00Z'), side: 'sell', zkasAmount: 5000, totalKas: 425, priceKas: 425 / 5000 },
  { timestamp: Date.parse('2026-09-10T20:10:00Z'), side: 'sell', zkasAmount: 799, totalKas: 67.915, priceKas: 67.915 / 799 },
  { timestamp: Date.parse('2026-09-10T21:00:00Z'), side: 'sell', zkasAmount: 57, totalKas: 4.25081832, priceKas: 4.25081832 / 57 },
  { timestamp: Date.parse('2026-09-10T21:01:00Z'), side: 'buy', zkasAmount: 64000, totalKas: 3600, priceKas: 3600 / 64000 },
  { timestamp: Date.parse('2026-09-10T21:02:00Z'), side: 'buy', zkasAmount: 66000, totalKas: 3626.87358, priceKas: 3626.87358 / 66000 },
  { timestamp: Date.parse('2026-09-10T21:03:00Z'), side: 'sell', zkasAmount: 157930, totalKas: 11777.7497768, priceKas: 11777.7497768 / 157930 },
  { timestamp: Date.parse('2026-09-10T21:04:00Z'), side: 'sell', zkasAmount: 2000, totalKas: 164, priceKas: 164 / 2000 },
  { timestamp: Date.parse('2026-09-10T22:00:00Z'), side: 'buy', zkasAmount: 2140, totalKas: 159.4442524, priceKas: 159.4442524 / 2140 },
  { timestamp: Date.parse('2026-09-10T23:00:00Z'), side: 'sell', zkasAmount: 30000, totalKas: 2460, priceKas: 2460 / 30000 },
  { timestamp: Date.parse('2026-09-10T23:01:00Z'), side: 'sell', zkasAmount: 15000, totalKas: 1230, priceKas: 1230 / 15000 },
  { timestamp: Date.parse('2026-09-10T23:02:00Z'), side: 'buy', zkasAmount: 35360, totalKas: 2634.5554976, priceKas: 2634.5554976 / 35360 },
  { timestamp: Date.parse('2026-09-11T00:00:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 8200, priceKas: 8200 / 100000 },
  { timestamp: Date.parse('2026-09-11T01:00:00Z'), side: 'buy', zkasAmount: 14640, totalKas: 867.5789904, priceKas: 867.5789904 / 14640 },
  { timestamp: Date.parse('2026-09-11T01:01:00Z'), side: 'sell', zkasAmount: 8.5, totalKas: 0.697, priceKas: 0.697 / 8.5 },
  { timestamp: Date.parse('2026-09-11T02:00:00Z'), side: 'sell', zkasAmount: 25, totalKas: 2.05, priceKas: 2.05 / 25 },
  { timestamp: Date.parse('2026-09-11T02:01:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 8200, priceKas: 8200 / 100000 },
  { timestamp: Date.parse('2026-09-11T02:02:00Z'), side: 'sell', zkasAmount: 2966.5, totalKas: 243.253, priceKas: 243.253 / 2966.5 },
  { timestamp: Date.parse('2026-09-11T03:00:00Z'), side: 'buy', zkasAmount: 4306, totalKas: 280.92344, priceKas: 280.92344 / 4306 },
  { timestamp: Date.parse('2026-09-11T04:00:00Z'), side: 'sell', zkasAmount: 124201, totalKas: 10557.085, priceKas: 10557.085 / 124201 },
  { timestamp: Date.parse('2026-09-11T04:01:00Z'), side: 'sell', zkasAmount: 64000, totalKas: 5300, priceKas: 5300 / 64000 },
  { timestamp: Date.parse('2026-09-11T04:02:00Z'), side: 'sell', zkasAmount: 25000, totalKas: 2999, priceKas: 2999 / 25000 },
  { timestamp: Date.parse('2026-09-11T05:00:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 8500, priceKas: 8500 / 100000 },
  { timestamp: Date.parse('2026-09-11T05:01:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 4250, priceKas: 4250 / 50000 },
  { timestamp: Date.parse('2026-09-11T05:02:00Z'), side: 'sell', zkasAmount: 5000, totalKas: 425, priceKas: 425 / 5000 },
  { timestamp: Date.parse('2026-09-11T05:03:00Z'), side: 'sell', zkasAmount: 1500, totalKas: 127.5, priceKas: 127.5 / 1500 },
  { timestamp: Date.parse('2026-09-11T05:04:00Z'), side: 'sell', zkasAmount: 43500, totalKas: 3697.5, priceKas: 3697.5 / 43500 },
  { timestamp: Date.parse('2026-09-11T05:05:00Z'), side: 'buy', zkasAmount: 43500, totalKas: 3079.999665, priceKas: 3079.999665 / 43500 },
  { timestamp: Date.parse('2026-09-11T06:00:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 850, priceKas: 850 / 10000 },
  { timestamp: Date.parse('2026-09-11T06:01:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 850, priceKas: 850 / 10000 },
  { timestamp: Date.parse('2026-09-11T07:00:00Z'), side: 'sell', zkasAmount: 1000, totalKas: 85, priceKas: 85 / 1000 },
  { timestamp: Date.parse('2026-09-11T07:01:00Z'), side: 'sell', zkasAmount: 130, totalKas: 10.9777785, priceKas: 10.9777785 / 130 },
  { timestamp: Date.parse('2026-09-11T07:02:00Z'), side: 'sell', zkasAmount: 8870, totalKas: 749.0222715, priceKas: 749.0222715 / 8870 },
  { timestamp: Date.parse('2026-09-11T08:00:00Z'), side: 'sell', zkasAmount: 125000, totalKas: 10625, priceKas: 10625 / 125000 },
  { timestamp: Date.parse('2026-09-11T08:01:00Z'), side: 'sell', zkasAmount: 82900, totalKas: 7046.5, priceKas: 7046.5 / 82900 },
  { timestamp: Date.parse('2026-09-11T08:02:00Z'), side: 'sell', zkasAmount: 58, totalKas: 4.93, priceKas: 4.93 / 58 },
  { timestamp: Date.parse('2026-09-11T09:00:00Z'), side: 'sell', zkasAmount: 21042, totalKas: 1788.57, priceKas: 1788.57 / 21042 },
  { timestamp: Date.parse('2026-09-11T10:00:00Z'), side: 'sell', zkasAmount: 51816, totalKas: 4300.00050336, priceKas: 4300.00050336 / 51816 },
  { timestamp: Date.parse('2026-09-11T10:01:00Z'), side: 'buy', zkasAmount: 45000, totalKas: 3148.4115, priceKas: 3148.4115 / 45000 },
  { timestamp: Date.parse('2026-09-11T10:02:00Z'), side: 'buy', zkasAmount: 40000, totalKas: 2798.588, priceKas: 2798.588 / 40000 },
  { timestamp: Date.parse('2026-09-11T10:03:00Z'), side: 'buy', zkasAmount: 7600, totalKas: 494, priceKas: 494 / 7600 },
  { timestamp: Date.parse('2026-09-11T12:58:00Z'), side: 'sell', zkasAmount: 50, totalKas: 4.125, priceKas: 4.125 / 50 },
  { timestamp: Date.parse('2026-09-11T12:59:00Z'), side: 'sell', zkasAmount: 20, totalKas: 1.65, priceKas: 1.65 / 20 },
  { timestamp: Date.parse('2026-09-11T13:00:00Z'), side: 'sell', zkasAmount: 43.5, totalKas: 3.62500029, priceKas: 3.62500029 / 43.5 },
  { timestamp: Date.parse('2026-09-11T13:01:00Z'), side: 'sell', zkasAmount: 20, totalKas: 1.65, priceKas: 1.65 / 20 },
  { timestamp: Date.parse('2026-09-11T13:28:00Z'), side: 'sell', zkasAmount: 10, totalKas: 0.82, priceKas: 0.82 / 10 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 933) {
        const trades = [...stored.trades, ...reviewedSep11MorningTrades].sort((a, b) => a.timestamp - b.timestamp);
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
