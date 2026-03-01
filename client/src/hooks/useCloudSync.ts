/**
 * useCloudSync — connects the Zustand store to the tRPC cloud sync API.
 *
 * Behaviour:
 * - On mount (when user is authenticated): loads cloud data and merges into the store.
 * - On any portfolio change AFTER the initial merge: debounces 1.5s then pushes to the DB.
 * - On stock projection edit: pushes immediately (called explicitly from ProjectionDrawer).
 * - When not authenticated: silently skips all sync (localStorage-only mode).
 *
 * Race condition fix:
 * - `mergedRef` is a ref so flipping it doesn't trigger a re-render of the push effect.
 * - We use `cloudMergedAt` (a useState timestamp) so the push effect re-runs with the
 *   freshly merged portfolios, not the stale pre-merge state from localStorage.
 * - The push effect skips the very first run after merge (isFirstRunAfterMerge) to avoid
 *   immediately overwriting the cloud data we just loaded.
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import { trpc } from '@/lib/trpc';
import { usePortfolioStore } from '@/lib/store';
import type { StockProjections } from '@/lib/types';

const DEBOUNCE_MS = 1500;

export function useCloudSync(isAuthenticated: boolean) {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const hasHydrated = usePortfolioStore((s) => s._hasHydrated);
  const loadCloudData = usePortfolioStore((s) => s.loadCloudData);

  const utils = trpc.useUtils();
  const pushPortfoliosMutation = trpc.sync.pushPortfolios.useMutation();
  const deletePortfolioMutation = trpc.sync.deletePortfolio.useMutation();
  const pushProjectionMutation = trpc.sync.pushStockProjection.useMutation();

  // Load cloud data once per session when authenticated + hydrated
  const { data: cloudData, isSuccess: cloudLoaded } = trpc.sync.load.useQuery(
    undefined,
    {
      enabled: isAuthenticated && hasHydrated,
      staleTime: Infinity,
      retry: 1,
    }
  );

  // cloudMergedAt is a state value (not a ref) so that the push effect re-runs
  // with the correct merged portfolios after loadCloudData has been called.
  const [cloudMergedAt, setCloudMergedAt] = useState<number | null>(null);
  const mergedRef = useRef(false);

  useEffect(() => {
    if (cloudLoaded && cloudData && !mergedRef.current) {
      mergedRef.current = true;
      loadCloudData(cloudData);
      // Signal that the merge is done — this triggers the push effect to re-run
      // with the freshly merged portfolios.
      setCloudMergedAt(Date.now());
    }
  }, [cloudLoaded, cloudData, loadCloudData]);

  // Debounced push of portfolio state.
  // Only runs after cloud data has been merged (cloudMergedAt is set).
  // Skips the very first run after merge to avoid overwriting cloud data immediately.
  const isFirstRunAfterMerge = useRef(true);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    // Don't push until authenticated, hydrated, and cloud data has been merged
    if (!isAuthenticated || !hasHydrated || cloudMergedAt === null) return;

    // Skip the very first run triggered by cloudMergedAt being set — that run
    // would push the just-loaded cloud data right back, which is a no-op at best
    // and could overwrite stocks if the state snapshot is slightly stale.
    if (isFirstRunAfterMerge.current) {
      isFirstRunAfterMerge.current = false;
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        // Read the latest portfolios directly from the store to avoid stale closure
        const latestPortfolios = usePortfolioStore.getState().portfolios;
        const latestActiveId = usePortfolioStore.getState().activePortfolioId;
        await pushPortfoliosMutation.mutateAsync({
          portfolios: latestPortfolios.map((p) => ({
            id: p.id,
            name: p.name,
            totalCapital: p.totalCapital,
            allocationMode: p.allocationMode,
            cashPct: p.cashPct,
            projectionYears: p.projectionYears,
            stocks: p.stocks.map((s, idx) => ({
              stockId: s.stockId,
              allocationPct: s.allocationPct,
              sortOrder: idx,
            })),
          })),
          activePortfolioId: latestActiveId,
        });
      } catch (err) {
        console.warn('[CloudSync] Push portfolios failed:', err);
      } finally {
        isSyncingRef.current = false;
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [portfolios, activePortfolioId, isAuthenticated, hasHydrated, cloudMergedAt]);

  // Explicit push for a deleted portfolio
  const syncDeletePortfolio = useCallback(
    async (portfolioId: string) => {
      if (!isAuthenticated) return;
      try {
        await deletePortfolioMutation.mutateAsync({ portfolioId });
      } catch (err) {
        console.warn('[CloudSync] Delete portfolio failed:', err);
      }
    },
    [isAuthenticated, deletePortfolioMutation]
  );

  // Explicit push for stock projection edits
  const syncStockProjection = useCallback(
    async (stockId: string, projections: StockProjections) => {
      if (!isAuthenticated) return;
      try {
        await pushProjectionMutation.mutateAsync({ stockId, projections });
      } catch (err) {
        console.warn('[CloudSync] Push projection failed:', err);
      }
    },
    [isAuthenticated, pushProjectionMutation]
  );

  return {
    syncDeletePortfolio,
    syncStockProjection,
    isSyncing: pushPortfoliosMutation.isPending,
  };
}
