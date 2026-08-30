function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200
        ? 'public, max-age=30, s-maxage=60, stale-while-revalidate=300'
        : 'public, max-age=10',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function onRequestGet() {
  try {
    const response = await fetch('https://api.coinpaprika.com/v1/tickers/kas-kaspa', {
      headers: { Accept: 'application/json' },
      cf: { cacheEverything: true, cacheTtl: 60 },
    });
    if (!response.ok) return json({ error: 'quote_unavailable' }, 502);

    const payload = await response.json();
    const priceUsd = Number(payload?.quotes?.USD?.price);
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return json({ error: 'invalid_quote' }, 502);

    return json({
      priceUsd,
      updatedAt: Date.parse(payload.last_updated) || Date.now(),
      source: 'CoinPaprika',
    });
  } catch {
    return json({ error: 'quote_unavailable' }, 502);
  }
}
