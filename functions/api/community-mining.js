const STORAGE_KEY = 'community-mining:v1';

function json(body, status = 200, cache = 'no-store') {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cache,
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
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

function cleanAlias(value) {
  if (typeof value !== 'string') return null;
  const alias = value.trim();
  if (!/^[A-Za-z0-9._-]{1,32}$/.test(alias)) return null;
  return alias;
}

function cleanMiner(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const alias = cleanAlias(value.alias);
  if (!alias) return null;

  const status = value.status === 'online' ? 'online' : 'offline';
  return {
    alias,
    status,
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

export async function onRequest(context) {
  // Prefer a dedicated KV binding when present. Until then, safely reuse the
  // existing OTC_TRADES namespace under a distinct key so no extra KV namespace
  // is required to bring the community-mining feed online.
  const store = context.env.COMMUNITY_MINING || context.env.OTC_TRADES;
  if (!store) return json({ error: 'storage_not_configured' }, 503);

  if (context.request.method === 'GET') {
    const snapshot = await store.get(STORAGE_KEY, 'json');
    if (!snapshot) {
      return json({
        schemaVersion: 1,
        updatedAt: null,
        gatewayOnline: false,
        miners: [],
      }, 200, 'public, max-age=5');
    }
    return json(snapshot, 200, 'public, max-age=5');
  }

  if (context.request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(context.request, context.env.MINING_INGEST_SECRET))) return json({ error: 'unauthorized' }, 401);

  const contentLength = Number(context.request.headers.get('Content-Length') || 0);
  if (contentLength > 100_000) return json({ error: 'payload_too_large' }, 413);

  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (!Array.isArray(body?.miners) || body.miners.length > 500) return json({ error: 'invalid_miners' }, 400);
  const miners = body.miners.map(cleanMiner).filter(Boolean);
  if (miners.length !== body.miners.length) return json({ error: 'invalid_miner_row' }, 400);

  const snapshot = {
    schemaVersion: 1,
    updatedAt: Date.now(),
    gatewayOnline: body.gatewayOnline !== false,
    miners,
  };

  await store.put(STORAGE_KEY, JSON.stringify(snapshot));
  return json({ ok: true, miners: miners.length, updatedAt: snapshot.updatedAt });
}
