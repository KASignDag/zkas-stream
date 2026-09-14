const KASPA_API = 'https://api.kaspa.org';
const TWO_MINERS_API = 'https://kas.2miners.com/api/stats';

function json(body, status = 200, cacheControl) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl ?? (status === 200
        ? 'public, max-age=20, s-maxage=30, stale-while-revalidate=120'
        : 'public, max-age=10'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function positive(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new Error(`invalid ${label}`);
  return number;
}

async function readOfficialValue(path, key) {
  const response = await fetch(`${KASPA_API}${path}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 30 },
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const payload = await response.json();
  return positive(payload?.[key], key);
}

async function fetchOfficial() {
  const [hashrateThs, blockRewardKas] = await Promise.all([
    readOfficialValue('/info/hashrate', 'hashrate'),
    readOfficialValue('/info/blockreward', 'blockreward'),
  ]);
  return {
    hashrateHps: hashrateThs * 1e12,
    blockRewardKas,
    source: 'Kaspa public REST API',
  };
}

async function fetchTwoMiners() {
  const response = await fetch(TWO_MINERS_API, {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 30 },
  });
  if (!response.ok) throw new Error(`2Miners: HTTP ${response.status}`);
  const payload = await response.json();
  const node = Array.isArray(payload?.nodes) ? payload.nodes[0] : null;
  const hashrateHps = positive(node?.networkhashps, '2Miners network hashrate');
  const rawReward = positive(node?.blockReward, '2Miners block reward');
  const blockRewardKas = rawReward > 1_000_000 ? rawReward / 1e8 : rawReward;
  if (blockRewardKas > 1_000) throw new Error('2Miners block reward out of range');
  return {
    hashrateHps,
    blockRewardKas,
    source: '2Miners Kaspa pool network feed',
  };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheUrl = new URL('/__cache/kaspa-mining-last-good', context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  try {
    const snapshot = await Promise.any([
      fetchOfficial(),
      fetchTwoMiners(),
    ]);
    const result = {
      ...snapshot,
      blocksPerSecond: 10,
      updatedAt: Date.now(),
    };
    context.waitUntil(cache.put(cacheKey, json(result, 200, 'public, max-age=604800')));
    return json(result);
  } catch {
    // Try the last known good edge snapshot if both public sources are temporarily unavailable.
  }

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const snapshot = await cachedResponse.json();
      return json({ ...snapshot, stale: true });
    }
  } catch {
    // Return the normal temporary error below when the edge cache is unavailable.
  }

  return json({ error: 'kaspa_mining_inputs_unavailable' }, 502);
}
