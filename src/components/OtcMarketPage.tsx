import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Activity, CalendarDays, CircleDollarSign, Clock3, Coins, ExternalLink, MessageCircle, RefreshCw, Send, ShieldCheck, TrendingUp, Trophy } from 'lucide-react';
import { fetchKasUsd, fetchOtcOpenOrders, fetchOtcTrades, fetchSharedOtcTrades, type OtcMarketSource, type OtcOpenOrder, type OtcOpenOrderFeed, type OtcOrderMarket, type OtcTrade, type OtcTradeFeed } from '../otc';

type Range = '4H' | '6H' | '1D' | '7D' | 'ALL';
type TradeTableRange = '1D' | '3D' | '7D' | 'ALL';

const rangeMs: Record<Exclude<Range, 'ALL'>, number> = {
  '4H': 4 * 60 * 60 * 1000,
  '6H': 6 * 60 * 60 * 1000,
  '1D': 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
};

const tradeTableRangeMs: Record<Exclude<TradeTableRange, 'ALL'>, number> = {
  '1D': 24 * 60 * 60 * 1000,
  '3D': 3 * 24 * 60 * 60 * 1000,
  '7D': 7 * 24 * 60 * 60 * 1000,
};

const amountFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const compactFormat = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 });
const tradesPerPage = 20;

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

