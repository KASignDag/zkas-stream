const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const STORAGE_KEY = 'kas-all-time:v1';
const MAX_UPLOAD_BYTES = 5_000_000;
const SOMPI_PER_KAS = 100_000_000n;

function json(body, status = 200, cacheControl) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl ?? (status === 200
        ? 'public, max-age=30, s-maxage=120, stale-while-revalidate=300'
        : 'private, no-store'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function normalizeAddress(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

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

function sompiish(value, kasMined) {
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (kasMined === null || kasMined < 0) return null;
  return BigInt(Math.round(kasMined * Number(SOMPI_PER_KAS)));
}

function formatSompi(value) {
  const whole = value / SOMPI_PER_KAS;
  const fraction = (value % SOMPI_PER_KAS).toString().padStart(8, '0');
  return `${whole}.${fraction}`;
}

function normalizeRow(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const address = normalizeAddress(value.address || value.payoutAddress || value.payout_address);
  const acceptedCoinbases = numberish(value.acceptedCoinbases ?? value.accepted_coinbases ?? value.blocks ?? value.blockCount);
  const payoutOutputs = numberish(value.payoutOutputs ?? value.payout_outputs ?? value.outputs ?? acceptedCoinbases);
  const kasMined = numberish(value.kasMined ?? value.kas_mined ?? value.totalReward ?? value.total_reward);
  const kasMinedSompi = sompiish(value.kasMinedSompi ?? value.kas_mined_sompi, kasMined);
  const rank = numberish(value.rank);
  if (!address.startsWith('kaspa:') || acceptedCoinbases === null || acceptedCoinbases < 0 || payoutOutputs === null || payoutOutputs < 0 || kasMinedSompi === null) return null;
  return {
    address,
    rank: rank !== null && rank > 0 ? Math.trunc(rank) : null,
    acceptedCoinbases: Math.trunc(acceptedCoinbases),
    payoutOutputs: Math.trunc(payoutOutputs),
    kasMined: formatSompi(kasMinedSompi),
    kasMinedSompi: kasMinedSompi.toString(),
    firstMinedAt: timestampish(value.firstMinedAt ?? value.first_mined_at),
    lastMinedAt: timestampish(value.lastMinedAt ?? value.last_mined_at),
  };
}

function rankingsStore(env) {
  return env.KAS_MINING_RANKINGS || env.ZKAS_MINING_RANKINGS || env.OTC_TRADES || null;
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
  const expectedHash = typeof env.KAS_MINING_RANKINGS_UPLOAD_SHA256 === 'string'
    ? env.KAS_MINING_RANKINGS_UPLOAD_SHA256.trim().toLowerCase()
    : '';
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) return false;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!token) return false;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const suppliedHash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(suppliedHash, expectedHash);
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

function validateSnapshot(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('invalid_snapshot');
  if (payload.schemaVersion !== 1 || payload.status !== 'complete' || payload.complete !== true) throw new Error('snapshot_not_complete');
  if (!Array.isArray(payload.rows) || payload.rows.length < 1 || payload.rows.length > 250_000) throw new Error('invalid_rows');

  const coveragePercent = Number(payload.backfill?.coveragePercent);
  if (!Number.isFinite(coveragePercent) || coveragePercent <= 0 || coveragePercent > 100) throw new Error('invalid_coverage');
  if (payload.source?.acceptanceFiltered !== true) throw new Error('acceptance_not_verified');

  const networkAcceptedCoinbases = payload.totals?.acceptedCoinbases;
  const networkPayoutOutputs = payload.totals?.payoutOutputs;
  if (!safeNonNegativeInteger(networkAcceptedCoinbases) || networkAcceptedCoinbases < 1) throw new Error('invalid_network_coinbase_total');
  if (!safeNonNegativeInteger(networkPayoutOutputs) || networkPayoutOutputs < networkAcceptedCoinbases) throw new Error('invalid_network_output_total');

  const addresses = new Set();
  let previous = null;
  const rows = payload.rows.map((value, index) => {
    const row = normalizeRow(value);
    if (!row || row.rank !== index + 1 || !/^kaspa:[a-z0-9]{30,160}$/.test(row.address)) throw new Error('invalid_rank_or_address');
    if (row.acceptedCoinbases < 1 || row.payoutOutputs < 1 || row.payoutOutputs < row.acceptedCoinbases) throw new Error('invalid_payout_counts');
    if (!/^[1-9]\d*$/.test(row.kasMinedSompi)) throw new Error('invalid_mining_total');
    if (addresses.has(row.address)) throw new Error('duplicate_address');
    addresses.add(row.address);

    const sompi = BigInt(row.kasMinedSompi);
    const comparable = { address: row.address, acceptedCoinbases: row.acceptedCoinbases, sompi };
    if (previous && (sompi > previous.sompi
      || (sompi === previous.sompi && row.acceptedCoinbases > previous.acceptedCoinbases)
      || (sompi === previous.sompi && row.acceptedCoinbases === previous.acceptedCoinbases && row.address < previous.address))) {
      throw new Error('rows_not_ranked');
    }
    previous = comparable;
    return row;
  });

  const processedAcceptedCoinbases = payload.backfill?.processedAcceptedCoinbases;
  if (processedAcceptedCoinbases !== undefined && !safeNonNegativeInteger(processedAcceptedCoinbases)) throw new Error('invalid_processed_count');

  return {
    snapshot: {
      ...payload,
      schemaVersion: 1,
      status: 'complete',
      complete: true,
      updatedAt: Date.now(),
      rows,
    },
    summary: {
      addresses: rows.length,
      coveragePercent,
      processedAcceptedCoinbases: processedAcceptedCoinbases ?? null,
    },
  };
}

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function emptyPayload(message = 'The Kaspa historical mining-payout index has not been loaded yet.') {
  return {
    schemaVersion: 1,
    status: 'awaiting_backfill',
    complete: false,
    message,
    updatedAt: Date.now(),
    backfill: { processedAcceptedCoinbases: 0, coveragePercent: 0, coverageLabel: 'Awaiting historical dataset' },
    totals: { addresses: 0, acceptedCoinbases: null, payoutOutputs: 0, kasMined: '0.00000000' },
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    totalPages: 0,
    query: '',
    rows: [],
  };
}

async function loadSnapshot(env, request) {
  if (env.KAS_MINING_RANKINGS_API_URL) {
    try {
      const url = new URL(env.KAS_MINING_RANKINGS_API_URL);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
      const headers = new Headers({ Accept: 'application/json' });
      if (env.KAS_MINING_RANKINGS_API_KEY) headers.set('Authorization', `Bearer ${env.KAS_MINING_RANKINGS_API_KEY}`);
      const response = await fetch(url, { headers, redirect: 'follow' });
      if (!response.ok) return { error: `The Kaspa rankings service returned status ${response.status}.` };
      return { snapshot: await response.json() };
    } catch {
      return { error: 'The configured Kaspa rankings service could not be reached.' };
    }
  }

  const store = rankingsStore(env);
  if (store) {
    const snapshot = await store.get(STORAGE_KEY, 'json');
    if (snapshot) return { snapshot };
  }

  try {
    const snapshotUrl = new URL('/data/kas-mining-rankings.json', request.url);
    const snapshotRequest = new Request(snapshotUrl, { headers: { Accept: 'application/json' } });
    const response = env.ASSETS?.fetch ? await env.ASSETS.fetch(snapshotRequest) : await fetch(snapshotRequest);
    if (response.ok) return { snapshot: await response.json() };
  } catch {
    // The awaiting-backfill response below is intentional until a verified KAS snapshot exists.
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
  let rows = (Array.isArray(source.rows) ? source.rows : []).map(normalizeRow).filter(Boolean);
  rows.sort((a, b) => {
    const left = BigInt(a.kasMinedSompi);
    const right = BigInt(b.kasMinedSompi);
    if (left !== right) return left > right ? -1 : 1;
    if (a.acceptedCoinbases !== b.acceptedCoinbases) return b.acceptedCoinbases - a.acceptedCoinbases;
    return a.address.localeCompare(b.address);
  });
  rows = rows.map((row, index) => ({ ...row, rank: index + 1 }));

  const totalSompi = rows.reduce((sum, row) => sum + BigInt(row.kasMinedSompi), 0n);
  const totalPayoutOutputs = rows.reduce((sum, row) => sum + row.payoutOutputs, 0);
  const filtered = query ? rows.filter((row) => row.address === query) : rows;
  const totalPages = Math.ceil(filtered.length / pageSize);
  const safePage = Math.min(page, Math.max(totalPages, 1));
  const start = (safePage - 1) * pageSize;

  return json({
    schemaVersion: 1,
    status: source.status || 'complete',
    complete: source.complete === true,
    message: source.message || '',
    updatedAt: source.updatedAt || Date.now(),
    indexedThrough: source.indexedThrough ?? null,
    backfill: source.backfill || { coveragePercent: null },
    source: source.source || {},
    totals: {
      addresses: rows.length,
      // Do not derive this by summing per-address counts: one accepted coinbase
      // can pay several addresses. The indexer must provide the network total.
      acceptedCoinbases: safeNonNegativeInteger(source.totals?.acceptedCoinbases) ? source.totals.acceptedCoinbases : null,
      payoutOutputs: safeNonNegativeInteger(source.totals?.payoutOutputs) ? source.totals.payoutOutputs : totalPayoutOutputs,
      kasMined: source.totals?.kasMined || formatSompi(totalSompi),
    },
    page: safePage,
    pageSize,
    totalPages,
    query,
    rows: filtered.slice(start, start + pageSize),
  });
}

export async function onRequestPost(context) {
  if (!(await authorized(context.request, context.env))) return json({ error: 'unauthorized' }, 401);
  const store = rankingsStore(context.env);
  if (!store) return json({ error: 'storage_not_configured' }, 503);

  try {
    const payload = await readJson(context.request);
    const { snapshot, summary } = validateSnapshot(payload);
    await store.put(STORAGE_KEY, JSON.stringify(snapshot));
    return json({ ok: true, ...summary }, 200, 'private, no-store');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_snapshot';
    const status = message === 'payload_too_large' ? 413 : 400;
    return json({ error: message }, status);
  }
}
