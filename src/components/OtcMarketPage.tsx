import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, CalendarDays, CircleDollarSign, Clock3, Coins, RefreshCw, TrendingUp, Trophy } from 'lucide-react';
import { fetchKasUsd, fetchOtcTrades, type OtcTrade, type OtcTradeFeed } from '../otc';

type Range = '1D' | '7D' | '14D' | '30D' | 'ALL';
type TradeTableRange = '1D' | '3D' | '7D' | 'ALL';

const rangeMs: Record<Exclude<Range, 'ALL'>, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
  '14D': 14 * 24 * 60 * 60 * 1000,
  '30D': 30 * 24 * 60 * 60 * 1000,
};

const tradeTableRangeMs: Record<Exclude<TradeTableRange, 'ALL'>, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '3D': 3 * 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
};

const amountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });

function priceText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const digits = value < 0.001 ? 8 : value < 1 ? 6 : 4;
  return `${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })} KAS`;
}

function usdPriceText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  const digits = value < 0.01 ? 6 : value < 1 ? 4 : 2;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

function usdValueText(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function marketCapText(value: number | null, unit: 'USD' | 'KAS') {
  if (value === null || !Number.isFinite(value)) return '—';
  const formatted = compactFormat.format(value);
  return unit === 'USD' ? `≈ $${formatted}` : `${formatted} KAS`;
}

function dateText(timestamp: number | null) {
  if (timestamp === null) return 'Time unavailable';
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
  if (range === '14D') return 'Past 14 days';
  if (range === '30D') return 'Past 30 days';
  return 'All recorded trades';
}

function tradeTableRangeLabel(range: TradeTableRange) {
  if (range === '1D') return 'Past 24 hours';
  if (range === '3D') return 'Past 3 days';
  if (range === '7D') return 'Past 7 days';
  return 'All recorded trades';
}

function changePercent(first: number | null, last: number | null) {
  if (first === null || last === null || first === 0) return null;
  return ((last - first) / Math.abs(first)) * 100;
}

function statusCopy(feed: OtcTradeFeed | null, error: string | null, loading: boolean) {
  if (loading && !feed) return { tone: 'waiting', title: 'Preparing the OTC trade feed', detail: 'Checking for the secure server connection…' };
  if (feed?.source === 'screenshot-import' && feed.status === 'live') return { tone: 'live', title: 'Reviewed screenshot trades loaded', detail: 'This is snapshot data. The chart updates when new reviewed trade-log screenshots are published.' };
  if (feed?.status === 'live') return { tone: 'live', title: 'OTC trade log connected', detail: 'The chart refreshes automatically as completed trades become available.' };
  if (feed?.status === 'awaiting_configuration' && feed.source === 'screenshot-import') return { tone: 'waiting', title: 'Screenshot importer ready', detail: 'Reviewed completed trades will appear here as soon as the first screenshot is published.' };
  if (feed?.status === 'awaiting_configuration') return { tone: 'waiting', title: 'Ready for Ronnie’s API', detail: 'The private connection is prepared. The endpoint and access key still need to be added on the server.' };
  return { tone: 'error', title: 'OTC feed temporarily unavailable', detail: error || feed?.message || 'The last successful trade data will remain visible while the connection retries.' };
}

export function OtcMarketPage({ circulatingSupply }: { circulatingSupply: number | null }) {
  const [feed, setFeed] = useState<OtcTradeFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('7D');
  const [tradeTableRange, setTradeTableRange] = useState<TradeTableRange>('1D');
  const [kasUsd, setKasUsd] = useState<number | null>(null);

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

  useEffect(() => {
    let stopped = false;
    let activeController: AbortController | null = null;

    async function refreshKasPrice() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const quote = await fetchKasUsd(controller.signal);
        if (!stopped) setKasUsd(quote.priceUsd);
      } catch {
        // The ZKAS/KAS market remains usable if the optional USD estimate is unavailable.
      }
    }

    void refreshKasPrice();
    const timer = window.setInterval(refreshKasPrice, 60_000);
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearInterval(timer);
    };
  }, []);

  const allTrades = useMemo(() => {
    return (feed?.trades ?? [])
      .map((trade, sourceIndex) => ({ trade, sourceIndex }))
      .sort((a, b) => {
        if (a.trade.timestamp === null && b.trade.timestamp === null) return b.sourceIndex - a.sourceIndex;
        if (a.trade.timestamp === null) return 1;
        if (b.trade.timestamp === null) return -1;
        return a.trade.timestamp - b.trade.timestamp || b.sourceIndex - a.sourceIndex;
      })
      .map(({ trade }) => trade);
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
  const allPricedTrades = allTrades.filter((trade) => trade.priceKas !== null);
  const firstPrice = pricedTrades.length ? pricedTrades[0].priceKas : null;
  const lastPrice = pricedTrades.length ? pricedTrades[pricedTrades.length - 1].priceKas : null;
  const latestMarketPrice = allPricedTrades.length ? allPricedTrades[allPricedTrades.length - 1].priceKas : null;
  const change = changePercent(firstPrice, lastPrice);
  const zkasUsd = lastPrice !== null && kasUsd !== null ? lastPrice * kasUsd : null;
  const marketCapKas = latestMarketPrice !== null && circulatingSupply !== null ? latestMarketPrice * circulatingSupply : null;
  const marketCapUsd = marketCapKas !== null && kasUsd !== null ? marketCapKas * kasUsd : null;
  const zkasVolume = filteredTrades.reduce((sum, trade) => sum + (trade.zkasAmount ?? 0), 0);
  const kasVolume = filteredTrades.reduce((sum, trade) => sum + (trade.totalKas ?? 0), 0);
  const topBuys = useMemo(() => {
    return allTrades
      .filter((trade) => trade.side === 'buy' && trade.totalKas !== null && trade.totalKas > 0)
      .sort((a, b) => (b.totalKas as number) - (a.totalKas as number) || (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .slice(0, 10);
  }, [allTrades]);
  const tableTrades = useMemo(() => {
    if (tradeTableRange === 'ALL') return allTrades;
    const timed = allTrades.filter((trade) => trade.timestamp !== null);
    if (!timed.length) return allTrades;
    const newest = Math.max(...timed.map((trade) => trade.timestamp as number));
    const cutoff = newest - tradeTableRangeMs[tradeTableRange];
    return allTrades.filter((trade) => trade.timestamp === null || trade.timestamp >= cutoff);
  }, [allTrades, tradeTableRange]);
  const visibleTableTrades = useMemo(() => [...tableTrades].reverse().slice(0, 20), [tableTrades]);
  const state = statusCopy(feed, error, loading);
  const refreshLabel = feed?.source === 'screenshot-import' ? '30 sec data check' : '30 sec refresh';

  return (
    <div className="page-stack otc-page">
      <div className={`otc-status ${state.tone}`}>
        <span className="otc-status-dot" />
        <div><b>{state.title}</b><span>{state.detail}</span></div>
        <span className="otc-refresh"><RefreshCw size={13} className={loading ? 'spinning' : ''} /> {refreshLabel}</span>
      </div>

      <section className="otc-summary-grid">
        <OtcSummary icon={<TrendingUp size={18} />} label="Latest ZKAS price" value={priceText(lastPrice)} detail={usdPriceText(zkasUsd) ? `≈ ${usdPriceText(zkasUsd)} USD per ZKAS` : 'ZKAS/KAS · KAS per ZKAS'} />
        <OtcSummary icon={<Activity size={18} />} label={`${range} price change`} value={change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`} detail={rangeLabel(range)} tone={change === null ? undefined : change >= 0 ? 'positive' : 'negative'} />
        <OtcSummary icon={<CircleDollarSign size={18} />} label="Estimated market cap" value={marketCapText(marketCapUsd, 'USD')} detail={marketCapKas === null ? 'Waiting for live price and supply' : `${marketCapText(marketCapKas, 'KAS')} · ${compactFormat.format(circulatingSupply as number)} circulating`} />
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
            {(['1D', '7D', '14D', '30D', 'ALL'] as Range[]).map((item) => (
              <button key={item} className={range === item ? 'on' : ''} onClick={() => setRange(item)}>{item}</button>
            ))}
          </div>
        </div>
        <OtcPriceChart trades={pricedTrades} />
        <div className="otc-legend"><span><i className="buy" /> Buy</span><span><i className="sell" /> Sell</span><span><i className="unknown" /> Unclassified trade</span></div>
      </section>

      <section className="panel table-panel otc-top-buys-panel">
        <div className="panel-head otc-ranking-head">
          <div><span className="panel-icon"><Trophy size={20} /></span><div><h2>Top 10 largest completed buys</h2><p>Ranked by the total KAS paid across all recorded trades.</p></div></div>
          <span className="range-chip">ALL TIME</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Rank</th><th>Date & time</th><th>ZKAS bought</th><th>Price (KAS per ZKAS)</th><th>Total paid</th><th>Est. USD value</th></tr></thead>
            <tbody>
              {topBuys.map((trade, index) => (
                <tr key={`top-buy-${trade.timestamp ?? 'undated'}-${index}`}>
                  <td><span className={`otc-rank otc-rank-${index + 1}`}>#{index + 1}</span></td>
                  <td>{dateText(trade.timestamp)}</td>
                  <td>{trade.zkasAmount === null ? '—' : amountFormat.format(trade.zkasAmount)}</td>
                  <td>{priceText(trade.priceKas)}</td>
                  <td><b>{amountFormat.format(trade.totalKas as number)} KAS</b></td>
                  <td>{usdValueText(kasUsd === null ? null : (trade.totalKas as number) * kasUsd)}</td>
                </tr>
              ))}
              {!topBuys.length && <tr><td colSpan={6} className="empty-cell">Completed buy trades will appear here as they are published.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel otc-trades-panel">
        <div className="panel-head otc-trades-head">
          <div><span className="panel-icon"><CalendarDays size={20} /></span><div><h2>Completed trades</h2><p>Showing the newest 20 trades. All recorded trades remain stored.</p></div></div>
          <div className="history-range-tabs" aria-label="Completed trades time range">
            {(['1D', '3D', '7D', 'ALL'] as TradeTableRange[]).map((item) => (
              <button key={item} className={tradeTableRange === item ? 'active' : ''} onClick={() => setTradeTableRange(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div className="otc-table-summary">
          <span>{tradeTableRangeLabel(tradeTableRange)}</span>
          <span>{amountFormat.format(visibleTableTrades.length)} of {amountFormat.format(tableTrades.length)} matching trades shown</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date & time</th><th>Side</th><th>ZKAS amount</th><th>Price (KAS per ZKAS)</th><th>Est. USD per ZKAS</th><th>Total</th></tr></thead>
            <tbody>
              {visibleTableTrades.map((trade, index) => (
                <tr key={`${trade.timestamp ?? 'undated'}-${index}`}>
                  <td>{dateText(trade.timestamp)}</td>
                  <td><span className={`otc-side ${trade.side}`}>{trade.side === 'unknown' ? 'Trade' : trade.side}</span></td>
                  <td>{trade.zkasAmount === null ? '—' : amountFormat.format(trade.zkasAmount)}</td>
                  <td>{priceText(trade.priceKas)}</td>
                  <td>{usdPriceText(trade.priceKas !== null && kasUsd !== null ? trade.priceKas * kasUsd : null) ?? '—'}</td>
                  <td>{trade.totalKas === null ? '—' : `${amountFormat.format(trade.totalKas)} KAS`}</td>
                </tr>
              ))}
              {!tableTrades.length && <tr><td colSpan={6} className="empty-cell">No completed trades were recorded in this time range.</td></tr>}
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
  const dayGroups = coordinates.reduce<Array<{ key: string; start: number; end: number }>>((groups, point, index) => {
    if (point.trade.timestamp === null) return groups;
    const date = new Date(point.trade.timestamp);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const current = groups.at(-1);
    if (current?.key === key) {
      current.end = index;
    } else {
      groups.push({ key, start: index, end: index });
    }
    return groups;
  }, []);
  const dayBands = dayGroups.map((group, index) => {
    const first = coordinates[group.start];
    const last = coordinates[group.end];
    const previous = coordinates[group.start - 1];
    const next = coordinates[group.end + 1];
    const startX = previous ? (previous.x + first.x) / 2 : left;
    const endX = next ? (last.x + next.x) / 2 : plotRight;
    return { ...group, index, startX, endX };
  });

  return (
    <div className="otc-chart-wrap" ref={scrollRef}>
      <svg className="otc-chart" style={{ width: `${width}px`, minWidth: `${width}px` }} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="ZKAS KAS trading pair chart, quoted in KAS per ZKAS">
        <defs>
          <linearGradient id="otc-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".22" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient>
        </defs>
        {dayBands.map((day) => day.index % 2 === 1 && (
          <rect key={`day-band-${day.key}`} className="otc-day-band" x={day.startX} y={top} width={Math.max(0, day.endX - day.startX)} height={height - top - bottom} />
        ))}
        {dayBands.slice(1).map((day) => (
          <line key={`day-separator-${day.key}`} className="otc-day-separator" x1={day.startX} x2={day.startX} y1={top} y2={height - bottom} />
        ))}
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
