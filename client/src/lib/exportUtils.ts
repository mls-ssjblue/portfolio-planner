// Portfolio Planner — Export Utilities
// Supports CSV and JSON export of portfolio allocations and projections

import type { Portfolio, Stock } from './types';
import { calcTargetPrice, calcStockFutureValue, calcCAGR, calcReturnMultiple, type Scenario } from './projections';

// ── CSV Export ────────────────────────────────────────────────────────────────

function escapeCSV(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(...cells: (string | number | undefined)[]): string {
  return cells.map(escapeCSV).join(',');
}

export function exportPortfolioCSV(portfolio: Portfolio, stockLibrary: Stock[]): void {
  const years = portfolio.projectionYears;
  const capital = portfolio.totalCapital;

  const lines: string[] = [];

  // Header
  lines.push(`Portfolio Planner Export`);
  lines.push(`Portfolio: ${portfolio.name}`);
  lines.push(`Total Capital: $${capital.toLocaleString()}`);
  lines.push(`Projection Horizon: ${years} years`);
  lines.push(`Export Date: ${new Date().toLocaleDateString()}`);
  lines.push('');

  // Allocation table
  lines.push('=== CURRENT ALLOCATION ===');
  lines.push(row('Ticker', 'Company', 'Industry', 'Allocation %', 'Allocation $'));

  for (const ps of portfolio.stocks) {
    const stock = stockLibrary.find((s) => s.id === ps.stockId);
    if (!stock) continue;
    const dollarAmt = (ps.allocationPct / 100) * capital;
    lines.push(row(
      stock.ticker,
      stock.name,
      stock.industry,
      ps.allocationPct.toFixed(2) + '%',
      '$' + dollarAmt.toFixed(2),
    ));
  }

  const cashDollar = (portfolio.cashPct / 100) * capital;
  lines.push(row('CASH', 'Uninvested Capital', '-', portfolio.cashPct.toFixed(2) + '%', '$' + cashDollar.toFixed(2)));
  lines.push('');

  // Projections table
  lines.push(`=== ${years}-YEAR PROJECTIONS ===`);
  lines.push(row(
    'Ticker', 'Company', 'Allocation %', 'Invested $',
    'Bear Target Price', 'Bear Return', 'Bear Portfolio Value',
    'Base Target Price', 'Base Return', 'Base Portfolio Value',
    'Bull Target Price', 'Bull Return', 'Bull Portfolio Value',
    'Bear CAGR', 'Base CAGR', 'Bull CAGR',
  ));

  for (const ps of portfolio.stocks) {
    const stock = stockLibrary.find((s) => s.id === ps.stockId);
    if (!stock) continue;
    const invested = (ps.allocationPct / 100) * capital;

    const bearVal = calcStockFutureValue(invested, stock, 'bear', years);
    const baseVal = calcStockFutureValue(invested, stock, 'base', years);
    const bullVal = calcStockFutureValue(invested, stock, 'bull', years);
    const bearPrice = calcTargetPrice(stock.projections.bear, stock.projections, years);
    const basePrice = calcTargetPrice(stock.projections.base, stock.projections, years);
    const bullPrice = calcTargetPrice(stock.projections.bull, stock.projections, years);
    const bearMult = calcReturnMultiple(stock, 'bear', years);
    const baseMult = calcReturnMultiple(stock, 'base', years);
    const bullMult = calcReturnMultiple(stock, 'bull', years);

    const cagr = (mult: number) => {
      const c = calcCAGR(mult, years) * 100;
      return c.toFixed(1) + '%';
    };

    lines.push(row(
      stock.ticker,
      stock.name,
      ps.allocationPct.toFixed(2) + '%',
      '$' + invested.toFixed(2),
      bearPrice ? '$' + bearPrice.toFixed(2) : 'N/A',
      ((bearMult - 1) * 100).toFixed(1) + '%',
      '$' + bearVal.toFixed(2),
      basePrice ? '$' + basePrice.toFixed(2) : 'N/A',
      ((baseMult - 1) * 100).toFixed(1) + '%',
      '$' + baseVal.toFixed(2),
      bullPrice ? '$' + bullPrice.toFixed(2) : 'N/A',
      ((bullMult - 1) * 100).toFixed(1) + '%',
      '$' + bullVal.toFixed(2),
      cagr(bearMult),
      cagr(baseMult),
      cagr(bullMult),
    ));
  }

  // Portfolio totals
  lines.push('');
  lines.push('=== PORTFOLIO TOTALS ===');
  let totalBear = cashDollar, totalBase = cashDollar, totalBull = cashDollar;
  for (const ps of portfolio.stocks) {
    const stock = stockLibrary.find((s) => s.id === ps.stockId);
    if (!stock) continue;
    const invested = (ps.allocationPct / 100) * capital;
    totalBear += calcStockFutureValue(invested, stock, 'bear', years);
    totalBase += calcStockFutureValue(invested, stock, 'base', years);
    totalBull += calcStockFutureValue(invested, stock, 'bull', years);
  }
  const portCagr = (total: number) => {
    if (capital <= 0) return 'N/A';
    return ((Math.pow(total / capital, 1 / years) - 1) * 100).toFixed(1) + '%';
  };
  lines.push(row('', '', '', '', '', '', '$' + totalBear.toFixed(2), '', '', '$' + totalBase.toFixed(2), '', '', '$' + totalBull.toFixed(2)));
  lines.push(row('', '', 'Portfolio CAGR', '', '', '', portCagr(totalBear), '', '', portCagr(totalBase), '', '', portCagr(totalBull)));

  const csv = lines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${portfolio.name.replace(/\s+/g, '_')}_portfolio_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── JSON Export (all portfolios) ──────────────────────────────────────────────

export function exportAllPortfoliosJSON(portfolios: Portfolio[], stockLibrary: Stock[]): void {
  const data = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    portfolios,
    stockLibrary,
  };
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `portfolio_planner_backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── JSON Import ───────────────────────────────────────────────────────────────

export interface ImportResult {
  portfolios: Portfolio[];
  stockLibrary: Stock[];
}

export function importPortfoliosJSON(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.portfolios || !data.stockLibrary) {
          reject(new Error('Invalid file format'));
          return;
        }
        resolve({ portfolios: data.portfolios, stockLibrary: data.stockLibrary });
      } catch {
        reject(new Error('Failed to parse JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
