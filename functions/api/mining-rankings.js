const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 50;
const STORAGE_KEY = 'all-time:v1';
const SOMPI_PER_ZKAS = 100_000_000n;
const PAYOUT_TIERS = [
  { key: 'plankton', name: 'Plankton / Shrimp', range: 'Under 100 ZKAS', min: 0n, max: 100n * SOMPI_PER_ZKAS },
  { key: 'crab', name: 'Crab', range: '100–1,000 ZKAS', min: 100n * SOMPI_PER_ZKAS, max: 1_000n * SOMPI_PER_ZKAS },
  { key: 'octopus', name: 'Octopus', range: '1,000–10,000 ZKAS', min: 1_000n * SOMPI_PER_ZKAS, max: 10_000n * SOMPI_PER_ZKAS },
  { key: 'fish', name: 'Fish', range: '10,000–100,000 ZKAS', min: 10_000n * SOMPI_PER_ZKAS, max: 100_000n * SOMPI_PER_ZKAS },
  { key: 'dolphin', name: 'Dolphin', range: '100,000–1M ZKAS', min: 100_000n * SOMPI_PER_ZKAS, max: 1_000_000n * SOMPI_PER_ZKAS },
  { key: 'shark', name: 'Shark', range: '1M–10M ZKAS', min: 1_000_000n * SOMPI_PER_ZKAS, max: 10_000_000n * SOMPI_PER_ZKAS },
  { key: 'whale', name: 'Whale', range: '10M–100M ZKAS', min: 10_000_000n * SOMPI_PER_ZKAS, max: 100_000_000n * SOMPI_PER_ZKAS },
  { key: 'humpback', name: 'Humpback', range: '100M–1B ZKAS', min: 100_000_000n * SOMPI_PER_ZKAS, max: 1_000_000_000n * SOMPI_PER_ZKAS },
  { key: 'aquaman', name: 'Aquaman', range: '1B+ ZKAS', min: 1_000_000_000n * SOMPI_PER_ZKAS, max: null },
];

