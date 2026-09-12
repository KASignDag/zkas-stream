const LIVE_URL = 'https://rkstratum.rustykaspa.org/api/pnn/bridge/rkstratum-pool/live';

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
  if (!/^kaspa:[a-z0-9]{40,100}$/.test(address)) {
    return json({ error: 'invalid_kaspa_address' }, 400);
  }

  try {
    const response = await fetch(LIVE_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`upstream HTTP ${response.status}`);
    const stats = (await response.json())?.aggregateStats;
    const miners = Array.isArray(stats?.poolMiners) ? stats.poolMiners : [];
    const miner = miners.find((entry) => String(entry?.address || '').trim().toLowerCase() === address);
    if (!miner) return json({ error: 'miner_not_found' }, 404);

    const workers = Array.isArray(stats?.workers)
      ? stats.workers.filter((entry) => String(entry?.wallet || '').trim().toLowerCase() === address)
      : [];
    const payments = Array.isArray(stats?.recentPayments)
      ? stats.recentPayments
        .filter((entry) => String(entry?.address || '').trim().toLowerCase() === address)
        .slice(0, 10)
        .map((entry) => ({
          txId: typeof entry?.tx_id === 'string' ? entry.tx_id : null,
          amountKas: finite(entry?.amount_kas),
          paidAt: finite(entry?.paid_at),
          status: typeof entry?.status === 'string' ? entry.status : null,
        }))
      : [];

    const totalPaidKas = finite(miner.paid_kas);
    const unpaidKas = finite(miner.owed_kas);
    return json({
      found: true,
      fetchedAt: Date.now(),
      status: finite(miner.hashrate_1h_ghs ?? miner.hashrate_ghs) > 0 ? 'online' : 'offline',
      currentHashrateHps: finite(miner.hashrate_session_ghs ?? miner.hashrate_ghs) === null
        ? null
        : finite(miner.hashrate_session_ghs ?? miner.hashrate_ghs) * 1e9,
      oneHourHashrateHps: finite(miner.hashrate_1h_ghs) === null ? null : finite(miner.hashrate_1h_ghs) * 1e9,
      sharesLastHour: finite(miner.shares_last_hour),
      unpaidKas,
      totalPaidKas,
      totalEarnedKas: totalPaidKas === null || unpaidKas === null ? null : totalPaidKas + unpaidKas,
      mergeMiningEnabled: miner.has_zkas === true,
      workerCount: workers.length,
      updatedAt: finite(miner.updated_at),
      recentPayments: payments,
    });
  } catch {
    return json({ error: 'miner_lookup_unavailable' }, 502);
  }
}
