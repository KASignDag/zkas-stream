const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

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

// Reviewed Discord screenshots: desk 1,123, less 11 permanent test/outlier exclusions = 1,112 public trades.
const reviewedTradesSep13 = [
  { timestamp: '2026-09-13T13:04:00Z', side: 'buy', zkasAmount: 1497, totalKas: 70.44353559 },
  { timestamp: '2026-09-13T12:20:00Z', side: 'sell', zkasAmount: 2000, totalKas: 112 },
  { timestamp: '2026-09-13T12:15:00Z', side: 'sell', zkasAmount: 25000, totalKas: 1400 },
  { timestamp: '2026-09-13T12:10:00Z', side: 'sell', zkasAmount: 10000, totalKas: 999 },
  { timestamp: '2026-09-13T12:05:00Z', side: 'sell', zkasAmount: 100000, totalKas: 6400 },
  { timestamp: '2026-09-13T12:00:00Z', side: 'sell', zkasAmount: 100000, totalKas: 5650 },
  { timestamp: '2026-09-13T11:28:00Z', side: 'sell', zkasAmount: 200, totalKas: 12.942858 },
  { timestamp: '2026-09-13T10:28:00Z', side: 'sell', zkasAmount: 50000, totalKas: 2780 },
  { timestamp: '2026-09-13T07:28:00Z', side: 'buy', zkasAmount: 3811, totalKas: 159.1652717 },
  { timestamp: '2026-09-13T06:28:00Z', side: 'sell', zkasAmount: 1100, totalKas: 56.27908 },
  { timestamp: '2026-09-13T05:40:00Z', side: 'sell', zkasAmount: 5550, totalKas: 283.95354 },
  { timestamp: '2026-09-13T05:30:00Z', side: 'sell', zkasAmount: 14000, totalKas: 710.00006 },
  { timestamp: '2026-09-13T04:40:00Z', side: 'sell', zkasAmount: 129470, totalKas: 6624.047716 },
  { timestamp: '2026-09-13T04:30:00Z', side: 'sell', zkasAmount: 23500, totalKas: 1133.035815 },
  { timestamp: '2026-09-13T02:40:00Z', side: 'buy', zkasAmount: 28000, totalKas: 1195.12176 },
  { timestamp: '2026-09-13T02:30:00Z', side: 'sell', zkasAmount: 4500, totalKas: 216.964305 },
  { timestamp: '2026-09-13T00:50:00Z', side: 'buy', zkasAmount: 14000, totalKas: 599.99996 },
  { timestamp: '2026-09-13T00:45:00Z', side: 'buy', zkasAmount: 14392, totalKas: 616.86529856 },
  { timestamp: '2026-09-13T00:40:00Z', side: 'buy', zkasAmount: 50000, totalKas: 2134.146 },
  { timestamp: '2026-09-13T00:35:00Z', side: 'buy', zkasAmount: 50000, totalKas: 2181.818 },
  { timestamp: '2026-09-13T00:30:00Z', side: 'buy', zkasAmount: 500000, totalKas: 21818.18 },
  { timestamp: '2026-09-12T23:28:00Z', side: 'buy', zkasAmount: 17058, totalKas: 731.13453744 },
];

async function handleGet({ request, env, waitUntil }) {
  const updatedAt = Date.now();
  const endpoint = env.ZKAS_OTC_API_URL;
  if (!endpoint) {
    if (env.OTC_TRADES) {
      let stored = await env.OTC_TRADES.get('trades:v1', 'json');
      if (Array.isArray(stored?.trades) && stored.trades.length === 1090) {
        const trades = [...stored.trades, ...reviewedTradesSep13]
          .map(normalizeTrade)
          .filter(Boolean)
          .sort((a, b) => a.timestamp - b.timestamp);
        stored = { ...stored, updatedAt, trades };
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
