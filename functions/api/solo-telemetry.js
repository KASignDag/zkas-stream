function json(body, status = 200, cache = 'private, no-store, max-age=0') {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cache,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
    },
  });
}

const encoder = new TextEncoder();

async function digest(value) {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(raw), (b) => b.toString(16).padStart(2, '0')).join('');
}

function n(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

const HISTORY_BUCKET_MS = 5 * 60 * 1000;
const HISTORY_MAX_POINTS = 7 * 24 * 12;
const HISTORY_WINDOWS = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

function historyPoint(telemetry) {
  return {
    t: telemetry.updatedAt,
    h: telemetry.hashrateHps,
    a: telemetry.acceptedShares,
    i: telemetry.invalidShares,
    s: telemetry.staleShares,
    z: telemetry.zkasBlocks,
    k: telemetry.kasBlocks,
    u: telemetry.uptimeSeconds,
    c: telemetry.temperatureC,
    f: telemetry.fanRpm,
  };
}

async function appendHistory(store, dashboardHash, telemetry) {
  const key = `solo-history:${dashboardHash}`;
  const existing = (await store.get(key, 'json')) || { schemaVersion: 1, points: [] };
  const points = Array.isArray(existing.points) ? existing.points : [];
  const latest = points[points.length - 1];
  const currentBucket = Math.floor(telemetry.updatedAt / HISTORY_BUCKET_MS);
  const latestBucket = latest?.t ? Math.floor(latest.t / HISTORY_BUCKET_MS) : -1;

  if (currentBucket === latestBucket) {
    points[points.length - 1] = historyPoint(telemetry);
  } else {
    points.push(historyPoint(telemetry));
  }

  const trimmed = points.slice(-HISTORY_MAX_POINTS);
  await store.put(key, JSON.stringify({ schemaVersion: 1, points: trimmed }), {
    expirationTtl: 60 * 60 * 24 * 8,
  });
}

function cleanTelemetry(body, profile) {
  const row = body && typeof body === 'object' ? body : {};
  return {
    schemaVersion: 1,
    updatedAt: Date.now(),
    name: profile.name || 'My miner',
    mode: profile.mode || 'basic',
    status: row.status === 'offline' ? 'offline' : 'online',
    worker: typeof row.worker === 'string' ? row.worker.trim().slice(0, 64) : '',
    hashrateHps: n(row.hashrateHps),
    uptimeSeconds: n(row.uptimeSeconds),
    acceptedShares: n(row.acceptedShares),
    invalidShares: n(row.invalidShares),
    staleShares: n(row.staleShares),
    zkasBlocks: n(row.zkasBlocks) ?? 0,
    kasBlocks: n(row.kasBlocks) ?? 0,
    lastShareAt: n(row.lastShareAt),
    temperatureC: profile.mode === 'local' ? n(row.temperatureC) : null,
    fanRpm: profile.mode === 'local' ? n(row.fanRpm) : null,
    source: 'dual-alert',
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const store = env.COMMUNITY_MINING || env.OTC_TRADES;
  if (!store) return json({ error: 'storage_not_configured' }, 503);

  const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
  if (!supplied) return json({ error: 'unauthorized' }, 401);

  if (request.method === 'POST') {
    const publisherHash = await digest(supplied);
    const profile = await store.get(`solo-publisher:${publisherHash}`, 'json');
    if (!profile) return json({ error: 'unauthorized' }, 401);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const telemetry = cleanTelemetry(body, profile);
    await Promise.all([
      store.put(`solo-telemetry:${profile.dashboardHash}`, JSON.stringify(telemetry), { expirationTtl: 60 * 60 * 24 * 30 }),
      appendHistory(store, profile.dashboardHash, telemetry),
    ]);
    return json({ ok: true, updatedAt: telemetry.updatedAt });
  }

  if (request.method === 'GET') {
    const dashboardHash = await digest(supplied);
    const dashboard = await store.get(`solo-dashboard:${dashboardHash}`, 'json');
    if (!dashboard) return json({ error: 'unauthorized' }, 401);
    const telemetry = await store.get(`solo-telemetry:${dashboardHash}`, 'json');
    const url = new URL(request.url);
    const range = url.searchParams.get('range');
    let history = null;

    if (range && HISTORY_WINDOWS[range]) {
      const saved = await store.get(`solo-history:${dashboardHash}`, 'json');
      const cutoff = Date.now() - HISTORY_WINDOWS[range];
      history = (Array.isArray(saved?.points) ? saved.points : []).filter((point) => Number(point?.t) >= cutoff);
    }

    return json({
      ok: true,
      paired: dashboard.status === 'claimed',
      profile: { name: dashboard.name, mode: dashboard.mode },
      telemetry: telemetry || null,
      historyRange: range && HISTORY_WINDOWS[range] ? range : null,
      history,
    });
  }

  return json({ error: 'method_not_allowed' }, 405);
}
