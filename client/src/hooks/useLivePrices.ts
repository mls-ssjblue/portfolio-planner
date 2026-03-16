// Portfolio Planner — Live Price Hook
// Fetches real-time prices via the server-side /api/prices proxy (avoids CORS).
// Prices are cached in module-level state and refreshed every 60 seconds.

import { useState, useEffect, useRef } from 'react';

// Module-level cache shared across all hook instances
const priceCache = new Map<string, { price: number; change: number; changePct: number; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000; // 1 minute

async function fetchPricesBatch(tickers: string[]): Promise<Record<string, { price: number; change: number; changePct: number }>> {
  if (tickers.length === 0) return {};
  try {
    const res = await fetch(`/api/prices?tickers=${encodeURIComponent(tickers.join(','))}`);
    if (!res.ok) return {};
    return await res.json() as Record<string, { price: number; change: number; changePct: number }>;
  } catch {
    return {};
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

      // Fetch all stale/missing tickers in a single batched server request
      const results = await fetchPricesBatch(toFetch);
      if (cancelled) return;

      const fetchedAt = Date.now();
      setPrices((prev) => {
        const next = new Map(prev);
        for (const ticker of toFetch) {
          const result = results[ticker];
          if (result) {
            priceCache.set(ticker, { ...result, fetchedAt });
            next.set(ticker, { ...result, loading: false });
          } else {
            const existing = next.get(ticker);
            if (existing) next.set(ticker, { ...existing, loading: false });
          }
        }
        return next;
      });
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
