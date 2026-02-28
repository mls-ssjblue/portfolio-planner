// Portfolio Planner — Core Types
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Projection model: Revenue → Net Margin → Net Income → EPS → P/E → Target Price
// (matches 1000x Stocks methodology)

export type Industry =
  | 'Technology'
  | 'Healthcare'
  | 'Financials'
  | 'Consumer Discretionary'
  | 'Consumer Staples'
  | 'Energy'
  | 'Industrials'
  | 'Materials'
  | 'Real Estate'
  | 'Utilities'
  | 'Communication Services'
  | 'Crypto'
  | 'ETF'
  | 'Other';

/**
 * Per-scenario projection inputs.
 * The calculation chain is:
 *   Future Revenue = currentRevenue × (1 + revenueGrowthRate/100)^N
 *   Future Net Income = Future Revenue × (netMarginPct/100)
 *   Future EPS = Future Net Income / sharesOutstanding (in same units)
 *   Target Price (P/E) = Future EPS × peMultiple
 *   Target Price (P/S) = (Future Revenue / sharesOutstanding) × psMultiple
 *   Target Price (P/FCF) = (Future FCF / sharesOutstanding) × fcfMultiple
 */
export interface ScenarioProjection {
  // ── Revenue inputs ──────────────────────────────────────────────────────
  revenueGrowthRate: number;    // % per year (e.g. 20 = 20%)

  // ── Profitability inputs ─────────────────────────────────────────────────
  netMarginPct: number;         // Net margin at exit year (e.g. 15 = 15%)

  // ── Valuation multiple inputs ────────────────────────────────────────────
  peMultiple: number;           // Exit P/E multiple
  psMultiple: number;           // Exit P/S multiple (alternative method)
  fcfMultiple: number;          // Exit P/FCF multiple (alternative method)

  // ── FCF inputs (optional alternative) ───────────────────────────────────
  fcfMarginPct: number;         // FCF margin at exit year (e.g. 12 = 12%)

  // ── Target price override ────────────────────────────────────────────────
  targetPriceOverride?: number; // Manual override (for crypto/ETF)
}

export interface StockProjections {
  bear: ScenarioProjection;
  base: ScenarioProjection;
  bull: ScenarioProjection;

  // ── Live / current data (fetched from Yahoo Finance) ─────────────────────
  currentPrice: number;         // Current stock price
  currentMarketCapB: number;    // Market cap in $B
  currentRevenueB: number;      // Revenue TTM in $B
  currentNetIncomeB: number;    // Net income TTM in $B
  currentEPS: number;           // EPS TTM
  currentEPSForward: number;    // Forward EPS (analyst estimate)
  currentSharesB: number;       // Shares outstanding in billions
  currentFCFB: number;          // Free cash flow TTM in $B
  currentNetMarginPct: number;  // Net margin % TTM
  currentGrossMarginPct: number;// Gross margin % TTM
  currentRevenueGrowthPct: number; // Revenue growth YoY %
  currentPE: number;            // Trailing P/E
  currentPEForward: number;     // Forward P/E
  currentPS: number;            // Price/Sales

  // ── Valuation method preference ──────────────────────────────────────────
  valuationMethod: 'pe' | 'ps' | 'fcf' | 'price';

  // ── Data freshness ───────────────────────────────────────────────────────
  dataAsOf?: string;            // ISO date string when data was last fetched
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  industry: Industry;
  tag: string;                  // Short display tag (e.g. "Tech", "Semis", "Fintech")
  projections: StockProjections;
}

export type AllocationMode = 'percentage' | 'dollar';

export interface PortfolioStock {
  stockId: string;
  allocationPct: number; // 0-100
}

export interface Portfolio {
  id: string;
  name: string;
  totalCapital: number; // in dollars
  allocationMode: AllocationMode;
  stocks: PortfolioStock[];
  cashPct: number; // 0-100, remainder after stocks
  projectionYears: number; // N years for projection
  createdAt: number;
  updatedAt: number;
}

export const INDUSTRY_COLORS: Record<Industry, string> = {
  'Technology': '#3b82f6',
  'Healthcare': '#10b981',
  'Financials': '#f59e0b',
  'Consumer Discretionary': '#8b5cf6',
  'Consumer Staples': '#06b6d4',
  'Energy': '#f97316',
  'Industrials': '#6b7280',
  'Materials': '#84cc16',
  'Real Estate': '#ec4899',
  'Utilities': '#14b8a6',
  'Communication Services': '#a855f7',
  'Crypto': '#f59e0b',
  'ETF': '#94a3b8',
  'Other': '#64748b',
};

export const DEFAULT_SCENARIO: ScenarioProjection = {
  revenueGrowthRate: 10,
  netMarginPct: 10,
  peMultiple: 20,
  psMultiple: 5,
  fcfMultiple: 20,
  fcfMarginPct: 8,
};

export const DEFAULT_PROJECTIONS: StockProjections = {
  bear: {
    ...DEFAULT_SCENARIO,
    revenueGrowthRate: 5,
    netMarginPct: 8,
    peMultiple: 15,
    psMultiple: 3,
    fcfMultiple: 15,
    fcfMarginPct: 5,
  },
  base: { ...DEFAULT_SCENARIO },
  bull: {
    ...DEFAULT_SCENARIO,
    revenueGrowthRate: 20,
    netMarginPct: 15,
    peMultiple: 30,
    psMultiple: 8,
    fcfMultiple: 30,
    fcfMarginPct: 12,
  },
  currentPrice: 100,
  currentMarketCapB: 10,
  currentRevenueB: 2,
  currentNetIncomeB: 0.2,
  currentEPS: 1,
  currentEPSForward: 1.2,
  currentSharesB: 0.5,
  currentFCFB: 0.15,
  currentNetMarginPct: 10,
  currentGrossMarginPct: 40,
  currentRevenueGrowthPct: 10,
  currentPE: 20,
  currentPEForward: 18,
  currentPS: 5,
  valuationMethod: 'pe',
  dataAsOf: '2026-02-28',
};
