import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, CalendarDays, Clock3, Coins, RefreshCw, TrendingUp } from 'lucide-react';
import { fetchOtcTrades, type OtcTrade, type OtcTradeFeed } from '../otc';

type Range = '1D' | '7D' | '30D' | 'ALL';

const rangeMs: Record<Exclude<Range, 'ALL'>, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000,
};

const amountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

function priceText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const digits = value < 0.001 ? 8 : value < 1 ? 6 : 4;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} KAS`;
}

function dateText(timestamp: number | null, approximate = false) {
  if (timestamp === null) return 'Time unavailable';
  if (approximate) return `${new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })} · approx.`;
  return new Date(timestamp).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function rangeLabel(range: Range) {
  if (range === '1D') return 'Past 24 hours';
  if (range === '7D') return 'Past 7 days';
  if (range === '30D') return 'Past 30 days';
  return 'All recorded trades';
}

function changePercent(first: number | null, last: number | null) {
  if (first === null || last === null || first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function statusCopy(feed: OtcTradeFeed | null, error: string | null, loading: boolean) {
  if (loading && !feed) return { tone: 'waiting', title: 'Preparing the OTC trade feed', detail: 'Checking for the secure server connection…' };
  if (feed?.status === 'live') return { tone: 'live', title: 'OTC trade log connected', detail: 'The chart refreshes automatically as completed trades become available.' };
  if (feed?.status === 'awaiting_configuration' && feed.source === 'screenshot-import') return { tone: 'waiting', title: 'Screenshot importer ready', detail: 'Reviewed completed trades will appear here as soon as the first screenshot is published.' };
  if (feed?.status === 'awaiting_configuration') return { tone: 'waiting', title: 'Ready for Ronnie’s API', detail: 'The private connection is prepared. The endpoint and access key still need to be added on the server.' };
  return { tone: 'error', title: 'OTC feed temporarily unavailable', detail: error || feed?.message || 'The last successful trade data will remain visible while the connection retries.' };
}

export function OtcMarketPage() {
  const [feed, setFeed] = useState<OtcTradeFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('30D');

  useEffect(() => {
    let stopped = false;
    let activeController: AbortController | null = null;

    async function refresh() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const next = await fetchOtcTrades(controller.signal);
        if (stopped) return;
        setFeed((previous) => next.status === 'live' || !previous ? next : { ...next, trades: previous.trades });
        setError(null);
      } catch (reason) {
        if (controller.signal.aborted || stopped) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load OTC trades.');
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearInterval(timer);
    };
  }, []);

  const allTrades = useMemo(() => {
    return [...(feed?.trades ?? [])].sort((a, b) => {
      if (a.timestamp === null && b.timestamp === null) return 0;
      if (a.timestamp === null) return 1;
      if (b.timestamp === null) return -1;
      return a.timestamp - b.timestamp;
    });
  }, [feed?.trades]);

  const filteredTrades = useMemo(() => {
    if (range === 'ALL') return allTrades;
    const timed = allTrades.filter((trade) => trade.timestamp !== null);
    if (!timed.length) return allTrades;
    const newest = Math.max(...timed.map((trade) => trade.timestamp as number));
    const cutoff = newest - rangeMs[range];
    return allTrades.filter((trade) => trade.timestamp === null || trade.timestamp >= cutoff);
  }, [allTrades, range]);

  const pricedTrades = filteredTrades.filter((trade) => trade.priceKas !== null);
  const firstPrice = pricedTrades.length ? pricedTrades[0].priceKas : null;
  const lastPrice = pricedTrades.length ? pricedTrades[pricedTrades.length - 1].priceKas : null;
  const change = changePercent(firstPrice, lastPrice);
  const zkasVolume = filteredTrades.reduce((sum, trade) => sum + (trade.zkasAmount ?? 0), 0);
  const kasVolume = filteredTrades.reduce((sum, trade) => sum + (trade.totalKas ?? 0), 0);
  const state = statusCopy(feed, error, loading);

  return (
    <div className="page-stack otc-page">
      <div className={`otc-status ${state.tone}`}>
        <span className="otc-status-dot" />
        <div><b>{state.title}</b><span>{state.detail}</span></div>
        <span className="otc-refresh"><RefreshCw size={13} className={loading ? 'spinning' : ''} /> 30 sec refresh</span>
      </div>

      <section className="otc-summary-grid">
        <OtcSummary icon={<TrendingUp size={18} />} label="Latest ZKAS price" value={priceText(lastPrice)} detail="ZKAS/KAS · KAS per ZKAS" />
        <OtcSummary icon={<Activity size={18} />} label={`${range} price change`} value={change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`} detail={rangeLabel(range)} tone={change === null ? undefined : change >= 0 ? 'positive' : 'negative'} />
        <OtcSummary icon={<Coins size={18} />} label="ZKAS volume" value={zkasVolume ? compactFormat.format(zkasVolume) : '—'} detail={`${amountFormat.format(kasVolume)} KAS exchanged`} />
        <OtcSummary icon={<Clock3 size={18} />} label="Completed trades" value={filteredTrades.length ? amountFormat.format(filteredTrades.length) : '—'} detail={rangeLabel(range)} />
      </section>

      <section className="panel otc-chart-panel">
        <div className="otc-chart-head">
          <div>
            <div className="eyebrow"><Activity size={14} /> ZKAS/KAS OTC MARKET</div>
            <h2>ZKAS completed trade price</h2>
            <p>Each point shows the price of one ZKAS, quoted in KAS.</p>
          </div>
          <div className="segmented" aria-label="OTC chart time range">
            {(['1D', '7D', '30D', 'ALL'] as Range[]).map((item) => (
              <button key={item} className={range === item ? 'on' : ''} onClick={() => setRange(item)}>{item}</button>
            ))}
          </div>
        </div>
        <OtcPriceChart trades={pricedTrades} />
        <div className="otc-legend"><span><i className="buy" /> Buy</span><span><i className="sell" /> Sell</span><span><i className="unknown" /> Unclassified trade</span></div>
      </section>

      <section className="panel table-panel otc-trades-panel">
        <div className="panel-head">
          <div><span className="panel-icon"><CalendarDays size={20} /></span><h2>Completed trades</h2></div>
          <span className="range-chip">{rangeLabel(range).toUpperCase()}</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date & time</th><th>Side</th><th>ZKAS amount</th><th>Price (KAS per ZKAS)</th><th>Total</th></tr></thead>
            <tbody>
              {[...filteredTrades].reverse().map((trade, index) => (
                <tr key={`${trade.timestamp ?? 'undated'}-${index}`}>
                  <td>{dateText(trade.timestamp, feed?.source === 'screenshot-import')}</td>
                  <td><span className={`otc-side ${trade.side}`}>{trade.side === 'unknown' ? 'Trade' : trade.side}</span></td>
                  <td>{trade.zkasAmount === null ? '—' : amountFormat.format(trade.zkasAmount)}</td>
                  <td>{priceText(trade.priceKas)}</td>
                  <td>{trade.totalKas === null ? '—' : `${amountFormat.format(trade.totalKas)} KAS`}</td>
                </tr>
              ))}
              {!filteredTrades.length && <tr><td colSpan={5} className="empty-cell">The chart is ready. Completed trades will appear here after Ronnie’s private API is connected.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function OtcSummary({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className="metric-card otc-summary">
      <div className="metric-label"><span className="metric-icon">{icon}</span>{label}</div>
      <div className={`metric-value ${tone || ''}`}>{value}</div>
      <div className="metric-sub">{detail}</div>
    </div>
  );
}

function OtcPriceChart({ trades }: { trades: OtcTrade[] }) {
  const points = trades
    .map((trade) => ({ trade, value: trade.priceKas }))
    .filter((point): point is { trade: OtcTrade; value: number } => point.value !== null && Number.isFinite(point.value));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollLeft = container.scrollWidth - container.clientWidth;
  }, [points.length]);

  if (!points.length) {
    return <div className="otc-chart-empty"><TrendingUp size={30} /><b>Waiting for completed trades</b><span>The secure chart connection is built and ready for Ronnie’s API details.</span></div>;
  }

  const left = 76;
  const right = 112;
  const top = 24;
  const bottom = 52;
  const pointGap = 9;
  const width = Math.max(920, left + right + Math.max(1, points.length - 1) * pointGap);
  const height = 360;
  const values = points.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.08, 0.000001);
  const min = Math.max(0, rawMin - spread * 0.14);
  const max = rawMax + spread * 0.14;
  const xFor = (_point: typeof points[number], index: number) => left + index * pointGap;
  const yFor = (value: number) => top + ((max - value) / Math.max(max - min, Number.EPSILON)) * (height - top - bottom);
  const coordinates = points.map((point, index) => ({ ...point, x: xFor(point, index), y: yFor(point.value) }));
  const path = coordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = `${path} L ${coordinates.at(-1)?.x ?? left} ${height - bottom} L ${coordinates[0]?.x ?? left} ${height - bottom} Z`;
  const latest = coordinates.at(-1)!;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return { y: top + ratio * (height - top - bottom), value: max - ratio * (max - min) };
  });
  const xLabels = [coordinates[0], coordinates[Math.floor((coordinates.length - 1) / 2)], coordinates.at(-1)!];
  const plotRight = width - right;

  return (
    <div className="otc-chart-wrap" ref={scrollRef}>
      <svg className="otc-chart" style={{ width: `${width}px`, minWidth: `${width}px` }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="ZKAS KAS trading pair chart, quoted in KAS per ZKAS">
        <defs>
          <linearGradient id="otc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient>
        </defs>
        {grid.map((line) => <g key={line.y}><line className="otc-grid" x1={left} x2={plotRight} y1={line.y} y2={line.y} /><text className="otc-axis-label" x={plotRight + 10} y={line.y + 4} textAnchor="start">{priceText(line.value)}</text></g>)}
        <path className="otc-area" d={areaPath} />
        <path className="otc-line" d={path} />
        <line className="otc-current-line" x1={left} x2={width - 18} y1={latest.y} y2={latest.y} />
        <rect className="otc-current-tag" x={plotRight + 6} y={latest.y - 16} width={right - 8} height={32} rx="8" />
        <text className="otc-current-text" x={plotRight + 14} y={latest.y + 5}>{priceText(latest.value)}</text>
        {coordinates.map((point, index) => <circle key={`${point.trade.timestamp ?? 'undated'}-${index}`} className={`otc-point ${point.trade.side}`} cx={point.x} cy={point.y} r="4.5"><title>{`${dateText(point.trade.timestamp)} · ${priceText(point.value)}`}</title></circle>)}
        {xLabels.map((point, index) => <text key={`${point.trade.timestamp ?? 'undated'}-${index}`} className="otc-axis-label" x={point.x} y={height - 18} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>{point.trade.timestamp === null ? `Trade ${index + 1}` : new Date(point.trade.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</text>)}
      </svg>
    </div>
  );
}
