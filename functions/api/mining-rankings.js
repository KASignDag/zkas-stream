const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const STORAGE_KEY = 'all-time:v1';
const MAX_UPLOAD_BYTES = 2_000_000;
const UPLOAD_TOKEN_SHA256 = 'ade7baad8fb683f5eb9e575f881d2ca54c1058bf428012a45d8c3066ba6e4aa3';
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

function json(body, status = 200, cacheControl) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl ?? (status === 200 ? 'public, max-age=30, s-maxage=120, stale-while-revalidate=300' : 'private, no-store'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function rankingsStore(env) {
  return env.ZKAS_MINING_RANKINGS || env.OTC_TRADES || null;
}

function constantTimeEqual(left, right) {
  let difference = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function authorized(request, env) {
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const suppliedHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const expectedHash = typeof env.ZKAS_MINING_RANKINGS_UPLOAD_SHA256 === 'string'
    ? env.ZKAS_MINING_RANKINGS_UPLOAD_SHA256.trim().toLowerCase()
    : UPLOAD_TOKEN_SHA256;
  return /^[a-f0-9]{64}$/.test(expectedHash) && constantTimeEqual(suppliedHash, expectedHash);
}

async function readJson(request) {
  const declaredSize = Number(request.headers.get('Content-Length') || 0);
  if (declaredSize > MAX_UPLOAD_BYTES) throw new Error('payload_too_large');
  if (!request.body) throw new Error('invalid_json');

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      throw new Error('payload_too_large');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('invalid_json');
  }
}

function safeNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function validHash(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function validateSnapshot(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_snapshot');
  if (payload.schemaVersion !== 1 || payload.status !== 'complete' || payload.complete !== true) throw new Error('snapshot_not_complete');
  if (payload.source?.historyComplete !== true || payload.source?.historyFromDaaScore !== 0) throw new Error('history_not_complete_from_genesis');

  const checkpointHash = String(payload.source?.checkpointHash || '').toLowerCase();
  const indexedHash = String(payload.indexedThroughHash || '').toLowerCase();
  const checkpointDaa = payload.source?.checkpointDaaScore;
  const indexedDaa = payload.indexedThroughDaaScore;
  if (!validHash(checkpointHash) || checkpointHash !== indexedHash) throw new Error('checkpoint_hash_mismatch');
  if (!safeNonNegativeInteger(checkpointDaa) || checkpointDaa !== indexedDaa) throw new Error('checkpoint_daa_mismatch');

  const processedBlocks = payload.backfill?.processedBlocks;
  const targetBlocks = payload.backfill?.targetBlocks;
  const coveragePercent = payload.backfill?.coveragePercent;
  if (!safeNonNegativeInteger(processedBlocks) || processedBlocks < 1 || processedBlocks !== targetBlocks || coveragePercent !== 100) {
    throw new Error('backfill_not_complete');
  }
  if (!Array.isArray(payload.rows) || payload.rows.length < 1 || payload.rows.length > 100_000) throw new Error('invalid_rows');

  const addresses = new Set();
  let previous = null;
  const rows = payload.rows.map((value, index) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_row');
    const rank = value.rank;
    const address = normalizeAddress(value.address);
    const blocks = value.blocks;
    const sompiText = value.zkasMinedSompi;
    if (rank !== index + 1 || !/^zkas:[a-z0-9]{30,160}$/.test(address)) throw new Error('invalid_rank_or_address');
    if (!Number.isSafeInteger(blocks) || blocks < 1 || typeof sompiText !== 'string' || !/^[1-9]\d*$/.test(sompiText)) throw new Error('invalid_mining_totals');
    if (addresses.has(address)) throw new Error('duplicate_address');
    addresses.add(address);

    const sompi = BigInt(sompiText);
    if (value.zkasMined !== formatSompi(sompi)) throw new Error('zkas_total_mismatch');
    const comparable = { address, blocks, sompi };
    if (previous && (sompi > previous.sompi
      || (sompi === previous.sompi && blocks > previous.blocks)
      || (sompi === previous.sompi && blocks === previous.blocks && address < previous.address))) {
      throw new Error('rows_not_ranked');
    }
    previous = comparable;
    return { ...value, rank, address, blocks, zkasMined: formatSompi(sompi), zkasMinedSompi: sompiText };
  });

  return {
    snapshot: {
      ...payload,
      schemaVersion: 1,
      status: 'complete',
      complete: true,
      updatedAt: Date.now(),
      indexedThroughHash: indexedHash,
      indexedThroughDaaScore: indexedDaa,
      source: { ...payload.source, checkpointHash, checkpointDaaScore: checkpointDaa, historyFromDaaScore: 0, historyComplete: true },
      rows,
    },
    summary: { checkpointHash, checkpointDaaScore: checkpointDaa, processedBlocks, addresses: rows.length },
  };
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

  const store = rankingsStore(env);
  if (store) {
    const snapshot = await store.get(STORAGE_KEY, 'json');
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

export async function onRequestPost(context) {
  if (!(await authorized(context.request, context.env))) return json({ error: 'unauthorized' }, 401);
  const store = rankingsStore(context.env);
  if (!store) return json({ error: 'storage_not_configured' }, 503);

  let payload;
  try {
    payload = await readJson(context.request);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'invalid_json';
    return json({ error: reason }, reason === 'payload_too_large' ? 413 : 400);
  }

  let validated;
  try {
    validated = validateSnapshot(payload);
  } catch (error) {
    return json({ error: 'invalid_snapshot', reason: error instanceof Error ? error.message : 'validation_failed' }, 422);
  }

  const existing = await store.get(STORAGE_KEY, 'json');
  const existingDaa = existing?.source?.checkpointDaaScore ?? existing?.indexedThroughDaaScore;
  if (safeNonNegativeInteger(existingDaa) && validated.summary.checkpointDaaScore < existingDaa) {
    return json({ error: 'stale_snapshot', existingDaaScore: existingDaa, incomingDaaScore: validated.summary.checkpointDaaScore }, 409);
  }

  await store.put(STORAGE_KEY, JSON.stringify(validated.snapshot));
  return json({ ok: true, ...validated.summary }, 200, 'private, no-store, max-age=0');
}

export function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ error: 'method_not_allowed' }, 405);
}
