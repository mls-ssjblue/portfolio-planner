// Portfolio Planner — Analytics Panel
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Allocation donut, scenario comparison bars, growth line chart

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RechartTooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
  LineChart, Line, Area, AreaChart, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3, PieChart as PieIcon, Activity, GitCompare } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePortfolioStore } from '@/lib/store';
import { INDUSTRY_COLORS } from '@/lib/types';
import {
  calcPortfolioProjection,
  formatCurrency,
  formatPct,
  formatMultiple,
  calcTargetPrice,
  calcCAGR,
} from '@/lib/projections';
import PortfolioComparison from './PortfolioComparison';

const SCENARIO_COLORS = {
  bear: '#dc4040',
  base: '#c9a84c',
  bull: '#22c55e',
};

// ── Allocation Donut ───────────────────────────────────────────────────────
function AllocationDonut() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  if (!activePortfolio || activePortfolio.stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Add stocks to see allocation
      </div>
    );
  }

  const data = [
    ...activePortfolio.stocks.map((ps) => {
      const stock = stockLibrary.find((s) => s.id === ps.stockId);
      return {
        name: stock?.ticker ?? '???',
        value: ps.allocationPct,
        color: INDUSTRY_COLORS[stock?.industry ?? 'Other'],
        dollarValue: (ps.allocationPct / 100) * activePortfolio.totalCapital,
      };
    }),
    {
      name: 'Cash',
      value: activePortfolio.cashPct,
      color: '#94a3b8',
      dollarValue: (activePortfolio.cashPct / 100) * activePortfolio.totalCapital,
    },
  ].filter((d) => d.value > 0);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-[oklch(0.17_0.04_255)] border border-[oklch(1_0_0/10%)] rounded-lg p-2.5 shadow-xl">
          <p className="font-mono text-sm font-semibold text-foreground">{d.name}</p>
          <p className="text-xs text-muted-foreground">{d.value.toFixed(1)}%</p>
          <p className="text-xs font-medium" style={{ color: d.color }}>{formatCurrency(d.dollarValue)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <div className="w-44 h-44 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={68}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={600}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <RechartTooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-1.5 min-w-0">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="font-mono text-xs font-semibold text-foreground w-12 shrink-0">{d.name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-[oklch(1_0_0/5%)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, d.value)}%`, background: d.color }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-10 text-right shrink-0">{d.value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Scenario Comparison ────────────────────────────────────────────────────
function ScenarioComparison() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  if (!activePortfolio || activePortfolio.stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Add stocks to see projections
      </div>
    );
  }

  const years = activePortfolio.projectionYears;
  const bear = calcPortfolioProjection(activePortfolio.stocks, activePortfolio.cashPct, activePortfolio.totalCapital, stockLibrary, 'bear', years);
  const base = calcPortfolioProjection(activePortfolio.stocks, activePortfolio.cashPct, activePortfolio.totalCapital, stockLibrary, 'base', years);
  const bull = calcPortfolioProjection(activePortfolio.stocks, activePortfolio.cashPct, activePortfolio.totalCapital, stockLibrary, 'bull', years);

  const summaryCards = [
    { label: 'Bear Case', value: bear.totalFutureValue, cagr: bear.totalCAGR, color: SCENARIO_COLORS.bear, multiple: bear.totalFutureValue / activePortfolio.totalCapital },
    { label: 'Base Case', value: base.totalFutureValue, cagr: base.totalCAGR, color: SCENARIO_COLORS.base, multiple: base.totalFutureValue / activePortfolio.totalCapital },
    { label: 'Bull Case', value: bull.totalFutureValue, cagr: bull.totalCAGR, color: SCENARIO_COLORS.bull, multiple: bull.totalFutureValue / activePortfolio.totalCapital },
  ];

  // Per-stock comparison data
  const stockData = activePortfolio.stocks.map((ps) => {
    const stock = stockLibrary.find((s) => s.id === ps.stockId);
    if (!stock) return null;
    const invested = (ps.allocationPct / 100) * activePortfolio.totalCapital;
    const bearTarget = calcTargetPrice(stock.projections.bear, stock.projections, years);
    const baseTarget = calcTargetPrice(stock.projections.base, stock.projections, years);
    const bullTarget = calcTargetPrice(stock.projections.bull, stock.projections, years);
    const bearMult = stock.projections.currentPrice > 0 ? bearTarget / stock.projections.currentPrice : 1;
    const baseMult = stock.projections.currentPrice > 0 ? baseTarget / stock.projections.currentPrice : 1;
    const bullMult = stock.projections.currentPrice > 0 ? bullTarget / stock.projections.currentPrice : 1;
    return {
      ticker: stock.ticker,
      bear: invested * bearMult,
      base: invested * baseMult,
      bull: invested * bullMult,
      invested,
    };
  }).filter(Boolean);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[oklch(0.17_0.04_255)] border border-[oklch(1_0_0/10%)] rounded-lg p-2.5 shadow-xl">
          <p className="font-mono text-xs font-semibold text-foreground mb-1">{label}</p>
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ background: p.fill }} />
              <span className="text-muted-foreground capitalize">{p.name}:</span>
              <span className="font-mono font-medium" style={{ color: p.fill }}>{formatCurrency(p.value, true)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className="rounded-lg p-3 text-center"
            style={{ background: `${card.color}15`, border: `1px solid ${card.color}30` }}
          >
            <p className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: card.color }}>
              {card.label}
            </p>
            <p className="font-mono text-base font-bold text-foreground">{formatCurrency(card.value, true)}</p>
            <p className="font-mono text-xs mt-0.5" style={{ color: card.color }}>
              {formatMultiple(card.multiple)} · {card.cagr.toFixed(1)}% CAGR
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">in {years} years</p>
          </div>
        ))}
      </div>

      {/* Per-stock bar chart */}
      {stockData.length > 0 && (
        <div className="h-52">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Per-Stock Future Value</p>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stockData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" vertical={false} />
              <XAxis dataKey="ticker" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 9, fill: '#94a3b8' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrency(v, true)}
                width={55}
              />
              <RechartTooltip content={<CustomTooltip />} />
              <Bar dataKey="bear" fill={SCENARIO_COLORS.bear} radius={[2, 2, 0, 0]} maxBarSize={20} />
              <Bar dataKey="base" fill={SCENARIO_COLORS.base} radius={[2, 2, 0, 0]} maxBarSize={20} />
              <Bar dataKey="bull" fill={SCENARIO_COLORS.bull} radius={[2, 2, 0, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── Growth Chart ───────────────────────────────────────────────────────────
function GrowthChart() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  if (!activePortfolio || activePortfolio.stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        Add stocks to see growth projection
      </div>
    );
  }

  const years = activePortfolio.projectionYears;
  const bear = calcPortfolioProjection(activePortfolio.stocks, activePortfolio.cashPct, activePortfolio.totalCapital, stockLibrary, 'bear', years);
  const base = calcPortfolioProjection(activePortfolio.stocks, activePortfolio.cashPct, activePortfolio.totalCapital, stockLibrary, 'base', years);
  const bull = calcPortfolioProjection(activePortfolio.stocks, activePortfolio.cashPct, activePortfolio.totalCapital, stockLibrary, 'bull', years);

  const chartData = Array.from({ length: years + 1 }, (_, i) => ({
    year: i === 0 ? 'Now' : `Y${i}`,
    bear: bear.yearlyValues[i],
    base: base.yearlyValues[i],
    bull: bull.yearlyValues[i],
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-[oklch(0.17_0.04_255)] border border-[oklch(1_0_0/10%)] rounded-lg p-2.5 shadow-xl">
          <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
          {payload.map((p: any) => (
            <div key={p.name} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ background: p.stroke }} />
              <span className="text-muted-foreground capitalize">{p.name}:</span>
              <span className="font-mono font-medium" style={{ color: p.stroke }}>{formatCurrency(p.value, true)}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="bullGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SCENARIO_COLORS.bull} stopOpacity={0.15} />
              <stop offset="95%" stopColor={SCENARIO_COLORS.bull} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="baseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SCENARIO_COLORS.base} stopOpacity={0.15} />
              <stop offset="95%" stopColor={SCENARIO_COLORS.base} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="bearGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={SCENARIO_COLORS.bear} stopOpacity={0.15} />
              <stop offset="95%" stopColor={SCENARIO_COLORS.bear} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 5%)" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'DM Mono' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatCurrency(v, true)}
            width={60}
          />
          <RechartTooltip content={<CustomTooltip />} />
          <ReferenceLine
            y={activePortfolio.totalCapital}
            stroke="oklch(1 0 0 / 20%)"
            strokeDasharray="4 4"
            label={{ value: 'Invested', position: 'insideTopRight', fontSize: 9, fill: '#94a3b8' }}
          />
          <Area type="monotone" dataKey="bull" stroke={SCENARIO_COLORS.bull} strokeWidth={2} fill="url(#bullGrad)" dot={false} />
          <Area type="monotone" dataKey="base" stroke={SCENARIO_COLORS.base} strokeWidth={2} fill="url(#baseGrad)" dot={false} />
          <Area type="monotone" dataKey="bear" stroke={SCENARIO_COLORS.bear} strokeWidth={2} fill="url(#bearGrad)" dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Stock Detail Table ─────────────────────────────────────────────────────
function StockDetailTable() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);
  const setSelectedStockId = usePortfolioStore((s) => s.setSelectedStockId);
  const setProjectionDrawerOpen = usePortfolioStore((s) => s.setProjectionDrawerOpen);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  if (!activePortfolio || activePortfolio.stocks.length === 0) return null;

  const years = activePortfolio.projectionYears;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-[oklch(1_0_0/8%)]">
            <th className="text-left py-2 px-2 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Stock</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Alloc.</th>
            <th className="text-right py-2 px-2 text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Invested</th>
            <th className="text-right py-2 px-2 text-[#dc4040] font-medium uppercase tracking-wider text-[10px]">Bear</th>
            <th className="text-right py-2 px-2 text-[#c9a84c] font-medium uppercase tracking-wider text-[10px]">Base</th>
            <th className="text-right py-2 px-2 text-[#22c55e] font-medium uppercase tracking-wider text-[10px]">Bull</th>
          </tr>
        </thead>
        <tbody>
          {activePortfolio.stocks.map((ps) => {
            const stock = stockLibrary.find((s) => s.id === ps.stockId);
            if (!stock) return null;
            const invested = (ps.allocationPct / 100) * activePortfolio.totalCapital;
            const bearTarget = calcTargetPrice(stock.projections.bear, stock.projections, years);
            const baseTarget = calcTargetPrice(stock.projections.base, stock.projections, years);
            const bullTarget = calcTargetPrice(stock.projections.bull, stock.projections, years);
            const cp = stock.projections.currentPrice;
            const bearFV = cp > 0 ? invested * (bearTarget / cp) : invested;
            const baseFV = cp > 0 ? invested * (baseTarget / cp) : invested;
            const bullFV = cp > 0 ? invested * (bullTarget / cp) : invested;
            const color = INDUSTRY_COLORS[stock.industry];

            return (
              <tr
                key={ps.stockId}
                className="border-b border-[oklch(1_0_0/4%)] hover:bg-[oklch(1_0_0/3%)] cursor-pointer transition-colors"
                onClick={() => { setSelectedStockId(stock.id); setProjectionDrawerOpen(true); }}
              >
                <td className="py-2 px-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <span className="font-mono font-semibold text-foreground">{stock.ticker}</span>
                  </div>
                </td>
                <td className="py-2 px-2 text-right font-mono text-muted-foreground">{ps.allocationPct.toFixed(1)}%</td>
                <td className="py-2 px-2 text-right font-mono text-foreground">{formatCurrency(invested, true)}</td>
                <td className="py-2 px-2 text-right font-mono" style={{ color: SCENARIO_COLORS.bear }}>{formatCurrency(bearFV, true)}</td>
                <td className="py-2 px-2 text-right font-mono" style={{ color: SCENARIO_COLORS.base }}>{formatCurrency(baseFV, true)}</td>
                <td className="py-2 px-2 text-right font-mono" style={{ color: SCENARIO_COLORS.bull }}>{formatCurrency(bullFV, true)}</td>
              </tr>
            );
          })}
          {/* Cash row */}
          <tr className="border-b border-[oklch(1_0_0/4%)]">
            <td className="py-2 px-2">
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[#94a3b8]" />
                <span className="font-mono font-semibold text-muted-foreground">CASH</span>
              </div>
            </td>
            <td className="py-2 px-2 text-right font-mono text-muted-foreground">{activePortfolio.cashPct.toFixed(1)}%</td>
            <td className="py-2 px-2 text-right font-mono text-muted-foreground">{formatCurrency((activePortfolio.cashPct / 100) * activePortfolio.totalCapital, true)}</td>
            <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
            <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
            <td className="py-2 px-2 text-right font-mono text-muted-foreground">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main Analytics Panel ───────────────────────────────────────────────────
export default function AnalyticsPanel() {
  return (
    <div className="flex flex-col h-full bg-[oklch(0.13_0.04_255)]">
      <div className="px-4 py-3 border-b border-[oklch(1_0_0/8%)]">
        <h2 className="font-serif text-base font-semibold text-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-[oklch(0.75_0.12_75)]" />
          Portfolio Analytics
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="allocation" className="h-full">
          <TabsList className="w-full bg-[oklch(1_0_0/4%)] rounded-none border-b border-[oklch(1_0_0/8%)] px-2 justify-start gap-0 h-10">
            <TabsTrigger value="allocation" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-[oklch(0.75_0.12_75)] data-[state=active]:bg-transparent px-2 sm:px-3 h-10">
              <PieIcon className="w-3 h-3 sm:mr-1.5" />
              <span className="hidden sm:inline">Allocation</span>
            </TabsTrigger>
            <TabsTrigger value="scenarios" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-[oklch(0.75_0.12_75)] data-[state=active]:bg-transparent px-2 sm:px-3 h-10">
              <BarChart3 className="w-3 h-3 sm:mr-1.5" />
              <span className="hidden sm:inline">Scenarios</span>
            </TabsTrigger>
            <TabsTrigger value="growth" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-[oklch(0.75_0.12_75)] data-[state=active]:bg-transparent px-2 sm:px-3 h-10">
              <TrendingUp className="w-3 h-3 sm:mr-1.5" />
              <span className="hidden sm:inline">Growth</span>
            </TabsTrigger>
            <TabsTrigger value="detail" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-[oklch(0.75_0.12_75)] data-[state=active]:bg-transparent px-2 sm:px-3 h-10">
              <Activity className="w-3 h-3 sm:mr-1.5" />
              <span className="hidden sm:inline">Detail</span>
            </TabsTrigger>
            <TabsTrigger value="compare" className="text-xs rounded-none border-b-2 border-transparent data-[state=active]:border-[oklch(0.75_0.12_75)] data-[state=active]:bg-transparent px-2 sm:px-3 h-10">
              <GitCompare className="w-3 h-3 sm:mr-1.5" />
              <span className="hidden sm:inline">Compare</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="allocation" className="p-4 mt-0">
            <AllocationDonut />
          </TabsContent>

          <TabsContent value="scenarios" className="p-4 mt-0">
            <ScenarioComparison />
          </TabsContent>

          <TabsContent value="growth" className="p-4 mt-0">
            <GrowthChart />
          </TabsContent>

          <TabsContent value="detail" className="p-4 mt-0">
            <StockDetailTable />
          </TabsContent>
          <TabsContent value="compare" className="mt-0 h-full">
            <PortfolioComparison />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
