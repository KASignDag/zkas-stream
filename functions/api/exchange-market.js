const EXCHANGES = {
  neoxex: {
    name: 'NeoxEX',
    website: 'https://neoxa.exchange',
    tradeUrl: 'https://neoxa.exchange/trade/ZKAS_USDT',
    pairs: ['ZKAS_USDT', 'ZKAS_XMR'],
  },
  noirtrade: {
    name: 'NoirTrade',
    website: 'https://noirtrade.com',
    tradeUrl: 'https://noirtrade.com/trade?pair=ZKAS_USDT',
    pairs: ['ZKAS_USDT'],
  },
  arrrex: {
    name: 'ARRREX',
    website: 'https://arrrex.com',
    tradeUrl: 'https://arrrex.com/app/trade?market=ZKAS-USDT',
    pairs: ['ZKAS_USDT'],
  },
  nonkyc: {
    name: 'NonKYC',
    website: 'https://nonkyc.io',
    tradeUrl: 'https://nonkyc.io/market/ZKAS_USDT',
    pairs: ['ZKAS_USDT'],
  },
};

const intervals = new Set(['1m', '5m', '15m', '1h', '4h', '1d']);
const intervalSeconds = { '1m': 60, '5m': 300, '15m': 900, '1h': 3600, '4h': 14400, '1d': 86400 };

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

