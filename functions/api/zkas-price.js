const SOURCES = [
  {
    name: 'NeoxEX ZKAS/USDT',
    url: 'https://neoxa.exchange/api/exchange/ticker/ZKAS_USDT',
    read(payload) {
      return Number(payload?.ticker?.lastPrice);
    },
  },
  {
    name: 'NoirTrade ZKAS/USDT',
    url: 'https://noirtrade.com/api/v1/tickers',
    read(payload) {
      const row = Array.isArray(payload)
        ? payload.find((ticker) => ticker?.ticker_id === 'ZKAS_USDT')
        : null;
      return Number(row?.last_price);
    },
  },
];

function json(body, status = 200, cacheControl) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl ?? (status === 200
        ? 'public, max-age=20, s-maxage=30, stale-while-revalidate=120'
        : 'public, max-age=10'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function fetchQuote(source) {
  const response = await fetch(source.url, {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 30 },
  });
  if (!response.ok) throw new Error(`${source.name}: HTTP ${response.status}`);
  const priceUsd = source.read(await response.json());
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error(`${source.name}: invalid quote`);
  return { priceUsd, source: source.name, updatedAt: Date.now() };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheUrl = new URL('/__cache/zkas-usd-last-good', context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  try {
    const quote = await Promise.any(SOURCES.map(fetchQuote));
    context.waitUntil(cache.put(cacheKey, json(quote, 200, 'public, max-age=604800')));
    return json(quote);
  } catch {
    // Try the last known good edge snapshot if both exchange feeds are unavailable.
  }

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const quote = await cachedResponse.json();
      return json({ ...quote, stale: true });
    }
  } catch {
    // Return the normal temporary error below when the edge cache is unavailable.
  }

  return json({ error: 'zkas_quote_unavailable' }, 502);
}
