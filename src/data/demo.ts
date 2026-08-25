import type { DashboardData } from '../api';

const now = Date.now();
const hash = (n: number) => `${n.toString(16).padStart(8, '0')}a3f1b9d7c56e90814c12a4429f031cd8a33c7db5b7b71ed8f54ef1a9`;

const demoNodes = [
  ['peer-a8f2', 'US', 'United States', '68.132.22.0/24', '/zkas:0.2.0/', 1, 36, true, 68340, 124, false, false],
  ['peer-32bd', 'DE', 'Germany', '185.44.18.0/24', '/zkas:0.2.0/', 1, 58, false, 51220, 91, false, false],
  ['peer-cc18', 'NL', 'Netherlands', '45.84.11.0/24', '/zkas:0.2.0/', 1, 48, true, 41410, 77, false, false],
  ['peer-942e', 'CA', 'Canada', '142.88.7.0/24', '/zkas:0.2.0/', 1, 62, false, 39220, 64, false, false],
  ['peer-b6aa', 'GB', 'United Kingdom', '51.77.90.0/24', '/zkas:0.2.0/', 1, 74, true, 31880, 51, false, false],
  ['peer-7cd1', 'FR', 'France', '92.18.31.0/24', '/zkas:0.2.0/', 1, 81, false, 24480, 38, false, false],
] as const;

export const demoDashboard: DashboardData = {
  source: 'demo',
  updatedAt: now,
  network: 'zkas-mainnet',
  bps: 1.02,
  nodes: 18,
  mempool: 3,
  hashrate: null,
  difficulty: 281_000_000,
  blockCount: 4_927_441,
  daaScore: 4_951_880,
  supply: 21_964_860,
  reward: 60,
  nextReward: 30,
  nextReductionSeconds: 834_240,
  txCount: 1_284_604,
  shieldedNotes: 2_741_303,
  nullifiers: 1_281_442,
  shieldedValue: 21_964_860,
  stateRoot: '2f4f897c1435d3e88db7c85831a4c4e5a61732aa2e4ff68c5bfa017bb62efae9',
  priceUsd: null,
  marketCapUsd: null,
  merged: {
    scannedAt: Math.floor(now / 1000) - 20,
    peers: 17,
    checked: 12,
    reachable: 10,
    found: 7,
    attributionMatched: 4,
    attributionUpdatedAt: Math.floor(now / 1000) - 10,
    ports: [16111],
    nodes: [],
  },
  relay: { activePeers: 17, mempoolSize: 3, tipHashes: 4, difficulty: 281_000_000, blocksIngested: 0, transactionsProcessed: 0, databaseBlocks: 4_927_441 },
  publicNodes: {
    updatedAt: Math.floor(now / 1000),
    totals: {
      nodes: 18,
      peers: 17,
      countries: 9,
      located: 16,
      inbound: 7,
      outbound: 10,
      ipv4: 15,
      ipv6: 2,
      blocksRelayed: 734,
    },
    countries: [
      { code: 'US', name: 'United States', count: 5, percent: 31.25 },
      { code: 'DE', name: 'Germany', count: 3, percent: 18.75 },
      { code: 'NL', name: 'Netherlands', count: 2, percent: 12.5 },
      { code: 'CA', name: 'Canada', count: 2, percent: 12.5 },
      { code: 'GB', name: 'United Kingdom', count: 1, percent: 6.25 },
      { code: 'FR', name: 'France', count: 1, percent: 6.25 },
    ],
    nodes: demoNodes.map(([id, countryCode, countryName, network, userAgent, protocolVersion, pingMs, outbound, connectedForSec, blocksRelayed, ibd, isSelf]) => ({
      id,
      countryCode,
      countryName,
      network,
      userAgent,
      protocolVersion,
      pingMs,
      outbound,
      connectedForSec,
      blocksRelayed,
      ibd,
      isSelf,
    })),
  },
  pulse: Array.from({ length: 36 }, (_, i) => ({
    time: now - (35 - i) * 5 * 60_000,
    difficulty: 281_000_000 + Math.sin(i / 4) * 13_000_000 + i * 400_000,
    blocks: Math.max(0, Math.round(298 + Math.sin(i / 3) * 16)),
    txs: Math.max(0, Math.round(34 + Math.sin(i / 2.6) * 11 + (i % 8 === 0 ? 18 : 0))),
  })),
  chainWorkHistory: [],
  blocks: Array.from({ length: 22 }, (_, i) => {
    const time = now - i * 1000;
    const txCount = i % 4 === 0 ? 4 : (i % 3) + 1;
    return {
      hash: hash(0x9f2130 + i * 97),
      daaScore: 4_951_880 - i,
      blueScore: 4_938_112 - i,
      timestamp: time,
      difficulty: 283_000_000 + i * 210_000,
      txCount,
      txs: Array.from({ length: txCount }, (_, j) => ({
        id: hash(0x4bb730 + i * 31 + j),
        kind: j === 0 ? 'Coinbase' : 'Shielded',
        shieldedActions: j === 0 ? null : ((i + j) % 3) + 1,
      })),
    };
  }),
};
