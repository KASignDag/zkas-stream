const quoteSources = [
  {
    name: 'CoinPaprika',
    url: 'https://api.coinpaprika.com/v1/tickers/kas-kaspa',
    read(payload) {
      return {
        priceUsd: Number(payload?.quotes?.USD?.price),
        updatedAt: Date.parse(payload?.last_updated) || Date.now(),
      };
    },
  },
  {
    name: 'CoinGecko',
    url: 'https://api.coingecko.com/api/v3/simple/price?ids=kaspa&vs_currencies=usd&include_last_updated_at=true',
    read(payload) {
      return {
        priceUsd: Number(payload?.kaspa?.usd),
        updatedAt: Number(payload?.kaspa?.last_updated_at) * 1000 || Date.now(),
      };
    },
  },
  {
    name: 'CryptoCompare',
    url: 'https://min-api.cryptocompare.com/data/price?fsym=KAS&tsyms=USD',
    read(payload) {
      return {
        priceUsd: Number(payload?.USD),
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
        ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
        : 'public, max-age=10'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function fetchQuote(source) {
  const response = await fetch(source.url, {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 60 },
    signal: AbortSignal.timeout(3500),
  });
  if (!response.ok) throw new Error(`${source.name} quote unavailable`);

  const quote = source.read(await response.json());
  if (!Number.isFinite(quote.priceUsd) || quote.priceUsd <= 0) {
    throw new Error(`${source.name} returned an invalid quote`);
  }

  return {
    priceUsd: quote.priceUsd,
    updatedAt: quote.updatedAt,
    source: source.name,
  };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheUrl = new URL('/__cache/kas-usd-last-good', context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  for (const source of quoteSources) {
    try {
      const quote = await fetchQuote(source);
      const cachedResponse = json(quote, 200, 'public, max-age=604800');
      context.waitUntil(cache.put(cacheKey, cachedResponse));
      return json(quote);
    } catch {
      // Try the next public quote provider before falling back to the last good price.
    }
  }

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const quote = await cachedResponse.json();
      return json({ ...quote, stale: true });
    }
  } catch {
    // If the edge cache is unavailable, return the normal temporary error below.
  }

  return json({ error: 'quote_unavailable' }, 502);
}
