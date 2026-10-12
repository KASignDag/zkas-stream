function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

const encoder = new TextEncoder();
const SNAPSHOTS = [
  ['community', 'community-mining:v1'],
  ['community-107', 'community-mining:v1:community-107'],
];

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function digest(value) {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(raw), (b) => b.toString(16).padStart(2, '0')).join('');
}

function validOwnerKey(value) {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value.toLowerCase());
}

function safeMode(value) {
  return ['basic', 'local', 'rental'].includes(value) ? value : 'basic';
}

function safeMiner(miner, gateway) {
  return {
    gateway,
    alias: miner.alias,
    status: miner.status === 'online' ? 'online' : 'offline',
    hashrateHps: Number.isFinite(miner.hashrateHps) ? miner.hashrateHps : null,
    uptimeSeconds: Number.isFinite(miner.uptimeSeconds) ? miner.uptimeSeconds : null,
    acceptedShares: Number.isFinite(miner.acceptedShares) ? miner.acceptedShares : null,
    invalidShares: Number.isFinite(miner.invalidShares) ? miner.invalidShares : null,
    staleShares: Number.isFinite(miner.staleShares) ? miner.staleShares : null,
    lastShareAt: Number.isFinite(miner.lastShareAt) ? miner.lastShareAt : null,
    lastSeenAt: Number.isFinite(miner.lastSeenAt) ? miner.lastSeenAt : null,
    zkasBlocks: Number.isFinite(miner.zkasBlocks) ? miner.zkasBlocks : 0,
    kasBlocks: Number.isFinite(miner.kasBlocks) ? miner.kasBlocks : 0,
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) return json({ error: 'invalid_origin' }, 403);

  const store = env.COMMUNITY_MINING || env.OTC_TRADES;
  if (!store) return json({ error: 'storage_not_configured' }, 503);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  const ownerKey = typeof body?.ownerKey === 'string' ? body.ownerKey.trim().toLowerCase() : '';
  const mode = safeMode(body?.mode);
  if (!validOwnerKey(ownerKey)) return json({ error: 'invalid_owner_key' }, 400);

  const matches = [];
  for (const [gateway, key] of SNAPSHOTS) {
    const snapshot = await store.get(key, 'json');
    for (const miner of (Array.isArray(snapshot?.miners) ? snapshot.miners : [])) {
      if (miner?.ownerKey === ownerKey) matches.push(safeMiner(miner, gateway));
    }
  }

  if (!matches.length) {
    return json({
      error: 'no_matching_worker',
      message: 'No Community Mining worker currently matches this address hash.',
    }, 404);
  }

  const dashboardToken = token();
  const dashboardHash = await digest(dashboardToken);
  await store.put(`solo-dashboard:${dashboardHash}`, JSON.stringify({
    schemaVersion: 2,
    status: 'claimed',
    mode,
    ownerKey,
    workers: matches.map((miner) => ({ gateway: miner.gateway, alias: miner.alias })),
    createdAt: Date.now(),
  }), { expirationTtl: 60 * 60 * 24 * 365 });

  return json({
    ok: true,
    dashboardToken,
    workers: matches,
  });
}
