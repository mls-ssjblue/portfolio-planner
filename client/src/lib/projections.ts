// Portfolio Planner — Projection Engine
// Calculates target prices and portfolio values for bear/base/bull scenarios

import type { ScenarioProjection, Stock, StockProjections } from './types';

export type Scenario = 'bear' | 'base' | 'bull';

/**
 * Calculate the implied target price for a stock in a given scenario after N years.
 * Uses the selected valuation method.
 */
export function calcTargetPrice(
  proj: ScenarioProjection,
  currentData: Pick<StockProjections, 'currentPrice' | 'valuationMethod'>,
  years: number
): number {
  const method = currentData.valuationMethod;

  // Helper: P/S target price
  const calcPS = () => {
    if (proj.sharesOutstanding <= 0) return 0;
    const futureRevenue = proj.revenueCurrentYear * Math.pow(1 + proj.revenueGrowthRate / 100, years);
    const revenuePerShare = (futureRevenue * 1e6) / (proj.sharesOutstanding * 1e6);
    return revenuePerShare * proj.psMultiple;
  };

  // Helper: P/E target price
  const calcPE = () => {
    const futureEPS = proj.epsCurrentYear * Math.pow(1 + proj.epsGrowthRate / 100, years);
    return futureEPS * proj.peMultiple;
  };

  // Helper: P/FCF target price
  const calcFCF = () => {
    if (proj.sharesOutstanding <= 0) return 0;
    const futureFCF = proj.fcfCurrentYear * Math.pow(1 + proj.fcfGrowthRate / 100, years);
    const fcfPerShare = (futureFCF * 1e6) / (proj.sharesOutstanding * 1e6);
    return fcfPerShare * proj.fcfMultiple;
  };

  // Manual price override (e.g. BTC, ETF)
  if (method === 'price') {
    if (proj.targetPriceOverride !== undefined && proj.targetPriceOverride > 0) {
      return proj.targetPriceOverride;
    }
    // Fallback to best available method
  }

  if (method === 'pe') {
    const result = calcPE();
    if (result > 0) return result;
    // Auto-fallback: try P/S if EPS is zero
    const psResult = calcPS();
    if (psResult > 0) return psResult;
    return calcFCF();
  }

  if (method === 'ps') {
    const result = calcPS();
    if (result > 0) return result;
    // Auto-fallback: try P/E if revenue/shares are zero
    const peResult = calcPE();
    if (peResult > 0) return peResult;
    return calcFCF();
  }

  if (method === 'fcf') {
    const result = calcFCF();
    if (result > 0) return result;
    const psResult = calcPS();
    if (psResult > 0) return psResult;
    return calcPE();
  }

  // Final fallback: try all methods in order
  const peResult = calcPE();
  if (peResult > 0) return peResult;
  const psResult = calcPS();
  if (psResult > 0) return psResult;
  return calcFCF();
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
