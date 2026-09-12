const SOURCE_URL = 'https://rkstratum.rustykaspa.org/bridges/rkstratum-pool';
const LIVE_URL = 'https://rkstratum.rustykaspa.org/api/pnn/bridge/rkstratum-pool/live';

function json(body, status = 200, cacheControl) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl ?? (status === 200
        ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=900'
        : 'public, max-age=10'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalize(payload) {
  const stats = payload?.aggregateStats;
  const summary = stats?.poolSummary;
  const poolInfo = stats?.poolInfo;
  if (!stats || !summary || !poolInfo) throw new Error('aggregate data unavailable');

  const destinations = Array.isArray(poolInfo.destinations)
    ? poolInfo.destinations.map((destination) => ({
      key: String(destination?.key || ''),
      label: String(destination?.label || 'Allocation'),
      percent: finite(destination?.splitBps) === null ? null : finite(destination.splitBps) / 100,
      sweptKas: finite(destination?.sweptKas),
      pendingKas: finite(destination?.pendingKas),
    })).filter((destination) => destination.key && destination.percent !== null)
    : [];

  const allocatedPercent = destinations.reduce((total, destination) => total + (destination.percent || 0), 0);
  if (allocatedPercent < 100) {
    destinations.push({
      key: 'fee_buffer',
      label: 'Fee buffer',
      percent: 100 - allocatedPercent,
      sweptKas: null,
      pendingKas: null,
    });
  }

  const totalHashrateGhs = finite(stats.totalHashrate);
  return {
    source: 'RustyKaspa',
    sourceUrl: SOURCE_URL,
    fetchedAt: Date.now(),
    status: typeof payload.bridgeStatus === 'string'
      ? payload.bridgeStatus.toLowerCase()
      : finite(stats.activeWorkers) > 0 ? 'online' : 'unknown',
    scheme: String(stats.scheme || 'PPLNS'),
    activeMiners: finite(stats.activeWorkers),
    poolHashrateHps: totalHashrateGhs === null ? null : totalHashrateGhs * 1e9,
    blocksMatured: finite(summary.blocks_matured ?? stats.totalBlocks),
    blocksOrphaned: finite(summary.blocks_orphaned),
    totalPaidKas: finite(summary.total_paid_kas),
    totalOwedKas: finite(summary.total_owed_kas),
    sharesLastHour: finite(summary.shares_last_hour),
    lastBlockFoundAt: finite(summary.last_block_found_ms),
    poolFeePercent: finite(poolInfo.feePercent),
    totalDistributedKas: finite(summary.fee_swept_kas),
    pendingSweepKas: finite(summary.fee_unswept_kas),
    feeAllocation: destinations,
  };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheUrl = new URL('/__cache/rustykaspa-pool-last-good', context.request.url);
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });

  try {
    const response = await fetch(LIVE_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
    const snapshot = normalize(await response.json());
    context.waitUntil(cache.put(cacheKey, json(snapshot, 200, 'public, max-age=604800')));
    return json(snapshot);
  } catch {
    // Fall through to a last-known-good aggregate snapshot.
  }

  try {
    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      const snapshot = await cachedResponse.json();
      return json({ ...snapshot, stale: true });
    }
  } catch {
    // Return the temporary error below when the edge cache is unavailable.
  }

  return json({ error: 'rustykaspa_pool_unavailable', sourceUrl: SOURCE_URL }, 502);
}