function numberish(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampish(value) {
  const numeric = numberish(value);
  if (numeric !== null) return numeric < 10_000_000_000 ? numeric * 1000 : numeric;
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAddress(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function sompiish(value, zkasMined) {
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (zkasMined === null || zkasMined < 0) return null;
  return BigInt(Math.round(zkasMined * Number(SOMPI_PER_ZKAS)));
}

function formatSompi(value) {
  const whole = value / SOMPI_PER_ZKAS;
  const fraction = (value % SOMPI_PER_ZKAS).toString().padStart(8, '0');
  return `${whole}.${fraction}`;
}

function normalizeRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const address = normalizeAddress(value.address || value.payoutAddress || value.payout_address);
  const blocks = numberish(value.blocks ?? value.blockCount ?? value.block_count);
  const zkasMined = numberish(value.zkasMined ?? value.zkas_mined ?? value.totalReward ?? value.total_reward);
  const zkasMinedSompi = sompiish(value.zkasMinedSompi ?? value.zkas_mined_sompi, zkasMined);
  const rank = numberish(value.rank);
  if (!address.startsWith('zkas:') || blocks === null || blocks < 0 || zkasMinedSompi === null) return null;
  return {
    address,
    rank: rank !== null && rank > 0 ? Math.trunc(rank) : null,
    blocks: Math.trunc(blocks),
    zkasMined: formatSompi(zkasMinedSompi),
    zkasMinedSompi: zkasMinedSompi.toString(),
    firstMinedAt: timestampish(value.firstMinedAt ?? value.first_mined_at),
    lastMinedAt: timestampish(value.lastMinedAt ?? value.last_mined_at),
  };
}

function buildTiers(rows) {
  const totalSompi = rows.reduce((sum, row) => sum + BigInt(row.zkasMinedSompi), 0n);
  return PAYOUT_TIERS.map((tier) => {
    const members = rows.filter((row) => {
      const value = BigInt(row.zkasMinedSompi);
      return value >= tier.min && (tier.max === null || value < tier.max);
    });
    const tierSompi = members.reduce((sum, row) => sum + BigInt(row.zkasMinedSompi), 0n);
    return {
      key: tier.key,
      name: tier.name,
      range: tier.range,
      addresses: members.length,
      addressPercent: rows.length ? members.length / rows.length * 100 : 0,
      zkasMined: formatSompi(tierSompi),
      minedPercent: totalSompi > 0n ? Number(tierSompi * 1_000_000n / totalSompi) / 10_000 : 0,
    };
  });
}

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200 ? 'public, max-age=30, s-maxage=120, stale-while-revalidate=300' : 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function emptyPayload(message = 'The historical mining-payout backfill has not been connected yet.') {
  return {
    schemaVersion: 1,
    status: 'awaiting_backfill',
    complete: false,
    message,
    updatedAt: Date.now(),
    backfill: { processedBlocks: 0, targetBlocks: null, coveragePercent: 0 },
    totals: { addresses: 0, blocks: 0, zkasMined: 0 },
    tiers: [],
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 0,
    query: '',
    rows: [],
  };
}

async function loadSnapshot(env, request) {
  if (env.ZKAS_MINING_RANKINGS_API_URL) {
    let url;
    try {
      url = new URL(env.ZKAS_MINING_RANKINGS_API_URL);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
    } catch {
      return { error: 'The configured historical rankings endpoint is invalid.' };
    }

    const headers = new Headers({ Accept: 'application/json' });
    if (env.ZKAS_MINING_RANKINGS_API_KEY) headers.set('Authorization', `Bearer ${env.ZKAS_MINING_RANKINGS_API_KEY}`);
    try {
      const response = await fetch(url, { headers, redirect: 'follow' });
      if (!response.ok) return { error: `The historical rankings service returned status ${response.status}.` };
      return { snapshot: await response.json() };
    } catch {
      return { error: 'The historical rankings service could not be reached.' };
    }
  }

  if (env.ZKAS_MINING_RANKINGS) {
    const snapshot = await env.ZKAS_MINING_RANKINGS.get(STORAGE_KEY, 'json');
    if (snapshot) return { snapshot };
  }

  // Ship the last verified checkpoint with the site so rankings remain
  // available before the live KV updater is configured or during a KV outage.
  try {
    const snapshotUrl = new URL('/data/zkas-mining-rankings.json', request.url);
    const snapshotRequest = new Request(snapshotUrl, { headers: { Accept: 'application/json' } });
    const response = env.ASSETS?.fetch ? await env.ASSETS.fetch(snapshotRequest) : await fetch(snapshotRequest);
    if (response.ok) return { snapshot: await response.json() };
  } catch {
    // The awaiting-backfill response below is clearer than leaking an asset error.
  }
  return { snapshot: null };
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const page = positiveInteger(url.searchParams.get('page'), 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, positiveInteger(url.searchParams.get('pageSize'), DEFAULT_PAGE_SIZE));
  const query = normalizeAddress(url.searchParams.get('q'));
  const loaded = await loadSnapshot(context.env, context.request);

  if (loaded.error) return json({ ...emptyPayload(loaded.error), status: 'unavailable' }, 502);
  if (!loaded.snapshot) return json(emptyPayload());

  const source = loaded.snapshot && typeof loaded.snapshot === 'object' ? loaded.snapshot : {};
  const rows = (Array.isArray(source.rows) ? source.rows : [])
    .map(normalizeRow)
    .filter(Boolean);
  const snapshotHasRanks = rows.length > 0 && rows.every((row) => row.rank !== null);
  rows.sort(snapshotHasRanks
    ? (a, b) => a.rank - b.rank
    : (a, b) => {
      const aSompi = BigInt(a.zkasMinedSompi);
      const bSompi = BigInt(b.zkasMinedSompi);
      return aSompi === bSompi ? b.blocks - a.blocks || a.address.localeCompare(b.address) : aSompi > bSompi ? -1 : 1;
    });
  const rankedRows = rows.map((row, index) => ({ ...row, rank: snapshotHasRanks ? row.rank : index + 1 }));
  const matches = query ? rankedRows.filter((row) => row.address.includes(query)) : rankedRows;
  const totalPages = matches.length ? Math.ceil(matches.length / pageSize) : 0;
  const safePage = totalPages ? Math.min(page, totalPages) : 1;
  const offset = (safePage - 1) * pageSize;
  const complete = source.complete === true || source.status === 'complete';
  const processedBlocks = numberish(source.backfill?.processedBlocks ?? source.processedBlocks) ?? 0;
  const targetBlocks = numberish(source.backfill?.targetBlocks ?? source.targetBlocks);
  const coveragePercent = targetBlocks && targetBlocks > 0 ? Math.min(100, processedBlocks / targetBlocks * 100) : numberish(source.backfill?.coveragePercent) ?? null;
  const totalSompi = rankedRows.reduce((sum, row) => sum + BigInt(row.zkasMinedSompi), 0n);

  return json({
    schemaVersion: 1,
    status: complete ? 'complete' : 'backfilling',
    complete,
    message: complete
      ? 'All public mining payout destinations have been indexed from genesis through the indexed tip.'
      : 'Historical blocks are still being indexed. Rankings remain provisional until coverage reaches 100%.',
    updatedAt: timestampish(source.updatedAt) ?? Date.now(),
    indexedThrough: timestampish(source.indexedThrough),
    backfill: { processedBlocks, targetBlocks, coveragePercent },
    totals: {
      addresses: rankedRows.length,
      blocks: processedBlocks,
      zkasMined: formatSompi(totalSompi),
    },
    tiers: buildTiers(rankedRows),
    page: safePage,
    pageSize,
    totalPages,
    query,
    rows: matches.slice(offset, offset + pageSize),
  });
}

export function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ error: 'method_not_allowed' }, 405);
}
