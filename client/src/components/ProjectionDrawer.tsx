// Portfolio Planner — Projection Drawer
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Per-stock bear/base/bull financial projection inputs

import { useState } from 'react';
import { X, TrendingUp, TrendingDown, Minus, Info, DollarSign, BarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { usePortfolioStore } from '@/lib/store';
import type { ScenarioProjection, StockProjections } from '@/lib/types';
import { calcTargetPrice, calcCAGR, formatCurrency, formatPct, formatMultiple } from '@/lib/projections';

type Scenario = 'bear' | 'base' | 'bull';

const SCENARIO_CONFIG = {
  bear: { label: 'Bear Case', color: 'oklch(0.55 0.2 25)', bg: 'oklch(0.55 0.2 25 / 15%)', icon: TrendingDown },
  base: { label: 'Base Case', color: 'oklch(0.75 0.12 75)', bg: 'oklch(0.75 0.12 75 / 15%)', icon: Minus },
  bull: { label: 'Bull Case', color: 'oklch(0.55 0.15 145)', bg: 'oklch(0.55 0.15 145 / 15%)', icon: TrendingUp },
};

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
}) {
  const [localVal, setLocalVal] = useState(value.toString());
  const [focused, setFocused] = useState(false);

  return (
    <div>
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
      <div className="relative flex items-center">
        {prefix && (
          <span className="absolute left-2 text-xs text-muted-foreground pointer-events-none">{prefix}</span>
        )}
        <Input
          type="number"
          value={focused ? localVal : value}
          onFocus={() => { setLocalVal(value.toString()); setFocused(true); }}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={() => {
            setFocused(false);
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

// ── Mini Growth Chart ────────────────────────────────────────────────────
function MiniGrowthChart({ proj, years }: { proj: import('@/lib/types').StockProjections; years: number }) {
  const data = Array.from({ length: years + 1 }, (_, i) => {
    const bearRev = proj.bear.revenueCurrentYear * Math.pow(1 + proj.bear.revenueGrowthRate / 100, i);
    const baseRev = proj.base.revenueCurrentYear * Math.pow(1 + proj.base.revenueGrowthRate / 100, i);
    const bullRev = proj.bull.revenueCurrentYear * Math.pow(1 + proj.bull.revenueGrowthRate / 100, i);
    const bearNI = proj.bear.netIncomeCurrentYear * Math.pow(1 + proj.bear.netIncomeGrowthRate / 100, i);
    const baseNI = proj.base.netIncomeCurrentYear * Math.pow(1 + proj.base.netIncomeGrowthRate / 100, i);
    const bullNI = proj.bull.netIncomeCurrentYear * Math.pow(1 + proj.bull.netIncomeGrowthRate / 100, i);
    return {
      year: i === 0 ? 'Now' : `Y${i}`,
      'Bear Rev': Math.round(bearRev),
      'Base Rev': Math.round(baseRev),
      'Bull Rev': Math.round(bullRev),
      'Bear NI': Math.round(bearNI),
      'Base NI': Math.round(baseNI),
      'Bull NI': Math.round(bullNI),
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
              <span className="font-mono" style={{ color: p.stroke }}>${p.value.toLocaleString()}M</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Revenue & Net Income Projection ($M)</p>
      <div className="h-36">
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
            <YAxis tick={{ fontSize: 8, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={40}
              tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}B` : `${v}M`} />
            <RechartTooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="Bull Rev" stroke="#22c55e" strokeWidth={1.5} fill="url(#bullRevGrad)" dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="Base Rev" stroke="#c9a84c" strokeWidth={2} fill="none" dot={false} />
            <Area type="monotone" dataKey="Bear Rev" stroke="#dc4040" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="Base NI" stroke="#c9a84c" strokeWidth={1} fill="none" dot={false} strokeDasharray="2 2" opacity={0.6} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-[#22c55e]" /> Bull Rev</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-[#c9a84c]" /> Base Rev</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-[#dc4040]" /> Bear Rev</span>
        <span className="flex items-center gap-1"><span className="inline-block w-4 h-0.5 bg-[#c9a84c] opacity-60" style={{borderTop:'1px dashed #c9a84c'}} /> Base NI</span>
      </div>
    </div>
  );
}

function ScenarioForm({
  scenario,
  projData,
  onChange,
  valuationMethod,
}: {
  scenario: Scenario;
  projData: ScenarioProjection;
  onChange: (updates: Partial<ScenarioProjection>) => void;
  valuationMethod: string;
}) {
  const cfg = SCENARIO_CONFIG[scenario];
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      {/* Revenue Section */}
      <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" />
          Revenue
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Current Revenue ($M)"
            value={projData.revenueCurrentYear}
            onChange={(v) => onChange({ revenueCurrentYear: v })}
            prefix="$"
            suffix="M"
            tooltip="Annual revenue in millions USD (TTM)"
            step={100}
            min={0}
          />
          <NumberInput
            label="Annual Growth Rate"
            value={projData.revenueGrowthRate}
            onChange={(v) => onChange({ revenueGrowthRate: v })}
            suffix="%"
            tooltip="Expected annual revenue growth rate"
            step={0.5}
          />
          <NumberInput
            label="P/S Multiple"
            value={projData.psMultiple}
            onChange={(v) => onChange({ psMultiple: v })}
            suffix="x"
            tooltip="Price-to-Sales multiple at exit"
            step={0.5}
            min={0}
          />
          <NumberInput
            label="Gross Margin"
            value={projData.grossMargin}
            onChange={(v) => onChange({ grossMargin: v })}
            suffix="%"
            tooltip="Gross profit margin"
            step={0.5}
            min={0}
            max={100}
          />
        </div>
      </div>

      {/* Earnings Section */}
      <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <DollarSign className="w-3.5 h-3.5" />
          Earnings & EPS
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="Net Income ($M)"
            value={projData.netIncomeCurrentYear}
            onChange={(v) => onChange({ netIncomeCurrentYear: v })}
            prefix="$"
            suffix="M"
            tooltip="Net income in millions USD"
            step={100}
          />
          <NumberInput
            label="NI Growth Rate"
            value={projData.netIncomeGrowthRate}
            onChange={(v) => onChange({ netIncomeGrowthRate: v })}
            suffix="%"
            tooltip="Expected annual net income growth rate"
            step={0.5}
          />
          <NumberInput
            label="EPS (Current)"
            value={projData.epsCurrentYear}
            onChange={(v) => onChange({ epsCurrentYear: v })}
            prefix="$"
            tooltip="Earnings per share (current year)"
            step={0.01}
          />
          <NumberInput
            label="EPS Growth Rate"
            value={projData.epsGrowthRate}
            onChange={(v) => onChange({ epsGrowthRate: v })}
            suffix="%"
            tooltip="Expected annual EPS growth rate"
            step={0.5}
          />
          <NumberInput
            label="P/E Multiple"
            value={projData.peMultiple}
            onChange={(v) => onChange({ peMultiple: v })}
            suffix="x"
            tooltip="Price-to-Earnings multiple at exit"
            step={1}
            min={0}
          />
          <NumberInput
            label="Shares Out. (M)"
            value={projData.sharesOutstanding}
            onChange={(v) => onChange({ sharesOutstanding: v })}
            suffix="M"
            tooltip="Shares outstanding in millions"
            step={100}
            min={1}
          />
        </div>
      </div>

      {/* FCF Section */}
      <div className="rounded-lg p-3 bg-[oklch(1_0_0/3%)] border border-[oklch(1_0_0/6%)]">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Free Cash Flow
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <NumberInput
            label="FCF ($M)"
            value={projData.fcfCurrentYear}
            onChange={(v) => onChange({ fcfCurrentYear: v })}
            prefix="$"
            suffix="M"
            tooltip="Free cash flow in millions USD"
            step={100}
          />
          <NumberInput
            label="FCF Growth Rate"
            value={projData.fcfGrowthRate}
            onChange={(v) => onChange({ fcfGrowthRate: v })}
            suffix="%"
            tooltip="Expected annual FCF growth rate"
            step={0.5}
          />
          <NumberInput
            label="FCF Multiple"
            value={projData.fcfMultiple}
            onChange={(v) => onChange({ fcfMultiple: v })}
            suffix="x"
            tooltip="Price-to-FCF multiple at exit"
            step={1}
            min={0}
          />
          {/* Target price override for crypto/ETF */}
          <NumberInput
            label="Price Override"
            value={projData.targetPriceOverride ?? 0}
            onChange={(v) => onChange({ targetPriceOverride: v > 0 ? v : undefined })}
            prefix="$"
            tooltip="Manual target price override (for crypto/ETF). Set to 0 to use model."
            step={1}
            min={0}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProjectionDrawer() {
  const selectedStockId = usePortfolioStore((s) => s.selectedStockId);
  const projectionDrawerOpen = usePortfolioStore((s) => s.projectionDrawerOpen);
  const setProjectionDrawerOpen = usePortfolioStore((s) => s.setProjectionDrawerOpen);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);
  const updateStockInLibrary = usePortfolioStore((s) => s.updateStockInLibrary);
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);

  const stock = stockLibrary.find((s) => s.id === selectedStockId);
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

  // Calculate target prices for summary
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
    <div className="fixed inset-y-0 right-0 w-[480px] bg-[oklch(0.14_0.04_255)] border-l border-[oklch(1_0_0/8%)] shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[oklch(1_0_0/8%)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xl font-bold text-foreground">{stock.ticker}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-[oklch(1_0_0/8%)] text-muted-foreground">
              {stock.industry}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{stock.name}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          onClick={() => setProjectionDrawerOpen(false)}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Current data & valuation method */}
      <div className="px-4 py-3 border-b border-[oklch(1_0_0/8%)] bg-[oklch(0.15_0.04_255)]">
        <div className="grid grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Current Price</p>
            <div className="flex items-center gap-1">
              <Input
                type="number"
                defaultValue={proj.currentPrice}
                onBlur={(e) => updateCurrentData({ currentPrice: parseFloat(e.target.value) || proj.currentPrice })}
                className="h-7 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
                step={0.01}
                min={0}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Market Cap ($M)</p>
            <Input
              type="number"
              defaultValue={proj.currentMarketCap}
              onBlur={(e) => updateCurrentData({ currentMarketCap: parseFloat(e.target.value) || proj.currentMarketCap })}
              className="h-7 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
              step={1000}
              min={0}
            />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Valuation Method</p>
            <Select
              value={proj.valuationMethod}
              onValueChange={(v) => updateCurrentData({ valuationMethod: v as any })}
            >
              <SelectTrigger className="h-7 text-xs bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]">
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

        {/* Current financials row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Revenue $M', key: 'currentRevenue' as const, step: 100 },
            { label: 'Net Inc $M', key: 'currentNetIncome' as const, step: 100 },
            { label: 'EPS $', key: 'currentEPS' as const, step: 0.01 },
            { label: 'FCF $M', key: 'currentFCF' as const, step: 100 },
          ].map(({ label, key, step }) => (
            <div key={key}>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
              <Input
                type="number"
                defaultValue={proj[key]}
                onBlur={(e) => updateCurrentData({ [key]: parseFloat(e.target.value) || 0 })}
                className="h-6 text-xs font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
                step={step}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Scenario summary cards */}
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
                <p className="font-mono text-sm font-bold text-foreground">{formatCurrency(target)}</p>
                <p className="font-mono text-xs mt-0.5" style={{ color: cfg.color }}>
                  {formatMultiple(multiple)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  CAGR: {cagr.toFixed(1)}%
                </p>
                {investedAmount > 0 && (
                  <p className="text-[10px] mt-1 font-medium" style={{ color: cfg.color }}>
                    {formatCurrency(futureVal, true)}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mini growth chart */}
      <div className="px-4 py-3 border-b border-[oklch(1_0_0/8%)]">
        <MiniGrowthChart proj={proj} years={years} />
      </div>

      {/* Scenario tabs */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <Tabs defaultValue="base">
            <TabsList className="w-full bg-[oklch(1_0_0/5%)] mb-4">
              {(['bear', 'base', 'bull'] as Scenario[]).map((s) => {
                const cfg = SCENARIO_CONFIG[s];
                return (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="flex-1 text-xs data-[state=active]:text-foreground"
                    style={{ '--tw-ring-color': cfg.color } as any}
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
                  onChange={(updates) => updateScenario(s, updates)}
                  valuationMethod={proj.valuationMethod}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
