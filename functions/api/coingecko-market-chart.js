function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=900'
        : 'public, max-age=20',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function onRequestGet({ request }) {
  const requestedDays = new URL(request.url).searchParams.get('days');
  const days = ['1', '7', '30', '90', '365', 'max'].includes(requestedDays) ? requestedDays : '1';
  const cache = caches.default;
  const cacheKey = new Request(`https://zkas.stream/__cache/coingecko-zkas-chart-${days}d`);

  try {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  } catch {
    // Continue to CoinGecko if the edge cache is unavailable.
  }

  try {
    const upstream = await fetch(`https://api.coingecko.com/api/v3/coins/zkas/market_chart?vs_currency=usd&days=${days}`, {
      headers: { Accept: 'application/json' },
      cf: { cacheEverything: true, cacheTtl: 300 },
    });
    if (!upstream.ok) return json({ error: 'coingecko_chart_unavailable' }, upstream.status === 429 ? 503 : 502);

    const payload = await upstream.json();
    if (!Array.isArray(payload?.prices) || !Array.isArray(payload?.total_volumes)) {
      return json({ error: 'coingecko_chart_invalid' }, 502);
    }
    const response = json({
      prices: payload.prices,
      total_volumes: payload.total_volumes,
      source: 'CoinGecko',
    });
    try {
      await cache.put(cacheKey, response.clone());
    } catch {
      // A live response is still usable when cache storage is unavailable.
    }
    return response;
  } catch {
    return json({ error: 'coingecko_chart_unavailable' }, 502);
  }
}
