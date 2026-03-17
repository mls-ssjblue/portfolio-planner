// Portfolio Planner — Portfolio Manager (main canvas)
// Design: Sophisticated Finance Dashboard (deep navy + gold)

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLivePrices } from '@/hooks/useLivePrices';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import {
  Plus, Trash2, Copy, Edit2, Check, X, GripVertical,
  DollarSign, Percent, ChevronDown, ChevronUp, Settings2,
  Wallet, TrendingUp, BarChart3, Clock, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePortfolioStore } from '@/lib/store';
import type { PortfolioStock } from '@/lib/types';
import { INDUSTRY_COLORS } from '@/lib/types';
import { formatCurrency, calcTargetPrice } from '@/lib/projections';
import { exportPortfolioCSV } from '@/lib/exportUtils';
import { toast } from 'sonner';

// ── Drop Zone ──────────────────────────────────────────────────────────────
function PortfolioDropZone({ isEmpty }: { isEmpty: boolean }) {
  const { isOver, setNodeRef } = useDroppable({ id: 'portfolio-drop-zone' });

  if (!isEmpty) return null;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed transition-all duration-200
        ${isOver
          ? 'border-[oklch(0.75_0.12_75)] bg-[oklch(0.75_0.12_75/8%)]'
          : 'border-[oklch(1_0_0/12%)] bg-[oklch(1_0_0/2%)]'
        }`}
    >
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 transition-colors
        ${isOver ? 'bg-[oklch(0.75_0.12_75/20%)]' : 'bg-[oklch(1_0_0/5%)]'}`}>
        <Plus className={`w-6 h-6 ${isOver ? 'text-[oklch(0.75_0.12_75)]' : 'text-muted-foreground'}`} />
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        {isOver ? 'Drop to add stock' : 'Drag stocks here'}
      </p>
      <p className="text-xs text-muted-foreground/60 mt-1">
        or click a stock in the library
      </p>
    </div>
  );
}

