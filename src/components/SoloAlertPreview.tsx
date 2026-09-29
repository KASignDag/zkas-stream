import { useMemo, useState } from 'react';
import {
  Bell, BellRing, CheckCircle2, Cpu, Fan, Gauge, MessageCircle, RadioTower,
  Send, ShieldCheck, Thermometer, Wifi, WifiOff, Zap
} from 'lucide-react';
import './solo-alert-preview.css';

type AlertChannel = 'browser' | 'telegram' | 'discord';

const demoMiners = [
  { name: 'IceRiver KS0 Ultra', worker: 'KSOPRO', status: 'online', hashrate: '359 GH/s', temp: 61, fan: 2870, shares: 60, uptime: '12h 42m', blocks: 0 },
  { name: 'IceRiver KS7 Lite', worker: 'KS7-LITE', status: 'agent-offline', hashrate: '4.2 TH/s', temp: null, fan: null, shares: 0, uptime: '—', blocks: 0 },
] as const;

export function SoloAlertPreview() {
  const [channels, setChannels] = useState<Record<AlertChannel, boolean>>({
    browser: true,
    telegram: true,
    discord: true,
  });
  const [browserState, setBrowserState] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [threshold, setThreshold] = useState(70);
  const [offlineMinutes, setOfflineMinutes] = useState(3);

  const enabledCount = useMemo(() => Object.values(channels).filter(Boolean).length, [channels]);

  function toggle(channel: AlertChannel) {
    setChannels((current) => ({ ...current, [channel]: !current[channel] }));
  }

  async function testBrowserAlert() {
    if (!('Notification' in window)) {
      window.alert('Browser notifications are not supported by this browser.');
      return;
    }
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;
    setBrowserState(permission === 'granted' ? 'granted' : 'denied');
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

      <section className="solo-hero-grid">
        <article className="solo-hero-card primary">
          <div className="solo-card-icon"><RadioTower size={24} /></div>
          <div><span>Connected miners</span><b>1 / 2</b><small>1 local agent currently reporting</small></div>
        </article>
        <article className="solo-hero-card">
          <div className="solo-card-icon"><Gauge size={24} /></div>
          <div><span>Total hashrate</span><b>359 GH/s</b><small>Live reported hashrate</small></div>
        </article>
        <article className="solo-hero-card">
          <div className="solo-card-icon"><BellRing size={24} /></div>
          <div><span>Alert channels</span><b>{enabledCount} enabled</b><small>Browser · Telegram · Discord</small></div>
        </article>
        <article className="solo-hero-card">
          <div className="solo-card-icon"><Zap size={24} /></div>
          <div><span>Blocks found</span><b>0</b><small>Current monitored session</small></div>
        </article>
      </section>

      <section className="solo-section">
        <div className="solo-section-head">
          <div><span>MINERS</span><h3>Community miner fleet</h3></div>
          <button className="solo-add-button">+ Pair miner</button>
        </div>

        <div className="solo-miner-grid">
          {demoMiners.map((miner) => {
            const online = miner.status === 'online';
            return (
              <article className={`solo-miner-card ${online ? 'online' : 'offline'}`} key={miner.worker}>
                <div className="solo-miner-top">
                  <div className="solo-miner-name">
                    <span className="solo-miner-avatar"><Cpu size={22} /></span>
                    <div><b>{miner.name}</b><small>{miner.worker}</small></div>
                  </div>
                  <span className={`solo-status-pill ${online ? 'online' : 'offline'}`}>
                    {online ? <Wifi size={14} /> : <WifiOff size={14} />}
                    {online ? 'ONLINE' : 'AGENT OFFLINE'}
                  </span>
                </div>

                <div className="solo-hashrate-block">
                  <span>HASHRATE</span>
                  <b>{miner.hashrate}</b>
                  <small>{online ? 'Live from local agent' : 'Last configured miner'}</small>
                </div>

                <div className="solo-miner-stats">
                  <div><Thermometer size={17} /><span>Temperature</span><b>{miner.temp === null ? '—' : `${miner.temp}°C`}</b></div>
                  <div><Fan size={17} /><span>Fan speed</span><b>{miner.fan === null ? '—' : `${miner.fan.toLocaleString()} RPM`}</b></div>
                  <div><CheckCircle2 size={17} /><span>Shares</span><b>{miner.shares}</b></div>
                  <div><RadioTower size={17} /><span>Uptime</span><b>{miner.uptime}</b></div>
                </div>

                <div className="solo-miner-footer">
                  <span>{online ? 'Last update 8 sec ago' : 'Waiting for agent heartbeat'}</span>
                  <button>View details</button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="solo-bottom-grid">
        <article className="solo-panel">
          <div className="solo-panel-head"><div><span>ALERTS</span><h3>Notification center</h3></div><Bell size={22} /></div>
          <p className="solo-muted">Choose how each miner should alert you when a block is found, a miner drops offline, or ASIC health moves outside your limits.</p>

          <div className="solo-alert-row">
            <div className="solo-alert-label"><BellRing size={19} /><div><b>Browser alerts</b><small>Desktop and mobile browser notifications</small></div></div>
            <button className={`solo-toggle ${channels.browser ? 'on' : ''}`} onClick={() => toggle('browser')} aria-label="Toggle browser alerts"><span /></button>
          </div>
          <div className="solo-alert-row">
            <div className="solo-alert-label"><Send size={19} /><div><b>Telegram</b><small>Private bot notifications</small></div></div>
            <button className={`solo-toggle ${channels.telegram ? 'on' : ''}`} onClick={() => toggle('telegram')} aria-label="Toggle Telegram alerts"><span /></button>
          </div>
          <div className="solo-alert-row">
            <div className="solo-alert-label"><MessageCircle size={19} /><div><b>Discord</b><small>DM or private channel webhook</small></div></div>
            <button className={`solo-toggle ${channels.discord ? 'on' : ''}`} onClick={() => toggle('discord')} aria-label="Toggle Discord alerts"><span /></button>
          </div>

          <button className="solo-test-button" onClick={() => void testBrowserAlert()}>
            Test browser alert
          </button>
          {browserState !== 'idle' && <div className={`solo-test-state ${browserState}`}>Browser permission: {browserState}</div>}
        </article>

        <article className="solo-panel">
          <div className="solo-panel-head"><div><span>HEALTH RULES</span><h3>ASIC protection alerts</h3></div><Thermometer size={22} /></div>
          <p className="solo-muted">These settings only create alerts. The agent is read-only and never changes miner settings.</p>

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
          <div className="solo-panel-head"><div><span>LOCAL AGENT</span><h3>Read-only ASIC bridge</h3></div><Cpu size={22} /></div>
          <div className="solo-agent-diagram">
            <div><Cpu size={21} /><b>ASIC</b><small>Local network</small></div>
            <span>→</span>
            <div><ShieldCheck size={21} /><b>Agent</b><small>Read only</small></div>
            <span>→</span>
            <div><RadioTower size={21} /><b>ZKAS.stream</b><small>Outbound HTTPS</small></div>
          </div>
          <p className="solo-muted">No router port forwarding. No remote miner control. The agent reads local miner status and sends only telemetry using a pairing token.</p>
          <div className="solo-agent-badges"><span>Temperature</span><span>Fan RPM</span><span>Hashrate</span><span>Uptime</span></div>
          <button className="solo-agent-button">Download agent — coming next</button>
        </article>
      </section>
    </div>
  );
}
