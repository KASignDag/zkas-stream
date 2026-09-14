import { useMemo, useState } from 'react';
import { Globe2, MapPin, Network, ShieldCheck } from 'lucide-react';
import type { PublicNodeRow, PublicNodesData } from '../api';

type NetworkMapProps = {
  data: PublicNodesData;
  onOpenNodes: () => void;
};

type Coordinates = readonly [latitude: number, longitude: number];

type MapNode = PublicNodeRow & {
  key: string;
  country: string;
  code: string;
  x: number;
  y: number;
};

const COUNTRY_CENTERS: Record<string, Coordinates> = {
  US: [39.8, -98.6], CA: [56.1, -106.3], MX: [23.6, -102.5],
  BR: [-10.3, -53.2], AR: [-38.4, -63.6], CL: [-33.4, -70.7],
  CO: [4.6, -74.1], PE: [-9.2, -75.0], VE: [6.4, -66.6],
  UY: [-32.5, -55.8], PY: [-23.4, -58.4], BO: [-16.3, -63.6],
  EC: [-1.8, -78.2], CR: [9.7, -84.2], PA: [8.5, -80.8],
  GT: [15.8, -90.2], GB: [54.7, -3.4], IE: [53.1, -8.2],
  FR: [46.2, 2.2], DE: [51.2, 10.4], BE: [50.6, 4.7],
  NL: [52.1, 5.3], LU: [49.8, 6.1], CH: [46.8, 8.2],
  AT: [47.5, 14.6], IT: [42.8, 12.8], ES: [40.3, -3.7],
  PT: [39.6, -8.0], DK: [56.0, 9.5], NO: [61.0, 8.5],
  SE: [62.0, 15.0], FI: [64.0, 26.0], IS: [64.9, -18.6],
  PL: [52.1, 19.4], CZ: [49.8, 15.5], SK: [48.7, 19.7],
  HU: [47.2, 19.5], RO: [45.9, 24.9], BG: [42.7, 25.5],
  GR: [39.0, 22.0], HR: [45.1, 15.2], SI: [46.1, 14.8],
  RS: [44.0, 20.8], BA: [44.2, 17.7], AL: [41.2, 20.2],
  MK: [41.6, 21.7], EE: [58.6, 25.0], LV: [57.0, 24.6],
  LT: [55.2, 23.9], UA: [49.0, 31.4], RU: [61.5, 90.0],
  TR: [39.0, 35.2], IL: [31.0, 35.0], OM: [20.6, 56.1], AE: [24.3, 54.4],
  SA: [24.0, 45.0], IN: [22.8, 79.0], PK: [30.4, 69.3],
  BD: [23.7, 90.4], LK: [7.9, 80.8], NP: [28.4, 84.1],
  CN: [35.9, 104.2], JP: [36.2, 138.3], KR: [36.4, 127.9],
  TW: [23.7, 121.0], HK: [22.3, 114.2], SG: [1.35, 103.8],
  MY: [4.2, 102.0], ID: [-2.5, 118.0], TH: [15.9, 101.0],
  VN: [16.2, 107.8], PH: [12.9, 121.8], AU: [-25.3, 133.8],
  NZ: [-41.0, 174.0], ZA: [-30.6, 22.9], EG: [26.8, 30.8],
  NG: [9.1, 8.7], KE: [0.2, 37.9], MA: [31.8, -7.1],
  DZ: [28.0, 1.7], TN: [34.0, 9.0], GH: [7.9, -1.0],
};

function flagEmoji(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return '●';
  return String.fromCodePoint(...[...normalized].map((letter) => 127397 + letter.charCodeAt(0)));
}

function short(value: string, length = 7) {
  return value.length > length * 2 ? `${value.slice(0, length)}…${value.slice(-length)}` : value;
}