// ── Sortable Stock Row ─────────────────────────────────────────────────────
function SortableStockRow({
  portfolioStock,
  totalCapital,
  allocationMode,
  onRemove,
  onEdit,
  onAllocationChange,
  livePrice,
  livePriceLoading,
  livePriceChange,
  livePriceChangePct,
}: {
  portfolioStock: PortfolioStock;
  totalCapital: number;
  allocationMode: 'percentage' | 'dollar';
  onRemove: () => void;
  onEdit: () => void;
  onAllocationChange?: () => void;
  livePrice?: number;
  livePriceLoading?: boolean;
  livePriceChange?: number;
  livePriceChangePct?: number;
}) {
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);
  const updateStockAllocation = usePortfolioStore((s) => s.updateStockAllocation);
  const setSelectedStockId = usePortfolioStore((s) => s.setSelectedStockId);
  const setProjectionDrawerOpen = usePortfolioStore((s) => s.setProjectionDrawerOpen);

  const stock = stockLibrary.find((s) => s.id === portfolioStock.stockId);
  const [localPct, setLocalPct] = useState(portfolioStock.allocationPct);
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: portfolioStock.stockId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  if (!stock) return null;

  const color = INDUSTRY_COLORS[stock.industry];
  const dollarValue = (portfolioStock.allocationPct / 100) * totalCapital;

  // Compute step size: each tick ≈ $10 in dollar terms → very smooth fine-grained control
  // step = ($10 / totalCapital) * 100  (as a percentage)
  const sliderStep = totalCapital > 0 ? Math.max(0.01, (10 / totalCapital) * 100) : 0.1;

  // Compute base-case upside vs current price (using 5-year horizon)
  const currentPrice = stock.projections.currentPrice;
  const baseTargetPrice = calcTargetPrice(stock.projections.base, stock.projections, 5);
  const upsidePct = currentPrice > 0 && baseTargetPrice > 0
    ? ((baseTargetPrice - currentPrice) / currentPrice) * 100
    : null;

  const handleSliderChange = (val: number[]) => {
    const pct = val[0];
    setLocalPct(pct);
    updateStockAllocation(stock.id, pct);
    onAllocationChange?.();
  };

  const handleDirectInput = (raw: string) => {
    const num = parseFloat(raw);
    if (isNaN(num)) return;
    if (allocationMode === 'percentage') {
      const clamped = Math.min(100, Math.max(0, num));
      setLocalPct(clamped);
      updateStockAllocation(stock.id, clamped);
    } else {
      const pct = Math.min(100, Math.max(0, (num / totalCapital) * 100));
      setLocalPct(pct);
      updateStockAllocation(stock.id, pct);
    }
    setEditing(false);
  };

  const handleOpenProjections = () => {
    setSelectedStockId(stock.id);
    setProjectionDrawerOpen(true);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative rounded-lg border border-[oklch(1_0_0/6%)] bg-[oklch(1_0_0/3%)] hover:border-[oklch(1_0_0/10%)] hover:bg-[oklch(1_0_0/4%)] transition-all duration-150"
    >
      <div className="flex items-center gap-2 p-3">
        {/* Drag handle */}
        <div
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground shrink-0 touch-none"
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Industry color dot */}
        <div
          className="w-2 h-2 rounded-full shrink-0"
          style={{ background: color }}
        />

        {/* Stock info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-semibold text-foreground">{stock.ticker}</span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
            >
              {stock.industry.split(' ')[0]}
            </span>
            {/* Live price + share count */}
            {livePriceLoading && !livePrice ? (
              <span className="text-[10px] text-muted-foreground/50 font-mono animate-pulse">…</span>
            ) : livePrice && livePrice > 0 ? (
              <span className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-mono font-semibold text-foreground/80">
                  ${livePrice < 1 ? livePrice.toFixed(4) : livePrice < 10 ? livePrice.toFixed(3) : livePrice.toFixed(2)}
                </span>
                {livePriceChangePct !== undefined && (
                  <span
                    className={`text-[9px] font-mono font-semibold ${
                      livePriceChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {livePriceChangePct >= 0 ? '+' : ''}{livePriceChangePct.toFixed(2)}%
                  </span>
                )}
                {dollarValue > 0 && (
                  <span className="text-[9px] font-mono text-muted-foreground/60 border-l border-[oklch(1_0_0/10%)] pl-1.5">
                    {(dollarValue / livePrice) >= 1
                      ? (dollarValue / livePrice).toFixed(1) + ' sh'
                      : (dollarValue / livePrice).toFixed(3) + ' sh'}
                  </span>
                )}
              </span>
            ) : null}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{stock.name}</p>
        </div>

        {/* Upside / downside badge */}
        {upsidePct !== null && (
          <div
            className={`shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
              upsidePct >= 0
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-red-500/15 text-red-400'
            }`}
            title={`Base-case target $${baseTargetPrice.toFixed(0)} vs current $${currentPrice.toFixed(0)}`}
          >
            {upsidePct >= 0 ? '+' : ''}{upsidePct.toFixed(0)}%
          </div>
        )}

        {/* Allocation input */}
        <div className="shrink-0 flex items-center gap-1.5">
          {editing ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus
                defaultValue={allocationMode === 'percentage'
                  ? portfolioStock.allocationPct.toFixed(1)
                  : dollarValue.toFixed(0)
                }
                onChange={(e) => setInputVal(e.target.value)}
                onBlur={() => { handleDirectInput(inputVal || (allocationMode === 'percentage' ? portfolioStock.allocationPct.toFixed(1) : dollarValue.toFixed(0))); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleDirectInput(inputVal);
                  if (e.key === 'Escape') setEditing(false);
                }}
                className="w-20 h-7 text-xs text-right bg-[oklch(1_0_0/8%)] border-[oklch(0.75_0.12_75/50%)]"
              />
              <span className="text-xs text-muted-foreground">{allocationMode === 'percentage' ? '%' : '$'}</span>
            </div>
          ) : (
            <button
              onClick={() => { setEditing(true); setInputVal(''); }}
              className="text-right hover:text-[oklch(0.75_0.12_75)] transition-colors"
            >
              <div className="text-sm font-semibold font-mono text-foreground">
                {allocationMode === 'percentage'
                  ? `${portfolioStock.allocationPct.toFixed(1)}%`
                  : formatCurrency(dollarValue)
                }
              </div>
              <div className="text-[10px] text-muted-foreground">
                {allocationMode === 'percentage'
                  ? formatCurrency(dollarValue, true)
                  : `${portfolioStock.allocationPct.toFixed(1)}%`
                }
              </div>
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-[oklch(0.75_0.12_75)]"
                onClick={handleOpenProjections}
              >
                <BarChart3 className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Edit Projections</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={onRemove}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">Remove</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Allocation slider */}
      <div className="px-3 pb-3">
        <Slider
          value={[portfolioStock.allocationPct]}
          onValueChange={handleSliderChange}
          min={0}
          max={100}
          step={sliderStep}
          className="[&_[role=slider]]:bg-[oklch(0.75_0.12_75)] [&_[role=slider]]:border-[oklch(0.75_0.12_75)] [&_.bg-primary]:bg-[oklch(0.75_0.12_75)]"
        />
      </div>
    </div>
  );
}

// ── Cash Row ───────────────────────────────────────────────────────────────
function CashRow({ cashPct, totalCapital, allocationMode }: {
  cashPct: number;
  totalCapital: number;
  allocationMode: 'percentage' | 'dollar';
}) {
  const setCashPct = usePortfolioStore((s) => s.setCashPct);
  const dollarValue = (cashPct / 100) * totalCapital;
  // Each tick ≈ $10 in dollar terms
  const sliderStep = totalCapital > 0 ? Math.max(0.01, (10 / totalCapital) * 100) : 0.1;

  return (
    <div className="rounded-lg border border-[oklch(0.75_0.12_75/20%)] bg-[oklch(0.75_0.12_75/5%)] p-3">
      <div className="flex items-center gap-2 mb-2">
        <Wallet className="w-4 h-4 text-[oklch(0.75_0.12_75)] shrink-0" />
        <div className="flex-1">
          <span className="text-sm font-semibold text-foreground">Cash</span>
          <p className="text-[10px] text-muted-foreground">Uninvested capital</p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold font-mono text-[oklch(0.75_0.12_75)]">
            {allocationMode === 'percentage'
              ? `${cashPct.toFixed(1)}%`
              : formatCurrency(dollarValue)
            }
          </div>
          <div className="text-[10px] text-muted-foreground">
            {allocationMode === 'percentage'
              ? formatCurrency(dollarValue, true)
              : `${cashPct.toFixed(1)}%`
            }
          </div>
        </div>
      </div>
      <Slider
        value={[cashPct]}
        onValueChange={(v) => setCashPct(v[0])}
        min={0}
        max={100}
        step={sliderStep}
        className="[&_[role=slider]]:bg-[oklch(0.75_0.12_75)] [&_[role=slider]]:border-[oklch(0.75_0.12_75)] [&_.bg-primary]:bg-[oklch(0.75_0.12_75/60%)]"
      />
    </div>
  );
}

// ── Portfolio Tab ──────────────────────────────────────────────────────────
function PortfolioTab({ portfolioId, isActive }: { portfolioId: string; isActive: boolean }) {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const setActivePortfolio = usePortfolioStore((s) => s.setActivePortfolio);
  const renamePortfolio = usePortfolioStore((s) => s.renamePortfolio);
  const deletePortfolio = usePortfolioStore((s) => s.deletePortfolio);
  const duplicatePortfolio = usePortfolioStore((s) => s.duplicatePortfolio);

  const portfolio = portfolios.find((p) => p.id === portfolioId);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(portfolio?.name ?? '');

  if (!portfolio) return null;

  const handleRename = () => {
    if (name.trim()) renamePortfolio(portfolioId, name.trim());
    setEditing(false);
  };

  return (
    <div
      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-t-lg border-b-2 cursor-pointer transition-all text-sm shrink-0
        ${isActive
          ? 'border-[oklch(0.75_0.12_75)] bg-[oklch(1_0_0/5%)] text-foreground'
          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-[oklch(1_0_0/3%)]'
        }`}
      onClick={() => setActivePortfolio(portfolioId)}
    >
      {editing ? (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditing(false); }}
            className="h-6 w-28 text-xs bg-[oklch(1_0_0/8%)] border-[oklch(0.75_0.12_75/50%)]"
          />
        </div>
      ) : (
        <>
          <span className="font-medium truncate max-w-[100px]">{portfolio.name}</span>
          {isActive && (
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => { setName(portfolio.name); setEditing(true); }}
                className="p-0.5 rounded hover:text-[oklch(0.75_0.12_75)]"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => duplicatePortfolio(portfolioId)}
                className="p-0.5 rounded hover:text-[oklch(0.75_0.12_75)]"
              >
                <Copy className="w-3 h-3" />
              </button>
              <button
                onClick={() => {
                  if (portfolios.length <= 1) { toast.error("Can't delete the last portfolio"); return; }
                  deletePortfolio(portfolioId);
                }}
                className="p-0.5 rounded hover:text-destructive"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main Portfolio Manager ─────────────────────────────────────────────────
export default function PortfolioManager() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const createPortfolio = usePortfolioStore((s) => s.createPortfolio);
  const setTotalCapital = usePortfolioStore((s) => s.setTotalCapital);
  const setAllocationMode = usePortfolioStore((s) => s.setAllocationMode);
  const setProjectionYears = usePortfolioStore((s) => s.setProjectionYears);
  const removeStockFromPortfolio = usePortfolioStore((s) => s.removeStockFromPortfolio);
  const normalizeAllocations = usePortfolioStore((s) => s.normalizeAllocations);
  const duplicatePortfolio = usePortfolioStore((s) => s.duplicatePortfolio);

  const [capitalInput, setCapitalInput] = useState('');
  const [capitalEditing, setCapitalEditing] = useState(false);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);

  const handleCapitalChange = (raw: string) => {
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) setTotalCapital(num);
    setCapitalEditing(false);
  };

  // ── Debounced sort ────────────────────────────────────────────────────────
  // Keep a stable display order that only re-sorts 1.5 seconds after slider
  // activity stops, so the list doesn't jump while the user is adjusting.
  const [displayOrder, setDisplayOrder] = useState<string[]>(() =>
    activePortfolio ? [...activePortfolio.stocks].sort((a, b) => b.allocationPct - a.allocationPct).map((s) => s.stockId) : []
  );
  const sortTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSortUpdate = useCallback(() => {
    if (sortTimerRef.current) clearTimeout(sortTimerRef.current);
    sortTimerRef.current = setTimeout(() => {
      // Read fresh state from the store to avoid stale closure over activePortfolio.
      const freshPortfolios = usePortfolioStore.getState().portfolios;
      const freshActiveId = usePortfolioStore.getState().activePortfolioId;
      const freshPortfolio = freshPortfolios.find((p) => p.id === freshActiveId);
      if (freshPortfolio) {
        setDisplayOrder(
          [...freshPortfolio.stocks].sort((a, b) => b.allocationPct - a.allocationPct).map((s) => s.stockId)
        );
      }
    }, 1500);
  }, []);

  // When the active portfolio changes (tab switch, add/remove stock), immediately
  // update the display order without debounce.
  const prevPortfolioIdRef = useRef<string | null>(null);
  const prevStockCountRef = useRef<number>(0);
  useEffect(() => {
    if (!activePortfolio) return;
    const portfolioChanged = prevPortfolioIdRef.current !== activePortfolioId;
    const stockCountChanged = prevStockCountRef.current !== activePortfolio.stocks.length;
    prevPortfolioIdRef.current = activePortfolioId;
    prevStockCountRef.current = activePortfolio.stocks.length;
    if (portfolioChanged || stockCountChanged) {
      // Immediate sort on structural changes
      if (sortTimerRef.current) clearTimeout(sortTimerRef.current);
      setDisplayOrder(
        [...activePortfolio.stocks].sort((a, b) => b.allocationPct - a.allocationPct).map((s) => s.stockId)
      );
    }
  }, [activePortfolioId, activePortfolio]);

  // Build the sorted display list from the stable order, falling back to
  // any stocks not yet in displayOrder (e.g., newly added).
  const sortedStocks = activePortfolio
    ? [
        ...displayOrder
          .map((id) => activePortfolio.stocks.find((s) => s.stockId === id))
          .filter(Boolean) as typeof activePortfolio.stocks,
        ...activePortfolio.stocks.filter((s) => !displayOrder.includes(s.stockId)),
      ]
    : [];

  // ── Live prices ──────────────────────────────────────────────────────────
  const stockLibraryForPrices = usePortfolioStore((s) => s.stockLibrary);
  const portfolioTickers = activePortfolio
    ? activePortfolio.stocks
        .map((ps) => stockLibraryForPrices.find((s) => s.id === ps.stockId)?.ticker)
        .filter(Boolean) as string[]
    : [];
  const livePrices = useLivePrices(portfolioTickers);

  const stocksAllocated = activePortfolio
    ? activePortfolio.stocks.reduce((s, ps) => s + ps.allocationPct, 0)
    : 0;
  const totalAllocated = activePortfolio
    ? stocksAllocated + activePortfolio.cashPct
    : 0;
  const isOver100 = totalAllocated > 100.05;
  const hasStocks = (activePortfolio?.stocks.length ?? 0) > 0;

  // Create initial portfolio if none
  if (portfolios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-center">
          <h2 className="font-serif text-2xl font-semibold mb-2">No Portfolios Yet</h2>
          <p className="text-muted-foreground text-sm">Create your first portfolio to get started</p>
        </div>
        <Button
          onClick={() => createPortfolio('My Portfolio')}
          className="bg-[oklch(0.75_0.12_75)] text-[oklch(0.12_0.04_255)] hover:bg-[oklch(0.80_0.12_75)] font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Portfolio
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
        {/* Portfolio tabs */}
        <div className="flex items-center gap-0 px-4 pt-3 border-b border-[oklch(1_0_0/8%)] overflow-x-auto">
          {portfolios.map((p) => (
            <PortfolioTab key={p.id} portfolioId={p.id} isActive={p.id === activePortfolioId} />
          ))}
          <button
            onClick={() => createPortfolio(`Portfolio ${portfolios.length + 1}`)}
            className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-[oklch(0.75_0.12_75)] shrink-0 ml-1"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </button>
          {activePortfolioId && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    duplicatePortfolio(activePortfolioId);
                    toast.success('Portfolio copied');
                  }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-[oklch(0.75_0.12_75)] shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Duplicate active portfolio</TooltipContent>
            </Tooltip>
          )}
          <div className="ml-auto shrink-0">
            {activePortfolio && (
              <button
                onClick={() => {
                  const stockLibrary = usePortfolioStore.getState().stockLibrary;
                  exportPortfolioCSV(activePortfolio, stockLibrary);
                  toast.success(`Exported ${activePortfolio.name} to CSV`);
                }}
                className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-[oklch(0.75_0.12_75)] shrink-0"
                title="Export to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
            )}
          </div>
        </div>

        {activePortfolio && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Capital & Controls bar */}
            <div className="px-4 py-3 border-b border-[oklch(1_0_0/8%)] bg-[oklch(0.15_0.04_255)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 sm:flex-wrap">
                {/* Total Capital */}
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-[oklch(0.75_0.12_75)] shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Capital</p>
                    {capitalEditing ? (
                      <Input
                        autoFocus
                        defaultValue={activePortfolio.totalCapital.toString()}
                        onChange={(e) => setCapitalInput(e.target.value)}
                        onBlur={() => handleCapitalChange(capitalInput || activePortfolio.totalCapital.toString())}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleCapitalChange(capitalInput); if (e.key === 'Escape') setCapitalEditing(false); }}
                        className="h-7 w-32 text-sm font-mono bg-[oklch(1_0_0/8%)] border-[oklch(0.75_0.12_75/50%)]"
                      />
                    ) : (
                      <button
                        onClick={() => { setCapitalInput(''); setCapitalEditing(true); }}
                        className="text-lg font-semibold font-mono text-foreground hover:text-[oklch(0.75_0.12_75)] transition-colors"
                      >
                        {formatCurrency(activePortfolio.totalCapital)}
                      </button>
                    )}
                  </div>
                </div>

                {/* Capital slider */}
                <div className="flex-1 min-w-0 sm:min-w-40">
                  <Slider
                    value={[Math.log10(activePortfolio.totalCapital)]}
                    onValueChange={(v) => setTotalCapital(Math.round(Math.pow(10, v[0])))}
                    min={3}
                    max={8}
                    step={0.01}
                    className="[&_[role=slider]]:bg-[oklch(0.75_0.12_75)] [&_[role=slider]]:border-[oklch(0.75_0.12_75)] [&_.bg-primary]:bg-[oklch(0.75_0.12_75)]"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                    <span>$1K</span><span>$10K</span><span>$100K</span><span>$1M</span><span>$10M</span><span>$100M</span>
                  </div>
                </div>

                {/* Allocation mode toggle */}
                <div className="flex items-center gap-1 bg-[oklch(1_0_0/5%)] rounded-lg p-1 shrink-0">
                  <button
                    onClick={() => setAllocationMode('percentage')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                      ${activePortfolio.allocationMode === 'percentage'
                        ? 'bg-[oklch(0.75_0.12_75)] text-[oklch(0.12_0.04_255)]'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <Percent className="w-3 h-3" />
                    %
                  </button>
                  <button
                    onClick={() => setAllocationMode('dollar')}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                      ${activePortfolio.allocationMode === 'dollar'
                        ? 'bg-[oklch(0.75_0.12_75)] text-[oklch(0.12_0.04_255)]'
                        : 'text-muted-foreground hover:text-foreground'
                      }`}
                  >
                    <DollarSign className="w-3 h-3" />
                    $
                  </button>
                </div>

                {/* Projection years */}
                <div className="flex items-center gap-2 shrink-0">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Horizon</p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setProjectionYears(Math.max(1, activePortfolio.projectionYears - 1))}
                        className="w-5 h-5 rounded bg-[oklch(1_0_0/5%)] flex items-center justify-center text-muted-foreground hover:text-foreground text-xs"
                      >
                        −
                      </button>
                      <span className="font-mono text-sm font-semibold w-8 text-center">{activePortfolio.projectionYears}y</span>
                      <button
                        onClick={() => setProjectionYears(Math.min(20, activePortfolio.projectionYears + 1))}
                        className="w-5 h-5 rounded bg-[oklch(1_0_0/5%)] flex items-center justify-center text-muted-foreground hover:text-foreground text-xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                {/* Allocation health */}
                <div className="shrink-0 ml-auto flex items-center gap-3">
                  {hasStocks && Math.abs(totalAllocated - 100) > 0.5 && (
                    <button
                      onClick={() => { normalizeAllocations(); }}
                      className="text-[10px] px-2 py-1 rounded bg-[oklch(0.75_0.12_75/15%)] text-[oklch(0.75_0.12_75)] border border-[oklch(0.75_0.12_75/30%)] hover:bg-[oklch(0.75_0.12_75/25%)] transition-colors font-medium"
                    >
                      Normalize
                    </button>
                  )}
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Allocated</p>
                    <p className={`font-mono text-sm font-semibold ${isOver100 ? 'text-destructive' : hasStocks && Math.abs(totalAllocated - 100) < 0.5 ? 'text-[oklch(0.55_0.15_145)]' : hasStocks ? 'text-[oklch(0.75_0.12_75)]' : 'text-muted-foreground'}`}>
                      {hasStocks ? `${totalAllocated.toFixed(1)}%` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Stock list */}
            <div className="flex-1 px-4 py-3 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
              <SortableContext
                items={sortedStocks.map((s) => s.stockId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sortedStocks.length === 0 ? (
                    <PortfolioDropZone isEmpty={true} />
                  ) : (
                    <>
                      {sortedStocks.map((ps) => {
                        const ticker = stockLibraryForPrices.find((s) => s.id === ps.stockId)?.ticker;
                        const lp = ticker ? livePrices.get(ticker) : undefined;
                        return (
                          <SortableStockRow
                            key={ps.stockId}
                            portfolioStock={ps}
                            totalCapital={activePortfolio.totalCapital}
                            allocationMode={activePortfolio.allocationMode}
                            onRemove={() => removeStockFromPortfolio(ps.stockId)}
                            onEdit={() => {}}
                            onAllocationChange={scheduleSortUpdate}
                            livePrice={lp?.price}
                            livePriceLoading={lp?.loading}
                            livePriceChange={lp?.change}
                            livePriceChangePct={lp?.changePct}
                          />
                        );
                      })}
                      {/* Drop zone at bottom when stocks exist */}
                      <DroppableBottom />
                    </>
                  )}
                </div>
              </SortableContext>

              {/* Cash row */}
              {activePortfolio.stocks.length > 0 && (
                <div className="mt-3">
                  <CashRow
                    cashPct={activePortfolio.cashPct}
                    totalCapital={activePortfolio.totalCapital}
                    allocationMode={activePortfolio.allocationMode}
                  />
                </div>
              )}

              {isOver100 && (
                <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-xs text-destructive">
                  Total allocation exceeds 100%. Please reduce some positions.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  );
}

function DroppableBottom() {
  const { isOver, setNodeRef } = useDroppable({ id: 'portfolio-drop-bottom' });
  return (
    <div
      ref={setNodeRef}
      className={`h-12 rounded-lg border-2 border-dashed flex items-center justify-center text-xs text-muted-foreground transition-all duration-150
        ${isOver ? 'border-[oklch(0.75_0.12_75)] bg-[oklch(0.75_0.12_75/8%)] text-[oklch(0.75_0.12_75)]' : 'border-[oklch(1_0_0/8%)]'}`}
    >
      {isOver ? 'Drop to add' : 'Drop stock here to add'}
    </div>
  );
}
