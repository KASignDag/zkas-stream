import { useEffect, useMemo, useState } from 'react';
import { Activity, BarChart3, ExternalLink, RefreshCw, TriangleAlert } from 'lucide-react';

type Interval = '5m' | '15m' | '1h' | '4h' | '1d';
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type Level = { price: number; quantity: number; orders: number };
type Trade = { trade_id: string; side: 'buy' | 'sell'; quantity: number; price: number; total: number; executed_at: string };
type MarketFeed = {
  exchange: { id: string; name: string; website: string; tradeUrl: string };
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
  updatedAt: number;
};

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
    return { rows, width, height, left, right, top, priceBottom, volumeTop, volumeBottom, min, max, x, y, volumeY, candleWidth };
  }, [candles]);

  if (!chart) return <div className="exchange-chart-empty">Waiting for the first exchange candles…</div>;
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

export function ExchangesPage() {
  const [feed, setFeed] = useState<MarketFeed | null>(null);
  const [interval, setInterval] = useState<Interval>('15m');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    async function refresh() {
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(`/api/exchange-market?exchange=neoxex&pair=ZKAS_USDT&interval=${interval}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Live exchange feed is temporarily unavailable.');
        const next = await response.json() as MarketFeed;
        if (!stopped) { setFeed(next); setError(null); }
      } catch (reason) {
        if (!stopped && !controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load exchange data.');
      } finally {
        if (!stopped) setLoading(false);
      }
    }
    setLoading(true);
    void refresh();
    const timer = window.setInterval(refresh, 10_000);
    return () => { stopped = true; controller?.abort(); window.clearInterval(timer); };
  }, [interval]);

  const ticker = feed?.ticker ?? null;
  const bidBelowAsk = ticker?.bestAsk && ticker.bestBid !== null
    ? ((ticker.bestAsk - ticker.bestBid) / ticker.bestAsk) * 100
    : null;
  const lowLiquidity = bidBelowAsk !== null && bidBelowAsk >= 10;

  return (
    <div className="page-stack exchanges-page">
      <div className={`exchange-status ${error ? 'error' : 'live'}`}>
        <span className="exchange-status-dot" />
        <div><b>{error ? 'Exchange feed retrying' : 'NeoxEX market connected'}</b><span>{error || 'Live public market data refreshes every 10 seconds.'}</span></div>
        <span className="exchange-refresh"><RefreshCw size={13} className={loading ? 'spinning' : ''} /> 10 sec refresh</span>
      </div>

      {lowLiquidity && <div className="exchange-warning"><TriangleAlert size={19} /><div><b>Low-liquidity market</b><span>The last trade can differ substantially from the price available to buyers or sellers. Check the live bid and ask before using the last price as a market value.</span></div></div>}

      <section className="exchange-price-dock" aria-live="polite">
        <div><span>NeoxEX · ZKAS / USDT</span><small>Live exchange market</small></div>
        <div><small>LAST TRADE</small><strong>{usd(ticker?.lastPrice)}</strong><em className={(ticker?.changePercent ?? 0) >= 0 ? 'positive' : 'negative'}>{ticker ? `${ticker.changePercent >= 0 ? '+' : ''}${ticker.changePercent.toFixed(2)}% 24h` : '—'}</em></div>
      </section>

      <section className="exchange-metrics">
        <MarketMetric label="Last trade" value={usd(ticker?.lastPrice)} detail="Most recently matched price" />
        <MarketMetric label="Best bid" value={usd(ticker?.bestBid)} detail="Highest live buying offer" tone="bid" />
        <MarketMetric label="Best ask" value={usd(ticker?.bestAsk)} detail="Lowest live selling offer" tone="ask" />
        <MarketMetric label="Actual 24h volume" value={ticker ? `${usd(ticker.quoteVolume24h, 2)} USDT` : '—'} detail={`${amount(ticker?.volume24h)} ZKAS traded`} />
        <MarketMetric label="24h trades" value={amount(ticker?.trades24h)} detail={bidBelowAsk === null ? 'Spread unavailable' : `Bid ${bidBelowAsk.toFixed(2)}% below ask`} />
      </section>

      <section className="panel exchange-chart-panel">
        <div className="exchange-chart-head">
          <div><span className="panel-icon"><BarChart3 size={20} /></span><div><h2>Real-time ZKAS price chart</h2><p>Live OHLCV candles from NeoxEX</p></div></div>
          <div className="exchange-intervals" aria-label="Chart timeframe">{intervals.map((value) => <button key={value} className={interval === value ? 'active' : ''} onClick={() => setInterval(value)}>{value}</button>)}</div>
        </div>
        <div className="exchange-chart-summary"><span>24h low <b>{usd(ticker?.low24h)}</b></span><span>24h high <b>{usd(ticker?.high24h)}</b></span><span>USDT volume <b>{ticker ? usd(ticker.quoteVolume24h, 2) : '—'}</b></span></div>
        <PriceChart candles={feed?.candles ?? []} lastPrice={ticker?.lastPrice ?? null} />
        <div className="exchange-chart-legend"><span><i className="up" /> Price up</span><span><i className="down" /> Price down</span><span><i className="volume" /> ZKAS volume</span></div>
      </section>

      <section className="panel exchange-list-panel">
        <div className="panel-head"><div><span className="panel-icon"><Activity size={20} /></span><h2>Reporting exchanges</h2></div><span className="range-chip">1 LIVE</span></div>
        <div className="exchange-table-scroll"><table><thead><tr><th>Exchange</th><th>Pair</th><th>Last price</th><th>Best bid</th><th>Best ask</th><th>24h USDT volume</th><th>Status</th><th /></tr></thead><tbody><tr><td><b>NeoxEX</b></td><td>ZKAS/USDT</td><td>{usd(ticker?.lastPrice)}</td><td className="bid-text">{usd(ticker?.bestBid)}</td><td className="ask-text">{usd(ticker?.bestAsk)}</td><td>{ticker ? usd(ticker.quoteVolume24h, 2) : '—'}</td><td><span className="exchange-live-chip"><i /> Live</span></td><td><a href={feed?.exchange.tradeUrl || 'https://neoxa.exchange'} target="_blank" rel="noreferrer">Trade <ExternalLink size={13} /></a></td></tr></tbody></table></div>
        <p className="source-note"><TriangleAlert size={15} /> Exchange prices are reported separately from completed OTC trades. Additional exchanges can be added here as soon as ZKAS markets and public data feeds become available.</p>
      </section>
    </div>
  );
}
