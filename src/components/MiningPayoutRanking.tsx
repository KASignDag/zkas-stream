import { FormEvent, useEffect, useState } from 'react';
import { Database, History, Search, ShieldCheck, Waves } from 'lucide-react';

type RankingStatus = 'complete' | 'backfilling' | 'awaiting_backfill' | 'unavailable';

type RankingRow = {
  rank: number;
  address: string;
  blocks: number;
  zkasMined: string;
  firstMinedAt: number | null;
  lastMinedAt: number | null;
};

type RankingData = {
  status: RankingStatus;
  complete: boolean;
  message: string;
  updatedAt: number;
  indexedThrough?: number | null;
  backfill: { processedBlocks: number; targetBlocks: number | null; coveragePercent: number | null };
  totals: { addresses: number; blocks: number; zkasMined: string };
  tiers: Array<{
    key: string;
    name: string;
    range: string;
    addresses: number;
    addressPercent: number;
    zkasMined: string;
    minedPercent: number;
  }>;
  page: number;
  pageSize: number;
  totalPages: number;
  query: string;
  rows: RankingRow[];
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

export function MiningPayoutRanking() {
  const [data, setData] = useState<RankingData | null>(null);
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
    fetch(`/api/mining-rankings?${params}`, { headers: { Accept: 'application/json' }, signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json() as RankingData;
        if (!response.ok && !payload?.status) throw new Error('Ranking service unavailable');
        setData(payload);
      })
      .catch((reason) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError('The historical mining ranking could not be loaded.');
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [page, query]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(input.trim().toLowerCase());
  }

  const coverage = data?.backfill.coveragePercent;
  const final = data?.complete === true;
  const statusLabel = final ? 'BACKFILL COMPLETE' : data?.status === 'backfilling' ? 'BACKFILLING' : 'INDEX REQUIRED';

  return (
    <section className="panel payout-ranking-panel">
      <div className="panel-head payout-ranking-head">
        <div><span className="panel-icon"><History size={20} /></span><div><h2>All-time mining payout ranking</h2><p>Network-wide public coinbase destinations, indexed from genesis.</p></div></div>
        <span className={`range-chip ${final ? 'ranking-complete' : 'ranking-pending'}`}>{statusLabel}</span>
      </div>

      <div className="ranking-boundary"><ShieldCheck size={16} /><span>This ranks where mining rewards were originally sent. It is not a wallet-balance rich list and cannot follow later shielded transfers.</span></div>

      <form className="ranking-search" onSubmit={submit} aria-label="Mining payout address ranking lookup">
        <label>
          <span>Search your ZKAS mining payout address</span>
          <small>Paste the complete address to find its exact all-time rank.</small>
          <div><Search size={20} /><input aria-label="ZKAS mining payout address" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Paste a full zkas: address here" autoComplete="off" autoCapitalize="none" spellCheck={false} /></div>
        </label>
        <button type="submit" disabled={loading || !input.trim()}>{loading && query ? 'Searching…' : 'Find address rank'}</button>
        {query && <button type="button" className="ranking-clear" onClick={() => { setInput(''); setQuery(''); setPage(1); }}>Clear</button>}
      </form>

      <div className="ranking-summary-grid">
        <div><span>Indexed addresses</span><b>{data ? integer.format(data.totals.addresses) : '—'}</b><small>public payout destinations</small></div>
        <div><span>Indexed blocks</span><b>{data ? integer.format(data.totals.blocks) : '—'}</b><small>attributed mining rewards</small></div>
        <div><span>ZKAS mined</span><b>{data ? formatAmount(data.totals.zkasMined) : '—'}</b><small>exact indexed reward total</small></div>
        <div><span>Historical coverage</span><b>{coverage === null || coverage === undefined ? (final ? '100%' : '—') : `${coverage.toFixed(2)}%`}</b><small>{final ? 'genesis through indexed tip' : 'rankings are provisional'}</small></div>
      </div>

      {(data?.message || error) && <div className={`ranking-status ${final ? 'complete' : ''}`}><Database size={18} /><div><b>{final ? 'All-time index verified' : 'Historical index status'}</b><span>{error || data?.message}</span></div></div>}

      {data?.tiers?.length ? <section className="payout-tier-section" aria-labelledby="payout-tier-title">
        <div className="payout-tier-head">
          <div><Waves size={18} /><div><h3 id="payout-tier-title">ZKAS mining payout tiers</h3><p>Every indexed address grouped by total historical mining rewards received.</p></div></div>
          <span>{integer.format(data.totals.addresses)} addresses</span>
        </div>
        <div className="payout-tier-chart">
          {data.tiers.map((tier) => <div className={`payout-tier-row tier-${tier.key}`} key={tier.key}>
            <div className="payout-tier-label"><b>{tier.name}</b><span>{tier.range}</span></div>
            <div className="payout-tier-bar" title={`${tier.minedPercent.toFixed(2)}% of indexed mining payouts`}>
              <i style={{ width: `${Math.max(0, Math.min(100, tier.minedPercent))}%` }} />
            </div>
            <div className="payout-tier-addresses"><b>{integer.format(tier.addresses)}</b><span>{tier.addressPercent.toFixed(1)}% of addresses</span></div>
            <div className="payout-tier-mined"><b>{formatAmount(tier.zkasMined)} ZKAS</b><span>{tier.minedPercent.toFixed(2)}% of mined payouts</span></div>
          </div>)}
        </div>
        <p className="payout-tier-note">These tiers measure cumulative public mining payouts—not current holdings. Later shielded transfers cannot be attributed to an address.</p>
      </section> : null}

      {data?.rows.length ? <>
        <div className="ranking-table-wrap">
          <table className="ranking-table">
            <thead><tr><th>Rank</th><th>Mining payout address</th><th>Historical blocks</th><th>Total ZKAS mined</th><th>First mined</th><th>Last mined</th></tr></thead>
            <tbody>{data.rows.map((row) => <tr key={row.address}>
              <td><b>{final ? `#${integer.format(row.rank)}` : 'Pending'}</b></td>
              <td><code title={row.address}>{shortAddress(row.address)}</code></td>
              <td>{integer.format(row.blocks)}</td>
              <td><b>{formatAmount(row.zkasMined)}</b></td>
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
      </> : !loading && final && <div className="ranking-empty">{query ? 'This address has not received an indexed mining reward.' : 'No indexed mining payout addresses were returned.'}</div>}

      <p className="source-note"><ShieldCheck size={15} /> A rank becomes final only after the archival scan reaches genesis and the index is reconciled through the reported chain tip. Pool addresses represent the pool destination, not each pool participant.</p>
    </section>
  );
}
