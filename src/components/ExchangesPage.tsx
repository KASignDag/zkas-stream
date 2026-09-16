import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, BookOpen, ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react';

type Interval = '5m' | '15m' | '1h' | '4h' | '1d';
type ExchangeId = 'neoxex' | 'noirtrade';
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type Level = { price: number; quantity: number; orders: number };
type Trade = { trade_id: string; side: 'buy' | 'sell'; quantity: number; price: number; total: number; executed_at: string };
type MarketFeed = {
  exchange: { id: ExchangeId; name: string; website: string; tradeUrl: string };
  pair: string;
  interval: Interval;
  ticker: {
    lastPrice: number;
    changePercent: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    quoteVolume24h: number;
    trades24h: number;
    bestBid: number;
    bestAsk: number;
  } | null;
  orderbook: { bids: Level[]; asks: Level[] };
  candles: Candle[];
  trades: Trade[];
  chartSource: string;
  updatedAt: number;
};

const exchangeIds: ExchangeId[] = ['neoxex', 'noirtrade'];
const exchangeNames: Record<ExchangeId, string> = { neoxex: 'NeoxEX', noirtrade: 'NoirTrade' };
const listedMarkets = [{
  id: 'nonkyc',
  name: 'NonKYC',
  pair: 'ZKAS/USDT',
  tradeUrl: 'https://nonkyc.io/market/ZKAS_USDT',
}] as const;
const intervals: Interval[] = ['5m', '15m', '1h', '4h', '1d'];
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

function usd(value: number | null | undefined, digits = 6) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function amount(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return number.format(value);
}

function PriceChart({ candles, lastPrice }: { candles: Candle[]; lastPrice: number | null }) {
  const chart = useMemo(() => {
    const rows = candles.filter((c) => [c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite));
    if (!rows.length) return null;
    const width = 1000;
    const height = 410;
    const left = 18;
    const right = 92;
    const top = 22;
    const priceBottom = 292;
    const volumeTop = 320;
    const volumeBottom = 382;
    const lows = rows.map((c) => c.low);
    const highs = rows.map((c) => c.high);
    const rawMin = Math.min(...lows);
    const rawMax = Math.max(...highs);
    const rawSpan = rawMax - rawMin || Math.max(rawMax * .08, .000001);
    const min = Math.max(0, rawMin - rawSpan * .08);
    const max = rawMax + rawSpan * .08;
    const span = max - min || 1;
    const innerWidth = width - left - right;
    const step = innerWidth / Math.max(rows.length, 1);
    const candleWidth = Math.max(3, Math.min(18, step * .58));
    const maxVolume = Math.max(...rows.map((c) => c.volume), 1);
    const x = (index: number) => left + step * index + step / 2;
    const y = (price: number) => top + (1 - (price - min) / span) * (priceBottom - top);
    const volumeY = (volume: number) => volumeBottom - (volume / maxVolume) * (volumeBottom - volumeTop);
    return { rows, width, height, left, right, volumeTop, volumeBottom, min, max, x, y, volumeY, candleWidth };
  }, [candles]);

  if (!chart) return <div className="exchange-chart-empty">Waiting for completed exchange trades…</div>;
  const labelIndexes = Array.from(new Set([0, Math.floor((chart.rows.length - 1) / 2), chart.rows.length - 1]));
  const priceTicks = [0, .25, .5, .75, 1].map((ratio) => chart.max - (chart.max - chart.min) * ratio);
  const currentY = lastPrice !== null && lastPrice >= chart.min && lastPrice <= chart.max ? chart.y(lastPrice) : null;

  return (
    <div className="exchange-chart-wrap">
      <svg className="exchange-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Live ZKAS USDT candlestick chart">
        {priceTicks.map((price) => {
          const y = chart.y(price);
          return <g key={price}><line x1={chart.left} x2={chart.width - chart.right} y1={y} y2={y} className="exchange-grid" /><text x={chart.width - chart.right + 10} y={y + 4} className="exchange-axis">{price.toFixed(price >= .1 ? 4 : 6)}</text></g>;
        })}
        <line x1={chart.left} x2={chart.width - chart.right} y1={chart.volumeTop - 12} y2={chart.volumeTop - 12} className="exchange-grid" />
        {chart.rows.map((candle, index) => {
          const x = chart.x(index);
          const openY = chart.y(candle.open);
          const closeY = chart.y(candle.close);
          const highY = chart.y(candle.high);
          const lowY = chart.y(candle.low);
          const up = candle.close >= candle.open;
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(2.5, Math.abs(closeY - openY));
          return <g key={`${candle.time}-${index}`} className={up ? 'candle-up' : 'candle-down'}>
            <line x1={x} x2={x} y1={highY} y2={lowY} className="candle-wick" />
            <rect x={x - chart.candleWidth / 2} y={bodyTop} width={chart.candleWidth} height={bodyHeight} rx="1.5" className="candle-body" />
            <rect x={x - chart.candleWidth / 2} y={chart.volumeY(candle.volume)} width={chart.candleWidth} height={chart.volumeBottom - chart.volumeY(candle.volume)} rx="1" className="candle-volume" />
          </g>;
        })}
        {currentY !== null && <g><line x1={chart.left} x2={chart.width - chart.right} y1={currentY} y2={currentY} className="exchange-current-line" /><rect x={chart.width - chart.right + 3} y={currentY - 12} width={86} height={24} rx="5" className="exchange-current-tag" /><text x={chart.width - chart.right + 46} y={currentY + 4} textAnchor="middle" className="exchange-current-text">{lastPrice?.toFixed(6)}</text></g>}
        {labelIndexes.map((index) => <text key={index} x={chart.x(index)} y={407} textAnchor={index === 0 ? 'start' : index === chart.rows.length - 1 ? 'end' : 'middle'} className="exchange-axis">{new Date(chart.rows[index].time * 1000).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</text>)}
      </svg>
    </div>
  );
}

function MarketMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: 'bid' | 'ask' }) {
  return <div className={`exchange-metric ${tone ?? ''}`}><span>{label}</span><b>{value}</b><small>{detail}</small></div>;
}