function updatedLabel(value: number | null) {
  if (!value) return 'Live network feed';
  const timestamp = value < 10_000_000_000 ? value * 1000 : value;
  return `Updated ${new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function jitter(id: string, index: number, code: string): Coordinates {
  let hash = 2166136261;
  for (const char of `${id}-${index}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const angle = ((hash >>> 0) % 360) * Math.PI / 180;
  const ring = 0.35 + (((hash >>> 9) % 100) / 100) * 0.65;
  const largeCountry = ['US', 'CA', 'BR', 'RU', 'CN', 'AU', 'IN'].includes(code);
  const radius = largeCountry ? 8.5 : 2.1;
  return [Math.sin(angle) * radius * ring * 0.55, Math.cos(angle) * radius * ring];
}

function project(latitude: number, longitude: number) {
  return {
    x: ((longitude + 180) / 360) * 1000,
    y: ((90 - latitude) / 180) * 500,
  };
}

function nodeDirection(node: PublicNodeRow) {
  if (node.outbound === null) return 'Direction unavailable';
  return node.outbound ? 'Outbound connection' : 'Inbound connection';
}

export function NetworkMap({ data, onOpenNodes }: NetworkMapProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const mapNodes = useMemo(() => {
    const counts = new Map<string, number>();
    return data.nodes.flatMap((node, index): MapNode[] => {
      const code = (node.countryCode || '').toUpperCase();
      const center = COUNTRY_CENTERS[code];
      if (!center) return [];
      const countryIndex = counts.get(code) || 0;
      counts.set(code, countryIndex + 1);
      const [latOffset, lonOffset] = jitter(node.id, countryIndex, code);
      const point = project(center[0] + latOffset, center[1] + lonOffset);
      return [{
        ...node,
        key: `${node.id}-${index}`,
        code,
        country: node.countryName || data.countries.find((row) => row.code.toUpperCase() === code)?.name || code,
        ...point,
      }];
    });
  }, [data.countries, data.nodes]);

  const active = mapNodes.find((node) => node.key === activeKey) || null;
  const totalNodes = data.totals.nodes ?? data.nodes.length;
  const locatedNodes = data.totals.located ?? mapNodes.length;

  return (
    <section className="network-map-panel panel">
      <header className="network-map-head">
        <div>
          <div className="network-map-eyebrow"><span className="pulse-dot" /> LIVE PUBLIC NETWORK MAP</div>
          <h2>Visible ZKAS nodes worldwide</h2>
          <p>Each marker represents a visible peer. Locations are approximate at country level to protect node operators.</p>
        </div>
        <div className="network-map-stats">
          <div><Globe2 size={17} /><span>Countries</span><b>{data.totals.countries ?? data.countries.length}</b></div>
          <div><Network size={17} /><span>Visible nodes</span><b>{totalNodes || '—'}</b></div>
          <div><ShieldCheck size={17} /><span>Located</span><b>{locatedNodes || '—'}</b></div>
        </div>
      </header>

      <div className="network-map-stage">
        <svg viewBox="0 0 1000 500" role="img" aria-label={`Map showing ${mapNodes.length} approximately located ZKAS nodes`}>
          <defs>
            <linearGradient id="network-map-ocean" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#061b17" />
              <stop offset="100%" stopColor="#03110e" />
            </linearGradient>
            <linearGradient id="network-map-land" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1b5548" />
              <stop offset="100%" stopColor="#10372f" />
            </linearGradient>
            <filter id="network-map-glow" x="-200%" y="-200%" width="500%" height="500%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect className="network-map-ocean" width="1000" height="500" rx="22" fill="url(#network-map-ocean)" />
          <g className="network-map-grid">
            <path d="M0 83.3H1000M0 166.6H1000M0 250H1000M0 333.3H1000M0 416.6H1000" />
            <path d="M125 0V500M250 0V500M375 0V500M500 0V500M625 0V500M750 0V500M875 0V500" />
          </g>

          <g className="network-map-land" fill="url(#network-map-land)">
            <path d="M43 105L75 67 139 47 211 63 247 93 282 107 300 139 280 169 250 174 224 203 198 214 183 252 149 260 125 228 91 216 72 181 47 159 31 129Z" />
            <path d="M182 266L218 250 261 267 287 301 281 342 303 373 285 416 257 467 231 445 225 395 204 358 198 315Z" />
            <path d="M329 37L376 18 424 32 438 65 408 89 362 86 335 67Z" />
            <path d="M439 125L469 105 505 111 527 133 559 139 569 163 541 176 516 170 498 184 466 176 445 154Z" />
            <path d="M466 190L505 176 552 195 580 233 570 283 548 318 526 377 491 371 477 333 452 304 449 258 433 224Z" />
            <path d="M536 111L588 75 663 62 726 77 789 72 858 96 930 126 952 162 918 188 873 181 835 211 798 207 770 235 733 224 699 194 657 200 622 175 579 169 552 146Z" />
            <path d="M612 211L642 202 665 222 650 248 627 243Z" />
            <path d="M741 240L762 222 787 247 783 278 762 290 746 270Z" />
            <path d="M793 350L835 329 900 342 930 376 910 421 854 439 808 416 779 381Z" />
            <path d="M947 420L967 410 982 431 963 451 945 439Z" />
            <path d="M589 388L607 402 600 435 581 421Z" />
          </g>

          <g className="network-map-coastline">
            <path d="M43 105L75 67 139 47 211 63 247 93 282 107 300 139 280 169 250 174 224 203 198 214 183 252 149 260 125 228 91 216 72 181 47 159 31 129Z" />
            <path d="M182 266L218 250 261 267 287 301 281 342 303 373 285 416 257 467 231 445 225 395 204 358 198 315Z" />
            <path d="M439 125L469 105 505 111 527 133 559 139 569 163 541 176 516 170 498 184 466 176 445 154Z" />
            <path d="M466 190L505 176 552 195 580 233 570 283 548 318 526 377 491 371 477 333 452 304 449 258 433 224Z" />
            <path d="M536 111L588 75 663 62 726 77 789 72 858 96 930 126 952 162 918 188 873 181 835 211 798 207 770 235 733 224 699 194 657 200 622 175 579 169 552 146Z" />
            <path d="M793 350L835 329 900 342 930 376 910 421 854 439 808 416 779 381Z" />
          </g>

          <g className="network-map-markers">
            {mapNodes.map((node) => (
              <g
                key={node.key}
                className={`network-map-marker ${activeKey === node.key ? 'active' : ''}`}
                transform={`translate(${node.x} ${node.y})`}
                role="button"
                tabIndex={0}
                aria-label={`${node.country}, approximate node location`}
                onMouseEnter={() => setActiveKey(node.key)}
                onMouseLeave={() => setActiveKey(null)}
                onFocus={() => setActiveKey(node.key)}
                onBlur={() => setActiveKey(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  setActiveKey((current) => current === node.key ? null : node.key);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveKey((current) => current === node.key ? null : node.key);
                  }
                }}
              >
                <circle className="network-map-marker-pulse" r="10" filter="url(#network-map-glow)" />
                <circle className="network-map-marker-dot" r="4.5" />
              </g>
            ))}
          </g>
        </svg>

        {active && (
          <div
            className="network-map-popup"
            style={{
              left: `${Math.min(88, Math.max(12, active.x / 10))}%`,
              top: `${Math.min(90, Math.max(10, active.y / 5))}%`,
              transform: active.y < 150 ? 'translate(-50%, 15px)' : 'translate(-50%, calc(-100% - 15px))',
            }}
          >
            <div><span className="network-map-popup-flag">{flagEmoji(active.code)}</span><b>{active.country}</b></div>
            <small><MapPin size={12} /> Approximate country location</small>
            <dl>
              <div><dt>Peer</dt><dd>{short(active.id)}</dd></div>
              <div><dt>Connection</dt><dd>{nodeDirection(active)}</dd></div>
              {active.pingMs !== null && <div><dt>Ping</dt><dd>{Math.round(active.pingMs)} ms</dd></div>}
              {active.userAgent && <div><dt>Client</dt><dd>{active.userAgent}</dd></div>}
            </dl>
          </div>
        )}
      </div>

      <footer className="network-map-foot">
        <span><ShieldCheck size={14} /> Country-level positioning—not exact coordinates</span>
        <span>{updatedLabel(data.updatedAt)}</span>
        <button onClick={onOpenNodes}>View all node details <span aria-hidden="true">→</span></button>
      </footer>
    </section>
  );
}
