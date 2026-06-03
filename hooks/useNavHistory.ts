'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Q64_ONE, TrancheKind } from '@/app/lib/constants';
import { useVaultState } from '@/hooks/useVaultState';

export interface NavDataPoint {
  timestamp: number;
  navPerShare: number;
  ammSpotPrice: number | null;
}

export type NavHistoryMap = Record<TrancheKind, NavDataPoint[]>;

const MAX_HISTORY = 200_000; // matches API LIMIT — keeps all-time data in memory
const MIN_INTERVAL_MS = 4_000; // deduplicate polls closer than 4 s
const SYNC_INTERVAL_MS = 30_000; // flush pending points to DB at most every 30 s

interface PendingPoint {
  tranche: number;
  recordedAt: number;
  navPerShare: number;
  ammSpotPrice: number | null;
}

export function useNavHistory() {
  const vaultQuery = useVaultState();

  const historyRef = useRef<NavHistoryMap>({
    [TrancheKind.Prime]: [],
    [TrancheKind.Core]: [],
    [TrancheKind.Alpha]: [],
  });

  // Points accumulated since the last DB flush
  const pendingRef = useRef<PendingPoint[]>([]);
  const lastSyncRef = useRef<number>(0);

  const [version, setVersion] = useState(0);
  const [dbLoaded, setDbLoaded] = useState(false);

  // ── Load all historical data from DB on mount ───────────────────────────────
  useEffect(() => {
    fetch('/api/nav-history')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<{ tranche: number; timestamp: number; navPerShare: number; ammSpotPrice: number | null }[]>;
      })
      .then((rows) => {
        for (const row of rows) {
          const kind = row.tranche as TrancheKind;
          historyRef.current[kind].push({
            timestamp: row.timestamp,
            navPerShare: row.navPerShare,
            ammSpotPrice: row.ammSpotPrice,
          });
        }
        // Ensure each tranche is sorted and trimmed
        for (const kind of [TrancheKind.Prime, TrancheKind.Core, TrancheKind.Alpha] as const) {
          historyRef.current[kind].sort((a, b) => a.timestamp - b.timestamp);
          if (historyRef.current[kind].length > MAX_HISTORY) {
            historyRef.current[kind] = historyRef.current[kind].slice(-MAX_HISTORY);
          }
        }
        setDbLoaded(true);
        setVersion((v) => v + 1);
      })
      .catch(() => {
        // DB unreachable — still allow in-memory accumulation
        setDbLoaded(true);
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flush pending points to DB ──────────────────────────────────────────────
  const flushPending = useCallback(() => {
    const points = pendingRef.current.splice(0);
    if (!points.length) return;
    fetch('/api/nav-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points }),
    }).catch(() => {
      // Re-queue on failure so we retry on the next flush
      pendingRef.current = [...points, ...pendingRef.current];
    });
  }, []);

  // ── Append new on-chain points ──────────────────────────────────────────────
  useEffect(() => {
    if (!vaultQuery.data) return;
    const now = Date.now();
    let appended = false;

    for (const tranche of vaultQuery.data.tranches) {
      const kind = tranche.kind as TrancheKind;
      const arr = historyRef.current[kind];

      // Skip if this poll is too soon after the last recorded point
      if (arr.length > 0 && now - arr[arr.length - 1].timestamp < MIN_INTERVAL_MS) continue;

      const navPerShare =
        Number((tranche.navPerShareQ * 1_000_000n) / Q64_ONE) / 1_000_000;
      const ammSpotPrice =
        tranche.ammTrancheBalance > 0n && tranche.ammQuoteBalance > 0n
          ? Number((tranche.ammQuoteBalance * 1_000_000n) / tranche.ammTrancheBalance) / 1_000_000
          : null;

      arr.push({ timestamp: now, navPerShare, ammSpotPrice });
      if (arr.length > MAX_HISTORY) arr.splice(0, arr.length - MAX_HISTORY);

      pendingRef.current.push({ tranche: kind, recordedAt: now, navPerShare, ammSpotPrice });
      appended = true;
    }

    if (appended) {
      setVersion((v) => v + 1);
      if (now - lastSyncRef.current >= SYNC_INTERVAL_MS) {
        lastSyncRef.current = now;
        flushPending();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultQuery.dataUpdatedAt]);

  // ── Flush remaining points when the component unmounts ─────────────────────
  useEffect(() => {
    return () => { flushPending(); };
  }, [flushPending]);

  return {
    history: historyRef.current,
    currentData: vaultQuery.data,
    isLoading: vaultQuery.isLoading || !dbLoaded,
    version,
  };
}
