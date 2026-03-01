/**
 * useCloudSync — connects the Zustand store to the tRPC cloud sync API.
 *
 * Behaviour:
 * - On mount (when user is authenticated): loads cloud data and merges into the store.
 * - On any portfolio change: debounces 1.5s then pushes to the DB.
 * - On stock projection edit: pushes immediately (called explicitly from ProjectionDrawer).
 * - When not authenticated: silently skips all sync (localStorage-only mode).
 */

import { useEffect, useRef, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { usePortfolioStore } from '@/lib/store';
import type { Portfolio, PortfolioStock } from '@/lib/types';
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

  // Load cloud data once on mount when authenticated + hydrated
  const { data: cloudData, isSuccess: cloudLoaded } = trpc.sync.load.useQuery(
    undefined,
    {
      enabled: isAuthenticated && hasHydrated,
      staleTime: Infinity, // Only load once per session
      retry: 1,
    }
  );

  // Merge cloud data into the store when it arrives
  const mergedRef = useRef(false);
  useEffect(() => {
    if (cloudLoaded && cloudData && !mergedRef.current) {
      mergedRef.current = true;
      loadCloudData(cloudData);
    }
  }, [cloudLoaded, cloudData, loadCloudData]);

  // Debounced push of portfolio state
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSyncingRef = useRef(false);

  useEffect(() => {
    // Don't sync until: authenticated, hydrated, and cloud data has been loaded
    if (!isAuthenticated || !hasHydrated || !mergedRef.current) return;

    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    debounceTimer.current = setTimeout(async () => {
      if (isSyncingRef.current) return;
      isSyncingRef.current = true;
      try {
        await pushPortfoliosMutation.mutateAsync({
          portfolios: portfolios.map((p) => ({
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
          activePortfolioId,
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
  }, [portfolios, activePortfolioId, isAuthenticated, hasHydrated]);

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
