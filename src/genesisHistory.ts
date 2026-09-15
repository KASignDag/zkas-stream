import { useEffect, useState } from 'react';

export type GenesisHistoryDay = {
  time: number;
  blocks: number;
  coinbaseZkas: number;
  cumulativeCoinbaseZkas: number;
  newPayoutAddresses: number;
  payoutAddresses: number;
  shieldedTransactions: number;
  shieldedActions: number;
  noteCommitments: number;
  nullifiers: number;
};

export type GenesisArchiveData = {
  complete: boolean;
  updatedAt: number | null;
  indexedThrough: number | null;
  indexedThroughDaaScore: number | null;
  source: {
    genesisHash: string | null;
    checkpointHash: string | null;
    checkpointDaaScore: number | null;
    historyFromDaaScore: number | null;
    historyComplete: boolean;
  };
  totals: {
    addresses: number;
    blocks: number;
    zkasMined: number;
  };
  history: {
    totals: {
      blocks: number;
      coinbaseZkas: number;
      payoutAddresses: number;
      shieldedTransactions: number;
      shieldedActions: number;
      noteCommitments: number;
      nullifiers: number;
      firstTimestamp: number | null;
      lastTimestamp: number | null;
    };
    daily: GenesisHistoryDay[];
  } | null;
};

function numeric(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function timestamp(value: unknown): number | null {
  const parsed = numeric(value);
  return parsed === null ? null : parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalize(payload: unknown): GenesisArchiveData {
  const root = record(payload);
  const source = record(root.source);
  const totals = record(root.totals);
  const history = record(root.history);
  const historyTotals = record(history.totals);
  const daily = Array.isArray(history.daily) ? history.daily.map((value) => {
    const day = record(value);
    return {
      time: timestamp(day.time) ?? 0,
      blocks: numeric(day.blocks) ?? 0,
      coinbaseZkas: numeric(day.coinbaseZkas) ?? 0,
      cumulativeCoinbaseZkas: numeric(day.cumulativeCoinbaseZkas) ?? 0,
      newPayoutAddresses: numeric(day.newPayoutAddresses) ?? 0,
      payoutAddresses: numeric(day.payoutAddresses) ?? 0,
      shieldedTransactions: numeric(day.shieldedTransactions) ?? 0,
      shieldedActions: numeric(day.shieldedActions) ?? 0,
      noteCommitments: numeric(day.noteCommitments) ?? 0,
      nullifiers: numeric(day.nullifiers) ?? 0,
    };
  }).filter((day) => day.time > 0) : [];

  return {
    complete: root.complete === true,
    updatedAt: timestamp(root.updatedAt),
    indexedThrough: timestamp(root.indexedThrough),
    indexedThroughDaaScore: numeric(root.indexedThroughDaaScore),
    source: {
      genesisHash: typeof source.genesisHash === 'string' ? source.genesisHash : null,
      checkpointHash: typeof source.checkpointHash === 'string' ? source.checkpointHash : null,
      checkpointDaaScore: numeric(source.checkpointDaaScore),
      historyFromDaaScore: numeric(source.historyFromDaaScore),
      historyComplete: source.historyComplete === true,
    },
    totals: {
      addresses: numeric(totals.addresses) ?? 0,
      blocks: numeric(totals.blocks) ?? 0,
      zkasMined: numeric(totals.zkasMined) ?? 0,
    },
    history: daily.length ? {
      totals: {
        blocks: numeric(historyTotals.blocks) ?? 0,
        coinbaseZkas: numeric(historyTotals.coinbaseZkas) ?? 0,
        payoutAddresses: numeric(historyTotals.payoutAddresses) ?? 0,
        shieldedTransactions: numeric(historyTotals.shieldedTransactions) ?? 0,
        shieldedActions: numeric(historyTotals.shieldedActions) ?? 0,
        noteCommitments: numeric(historyTotals.noteCommitments) ?? 0,
        nullifiers: numeric(historyTotals.nullifiers) ?? 0,
        firstTimestamp: timestamp(historyTotals.firstTimestamp),
        lastTimestamp: timestamp(historyTotals.lastTimestamp),
      },
      daily,
    } : null,
  };
}

export function useGenesisArchive() {
  const [data, setData] = useState<GenesisArchiveData | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const load = async () => {
      try {
        const response = await fetch('/api/mining-rankings?page=1&pageSize=1', { signal: controller.signal });
        if (!response.ok) throw new Error(`History API returned ${response.status}`);
        const next = normalize(await response.json());
        if (!stopped) setData(next);
      } catch {
        if (!stopped) setData(null);
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60_000);
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  return data;
}
