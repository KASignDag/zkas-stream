const STORAGE_KEYS = {
  community: 'community-mining:v1',
  'community-107': 'community-mining:v1:community-107',
};

const COUNTER_KEYS = {
  community: 'community-mining:counters:v1:community',
  'community-107': 'community-mining:counters:v1:community-107',
};

function json(body, status = 200, cache = 'no-store') {
  return Response.json(body, { status, headers: { 'Cache-Control': cache, 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } });
}

async function authorized(request, expected) {
  if (!expected) return false;
  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!supplied) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(supplied)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let difference = left.length ^ right.length;
  for (let i = 0; i < Math.min(left.length, right.length); i += 1) difference |= left[i] ^ right[i];
  return difference === 0;
}

function finiteNonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function counterValue(value) {
  const n = finiteNonNegative(value);
  return n === null ? 0 : Math.floor(n);
}

function cleanAlias(value) {
  if (typeof value !== 'string') return null;
  const alias = value.trim();
  return /^[A-Za-z0-9._-]{1,32}$/.test(alias) ? alias : null;
}

function cleanMiner(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const alias = cleanAlias(value.alias);
  if (!alias) return null;
  return {
    alias,
    status: value.status === 'online' ? 'online' : 'offline',
    hashrateHps: finiteNonNegative(value.hashrateHps),
    uptimeSeconds: finiteNonNegative(value.uptimeSeconds),
    acceptedShares: finiteNonNegative(value.acceptedShares),
    invalidShares: finiteNonNegative(value.invalidShares),
    staleShares: finiteNonNegative(value.staleShares),
    lastShareAt: finiteNonNegative(value.lastShareAt),
    zkasBlocks: finiteNonNegative(value.zkasBlocks),
    kasBlocks: finiteNonNegative(value.kasBlocks),
    kasPayoutSet: value.kasPayoutSet === true,
  };
}

function accumulateCounter(previous, raw) {
  const lastRaw = counterValue(previous?.lastRaw);
  const total = counterValue(previous?.total);
  const currentRaw = counterValue(raw);

  if (!previous) return { lastRaw: currentRaw, total: currentRaw };

  // Normal session: add only the newly reported blocks.
  // Restart/reset: the raw bridge counter drops, so everything in the new
  // raw counter was earned after the reset and is added to the lifetime total.
  const delta = currentRaw >= lastRaw ? currentRaw - lastRaw : currentRaw;
  return { lastRaw: currentRaw, total: total + delta };
}

async function applyLifetimeBlockCounters(store, gateway, miners) {
  const counterKey = COUNTER_KEYS[gateway];
  const state = (await store.get(counterKey, 'json')) || { schemaVersion: 1, miners: {} };
  if (!state.miners || typeof state.miners !== 'object' || Array.isArray(state.miners)) state.miners = {};

  const published = miners.map((miner) => {
    const previous = state.miners[miner.alias] || null;
    const zkas = accumulateCounter(previous?.zkas, miner.zkasBlocks);
    const kas = accumulateCounter(previous?.kas, miner.kasBlocks);

    state.miners[miner.alias] = {
      zkas,
      kas,
      updatedAt: Date.now(),
    };

    return {
      ...miner,
      zkasBlocks: zkas.total,
      kasBlocks: kas.total,
    };
  });

  state.schemaVersion = 1;
  state.gateway = gateway;
  state.updatedAt = Date.now();
  await store.put(counterKey, JSON.stringify(state));
  return published;
}

export async function onRequest(context) {
  const store = context.env.COMMUNITY_MINING || context.env.OTC_TRADES;
  if (!store) return json({ error: 'storage_not_configured' }, 503);

  const url = new URL(context.request.url);
  const gateway = url.searchParams.get('gateway') || 'community';
  const storageKey = STORAGE_KEYS[gateway];
  if (!storageKey) return json({ error: 'invalid_gateway' }, 400);

  if (context.request.method === 'GET') {
    const snapshot = await store.get(storageKey, 'json');
    if (!snapshot) return json({ schemaVersion: 1, gateway, updatedAt: null, gatewayOnline: false, miners: [] }, 200, 'public, max-age=5');
    return json({ ...snapshot, gateway }, 200, 'public, max-age=5');
  }

  if (context.request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(context.request, context.env.MINING_INGEST_SECRET))) return json({ error: 'unauthorized' }, 401);

  const contentLength = Number(context.request.headers.get('Content-Length') || 0);
  if (contentLength > 100_000) return json({ error: 'payload_too_large' }, 413);

  let body;
  try { body = await context.request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!Array.isArray(body?.miners) || body.miners.length > 500) return json({ error: 'invalid_miners' }, 400);
  const cleanMiners = body.miners.map(cleanMiner).filter(Boolean);
  if (cleanMiners.length !== body.miners.length) return json({ error: 'invalid_miner_row' }, 400);

  const miners = await applyLifetimeBlockCounters(store, gateway, cleanMiners);
  const snapshot = { schemaVersion: 1, gateway, updatedAt: Date.now(), gatewayOnline: body.gatewayOnline !== false, miners };
  await store.put(storageKey, JSON.stringify(snapshot));
  return json({ ok: true, gateway, miners: miners.length, updatedAt: snapshot.updatedAt });
}
