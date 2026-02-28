// Portfolio Planner — Projection Drawer
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Projection model: Revenue → Net Margin → EPS → P/E → Target Price
// (matches 1000x Stocks methodology)

import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { X, TrendingUp, TrendingDown, Minus, Info, BarChart2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer,
} from 'recharts';
import { usePortfolioStore } from '@/lib/store';
import type { ScenarioProjection, StockProjections } from '@/lib/types';
import { calcTargetPrice, calcCAGR, formatCurrency, formatPct, formatMultiple } from '@/lib/projections';
import { useStockRefresh } from '@/hooks/useStockRefresh';

type Scenario = 'bear' | 'base' | 'bull';

const SCENARIO_CONFIG = {
  bear: { label: 'Bear Case', color: 'oklch(0.55 0.2 25)', bg: 'oklch(0.55 0.2 25 / 15%)', icon: TrendingDown },
  base: { label: 'Base Case', color: 'oklch(0.75 0.12 75)', bg: 'oklch(0.75 0.12 75 / 15%)', icon: Minus },
  bull: { label: 'Bull Case', color: 'oklch(0.55 0.15 145)', bg: 'oklch(0.55 0.15 145 / 15%)', icon: TrendingUp },
};

// ── Controlled number input with debounced save ──────────────────────────────
function NumberInput({
  label,
  value,
  onChange,
  prefix,
  suffix,
  tooltip,
  step = 1,
  min,
  max,
  className = '',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  prefix?: string;
  suffix?: string;
  tooltip?: string;
  step?: number;
  min?: number;
  max?: number;
  className?: string;
}) {
  const safeValue = value ?? 0;
  const [localVal, setLocalVal] = useState(safeValue.toString());
  const [focused, setFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!focused) {
      setLocalVal((value ?? 0).toString());
    }
  }, [value, focused]);

  const handleChange = (raw: string) => {
    setLocalVal(raw);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        const clamped = min !== undefined && max !== undefined
          ? Math.min(max, Math.max(min, num))
          : min !== undefined ? Math.max(min, num)
          : max !== undefined ? Math.min(max, num)
          : num;
        onChange(clamped);
      }
    }, 400);
  };

  return (
    <div className={className}>
      {label && (
        <div className="flex items-center gap-1 mb-1">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
          {tooltip && (
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-3 h-3 text-muted-foreground/50" />
              </TooltipTrigger>
              <TooltipContent className="text-xs max-w-48">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-2 text-xs text-muted-foreground pointer-events-none">{prefix}</span>
        )}
        <Input
          type="number"
          value={focused ? localVal : (value ?? 0)}
          onFocus={() => { setLocalVal((value ?? 0).toString()); setFocused(true); }}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => {
            setFocused(false);
            if (debounceRef.current) clearTimeout(debounceRef.current);
            const num = parseFloat(localVal);
            if (!isNaN(num)) {
              const clamped = min !== undefined && max !== undefined
                ? Math.min(max, Math.max(min, num))
                : min !== undefined ? Math.max(min, num)
                : max !== undefined ? Math.min(max, num)
                : num;
              onChange(clamped);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          step={step}
          className={`h-8 text-xs bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)] text-right
            ${prefix ? 'pl-5' : ''} ${suffix ? 'pr-8' : ''}`}
        />
        {suffix && (
          <span className="absolute right-2 text-xs text-muted-foreground pointer-events-none">{suffix}</span>
        )}
      </div>
    </div>
  );
}

// ── Derived value display ────────────────────────────────────────────────────
function DerivedValue({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded p-2 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="font-mono text-xs font-semibold" style={{ color: color || 'inherit' }}>{value}</p>
    </div>
  );
}

// ── Mini Revenue Projection Chart ────────────────────────────────────────────
function MiniGrowthChart({ proj, years }: { proj: StockProjections; years: number }) {
  const data = Array.from({ length: years + 1 }, (_, i) => {
    const bearRev = proj.currentRevenueB * Math.pow(1 + proj.bear.revenueGrowthRate / 100, i);
    const baseRev = proj.currentRevenueB * Math.pow(1 + proj.base.revenueGrowthRate / 100, i);
    const bullRev = proj.currentRevenueB * Math.pow(1 + proj.bull.revenueGrowthRate / 100, i);
    const bearNI = bearRev * (proj.bear.netMarginPct / 100);
    const baseNI = baseRev * (proj.base.netMarginPct / 100);
    const bullNI = bullRev * (proj.bull.netMarginPct / 100);
    return {
      year: i === 0 ? 'Now' : `Y${i}`,
      'Bear Rev': parseFloat(bearRev.toFixed(2)),
      'Base Rev': parseFloat(baseRev.toFixed(2)),
      'Bull Rev': parseFloat(bullRev.toFixed(2)),
      'Base NI': parseFloat(baseNI.toFixed(2)),
      'Bear NI': parseFloat(bearNI.toFixed(2)),
      'Bull NI': parseFloat(bullNI.toFixed(2)),
    };
  });

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[oklch(0.17_0.04_255)] border border-[oklch(1_0_0/10%)] rounded-lg p-2 shadow-xl text-[10px]">
          <p className="font-semibold text-foreground mb-1">{label}</p>
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: p.stroke }} />
              <span className="text-muted-foreground">{p.name}:</span>
              <span className="font-mono" style={{ color: p.stroke }}>${p.value.toFixed(1)}B</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Revenue & Net Income Projection ($B)
      </p>
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="bullRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" vertical={false} />
            <XAxis dataKey="year" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={36}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}T` : `${v}B`} />
            <RechartTooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Bull Rev" stroke="#22c55e" strokeWidth={1.5} fill="url(#bullRevGrad)" dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="Base Rev" stroke="#c9a84c" strokeWidth={2} fill="none" dot={false} />
            <Area type="monotone" dataKey="Bear Rev" stroke="#dc4040" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="Base NI" stroke="#c9a84c" strokeWidth={1} fill="none" dot={false} strokeDasharray="2 2" opacity={0.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-[#22c55e]" /> Bull</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-[#c9a84c]" /> Base</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-[#dc4040]" /> Bear</span>
        <span className="flex items-center gap-1 opacity-60"><span className="inline-block w-4 h-px border-t border-dashed border-[#c9a84c]" /> NI</span>
      </div>
    </div>
  );
}

// ── Scenario Form: the core inputs ──────────────────────────────────────────
function ScenarioForm({
  scenario,
  projData,
  currentData,
  onChange,
  years,
}: {
  scenario: Scenario;
  projData: ScenarioProjection;
  currentData: StockProjections;
  onChange: (updates: Partial<ScenarioProjection>) => void;
  years: number;
}) {
  const cfg = SCENARIO_CONFIG[scenario];
  const shares = currentData.currentSharesB > 0 ? currentData.currentSharesB : 1;

  // Derived values from the Revenue → Margin → EPS → P/E chain
  const futureRevenueB = currentData.currentRevenueB * Math.pow(1 + projData.revenueGrowthRate / 100, years);
  const futureNetIncomeB = futureRevenueB * (projData.netMarginPct / 100);
  const futureEPS = futureNetIncomeB / shares; // $B / B shares = $/share
  const targetPricePE = futureEPS * projData.peMultiple;
  const revenuePerShare = futureRevenueB / shares;
  const targetPricePS = revenuePerShare * projData.psMultiple;
  const futureFCFB = futureRevenueB * (projData.fcfMarginPct / 100);
  const fcfPerShare = futureFCFB / shares;
  const targetPriceFCF = fcfPerShare * projData.fcfMultiple;

  const primaryTarget = calcTargetPrice(projData, currentData, years);
  const cagr = currentData.currentPrice > 0
    ? calcCAGR(primaryTarget / currentData.currentPrice, years)
    : 0;

  return (
    <div className="space-y-4">
      {/* ── Step 1: Revenue Growth ─────────────────────────────────────────── */}
      <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px] font-bold rounded px-1.5 py-0.5 text-white" style={{ background: cfg.color }}>1</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Revenue Growth</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Annual Growth Rate"
            value={projData.revenueGrowthRate}
            onChange={(v) => onChange({ revenueGrowthRate: v })}
            suffix="%"
            tooltip={`Expected annual revenue growth rate over ${years} years`}
            step={0.5}
          />
          <DerivedValue
            label={`Year ${years} Revenue`}
            value={`$${futureRevenueB >= 1000 ? (futureRevenueB/1000).toFixed(1)+'T' : futureRevenueB.toFixed(1)+'B'}`}
            color={cfg.color}
          />
        </div>
      </div>

      {/* ── Step 2: Profitability ──────────────────────────────────────────── */}
      <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px] font-bold rounded px-1.5 py-0.5 text-white" style={{ background: cfg.color }}>2</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profitability at Exit</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Net Margin %"
            value={projData.netMarginPct}
            onChange={(v) => onChange({ netMarginPct: v })}
            suffix="%"
            tooltip={`Expected net profit margin in year ${years}`}
            step={0.5}
            min={-100}
            max={100}
          />
          <NumberInput
            label="FCF Margin %"
            value={projData.fcfMarginPct}
            onChange={(v) => onChange({ fcfMarginPct: v })}
            suffix="%"
            tooltip={`Expected free cash flow margin in year ${years}`}
            step={0.5}
            min={-50}
            max={100}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <DerivedValue
            label={`Year ${years} Net Income`}
            value={`$${Math.abs(futureNetIncomeB) >= 1 ? futureNetIncomeB.toFixed(1)+'B' : (futureNetIncomeB*1000).toFixed(0)+'M'}`}
            color={futureNetIncomeB >= 0 ? cfg.color : '#dc4040'}
          />
          <DerivedValue
            label={`Year ${years} EPS`}
            value={futureEPS !== 0 ? `$${futureEPS.toFixed(2)}` : 'N/A'}
            color={futureEPS >= 0 ? cfg.color : '#dc4040'}
          />
        </div>
      </div>

      {/* ── Step 3: Valuation Multiples ────────────────────────────────────── */}
      <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[10px] font-bold rounded px-1.5 py-0.5 text-white" style={{ background: cfg.color }}>3</span>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Exit Multiples</h4>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <NumberInput
            label="P/E Multiple"
            value={projData.peMultiple}
            onChange={(v) => onChange({ peMultiple: v })}
            suffix="x"
            tooltip="Price-to-Earnings multiple at exit year"
            step={1}
            min={0}
          />
          <NumberInput
            label="P/S Multiple"
            value={projData.psMultiple}
            onChange={(v) => onChange({ psMultiple: v })}
            suffix="x"
            tooltip="Price-to-Sales multiple at exit year"
            step={0.5}
            min={0}
          />
          <NumberInput
            label="P/FCF Multiple"
            value={projData.fcfMultiple}
            onChange={(v) => onChange({ fcfMultiple: v })}
            suffix="x"
            tooltip="Price-to-FCF multiple at exit year"
            step={1}
            min={0}
          />
        </div>

        {/* Derived target prices for each method */}
        <div className="grid grid-cols-3 gap-2 mt-2">
          <DerivedValue label="P/E Target" value={targetPricePE > 0 ? `$${targetPricePE.toFixed(0)}` : 'N/A'} color={cfg.color} />
          <DerivedValue label="P/S Target" value={targetPricePS > 0 ? `$${targetPricePS.toFixed(0)}` : 'N/A'} color={cfg.color} />
          <DerivedValue label="P/FCF Target" value={targetPriceFCF > 0 ? `$${targetPriceFCF.toFixed(0)}` : 'N/A'} color={cfg.color} />
        </div>
      </div>

      {/* ── Price Override ─────────────────────────────────────────────────── */}
      <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Manual Price Override <span className="normal-case text-[10px] font-normal">(for crypto/ETF — leave 0 to use model)</span>
        </h4>
        <NumberInput
          label=""
          value={projData.targetPriceOverride ?? 0}
          onChange={(v) => onChange({ targetPriceOverride: v > 0 ? v : undefined })}
          prefix="$"
          tooltip="Manual target price override. Set to 0 to use the model above."
          step={1}
          min={0}
        />
      </div>

      {/* ── Summary ────────────────────────────────────────────────────────── */}
      <div
        className="rounded-lg p-3 border"
        style={{ background: cfg.bg, borderColor: `${cfg.color}40` }}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
              {cfg.label} Target ({years}yr)
            </p>
            <p className="font-mono text-xl font-bold text-foreground">
              {primaryTarget > 0 ? `$${primaryTarget.toFixed(0)}` : 'N/A'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">CAGR</p>
            <p className="font-mono text-lg font-bold" style={{ color: cfg.color }}>
              {cagr >= 0 ? '+' : ''}{cagr.toFixed(1)}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Multiple</p>
            <p className="font-mono text-lg font-bold" style={{ color: cfg.color }}>
              {currentData.currentPrice > 0 && primaryTarget > 0
                ? `${(primaryTarget / currentData.currentPrice).toFixed(2)}x`
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Drawer Component ────────────────────────────────────────────────────
export default function ProjectionDrawer({ mobileMode = false }: { mobileMode?: boolean }) {
  const selectedStockId = usePortfolioStore((s) => s.selectedStockId);
  const projectionDrawerOpen = usePortfolioStore((s) => s.projectionDrawerOpen);
  const setProjectionDrawerOpen = usePortfolioStore((s) => s.setProjectionDrawerOpen);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);
  const updateStockInLibrary = usePortfolioStore((s) => s.updateStockInLibrary);
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const { refreshStock, refreshingTicker } = useStockRefresh();

  const stock = stockLibrary.find((s) => s.id === selectedStockId);
  const refreshing = refreshingTicker === stock?.ticker;
  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  const portfolioStock = activePortfolio?.stocks.find((ps) => ps.stockId === selectedStockId);
  const years = activePortfolio?.projectionYears ?? 5;

  if (!projectionDrawerOpen || !stock) return null;

  const proj = stock.projections;

  const updateScenario = (scenario: Scenario, updates: Partial<ScenarioProjection>) => {
    updateStockInLibrary(stock.id, {
      projections: {
        ...proj,
        [scenario]: { ...proj[scenario], ...updates },
      },
    });
  };

  const updateCurrentData = (updates: Partial<StockProjections>) => {
    updateStockInLibrary(stock.id, {
      projections: { ...proj, ...updates },
    });
  };

  // Refresh live data from Yahoo Finance
  const handleRefreshData = async () => {
    const success = await refreshStock(stock.id);
    if (success) {
      toast.success(`${stock.ticker} data refreshed`);
    } else {
      toast.error(`Could not fetch live data for ${stock.ticker}. Update manually.`);
    }
  };

  // Calculate target prices for summary cards
  const bearTarget = calcTargetPrice(proj.bear, proj, years);
  const baseTarget = calcTargetPrice(proj.base, proj, years);
  const bullTarget = calcTargetPrice(proj.bull, proj, years);

  const bearMultiple = proj.currentPrice > 0 ? bearTarget / proj.currentPrice : 0;
  const baseMultiple = proj.currentPrice > 0 ? baseTarget / proj.currentPrice : 0;
  const bullMultiple = proj.currentPrice > 0 ? bullTarget / proj.currentPrice : 0;

  const investedAmount = portfolioStock
    ? (portfolioStock.allocationPct / 100) * (activePortfolio?.totalCapital ?? 0)
    : 0;

  return (
    <div className={mobileMode
      ? 'flex flex-col h-full bg-[oklch(0.14_0.04_255)]'
      : 'fixed inset-y-0 right-0 w-[480px] bg-[oklch(0.14_0.04_255)] border-l border-[oklch(1_0_0/8%)] shadow-2xl z-50 flex flex-col'
    }>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between p-4 border-b border-[oklch(1_0_0/8%)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold text-foreground">{stock.ticker}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{stock.tag}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{stock.name}</p>
          {proj.dataAsOf && (
            <p className="text-[10px] text-muted-foreground/50 mt-0.5">Data as of {proj.dataAsOf}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
            onClick={handleRefreshData}
            disabled={refreshing}
            title="Refresh live data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => setProjectionDrawerOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* ── Live Financials Row ─────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[oklch(1_0_0/8%)] bg-[oklch(0.15_0.04_255)]">
        {/* Price + Valuation Method */}
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Price</p>
            <NumberInput
              label=""
              value={proj.currentPrice}
              onChange={(v) => updateCurrentData({ currentPrice: v })}
              prefix="$"
              step={0.01}
              min={0}
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Shares Out (B)</p>
            <NumberInput
              label=""
              value={proj.currentSharesB}
              onChange={(v) => updateCurrentData({ currentSharesB: v })}
              suffix="B"
              step={0.01}
              min={0.001}
              tooltip="Shares outstanding in billions — used to derive EPS from Net Income"
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Valuation Method</p>
            <Select
              value={proj.valuationMethod}
              onValueChange={(v) => updateCurrentData({ valuationMethod: v as any })}
            >
              <SelectTrigger className="h-8 text-xs bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[oklch(0.17_0.04_255)] border-[oklch(1_0_0/10%)]">
                <SelectItem value="pe">P/E Ratio</SelectItem>
                <SelectItem value="ps">P/S Ratio</SelectItem>
                <SelectItem value="fcf">P/FCF Ratio</SelectItem>
                <SelectItem value="price">Price Target</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Current financials — Revenue, Net Income, EPS, FCF */}
        <div className="grid grid-cols-2 gap-2 mb-2">
          <NumberInput
            label="Revenue TTM ($B)"
            value={proj.currentRevenueB}
            onChange={(v) => updateCurrentData({ currentRevenueB: v })}
            prefix="$"
            suffix="B"
            step={0.1}
            min={0}
            tooltip="Trailing twelve months revenue in billions USD"
          />
          <NumberInput
            label="Net Income TTM ($B)"
            value={proj.currentNetIncomeB}
            onChange={(v) => updateCurrentData({ currentNetIncomeB: v })}
            prefix="$"
            suffix="B"
            step={0.01}
            tooltip="Trailing twelve months net income in billions USD"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <NumberInput
            label="EPS TTM"
            value={proj.currentEPS}
            onChange={(v) => updateCurrentData({ currentEPS: v })}
            prefix="$"
            step={0.01}
            tooltip="Trailing twelve months earnings per share"
          />
          <NumberInput
            label="FCF TTM ($B)"
            value={proj.currentFCFB}
            onChange={(v) => updateCurrentData({ currentFCFB: v })}
            prefix="$"
            suffix="B"
            step={0.01}
            tooltip="Trailing twelve months free cash flow in billions USD"
          />
          <NumberInput
            label="Net Margin %"
            value={proj.currentNetMarginPct}
            onChange={(v) => updateCurrentData({ currentNetMarginPct: v })}
            suffix="%"
            step={0.1}
            tooltip="Current net profit margin (TTM)"
          />
        </div>

        {/* Live ratios display */}
        <div className="grid grid-cols-4 gap-1.5 mt-2">
          {[
            { label: 'P/E', value: proj.currentPE > 0 ? proj.currentPE.toFixed(1) + 'x' : 'N/A' },
            { label: 'Fwd P/E', value: proj.currentPEForward > 0 ? proj.currentPEForward.toFixed(1) + 'x' : 'N/A' },
            { label: 'P/S', value: proj.currentPS > 0 ? proj.currentPS.toFixed(1) + 'x' : 'N/A' },
            { label: 'Mkt Cap', value: proj.currentMarketCapB > 0 ? `$${proj.currentMarketCapB >= 1000 ? (proj.currentMarketCapB/1000).toFixed(1)+'T' : proj.currentMarketCapB.toFixed(0)+'B'}` : 'N/A' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded p-1.5 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)] text-center">
              <p className="text-[9px] text-muted-foreground">{label}</p>
              <p className="font-mono text-[11px] font-semibold text-foreground">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Scenario Summary Cards ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[oklch(1_0_0/8%)]">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          {years}yr Target Price & Return
        </p>
        <div className="grid grid-cols-3 gap-2">
          {(['bear', 'base', 'bull'] as Scenario[]).map((s) => {
            const cfg = SCENARIO_CONFIG[s];
            const target = s === 'bear' ? bearTarget : s === 'base' ? baseTarget : bullTarget;
            const multiple = s === 'bear' ? bearMultiple : s === 'base' ? baseMultiple : bullMultiple;
            const cagr = calcCAGR(multiple, years);
            const futureVal = investedAmount * multiple;
            return (
              <div
                key={s}
                className="rounded-lg p-2.5 text-center"
                style={{ background: cfg.bg, border: `1px solid ${cfg.color}30` }}
              >
                <p className="text-[10px] font-medium mb-1" style={{ color: cfg.color }}>{cfg.label}</p>
                <p className="font-mono text-sm font-bold text-foreground">
                  {target > 0 ? formatCurrency(target) : 'N/A'}
                </p>
                <p className="font-mono text-xs mt-0.5" style={{ color: cfg.color }}>
                  {multiple > 0 ? formatMultiple(multiple) : '—'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  CAGR: {cagr !== 0 ? cagr.toFixed(1) + '%' : '—'}
                </p>
                {investedAmount > 0 && multiple > 0 && (
                  <p className="text-[10px] mt-1 font-medium" style={{ color: cfg.color }}>
                    {formatCurrency(futureVal, true)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Mini Growth Chart ───────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-[oklch(1_0_0/8%)]">
        <MiniGrowthChart proj={proj} years={years} />
      </div>

      {/* ── Scenario Tabs ───────────────────────────────────────────────────── */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="mb-3 p-2.5 rounded-lg bg-[oklch(0.75_0.12_75/8%)] border border-[oklch(0.75_0.12_75/20%)]">
            <p className="text-[10px] text-[oklch(0.75_0.12_75)] font-medium">
              <BarChart2 className="w-3 h-3 inline mr-1" />
              Projection chain: Revenue Growth → Net Margin → Net Income → EPS → × P/E Multiple = Target Price
            </p>
          </div>
          <Tabs defaultValue="base">
            <TabsList className="w-full bg-[oklch(1_0_0/5%)] mb-4">
              {(['bear', 'base', 'bull'] as Scenario[]).map((s) => {
                const cfg = SCENARIO_CONFIG[s];
                return (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="flex-1 text-xs data-[state=active]:text-foreground"
                  >
                    <span style={{ color: cfg.color }} className="mr-1">●</span>
                    {cfg.label}
                  </TabsTrigger>
                );
              })}
            </TabsList>
            {(['bear', 'base', 'bull'] as Scenario[]).map((s) => (
              <TabsContent key={s} value={s}>
                <ScenarioForm
                  scenario={s}
                  projData={proj[s]}
                  currentData={proj}
                  onChange={(updates) => updateScenario(s, updates)}
                  years={years}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
