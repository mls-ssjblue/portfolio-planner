// Portfolio Planner — Portfolio Manager (main canvas)
// Design: Sophisticated Finance Dashboard (deep navy + gold)

import { useState } from 'react';
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
import { formatCurrency } from '@/lib/projections';
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
}: {
  portfolioStock: PortfolioStock;
  totalCapital: number;
  allocationMode: 'percentage' | 'dollar';
  onRemove: () => void;
  onEdit: () => void;
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

  const handleSliderChange = (val: number[]) => {
    const pct = val[0];
    setLocalPct(pct);
    updateStockAllocation(stock.id, pct);
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
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold text-foreground">{stock.ticker}</span>
            <span
              className="text-[9px] px-1.5 py-0.5 rounded font-medium shrink-0"
              style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
            >
              {stock.industry.split(' ')[0]}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate">{stock.name}</p>
        </div>

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
          step={0.5}
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
        step={0.5}
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

  const [capitalInput, setCapitalInput] = useState('');
  const [capitalEditing, setCapitalEditing] = useState(false);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);

  const handleCapitalChange = (raw: string) => {
    const num = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (!isNaN(num) && num > 0) setTotalCapital(num);
    setCapitalEditing(false);
  };

  // Sort stocks by dollar allocation (highest first) for display
  const sortedStocks = activePortfolio
    ? [...activePortfolio.stocks].sort((a, b) => b.allocationPct - a.allocationPct)
    : [];

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
            <div className="flex-1 px-4 py-3 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
              <SortableContext
                items={sortedStocks.map((s) => s.stockId)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {sortedStocks.length === 0 ? (
                    <PortfolioDropZone isEmpty={true} />
                  ) : (
                    <>
                      {sortedStocks.map((ps) => (
                        <SortableStockRow
                          key={ps.stockId}
                          portfolioStock={ps}
                          totalCapital={activePortfolio.totalCapital}
                          allocationMode={activePortfolio.allocationMode}
                          onRemove={() => removeStockFromPortfolio(ps.stockId)}
                          onEdit={() => {}}
                        />
                      ))}
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
