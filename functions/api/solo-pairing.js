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

function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

function token() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function digest(value) {
  const raw = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(raw), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sameOrigin(request) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function safeName(value) {
  if (typeof value !== 'string') return 'My miner';
  const name = value.trim().slice(0, 64);
  return name || 'My miner';
}

function safeMode(value) {
  return ['basic', 'local', 'rental'].includes(value) ? value : 'basic';
}

function safeWorker(value) {
  if (typeof value !== 'string') return '';
  const worker = value.trim().slice(0, 64);
  return /^[A-Za-z0-9._:-]{1,64}$/.test(worker) ? worker : '';
}

export async function onRequest(context) {
  const { request, env } = context;
  const store = env.COMMUNITY_MINING || env.OTC_TRADES;
  if (!store) return json({ error: 'storage_not_configured' }, 503);

  const url = new URL(request.url);
  const action = url.searchParams.get('action') || '';

  if (request.method === 'POST' && action === 'create') {
    if (!(await sameOrigin(request))) return json({ error: 'invalid_origin' }, 403);
    let body = {};
    try { body = await request.json(); } catch {}
    const pairCode = code();
    const dashboardToken = token();
    const dashboardHash = await digest(dashboardToken);
    const pairKey = `solo-pair:${pairCode}`;
    const dashboardKey = `solo-dashboard:${dashboardHash}`;
    const createdAt = Date.now();
    const expiresAt = createdAt + 15 * 60 * 1000;
    const record = {
      schemaVersion: 1,
      pairCode,
      name: 'Paired Community Miner',
      mode: safeMode(body.mode),
      createdAt,
      expiresAt,
      status: 'pending',
      dashboardHash,
    };
    await Promise.all([
      store.put(pairKey, JSON.stringify(record), { expirationTtl: 900 }),
      store.put(dashboardKey, JSON.stringify({ ...record, pairCode: undefined }), { expirationTtl: 60 * 60 * 24 * 365 }),
    ]);
    return json({ ok: true, pairingCode: pairCode, dashboardToken, expiresAt });
  }

  if (request.method === 'POST' && action === 'claim') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const pairCode = typeof body?.pairingCode === 'string' ? body.pairingCode.trim().toUpperCase() : '';
    if (!/^[A-Z2-9]{10}$/.test(pairCode)) return json({ error: 'invalid_pairing_code' }, 400);
    const worker = safeWorker(body?.worker);
    if (!worker) return json({ error: 'worker_required' }, 400);
    const pairKey = `solo-pair:${pairCode}`;
    const record = await store.get(pairKey, 'json');
    if (!record || record.status !== 'pending' || Number(record.expiresAt) < Date.now()) return json({ error: 'pairing_code_expired_or_invalid' }, 404);

    const publisherToken = token();
    const publisherHash = await digest(publisherToken);
    const publisherKey = `solo-publisher:${publisherHash}`;
    const dashboardKey = `solo-dashboard:${record.dashboardHash}`;
    const claimed = { ...record, name: worker, worker, status: 'claimed', claimedAt: Date.now(), publisherHash };
    await Promise.all([
      store.put(publisherKey, JSON.stringify({ dashboardHash: record.dashboardHash, name: worker, worker, mode: record.mode }), { expirationTtl: 60 * 60 * 24 * 365 }),
      store.put(dashboardKey, JSON.stringify(claimed), { expirationTtl: 60 * 60 * 24 * 365 }),
      store.delete(pairKey),
    ]);
    return json({ ok: true, publisherToken, name: worker, worker, mode: record.mode });
  }

  if (request.method === 'GET' && action === 'status') {
    const supplied = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || '';
    if (!supplied) return json({ error: 'unauthorized' }, 401);
    const dashboardHash = await digest(supplied);
    const record = await store.get(`solo-dashboard:${dashboardHash}`, 'json');
    if (!record) return json({ error: 'unauthorized' }, 401);
    return json({
      ok: true,
      status: record.status,
      name: record.name,
      mode: record.mode,
      claimedAt: record.claimedAt || null,
      expiresAt: record.expiresAt || null,
    });
  }

  return json({ error: 'method_not_allowed' }, 405);
}