function numeric(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function exchangeInfo(exchangeId) {
  const exchange = EXCHANGES[exchangeId];
  return { id: exchangeId, name: exchange.name, website: exchange.website, tradeUrl: exchange.tradeUrl };
}

async function neoxexMarket(pair, interval) {
  const baseUrl = 'https://neoxa.exchange/api/exchange';
  const encodedPair = encodeURIComponent(pair);
  const [ticker, orderbook, candles, trades] = await Promise.all([
    readJson(`${baseUrl}/ticker/${encodedPair}`),
    readJson(`${baseUrl}/orderbook/${encodedPair}`),
    readJson(`${baseUrl}/candles/${encodedPair}?interval=${encodeURIComponent(interval)}&limit=500`),
    readJson(`${baseUrl}/trades/${encodedPair}`),
  ]);
  return {
    ticker: ticker?.ticker ?? null,
    orderbook: { bids: orderbook?.bids ?? [], asks: orderbook?.asks ?? [] },
    candles: candles?.candles ?? [],
    trades: trades?.trades ?? [],
    chartSource: 'Exchange OHLCV candles',
  };
}

function normalizeNoirTrades(payload) {
  const rows = [...(payload?.buy ?? []), ...(payload?.sell ?? [])]
    .map((trade) => {
      const timestampMs = numeric(trade.trade_timestamp);
      return {
        trade_id: `NOIR-${trade.trade_id}`,
        side: trade.type === 'sell' ? 'sell' : 'buy',
        quantity: numeric(trade.base_volume),
        price: numeric(trade.price),
        total: numeric(trade.target_volume),
        timestampMs,
        executed_at: timestampMs > 0 ? new Date(timestampMs).toISOString() : '',
      };
    })
    .filter((trade) => trade.timestampMs > 0 && trade.price > 0 && trade.quantity > 0)
    .sort((a, b) => a.timestampMs - b.timestampMs);

  const deduped = [];
  for (const trade of rows) {
    const duplicate = deduped.at(-1);
    if (duplicate
      && Math.abs(duplicate.timestampMs - trade.timestampMs) <= 1000
      && duplicate.price === trade.price
      && duplicate.quantity === trade.quantity) continue;
    deduped.push(trade);
  }
  return deduped;
}

function tradesToCandles(trades, interval) {
  const seconds = intervalSeconds[interval];
  const buckets = new Map();
  for (const trade of trades) {
    const time = Math.floor(trade.timestampMs / 1000 / seconds) * seconds;
    const current = buckets.get(time);
    if (!current) {
      buckets.set(time, { time, open: trade.price, high: trade.price, low: trade.price, close: trade.price, volume: trade.quantity });
    } else {
      current.high = Math.max(current.high, trade.price);
      current.low = Math.min(current.low, trade.price);
      current.close = trade.price;
      current.volume += trade.quantity;
    }
  }
  return [...buckets.values()].sort((a, b) => a.time - b.time).slice(-500);
}

async function noirtradeMarket(pair, interval) {
  const pairId = encodeURIComponent(pair);
  const [tickers, orderbook, history] = await Promise.all([
    readJson('https://noirtrade.com/api/v1/tickers'),
    readJson(`https://noirtrade.com/api/v1/orderbook?ticker_id=${pairId}&depth=100`),
    readJson(`https://noirtrade.com/api/v1/historical_trades?ticker_id=${pairId}&limit=500`),
  ]);
  const rawTicker = Array.isArray(tickers) ? tickers.find((ticker) => ticker.ticker_id === pair) : null;
  if (!rawTicker) throw new Error('NoirTrade market not found');
  const trades = normalizeNoirTrades(history);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recentTrades = trades.filter((trade) => trade.timestampMs >= cutoff);
  const first24h = recentTrades[0]?.price ?? numeric(rawTicker.last_price);
  const lastPrice = numeric(rawTicker.last_price);
  const changePercent = first24h > 0 ? ((lastPrice - first24h) / first24h) * 100 : 0;
  return {
    ticker: {
      lastPrice,
      changePercent,
      high24h: numeric(rawTicker.high),
      low24h: numeric(rawTicker.low),
      volume24h: numeric(rawTicker.base_volume),
      quoteVolume24h: numeric(rawTicker.target_volume),
      trades24h: recentTrades.length,
      bestBid: numeric(rawTicker.bid),
      bestAsk: numeric(rawTicker.ask),
    },
    orderbook: {
      bids: (orderbook?.bids ?? []).map(([price, quantity]) => ({ price: numeric(price), quantity: numeric(quantity), orders: 1 })),
      asks: (orderbook?.asks ?? []).map(([price, quantity]) => ({ price: numeric(price), quantity: numeric(quantity), orders: 1 })),
    },
    candles: tradesToCandles(trades, interval),
    trades: trades.map(({ timestampMs, ...trade }) => trade),
    chartSource: 'Candles calculated from completed trades',
  };
}

async function arrrexMarket(pair, interval) {
  const symbol = pair.replace('_', '-');
  const encodedSymbol = encodeURIComponent(symbol);
  const baseUrl = 'https://arrrex.com/api/markets';
  const [ticker, orderbook, tradesPayload, candlesPayload] = await Promise.all([
    readJson(`${baseUrl}/${encodedSymbol}`),
    readJson(`${baseUrl}/${encodedSymbol}/orderbook?depth=100`),
    readJson(`${baseUrl}/${encodedSymbol}/trades?limit=500`),
    readJson(`${baseUrl}/${encodedSymbol}/candles?interval=${encodeURIComponent(interval)}&limit=500`),
  ]);
  const trades = (Array.isArray(tradesPayload) ? tradesPayload : [])
    .map((trade, index) => {
      const quantity = numeric(trade.quantity);
      const price = numeric(trade.price);
      const executedAt = trade.executed_at || '';
      return {
        trade_id: `ARRREX-${executedAt || index}`,
        side: trade.taker_side === 'sell' ? 'sell' : 'buy',
        quantity,
        price,
        total: price * quantity,
        executed_at: executedAt,
      };
    })
    .filter((trade) => trade.price > 0 && trade.quantity > 0);

  return {
    ticker: {
      lastPrice: numeric(ticker?.last_price),
      changePercent: numeric(ticker?.change_24h),
      high24h: numeric(ticker?.high_24h),
      low24h: numeric(ticker?.low_24h),
      volume24h: numeric(ticker?.volume_24h),
      quoteVolume24h: numeric(ticker?.quote_volume_24h),
      trades24h: trades.filter((trade) => Date.parse(trade.executed_at) >= Date.now() - 24 * 60 * 60 * 1000).length,
      bestBid: numeric(ticker?.bid),
      bestAsk: numeric(ticker?.ask),
    },
    orderbook: {
      bids: (orderbook?.bids ?? []).map((level) => ({ price: numeric(level.price), quantity: numeric(level.quantity), orders: 1 })),
      asks: (orderbook?.asks ?? []).map((level) => ({ price: numeric(level.price), quantity: numeric(level.quantity), orders: 1 })),
    },
    candles: (Array.isArray(candlesPayload) ? candlesPayload : []).map((candle) => ({
      time: Math.floor(Date.parse(candle.time) / 1000),
      open: numeric(candle.open),
      high: numeric(candle.high),
      low: numeric(candle.low),
      close: numeric(candle.close),
      volume: numeric(candle.volume),
    })).filter((candle) => Number.isFinite(candle.time) && candle.time > 0),
    trades,
    chartSource: 'ARRREX exchange OHLCV candles',
  };
}

async function nonkycMarket(pair, interval) {
  const encodedPair = encodeURIComponent(pair);
  const [ticker, orderbook, tradesPayload] = await Promise.all([
    readJson(`https://api.nonkyc.io/api/v2/market/getbysymbol/${encodedPair}`),
    readJson(`https://api.nonkyc.io/api/v2/market/getorderbookbysymbol/${encodedPair}`),
    readJson(`https://nonkyc.io/api/v2/market/tradehistory?symbol=${encodedPair}&limit=500`),
  ]);
  const trades = (Array.isArray(tradesPayload) ? tradesPayload : [])
    .map((trade, index) => {
      const timestampMs = numeric(trade.createdAt);
      const quantity = numeric(trade.quantity);
      const price = numeric(trade.price);
      return {
        trade_id: `NONKYC-${timestampMs || index}-${index}`,
        side: trade.triggeredby === 'sell' ? 'sell' : 'buy',
        quantity,
        price,
        total: numeric(trade.total, price * quantity),
        timestampMs,
        executed_at: timestampMs > 0 ? new Date(timestampMs).toISOString() : '',
      };
    })
    .filter((trade) => trade.timestampMs > 0 && trade.price > 0 && trade.quantity > 0);
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;

  return {
    ticker: {
      lastPrice: numeric(ticker?.lastPriceNumber ?? ticker?.lastPrice),
      changePercent: numeric(ticker?.changePercentNumber ?? ticker?.changePercent),
      high24h: numeric(ticker?.highPriceNumber ?? ticker?.highPrice),
      low24h: numeric(ticker?.lowPriceNumber ?? ticker?.lowPrice),
      volume24h: numeric(ticker?.volumeNumber ?? ticker?.volume),
      quoteVolume24h: numeric(ticker?.volumeSecondaryNumber ?? ticker?.volumeSecondary),
      trades24h: trades.filter((trade) => trade.timestampMs >= cutoff).length,
      bestBid: numeric(ticker?.bestBidNumber ?? ticker?.bestBid),
      bestAsk: numeric(ticker?.bestAskNumber ?? ticker?.bestAsk),
    },
    orderbook: {
      bids: (orderbook?.bids ?? []).map((level) => ({ price: numeric(level.numberprice ?? level.price), quantity: numeric(level.quantity), orders: 1 })),
      asks: (orderbook?.asks ?? []).map((level) => ({ price: numeric(level.numberprice ?? level.price), quantity: numeric(level.quantity), orders: 1 })),
    },
    candles: tradesToCandles([...trades].sort((a, b) => a.timestampMs - b.timestampMs), interval),
    trades: trades.map(({ timestampMs, ...trade }) => trade),
    chartSource: 'Candles calculated from NonKYC completed trades',
  };
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
    const market = exchangeId === 'noirtrade'
      ? await noirtradeMarket(pair, interval)
      : exchangeId === 'arrrex'
        ? await arrrexMarket(pair, interval)
        : exchangeId === 'nonkyc'
          ? await nonkycMarket(pair, interval)
          : await neoxexMarket(pair, interval);
    return json({ exchange: exchangeInfo(exchangeId), pair, interval, ...market, updatedAt: Date.now() });
  } catch (error) {
    return json({
      error: 'exchange_market_unavailable',
      message: error instanceof Error ? error.message : 'Unable to load exchange market data',
    }, 502);
  }
}
