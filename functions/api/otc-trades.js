const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded import for the 26 newest reviewed Discord trades.
// The desk reports 897 rows; the public history excludes 11 historical
// test/outlier rows, so this advances the stored public total from 860 to 886.
const reviewedSep9AfternoonTrades = [
  { timestamp: Date.parse('2026-09-09T14:09:00Z'), side: 'buy', zkasAmount: 12741, totalKas: 679.51995753, priceKas: 679.51995753 / 12741 },
  { timestamp: Date.parse('2026-09-09T14:10:00Z'), side: 'buy', zkasAmount: 37259, totalKas: 1999.9997797, priceKas: 1999.9997797 / 37259 },
  { timestamp: Date.parse('2026-09-09T14:11:00Z'), side: 'buy', zkasAmount: 14819, totalKas: 790.34661727, priceKas: 790.34661727 / 14819 },
  { timestamp: Date.parse('2026-09-09T14:12:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 5000, priceKas: 5000 / 100000 },
  { timestamp: Date.parse('2026-09-09T14:13:00Z'), side: 'buy', zkasAmount: 50000, totalKas: 2500, priceKas: 2500 / 50000 },
  { timestamp: Date.parse('2026-09-09T14:14:00Z'), side: 'buy', zkasAmount: 18181.11867728, totalKas: 855.58199123, priceKas: 855.58199123 / 18181.11867728 },
  { timestamp: Date.parse('2026-09-09T15:20:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 5200, priceKas: 5200 / 100000 },
  { timestamp: Date.parse('2026-09-09T15:21:00Z'), side: 'buy', zkasAmount: 150000, totalKas: 7800, priceKas: 7800 / 150000 },
  { timestamp: Date.parse('2026-09-09T16:14:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 3130, priceKas: 3130 / 50000 },
  { timestamp: Date.parse('2026-09-09T16:15:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 6380, priceKas: 6380 / 100000 },
  { timestamp: Date.parse('2026-09-09T16:16:00Z'), side: 'sell', zkasAmount: 50000, totalKas: 3200, priceKas: 3200 / 50000 },
  { timestamp: Date.parse('2026-09-09T16:17:00Z'), side: 'sell', zkasAmount: 8000, totalKas: 510, priceKas: 510 / 8000 },
  { timestamp: Date.parse('2026-09-09T16:18:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 6500, priceKas: 6500 / 100000 },
  { timestamp: Date.parse('2026-09-09T16:19:00Z'), side: 'sell', zkasAmount: 64500, totalKas: 4270.00062, priceKas: 4270.00062 / 64500 },
  { timestamp: Date.parse('2026-09-09T16:20:00Z'), side: 'sell', zkasAmount: 112000, totalKas: 7466.66704, priceKas: 7466.66704 / 112000 },
  { timestamp: Date.parse('2026-09-09T17:10:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 7000, priceKas: 7000 / 100000 },
  { timestamp: Date.parse('2026-09-09T17:11:00Z'), side: 'sell', zkasAmount: 7061, totalKas: 576.83201348, priceKas: 576.83201348 / 7061 },
  { timestamp: Date.parse('2026-09-09T17:12:00Z'), side: 'sell', zkasAmount: 79000, totalKas: 6453.72172, priceKas: 6453.72172 / 79000 },
  { timestamp: Date.parse('2026-09-09T17:15:00Z'), side: 'sell', zkasAmount: 125000, totalKas: 9583.33375, priceKas: 9583.33375 / 125000 },
  { timestamp: Date.parse('2026-09-09T17:16:00Z'), side: 'sell', zkasAmount: 5010, totalKas: 384.1000167, priceKas: 384.1000167 / 5010 },
  { timestamp: Date.parse('2026-09-09T17:17:00Z'), side: 'sell', zkasAmount: 19990, totalKas: 1532.5667333, priceKas: 1532.5667333 / 19990 },
  { timestamp: Date.parse('2026-09-09T17:28:00Z'), side: 'sell', zkasAmount: 95000, totalKas: 7410, priceKas: 7410 / 95000 },
  { timestamp: Date.parse('2026-09-09T17:31:00Z'), side: 'sell', zkasAmount: 3500, totalKas: 273, priceKas: 273 / 3500 },
  { timestamp: Date.parse('2026-09-09T17:43:00Z'), side: 'sell', zkasAmount: 70000, totalKas: 5460, priceKas: 5460 / 70000 },
  { timestamp: Date.parse('2026-09-09T17:45:00Z'), side: 'sell', zkasAmount: 6000, totalKas: 468, priceKas: 468 / 6000 },
  { timestamp: Date.parse('2026-09-09T18:18:00Z'), side: 'sell', zkasAmount: 5000, totalKas: 1000, priceKas: 1000 / 5000 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 860) {
        const trades = [...stored.trades, ...reviewedSep9AfternoonTrades].sort((a, b) => a.timestamp - b.timestamp);
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
