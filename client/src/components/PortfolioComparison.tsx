// Portfolio Planner — Portfolio Comparison View
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Side-by-side comparison of all portfolios across bear/base/bull scenarios

import { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Download, FileJson } from 'lucide-react';
import { usePortfolioStore } from '@/lib/store';
import { calcPortfolioProjection, formatCurrency, formatPct } from '@/lib/projections';
import { exportPortfolioCSV, exportAllPortfoliosJSON } from '@/lib/exportUtils';
import { toast } from 'sonner';

const SCENARIO_COLORS = {
  bear: '#ef4444',
  base: '#3b82f6',
  bull: '#22c55e',
};

const GOLD = 'oklch(0.75 0.12 75)';

function formatK(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function CAGRBadge({ cagr }: { cagr: number }) {
  const pct = (cagr * 100).toFixed(1);
  if (cagr > 0.05) return (
    <span className="flex items-center gap-0.5 text-emerald-400 font-mono text-xs font-semibold">
      <TrendingUp className="w-3 h-3" />{pct}%
    </span>
  );
  if (cagr < -0.02) return (
    <span className="flex items-center gap-0.5 text-red-400 font-mono text-xs font-semibold">
      <TrendingDown className="w-3 h-3" />{pct}%
    </span>
  );
  return (
    <span className="flex items-center gap-0.5 text-yellow-400 font-mono text-xs font-semibold">
      <Minus className="w-3 h-3" />{pct}%
    </span>
  );
}

export default function PortfolioComparison() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);
  const setActivePortfolio = usePortfolioStore((s) => s.setActivePortfolio);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);

  // Calculate projections for all portfolios
  const projections = useMemo(() => portfolios.map((p) => {
    const bear = calcPortfolioProjection(p.stocks, p.cashPct, p.totalCapital, stockLibrary, 'bear', p.projectionYears);
    const base = calcPortfolioProjection(p.stocks, p.cashPct, p.totalCapital, stockLibrary, 'base', p.projectionYears);
    const bull = calcPortfolioProjection(p.stocks, p.cashPct, p.totalCapital, stockLibrary, 'bull', p.projectionYears);
    return { portfolio: p, bear, base, bull };
  }), [portfolios, stockLibrary]);

  // Chart data: each portfolio is a group with bear/base/bull bars
  const chartData = useMemo(() => projections.map(({ portfolio, bear, base, bull }) => ({
    name: portfolio.name.length > 12 ? portfolio.name.slice(0, 12) + '…' : portfolio.name,
    Bear: Math.round(bear.totalFutureValue),
    Base: Math.round(base.totalFutureValue),
    Bull: Math.round(bull.totalFutureValue),
    capital: portfolio.totalCapital,
  })), [projections]);

  const handleExportCSV = (portfolioId: string) => {
    const portfolio = portfolios.find((p) => p.id === portfolioId);
    if (!portfolio) return;
    exportPortfolioCSV(portfolio, stockLibrary);
    toast.success(`Exported ${portfolio.name} to CSV`);
  };

  const handleExportAll = () => {
    exportAllPortfoliosJSON(portfolios, stockLibrary);
    toast.success('Exported all portfolios to JSON');
  };

  if (portfolios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <p className="text-muted-foreground text-sm">No portfolios yet. Create one to compare.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[oklch(1_0_0/8%)] shrink-0">
        <div>
          <h2 className="font-serif text-sm font-semibold text-foreground">Portfolio Comparison</h2>
          <p className="text-[10px] text-muted-foreground">{portfolios.length} portfolio{portfolios.length !== 1 ? 's' : ''} · Bear / Base / Bull</p>
        </div>
        <button
          onClick={handleExportAll}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-[oklch(0.75_0.12_75)] hover:bg-[oklch(0.75_0.12_75/8%)] border border-[oklch(1_0_0/8%)] hover:border-[oklch(0.75_0.12_75/30%)] transition-all"
        >
          <FileJson className="w-3.5 h-3.5" />
          Export All
        </button>
      </div>

      <div className="flex-1 p-4 space-y-5">
        {/* Bar Chart */}
        {portfolios.length > 0 && (
          <div className="rounded-xl border border-[oklch(1_0_0/8%)] bg-[oklch(1_0_0/2%)] p-4">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-3">
              Projected Portfolio Value Comparison
            </p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} barCategoryGap="25%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 6%)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: 'oklch(0.7 0.01 286)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => formatK(v)}
                  tick={{ fill: 'oklch(0.7 0.01 286)', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip
                  contentStyle={{
                    background: 'oklch(0.17 0.04 255)',
                    border: '1px solid oklch(1 0 0 / 10%)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(value: number) => [formatK(value), '']}
                  labelStyle={{ color: 'oklch(0.85 0.005 65)', fontWeight: 600, marginBottom: 4 }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                  formatter={(value) => <span style={{ color: 'oklch(0.7 0.01 286)' }}>{value}</span>}
                />
                <Bar dataKey="Bear" fill={SCENARIO_COLORS.bear} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Base" fill={SCENARIO_COLORS.base} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Bull" fill={SCENARIO_COLORS.bull} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-portfolio cards */}
        <div className="space-y-3">
          {projections.map(({ portfolio, bear, base, bull }) => {
            const isActive = portfolio.id === activePortfolioId;
            return (
              <div
                key={portfolio.id}
                onClick={() => setActivePortfolio(portfolio.id)}
                className={`rounded-xl border transition-all cursor-pointer ${
                  isActive
                    ? 'border-[oklch(0.75_0.12_75/40%)] bg-[oklch(0.75_0.12_75/5%)]'
                    : 'border-[oklch(1_0_0/8%)] bg-[oklch(1_0_0/2%)] hover:border-[oklch(1_0_0/14%)]'
                }`}
              >
                {/* Portfolio header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[oklch(1_0_0/6%)]">
                  <div className="flex items-center gap-2">
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.12_75)]" />
                    )}
                    <span className="text-sm font-semibold text-foreground font-serif">{portfolio.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-[oklch(1_0_0/5%)] px-1.5 py-0.5 rounded">
                      {portfolio.stocks.length} stocks
                    </span>
                    <span className="text-[10px] text-muted-foreground bg-[oklch(1_0_0/5%)] px-1.5 py-0.5 rounded">
                      {portfolio.projectionYears}yr
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-[oklch(0.75_0.12_75)] font-semibold">
                      {formatK(portfolio.totalCapital)}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleExportCSV(portfolio.id); }}
                      className="p-1 rounded hover:bg-[oklch(1_0_0/8%)] text-muted-foreground hover:text-[oklch(0.75_0.12_75)] transition-colors"
                      title="Export to CSV"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Scenario grid */}
                <div className="grid grid-cols-3 divide-x divide-[oklch(1_0_0/6%)]">
                  {[
                    { label: 'Bear', data: bear, color: SCENARIO_COLORS.bear },
                    { label: 'Base', data: base, color: SCENARIO_COLORS.base },
                    { label: 'Bull', data: bull, color: SCENARIO_COLORS.bull },
                  ].map(({ label, data, color }) => {
                    const gain = data.totalFutureValue - portfolio.totalCapital;
                    const gainPct = portfolio.totalCapital > 0 ? (gain / portfolio.totalCapital) * 100 : 0;
                    return (
                      <div key={label} className="px-3 py-2.5 space-y-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
                        </div>
                        <p className="font-mono text-sm font-bold text-foreground leading-tight">
                          {formatK(data.totalFutureValue)}
                        </p>
                        <div className="flex items-center justify-between">
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: gain >= 0 ? '#22c55e' : '#ef4444' }}
                          >
                            {gain >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
                          </span>
                          <CAGRBadge cagr={data.totalCAGR} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Stock breakdown */}
                {portfolio.stocks.length > 0 && (
                  <div className="px-4 py-2 border-t border-[oklch(1_0_0/6%)]">
                    <div className="flex flex-wrap gap-1.5">
                      {portfolio.stocks.map((ps) => {
                        const stock = stockLibrary.find((s) => s.id === ps.stockId);
                        if (!stock) return null;
                        return (
                          <span
                            key={ps.stockId}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[oklch(1_0_0/5%)] text-muted-foreground"
                          >
                            {stock.ticker} <span className="text-foreground/70">{ps.allocationPct.toFixed(0)}%</span>
                          </span>
                        );
                      })}
                      {portfolio.cashPct > 0 && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[oklch(1_0_0/5%)] text-muted-foreground">
                          CASH <span className="text-foreground/70">{portfolio.cashPct.toFixed(0)}%</span>
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
