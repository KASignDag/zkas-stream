const SOLO_FINDS_URL = 'https://rkstratum.rustykaspa.org/api/pnn/solo/zkas/finds';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store, private',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function onRequestPost(context) {
  let body;
  try {
    body = await context.request.json();
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  const address = typeof body?.address === 'string' ? body.address.trim().toLowerCase() : '';
  if (!/^zkas:[a-z0-9]{30,160}$/.test(address)) {
    return json({ error: 'invalid_zkas_address' }, 400);
  }

  try {
    const response = await fetch(SOLO_FINDS_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ zkas_address: address, limit: 50 }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 400) return json({ error: 'invalid_zkas_address' }, 400);
      return json({ error: 'solo_lookup_unavailable' }, 502);
    }

    const finds = Array.isArray(payload?.finds)
      ? payload.finds.slice(0, 50).flatMap((entry) => {
        const blockHash = typeof entry?.zkas_block_hash === 'string'
          ? entry.zkas_block_hash.trim().toLowerCase()
          : '';
        if (!/^[a-f0-9]{64}$/.test(blockHash)) return [];
        return [{
          blockHash,
          acceptedAt: finite(entry?.accepted_at_ms),
          role: typeof entry?.role === 'string' ? entry.role : 'miner',
        }];
      })
      : [];

    return json({
      found: true,
      fetchedAt: Date.now(),
      findCount: finite(payload?.count) ?? finds.length,
      findsLast24h: finite(payload?.finds_last_24h),
      findsLast7d: finite(payload?.finds_last_7d),
      returned: finds.length,
      hasMore: payload?.has_more === true,
      finds,
    });
  } catch {
    return json({ error: 'solo_lookup_unavailable' }, 502);
  }
}
