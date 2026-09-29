import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, Bell, BellRing, CheckCircle2, Coins, Cpu, Fan, Gauge, MessageCircle, RadioTower,
  Send, ShieldCheck, Thermometer, Trophy, Wifi, WifiOff, X, Zap
} from 'lucide-react';
import './solo-alert-preview.css';

type AlertChannel = 'browser' | 'telegram' | 'discord';
type MinerMode = 'basic' | 'local' | 'rental';
type Chain = 'ZKAS' | 'KAS';

type PreviewMiner = {
  name: string;
  worker: string;
  mode: MinerMode;
  status: 'online' | 'offline';
  hashrate: string;
  temp: number | null;
  fan: number | null;
  shares: number;
  uptime: string;
  zkasBlocks: number;
  kasBlocks: number;
  lastSeen: string;
};

type BlockCelebration = {
  chain: Chain;
  worker: string;
  hash: string;
  reward: string | null;
  time: string;
};

type BlockHistoryEvent = BlockCelebration & {
  id: string;
  source: 'live' | 'simulation';
  channels: AlertChannel[];
};

type CommunityMiningRow = {
  alias: string;
  status: 'online' | 'offline';
  hashrateHps: number | null;
  uptimeSeconds: number | null;
  acceptedShares: number | null;
  zkasBlocks: number | null;
  kasBlocks: number | null;
  lastSeenAt?: number | null;
};

type CommunityMiningSnapshot = {
  updatedAt: number | null;
  gatewayOnline: boolean;
  miners: CommunityMiningRow[];
  lifetimeZkasBlocks: number;
  lifetimeKasBlocks: number;
};

type NotificationReadiness = {
  browser: 'ready' | 'needs-permission';
};

const demoMiners: PreviewMiner[] = [
  {
    name: 'IceRiver KS0 Ultra',
    worker: 'KSOPRO',
    mode: 'local',
    status: 'online',
    hashrate: '359 GH/s',
    temp: 61,
    fan: 2870,
    shares: 60,
    uptime: '12h 42m',
    zkasBlocks: 0,
    kasBlocks: 0,
    lastSeen: '8 sec ago',
  },
  {
    name: 'Rental hashrate',
    worker: 'MRR-RENTAL-01',
    mode: 'rental',
    status: 'online',
    hashrate: '1.25 TH/s',
    temp: null,
    fan: null,
    shares: 184,
    uptime: '6h 18m',
    zkasBlocks: 0,
    kasBlocks: 0,
    lastSeen: '8 sec ago',
  },
];