function OrderBook({ feed }: { feed: MarketFeed | null }) {
  const asks = [...(feed?.orderbook.asks ?? [])]
    .filter((level) => level.price > 0 && level.quantity > 0)
    .sort((a, b) => a.price - b.price)
    .slice(0, 10)
    .reverse();
  const bids = [...(feed?.orderbook.bids ?? [])]
    .filter((level) => level.price > 0 && level.quantity > 0)
    .sort((a, b) => b.price - a.price)
    .slice(0, 10);
  const bestAsk = asks.at(-1)?.price ?? feed?.ticker?.bestAsk ?? 0;
  const bestBid = bids[0]?.price ?? feed?.ticker?.bestBid ?? 0;
  const spread = bestAsk > 0 && bestBid > 0 ? ((bestAsk - bestBid) / bestAsk) * 100 : null;
  const renderRows = (levels: Level[], side: 'ask' | 'bid') => levels.length
    ? levels.map((level, index) => (
      <div className={`exchange-book-row ${side}`} key={`${side}-${level.price}-${index}`}>
        <span>{level.price.toFixed(6)}</span>
        <span>{amount(level.quantity)}</span>
        <span>{usd(level.price * level.quantity, 2)}</span>
      </div>
    ))
    : <div className="exchange-book-empty">No open {side === 'ask' ? 'sell' : 'buy'} orders</div>;

  return (
    <section className="panel exchange-orderbook-panel">
      <div className="exchange-orderbook-head">
        <div><span className="panel-icon"><BookOpen size={20} /></span><div><h2>Order book</h2><p>{feed?.exchange.name ?? 'Exchange'} · Open ZKAS/USDT orders</p></div></div>
        <span className="range-chip">LIVE</span>
      </div>
      <div className="exchange-book-columns"><span>Price (USDT)</span><span>Amount (ZKAS)</span><span>Total (USDT)</span></div>
      <div className="exchange-book-side asks">{renderRows(asks, 'ask')}</div>
      <div className="exchange-book-mid">
        <b>{usd(feed?.ticker?.lastPrice)}</b>
        <span>{spread === null ? 'Spread unavailable' : `Spread ${spread.toFixed(2)}%`}</span>
      </div>
      <div className="exchange-book-side bids">{renderRows(bids, 'bid')}</div>
      <p className="exchange-book-note">Open orders refresh every 10 seconds. Totals show price × amount.</p>
    </section>
  );
}

