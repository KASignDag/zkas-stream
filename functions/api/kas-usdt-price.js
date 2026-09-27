const quoteSources = [
  {
    name: 'KuCoin KAS/USDT',
    url: 'https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=KAS-USDT',
    read(payload) {
      return {
        priceUsdt: Number(payload?.data?.price),
        updatedAt: Number(payload?.data?.time) || Date.now(),
      };
    },
  },
  {
    name: 'Gate.io KAS/USDT',
    url: 'https://api.gateio.ws/api/v4/spot/tickers?currency_pair=KAS_USDT',
    read(payload) {
      return {
        priceUsdt: Number(payload?.[0]?.last),
        updatedAt: Date.now(),
      };
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

  const quote = source.read(await response.json());
  if (!Number.isFinite(quote.priceUsdt) || quote.priceUsdt <= 0) {
    throw new Error(`${source.name}: invalid quote`);
  }
  return { ...quote, source: source.name };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheUrl = new URL('/__cache/kas-usdt-last-good', context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  try {
    const quote = await Promise.any(quoteSources.map(fetchQuote));
    context.waitUntil(cache.put(cacheKey, json(quote, 200, 'public, max-age=604800')));
    return json(quote);
  } catch {
    // Keep the converter usable with the last valid exchange quote during an outage.
  }

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return json({ ...(await cachedResponse.json()), stale: true });
  } catch {
    // Fall through to the normal temporary error.
  }

  return json({ error: 'quote_unavailable' }, 502);
}
