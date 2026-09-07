import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Gem,
  LockKeyhole,
  Medal,
  RefreshCw,
  ShieldCheck,
  Trophy,
  WalletCards,
} from 'lucide-react';

const FUNDRAISER_WALLET = '0x08F7C6a1c064E2d8Abe46525e57911B3df02548F';
const BLOCKSCOUT_API = `https://arbitrum.blockscout.com/api/v2/addresses/${FUNDRAISER_WALLET}/token-transfers`;
const BLOCKSCOUT_WALLET_URL = `https://arbitrum.blockscout.com/address/${FUNDRAISER_WALLET}`;
const SUPPORTERS_ACCESS_KEY = 'zkas-supporters-preview-access';
const SUPPORTERS_PASSCODE_HASH = '36a71a5bca2513f92fc85544531b1605c3515ee5f6039882db0b17b05082652f';

const acceptedTokens: Record<string, { symbol: string; label: string }> = {
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { symbol: 'USDC', label: 'Native USDC' },
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { symbol: 'USDT', label: 'USDT on Arbitrum' },
};

type AddressRef = { hash?: string | null };
type TokenRef = { address_hash?: string | null; decimals?: string | null; symbol?: string | null };
type TransferTotal = { decimals?: string | null; value?: string | null };
type BlockscoutTransfer = {
  from?: AddressRef | null;
  to?: AddressRef | null;
  token?: TokenRef | null;
  total?: TransferTotal | null;
  transaction_hash?: string | null;
  timestamp?: string | null;
  log_index?: number | string | null;
};
type TransferPage = {
  items?: BlockscoutTransfer[];
  next_page_params?: Record<string, string | number> | null;
};
type FundTransfer = {
  id: string;
  hash: string;
  timestamp: string;
  direction: 'deposit' | 'withdrawal';
  counterparty: string;
  amount: number;
  symbol: string;
};

const supporterTiers = [
  { name: 'Diamond', minimum: 100, icon: Gem, className: 'diamond' },
  { name: 'Gold', minimum: 50, icon: Trophy, className: 'gold' },
  { name: 'Silver', minimum: 20, icon: Medal, className: 'silver' },
  { name: 'Bronze', minimum: 10, icon: Medal, className: 'bronze' },
];

