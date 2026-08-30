const STORAGE_KEY = 'trades:v1';
const MAX_ROWS = 5000;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff' } });
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
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

function finitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function cleanTrade(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const timestamp = typeof value.timestamp === 'number' && Number.isFinite(value.timestamp) ? value.timestamp : null;
  const zkasAmount = finitePositive(value.zkasAmount);
  const priceKas = finitePositive(value.priceKas);
  const totalKas = finitePositive(value.totalKas);
  const side = ['buy', 'sell', 'unknown'].includes(value.side) ? value.side : 'unknown';
  if (timestamp === null || timestamp < 1_500_000_000_000 || timestamp > Date.now() + 86_400_000 || zkasAmount === null || priceKas === null || totalKas === null) return null;
  return { timestamp, side, zkasAmount, priceKas, totalKas };
}

function fingerprint(trade) {
  return [trade.timestamp, trade.side, trade.zkasAmount.toPrecision(15), trade.priceKas.toPrecision(15), trade.totalKas.toPrecision(15)].join('|');
}

export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!(await authorized(context.request, context.env.OTC_IMPORT_SECRET))) return json({ error: 'unauthorized' }, 401);
  if (!context.env.OTC_TRADES) return json({ error: 'storage_not_configured' }, 503);
  const contentLength = Number(context.request.headers.get('Content-Length') || 0);
  if (contentLength > 250_000) return json({ error: 'payload_too_large' }, 413);

  let payload;
  try { payload = await context.request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
  if (!Array.isArray(payload?.trades) || payload.trades.length < 1 || payload.trades.length > 500) return json({ error: 'invalid_trade_batch' }, 400);
  const incoming = payload.trades.map(cleanTrade).filter(Boolean);
  if (incoming.length !== payload.trades.length) return json({ error: 'invalid_trade_facts' }, 400);

  const stored = await context.env.OTC_TRADES.get(STORAGE_KEY, 'json');
  const existing = Array.isArray(stored?.trades) ? stored.trades.map(cleanTrade).filter(Boolean) : [];
  const seen = new Set(existing.map(fingerprint));
  const added = [];
  for (const trade of incoming) {
    const key = fingerprint(trade);
    if (seen.has(key)) continue;
    seen.add(key);
    added.push(trade);
  }
  const trades = [...existing, ...added].sort((a, b) => a.timestamp - b.timestamp).slice(-MAX_ROWS);
  await context.env.OTC_TRADES.put(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, updatedAt: Date.now(), trades }));
  return json({ ok: true, added: added.length, duplicates: incoming.length - added.length, total: trades.length });
}
