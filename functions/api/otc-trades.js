const commonTradeArrays = ['trades', 'data', 'results', 'items', 'completedTrades', 'completed_trades'];

// One-time, count-guarded import for 29 reviewed trades newer than the
// already-stored 20,365 ZKAS / 1,221.9 KAS trade. The Discord desk reports
// 787 total rows, including 11 historical test/outlier rows intentionally
// excluded from the public history, so the expected public total is 776.
// Remove after production KV confirms the new total.
const reviewedSep7AfternoonTrades = [
  { timestamp: Date.parse('2026-09-07T12:50:00Z'), side: 'buy', zkasAmount: 30790, totalKas: 1234.1657307 },
  { timestamp: Date.parse('2026-09-07T12:51:00Z'), side: 'sell', zkasAmount: 13000, totalKas: 708.00002 },
  { timestamp: Date.parse('2026-09-07T12:52:00Z'), side: 'sell', zkasAmount: 7365, totalKas: 401.7273129 },
  { timestamp: Date.parse('2026-09-07T12:53:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 5800 },
  { timestamp: Date.parse('2026-09-07T12:54:00Z'), side: 'sell', zkasAmount: 250000, totalKas: 14400 },
  { timestamp: Date.parse('2026-09-07T12:55:00Z'), side: 'sell', zkasAmount: 250000, totalKas: 16000 },
  { timestamp: Date.parse('2026-09-07T12:56:00Z'), side: 'sell', zkasAmount: 500000, totalKas: 38000 },
  { timestamp: Date.parse('2026-09-07T13:56:00Z'), side: 'sell', zkasAmount: 3635, totalKas: 198.2727471 },
  { timestamp: Date.parse('2026-09-07T14:48:00Z'), side: 'buy', zkasAmount: 100000, totalKas: 5000 },
  { timestamp: Date.parse('2026-09-07T14:49:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 5800 },
  { timestamp: Date.parse('2026-09-07T14:50:00Z'), side: 'sell', zkasAmount: 100000, totalKas: 5900 },
  { timestamp: Date.parse('2026-09-07T14:51:00Z'), side: 'sell', zkasAmount: 5950, totalKas: 298.350017 },
  { timestamp: Date.parse('2026-09-07T14:52:00Z'), side: 'sell', zkasAmount: 43050, totalKas: 2158.650123 },
  { timestamp: Date.parse('2026-09-07T14:53:00Z'), side: 'sell', zkasAmount: 4000, totalKas: 272 },
  { timestamp: Date.parse('2026-09-07T14:54:00Z'), side: 'sell', zkasAmount: 405, totalKas: 27.54 },
  { timestamp: Date.parse('2026-09-07T14:55:00Z'), side: 'buy', zkasAmount: 550, totalKas: 24.3093895 },
  { timestamp: Date.parse('2026-09-07T14:56:00Z'), side: 'sell', zkasAmount: 250000, totalKas: 18000 },
  { timestamp: Date.parse('2026-09-07T15:54:00Z'), side: 'sell', zkasAmount: 30790, totalKas: 2468.000161 },
  { timestamp: Date.parse('2026-09-07T15:55:00Z'), side: 'sell', zkasAmount: 4000, totalKas: 1600 },
  { timestamp: Date.parse('2026-09-07T15:56:00Z'), side: 'sell', zkasAmount: 5000, totalKas: 340 },
  { timestamp: Date.parse('2026-09-07T16:52:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 680 },
  { timestamp: Date.parse('2026-09-07T16:53:00Z'), side: 'sell', zkasAmount: 115000, totalKas: 7820 },
  { timestamp: Date.parse('2026-09-07T16:54:00Z'), side: 'sell', zkasAmount: 13427, totalKas: 913.036 },
  { timestamp: Date.parse('2026-09-07T16:55:00Z'), side: 'sell', zkasAmount: 11000, totalKas: 748 },
  { timestamp: Date.parse('2026-09-07T16:56:00Z'), side: 'sell', zkasAmount: 5633, totalKas: 383.044 },
  { timestamp: Date.parse('2026-09-07T17:08:00Z'), side: 'sell', zkasAmount: 250000, totalKas: 22000 },
  { timestamp: Date.parse('2026-09-07T17:34:00Z'), side: 'sell', zkasAmount: 10000, totalKas: 680 },
  { timestamp: Date.parse('2026-09-07T17:35:00Z'), side: 'sell', zkasAmount: 40514.41069279, totalKas: 2754.97992711 },
  { timestamp: Date.parse('2026-09-07T17:47:00Z'), side: 'sell', zkasAmount: 6000, totalKas: 2400 },
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
      if (Array.isArray(stored?.trades) && stored.trades.length === 747) {
        const trades = [...stored.trades, ...reviewedSep7AfternoonTrades].sort((a, b) => a.timestamp - b.timestamp);
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
