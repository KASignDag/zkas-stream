const SOURCE_URL = 'https://pool.rabidmining.com/kas#pool';
const API_URL = 'https://pool.rabidmining.com/api/pool/kas/summary';

function json(body, status = 200, cacheControl) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': cacheControl ?? (status === 200
        ? 'public, max-age=15, s-maxage=30, stale-while-revalidate=300'
        : 'public, max-age=10'),
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalize(payload) {
  if (!payload?.pool || !payload?.coins) throw new Error('pool summary unavailable');
  return {
    source: 'Rabid Mining',
    sourceUrl: SOURCE_URL,
    fetchedAt: Date.now(),
    pool: {
      hashrate: finite(payload.pool.hashrate),
      hashrate_15m: finite(payload.pool.hashrate_15m),
      hashrate_1h: finite(payload.pool.hashrate_1h),
      hashrate_24h: finite(payload.pool.hashrate_24h),
      miners_active: finite(payload.pool.miners_active),
      workers_active: finite(payload.pool.workers_active),
    },
    solo: {
      hashrate: finite(payload.solo?.hashrate),
      hashrate_15m: finite(payload.solo?.hashrate_15m),
    },
    coins: {
      KAS: {
        synced: payload.coins.KAS?.synced === true,
        blocks_submitted_24h: finite(payload.coins.KAS?.blocks_submitted_24h),
      },
      ZKAS: {
        synced: payload.coins.ZKAS?.synced === true,
        blocks_submitted_24h: finite(payload.coins.ZKAS?.blocks_submitted_24h),
      },
    },
  };
}

export async function onRequestGet(context) {
  const cache = caches.default;
  const cacheKey = new Request(new URL('/__cache/rabid-pool-last-good', context.request.url), { method: 'GET' });

  try {
    const response = await fetch(API_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
    const snapshot = normalize(await response.json());
    context.waitUntil(cache.put(cacheKey, json(snapshot, 200, 'public, max-age=604800')));
    return json(snapshot);
  } catch {
    try {
      const cached = await cache.match(cacheKey);
      if (cached) return json({ ...(await cached.json()), stale: true });
    } catch {
      // Return the temporary error below when the edge cache is unavailable.
    }
    return json({ error: 'rabid_pool_unavailable', sourceUrl: SOURCE_URL }, 502);
  }
}
