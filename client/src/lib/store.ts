// Portfolio Planner — State Store
// Design: Sophisticated Finance Dashboard (deep navy + gold)

import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Portfolio, PortfolioStock, Stock } from './types';
import { DEFAULT_PROJECTIONS, SAMPLE_STOCKS } from './sampleData';

interface PortfolioStore {
  // Hydration tracking
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // Stock library
  stockLibrary: Stock[];
  addStockToLibrary: (stock: Stock) => void;
  updateStockInLibrary: (id: string, updates: Partial<Stock>) => void;
  removeStockFromLibrary: (id: string) => void;

  // Portfolios
  portfolios: Portfolio[];
  activePortfolioId: string | null;
  createPortfolio: (name: string) => string;
  deletePortfolio: (id: string) => void;
  renamePortfolio: (id: string, name: string) => void;
  setActivePortfolio: (id: string) => void;
  duplicatePortfolio: (id: string) => string;

  // Active portfolio mutations
  setTotalCapital: (capital: number) => void;
  setAllocationMode: (mode: 'percentage' | 'dollar') => void;
  setProjectionYears: (years: number) => void;
  addStockToPortfolio: (stockId: string) => void;
  removeStockFromPortfolio: (stockId: string) => void;
  updateStockAllocation: (stockId: string, pct: number) => void;
  setCashPct: (pct: number) => void;
  reorderPortfolioStocks: (stocks: PortfolioStock[]) => void;
  normalizeAllocations: () => void;

  // Cloud sync
  loadCloudData: (data: {
    portfolios: Array<{
      id: string;
      name: string;
      totalCapital: number;
      allocationMode: 'percentage' | 'dollar';
      cashPct: number;
      projectionYears: number;
      createdAt: Date;
      updatedAt: Date;
      stocks: Array<{ stockId: string; allocationPct: number; sortOrder: number }>;
    }>;
    projections: Array<{ stockId: string; projectionsJson: unknown }>;
    activePortfolioId: string | null;
  }) => void;

  // UI state
  selectedStockId: string | null;
  setSelectedStockId: (id: string | null) => void;
  projectionDrawerOpen: boolean;
  setProjectionDrawerOpen: (open: boolean) => void;
}