function formatHashrate(hps: number | null) {
  if (hps === null || !Number.isFinite(hps) || hps <= 0) return '—';
  const units = ['H/s', 'KH/s', 'MH/s', 'GH/s', 'TH/s', 'PH/s'];
  let value = hps;
  let index = 0;
  while (value >= 1000 && index < units.length - 1) {
    value /= 1000;
    index += 1;
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

function formatUptime(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return '—';
  const whole = Math.floor(seconds);
  const d = Math.floor(whole / 86400);
  const h = Math.floor((whole % 86400) / 3600);
  const m = Math.floor((whole % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function ageLabel(timestamp: number | null | undefined) {
  if (!timestamp) return 'unknown';
  const ms = timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp;
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

export function SoloAlertPreview() {
  const [channels, setChannels] = useState<Record<AlertChannel, boolean>>({
    browser: true,
    telegram: true,
    discord: true,
  });
  const [browserState, setBrowserState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [threshold, setThreshold] = useState(70);
  const [offlineMinutes, setOfflineMinutes] = useState(3);
  const [mode, setMode] = useState<MinerMode>('basic');
  const [selectedMiner, setSelectedMiner] = useState<PreviewMiner | null>(null);
  const [celebration, setCelebration] = useState<BlockCelebration | null>(null);
  const [blockHistory, setBlockHistory] = useState<BlockHistoryEvent[]>([]);
  const [liveSnapshot, setLiveSnapshot] = useState<CommunityMiningSnapshot | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<NotificationReadiness>({
    browser: typeof Notification !== 'undefined' && Notification.permission === 'granted' ? 'ready' : 'needs-permission',
  });
  const [pairingOpen, setPairingOpen] = useState(false);
  const [pairingStep, setPairingStep] = useState<1 | 2 | 3>(1);
  const [pairingMode, setPairingMode] = useState<MinerMode>('basic');
  const [pairingName, setPairingName] = useState('');
  const [pairingCode] = useState(() => 'ZKAS-' + Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase());
  const previousBlocksRef = useRef<Record<string, { zkas: number; kas: number }> | null>(null);

  const enabledCount = useMemo(() => Object.values(channels).filter(Boolean).length, [channels]);

  const liveMiners = useMemo<PreviewMiner[]>(() => {
    if (!liveSnapshot?.miners?.length) return demoMiners;
    return liveSnapshot.miners.map((miner) => ({
      name: miner.alias,
      worker: miner.alias,
      mode: 'basic',
      status: miner.status,
      hashrate: formatHashrate(miner.hashrateHps),
      temp: null,
      fan: null,
      shares: Math.max(0, Math.floor(miner.acceptedShares ?? 0)),
      uptime: formatUptime(miner.uptimeSeconds),
      zkasBlocks: Math.max(0, Math.floor(miner.zkasBlocks ?? 0)),
      kasBlocks: Math.max(0, Math.floor(miner.kasBlocks ?? 0)),
      lastSeen: ageLabel(miner.lastSeenAt ?? liveSnapshot.updatedAt),
    }));
  }, [liveSnapshot]);

  const totalShares = useMemo(() => liveMiners.reduce((sum, miner) => sum + miner.shares, 0), [liveMiners]);
  const totalBlocks = (liveSnapshot?.lifetimeZkasBlocks ?? 0) + (liveSnapshot?.lifetimeKasBlocks ?? 0);
  const onlineMiners = liveMiners.filter((miner) => miner.status === 'online').length;

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    async function refresh() {
      try {
        const response = await fetch('/api/community-mining?gateway=community-107', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Live telemetry returned HTTP ${response.status}`);
        const snapshot = await response.json() as CommunityMiningSnapshot;
        if (stopped) return;

        const previous = previousBlocksRef.current;
        const next: Record<string, { zkas: number; kas: number }> = {};
        for (const miner of snapshot.miners ?? []) {
          const zkas = Math.max(0, Math.floor(miner.zkasBlocks ?? 0));
          const kas = Math.max(0, Math.floor(miner.kasBlocks ?? 0));
          next[miner.alias] = { zkas, kas };
          const prior = previous?.[miner.alias];
          if (prior && zkas > prior.zkas) {
            recordBlockEvent({
              chain: 'ZKAS',
              worker: miner.alias,
              hash: `live-event-${miner.alias}-zkas-${zkas}`,
              reward: null,
              time: new Date().toLocaleTimeString(),
            }, 'live');
          } else if (prior && kas > prior.kas) {
            recordBlockEvent({
              chain: 'KAS',
              worker: miner.alias,
              hash: `live-event-${miner.alias}-kas-${kas}`,
              reward: 'Reward shown when bridge exposes it',
              time: new Date().toLocaleTimeString(),
            }, 'live');
          }
        }
        previousBlocksRef.current = next;
        setLiveSnapshot(snapshot);
        setLiveError(null);
      } catch (error) {
        if (!stopped) setLiveError(error instanceof Error ? error.message : 'Live telemetry unavailable');
      }
    }

    void refresh();
    timer = window.setInterval(refresh, 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  function toggle(channel: AlertChannel) {
    setChannels((current) => ({ ...current, [channel]: !current[channel] }));
  }

  function recordBlockEvent(event: BlockCelebration, source: 'live' | 'simulation') {
    const activeChannels = (Object.entries(channels) as Array<[AlertChannel, boolean]>)
      .filter(([, enabled]) => enabled)
      .map(([channel]) => channel);
    setCelebration(event);
    setBlockHistory((current) => [{
      ...event,
      id: `${Date.now()}-${event.chain}-${event.worker}-${Math.random().toString(16).slice(2)}`,
      source,
      channels: activeChannels,
    }, ...current].slice(0, 25));
  }

  function simulateBlock(chain: Chain, miner = demoMiners[0]) {
    const suffix = Math.random().toString(16).slice(2, 14).padEnd(12, '0');
    recordBlockEvent({
      chain,
      worker: miner.worker,
      hash: `${chain.toLowerCase()}-preview-${suffix}`,
      reward: chain === 'KAS' ? 'Reward shown when bridge exposes it' : null,
      time: new Date().toLocaleTimeString(),
    }, 'simulation');
  }

  async function testBrowserAlert() {
    if (typeof Notification === 'undefined') {
      globalThis.alert?.('Browser notifications are not supported by this browser.');
      return;
    }
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    setBrowserState(permission === 'granted' ? 'granted' : 'denied');
    setReadiness((current) => ({ ...current, browser: permission === 'granted' ? 'ready' : 'needs-permission' }));
    if (permission === 'granted') {
      new Notification('ZKAS Solo Alert test', {
        body: 'KSOPRO is online · 359 GH/s · 61°C · 2,870 RPM',
      });
    }
  }

  return (
    <div className="solo-alert-preview">
      <section className="solo-preview-banner">
        <div>
          <span className="solo-preview-kicker"><ShieldCheck size={16} /> COMMUNITY MINER PREVIEW</span>
          <h2>ZKAS Solo Alert</h2>
          <p>One dashboard for solo miners: live status, hashrate, shares, block alerts and optional ASIC health telemetry from a local read-only agent.</p>
        </div>
        <div className="solo-preview-live"><span /> Preview only · current mining page unchanged</div>
      </section>

      <section className="solo-section solo-setup-section">
        <div className="solo-section-head">
          <div><span>QUICK SETUP</span><h3>How are you mining?</h3></div>
          <div className="solo-optional-pill">ASIC telemetry is optional</div>
        </div>
        <p className="solo-muted">Solo Alert works without direct ASIC access. Pick the setup that matches you now—you can change it later.</p>
        <div className="solo-mode-grid">
          <button className={`solo-mode-card ${mode === 'basic' ? 'selected' : ''}`} onClick={() => setMode('basic')}>
            <span className="solo-mode-icon"><BellRing size={23} /></span>
            <b>Basic Solo Alert</b>
            <small>Best for the easiest setup. Monitor bridge status, workers, shares and block events.</small>
            <em>Recommended starting point</em>
          </button>
          <button className={`solo-mode-card ${mode === 'local' ? 'selected' : ''}`} onClick={() => setMode('local')}>
            <span className="solo-mode-icon"><Cpu size={23} /></span>
            <b>Local ASIC + Health</b>
            <small>Add the optional read-only agent for temperature, fan RPM and richer hardware telemetry.</small>
            <em>Advanced · optional</em>
          </button>
          <button className={`solo-mode-card ${mode === 'rental' ? 'selected' : ''}`} onClick={() => setMode('rental')}>
            <span className="solo-mode-icon"><RadioTower size={23} /></span>
            <b>Rental / Remote Hashrate</b>
            <small>No ASIC access required. Track the bridge, shares and block alerts without temperature or fan data.</small>
            <em>MRR / remote friendly</em>
          </button>
        </div>
        <div className="solo-mode-note">
          <CheckCircle2 size={17} />
          {mode === 'basic' && <span><b>Basic mode selected.</b> You can start with only the existing Dual Alert bridge telemetry.</span>}
          {mode === 'local' && <span><b>Local ASIC mode selected.</b> Hardware telemetry will be added only after the miner is paired with the read-only agent.</span>}
          {mode === 'rental' && <span><b>Rental mode selected.</b> Hardware fields stay hidden and do not generate missing-telemetry warnings.</span>}
        </div>
      </section>

      <section className="solo-hero-grid">
        <article className="solo-hero-card primary">
          <div className="solo-card-icon"><RadioTower size={24} /></div>
          <div><span>Connected miners</span><b>{onlineMiners} / {liveMiners.length}</b><small>{liveSnapshot ? 'Live Community Bridge telemetry' : 'Preview data until live feed connects'}</small></div>
        </article>
        <article className="solo-hero-card">
          <div className="solo-card-icon"><Gauge size={24} /></div>
          <div><span>Accepted shares</span><b>{totalShares.toLocaleString()}</b><small>Live bridge-reported total</small></div>
        </article>
        <article className="solo-hero-card">
          <div className="solo-card-icon"><BellRing size={24} /></div>
          <div><span>Alert channels</span><b>{enabledCount} enabled</b><small>Browser · Telegram · Discord</small></div>
        </article>
        <article className="solo-hero-card solo-block-card">
          <div className="solo-card-icon"><Zap size={24} /></div>
          <div><span>Blocks found</span><b>{totalBlocks.toLocaleString()}</b><small>ZKAS + KAS lifetime counters</small></div>
          <button className="solo-mini-action" onClick={() => simulateBlock('ZKAS')}>Test block</button>
        </article>
      </section>

      <section className="solo-section">
        <div className="solo-section-head">
          <div><span>MINERS</span><h3>Community miner fleet</h3></div>
          <button className="solo-add-button" onClick={() => { setPairingStep(1); setPairingOpen(true); }}>+ Pair miner</button>
        </div>

        <div className="solo-miner-grid">
          {liveMiners.map((miner) => {
            const online = miner.status === 'online';
            const hasAsicTelemetry = miner.mode === 'local' && miner.temp !== null && miner.fan !== null;
            return (
              <article className={`solo-miner-card ${online ? 'online' : 'offline'}`} key={miner.worker}>
                <div className="solo-miner-top">
                  <div className="solo-miner-name">
                    <span className="solo-miner-avatar"><Cpu size={22} /></span>
                    <div><b>{miner.name}</b><small>{miner.worker}</small></div>
                  </div>
                  <span className={`solo-status-pill ${online ? 'online' : 'offline'}`}>
                    {online ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {online ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                <div className="solo-hashrate-block">
                  <span>HASHRATE</span>
                  <b>{miner.hashrate}</b>
                  <small>{miner.mode === 'local' ? 'Bridge + optional ASIC telemetry' : 'Bridge telemetry · no ASIC access required'}</small>
                </div>

                <div className="solo-miner-stats">
                  {hasAsicTelemetry && <>
                    <div><Thermometer size={17} /><span>Temperature</span><b>{miner.temp}°C</b></div>
                    <div><Fan size={17} /><span>Fan speed</span><b>{miner.fan === null ? '—' : `${miner.fan.toLocaleString()} RPM`}</b></div>
                  </>}
                  {!hasAsicTelemetry && <div className="solo-telemetry-optional"><ShieldCheck size={17} /><span>ASIC telemetry</span><b>Not required</b></div>}
                  <div><CheckCircle2 size={17} /><span>Shares</span><b>{miner.shares}</b></div>
                  <div><RadioTower size={17} /><span>Uptime</span><b>{miner.uptime}</b></div>
                </div>

                <div className="solo-miner-footer">
                  <span>{miner.mode === 'local' ? `Bridge + ASIC update ${miner.lastSeen}` : `Bridge update ${miner.lastSeen}`}</span>
                  <button onClick={() => setSelectedMiner(miner)}>View details</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="solo-section solo-block-center">
        <div className="solo-section-head">
          <div><span>BLOCK CENTER</span><h3>Block alerts & history</h3></div>
          <div className="solo-block-actions">
            <button onClick={() => simulateBlock('ZKAS')}><Trophy size={16} /> Simulate ZKAS block</button>
            <button onClick={() => simulateBlock('KAS')}><Coins size={16} /> Simulate KAS block</button>
          </div>
        </div>
        <div className="solo-block-center-grid">
          <div className="solo-block-stat">
            <span>ZKAS BLOCKS</span>
            <b>{(liveSnapshot?.lifetimeZkasBlocks ?? 0).toLocaleString()}</b>
            <small>Preserved lifetime counter</small>
          </div>
          <div className="solo-block-stat">
            <span>KAS BLOCKS</span>
            <b>{(liveSnapshot?.lifetimeKasBlocks ?? 0).toLocaleString()}</b>
            <small>Preserved lifetime counter</small>
          </div>
          <div className="solo-block-stat">
            <span>LAST BLOCK</span>
            <b>—</b>
            <small>No block detected in this preview session</small>
          </div>
          <div className="solo-block-stat">
            <span>ALERT DELIVERY</span>
            <b>{enabledCount}/3</b>
            <small>Enabled notification channels</small>
          </div>
        </div>
        <div className={`solo-history-empty ${liveSnapshot ? 'live' : ''}`}>
          <Activity size={20} />
          <div>
            <b>{liveSnapshot ? 'Live Community Bridge feed connected' : 'Connecting to live Community Bridge telemetry'}</b>
            <span>{liveSnapshot ? `Last update ${ageLabel(liveSnapshot.updatedAt)} · ${liveSnapshot.miners.length} worker records` : (liveError ?? 'Waiting for the first telemetry snapshot.')}</span>
          </div>
        </div>
        {blockHistory.length > 0 && (
          <div className="solo-event-table" aria-label="Recent Solo Alert events">
            {blockHistory.map((event) => (
              <div className="solo-event-row" key={event.id}>
                <span className={`solo-chain-chip ${event.chain.toLowerCase()}`}>{event.chain}</span>
                <div className="solo-event-main">
                  <b>{event.worker}</b>
                  <small>{event.source === 'live' ? 'Live block counter increase' : 'Preview simulation'} · {event.time}</small>
                </div>
                <div className="solo-event-channels">
                  {event.channels.includes('browser') && <span><Bell size={13} /> Browser</span>}
                  {event.channels.includes('telegram') && <span><Send size={13} /> Telegram</span>}
                  {event.channels.includes('discord') && <span><MessageCircle size={13} /> Discord</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="solo-bottom-grid">
        <article className="solo-panel">
          <div className="solo-panel-head"><div><span>ALERTS</span><h3>Notification center</h3></div><Bell size={22} /></div>
          <p className="solo-muted">Choose how each miner should alert you when a block is found or the mining bridge goes offline. ASIC health alerts appear only when optional hardware telemetry is enabled.</p>

          <div className="solo-alert-row">
            <div className="solo-alert-label"><BellRing size={19} /><div><b>Browser alerts</b><small>Desktop and mobile browser notifications · {readiness.browser === 'ready' ? 'Ready' : 'Permission needed'}</small></div></div>
            <button className={`solo-toggle ${channels.browser ? 'on' : ''}`} onClick={() => toggle('browser')} aria-label="Toggle browser alerts"><span /></button>
          </div>
          <div className="solo-alert-row">
            <div className="solo-alert-label"><Send size={19} /><div><b>Telegram</b><small>Private bot notifications · configured in Dual Alert locally</small></div></div>
            <button className={`solo-toggle ${channels.telegram ? 'on' : ''}`} onClick={() => toggle('telegram')} aria-label="Toggle Telegram alerts"><span /></button>
          </div>
          <div className="solo-alert-row">
            <div className="solo-alert-label"><MessageCircle size={19} /><div><b>Discord</b><small>Webhook notifications · configured in Dual Alert locally</small></div></div>
            <button className={`solo-toggle ${channels.discord ? 'on' : ''}`} onClick={() => toggle('discord')} aria-label="Toggle Discord alerts"><span /></button>
          </div>

          <div className="solo-alert-actions">
            <button className="solo-test-button" onClick={() => void testBrowserAlert()}>
              Test browser alert
            </button>
            <button className="solo-local-settings-button" onClick={() => window.open('http://127.0.0.1:3040', '_blank', 'noopener,noreferrer')}>
              Open local Dual Alert settings
            </button>
          </div>
          {browserState !== 'idle' && <div className={`solo-test-state ${browserState}`}>Browser permission: {browserState}</div>}
          <div className="solo-security-note"><ShieldCheck size={15} /><span>Telegram bot tokens and Discord webhook URLs never enter ZKAS.stream. They stay inside your local Dual Alert installation.</span></div>
        </article>

        <article className="solo-panel">
          <div className="solo-panel-head"><div><span>OPTIONAL HEALTH RULES</span><h3>ASIC protection alerts</h3></div><Thermometer size={22} /></div>
          <p className="solo-muted">Optional for locally accessible ASICs. Rental and basic users can ignore this section completely. The agent is read-only and never changes miner settings.</p>

          <label className="solo-range-row">
            <div><b>Temperature warning</b><span>Alert above {threshold}°C</span></div>
            <input type="range" min="55" max="90" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>

          <label className="solo-range-row">
            <div><b>Offline warning</b><span>Alert after {offlineMinutes} minute{offlineMinutes === 1 ? '' : 's'}</span></div>
            <input type="range" min="1" max="15" value={offlineMinutes} onChange={(e) => setOfflineMinutes(Number(e.target.value))} />
          </label>

          <div className="solo-rule-list">
            <div><CheckCircle2 size={16} /><span>Block found</span><b>Instant</b></div>
            <div><CheckCircle2 size={16} /><span>Hashrate drop</span><b>Planned</b></div>
            <div><CheckCircle2 size={16} /><span>Fan failure</span><b>Agent telemetry</b></div>
          </div>
        </article>

        <article className="solo-panel agent">
          <div className="solo-panel-head"><div><span>OPTIONAL LOCAL AGENT</span><h3>Read-only ASIC telemetry</h3></div><Cpu size={22} /></div>
          <div className="solo-agent-diagram">
            <div><Cpu size={21} /><b>ASIC</b><small>Local network</small></div>
            <span>→</span>
            <div><ShieldCheck size={21} /><b>Agent</b><small>Read only</small></div>
            <span>→</span>
            <div><RadioTower size={21} /><b>ZKAS.stream</b><small>Outbound HTTPS</small></div>
          </div>
          <p className="solo-muted">Only install this if you want hardware health data. No router port forwarding and no remote miner control. Rental miners do not need this agent.</p>
          <div className="solo-agent-badges"><span>Temperature</span><span>Fan RPM</span><span>Hashrate</span><span>Uptime</span></div>
          <button className="solo-agent-button">Download agent — coming next</button>
        </article>
      </section>

      {pairingOpen && (
        <div className="solo-modal-backdrop" role="presentation" onMouseDown={() => setPairingOpen(false)}>
          <section className="solo-detail-modal solo-pair-modal" role="dialog" aria-modal="true" aria-label="Pair a miner" onMouseDown={(event) => event.stopPropagation()}>
            <button className="solo-close-button" onClick={() => setPairingOpen(false)} aria-label="Close pairing"><X size={20} /></button>
            <div className="solo-pair-progress">
              <span className={pairingStep >= 1 ? 'active' : ''}>1</span><i />
              <span className={pairingStep >= 2 ? 'active' : ''}>2</span><i />
              <span className={pairingStep >= 3 ? 'active' : ''}>3</span>
            </div>

            {pairingStep === 1 && <>
              <span className="solo-preview-kicker">PAIR MINER · STEP 1</span>
              <h3 className="solo-pair-title">Choose your mining setup</h3>
              <p className="solo-muted">You do not need ASIC access to use Solo Alert.</p>
              <div className="solo-mode-grid">
                <button className={`solo-mode-card ${pairingMode === 'basic' ? 'selected' : ''}`} onClick={() => setPairingMode('basic')}>
                  <span className="solo-mode-icon"><BellRing size={23} /></span><b>Basic</b><small>Blocks, workers, shares and bridge status.</small><em>Easiest</em>
                </button>
                <button className={`solo-mode-card ${pairingMode === 'local' ? 'selected' : ''}`} onClick={() => setPairingMode('local')}>
                  <span className="solo-mode-icon"><Cpu size={23} /></span><b>Local ASIC</b><small>Add optional temperature and fan monitoring.</small><em>Advanced</em>
                </button>
                <button className={`solo-mode-card ${pairingMode === 'rental' ? 'selected' : ''}`} onClick={() => setPairingMode('rental')}>
                  <span className="solo-mode-icon"><RadioTower size={23} /></span><b>Rental / Remote</b><small>No ASIC login or local miner access needed.</small><em>Rental friendly</em>
                </button>
              </div>
              <div className="solo-pair-footer"><span /><button onClick={() => setPairingStep(2)}>Continue</button></div>
            </>}

            {pairingStep === 2 && <>
              <span className="solo-preview-kicker">PAIR MINER · STEP 2</span>
              <h3 className="solo-pair-title">Name this miner</h3>
              <p className="solo-muted">Use a simple label you will recognize. Do not enter a wallet seed phrase, private key, or miner password.</p>
              <label className="solo-pair-field">
                <span>Miner / worker label</span>
                <input value={pairingName} onChange={(event) => setPairingName(event.target.value.slice(0, 32))} placeholder="Example: Basement KS0 Ultra" />
              </label>
              <div className="solo-safe-box"><ShieldCheck size={20} /><div><b>Safe by design</b><span>Pairing is for read-only monitoring. Solo Alert never needs spending keys or remote miner control.</span></div></div>
              <div className="solo-pair-footer"><button className="secondary" onClick={() => setPairingStep(1)}>Back</button><button disabled={!pairingName.trim()} onClick={() => setPairingStep(3)}>Continue</button></div>
            </>}

            {pairingStep === 3 && <>
              <span className="solo-preview-kicker">PAIR MINER · STEP 3</span>
              <h3 className="solo-pair-title">Connect Solo Alert</h3>
              <p className="solo-muted">This preview shows the pairing experience. The production version will exchange this one-time code for a miner-specific token instead of sharing the site-wide ingest secret.</p>
              <div className="solo-pair-code">
                <span>ONE-TIME PAIRING CODE</span>
                <b>{pairingCode}</b>
                <small>Preview code only · not active yet</small>
              </div>
              <div className="solo-pair-instructions">
                <div><span>1</span><p>Install or update <b>ZKas Dual Alert</b> on the bridge PC.</p></div>
                <div><span>2</span><p>Open the local dashboard at <b>127.0.0.1:3040</b>.</p></div>
                <div><span>3</span><p>Enter the pairing code under <b>ZKAS.stream Community Dashboard</b>.</p></div>
                {pairingMode === 'local' && <div><span>4</span><p>Optionally enable the read-only ASIC health agent for temperature and fans.</p></div>}
              </div>
              <div className="solo-safe-box"><ShieldCheck size={20} /><div><b>Per-miner access</b><span>The final pairing service will issue a separate token for this miner so community users cannot access each other's telemetry.</span></div></div>
              <div className="solo-pair-footer"><button className="secondary" onClick={() => setPairingStep(2)}>Back</button><button onClick={() => setPairingOpen(false)}>Finish preview</button></div>
            </>}
          </section>
        </div>
      )}

      {selectedMiner && (
        <div className="solo-modal-backdrop" role="presentation" onMouseDown={() => setSelectedMiner(null)}>
          <section className="solo-detail-modal" role="dialog" aria-modal="true" aria-label={`${selectedMiner.worker} miner details`} onMouseDown={(event) => event.stopPropagation()}>
            <button className="solo-close-button" onClick={() => setSelectedMiner(null)} aria-label="Close miner details"><X size={20} /></button>
            <div className="solo-detail-heading">
              <span className="solo-miner-avatar"><Cpu size={25} /></span>
              <div><span className="solo-preview-kicker">MINER DETAIL</span><h3>{selectedMiner.name}</h3><p>{selectedMiner.worker}</p></div>
              <span className="solo-status-pill online"><Wifi size={14} /> ONLINE</span>
            </div>

            <div className="solo-detail-metrics">
              <div><span>HASHRATE</span><b>{selectedMiner.hashrate}</b><small>Latest reported rate</small></div>
              <div><span>SHARES</span><b>{selectedMiner.shares.toLocaleString()}</b><small>Bridge-reported total</small></div>
              <div><span>UPTIME</span><b>{selectedMiner.uptime}</b><small>Bridge uptime</small></div>
              <div><span>LAST SEEN</span><b>{selectedMiner.lastSeen}</b><small>Latest telemetry</small></div>
            </div>

            <div className="solo-detail-columns">
              <div className="solo-detail-panel">
                <div className="solo-panel-head"><div><span>BLOCKS</span><h3>Solo mining events</h3></div><Trophy size={21} /></div>
                <div className="solo-detail-list">
                  <div><span>ZKAS blocks</span><b>{selectedMiner.zkasBlocks}</b></div>
                  <div><span>KAS blocks</span><b>{selectedMiner.kasBlocks}</b></div>
                  <div><span>KAS reward</span><b>When available</b></div>
                  <div><span>Source</span><b>Dual Alert bridge</b></div>
                </div>
                <div className="solo-detail-test-actions">
                  <button onClick={() => simulateBlock('ZKAS', selectedMiner)}><Trophy size={16} /> Test ZKAS</button>
                  <button onClick={() => simulateBlock('KAS', selectedMiner)}><Coins size={16} /> Test KAS</button>
                </div>
              </div>

              <div className="solo-detail-panel">
                <div className="solo-panel-head"><div><span>ASIC HEALTH</span><h3>{selectedMiner.mode === 'local' ? 'Optional hardware telemetry' : 'No hardware access needed'}</h3></div><Thermometer size={21} /></div>
                {selectedMiner.mode === 'local' ? (
                  <div className="solo-health-gauges">
                    <div><Thermometer size={18} /><span>Temperature</span><b>{selectedMiner.temp ?? '—'}{selectedMiner.temp !== null ? '°C' : ''}</b></div>
                    <div><Fan size={18} /><span>Fan</span><b>{selectedMiner.fan === null ? '—' : `${selectedMiner.fan.toLocaleString()} RPM`}</b></div>
                  </div>
                ) : (
                  <div className="solo-no-telemetry"><ShieldCheck size={22} /><div><b>ASIC telemetry is optional</b><span>This worker can use Solo Alert without miner login, temperature, fan or hashboard access.</span></div></div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {celebration && (
        <div className="solo-block-overlay" role="dialog" aria-modal="true" aria-label={`${celebration.chain} block found preview`}>
          <div className="solo-confetti" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /></div>
          <section className={`solo-block-celebration ${celebration.chain.toLowerCase()}`}>
            <button className="solo-celebration-close" onClick={() => setCelebration(null)} aria-label="Close block alert"><X size={22} /></button>
            <div className="solo-trophy-ring"><Trophy size={52} /></div>
            <span className="solo-block-kicker">SOLO ALERT</span>
            <h2>{celebration.chain} BLOCK FOUND!</h2>
            <p>Your miner just reported a new {celebration.chain} block event.</p>
            <div className="solo-celebration-grid">
              <div><span>WORKER</span><b>{celebration.worker}</b></div>
              <div><span>TIME</span><b>{celebration.time}</b></div>
              <div className="wide"><span>BLOCK HASH / EVENT ID</span><b>{celebration.hash}</b></div>
              {celebration.reward && <div className="wide"><span>KAS REWARD</span><b>{celebration.reward}</b></div>}
            </div>
            <div className="solo-delivery-row">
              <span className={channels.browser ? 'sent' : ''}><Bell size={15} /> Browser</span>
              <span className={channels.telegram ? 'sent' : ''}><Send size={15} /> Telegram</span>
              <span className={channels.discord ? 'sent' : ''}><MessageCircle size={15} /> Discord</span>
            </div>
            <small>Preview simulation only — no mining counters or real block state were changed.</small>
          </section>
        </div>
      )}
    </div>
  );
}
