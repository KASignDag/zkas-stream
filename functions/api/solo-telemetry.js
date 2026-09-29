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
    await store.put(`solo-telemetry:${profile.dashboardHash}`, JSON.stringify(telemetry), { expirationTtl: 60 * 60 * 24 * 30 });
    return json({ ok: true, updatedAt: telemetry.updatedAt });
  }

  if (request.method === 'GET') {
    const dashboardHash = await digest(supplied);
    const dashboard = await store.get(`solo-dashboard:${dashboardHash}`, 'json');
    if (!dashboard) return json({ error: 'unauthorized' }, 401);
    const telemetry = await store.get(`solo-telemetry:${dashboardHash}`, 'json');
    return json({
      ok: true,
      paired: dashboard.status === 'claimed',
      profile: { name: dashboard.name, mode: dashboard.mode },
      telemetry: telemetry || null,
    });
  }

  return json({ error: 'method_not_allowed' }, 405);
}
