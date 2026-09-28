import { useEffect, useMemo, useState } from 'react';
import { Activity, ExternalLink } from 'lucide-react';
import { SparkChart } from './SparkChart';

type ChartPayload = {
  prices: [number, number][];
  total_volumes: [number, number][];
  source: string;
};

type Range = '1' | '7' | '30' | '90' | '365' | 'max';

const ranges: Array<{ value: Range; label: string }> = [
  { value: '1', label: '24H' },
  { value: '7', label: '7D' },
  { value: '30', label: '1M' },
  { value: '90', label: '3M' },
  { value: '365', label: '1Y' },
  { value: 'max', label: 'MAX' },
];

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 8 });
const volumeUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });

async function loadChart(days: Range, signal: AbortSignal): Promise<ChartPayload> {
  const urls = [
    `/api/kas-price?chart-days=${days}`,
    `https://api.coingecko.com/api/v3/coins/zkas/market_chart?vs_currency=usd&days=${days}`,
  ];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`CoinGecko request failed (${response.status})`);
      const data = await response.json() as ChartPayload;
      if (!Array.isArray(data.prices) || !Array.isArray(data.total_volumes)) throw new Error('Invalid CoinGecko chart data');
      return data;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
      lastError = cause;
    }
  }
  throw lastError ?? new Error('CoinGecko chart unavailable');
}

export function CoinGeckoZkasChart() {
  const [range, setRange] = useState<Range>('1');
  const [payload, setPayload] = useState<ChartPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    loadChart(range, controller.signal)
      .then(setPayload)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(true);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [range]);

  const chart = useMemo(() => {
    if (!payload) return null;
    const rows = payload.prices.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1]) && point[1] > 0);
    const latest = rows.at(-1);
    const first = rows[0];
    const volume = payload.total_volumes.filter((point) => Number.isFinite(point[0]) && Number.isFinite(point[1])).at(-1);
    return { rows, latest, first, volume };
  }, [payload]);

  return (
    <section className="panel coingecko-market-panel">
      <div className="panel-head">
        <div><span className="panel-icon"><Activity size={20} /></span><h2>Market activity context</h2></div>
        <a className="coingecko-page-link" href="https://www.coingecko.com/en/coins/zkas" target="_blank" rel="noreferrer">
          CoinGecko <ExternalLink size={13} />
        </a>
      </div>
      <p className="coingecko-market-note">ZKAS price history and reported 24-hour volume, aggregated by CoinGecko. This market view is separate from the network events above.</p>
      <div className="coingecko-market-toolbar">
        <span className="range-chip">COINGECKO · USD</span>
        <div className="coingecko-range" role="group" aria-label="CoinGecko chart range">
          {ranges.map((option) => (
            <button key={option.value} type="button" className={range === option.value ? 'active' : ''} onClick={() => setRange(option.value)}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {loading && !chart ? <div className="coingecko-chart-state">Loading CoinGecko market data…</div> : error && !chart ? (
        <div className="coingecko-chart-state">CoinGecko chart data is temporarily unavailable. It will retry when you change the range or reload the page.</div>
      ) : chart?.latest ? (
        <>
          <div className="coingecko-market-stats">
            <div><span>Latest indexed price</span><strong>{usd.format(chart.latest[1])}</strong></div>
            <div><span>Reported 24h volume</span><strong>{chart.volume ? volumeUsd.format(chart.volume[1]) : '—'}</strong></div>
          </div>
          <SparkChart values={chart.rows.map((point) => point[1])} labels={chart.rows.map((point) => point[0])} height={220} />
          <div className="coingecko-chart-footnote">
            <span>{chart.first ? `History shown from ${new Date(chart.first[0]).toLocaleString()}` : 'Historical chart'}</span>
            <span>CoinGecko currently reports no usable market-cap data for ZKAS.</span>
          </div>
        </>
      ) : <div className="coingecko-chart-state">No ZKAS price history is available from CoinGecko yet.</div>}
    </section>
  );
}
