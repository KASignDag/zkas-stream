const upstreamEndpoint = 'https://mining-pool.zkas.info/api/otc/trades';
const pageSize = 500;
const maxPages = 10;

// These records came from the bot's initial test period and were already omitted
// from the reviewed ZKAS.stream history. Keep that decision when switching to API data.
const excludedTestTimestamps = new Set([
  1787495298851,
  1787497853961,
  1787498655454,
  1787498871400,
  1787502384097,
  1787503314996,
  1787503919556,
  1789721677580,
  1789721692546,
  1789721715827,
  1789721755210,
]);

function numberish(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function sideish(value) {
  const side = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (side === 'buy') return 'buy';
  if (side === 'sell') return 'sell';
  return 'unknown';
}

function routeish(value) {
  const route = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return route === 'discord' || route === 'telegram' ? route : null;
}

function normalizeTrade(row) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const timestamp = numberish(row.ts ?? row.timestamp ?? row.time);
  if (timestamp !== null && excludedTestTimestamps.has(timestamp)) return null;
  const zkasAmount = numberish(row.zkas ?? row.zkasAmount ?? row.amount);
  let priceKas = numberish(row.price ?? row.priceKas);
  let totalKas = numberish(row.total ?? row.totalKas);
  if (priceKas === null && totalKas !== null && zkasAmount) priceKas = totalKas / zkasAmount;
  if (totalKas === null && priceKas !== null && zkasAmount !== null) totalKas = priceKas * zkasAmount;
  if (timestamp === null || zkasAmount === null || priceKas === null || totalKas === null) return null;
  return {
    timestamp: timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp,
    side: sideish(row.makerSide ?? row.side),
    zkasAmount,
    priceKas,
    totalKas,
    makerVia: routeish(row.makerVia),
    takerVia: routeish(row.takerVia),
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

async function reviewedFallback(env, updatedAt) {
  if (!env.OTC_TRADES) return null;
  const stored = await env.OTC_TRADES.get('trades:v1', 'json');
  if (!Array.isArray(stored?.trades) || !stored.trades.length) return null;
  const trades = stored.trades.map((row) => ({
    timestamp: numberish(row.timestamp),
    side: sideish(row.side),
    zkasAmount: numberish(row.zkasAmount),
    priceKas: numberish(row.priceKas) ?? (numberish(row.totalKas) !== null && numberish(row.zkasAmount) ? numberish(row.totalKas) / numberish(row.zkasAmount) : null),
    totalKas: numberish(row.totalKas),
    makerVia: null,
    takerVia: null,
  })).filter((trade) => trade.timestamp !== null && trade.zkasAmount !== null && trade.priceKas !== null && trade.totalKas !== null);
  return {
    schemaVersion: 1,
    status: 'live',
    source: 'screenshot-fallback',
    market: 'shared',
    updatedAt: stored.updatedAt || updatedAt,
    trades,
    message: 'Showing the preserved reviewed history while the shared OTC API reconnects.',
  };
}

async function handleGet({ request, env, waitUntil }) {
  const updatedAt = Date.now();
  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const edgeCache = typeof caches !== 'undefined' ? caches.default : null;
  const cached = edgeCache ? await edgeCache.match(cacheKey) : null;
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const rows = [];
    let since = 0;
    for (let page = 0; page < maxPages; page += 1) {
      const url = new URL(upstreamEndpoint);
      url.searchParams.set('market', 'KAS');
      url.searchParams.set('since', String(since));
      url.searchParams.set('limit', String(pageSize));
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      if (!response.ok) throw new Error(`upstream_${response.status}`);
      const payload = await response.json();
      const pageRows = Array.isArray(payload) ? payload : Array.isArray(payload?.trades) ? payload.trades : Array.isArray(payload?.data) ? payload.data : [];
      if (!pageRows.length) break;
      rows.push(...pageRows);
      const lastTimestamp = numberish(pageRows.at(-1)?.ts);
      const next = numberish(payload?.next) ?? (lastTimestamp === null ? null : lastTimestamp + 1);
      if (pageRows.length < pageSize || next === null || next <= since) break;
      since = next;
    }

    const trades = rows.map(normalizeTrade).filter(Boolean).slice(-5000);
    if (!trades.length) throw new Error('empty_upstream');
    const response = json({
      schemaVersion: 1,
      status: 'live',
      source: 'shared-otc-api',
      market: 'shared',
      updatedAt,
      trades,
    }, 200, 'public, max-age=10, s-maxage=30, stale-while-revalidate=120');
    if (edgeCache && waitUntil) waitUntil(edgeCache.put(cacheKey, response.clone()));
    return response;
  } catch {
    const fallback = await reviewedFallback(env, updatedAt);
    if (fallback) return json(fallback, 200, 'public, max-age=10, s-maxage=30, stale-while-revalidate=120');
    return json({
      schemaVersion: 1,
      status: 'upstream_unavailable',
      source: 'shared-otc-api',
      market: 'shared',
      updatedAt,
      trades: [],
      message: 'The shared OTC API is temporarily unavailable.',
    }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function onRequest(context) {
  if (context.request.method === 'GET') return handleGet(context);
  return json({ error: 'method_not_allowed' }, 405);
}
