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

// Reviewed Discord screenshots: 1,369 desk trades less 11 permanent test/outlier exclusions.
const reviewedTradesSep19Noon = [
  { timestamp: '2026-09-19T15:40:00Z', side: 'sell', zkasAmount: 35, totalKas: 1.75 },
  { timestamp: '2026-09-19T15:02:00Z', side: 'buy', zkasAmount: 10, totalKas: 0.3428571 },
  { timestamp: '2026-09-19T11:02:00Z', side: 'sell', zkasAmount: 220000, totalKas: 11400.0018 },
  { timestamp: '2026-09-19T11:00:00Z', side: 'sell', zkasAmount: 14000, totalKas: 700 },
  { timestamp: '2026-09-19T10:58:00Z', side: 'sell', zkasAmount: 50000, totalKas: 2500 },
  { timestamp: '2026-09-19T10:56:00Z', side: 'sell', zkasAmount: 269000, totalKas: 12000.00123 },
  { timestamp: '2026-09-19T10:54:00Z', side: 'sell', zkasAmount: 35500, totalKas: 1420 },
  { timestamp: '2026-09-19T10:02:00Z', side: 'sell', zkasAmount: 1500, totalKas: 60 },
  { timestamp: '2026-09-19T10:00:00Z', side: 'sell', zkasAmount: 6000, totalKas: 270 },
  { timestamp: '2026-09-19T09:58:00Z', side: 'sell', zkasAmount: 500, totalKas: 20 },
  { timestamp: '2026-09-19T08:02:00Z', side: 'sell', zkasAmount: 25000, totalKas: 1000 },
  { timestamp: '2026-09-19T08:00:00Z', side: 'sell', zkasAmount: 25000, totalKas: 1000 },
  { timestamp: '2026-09-19T03:02:00Z', side: 'buy', zkasAmount: 100000, totalKas: 3428.571 },
  { timestamp: '2026-09-19T00:02:00Z', side: 'sell', zkasAmount: 12500, totalKas: 500 },
  { timestamp: '2026-09-19T00:00:00Z', side: 'buy', zkasAmount: 117691, totalKas: 4119.185 },
  { timestamp: '2026-09-18T23:58:00Z', side: 'buy', zkasAmount: 100000, totalKas: 3550 },
  { timestamp: '2026-09-18T23:56:00Z', side: 'buy', zkasAmount: 25000, totalKas: 900 },
  { timestamp: '2026-09-18T23:54:00Z', side: 'buy', zkasAmount: 10000, totalKas: 360 },
  { timestamp: '2026-09-18T23:52:00Z', side: 'buy', zkasAmount: 100000, totalKas: 3700 },
  { timestamp: '2026-09-18T23:50:00Z', side: 'buy', zkasAmount: 27429, totalKas: 1023.98326806 },
  { timestamp: '2026-09-18T23:48:00Z', side: 'buy', zkasAmount: 210000, totalKas: 7839.7494 },
  { timestamp: '2026-09-18T23:46:00Z', side: 'buy', zkasAmount: 50000, totalKas: 1866.607 },
  { timestamp: '2026-09-18T23:44:00Z', side: 'buy', zkasAmount: 17996, totalKas: 671.82919144 },
  { timestamp: '2026-09-18T23:42:00Z', side: 'buy', zkasAmount: 31497, totalKas: 1183.93537851 },
  { timestamp: '2026-09-18T23:40:00Z', side: 'buy', zkasAmount: 32000, totalKas: 1202.84256 },
  { timestamp: '2026-09-18T23:02:00Z', side: 'sell', zkasAmount: 7.754, totalKas: 0.372192 },
  { timestamp: '2026-09-18T23:00:00Z', side: 'buy', zkasAmount: 41236, totalKas: 1550.01299388 },
  { timestamp: '2026-09-18T22:58:00Z', side: 'buy', zkasAmount: 110000, totalKas: 4149.9997 },
  { timestamp: '2026-09-18T22:56:00Z', side: 'sell', zkasAmount: 500, totalKas: 24 },
  { timestamp: '2026-09-18T21:02:00Z', side: 'buy', zkasAmount: 53000, totalKas: 1992.20799 },
  { timestamp: '2026-09-18T20:02:00Z', side: 'sell', zkasAmount: 18000, totalKas: 900 },
  { timestamp: '2026-09-18T20:00:00Z', side: 'sell', zkasAmount: 100000, totalKas: 5000 },
  { timestamp: '2026-09-18T19:58:00Z', side: 'sell', zkasAmount: 50000, totalKas: 2500 },
  { timestamp: '2026-09-18T17:02:00Z', side: 'sell', zkasAmount: 20000, totalKas: 800 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 1324) {
        stored = {
          ...stored,
          updatedAt,
          trades: [...stored.trades, ...reviewedTradesSep19Noon]
            .map(normalizeTrade)
            .filter(Boolean)
            .sort((a, b) => a.timestamp - b.timestamp)
            .slice(-5000),
        };
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
