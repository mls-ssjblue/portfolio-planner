// Portfolio Planner — Projection Engine
// Calculation chain: Revenue → Net Margin → Net Income → EPS → P/E → Target Price
// (matches 1000x Stocks methodology)

import type { ScenarioProjection, Stock, StockProjections } from './types';

export type Scenario = 'bear' | 'base' | 'bull';

/**
 * Derive the implied net income growth rate from revenue growth and margin assumptions.
 * Formula: impliedNIGrowth = (1 + revenueGrowthRate/100) × (exitNetMarginPct / currentNetMarginPct) - 1
 * This is the single-year equivalent that, when compounded, produces the same N-year NI trajectory
 * as growing revenue at revenueGrowthRate and exiting at exitNetMarginPct.
 *
 * @param revenueGrowthRate  Annual revenue growth rate % (e.g. 15 = 15%)
 * @param exitNetMarginPct   Net margin at exit year % (e.g. 20 = 20%)
 * @param currentNetMarginPct Current net margin % (e.g. 15 = 15%)
 * @returns Annualised NI growth rate % rounded to 1 decimal
 */
export function deriveNIGrowthRate(
  revenueGrowthRate: number,
  exitNetMarginPct: number,
  currentNetMarginPct: number
): number {
  if (currentNetMarginPct <= 0) {
    // If currently unprofitable, fall back to revenue growth as proxy
    return Math.round(revenueGrowthRate * 10) / 10;
  }
  const implied = (1 + revenueGrowthRate / 100) * (exitNetMarginPct / currentNetMarginPct) - 1;
  return Math.round(implied * 1000) / 10; // convert to % with 1 decimal
}

/**
 * Calculate the implied target price for a stock in a given scenario after N years.
 *
 * Primary method (P/E):
 *   Future Revenue = currentRevenueB × (1 + revenueGrowthRate/100)^N  [in $B]
 *   Future Net Income = Future Revenue × (netMarginPct/100)             [in $B]
 *   Future EPS = Future Net Income / currentSharesB                     [$/share]
 *   Target Price = Future EPS × peMultiple
 *
 * Alternative P/S method:
 *   Revenue Per Share = Future Revenue / currentSharesB
 *   Target Price = Revenue Per Share × psMultiple
 *
 * Alternative P/FCF method:
 *   Future FCF = Future Revenue × (fcfMarginPct/100)
 *   FCF Per Share = Future FCF / currentSharesB
 *   Target Price = FCF Per Share × fcfMultiple
 */
export function calcTargetPrice(
  proj: ScenarioProjection,
  currentData: Pick<StockProjections, 'currentPrice' | 'currentRevenueB' | 'currentNetIncomeB' | 'currentSharesB' | 'valuationMethod'>,
  years: number
): number {
  const { currentRevenueB, currentNetIncomeB, currentSharesB, valuationMethod } = currentData;

  // Guard: need shares outstanding
  const shares = currentSharesB > 0 ? currentSharesB : 1;

  // Future revenue in $B
  const futureRevenueB = currentRevenueB * Math.pow(1 + proj.revenueGrowthRate / 100, years);

  // EPS method (default): Net Income grows at netIncomeGrowthRate → EPS → Price
  // Uses midpoint of P/E range if both low and high are provided.
  const calcEPS = (): number => {
    const futureNetIncomeB = currentNetIncomeB * Math.pow(1 + proj.netIncomeGrowthRate / 100, years);
    if (futureNetIncomeB <= 0) return 0;
    const futureEPS = futureNetIncomeB / shares; // both in $B / B shares = $/share
    const effectivePE = (proj.peMultipleLow != null && proj.peMultipleHigh != null)
      ? (proj.peMultipleLow + proj.peMultipleHigh) / 2
      : proj.peMultiple;
    if (effectivePE <= 0) return 0;
    return futureEPS * effectivePE;
  };

  // Revenue P/E method: Revenue → Net Income → EPS → Price
  const calcPE = (): number => {
    if (proj.peMultiple <= 0 || proj.netMarginPct === 0) return 0;
    const futureNetIncomeB = futureRevenueB * (proj.netMarginPct / 100);
    const futureEPS = futureNetIncomeB / shares;
    return futureEPS * proj.peMultiple;
  };

  // P/S method: Revenue per share × P/S multiple
  const calcPS = (): number => {
    if (proj.psMultiple <= 0) return 0;
    const revenuePerShare = futureRevenueB / shares;
    return revenuePerShare * proj.psMultiple;
  };

  // P/FCF method: FCF per share × P/FCF multiple
  const calcFCF = (): number => {
    if (proj.fcfMultiple <= 0 || proj.fcfMarginPct === 0) return 0;
    const futureFCFB = futureRevenueB * (proj.fcfMarginPct / 100);
    const fcfPerShare = futureFCFB / shares;
    return fcfPerShare * proj.fcfMultiple;
  };

  // Manual price override
  if (valuationMethod === 'price') {
    if (proj.targetPriceOverride !== undefined && proj.targetPriceOverride > 0) {
      return proj.targetPriceOverride;
    }
    // Fallback to EPS method
  }

  if (valuationMethod === 'eps') {
    const result = calcEPS();
    if (result > 0) return result;
    const peResult = calcPE();
    if (peResult > 0) return peResult;
    const psResult = calcPS();
    if (psResult > 0) return psResult;
    return calcFCF();
  }

  if (valuationMethod === 'pe') {
    const result = calcPE();
    if (result > 0) return result;
    const psResult = calcPS();
    if (psResult > 0) return psResult;
    return calcFCF();
  }

  if (valuationMethod === 'ps') {
    const result = calcPS();
    if (result > 0) return result;
    const peResult = calcPE();
    if (peResult > 0) return peResult;
    return calcFCF();
  }

  if (valuationMethod === 'fcf') {
    const result = calcFCF();
    if (result > 0) return result;
    const psResult = calcPS();
    if (psResult > 0) return psResult;
    return calcPE();
  }

  // Final fallback: EPS → PE → PS → FCF
  const epsResult = calcEPS();
  if (epsResult > 0) return epsResult;
  const peResult = calcPE();
  if (peResult > 0) return peResult;
  const psResult = calcPS();
  if (psResult > 0) return psResult;
  return calcFCF();
}

