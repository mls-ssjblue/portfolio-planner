// Portfolio Planner — Core Types
// Design: Sophisticated Finance Dashboard (deep navy + gold)

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

export interface ScenarioProjection {
  // Revenue projections
  revenueCurrentYear: number; // in millions
  revenueGrowthRate: number; // % per year
  // Net income / earnings
  netIncomeCurrentYear: number; // in millions
  netIncomeGrowthRate: number; // % per year
  // Valuation multiple
  psMultiple: number; // Price-to-Sales
  peMultiple: number; // Price-to-Earnings
  // EPS
  epsCurrentYear: number;
  epsGrowthRate: number;
  // Gross Margin
  grossMargin: number; // %
  // FCF
  fcfCurrentYear: number; // in millions
  fcfGrowthRate: number; // % per year
  // FCF multiple
  fcfMultiple: number;
  // Shares outstanding (millions)
  sharesOutstanding: number;
  // Target price (derived or manual override)
  targetPriceOverride?: number;
}

export interface StockProjections {
  bear: ScenarioProjection;
  base: ScenarioProjection;
  bull: ScenarioProjection;
  // Current data
  currentPrice: number;
  currentMarketCap: number; // in millions
  currentRevenue: number; // in millions TTM
  currentNetIncome: number; // in millions TTM
  currentEPS: number;
  currentPE: number;
  currentPS: number;
  currentFCF: number; // in millions TTM
  // Valuation method preference
  valuationMethod: 'pe' | 'ps' | 'fcf' | 'price';
}

export interface Stock {
  id: string;
  ticker: string;
  name: string;
  industry: Industry;
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
  revenueCurrentYear: 0,
  revenueGrowthRate: 10,
  netIncomeCurrentYear: 0,
  netIncomeGrowthRate: 10,
  psMultiple: 10,
  peMultiple: 20,
  epsCurrentYear: 0,
  epsGrowthRate: 10,
  grossMargin: 50,
  fcfCurrentYear: 0,
  fcfGrowthRate: 10,
  fcfMultiple: 20,
  sharesOutstanding: 1000,
};

export const DEFAULT_PROJECTIONS: StockProjections = {
  bear: { ...DEFAULT_SCENARIO, revenueGrowthRate: 5, netIncomeGrowthRate: 5, psMultiple: 8, peMultiple: 15, epsGrowthRate: 5, fcfGrowthRate: 5, fcfMultiple: 15 },
  base: { ...DEFAULT_SCENARIO },
  bull: { ...DEFAULT_SCENARIO, revenueGrowthRate: 20, netIncomeGrowthRate: 20, psMultiple: 15, peMultiple: 30, epsGrowthRate: 20, fcfGrowthRate: 20, fcfMultiple: 30 },
  currentPrice: 100,
  currentMarketCap: 100000,
  currentRevenue: 10000,
  currentNetIncome: 1000,
  currentEPS: 5,
  currentPE: 20,
  currentPS: 10,
  currentFCF: 800,
  valuationMethod: 'ps', // Default to P/S — most relevant for growth stocks
};
