const KASPA_API = 'https://api.kaspa.org';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': status === 200
        ? 'public, max-age=20, s-maxage=30, stale-while-revalidate=120'
        : 'public, max-age=10',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function readValue(path, key) {
  const response = await fetch(`${KASPA_API}${path}`, {
    headers: { Accept: 'application/json' },
    cf: { cacheEverything: true, cacheTtl: 30 },
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const payload = await response.json();
  const value = Number(payload?.[key]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${path}: invalid ${key}`);
  return value;
}

export async function onRequestGet() {
  try {
    const [hashrateThs, blockRewardKas] = await Promise.all([
      readValue('/info/hashrate', 'hashrate'),
      readValue('/info/blockreward', 'blockreward'),
    ]);

    return json({
      hashrateHps: hashrateThs * 1e12,
      blockRewardKas,
      blocksPerSecond: 10,
      updatedAt: Date.now(),
      source: 'Kaspa public REST API',
    });
  } catch (error) {
    return json({
      error: 'kaspa_mining_inputs_unavailable',
      message: error instanceof Error ? error.message : 'fetch failed',
    }, 502);
  }
}
