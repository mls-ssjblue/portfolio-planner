// Portfolio Planner — State Store
// Design: Sophisticated Finance Dashboard (deep navy + gold)

import { nanoid } from 'nanoid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Portfolio, PortfolioStock, Stock } from './types';
import { DEFAULT_PROJECTIONS, SAMPLE_STOCKS } from './sampleData';

interface PortfolioStore {
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

export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      stockLibrary: SAMPLE_STOCKS,
      portfolios: [],
      activePortfolioId: null,
      selectedStockId: null,
      projectionDrawerOpen: false,

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

      setSelectedStockId: (id) => set({ selectedStockId: id }),
      setProjectionDrawerOpen: (open) => set({ projectionDrawerOpen: open }),
    }),
    {
      name: 'portfolio-planner-v2',
      partialize: (state) => ({
        stockLibrary: state.stockLibrary,
        portfolios: state.portfolios,
        activePortfolioId: state.activePortfolioId,
      }),
      // Merge: always ensure new stocks from SAMPLE_STOCKS are present in the library
      merge: (persistedState: unknown, currentState) => {
        const persisted = persistedState as Partial<PortfolioStore>;
        const existingTickers = new Set(
          (persisted.stockLibrary ?? []).map((s: Stock) => s.ticker)
        );
        const newStocks = SAMPLE_STOCKS.filter((s) => !existingTickers.has(s.ticker));
        return {
          ...currentState,
          ...persisted,
          stockLibrary: [
            ...(persisted.stockLibrary ?? []),
            ...newStocks,
          ],
        };
      },
    }
  )
);

// Selector helpers
export const getActivePortfolio = (state: PortfolioStore) =>
  state.portfolios.find((p) => p.id === state.activePortfolioId) ?? null;
