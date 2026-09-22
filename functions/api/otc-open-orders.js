const upstreamEndpoint = 'https://mining-pool.zkas.info/api/otc/orders';

function numberish(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[$,\s]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function sideish(value, fallback = 'unknown') {
  const side = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (['buy', 'bid'].includes(side)) return 'buy';
  if (['sell', 'ask'].includes(side)) return 'sell';
  return fallback;
}

function rowsFromPayload(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  if (Array.isArray(payload.orders)) return payload.orders;
  if (Array.isArray(payload.data)) return payload.data;
  const bids = Array.isArray(payload.bids) ? payload.bids.map((row) => ({ ...row, side: row?.side ?? 'buy' })) : [];
  const asks = Array.isArray(payload.asks) ? payload.asks.map((row) => ({ ...row, side: row?.side ?? 'sell' })) : [];
  return [...bids, ...asks];
}

function normalizeOrder(row, market) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const side = sideish(row.side ?? row.type ?? row.direction);
  const price = numberish(row.price ?? row.rate ?? row.unitPrice);
  const zkasRemaining = numberish(row.zkasRemaining ?? row.zkas_remaining ?? row.remaining ?? row.zkas ?? row.amount ?? row.quantity);
  let totalQuote = numberish(row.totalQuote ?? row.total_quote ?? row.total ?? row.notional);
  const viaValue = typeof row.via === 'string' ? row.via.trim().toLowerCase() : '';
  const via = viaValue === 'discord' || viaValue === 'telegram' ? viaValue : null;
  if (totalQuote === null && price !== null && zkasRemaining !== null) totalQuote = price * zkasRemaining;
  if (side === 'unknown' || price === null || zkasRemaining === null || totalQuote === null) return null;
  return { market, side, price, zkasRemaining, totalQuote, via };
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200 ? 'public, max-age=10, s-maxage=20, stale-while-revalidate=60' : 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function fetchMarket(market, signal) {
  const url = new URL(upstreamEndpoint);
  url.searchParams.set('market', market);
  const response = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`upstream_${response.status}`);
  const payload = await response.json();
  return rowsFromPayload(payload).map((row) => normalizeOrder(row, market)).filter(Boolean);
}

async function handleGet({ request, waitUntil }) {
  const updatedAt = Date.now();
  const cacheUrl = new URL(request.url);
  cacheUrl.search = '';
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
  const edgeCache = typeof caches !== 'undefined' ? caches.default : null;
  const cached = edgeCache ? await edgeCache.match(cacheKey) : null;
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const orders = (await Promise.all([
      fetchMarket('KAS', controller.signal),
      fetchMarket('USD', controller.signal),
    ])).flat();
    const response = json({ schemaVersion: 1, status: 'live', source: 'shared-otc-api', updatedAt, orders });
    if (edgeCache && waitUntil) waitUntil(edgeCache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return json({ schemaVersion: 1, status: 'upstream_unavailable', source: 'shared-otc-api', updatedAt, orders: [], message: 'Open ZKAS orders are temporarily unavailable.' }, 502);
  } finally {
    clearTimeout(timeout);
  }
}

export function onRequest(context) {
  if (context.request.method === 'GET') return handleGet(context);
  return json({ error: 'method_not_allowed' }, 405);
}
