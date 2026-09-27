import { useEffect, useState } from 'react';
import { CircleDollarSign } from 'lucide-react';
import { fetchKasUsd, type KasUsdQuote } from '../otc';

type EditedCurrency = 'kas' | 'usd';

const preciseNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });

function numericValue(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function displayValue(value: number | null) {
  return value === null ? '' : preciseNumber.format(value);
}

export function KasUsdConverter() {
  const [quote, setQuote] = useState<KasUsdQuote | null>(null);
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
        const next = await fetchKasUsd(request.signal);
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
  }, []);

  const kasValue = edited === 'kas'
    ? numericValue(kasInput)
    : quote && numericValue(usdInput) !== null
      ? (numericValue(usdInput) as number) / quote.priceUsd
      : null;
  const usdValue = edited === 'usd'
    ? numericValue(usdInput)
    : quote && numericValue(kasInput) !== null
      ? (numericValue(kasInput) as number) * quote.priceUsd
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
    <section className="panel kas-converter" aria-labelledby="kas-converter-title">
      <div className="panel-head">
        <div>
          <span className="panel-icon"><CircleDollarSign size={20} /></span>
          <h2 id="kas-converter-title">KAS to USD converter</h2>
        </div>
        <span className={`live-mini ${quote ? '' : 'converter-loading'}`}><i />{quote ? 'LIVE RATE' : 'LOADING RATE'}</span>
      </div>

      <div className="kas-converter-fields">
        <label className="kas-converter-field" htmlFor="kas-converter-kas">
          <span>KAS</span>
          <input
            id="kas-converter-kas"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={edited === 'kas' ? kasInput : displayValue(kasValue)}
            onChange={(event) => changeKas(event.target.value)}
            aria-label="Amount in KAS"
          />
        </label>
        <label className="kas-converter-field" htmlFor="kas-converter-usd">
          <span>USD</span>
          <input
            id="kas-converter-usd"
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={edited === 'usd' ? usdInput : displayValue(usdValue)}
            onChange={(event) => changeUsd(event.target.value)}
            aria-label="Amount in US dollars"
            placeholder={quote ? '0.00' : 'Loading…'}
          />
        </label>
      </div>

      <p className="kas-converter-note" aria-live="polite">
        {quote
          ? `1 KAS = $${preciseNumber.format(quote.priceUsd)} USD · ${quote.source} · Updated ${new Date(quote.updatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}${error ? ' · Refresh delayed' : ''}`
          : error ? 'The KAS/USD rate is temporarily unavailable.' : 'Fetching the latest KAS/USD rate…'}
      </p>
    </section>
  );
}