/**
 * Calculate the low and high target price bounds using the P/E range.
 * Only meaningful for 'eps' method with peMultipleLow/peMultipleHigh set.
 * Returns { low, mid, high } prices.
 */
export function calcTargetPriceRange(
  proj: ScenarioProjection,
  currentData: Pick<StockProjections, 'currentPrice' | 'currentRevenueB' | 'currentNetIncomeB' | 'currentSharesB' | 'valuationMethod'>,
  years: number
): { low: number; mid: number; high: number } {
  const mid = calcTargetPrice(proj, currentData, years);
  if (proj.peMultipleLow == null || proj.peMultipleHigh == null) {
    return { low: mid, mid, high: mid };
  }
  const shares = currentData.currentSharesB > 0 ? currentData.currentSharesB : 1;
  const futureNetIncomeB = currentData.currentNetIncomeB * Math.pow(1 + proj.netIncomeGrowthRate / 100, years);
  if (futureNetIncomeB <= 0) return { low: 0, mid: 0, high: 0 };
  const futureEPS = futureNetIncomeB / shares;
  return {
    low: futureEPS * proj.peMultipleLow,
    mid,
    high: futureEPS * proj.peMultipleHigh,
  };
}

/**
 * Calculate the return multiple for a stock in a given scenario.
 */
export function calcReturnMultiple(
  stock: Stock,
  scenario: Scenario,
  years: number
): number {
  const proj = stock.projections[scenario];
  const targetPrice = calcTargetPrice(proj, stock.projections, years);
  if (stock.projections.currentPrice <= 0) return 1;
  return targetPrice / stock.projections.currentPrice;
}

/**
 * Calculate CAGR from a return multiple over N years.
 */
export function calcCAGR(returnMultiple: number, years: number): number {
  if (years <= 0 || returnMultiple <= 0) return 0;
  return (Math.pow(returnMultiple, 1 / years) - 1) * 100;
}

/**
 * Calculate the future value of an investment in a stock.
 */
export function calcStockFutureValue(
  investedAmount: number,
  stock: Stock,
  scenario: Scenario,
  years: number
): number {
  const multiple = calcReturnMultiple(stock, scenario, years);
  return investedAmount * multiple;
}

export interface PortfolioProjectionResult {
  scenario: Scenario;
  totalFutureValue: number;
  totalCAGR: number;
  stockBreakdown: {
    stockId: string;
    ticker: string;
    investedAmount: number;
    futureValue: number;
    returnMultiple: number;
    cagr: number;
    targetPrice: number;
  }[];
  cashValue: number;
  yearlyValues: number[]; // index 0 = year 0 (current), index N = year N
}

/**
 * Calculate full portfolio projection for a scenario.
 */
export function calcPortfolioProjection(
  stocks: { stockId: string; allocationPct: number }[],
  cashPct: number,
  totalCapital: number,
  stockLibrary: Stock[],
  scenario: Scenario,
  years: number
): PortfolioProjectionResult {
  const stockBreakdown = stocks.map((ps) => {
    const stock = stockLibrary.find((s) => s.id === ps.stockId);
    if (!stock) {
      return {
        stockId: ps.stockId,
        ticker: '???',
        investedAmount: 0,
        futureValue: 0,
        returnMultiple: 1,
        cagr: 0,
        targetPrice: 0,
      };
    }
    const investedAmount = (ps.allocationPct / 100) * totalCapital;
    const proj = stock.projections[scenario];
    const targetPrice = calcTargetPrice(proj, stock.projections, years);
    const returnMultiple = calcReturnMultiple(stock, scenario, years);
    const futureValue = investedAmount * returnMultiple;
    const cagr = calcCAGR(returnMultiple, years);
    return {
      stockId: ps.stockId,
      ticker: stock.ticker,
      investedAmount,
      futureValue,
      returnMultiple,
      cagr,
      targetPrice,
    };
  });

  const cashValue = (cashPct / 100) * totalCapital; // cash doesn't grow
  const totalFutureValue =
    stockBreakdown.reduce((sum, s) => sum + s.futureValue, 0) + cashValue;
  const totalCAGR = calcCAGR(totalFutureValue / totalCapital, years);

  // Year-by-year values
  const yearlyValues: number[] = [];
  for (let y = 0; y <= years; y++) {
    const yearStockValue = stocks.reduce((sum, ps) => {
      const stock = stockLibrary.find((s) => s.id === ps.stockId);
      if (!stock) return sum;
      const investedAmount = (ps.allocationPct / 100) * totalCapital;
      const multiple = calcReturnMultiple(stock, scenario, y);
      return sum + investedAmount * multiple;
    }, 0);
    yearlyValues.push(yearStockValue + cashValue);
  }

  return {
    scenario,
    totalFutureValue,
    totalCAGR,
    stockBreakdown,
    cashValue,
    yearlyValues,
  };
}

export function formatCurrency(value: number, compact = false): string {
  if (compact) {
    if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (Math.abs(value) >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPct(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}

export function formatMultiple(value: number): string {
  return `${value.toFixed(2)}x`;
}