function shortAddress(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function parseAmount(transfer: BlockscoutTransfer) {
  const raw = Number(transfer.total?.value ?? 0);
  const decimals = Number(transfer.total?.decimals ?? transfer.token?.decimals ?? 0);
  if (!Number.isFinite(raw) || !Number.isFinite(decimals)) return 0;
  return raw / (10 ** decimals);
}

async function fetchFundTransfers(signal: AbortSignal): Promise<FundTransfer[]> {
  const rows: BlockscoutTransfer[] = [];
  let next: Record<string, string | number> | null = null;

  // The fundraiser is new. Pagination is bounded to protect the public API while
  // still covering far more activity than the visible table needs.
  for (let page = 0; page < 20; page += 1) {
    const url = new URL(BLOCKSCOUT_API);
    url.searchParams.set('type', 'ERC-20');
    if (next) Object.entries(next).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`Wallet feed returned ${response.status}`);
    const body = await response.json() as TransferPage;
    rows.push(...(body.items ?? []));
    next = body.next_page_params ?? null;
    if (!next) break;
  }

  const wallet = FUNDRAISER_WALLET.toLowerCase();
  return rows.flatMap((transfer): FundTransfer[] => {
    const tokenAddress = transfer.token?.address_hash?.toLowerCase() ?? '';
    const accepted = acceptedTokens[tokenAddress];
    const from = transfer.from?.hash ?? '';
    const to = transfer.to?.hash ?? '';
    const fromFund = from.toLowerCase() === wallet;
    const toFund = to.toLowerCase() === wallet;
    const hash = transfer.transaction_hash ?? '';
    if (!accepted || !hash || (!fromFund && !toFund)) return [];
    return [{
      id: `${hash}:${transfer.log_index ?? 0}`,
      hash,
      timestamp: transfer.timestamp ?? '',
      direction: toFund ? 'deposit' : 'withdrawal',
      counterparty: toFund ? from : to,
      amount: parseAmount(transfer),
      symbol: accepted.symbol,
    }];
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
}

async function hashPasscode(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function GenesisSupportersPage() {
  const [unlocked, setUnlocked] = useState(() => window.sessionStorage.getItem(SUPPORTERS_ACCESS_KEY) === 'granted');
  const [passcode, setPasscode] = useState('');
  const [accessError, setAccessError] = useState('');
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [feedState, setFeedState] = useState<'loading' | 'live' | 'error'>('loading');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const ownController = signal ? null : new AbortController();
    try {
      const next = await fetchFundTransfers(signal ?? ownController!.signal);
      setTransfers(next);
      setUpdatedAt(Date.now());
      setFeedState('live');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setFeedState('error');
    }
  }, []);

  useEffect(() => {
    if (!unlocked) return undefined;
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh, unlocked]);

  const totals = useMemo(() => {
    const deposits = transfers.filter((row) => row.direction === 'deposit').reduce((sum, row) => sum + row.amount, 0);
    const withdrawals = transfers.filter((row) => row.direction === 'withdrawal').reduce((sum, row) => sum + row.amount, 0);
    return { deposits, withdrawals, balance: deposits - withdrawals };
  }, [transfers]);

  async function copyWallet() {
    await navigator.clipboard.writeText(FUNDRAISER_WALLET);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function unlockPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedHash = await hashPasscode(passcode.trim());
    if (submittedHash !== SUPPORTERS_PASSCODE_HASH) {
      setAccessError('That passcode is not correct.');
      return;
    }
    window.sessionStorage.setItem(SUPPORTERS_ACCESS_KEY, 'granted');
    setAccessError('');
    setPasscode('');
    setUnlocked(true);
  }

  function lockPage() {
    window.sessionStorage.removeItem(SUPPORTERS_ACCESS_KEY);
    setUnlocked(false);
    setFeedState('loading');
    setTransfers([]);
  }

  if (!unlocked) {
    return (
      <div className="supporters-gate-wrap">
        <section className="panel supporters-gate" aria-labelledby="supporters-gate-title">
          <span className="supporters-gate-icon"><LockKeyhole size={30} /></span>
          <span className="eyebrow">PRIVATE REVIEW</span>
          <h2 id="supporters-gate-title">Genesis Supporters</h2>
          <p>This preview is limited to reviewers with the access code.</p>
          <form onSubmit={(event) => void unlockPage(event)}>
            <label htmlFor="supporters-passcode">Passcode</label>
            <div className="supporters-gate-controls">
              <input
                id="supporters-passcode"
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                value={passcode}
                onChange={(event) => {
                  setPasscode(event.target.value);
                  setAccessError('');
                }}
                aria-invalid={Boolean(accessError)}
                aria-describedby={accessError ? 'supporters-access-error' : undefined}
                autoFocus
              />
              <button type="submit" className="primary-link">View page</button>
            </div>
            {accessError && <span id="supporters-access-error" className="supporters-gate-error" role="alert">{accessError}</span>}
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="supporters-page page-stack">
      <div className="supporters-access-bar"><span><LockKeyhole size={14} /> Private review unlocked</span><button type="button" onClick={lockPage}>Lock page</button></div>
      <section className="supporters-status panel">
        <div className="supporters-status-icon"><ShieldCheck size={24} /></div>
        <div>
          <span className="eyebrow">COMMUNITY FUND · BUILD PREVIEW</span>
          <h2>Road to the first CEX listing</h2>
          <p>This page is being prepared for the ZKAS community fundraiser. The wallet address and campaign launch must be confirmed by the ZKAS team before donations open.</p>
        </div>
        <span className="supporters-setup-pill">SETUP</span>
      </section>

      <section className="supporters-summary-grid">
        <article className="panel supporters-metric">
          <span><CircleDollarSign size={17} /> Total deposited</span>
          <b>{formatMoney(totals.deposits)} USD</b>
          <small>Verified USDC and USDT transfers</small>
        </article>
        <article className="panel supporters-metric">
          <span><ArrowUpFromLine size={17} /> Total withdrawn</span>
          <b>{formatMoney(totals.withdrawals)} USD</b>
          <small>Public outgoing transfers</small>
        </article>
        <article className="panel supporters-metric accent">
          <span><WalletCards size={17} /> Wallet balance</span>
          <b>{formatMoney(totals.balance)} USD</b>
          <small>Token-transfer balance shown by this ledger</small>
        </article>
        <article className="panel supporters-metric">
          <span><Trophy size={17} /> Genesis supporters</span>
          <b>—</b>
          <small>Team-approved supporter list pending</small>
        </article>
      </section>

      <section className="supporters-primary-grid">
        <article className="panel donation-panel">
          <div className="donation-network-banner"><ShieldCheck size={22} /><strong>ARBITRUM ONE NETWORK ONLY</strong></div>
          <div className="panel-head donation-wallet-heading">
            <div><span className="panel-icon"><WalletCards size={20} /></span><h2>Community fund wallet</h2></div>
          </div>
          <p className="donation-intro">Send USDC or USDT using Arbitrum One. Funds sent through another network may be lost.</p>
          <div className="wallet-preview">
            <div className="wallet-preview-mark"><WalletCards size={28} /></div>
            <div>
              <span>Team-supplied fundraiser address</span>
              <code>{FUNDRAISER_WALLET}</code>
            </div>
          </div>
          <div className="wallet-actions">
            <button type="button" className="primary-link" onClick={() => void copyWallet()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy address'}</button>
            <a className="secondary-link" href={BLOCKSCOUT_WALLET_URL} target="_blank" rel="noreferrer">View on Blockscout <ExternalLink size={14} /></a>
          </div>
          <div className="donation-warning"><ShieldCheck size={17} /><span><b>Do not send yet.</b> The QR code and donation flow will be activated only after the ZKAS team confirms the final address, accepted tokens and launch date.</span></div>
        </article>

        <article className="panel allocation-panel">
          <div className="panel-head"><div><span className="panel-icon"><CircleDollarSign size={20} /></span><h2>Planned use of funds</h2></div></div>
          <div className="allocation-visual" aria-label="Planned allocation: 60 percent listing fees, 30 percent liquidity, 10 percent buffer">
            <div className="allocation-ring"><span><b>100%</b><small>Community fund</small></span></div>
            <div className="allocation-legend">
              <div><i className="listing" /><span><b>60%</b> Listing fees</span></div>
              <div><i className="liquidity" /><span><b>30%</b> Liquidity</span></div>
              <div><i className="buffer" /><span><b>10%</b> Buffer</span></div>
            </div>
          </div>
          <p className="allocation-note">Withdrawal purposes cannot be determined from the blockchain alone. The ZKAS team will need to provide labels and supporting details for outgoing payments.</p>
        </article>
      </section>

      <section className="panel supporter-tiers-panel">
        <div className="panel-head">
          <div><span className="panel-icon"><Trophy size={20} /></span><h2>Genesis Supporter badge levels</h2></div>
          <span className="range-chip">VOLUNTARY DONATIONS</span>
        </div>
        <div className="supporter-tiers">
          {supporterTiers.map(({ name, minimum, icon: Icon, className }) => (
            <div className={`supporter-tier ${className}`} key={name}>
              <span className="tier-icon"><Icon size={22} /></span>
              <div><b>{name}</b><small>{minimum}+ USDC</small></div>
            </div>
          ))}
        </div>
        <p className="supporter-consent-note"><ShieldCheck size={15} /> Names and donation amounts will appear only after the campaign organizers verify the payment and confirm the supporter’s permission. Otherwise, the supporter can remain anonymous.</p>
      </section>

      <section className="two-col supporters-ledgers">
        <article className="panel table-panel supporter-list-panel">
          <div className="panel-head">
            <div><span className="panel-icon"><Trophy size={20} /></span><h2>Genesis Supporters</h2></div>
            <span className="range-chip">TEAM VERIFIED</span>
          </div>
          <div className="supporters-empty"><Trophy size={26} /><b>No supporters published yet</b><span>The ZKAS team will provide verified display names, donation totals and consent choices after the fundraiser begins.</span></div>
        </article>

        <article className="panel table-panel wallet-ledger-panel">
          <div className="panel-head wallet-ledger-head">
            <div><span className="panel-icon"><WalletCards size={20} /></span><div><h2>Live wallet activity</h2><p>{updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString()}` : 'Connecting to Arbitrum'}</p></div></div>
            <button type="button" className="ledger-refresh" onClick={() => void refresh()} aria-label="Refresh wallet activity"><RefreshCw size={15} className={feedState === 'loading' ? 'spinning' : ''} /> Refresh</button>
          </div>
          {feedState === 'error' ? (
            <div className="supporters-empty"><ShieldCheck size={26} /><b>Wallet feed temporarily unavailable</b><span>The public blockchain explorer could not be reached. No transaction data has been invented.</span></div>
          ) : transfers.length ? (
            <div className="table-scroll">
              <table>
                <thead><tr><th>Type</th><th>Amount</th><th>Address</th><th>Time</th><th>Transaction</th></tr></thead>
                <tbody>{transfers.slice(0, 50).map((row) => (
                  <tr key={row.id}>
                    <td><span className={`fund-direction ${row.direction}`}>{row.direction === 'deposit' ? <ArrowDownToLine size={13} /> : <ArrowUpFromLine size={13} />}{row.direction}</span></td>
                    <td><b>{formatMoney(row.amount)} {row.symbol}</b></td>
                    <td><code>{shortAddress(row.counterparty)}</code></td>
                    <td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '—'}</td>
                    <td><a className="hash-link" href={`https://arbitrum.blockscout.com/tx/${row.hash}`} target="_blank" rel="noreferrer">{shortAddress(row.hash)} <ExternalLink size={12} /></a></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : (
            <div className="supporters-empty"><WalletCards size={26} /><b>{feedState === 'loading' ? 'Checking the public wallet' : 'No accepted-token activity yet'}</b><span>Verified USDC and USDT deposits and withdrawals will appear here automatically after the campaign begins.</span></div>
          )}
        </article>
      </section>
    </div>
  );
}
