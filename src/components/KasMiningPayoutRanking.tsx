import { FormEvent, useEffect, useState } from 'react';
import { Database, History, Search, ShieldCheck } from 'lucide-react';

type RankingStatus = 'complete' | 'backfilling' | 'awaiting_backfill' | 'unavailable';

type KasRankingRow = {
  rank: number;
  address: string;
  acceptedCoinbases: number;
  payoutOutputs: number;
  kasMined: string;
  firstMinedAt: number | null;
  lastMinedAt: number | null;
};

type KasRankingData = {
  status: RankingStatus;
  complete: boolean;
  message: string;
  updatedAt: number;
  backfill: {
    processedAcceptedCoinbases?: number;
    coveragePercent: number | null;
    coverageLabel?: string;
  };
  totals: {
    addresses: number;
    acceptedCoinbases: number | null;
    payoutOutputs: number;
    kasMined: string;
  };
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  rows: KasRankingRow[];
};

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const amount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const PAGE_SIZE = 20;

function formatAmount(value: string | number) {
  return amount.format(Number(value));
}

function shortAddress(address: string) {
  return address.length > 28 ? `${address.slice(0, 17)}…${address.slice(-10)}` : address;
}

function dateTime(value: number | null | undefined) {
  return value ? new Date(value).toLocaleString() : '—';
}

/**
 * Prepared KAS counterpart to MiningPayoutRanking.
 * Intentionally not mounted by App.tsx until a verified historical KAS snapshot exists.
 */
export function KasMiningPayoutRanking() {
  const [data, setData] = useState<KasRankingData | null>(null);
  const [page, setPage] = useState(1);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('q', query);
    setLoading(true);
    setError('');
    fetch(`/api/kas-mining-rankings?${params}`, { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as KasRankingData;
        if (!response.ok && !payload?.status) throw new Error('Ranking service unavailable');
        setData(payload);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError('The Kaspa historical mining ranking could not be loaded.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(input.trim().toLowerCase());
  }

  const final = data?.complete === true;
  const coverage = data?.backfill.coveragePercent;
  const statusLabel = final ? 'INDEX READY' : data?.status === 'backfilling' ? 'BACKFILLING' : 'INDEX REQUIRED';
  const coverageLabel = data?.backfill.coverageLabel
    || (coverage === null || coverage === undefined ? '—' : `${coverage.toFixed(2)}%`);

  return (
    <section className="panel payout-ranking-panel">
      <div className="panel-head payout-ranking-head">
        <div><span className="panel-icon"><History size={20} /></span><div><h2>KAS all-time mining payout ranking</h2><p>Accepted Kaspa coinbase payout destinations from the historical index.</p></div></div>
        <span className={`range-chip ${final ? 'ranking-complete' : 'ranking-pending'}`}>{statusLabel}</span>
      </div>

      <div className="ranking-boundary"><ShieldCheck size={16} /><span>This ranks original accepted mining-reward destinations. It is not a current wallet-balance rich list. A single accepted Kaspa coinbase transaction can contain multiple payout outputs.</span></div>

      <form className="ranking-search" onSubmit={submit} aria-label="Kaspa mining payout address ranking lookup">
        <label>
          <span>Search a KAS mining payout address</span>
          <small>Paste the complete address to find its indexed historical rank.</small>
          <div><Search size={20} /><input aria-label="KAS mining payout address" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste a full kaspa: address here" autoComplete="off" autoCapitalize="none" spellCheck={false} /></div>
        </label>
        <button type="submit" disabled={loading || !input.trim()}>{loading && query ? 'Searching…' : 'Find address rank'}</button>
        {query && <button type="button" className="ranking-clear" onClick={() => { setInput(''); setQuery(''); setPage(1); }}>Clear</button>}
      </form>

      <div className="ranking-summary-grid">
        <div><span>Indexed addresses</span><b>{data ? integer.format(data.totals.addresses) : '—'}</b><small>accepted payout destinations</small></div>
        <div><span>Accepted coinbases</span><b>{data?.totals.acceptedCoinbases === null || data?.totals.acceptedCoinbases === undefined ? '—' : integer.format(data.totals.acceptedCoinbases)}</b><small>network-wide accepted reward transactions</small></div>
        <div><span>KAS mined</span><b>{data ? formatAmount(data.totals.kasMined) : '—'}</b><small>indexed accepted payout total</small></div>
        <div><span>Historical coverage</span><b>{coverageLabel}</b><small>reported by the historical dataset</small></div>
      </div>

      {(data?.message || error) && <div className={`ranking-status ${final ? 'complete' : ''}`}><Database size={18} /><div><b>{final ? 'Kaspa mining index loaded' : 'Kaspa historical index status'}</b><span>{error || data?.message}</span></div></div>}

      {data?.rows.length ? <>
        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <thead><tr><th>Rank</th><th>KAS payout address</th><th>Accepted rewards</th><th>Payout outputs</th><th>Total KAS mined</th><th>First payout</th><th>Last payout</th></tr></thead>
            <tbody>{data.rows.map((row) => <tr key={row.address}>
              <td><b>#{integer.format(row.rank)}</b></td>
              <td><code title={row.address}>{shortAddress(row.address)}</code></td>
              <td>{integer.format(row.acceptedCoinbases)}</td>
              <td>{integer.format(row.payoutOutputs)}</td>
              <td><b>{formatAmount(row.kasMined)}</b></td>
              <td>{dateTime(row.firstMinedAt)}</td>
              <td>{dateTime(row.lastMinedAt)}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <div className="ranking-pagination">
          <button type="button" disabled={loading || data.page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous 20</button>
          <span>Page {data.page} of {data.totalPages || 1}{query ? ' · address result' : ' · 20 per page'}</span>
          <button type="button" disabled={loading || data.page >= data.totalPages} onClick={() => setPage((value) => value + 1)}>Next 20</button>
        </div>
      </> : !loading && final && <div className="ranking-empty">{query ? 'This address has no accepted mining payout in the indexed dataset.' : 'No indexed KAS mining payout addresses were returned.'}</div>}

      <p className="source-note"><ShieldCheck size={15} /> Only accepted coinbase payouts belong in this ranking. Rejected/not-accepted coinbases must be excluded before aggregation. Pool payout addresses represent the pool destination, not individual pool participants.</p>
    </section>
  );
}
