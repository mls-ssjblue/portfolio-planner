// Portfolio Planner — Live Price Hook
// Fetches real-time prices from Yahoo Finance for all tickers in the active portfolio.
// Prices are cached in module-level state and refreshed every 60 seconds.

import { useState, useEffect, useRef } from 'react';

// Module-level cache shared across all hook instances
const priceCache = new Map<string, { price: number; change: number; changePct: number; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

async function fetchPrice(ticker: string): Promise<{ price: number; change: number; changePct: number } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;

    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return { price, change, changePct };
  } catch {
    return null;
  }
}

export interface LivePrice {
  price: number;
  change: number;
  changePct: number;
  loading: boolean;
}

export function useLivePrices(tickers: string[]): Map<string, LivePrice> {
  const [prices, setPrices] = useState<Map<string, LivePrice>>(() => new Map());
  const tickersKey = tickers.slice().sort().join(',');
  const prevKeyRef = useRef('');

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    const loadPrices = async () => {
      // Seed with cached values immediately so UI shows something right away
      const initial = new Map<string, LivePrice>();
      const toFetch: string[] = [];

      for (const ticker of tickers) {
        const cached = priceCache.get(ticker);
        const isStale = !cached || Date.now() - cached.fetchedAt > CACHE_TTL_MS;
        if (cached) {
          initial.set(ticker, { ...cached, loading: isStale });
        } else {
          initial.set(ticker, { price: 0, change: 0, changePct: 0, loading: true });
        }
        if (isStale) toFetch.push(ticker);
      }

      if (!cancelled) setPrices(new Map(initial));
      if (toFetch.length === 0) return;

      // Fetch stale/missing prices in parallel (batched to avoid rate limits)
      const BATCH = 5;
      for (let i = 0; i < toFetch.length; i += BATCH) {
        if (cancelled) return;
        const batch = toFetch.slice(i, i + BATCH);
        const results = await Promise.all(batch.map((t) => fetchPrice(t).then((r) => ({ ticker: t, result: r }))));
        if (cancelled) return;

        setPrices((prev) => {
          const next = new Map(prev);
          for (const { ticker, result } of results) {
            if (result) {
              const entry = { ...result, fetchedAt: Date.now() };
              priceCache.set(ticker, entry);
              next.set(ticker, { ...result, loading: false });
            } else {
              // Keep whatever we had, just mark not loading
              const existing = next.get(ticker);
              if (existing) next.set(ticker, { ...existing, loading: false });
            }
          }
          return next;
        });
      }
    };

    loadPrices();

    // Refresh every 60 seconds
    const interval = setInterval(loadPrices, CACHE_TTL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  return prices;
}
