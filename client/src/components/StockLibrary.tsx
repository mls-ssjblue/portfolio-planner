// Stock Library — Sidebar component
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Supports: search across full S&P 500 catalog, drag-and-drop, click-to-add, custom stock dialog

import { useState, useMemo } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Search, TrendingUp, X, BookOpen, GripVertical, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePortfolioStore } from '@/lib/store';
import type { Industry, Stock } from '@/lib/types';
import { INDUSTRY_COLORS, DEFAULT_PROJECTIONS } from '@/lib/types';
import { SP500_STOCKS } from '@/lib/sp500';
import { nanoid } from 'nanoid';
import { toast } from 'sonner';
import AddCustomStockDialog from './AddCustomStockDialog';

const INDUSTRIES: Industry[] = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Consumer Staples', 'Energy', 'Industrials', 'Materials',
  'Real Estate', 'Utilities', 'Communication Services', 'Crypto', 'ETF', 'Other',
];

// ── Draggable Stock Card (for stocks already in library) ──────────────────────
function DraggableStockCard({ stock, isInPortfolio }: { stock: Stock; isInPortfolio: boolean }) {
  const addStockToPortfolio = usePortfolioStore((s) => s.addStockToPortfolio);
  const removeStockFromPortfolio = usePortfolioStore((s) => s.removeStockFromPortfolio);
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${stock.id}`,
    data: { type: 'library-stock', stockId: stock.id },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 999 : undefined,
  };

  const color = INDUSTRY_COLORS[stock.industry];

  const handleClick = () => {
    if (isInPortfolio) {
      removeStockFromPortfolio(stock.id);
    } else {
      addStockToPortfolio(stock.id);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={handleClick}
      className={`group relative flex items-center gap-2.5 p-2.5 rounded-lg border transition-all duration-150 select-none touch-auto
        ${isInPortfolio
          ? 'border-[oklch(0.68_0.12_75/22%)] bg-[oklch(0.68_0.12_75/5%)]'
          : 'border-[oklch(1_0_0/6%)] bg-[oklch(1_0_0/3%)] hover:border-[oklch(1_0_0/12%)] hover:bg-[oklch(1_0_0/5%)]'
        }`}
    >
      {/* Drag handle — listeners only here so touch scroll is not blocked on the rest of the card */}
      <div
        className="shrink-0 p-0.5 -m-0.5 rounded cursor-grab active:cursor-grabbing touch-none"
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="w-3 h-3 text-muted-foreground opacity-30 group-hover:opacity-70" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-foreground">{stock.ticker}</span>
          {isInPortfolio && (
            <span className="text-[10px] text-[oklch(0.68_0.12_75)] font-medium">✓</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{stock.name}</p>
      </div>
      <div
        className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium"
        style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
      >
        {stock.industry.split(' ')[0]}
      </div>
    </div>
  );
}

// ── Catalog Result Card (for S&P 500 stocks not yet in library) ───────────────
function CatalogResultCard({ ticker, name, industry }: { ticker: string; name: string; industry: Industry }) {
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);
  const addStockToLibrary = usePortfolioStore((s) => s.addStockToLibrary);
  const addStockToPortfolio = usePortfolioStore((s) => s.addStockToPortfolio);
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);

  const color = INDUSTRY_COLORS[industry];
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);

  // Check if already in library
  const existingStock = stockLibrary.find((s) => s.ticker === ticker);
  const isInPortfolio = existingStock
    ? (activePortfolio?.stocks.some((s) => s.stockId === existingStock.id) ?? false)
    : false;

  const handleAdd = () => {
    if (existingStock) {
      // Already in library — just add to portfolio
      if (!isInPortfolio) {
        addStockToPortfolio(existingStock.id);
        toast.success(`${ticker} added to portfolio`);
      }
      return;
    }
    // Create new stock with default projections and add to library + portfolio
    const newStock: Stock = {
      id: nanoid(),
      ticker,
      name,
      industry,
      tag: industry.split(' ')[0],
      projections: { ...DEFAULT_PROJECTIONS },
    };
    addStockToLibrary(newStock);
    // Wait a tick for state to update, then add to portfolio
    setTimeout(() => {
      addStockToPortfolio(newStock.id);
    }, 0);
    toast.success(`${ticker} added — fill in projections to model it`);
  };

  return (
    <div
      onClick={handleAdd}
      className={`group relative flex items-center gap-2.5 p-2.5 rounded-lg border transition-all duration-150 select-none cursor-pointer
        ${isInPortfolio
          ? 'border-[oklch(0.68_0.12_75/22%)] bg-[oklch(0.68_0.12_75/5%)]'
          : 'border-[oklch(1_0_0/6%)] bg-[oklch(1_0_0/2%)] hover:border-[oklch(1_0_0/12%)] hover:bg-[oklch(1_0_0/5%)]'
        }`}
    >
      <div className="shrink-0">
        <Plus className="w-3 h-3 text-muted-foreground opacity-40 group-hover:opacity-80 group-hover:text-[oklch(0.68_0.12_75)]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-foreground">{ticker}</span>
          {isInPortfolio && (
            <span className="text-[10px] text-[oklch(0.68_0.12_75)] font-medium">✓</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">{name}</p>
      </div>
      <div className="flex items-center gap-1.5">
        <div
          className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium"
          style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
        >
          {industry.split(' ')[0]}
        </div>
        <span className="text-[9px] text-muted-foreground/50 group-hover:text-[oklch(0.68_0.12_75/55%)] transition-colors">+Add</span>
      </div>
    </div>
  );
}

// ── Main StockLibrary Component ───────────────────────────────────────────────
export default function StockLibrary() {
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const [search, setSearch] = useState('');
  const [industryFilter, setIndustryFilter] = useState<Industry | 'All'>('All');

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  const portfolioStockIds = new Set(activePortfolio?.stocks.map((s) => s.stockId) ?? []);

  // Tickers already in library
  const libraryTickers = useMemo(() => new Set(stockLibrary.map((s) => s.ticker)), [stockLibrary]);

  // Filter library stocks — sorted alphabetically by ticker
  const filteredLibrary = useMemo(() => {
    const q = search.toLowerCase();
    return stockLibrary
      .filter((s) => {
        const matchSearch = !q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
        const matchIndustry = industryFilter === 'All' || s.industry === industryFilter;
        return matchSearch && matchIndustry;
      })
      .sort((a, b) => a.ticker.localeCompare(b.ticker));
  }, [stockLibrary, search, industryFilter]);

  // Search S&P 500 catalog for stocks NOT already in library
  const catalogResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return SP500_STOCKS.filter((s) => {
      if (libraryTickers.has(s.ticker)) return false; // already in library
      const matchSearch = s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
      const matchIndustry = industryFilter === 'All' || s.industry === industryFilter;
      return matchSearch && matchIndustry;
    }).slice(0, 20); // limit to 20 catalog results
  }, [search, industryFilter, libraryTickers]);

  const industries = useMemo(
    () => ['All', ...Array.from(new Set(stockLibrary.map((s) => s.industry)))],
    [stockLibrary]
  );

  const hasSearch = search.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-[oklch(0.21_0.03_155)] border-r border-[oklch(1_0_0/8%)]">
      {/* Header */}
      <div className="p-4 border-b border-[oklch(1_0_0/8%)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[oklch(0.68_0.12_75)]" />
            <h2 className="text-sm font-semibold text-foreground">Stock Library</h2>
            <span className="text-[10px] text-muted-foreground bg-[oklch(1_0_0/5%)] px-1.5 py-0.5 rounded">
              {stockLibrary.length}
            </span>
          </div>
          <AddCustomStockDialog />
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search S&P 500..."
            className="pl-8 h-8 text-xs bg-[oklch(1_0_0/4%)] border-[oklch(1_0_0/8%)] focus:border-[oklch(0.68_0.12_75/38%)]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Industry filter pills */}
      <div className="px-3 py-2 border-b border-[oklch(1_0_0/8%)]">
        <div className="overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          <div className="flex gap-1.5 pb-1">
            {industries.map((ind) => (
              <button
                key={ind}
                onClick={() => setIndustryFilter(ind as Industry | 'All')}
                style={{ touchAction: 'manipulation' }}
                className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-medium transition-colors
                  ${industryFilter === ind
                    ? 'bg-[oklch(0.68_0.12_75)] text-[oklch(0.19_0.03_155)]'
                    : 'bg-[oklch(1_0_0/5%)] text-muted-foreground hover:text-foreground hover:bg-[oklch(1_0_0/8%)]'
                  }`}
              >
                {ind === 'All' ? 'All' : ind.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stock list */}
      <div
        className="flex-1 px-3 py-3 overflow-y-auto"
        style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="space-y-1.5">
          {/* Library stocks (with drag support) */}
          {filteredLibrary.length === 0 && !hasSearch && (
            <p className="text-xs text-muted-foreground text-center py-8">No stocks in library</p>
          )}
          {filteredLibrary.map((stock) => (
            <DraggableStockCard
              key={stock.id}
              stock={stock}
              isInPortfolio={portfolioStockIds.has(stock.id)}
            />
          ))}

          {/* S&P 500 catalog results (click-to-add only) */}
          {hasSearch && catalogResults.length > 0 && (
            <>
              <div className="flex items-center gap-2 pt-2 pb-1">
                <div className="flex-1 h-px bg-[oklch(1_0_0/8%)]" />
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <BookOpen className="w-3 h-3" />
                  S&P 500 Catalog
                </div>
                <div className="flex-1 h-px bg-[oklch(1_0_0/8%)]" />
              </div>
              {catalogResults.map((s) => (
                <CatalogResultCard
                  key={s.ticker}
                  ticker={s.ticker}
                  name={s.name}
                  industry={s.industry}
                />
              ))}
            </>
          )}

          {hasSearch && filteredLibrary.length === 0 && catalogResults.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              No results for "{search}"
            </p>
          )}
        </div>

        {!hasSearch && (
          <p className="text-[10px] text-muted-foreground text-center mt-4 pb-2">
            Drag or click to add · Search S&P 500
          </p>
        )}
      </div>
    </div>
  );
}