function chartAxisText(value: number) {
  return value.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
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
  if (range === '4H') return 'Past 4 hours';
  if (range === '6H') return 'Past 6 hours';
  if (range === '1D') return 'Past 24 hours';
  if (range === '7D') return 'Past 7 days';
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

function statusCopy(feed: OtcTradeFeed | null, error: string | null, loading: boolean, source: OtcMarketSource) {
  const sourceName = source === 'telegram' ? 'Telegram OTC' : 'Discord OTC';
  if (loading && !feed) return { tone: 'waiting', title: `Preparing the ${sourceName} trade feed`, detail: 'Checking for the secure server connection…' };
  if (feed?.source === 'screenshot-import' && feed.status === 'live') return { tone: 'live', title: `${sourceName} screenshot trades loaded`, detail: `The chart updates when new reviewed ${sourceName} trade screenshots are published.` };
  if (feed?.status === 'live') return { tone: 'live', title: 'OTC trade log connected', detail: 'The chart refreshes automatically as completed trades become available.' };
  if (feed?.status === 'awaiting_configuration' && feed.source === 'screenshot-import') return { tone: 'live', title: `${sourceName} screenshot trades loaded`, detail: `The chart updates when new reviewed ${sourceName} trade screenshots are published.` };
  if (feed?.status === 'awaiting_configuration') return { tone: 'waiting', title: 'Ready for Ronnie’s API', detail: 'The private connection is prepared. The endpoint and access key still need to be added on the server.' };
  return { tone: 'error', title: 'OTC feed temporarily unavailable', detail: error || feed?.message || 'The last successful trade data will remain visible while the connection retries.' };
}

function tradeRouteText(trade: OtcTrade) {
  const maker = trade.makerVia === 'telegram' ? 'Telegram' : trade.makerVia === 'discord' ? 'Discord' : null;
  const taker = trade.takerVia === 'telegram' ? 'Telegram' : trade.takerVia === 'discord' ? 'Discord' : null;
  if (maker && taker && maker !== taker) return `${maker} ↔ ${taker}`;
  return maker || taker || 'Shared OTC';
}

export function OtcMarketPage({ circulatingSupply, mode = 'separate' }: { circulatingSupply: number | null; mode?: 'separate' | 'shared-preview' }) {
  const sharedPreview = mode === 'shared-preview';
  const [marketSource, setMarketSource] = useState<OtcMarketSource>('discord');
  const [feed, setFeed] = useState<OtcTradeFeed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>('6H');
  const [tradeTableRange, setTradeTableRange] = useState<TradeTableRange>('1D');
  const [tradeTablePage, setTradeTablePage] = useState(0);
  const [kasUsd, setKasUsd] = useState<number | null>(null);
  const [orderFeed, setOrderFeed] = useState<OtcOpenOrderFeed | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(sharedPreview);

  useEffect(() => {
    let stopped = false;
    let activeController: AbortController | null = null;

    async function refresh() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const next = sharedPreview
          ? await fetchSharedOtcTrades(controller.signal)
          : await fetchOtcTrades(marketSource, controller.signal);
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
  }, [marketSource, sharedPreview]);

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

  useEffect(() => {
    if (!sharedPreview) return;
    let stopped = false;
    let activeController: AbortController | null = null;

    async function refreshOrders() {
      activeController?.abort();
      const controller = new AbortController();
      activeController = controller;
      try {
        const next = await fetchOtcOpenOrders(controller.signal);
        if (stopped) return;
        setOrderFeed((previous) => next.status === 'live' || !previous ? next : { ...next, orders: previous.orders });
        setOrderError(null);
      } catch (reason) {
        if (controller.signal.aborted || stopped) return;
        setOrderError(reason instanceof Error ? reason.message : 'Unable to load open ZKAS orders.');
      } finally {
        if (!stopped) setOrdersLoading(false);
      }
    }

    void refreshOrders();
    const timer = window.setInterval(refreshOrders, 30_000);
    return () => {
      stopped = true;
      activeController?.abort();
      window.clearInterval(timer);
    };
  }, [sharedPreview]);

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
  const newestPricedTimestamp = allPricedTrades.reduce<number | null>((newest, trade) => {
    if (trade.timestamp === null) return newest;
    return newest === null ? trade.timestamp : Math.max(newest, trade.timestamp);
  }, null);
  const marketCapReferenceTrades = newestPricedTimestamp === null
    ? []
    : allPricedTrades.filter((trade) => trade.timestamp !== null
      && trade.timestamp >= newestPricedTimestamp - 24 * 60 * 60 * 1000
      && trade.zkasAmount !== null
      && trade.zkasAmount > 0
      && trade.totalKas !== null);
  const marketCapReferenceZkas = marketCapReferenceTrades.reduce((sum, trade) => sum + (trade.zkasAmount ?? 0), 0);
  const marketCapReferenceKas = marketCapReferenceTrades.reduce((sum, trade) => sum + (trade.totalKas ?? 0), 0);
  const marketCapReferencePrice = marketCapReferenceZkas > 0 ? marketCapReferenceKas / marketCapReferenceZkas : null;
  const latestMarketUsd = latestMarketPrice !== null && kasUsd !== null ? latestMarketPrice * kasUsd : null;
  const change = changePercent(firstPrice, lastPrice);
  const zkasUsd = lastPrice !== null && kasUsd !== null ? lastPrice * kasUsd : null;
  const marketCapKas = marketCapReferencePrice !== null && circulatingSupply !== null ? marketCapReferencePrice * circulatingSupply : null;
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
  const orderedTableTrades = useMemo(() => [...tableTrades].reverse(), [tableTrades]);
  const tradeTablePageCount = Math.max(1, Math.ceil(orderedTableTrades.length / tradesPerPage));
  const activeTradeTablePage = Math.min(tradeTablePage, tradeTablePageCount - 1);
  const visibleTableTrades = useMemo(() => {
    const start = activeTradeTablePage * tradesPerPage;
    return orderedTableTrades.slice(start, start + tradesPerPage);
  }, [activeTradeTablePage, orderedTableTrades]);
  const sourceName = sharedPreview ? 'ZKAS OTC' : marketSource === 'telegram' ? 'Telegram OTC' : 'Discord OTC';
  const sourceShortName = sharedPreview ? 'OTC' : marketSource === 'telegram' ? 'Telegram' : 'Discord';
  const state = sharedPreview
    ? loading && !feed
      ? { tone: 'waiting', title: 'Connecting to the shared OTC API', detail: 'Loading completed trades from the ZKAS order book…' }
      : feed?.status === 'live'
        ? { tone: 'live', title: feed.source === 'screenshot-fallback' ? 'Preserved OTC history loaded' : 'Shared OTC API connected', detail: feed.message || 'Completed trades refresh automatically from the order book used by Discord and Telegram.' }
        : { tone: 'error', title: 'Shared OTC API temporarily unavailable', detail: error || feed?.message || 'The preserved reviewed history will remain available as a fallback.' }
    : statusCopy(feed, error, loading, marketSource);
  const refreshLabel = sharedPreview ? '30 sec API refresh' : feed?.source === 'screenshot-import' ? '30 sec data check' : '30 sec refresh';

  function selectMarketSource(source: OtcMarketSource) {
    if (source === marketSource) return;
    setFeed(null);
    setError(null);
    setLoading(true);
    setTradeTablePage(0);
    setMarketSource(source);
  }

  return (
    <div className="page-stack otc-page">
      {sharedPreview && <div className="otc-preview-banner"><b>PREVIEW — NOT LIVE</b><span>This new API page does not replace the current OTC page.</span></div>}
      <div className={`otc-status ${state.tone}`}>
        <span className="otc-status-dot" />
        <div><b>{state.title}</b><span>{state.detail}</span></div>
        <span className="otc-refresh"><RefreshCw size={13} className={loading ? 'spinning' : ''} /> {refreshLabel}</span>
      </div>

      {!sharedPreview && <section className="otc-market-links" aria-label="Choose an OTC market data source">
        <article className={`otc-market-link discord ${marketSource === 'discord' ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => selectMarketSource('discord')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') selectMarketSource('discord'); }}>
          <span className="otc-market-mark" aria-hidden="true"><MessageCircle size={19} /></span>
          <div className="otc-market-copy">
            <span>DISCORD OTC</span>
            <h2>ZKAS / KAS</h2>
            <p>Community orders and completed-trade history</p>
          </div>
          <span className={`otc-venue-status ${marketSource === 'discord' ? 'live' : ''}`}><i /> {marketSource === 'discord' ? 'VIEWING DATA' : 'VIEW STATS + CHART'}</span>
          <a href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
            Open Discord <ExternalLink size={15} />
          </a>
        </article>

        <article className={`otc-market-link telegram ${marketSource === 'telegram' ? 'selected' : ''}`} role="button" tabIndex={0} onClick={() => selectMarketSource('telegram')} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') selectMarketSource('telegram'); }}>
          <span className="otc-market-mark" aria-hidden="true"><Send size={19} /></span>
          <div className="otc-market-copy">
            <span>TELEGRAM OTC</span>
            <h2>ZKAS / KAS</h2>
            <p>Separate Telegram stats, chart and trade history</p>
          </div>
          <span className={`otc-venue-status ${marketSource === 'telegram' ? 'live' : ''}`}><i /> {marketSource === 'telegram' ? 'VIEWING DATA' : 'VIEW STATS + CHART'}</span>
          <a href="https://t.me/ZKas_OTC_bot" target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()}>
            Open Telegram Bot <ExternalLink size={15} />
          </a>
        </article>
      </section>}

      {sharedPreview && <section className="otc-shared-access" aria-labelledby="shared-otc-access-title">
        <div className="otc-shared-access-copy">
          <div className="eyebrow"><Activity size={14} /> ONE SHARED ZKAS ORDER BOOK</div>
          <h2 id="shared-otc-access-title">Trade through Discord or Telegram</h2>
          <p>Both official bots connect to the same market. The statistics, chart and completed trades below combine that one shared order book.</p>
        </div>
        <div className="otc-shared-access-buttons">
          <a className="discord" href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noopener noreferrer"><MessageCircle size={18} /> Open Discord OTC <ExternalLink size={15} /></a>
          <a className="telegram" href="https://t.me/ZKas_OTC_bot" target="_blank" rel="noopener noreferrer"><Send size={18} /> Open Telegram Bot <ExternalLink size={15} /></a>
        </div>
      </section>}

      <aside className="otc-verification" aria-labelledby="otc-verification-title">
        <span className="otc-verification-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
        <div>
          <h2 id="otc-verification-title">Verify before you trade</h2>
          <p><strong>ZKAS controls both OTC bots.</strong> {sharedPreview ? 'They are two official access points to the same shared order book. ' : ''}Open them only through the official Discord and Telegram buttons above, and confirm the Telegram username is exactly <code>@ZKas_OTC_bot</code> before depositing or placing an order.</p>
          <p>Ignore unsolicited DMs and look-alike groups. Never share your seed phrase or private keys. ZKAS.stream displays market information only and does not custody funds or execute trades.</p>
        </div>
      </aside>

      <section className="otc-data-heading" aria-labelledby="discord-otc-data-title">
        <div>
          <div className="eyebrow"><Activity size={14} /> {sourceName.toUpperCase()} MARKET DATA</div>
          <h2 id="discord-otc-data-title">{sourceShortName} price, statistics and chart</h2>
          <p>{sharedPreview ? 'Everything below is calculated from completed trades in the shared ZKAS order book. Open orders remain available only inside the official bots.' : `Everything below is calculated only from reviewed ${sourceName} completed trades. Discord and Telegram histories are stored separately.`}</p>
        </div>
        <span className={`otc-source-pill ${sharedPreview ? 'shared' : marketSource}`}>{sourceName}</span>
      </section>

      <div className="otc-price-dock" aria-live="polite">
        <div><span>{sourceName.toUpperCase()} · ZKAS / KAS</span><small>Completed-trade market</small></div>
        <div className="otc-price-dock-value"><small>LAST TRADE</small><strong>{priceText(latestMarketPrice)}</strong>{usdPriceText(latestMarketUsd) && <em>≈ {usdPriceText(latestMarketUsd)}</em>}</div>
      </div>

      <section className="otc-summary-grid">
        <OtcSummary icon={<TrendingUp size={18} />} label={`Latest ${sourceShortName} price`} value={priceText(lastPrice)} detail={usdPriceText(zkasUsd) ? `≈ ${usdPriceText(zkasUsd)} USD per ZKAS` : 'ZKAS/KAS · KAS per ZKAS'} />
        <OtcSummary icon={<Activity size={18} />} label={`${range} price change`} value={change === null ? '—' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`} detail={rangeLabel(range)} tone={change === null ? undefined : change >= 0 ? 'positive' : 'negative'} />
        <OtcSummary icon={<CircleDollarSign size={18} />} label="Estimated OTC market cap" value={marketCapText(marketCapUsd, 'USD')} detail={marketCapKas === null ? 'Waiting for trade history and supply' : `24H VWAP · ${compactFormat.format(circulatingSupply as number)} circulating`} />
        <OtcSummary icon={<Coins size={18} />} label={`${sourceShortName} ZKAS volume`} value={zkasVolume ? compactFormat.format(zkasVolume) : '—'} detail={`${amountFormat.format(kasVolume)} KAS exchanged`} />
        <OtcSummary icon={<Clock3 size={18} />} label={`${sourceShortName} completed trades`} value={filteredTrades.length ? amountFormat.format(filteredTrades.length) : '—'} detail={rangeLabel(range)} />
      </section>

      <section className="panel otc-chart-panel">
        <div className="otc-chart-head">
          <div>
            <div className="eyebrow"><Activity size={14} /> {sourceName.toUpperCase()} · ZKAS/KAS</div>
            <h2>ZKAS completed trade price</h2>
            <p>Each point shows the price of one ZKAS, quoted in KAS.</p>
            <div className={`otc-source-badge ${sharedPreview ? 'shared' : marketSource}`}>Source: {sharedPreview ? 'ZKAS shared order-book API · completed trades' : `${sourceName} · reviewed trade screenshots`}</div>
          </div>
          <div className="segmented" aria-label="OTC chart time range">
            {(['4H', '6H', '1D', '7D', 'ALL'] as Range[]).map((item) => (
              <button key={item} className={range === item ? 'on' : ''} onClick={() => setRange(item)}>{item}</button>
            ))}
          </div>
        </div>
        <OtcPriceChart trades={pricedTrades} range={range} change={change} zkasUsd={zkasUsd} sourceName={sourceName} expandedSpacing={sharedPreview} />
        <div className="otc-legend"><span><i className="buy" /> Buy</span><span><i className="sell" /> Sell</span><span><i className="unknown" /> Unclassified trade</span></div>
      </section>

      <section className="panel table-panel otc-top-buys-panel">
        <div className="panel-head otc-ranking-head">
          <div><span className="panel-icon"><Trophy size={20} /></span><div><h2>Top 10 largest completed buys</h2><p>Ranked by the total KAS paid across all recorded trades.</p></div></div>
          <span className="range-chip">ALL TIME</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Rank</th><th>Date & time</th><th>Source</th><th>ZKAS bought</th><th>Price (KAS per ZKAS)</th><th>Total paid</th><th>Est. USD value</th></tr></thead>
            <tbody>
              {topBuys.map((trade, index) => (
                <tr key={`top-buy-${trade.timestamp ?? 'undated'}-${index}`}>
                  <td><span className={`otc-rank otc-rank-${index + 1}`}>#{index + 1}</span></td>
                  <td>{dateText(trade.timestamp)}</td>
                  <td><span className={`otc-source-pill ${sharedPreview ? 'shared' : marketSource}`}>{sharedPreview ? tradeRouteText(trade) : sourceName}</span></td>
                  <td>{trade.zkasAmount === null ? '—' : amountFormat.format(trade.zkasAmount)}</td>
                  <td>{priceText(trade.priceKas)}</td>
                  <td><b>{amountFormat.format(trade.totalKas as number)} KAS</b></td>
                  <td>{usdValueText(kasUsd === null ? null : (trade.totalKas as number) * kasUsd)}</td>
                </tr>
              ))}
              {!topBuys.length && <tr><td colSpan={7} className="empty-cell">Completed buy trades will appear here as they are published.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel table-panel otc-trades-panel">
        <div className="panel-head otc-trades-head">
          <div><span className="panel-icon"><CalendarDays size={20} /></span><div><h2>Completed trades</h2><p>Showing the newest 20 trades. All recorded trades remain stored.</p></div></div>
          <div className="history-range-tabs" aria-label="Completed trades time range">
            {(['1D', '3D', '7D', 'ALL'] as TradeTableRange[]).map((item) => (
              <button key={item} className={tradeTableRange === item ? 'active' : ''} onClick={() => { setTradeTableRange(item); setTradeTablePage(0); }}>{item}</button>
            ))}
          </div>
        </div>
        <div className="otc-table-summary">
          <span>{tradeTableRangeLabel(tradeTableRange)}</span>
          <span>Page {activeTradeTablePage + 1} of {tradeTablePageCount} · {amountFormat.format(tableTrades.length)} matching trades</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Date & time</th><th>Source</th><th>Side</th><th>ZKAS amount</th><th>Price (KAS per ZKAS)</th><th>Est. USD per ZKAS</th><th>Total</th></tr></thead>
            <tbody>
              {visibleTableTrades.map((trade, index) => (
                <tr key={`${trade.timestamp ?? 'undated'}-${index}`}>
                  <td>{dateText(trade.timestamp)}</td>
                  <td><span className={`otc-source-pill ${sharedPreview ? 'shared' : marketSource}`}>{sharedPreview ? tradeRouteText(trade) : sourceName}</span></td>
                  <td><span className={`otc-side ${trade.side}`}>{trade.side === 'unknown' ? 'Trade' : trade.side}</span></td>
                  <td>{trade.zkasAmount === null ? '—' : amountFormat.format(trade.zkasAmount)}</td>
                  <td>{priceText(trade.priceKas)}</td>
                  <td>{usdPriceText(trade.priceKas !== null && kasUsd !== null ? trade.priceKas * kasUsd : null) ?? '—'}</td>
                  <td>{trade.totalKas === null ? '—' : `${amountFormat.format(trade.totalKas)} KAS`}</td>
                </tr>
              ))}
              {!tableTrades.length && <tr><td colSpan={7} className="empty-cell">No completed trades were recorded in this time range.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="otc-table-pagination" aria-label="Completed trades pages">
          <button disabled={activeTradeTablePage === 0} onClick={() => setTradeTablePage((page) => Math.max(0, page - 1))}>Previous</button>
          <span>Trades {orderedTableTrades.length ? activeTradeTablePage * tradesPerPage + 1 : 0}–{Math.min((activeTradeTablePage + 1) * tradesPerPage, orderedTableTrades.length)} of {amountFormat.format(orderedTableTrades.length)}</span>
          <button disabled={activeTradeTablePage >= tradeTablePageCount - 1} onClick={() => setTradeTablePage((page) => Math.min(tradeTablePageCount - 1, page + 1))}>Next</button>
        </div>
      </section>

      {sharedPreview && <OtcOpenOrders feed={orderFeed} error={orderError} loading={ordersLoading} />}

    </div>
  );
}

function orderPriceText(value: number, market: OtcOrderMarket) {
  if (market === 'USD') return `$${value.toLocaleString('en-US', { minimumFractionDigits: value < 0.01 ? 6 : 4, maximumFractionDigits: 8 })}`;
  return priceText(value);
}

function orderTotalText(value: number, market: OtcOrderMarket) {
  if (market === 'USD') return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${amountFormat.format(value)} KAS`;
}

function OtcOpenOrders({ feed, error, loading }: { feed: OtcOpenOrderFeed | null; error: string | null; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const orders = feed?.orders ?? [];
  const orderKey = (order: OtcOpenOrder, index: number) => `${order.market}-${order.side}-${order.price}-${order.zkasRemaining}-${index}`;
  const marketOrders = (market: OtcOrderMarket, side: 'buy' | 'sell') => orders
    .filter((order) => order.market === market && order.side === side)
    .sort((a, b) => side === 'buy' ? b.price - a.price : a.price - b.price)
    .slice(0, 5);
  const updated = feed ? new Date(feed.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' }) : null;

  return (
    <section className="panel otc-open-orders" aria-labelledby="otc-open-orders-title">
      <div className="panel-head otc-orders-head">
        <div><span className="panel-icon"><Activity size={20} /></span><div><h2 id="otc-open-orders-title">Open ZKAS buy and sell orders</h2><p>KAS and USD are the payment currencies used to quote each ZKAS order.</p></div></div>
        <span className="otc-orders-refresh"><RefreshCw size={13} className={loading ? 'spinning' : ''} /> {updated ? `Updated ${updated}` : '30 sec refresh'}</span>
      </div>

      {error && !orders.length && <div className="otc-orders-empty error"><b>Open orders temporarily unavailable</b><span>{error}</span></div>}
      {!error && !loading && !orders.length && <div className="otc-orders-empty"><b>No open ZKAS orders right now</b><span>There are currently no open offers in either the ZKAS/KAS or ZKAS/USD market. This section checks again every 30 seconds.</span></div>}
      {loading && !feed && <div className="otc-orders-empty"><b>Checking for open ZKAS orders…</b><span>Loading the shared order book.</span></div>}

      {!!orders.length && <div className="otc-orders-markets">
        {(['KAS', 'USD'] as OtcOrderMarket[]).map((market) => (
          <article className="otc-order-market" key={market}>
            <div className="otc-order-market-head"><div><span>ZKAS / {market}</span><small>{market === 'USD' ? 'USDT or USDC held at par' : 'Quoted and settled in KAS'}</small></div><b>{orders.filter((order) => order.market === market).length} open</b></div>
            <div className="otc-order-columns">
              {(['buy', 'sell'] as const).map((side) => {
                const sideOrders = marketOrders(market, side);
                return <div className={`otc-order-side ${side}`} key={side}>
                  <h3>{side === 'buy' ? 'Buy ZKAS offers' : 'Sell ZKAS offers'}</h3>
                  <div className="otc-order-labels"><span>Price</span><span>ZKAS left</span><span>Total</span></div>
                  {sideOrders.map((order, index) => {
                    const key = orderKey(order, index);
                    return <div className="otc-order-wrap" key={key}>
                      <button className="otc-order-row" onClick={() => setSelected((current) => current === key ? null : key)} aria-expanded={selected === key}>
                        <b>{orderPriceText(order.price, market)}</b><span>{amountFormat.format(order.zkasRemaining)}</span><span>{orderTotalText(order.totalQuote, market)}</span>
                      </button>
                      {selected === key && <div className="otc-order-venue">
                        <p>This order is on {order.via === 'telegram' ? 'Telegram OTC' : order.via === 'discord' ? 'Discord OTC' : 'the shared OTC orderbook'}. Open the official bot and select the matching price and amount.</p>
                        {order.via === 'telegram' && <a href="https://t.me/ZKas_OTC_bot" target="_blank" rel="noopener noreferrer"><Send size={15} /> Open Telegram OTC</a>}
                        {order.via === 'discord' && <a href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Open Discord OTC</a>}
                        {!order.via && <>
                          <a href="https://discord.gg/kJCYVtGEe" target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> Discord OTC</a>
                          <a href="https://t.me/ZKas_OTC_bot" target="_blank" rel="noopener noreferrer"><Send size={15} /> Telegram OTC</a>
                        </>}
                      </div>}
                    </div>;
                  })}
                  {!sideOrders.length && <div className="otc-order-none">No open {side} offers</div>}
                </div>;
              })}
            </div>
          </article>
        ))}
      </div>}
      <p className="otc-orders-note">ZKAS.stream displays public order information only. Orders are placed and completed inside the official ZKAS-controlled bots.</p>
    </section>
  );
}

function OtcSummary({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone?: 'positive' | 'negative' }) {
  return (
    <div className={`exchange-metric otc-summary ${tone || ''}`}>
      <span><i className="otc-summary-icon">{icon}</i>{label}</span>
      <b>{value}</b>
      <small>{detail}</small>
    </div>
  );
}

function OtcPriceChart({ trades, range, change, zkasUsd, sourceName, expandedSpacing = false }: { trades: OtcTrade[]; range: Range; change: number | null; zkasUsd: number | null; sourceName: string; expandedSpacing?: boolean }) {
  const points = trades
    .map((trade) => ({ trade, value: trade.priceKas }))
    .filter((point): point is { trade: OtcTrade; value: number } => point.value !== null && Number.isFinite(point.value));
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollLeft = container.scrollWidth - container.clientWidth;
  }, [points.length, range]);

  if (!points.length) {
    return <div className="otc-chart-empty"><TrendingUp size={30} /><b>Waiting for {sourceName} completed trades</b><span>{sourceName === 'ZKAS OTC' ? 'The chart will update automatically when the shared API returns completed trades.' : `Import reviewed ${sourceName} screenshots and the chart will update automatically.`}</span></div>;
  }

  const left = 84;
  const right = 108;
  const top = 24;
  const bottom = 52;
  const preferredPointGap = expandedSpacing
    ? range === '4H' ? 34 : range === '6H' ? 30 : range === '1D' ? 26 : 18
    : range === '4H' ? 24 : range === '6H' ? 18 : range === '1D' ? 13 : 9;
  const minimumPlotWidth = expandedSpacing ? 960 : 728;
  const plotWidth = Math.max(minimumPlotWidth, Math.max(1, points.length - 1) * preferredPointGap);
  const width = left + plotWidth + right;
  const height = 360;
  const values = points.map((point) => point.value);
  const rawMax = Math.max(...values);
  const focusScale = range === '4H' || range === '6H' || range === '1D';
  const steppedCeilings = [0.1, 0.15, 0.2, 0.25, 0.3, 0.5, 0.8, 1];
  const max = focusScale
    ? 0.1
    : steppedCeilings.find((ceiling) => ceiling >= rawMax * 1.08)
      ?? Math.ceil(rawMax * 1.08 * 10) / 10;
  const min = 0;
  const pointGap = points.length > 1 ? plotWidth / (points.length - 1) : 0;
  const xFor = (_point: typeof points[number], index: number) => left + index * pointGap;
  const yFor = (value: number) => top + ((max - value) / Math.max(max - min, Number.EPSILON)) * (height - top - bottom);
  const coordinates = points.map((point, index) => ({
    ...point,
    x: xFor(point, index),
    y: yFor(Math.min(point.value, max)),
    offScale: point.value > max,
  }));
  const coloredSegments = coordinates.slice(0, -1).flatMap((from, index) => {
    const to = coordinates[index + 1];
    if (from.offScale || to.offScale) return [];
    const direction = to.value > from.value ? 'up' : to.value < from.value ? 'down' : 'flat';
    return [{ from, to, direction }];
  });
  const inScaleCoordinates = coordinates.filter((point) => !point.offScale);
  const path = inScaleCoordinates.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const areaPath = inScaleCoordinates.length
    ? `${path} L ${inScaleCoordinates.at(-1)?.x ?? left} ${height - bottom} L ${inScaleCoordinates[0]?.x ?? left} ${height - bottom} Z`
    : '';
  const offScaleCount = coordinates.filter((point) => point.offScale).length;
  const latest = coordinates.at(-1)!;
  const preferredGridValues = focusScale ? [0, 0.05, 0.06, 0.07, 0.08, 0.09, 0.1]
    : max <= 0.1 ? [0, 0.02, 0.04, 0.06, 0.08, 0.1]
    : max <= 0.15 ? [0, 0.03, 0.06, 0.09, 0.12, 0.15]
      : max <= 0.2 ? [0, 0.04, 0.08, 0.12, 0.16, 0.2]
        : max <= 0.25 ? [0, 0.05, 0.1, 0.15, 0.2, 0.25]
          : max <= 0.3 ? [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
            : max <= 0.5 ? [0, 0.1, 0.2, 0.3, 0.4, 0.5]
              : max <= 0.8 ? [0, 0.2, 0.4, 0.6, 0.8]
                : max <= 1 ? [0, 0.2, 0.4, 0.6, 0.8, 1]
                  : Array.from({ length: 6 }, (_, index) => (max / 5) * index);
  const grid = [...preferredGridValues].reverse().map((value) => ({ y: yFor(value), value }));
  const xLabels = [coordinates[0], coordinates[Math.floor((coordinates.length - 1) / 2)], coordinates.at(-1)!];
  const plotRight = left + plotWidth;
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
    <div className="otc-chart-shell">
      <div className="otc-chart-overview">
        <div>
          <strong>ZKAS / KAS</strong>
          <span>{range} &nbsp; {priceText(latest.value)} &nbsp; {usdPriceText(zkasUsd) ? `≈ ${usdPriceText(zkasUsd)}` : ''} &nbsp; {change === null ? '' : `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`}</span>
        </div>
        <b>{amountFormat.format(points.length)} TRADES{offScaleCount ? ` · ${offScaleCount} OFF SCALE` : ''}</b>
      </div>
      <div className="otc-chart-stage">
        <div className="otc-chart-fixed-axis" aria-hidden="true">
          <svg viewBox={`0 0 ${left} ${height}`}>
            {grid.map((line) => <text key={line.y} className="otc-axis-label" x={left - 10} y={line.y + 4} textAnchor="end">{chartAxisText(line.value)}</text>)}
          </svg>
        </div>
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
        {grid.map((line) => <line key={line.y} className="otc-grid" x1={left} x2={plotRight} y1={line.y} y2={line.y} />)}
        {areaPath && <path className="otc-area" d={areaPath} />}
        {coloredSegments.map((segment, index) => (
          <line key={`trade-segment-${index}`} className={`otc-segment ${segment.direction}`} x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y} />
        ))}
        <line className="otc-current-line" x1={left} x2={width - 14} y1={latest.y} y2={latest.y} />
        <rect className="otc-current-tag" x={plotRight + 6} y={latest.y - 20} width={right - 12} height={40} rx="8" />
        <text className="otc-current-label" x={plotRight + 14} y={latest.y - 5}>LAST TRADE</text>
        <text className="otc-current-text" x={plotRight + 14} y={latest.y + 10}>{latest.value.toLocaleString('en-US', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}</text>
        {coordinates.map((point, index) => point.offScale
          ? <path key={`${point.trade.timestamp ?? 'undated'}-${index}`} className={`otc-point ${point.trade.side}`} d={`M ${point.x - 4} ${top + 8} L ${point.x} ${top} L ${point.x + 4} ${top + 8} Z`}><title>{`${dateText(point.trade.timestamp)} · ${priceText(point.value)} · off scale`}</title></path>
          : <circle key={`${point.trade.timestamp ?? 'undated'}-${index}`} className={`otc-point ${point.trade.side}`} cx={point.x} cy={point.y} r="4.5"><title>{`${dateText(point.trade.timestamp)} · ${priceText(point.value)}`}</title></circle>)}
        {xLabels.map((point, index) => <text key={`${point.trade.timestamp ?? 'undated'}-${index}`} className="otc-axis-label" x={point.x} y={height - 18} textAnchor={index === 0 ? 'start' : index === 2 ? 'end' : 'middle'}>{point.trade.timestamp === null ? `Trade ${index + 1}` : new Date(point.trade.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}</text>)}
          </svg>
        </div>
      </div>
    </div>
  );
}
