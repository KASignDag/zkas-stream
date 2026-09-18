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

// Reviewed Discord screenshots: desk 1,335, less 11 permanent test/outlier exclusions = 1,324 public trades.
const reviewedTradesSep18Morning = [
  { timestamp: '2026-09-18T14:42:00Z', side: 'buy', zkasAmount: 59780, totalKas: 2161.0446088 },
  { timestamp: '2026-09-18T14:40:00Z', side: 'buy', zkasAmount: 260000, totalKas: 9399 },
  { timestamp: '2026-09-18T14:38:00Z', side: 'buy', zkasAmount: 50000, totalKas: 1850 },
  { timestamp: '2026-09-18T14:36:00Z', side: 'buy', zkasAmount: 10000, totalKas: 375 },
  { timestamp: '2026-09-18T13:42:00Z', side: 'buy', zkasAmount: 100000, totalKas: 3800 },
  { timestamp: '2026-09-18T13:40:00Z', side: 'buy', zkasAmount: 38000, totalKas: 1444 },
  { timestamp: '2026-09-18T13:38:00Z', side: 'sell', zkasAmount: 220000, totalKas: 10300.0018 },
  { timestamp: '2026-09-18T09:42:00Z', side: 'sell', zkasAmount: 20, totalKas: 0.95555556 },
  { timestamp: '2026-09-18T09:40:00Z', side: 'sell', zkasAmount: 20, totalKas: 0.95555556 },
  { timestamp: '2026-09-18T09:38:00Z', side: 'sell', zkasAmount: 20, totalKas: 0.95555556 },
  { timestamp: '2026-09-18T09:36:00Z', side: 'sell', zkasAmount: 20, totalKas: 0.95555556 },
  { timestamp: '2026-09-18T09:34:00Z', side: 'sell', zkasAmount: 52700, totalKas: 2517.889006 },
  { timestamp: '2026-09-18T07:42:00Z', side: 'sell', zkasAmount: 1270, totalKas: 79.520288 },
  { timestamp: '2026-09-18T07:40:00Z', side: 'sell', zkasAmount: 300000, totalKas: 13500 },
  { timestamp: '2026-09-18T07:38:00Z', side: 'sell', zkasAmount: 9000, totalKas: 440.00001 },
  { timestamp: '2026-09-18T07:36:00Z', side: 'buy', zkasAmount: 12000, totalKas: 456 },
  { timestamp: '2026-09-18T03:43:00Z', side: 'sell', zkasAmount: 261700, totalKas: 12918.312802 },
  { timestamp: '2026-09-18T03:41:00Z', side: 'sell', zkasAmount: 1000, totalKas: 49.36306 },
  { timestamp: '2026-09-18T03:39:00Z', side: 'sell', zkasAmount: 500, totalKas: 24.68153 },
  { timestamp: '2026-09-18T03:37:00Z', side: 'sell', zkasAmount: 50100, totalKas: 2473.089306 },
  { timestamp: '2026-09-18T03:35:00Z', side: 'sell', zkasAmount: 700, totalKas: 34.554142 },
  { timestamp: '2026-09-18T02:43:00Z', side: 'sell', zkasAmount: 700, totalKas: 32.2 },
  { timestamp: '2026-09-18T02:41:00Z', side: 'sell', zkasAmount: 30000, totalKas: 2200.0002 },
  { timestamp: '2026-09-18T02:39:00Z', side: 'sell', zkasAmount: 100000, totalKas: 6100 },
  { timestamp: '2026-09-18T02:37:00Z', side: 'sell', zkasAmount: 5000, totalKas: 230 },
  { timestamp: '2026-09-18T02:35:00Z', side: 'sell', zkasAmount: 50000, totalKas: 2999 },
  { timestamp: '2026-09-18T02:33:00Z', side: 'sell', zkasAmount: 50000, totalKas: 2999 },
  { timestamp: '2026-09-18T02:31:00Z', side: 'sell', zkasAmount: 50000, totalKas: 2950 },
  { timestamp: '2026-09-18T00:43:00Z', side: 'sell', zkasAmount: 1300, totalKas: 59.8 },
  { timestamp: '2026-09-18T00:41:00Z', side: 'sell', zkasAmount: 1000, totalKas: 46 },
  { timestamp: '2026-09-18T00:39:00Z', side: 'sell', zkasAmount: 2000, totalKas: 92 },
  { timestamp: '2026-09-18T00:37:00Z', side: 'sell', zkasAmount: 40000, totalKas: 1840 },
  { timestamp: '2026-09-18T00:35:00Z', side: 'sell', zkasAmount: 10000, totalKas: 459 },
  { timestamp: '2026-09-17T23:43:00Z', side: 'buy', zkasAmount: 49550, totalKas: 1907.675 },
  { timestamp: '2026-09-17T23:41:00Z', side: 'sell', zkasAmount: 450, totalKas: 22.5 },
  { timestamp: '2026-09-17T23:39:00Z', side: 'sell', zkasAmount: 50000, totalKas: 2000 },
  { timestamp: '2026-09-17T22:43:00Z', side: 'sell', zkasAmount: 118270, totalKas: 6701.9670609 },
  { timestamp: '2026-09-17T22:41:00Z', side: 'sell', zkasAmount: 100000, totalKas: 5300 },
  { timestamp: '2026-09-17T22:39:00Z', side: 'sell', zkasAmount: 42500, totalKas: 2167.5 },
];

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
      if (Array.isArray(stored?.trades) && stored.trades.length === 1285) {
        stored.trades = [...stored.trades, ...reviewedTradesSep18Morning]
          .map(normalizeTrade)
          .filter(Boolean)
          .sort((a, b) => a.timestamp - b.timestamp)
          .slice(-5000);
        stored.updatedAt = updatedAt;
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
