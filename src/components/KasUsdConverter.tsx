import { useEffect, useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { fetchKasUsdt, fetchZkasUsdt, type KasUsdtQuote } from '../otc';

type EditedCurrency = 'kas' | 'usd';

// These values are rendered inside <input type="number"> fields. Thousands
// separators are not valid there, so keep the formatted value browser-parseable.
const preciseNumber = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 8,
  useGrouping: false,
});

function numericValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function displayValue(value: number | null) {
  return value === null ? '' : preciseNumber.format(value);
}

function UsdtConverter({ symbol, idPrefix, fetchQuote }: {
  symbol: 'KAS' | 'ZKAS';
  idPrefix: 'kas' | 'zkas';
  fetchQuote: (signal?: AbortSignal) => Promise<KasUsdtQuote>;
}) {
  const [quote, setQuote] = useState<KasUsdtQuote | null>(null);
  const [kasInput, setKasInput] = useState('1');
  const [usdInput, setUsdInput] = useState('');
  const [edited, setEdited] = useState<EditedCurrency>('kas');
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;

    async function refresh() {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      try {
        const next = await fetchQuote(request.signal);
        if (!stopped) {
          setQuote(next);
          setError(false);
        }
      } catch {
        if (!stopped && !request.signal.aborted) setError(true);
      }
    }

    void refresh();
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
    };
  }, [fetchQuote]);

  const kasValue = edited === 'kas'
    ? numericValue(kasInput)
    : quote && numericValue(usdInput) !== null
      ? (numericValue(usdInput) as number) / quote.priceUsdt
      : null;
  const usdValue = edited === 'usd'
    ? numericValue(usdInput)
    : quote && numericValue(kasInput) !== null
      ? (numericValue(kasInput) as number) * quote.priceUsdt
      : null;

  function changeKas(value: string) {
    setKasInput(value);
    setEdited('kas');
  }

  function changeUsd(value: string) {
    setUsdInput(value);
    setEdited('usd');
  }

  return (
    <section className="panel kas-converter" aria-labelledby={`${idPrefix}-converter-title`}>
      <div className="panel-head">
        <div>
          <span className="panel-icon"><CircleDollarSign size={20} /></span>
          <h2 id={`${idPrefix}-converter-title`}>{symbol} to USDT converter</h2>
        </div>
        <span className={`live-mini ${quote ? '' : 'converter-loading'}`}><i />{quote ? 'LIVE RATE' : 'LOADING RATE'}</span>
      </div>

      <div className="kas-converter-fields">
        <label className="kas-converter-field" htmlFor={`${idPrefix}-converter-coin`}>
          <span>{symbol}</span>
          <input
            id={`${idPrefix}-converter-coin`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={edited === 'kas' ? kasInput : displayValue(kasValue)}
            onChange={(event) => changeKas(event.target.value)}
            aria-label={`Amount in ${symbol}`}
          />
        </label>
        <label className="kas-converter-field" htmlFor={`${idPrefix}-converter-usd`}>
          <span>USDT</span>
          <input
            id={`${idPrefix}-converter-usd`}
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={edited === 'usd' ? usdInput : displayValue(usdValue)}
            onChange={(event) => changeUsd(event.target.value)}
            aria-label="Amount in Tether USDT"
            placeholder={quote ? '0.00' : 'Loading…'}
          />
        </label>
      </div>

      <p className="kas-converter-note" aria-live="polite">
        {quote
          ? `1 ${symbol} = $${preciseNumber.format(quote.priceUsdt)} USDT · ${quote.source} · Updated ${new Date(quote.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${error ? ' · Refresh delayed' : ''}`
          : error ? `The ${symbol}/USDT rate is temporarily unavailable.` : `Fetching the latest ${symbol}/USDT rate…`}
      </p>
    </section>
  );
}

export function KasUsdConverter() {
  return <UsdtConverter symbol="KAS" idPrefix="kas" fetchQuote={fetchKasUsdt} />;
}

export function ZkasUsdConverter() {
  return <UsdtConverter symbol="ZKAS" idPrefix="zkas" fetchQuote={fetchZkasUsdt} />;
}
