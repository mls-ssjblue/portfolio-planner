// Portfolio Planner — Live Stock Data Refresh Hook
// Fetches latest price + financials from Yahoo Finance via public CORS proxy
// Falls back gracefully if the API is unavailable

import { useState, useCallback } from 'react';
import { usePortfolioStore } from '@/lib/store';
import type { StockProjections } from '@/lib/types';

interface YFQuoteSummary {
  price?: number;
  marketCapB?: number;
  revenueB?: number;
  netIncomeB?: number;
  eps?: number;
  epsForward?: number;
  sharesB?: number;
  fcfB?: number;
  netMarginPct?: number;
  grossMarginPct?: number;
  revenueGrowthPct?: number;
  peTrailing?: number;
  peForward?: number;
  psRatio?: number;
}

async function fetchYahooFinanceData(ticker: string): Promise<YFQuoteSummary | null> {
  // Use the Yahoo Finance v8 quote endpoint (public, no API key needed)
  const modules = 'financialData,defaultKeyStatistics,summaryDetail,incomeStatementHistory,cashflowStatementHistory';
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${modules}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.quoteSummary?.result?.[0];
    if (!result) return null;

    const fd = result.financialData ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const sd = result.summaryDetail ?? {};

    const price = fd.currentPrice?.raw ?? sd.regularMarketPrice?.raw ?? 0;
    const sharesB = ks.sharesOutstanding?.raw ? ks.sharesOutstanding.raw / 1e9 : 0;
    const marketCapB = ks.marketCap?.raw ? ks.marketCap.raw / 1e9 : 0;
    const revenueB = fd.totalRevenue?.raw ? fd.totalRevenue.raw / 1e9 : 0;
    const netIncomeB = fd.netIncomeToCommon?.raw ? fd.netIncomeToCommon.raw / 1e9 : 0;
    const fcfB = fd.freeCashflow?.raw ? fd.freeCashflow.raw / 1e9 : 0;
    const eps = ks.trailingEps?.raw ?? 0;
    const epsForward = ks.forwardEps?.raw ?? 0;
    const netMarginPct = fd.profitMargins?.raw ? fd.profitMargins.raw * 100 : 0;
    const grossMarginPct = fd.grossMargins?.raw ? fd.grossMargins.raw * 100 : 0;
    const revenueGrowthPct = fd.revenueGrowth?.raw ? fd.revenueGrowth.raw * 100 : 0;
    const peTrailing = sd.trailingPE?.raw ?? 0;
    const peForward = sd.forwardPE?.raw ?? ks.forwardPE?.raw ?? 0;
    const psRatio = ks.priceToSalesTrailing12Months?.raw ?? 0;

    return {
      price,
      marketCapB,
      revenueB,
      netIncomeB,
      eps,
      epsForward,
      sharesB,
      fcfB,
      netMarginPct,
      grossMarginPct,
      revenueGrowthPct,
      peTrailing,
      peForward,
      psRatio,
    };
  } catch {
    return null;
  }
}

export function useStockRefresh() {
  const [refreshingTicker, setRefreshingTicker] = useState<string | null>(null);
  const updateStockInLibrary = usePortfolioStore((s) => s.updateStockInLibrary);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);

  const refreshStock = useCallback(async (stockId: string): Promise<boolean> => {
    const stock = stockLibrary.find((s) => s.id === stockId);
    if (!stock) return false;

    setRefreshingTicker(stock.ticker);

    try {
      const data = await fetchYahooFinanceData(stock.ticker);
      if (!data) return false;

      const updates: Partial<StockProjections> = {};

      if (data.price && data.price > 0) updates.currentPrice = data.price;
      if (data.marketCapB && data.marketCapB > 0) updates.currentMarketCapB = data.marketCapB;
      if (data.revenueB && data.revenueB > 0) updates.currentRevenueB = data.revenueB;
      if (data.netIncomeB !== undefined) updates.currentNetIncomeB = data.netIncomeB;
      if (data.eps !== undefined) updates.currentEPS = data.eps;
      if (data.epsForward && data.epsForward > 0) updates.currentEPSForward = data.epsForward;
      if (data.sharesB && data.sharesB > 0) updates.currentSharesB = data.sharesB;
      if (data.fcfB !== undefined) updates.currentFCFB = data.fcfB;
      if (data.netMarginPct !== undefined) updates.currentNetMarginPct = data.netMarginPct;
      if (data.grossMarginPct && data.grossMarginPct > 0) updates.currentGrossMarginPct = data.grossMarginPct;
      if (data.revenueGrowthPct !== undefined) updates.currentRevenueGrowthPct = data.revenueGrowthPct;
      if (data.peTrailing && data.peTrailing > 0) updates.currentPE = data.peTrailing;
      if (data.peForward && data.peForward > 0) updates.currentPEForward = data.peForward;
      if (data.psRatio && data.psRatio > 0) updates.currentPS = data.psRatio;

      updates.dataAsOf = new Date().toISOString().split('T')[0];

      updateStockInLibrary(stockId, {
        projections: {
          ...stock.projections,
          ...updates,
        },
      });

      return true;
    } finally {
      setRefreshingTicker(null);
    }
  }, [stockLibrary, updateStockInLibrary]);

  return { refreshStock, refreshingTicker };
}