export function ExchangesPage() {
  const [feeds, setFeeds] = useState<Partial<Record<ExchangeId, MarketFeed>>>({});
  const [selected, setSelected] = useState<ExchangeId>('neoxex');
  const [interval, setInterval] = useState<Interval>('15m');
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<ExchangeId, string>>>({});

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      const results = await Promise.allSettled(exchangeIds.map(async (exchangeId) => {
        const response = await fetch(`/api/exchange-market?exchange=${exchangeId}&pair=ZKAS_USDT&interval=${interval}`, { signal: controller?.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(`${exchangeNames[exchangeId]} feed is temporarily unavailable.`);
        return await response.json() as MarketFeed;
      }));
      if (stopped || controller.signal.aborted) return;
      const nextErrors: Partial<Record<ExchangeId, string>> = {};
      setFeeds((previous) => {
        const next = { ...previous };
        results.forEach((result, index) => {
          const exchangeId = exchangeIds[index];
          if (result.status === 'fulfilled') next[exchangeId] = result.value;
          else nextErrors[exchangeId] = result.reason instanceof Error ? result.reason.message : `${exchangeNames[exchangeId]} unavailable`;
        });
        return next;
      });
      setErrors(nextErrors);
      setLoading(false);
    }
    setLoading(true);
    void refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => { stopped = true; controller?.abort(); window.clearInterval(timer); };
  }, [interval]);

  const feed = feeds[selected] ?? null;
  const ticker = feed?.ticker ?? null;
  const bidBelowAsk = ticker?.bestAsk && ticker.bestBid > 0
    ? ((ticker.bestAsk - ticker.bestBid) / ticker.bestAsk) * 100
    : null;
  const lowLiquidity = bidBelowAsk !== null && bidBelowAsk >= 10;
  const liveCount = exchangeIds.filter((exchangeId) => feeds[exchangeId]).length;

  return (
    <div className="page-stack exchanges-page">
      <div className={`exchange-status ${liveCount === 0 ? 'error' : 'live'}`}>
        <span className="exchange-status-dot" />
        <div><b>{liveCount ? `${liveCount} live exchange ${liveCount === 1 ? 'market' : 'markets'} connected` : 'Exchange feeds retrying'}</b><span>{liveCount ? 'NeoxEX and NoirTrade public market data refresh every 10 seconds.' : Object.values(errors)[0] || 'Unable to load exchange data.'}</span></div>
        <span className="exchange-refresh"><RefreshCw size={13} className={loading ? 'spinning' : ''} /> 10 sec refresh</span>
      </div>

      <div className="exchange-selector" aria-label="Select chart exchange">
        {exchangeIds.map((exchangeId) => {
          const item = feeds[exchangeId];
          return <button key={exchangeId} className={selected === exchangeId ? 'active' : ''} onClick={() => setSelected(exchangeId)}><span>{exchangeNames[exchangeId]} <i className={item ? 'online' : ''} /></span><b>{usd(item?.ticker?.lastPrice)}</b><small>{errors[exchangeId] || 'ZKAS / USDT'}</small></button>;
        })}
      </div>

      {lowLiquidity && <div className="exchange-warning"><TriangleAlert size={19} /><div><b>Low-liquidity market</b><span>The last trade can differ substantially from the price available to buyers or sellers. Check the live bid and ask before using the last price as a market value.</span></div></div>}

      <section className="exchange-price-dock" aria-live="polite">
        <div><span>{feed?.exchange.name || exchangeNames[selected]} · ZKAS / USDT</span><small>Live exchange market</small></div>
        <div><small>LAST TRADE</small><strong>{usd(ticker?.lastPrice)}</strong><em className={(ticker?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'}>{ticker ? `${ticker.changePercent >= 0 ? '+' : ''}${ticker.changePercent.toFixed(2)}% 24h` : '—'}</em></div>
      </section>

      <section className="exchange-metrics">
        <MarketMetric label="Last trade" value={usd(ticker?.lastPrice)} detail="Most recently matched price" />
        <MarketMetric label="Best bid" value={usd(ticker?.bestBid)} detail="Highest live buying offer" tone="bid" />
        <MarketMetric label="Best ask" value={usd(ticker?.bestAsk)} detail="Lowest live selling offer" tone="ask" />
        <MarketMetric label="Actual 24h volume" value={ticker ? `${usd(ticker.quoteVolume24h, 2)} USDT` : '—'} detail={`${amount(ticker?.volume24h)} ZKAS traded`} />
        <MarketMetric label="24h trades" value={amount(ticker?.trades24h)} detail={bidBelowAsk === null ? 'Spread unavailable' : `Bid ${bidBelowAsk.toFixed(2)}% below ask`} />
      </section>

      <div className="exchange-market-grid">
        <OrderBook feed={feed} />

        <section className="panel exchange-chart-panel">
        <div className="exchange-chart-head">
          <div><span className="panel-icon"><BarChart3 size={20} /></span><div><h2>Real-time ZKAS price chart</h2><p>{feed ? `${feed.exchange.name} · ${feed.chartSource}` : 'Loading live market history…'}</p></div></div>
          <div className="exchange-intervals" aria-label="Chart timeframe">{intervals.map((value) => <button key={value} className={interval === value ? 'active' : ''} onClick={() => setInterval(value)}>{value}</button>)}</div>
        </div>
        <div className="exchange-chart-summary"><span>24h low <b>{usd(ticker?.low24h)}</b></span><span>24h high <b>{usd(ticker?.high24h)}</b></span><span>USDT volume <b>{ticker ? usd(ticker.quoteVolume24h, 2) : '—'}</b></span></div>
        <PriceChart candles={feed?.candles ?? []} lastPrice={ticker?.lastPrice ?? null} />
        <div className="exchange-chart-legend"><span><i className="up" /> Price up</span><span><i className="down" /> Price down</span><span><i className="volume" /> ZKAS volume</span></div>
        </section>
      </div>

      <section className="panel exchange-list-panel">
        <div className="panel-head"><div><span className="panel-icon"><Activity size={20} /></span><h2>ZKAS exchange markets</h2></div><span className="range-chip">{liveCount} LIVE · {listedMarkets.length} LISTED</span></div>
        <div className="exchange-table-scroll"><table><thead><tr><th>Exchange</th><th>Pair</th><th>Last price</th><th>Best bid</th><th>Best ask</th><th>24h USDT volume</th><th>Status</th><th /></tr></thead><tbody>{exchangeIds.map((exchangeId) => {
          const item = feeds[exchangeId];
          return <tr key={exchangeId}><td><b>{exchangeNames[exchangeId]}</b></td><td>ZKAS/USDT</td><td>{usd(item?.ticker?.lastPrice)}</td><td className="bid-text">{usd(item?.ticker?.bestBid)}</td><td className="ask-text">{usd(item?.ticker?.bestAsk)}</td><td>{item?.ticker ? usd(item.ticker.quoteVolume24h, 2) : '—'}</td><td>{item ? <span className="exchange-live-chip"><i /> Live</span> : <span className="exchange-retry-chip">Retrying</span>}</td><td><a href={item?.exchange.tradeUrl || (exchangeId === 'noirtrade' ? 'https://noirtrade.com/trade?pair=ZKAS_USDT' : 'https://neoxa.exchange')} target="_blank" rel="noreferrer">Trade <ExternalLink size={13} /></a></td></tr>;
        })}{listedMarkets.map((market) => <tr key={market.id} className="exchange-listed-row"><td><b>{market.name}</b></td><td>{market.pair}</td><td>—</td><td className="bid-text">—</td><td className="ask-text">—</td><td>—</td><td><span className="exchange-listed-chip">Market listed · activity pending</span></td><td><a href={market.tradeUrl} target="_blank" rel="noreferrer">View market <ExternalLink size={13} /></a></td></tr>)}</tbody></table></div>
        <p className="source-note"><TriangleAlert size={15} /> Live prices are reported separately from completed OTC trades. NonKYC is shown as listed and is not included in live totals until public trading data is available.</p>
      </section>
    </div>
  );
}