function createDefaultPortfolio(name: string): Portfolio {
  return {
    id: nanoid(),
    name,
    totalCapital: 100000,
    allocationMode: 'percentage',
    stocks: [],
    cashPct: 100,
    projectionYears: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// Pre-built "Current Portfolio" based on real holdings (market values as of Mar 2026)
// Allocations are derived from market value weights (total ~$500,891)
const CURRENT_PORTFOLIO_HOLDINGS: Array<{ ticker: string; allocationPct: number }> = [
  { ticker: 'AMD',   allocationPct: 42.27 },
  { ticker: 'NVDA',  allocationPct: 11.89 },
  { ticker: 'MU',    allocationPct:  9.01 },
  { ticker: 'HIMS',  allocationPct:  7.26 },
  { ticker: 'GOOGL', allocationPct:  5.26 },
  { ticker: 'ELF',   allocationPct:  3.23 },
  { ticker: 'TLN',   allocationPct:  3.18 },
  { ticker: 'LEU',   allocationPct:  2.89 },
  { ticker: 'CLS',   allocationPct:  2.37 },
  { ticker: 'AMZN',  allocationPct:  2.10 },
  { ticker: 'HNST',  allocationPct:  1.69 },
  { ticker: 'IONQ',  allocationPct:  1.66 },
  { ticker: 'NU',    allocationPct:  1.62 },
  { ticker: 'FUBO',  allocationPct:  1.33 },
  { ticker: 'CEG',   allocationPct:  0.98 },
  { ticker: 'IREN',  allocationPct:  0.98 },
  { ticker: 'PLTR',  allocationPct:  0.80 },
  { ticker: 'SOFI',  allocationPct:  0.71 },
  { ticker: 'MSFT',  allocationPct:  0.39 },
  { ticker: 'GRRR',  allocationPct:  0.31 },
  { ticker: 'SMCI',  allocationPct:  0.06 },
];

function createCurrentPortfolio(library: Stock[]): Portfolio {
  const id = nanoid();
  const tickerToId = new Map(library.map((s) => [s.ticker, s.id]));
  const stocks: PortfolioStock[] = CURRENT_PORTFOLIO_HOLDINGS
    .filter((h) => tickerToId.has(h.ticker))
    .map((h, i) => ({
      stockId: tickerToId.get(h.ticker)!,
      allocationPct: h.allocationPct,
      sortOrder: i,
    }));
  const totalAllocated = stocks.reduce((sum, s) => sum + s.allocationPct, 0);
  return {
    id,
    name: 'Current Portfolio',
    totalCapital: 500891,
    allocationMode: 'percentage',
    stocks,
    cashPct: Math.max(0, 100 - totalAllocated),
    projectionYears: 5,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      stockLibrary: SAMPLE_STOCKS,
      portfolios: [],
      activePortfolioId: null,
      selectedStockId: null,
      projectionDrawerOpen: false,
      _hasHydrated: false,
      setHasHydrated: (v) => set({ _hasHydrated: v }),

      addStockToLibrary: (stock) =>
        set((s) => ({ stockLibrary: [...s.stockLibrary, stock] })),

      updateStockInLibrary: (id, updates) =>
        set((s) => ({
          stockLibrary: s.stockLibrary.map((st) =>
            st.id === id ? { ...st, ...updates } : st
          ),
        })),

      removeStockFromLibrary: (id) =>
        set((s) => ({
          stockLibrary: s.stockLibrary.filter((st) => st.id !== id),
          portfolios: s.portfolios.map((p) => ({
            ...p,
            stocks: p.stocks.filter((ps) => ps.stockId !== id),
          })),
        })),

      createPortfolio: (name) => {
        const portfolio = createDefaultPortfolio(name);
        set((s) => ({
          portfolios: [...s.portfolios, portfolio],
          activePortfolioId: portfolio.id,
        }));
        return portfolio.id;
      },

      deletePortfolio: (id) =>
        set((s) => {
          const remaining = s.portfolios.filter((p) => p.id !== id);
          return {
            portfolios: remaining,
            activePortfolioId:
              s.activePortfolioId === id
                ? remaining[0]?.id ?? null
                : s.activePortfolioId,
          };
        }),

      renamePortfolio: (id, name) =>
        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p
          ),
        })),

      setActivePortfolio: (id) => set({ activePortfolioId: id }),

      duplicatePortfolio: (id) => {
        const source = get().portfolios.find((p) => p.id === id);
        if (!source) return id;
        const copy: Portfolio = {
          ...source,
          id: nanoid(),
          name: `${source.name} (Copy)`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          stocks: source.stocks.map((s) => ({ ...s })),
        };
        set((s) => ({
          portfolios: [...s.portfolios, copy],
          activePortfolioId: copy.id,
        }));
        return copy.id;
      },

      setTotalCapital: (capital) =>
        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, totalCapital: capital, updatedAt: Date.now() }
              : p
          ),
        })),

      setAllocationMode: (mode) =>
        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, allocationMode: mode, updatedAt: Date.now() }
              : p
          ),
        })),

      setProjectionYears: (years) =>
        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, projectionYears: years, updatedAt: Date.now() }
              : p
          ),
        })),

      addStockToPortfolio: (stockId) => {
        const state = get();
        const portfolio = state.portfolios.find(
          (p) => p.id === state.activePortfolioId
        );
        if (!portfolio) return;
        if (portfolio.stocks.find((s) => s.stockId === stockId)) return;

        // Distribute allocations evenly
        const newCount = portfolio.stocks.length + 1;
        const evenPct = parseFloat((100 / (newCount + 1)).toFixed(2)); // +1 for cash
        const newStocks: PortfolioStock[] = [
          ...portfolio.stocks.map((s) => ({ ...s, allocationPct: evenPct })),
          { stockId, allocationPct: evenPct },
        ];
        const usedPct = newStocks.reduce((a, b) => a + b.allocationPct, 0);
        const cashPct = Math.max(0, parseFloat((100 - usedPct).toFixed(2)));

        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, stocks: newStocks, cashPct, updatedAt: Date.now() }
              : p
          ),
        }));
      },

      removeStockFromPortfolio: (stockId) => {
        const state = get();
        const portfolio = state.portfolios.find(
          (p) => p.id === state.activePortfolioId
        );
        if (!portfolio) return;
        const newStocks = portfolio.stocks.filter(
          (s) => s.stockId !== stockId
        );
        const usedPct = newStocks.reduce((a, b) => a + b.allocationPct, 0);
        const cashPct = Math.max(0, parseFloat((100 - usedPct).toFixed(2)));

        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, stocks: newStocks, cashPct, updatedAt: Date.now() }
              : p
          ),
        }));
      },

      updateStockAllocation: (stockId, pct) => {
        const state = get();
        const portfolio = state.portfolios.find(
          (p) => p.id === state.activePortfolioId
        );
        if (!portfolio) return;
        const newStocks = portfolio.stocks.map((s) =>
          s.stockId === stockId ? { ...s, allocationPct: pct } : s
        );
        const usedPct = newStocks.reduce((a, b) => a + b.allocationPct, 0);
        const cashPct = Math.max(0, parseFloat((100 - usedPct).toFixed(2)));

        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, stocks: newStocks, cashPct, updatedAt: Date.now() }
              : p
          ),
        }));
      },

      setCashPct: (pct) =>
        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, cashPct: pct, updatedAt: Date.now() }
              : p
          ),
        })),

      reorderPortfolioStocks: (stocks) =>
        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, stocks, updatedAt: Date.now() }
              : p
          ),
        })),

      normalizeAllocations: () => {
        const state = get();
        const portfolio = state.portfolios.find((p) => p.id === state.activePortfolioId);
        if (!portfolio || portfolio.stocks.length === 0) return;
        const count = portfolio.stocks.length;
        const evenPct = parseFloat((100 / (count + 1)).toFixed(2)); // +1 for cash
        const newStocks = portfolio.stocks.map((s) => ({ ...s, allocationPct: evenPct }));
        const usedPct = newStocks.reduce((a, b) => a + b.allocationPct, 0);
        const cashPct = Math.max(0, parseFloat((100 - usedPct).toFixed(2)));
        set((s) => ({
          portfolios: s.portfolios.map((p) =>
            p.id === s.activePortfolioId
              ? { ...p, stocks: newStocks, cashPct, updatedAt: Date.now() }
              : p
          ),
        }));
      },

      loadCloudData: (data) => {
        // Merge cloud portfolios: cloud is source of truth if it has data
        if (data.portfolios.length > 0) {
          const cloudPortfolios: Portfolio[] = data.portfolios.map((p) => ({
            id: p.id,
            name: p.name,
            totalCapital: p.totalCapital,
            allocationMode: p.allocationMode as 'percentage' | 'dollar',
            cashPct: p.cashPct,
            projectionYears: p.projectionYears,
            // Map DB portfolio_stocks rows to PortfolioStock shape
            stocks: (p.stocks ?? []).map((s) => ({
              stockId: s.stockId,
              allocationPct: s.allocationPct,
            })),
            createdAt: new Date(p.createdAt).getTime(),
            updatedAt: new Date(p.updatedAt).getTime(),
          }));
          const activeId = data.activePortfolioId ?? cloudPortfolios[0]?.id ?? null;
          set({ portfolios: cloudPortfolios, activePortfolioId: activeId });
        }
        // Merge cloud projection overrides into stock library
        if (data.projections.length > 0) {
          const projMap = new Map(data.projections.map((p) => [p.stockId, p.projectionsJson]));
          set((s) => ({
            stockLibrary: s.stockLibrary.map((stock) => {
              const override = projMap.get(stock.id);
              if (!override) return stock;
              return { ...stock, projections: override as typeof stock.projections };
            }),
          }));
        }
      },

      setSelectedStockId: (id) => set({ selectedStockId: id }),
      setProjectionDrawerOpen: (open) => set({ projectionDrawerOpen: open }),
    }),
    {
      name: 'portfolio-planner-v2',
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
          // Only create the pre-built Current Portfolio if none were persisted
          if (state.portfolios.length === 0) {
            const currentPortfolio = createCurrentPortfolio(state.stockLibrary);
            state.portfolios = [currentPortfolio];
            state.activePortfolioId = currentPortfolio.id;
          }
        }
      },
      partialize: (state) => ({
        stockLibrary: state.stockLibrary,
        portfolios: state.portfolios,
        activePortfolioId: state.activePortfolioId,
      }),
      // Merge: always ensure new stocks from SAMPLE_STOCKS are present in the library
      // Also migrate old schema fields to new schema (Revenue→Margin→EPS→P/E model)
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as Partial<PortfolioStore>;

        // Migrate persisted stocks to new schema
        const migratedPersistedStocks = (persisted.stockLibrary ?? []).map((s: any) => {
          const p = s.projections ?? {};
          // Detect old schema: has revenueCurrentYear but not currentRevenueB
          const isOldSchema = p.bear?.revenueCurrentYear !== undefined && p.currentRevenueB === undefined;
          if (!isOldSchema) return s;

          // Find matching sample stock to get fresh data
          const fresh = SAMPLE_STOCKS.find((fs) => fs.ticker === s.ticker);
          if (fresh) return fresh; // Replace entirely with fresh data

          // Manual migration for custom stocks
          const revB = (p.currentRevenue ?? 0) / 1000;
          const niB = (p.currentNetIncome ?? 0) / 1000;
          const sharesB = (p.bear?.sharesOutstanding ?? 1000) / 1000;
          const netMargin = revB > 0 ? (niB / revB) * 100 : 10;

          const migrateScenario = (sc: any) => ({
            revenueGrowthRate: sc?.revenueGrowthRate ?? 10,
            netMarginPct: netMargin,
            peMultiple: sc?.peMultiple ?? 20,
            psMultiple: sc?.psMultiple ?? 5,
            fcfMultiple: sc?.fcfMultiple ?? 20,
            fcfMarginPct: netMargin * 0.8,
          });

          return {
            ...s,
            tag: s.tag ?? s.industry?.split(' ')[0] ?? 'Other',
            projections: {
              ...p,
              currentRevenueB: revB,
              currentNetIncomeB: niB,
              currentSharesB: sharesB,
              currentFCFB: (p.currentFCF ?? 0) / 1000,
              currentMarketCapB: (p.currentMarketCap ?? 0) / 1000,
              currentNetMarginPct: netMargin,
              currentGrossMarginPct: p.bear?.grossMargin ?? 0,
              currentRevenueGrowthPct: 10,
              currentEPSForward: p.currentEPS ?? 0,
              currentPEForward: p.currentPE ?? 20,
              bear: migrateScenario(p.bear),
              base: migrateScenario(p.base),
              bull: migrateScenario(p.bull),
            },
          };
        });

        const existingTickers = new Set(migratedPersistedStocks.map((s: Stock) => s.ticker));
        const newStocks = SAMPLE_STOCKS.filter((s) => !existingTickers.has(s.ticker));
        const finalLibrary = [...migratedPersistedStocks, ...newStocks];
        const validStockIds = new Set(finalLibrary.map((s: Stock) => s.id));

        // Clean up portfolios: remove stale stock references that no longer exist
        const cleanedPortfolios = (persisted.portfolios ?? currentState.portfolios).map((p: any) => ({
          ...p,
          stocks: (p.stocks ?? []).filter((ps: any) => validStockIds.has(ps.stockId)),
        }));

        return {
          ...currentState,
          ...persisted,
          stockLibrary: finalLibrary,
          portfolios: cleanedPortfolios,
        };
      },
    }
  )
);

// Selector helpers
export const getActivePortfolio = (state: PortfolioStore) =>
  state.portfolios.find((p) => p.id === state.activePortfolioId) ?? null;
