const EXCHANGES = {
  neoxex: {
    name: 'NeoxEX',
    website: 'https://neoxa.exchange',
    tradeUrl: 'https://neoxa.exchange/trade/ZKAS_USDT',
    baseUrl: 'https://neoxa.exchange/api/exchange',
    pairs: ['ZKAS_USDT', 'ZKAS_XMR'],
  },
};

const intervals = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200
        ? 'public, max-age=5, s-maxage=10, stale-while-revalidate=30'
        : 'public, max-age=5',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 10 },
  });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
  return response.json();
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const exchangeId = (url.searchParams.get('exchange') || 'neoxex').toLowerCase();
  const pair = (url.searchParams.get('pair') || 'ZKAS_USDT').toUpperCase();
  const interval = url.searchParams.get('interval') || '15m';
  const exchange = EXCHANGES[exchangeId];

  if (!exchange) return json({ error: 'unsupported_exchange' }, 400);
  if (!exchange.pairs.includes(pair)) return json({ error: 'unsupported_pair' }, 400);
  if (!intervals.has(interval)) return json({ error: 'unsupported_interval' }, 400);

  try {
    const encodedPair = encodeURIComponent(pair);
    const [ticker, orderbook, candles, trades] = await Promise.all([
      readJson(`${exchange.baseUrl}/ticker/${encodedPair}`),
      readJson(`${exchange.baseUrl}/orderbook/${encodedPair}`),
      readJson(`${exchange.baseUrl}/candles/${encodedPair}?interval=${encodeURIComponent(interval)}&limit=500`),
      readJson(`${exchange.baseUrl}/trades/${encodedPair}`),
    ]);

    return json({
      exchange: { id: exchangeId, name: exchange.name, website: exchange.website, tradeUrl: exchange.tradeUrl },
      pair,
      interval,
      ticker: ticker?.ticker ?? null,
      orderbook: { bids: orderbook?.bids ?? [], asks: orderbook?.asks ?? [] },
      candles: candles?.candles ?? [],
      trades: trades?.trades ?? [],
      updatedAt: Date.now(),
    });
  } catch (error) {
    return json({
      error: 'exchange_market_unavailable',
      message: error instanceof Error ? error.message : 'Unable to load exchange market data',
    }, 502);
  }
}
