import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Network, ShieldCheck } from 'lucide-react';
import type { PublicNodesData } from '../api';

type NetworkGlobeProps = {
  data: PublicNodesData;
  onOpenNodes: () => void;
};

type Coordinates = readonly [latitude: number, longitude: number];

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
  TR: [39.0, 35.2], IL: [31.0, 35.0], AE: [24.3, 54.4],
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

function updatedLabel(value: number | null) {
  if (!value) return 'Live network feed';
  const timestamp = value < 10_000_000_000 ? value * 1000 : value;
  return `Updated ${new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function NetworkGlobe({ data, onOpenNodes }: NetworkGlobeProps) {
  const [rotation, setRotation] = useState(65);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; rotation: number } | null>(null);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || dragging) return;
    const timer = window.setInterval(() => setRotation((value) => (value + 0.1) % 360), 70);
    return () => window.clearInterval(timer);
  }, [dragging]);

  const countries = useMemo(
    () => [...data.countries].filter((country) => country.count > 0).sort((a, b) => b.count - a.count),
    [data.countries],
  );

  const projected = useMemo(() => countries.flatMap((country) => {
    const coordinates = COUNTRY_CENTERS[country.code.toUpperCase()];
    if (!coordinates) return [];
    const [latitude, longitude] = coordinates;
    const lat = latitude * Math.PI / 180;
    const lon = (longitude + rotation) * Math.PI / 180;
    const depth = Math.cos(lat) * Math.cos(lon);
    if (depth <= 0.02) return [];
    return [{
      ...country,
      x: 310 + 184 * Math.cos(lat) * Math.sin(lon),
      y: 220 - 184 * Math.sin(lat),
      depth,
    }];
  }).sort((a, b) => a.depth - b.depth), [countries, rotation]);

  const totalNodes = data.totals.nodes ?? data.nodes.length;
  const locatedNodes = data.totals.located ?? countries.reduce((sum, country) => sum + country.count, 0);

  return (
    <section className="network-globe-panel panel">
      <div className="network-globe-copy">
        <div className="network-globe-eyebrow"><span className="pulse-dot" /> LIVE PUBLIC NETWORK</div>
        <h2>Visible ZKAS nodes around the world</h2>
        <p>
          A privacy-safe view of the countries visible from the public explorer vantage point.
          Exact peer addresses and precise locations are never displayed.
        </p>
        <div className="network-globe-stats">
          <div><Globe2 size={18} /><span>Countries</span><b>{data.totals.countries ?? countries.length}</b></div>
          <div><Network size={18} /><span>Visible nodes</span><b>{totalNodes || '—'}</b></div>
          <div><ShieldCheck size={18} /><span>Located</span><b>{locatedNodes || '—'}</b></div>
        </div>
        <div className="network-country-list" aria-label="Visible nodes by country">
          {countries.slice(0, 8).map((country) => (
            <div key={country.code}>
              <span className="network-country-flag" aria-hidden="true">{flagEmoji(country.code)}</span>
              <span>{country.name}</span>
              <b>{country.count}</b>
            </div>
          ))}
          {!countries.length && <p>Waiting for country-level peer data.</p>}
        </div>
        <button className="network-globe-button" onClick={onOpenNodes}>View node details <span aria-hidden="true">→</span></button>
      </div>

      <div
        className={`network-globe-stage ${dragging ? 'dragging' : ''}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          drag.current = { x: event.clientX, rotation };
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          setRotation(drag.current.rotation + (event.clientX - drag.current.x) * 0.45);
        }}
        onPointerUp={() => { drag.current = null; setDragging(false); }}
        onPointerCancel={() => { drag.current = null; setDragging(false); }}
        role="img"
        aria-label={`Interactive globe showing ${totalNodes || 0} visible ZKAS nodes across ${data.totals.countries ?? countries.length} countries`}
      >
        <svg viewBox="0 0 620 450" aria-hidden="true">
          <defs>
            <radialGradient id="network-globe-fill" cx="38%" cy="30%" r="72%">
              <stop offset="0%" stopColor="#173f35" />
              <stop offset="55%" stopColor="#09251e" />
              <stop offset="100%" stopColor="#03110e" />
            </radialGradient>
            <radialGradient id="network-globe-shine" cx="32%" cy="28%" r="68%">
              <stop offset="0%" stopColor="#86ffe0" stopOpacity=".23" />
              <stop offset="48%" stopColor="#2dd4aa" stopOpacity=".05" />
              <stop offset="100%" stopColor="#00110d" stopOpacity=".55" />
            </radialGradient>
            <filter id="network-node-glow" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <clipPath id="network-globe-clip"><circle cx="310" cy="220" r="186" /></clipPath>
          </defs>

          <circle className="network-globe-aura" cx="310" cy="220" r="198" />
          <circle className="network-globe-sphere" cx="310" cy="220" r="186" fill="url(#network-globe-fill)" />
          <g className="network-globe-grid" clipPath="url(#network-globe-clip)">
            <ellipse cx="310" cy="220" rx="58" ry="186" />
            <ellipse cx="310" cy="220" rx="118" ry="186" />
            <ellipse cx="310" cy="220" rx="166" ry="186" />
            <ellipse cx="310" cy="220" rx="186" ry="58" />
            <ellipse cx="310" cy="220" rx="186" ry="118" />
            <path d="M124 220h372" />
            <path d="M310 34v372" />
          </g>
          <circle cx="310" cy="220" r="186" fill="url(#network-globe-shine)" />

          {projected.map((country) => {
            const size = Math.min(9, 4 + Math.sqrt(country.count) * 0.85);
            return (
              <g
                key={country.code}
                className="network-globe-marker"
                transform={`translate(${country.x} ${country.y})`}
                opacity={0.45 + country.depth * 0.55}
              >
                <circle className="network-globe-marker-halo" r={size + 7} filter="url(#network-node-glow)" />
                <circle className="network-globe-marker-dot" r={size} />
                <title>{country.name}: {country.count} visible node{country.count === 1 ? '' : 's'}</title>
              </g>
            );
          })}
        </svg>
        <div className="network-globe-floating-label">
          <Globe2 size={16} />
          <span>{updatedLabel(data.updatedAt)}</span>
        </div>
        <div className="network-globe-help">Drag to rotate</div>
      </div>
    </section>
  );
}
