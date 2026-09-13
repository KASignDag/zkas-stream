import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Cpu, RefreshCw, Server, ShieldCheck, Zap } from 'lucide-react';
import './CommunityMiningPage.css';

type MinerRow = {
  alias: string;
  status: 'online' | 'offline';
  hashrateHps: number | null;
  uptimeSeconds: number | null;
  acceptedShares: number | null;
  invalidShares: number | null;
  staleShares: number | null;
  lastShareAt: number | null;
  zkasBlocks: number | null;
  kasBlocks: number | null;
  kasPayoutSet: boolean;
};

type MiningSnapshot = {
  schemaVersion: number;
  updatedAt: number | null;
  gatewayOnline: boolean;
  miners: MinerRow[];
};

const EMPTY: MiningSnapshot = {
  schemaVersion: 1,
  updatedAt: null,
  gatewayOnline: false,
  miners: [],
};

function fmtHashrate(value: number | null) {
  if (value === null || !Number.isFinite(value)) return '—';
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s', 'EH/s'];
  let n = value;
  let unit = 0;
  while (Math.abs(n) >= 1000 && unit < units.length - 1) {
    n /= 1000;
    unit += 1;
  }
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)} ${units[unit]}`;
}

function fmtDuration(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

function fmtAge(timestamp: number | null) {
  if (!timestamp) return '—';
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function fmtNumber(value: number | null) {
  return value === null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

export function CommunityMiningPage() {
  const [snapshot, setSnapshot] = useState<MiningSnapshot>(EMPTY);
  const [state, setState] = useState<'loading' | 'live' | 'error'>('loading');

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const controller = signal ? null : new AbortController();
    try {
      const response = await fetch('/api/community-mining', {
        signal: signal ?? controller!.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json() as MiningSnapshot;
      setSnapshot({ ...EMPTY, ...body, miners: Array.isArray(body.miners) ? body.miners : [] });
      setState('live');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setState('error');
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const totals = useMemo(() => {
    const online = snapshot.miners.filter((miner) => miner.status === 'online').length;
    const hashrate = snapshot.miners.reduce((sum, miner) => sum + (miner.hashrateHps ?? 0), 0);
    const zkasBlocks = snapshot.miners.reduce((sum, miner) => sum + (miner.zkasBlocks ?? 0), 0);
    const kasBlocks = snapshot.miners.reduce((sum, miner) => sum + (miner.kasBlocks ?? 0), 0);
    return { online, hashrate, zkasBlocks, kasBlocks };
  }, [snapshot.miners]);

  return (
    <section className="community-mining">
      <div className="community-mining__intro">
        <div>
          <div className="community-mining__eyebrow"><Zap size={16} /> ZKAS + KAS SOLO MERGE MINING</div>
          <h2>Community Merge Mining</h2>
          <p>
            One Stratum connection lets compatible ASICs solo merge-mine ZKAS and KAS with the same hashrate.
            Each miner supplies a ZKAS payout address in the worker name and a Kaspa payout address in the password field.
          </p>
        </div>
        <button className="community-mining__refresh" type="button" onClick={() => void refresh()}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="community-mining__statusline">
        <span className={`community-mining__dot ${snapshot.gatewayOnline ? 'is-online' : ''}`} />
        Gateway {snapshot.gatewayOnline ? 'online' : 'offline'}
        <span>•</span>
        <span>{snapshot.updatedAt ? `Updated ${fmtAge(snapshot.updatedAt)}` : state === 'loading' ? 'Waiting for first snapshot' : 'No snapshot yet'}</span>
      </div>

      <div className="community-mining__cards">
        <div className="community-mining__card"><Server size={20} /><span>Online miners</span><strong>{totals.online}</strong></div>
        <div className="community-mining__card"><Cpu size={20} /><span>Combined hashrate</span><strong>{fmtHashrate(totals.hashrate)}</strong></div>
        <div className="community-mining__card"><ShieldCheck size={20} /><span>ZKAS blocks</span><strong>{fmtNumber(totals.zkasBlocks)}</strong></div>
        <div className="community-mining__card"><CheckCircle2 size={20} /><span>KAS blocks</span><strong>{fmtNumber(totals.kasBlocks)}</strong></div>
      </div>

      <div className="community-mining__panel">
        <div className="community-mining__panel-head">
          <div><Activity size={18} /> Live miners</div>
          <span>Wallet addresses and IP addresses are not displayed.</span>
        </div>

        {state === 'error' && <div className="community-mining__empty">Mining snapshot is temporarily unavailable.</div>}
        {state !== 'error' && snapshot.miners.length === 0 && (
          <div className="community-mining__empty">No public miners have been published yet.</div>
        )}

        {snapshot.miners.length > 0 && (
          <div className="community-mining__table-wrap">
            <table className="community-mining__table">
              <thead>
                <tr>
                  <th>Miner</th>
                  <th>Status</th>
                  <th>Hashrate</th>
                  <th>Uptime</th>
                  <th>Accepted</th>
                  <th>Invalid / stale</th>
                  <th>Last share</th>
                  <th>ZKAS blocks</th>
                  <th>KAS blocks</th>
                  <th>KAS payout</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.miners.map((miner) => (
                  <tr key={miner.alias}>
                    <td className="community-mining__alias">{miner.alias}</td>
                    <td><span className={`community-mining__badge ${miner.status === 'online' ? 'is-online' : ''}`}>{miner.status}</span></td>
                    <td>{fmtHashrate(miner.hashrateHps)}</td>
                    <td><Clock3 size={14} /> {fmtDuration(miner.uptimeSeconds)}</td>
                    <td>{fmtNumber(miner.acceptedShares)}</td>
                    <td>{fmtNumber((miner.invalidShares ?? 0) + (miner.staleShares ?? 0))}</td>
                    <td>{fmtAge(miner.lastShareAt)}</td>
                    <td>{fmtNumber(miner.zkasBlocks)}</td>
                    <td>{fmtNumber(miner.kasBlocks)}</td>
                    <td>{miner.kasPayoutSet ? 'Set' : 'Pool fallback'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="community-mining__howto">
        <h3>Miner format</h3>
        <div><span>URL</span><code>stratum+tcp://mine.zkas.stream:&lt;port&gt;</code></div>
        <div><span>User / worker</span><code>zkas:&lt;YOUR_ZKAS_ADDRESS&gt;.&lt;WORKER&gt;</code></div>
        <div><span>Password</span><code>kaspa:&lt;YOUR_KAS_ADDRESS&gt;</code></div>
        <p>The public hostname and production port will be published after the external gateway test is complete.</p>
      </div>
    </section>
  );
}
