// Portfolio Planner — Add Custom Stock Dialog
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Allows adding any stock not in the S&P 500 catalog with manual entry

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Plus, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePortfolioStore } from '@/lib/store';
import type { Industry } from '@/lib/types';
import { DEFAULT_PROJECTIONS } from '@/lib/types';
import { toast } from 'sonner';

const INDUSTRIES: Industry[] = [
  'Technology', 'Healthcare', 'Financials', 'Consumer Discretionary',
  'Consumer Staples', 'Energy', 'Industrials', 'Materials',
  'Real Estate', 'Utilities', 'Communication Services', 'Crypto', 'ETF', 'Other',
];

function FieldRow({ label, tooltip, children }: { label: string; tooltip?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground/60 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs max-w-48">{tooltip}</TooltipContent>
          </Tooltip>
        )}
      </div>
      {children}
    </div>
  );
}

export default function AddCustomStockDialog() {
  const addStockToLibrary = usePortfolioStore((s) => s.addStockToLibrary);
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);

  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState<Industry>('Technology');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currentMarketCap, setCurrentMarketCap] = useState('');
  const [currentRevenue, setCurrentRevenue] = useState('');
  const [currentNetIncome, setCurrentNetIncome] = useState('');
  const [currentEPS, setCurrentEPS] = useState('');
  const [sharesOutstanding, setSharesOutstanding] = useState('');

  const reset = () => {
    setTicker(''); setName(''); setIndustry('Technology');
    setCurrentPrice(''); setCurrentMarketCap(''); setCurrentRevenue('');
    setCurrentNetIncome(''); setCurrentEPS(''); setSharesOutstanding('');
  };

  const handleSubmit = () => {
    const t = ticker.trim().toUpperCase();
    const n = name.trim();
    if (!t || !n) {
      toast.error('Ticker and company name are required');
      return;
    }
    if (stockLibrary.some((s) => s.ticker === t)) {
      toast.error(`${t} already exists in your library`);
      return;
    }

    const price = parseFloat(currentPrice) || 100;
    const marketCap = parseFloat(currentMarketCap) || price * 1000;
    const revenue = parseFloat(currentRevenue) || 0;
    const netIncome = parseFloat(currentNetIncome) || 0;
    const eps = parseFloat(currentEPS) || 0;
    const shares = parseFloat(sharesOutstanding) || 1000;
    const pe = eps > 0 ? price / eps : 20;
    const ps = revenue > 0 ? (marketCap / revenue) : 10;

    const stock = {
      id: nanoid(),
      ticker: t,
      name: n,
      industry,
      projections: {
        ...DEFAULT_PROJECTIONS,
        currentPrice: price,
        currentMarketCap: marketCap,
        currentRevenue: revenue,
        currentNetIncome: netIncome,
        currentEPS: eps,
        currentPE: pe,
        currentPS: ps,
        currentFCF: netIncome * 0.8,
        bear: {
          ...DEFAULT_PROJECTIONS.bear,
          sharesOutstanding: shares,
          epsCurrentYear: eps,
          revenueCurrentYear: revenue,
          netIncomeCurrentYear: netIncome,
          fcfCurrentYear: netIncome * 0.8,
        },
        base: {
          ...DEFAULT_PROJECTIONS.base,
          sharesOutstanding: shares,
          epsCurrentYear: eps,
          revenueCurrentYear: revenue,
          netIncomeCurrentYear: netIncome,
          fcfCurrentYear: netIncome * 0.8,
        },
        bull: {
          ...DEFAULT_PROJECTIONS.bull,
          sharesOutstanding: shares,
          epsCurrentYear: eps,
          revenueCurrentYear: revenue,
          netIncomeCurrentYear: netIncome,
          fcfCurrentYear: netIncome * 0.8,
        },
      },
    };

    addStockToLibrary(stock);
    toast.success(`${t} added to your library`);
    reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-[oklch(0.75_0.12_75)] hover:bg-[oklch(0.75_0.12_75/8%)] border border-[oklch(1_0_0/8%)] hover:border-[oklch(0.75_0.12_75/30%)] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Custom Stock
        </button>
      </DialogTrigger>

      <DialogContent className="bg-[oklch(0.14_0.04_255)] border-[oklch(1_0_0/10%)] text-foreground max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-[oklch(0.75_0.12_75)]" />
            Add Custom Stock
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Add any stock, ETF, or asset not in the S&P 500 catalog. You can fill in projections later.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Basic Info */}
          <div className="rounded-lg border border-[oklch(1_0_0/8%)] bg-[oklch(1_0_0/3%)] p-3 space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Basic Information</p>

            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Ticker Symbol *" tooltip="e.g. AAPL, BHP.AX, 0700.HK">
                <Input
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder="e.g. BHP"
                  className="h-8 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)] uppercase"
                  maxLength={12}
                />
              </FieldRow>
              <FieldRow label="Industry / Sector">
                <Select value={industry} onValueChange={(v) => setIndustry(v as Industry)}>
                  <SelectTrigger className="h-8 text-xs bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[oklch(0.16_0.04_255)] border-[oklch(1_0_0/10%)]">
                    {INDUSTRIES.map((ind) => (
                      <SelectItem key={ind} value={ind} className="text-xs">{ind}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FieldRow>
            </div>

            <FieldRow label="Company Name *">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. BHP Group Limited"
                className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]"
              />
            </FieldRow>
          </div>

          {/* Current Financials */}
          <div className="rounded-lg border border-[oklch(1_0_0/8%)] bg-[oklch(1_0_0/3%)] p-3 space-y-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Current Financials <span className="normal-case font-normal">(optional — can be filled in later)</span></p>

            <div className="grid grid-cols-2 gap-3">
              <FieldRow label="Current Price ($)" tooltip="Current share price in USD">
                <Input
                  type="number"
                  value={currentPrice}
                  onChange={(e) => setCurrentPrice(e.target.value)}
                  placeholder="e.g. 150"
                  className="h-8 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]"
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Market Cap ($M)" tooltip="Market capitalization in millions USD">
                <Input
                  type="number"
                  value={currentMarketCap}
                  onChange={(e) => setCurrentMarketCap(e.target.value)}
                  placeholder="e.g. 250000"
                  className="h-8 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]"
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Revenue TTM ($M)" tooltip="Trailing twelve months revenue in millions">
                <Input
                  type="number"
                  value={currentRevenue}
                  onChange={(e) => setCurrentRevenue(e.target.value)}
                  placeholder="e.g. 50000"
                  className="h-8 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]"
                  min={0}
                />
              </FieldRow>
              <FieldRow label="Net Income TTM ($M)" tooltip="Trailing twelve months net income in millions">
                <Input
                  type="number"
                  value={currentNetIncome}
                  onChange={(e) => setCurrentNetIncome(e.target.value)}
                  placeholder="e.g. 5000"
                  className="h-8 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]"
                />
              </FieldRow>
              <FieldRow label="EPS (TTM)" tooltip="Earnings per share, trailing twelve months">
                <Input
                  type="number"
                  value={currentEPS}
                  onChange={(e) => setCurrentEPS(e.target.value)}
                  placeholder="e.g. 6.50"
                  className="h-8 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]"
                />
              </FieldRow>
              <FieldRow label="Shares Outstanding (M)" tooltip="Total shares outstanding in millions">
                <Input
                  type="number"
                  value={sharesOutstanding}
                  onChange={(e) => setSharesOutstanding(e.target.value)}
                  placeholder="e.g. 1500"
                  className="h-8 text-sm font-mono bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] focus:border-[oklch(0.75_0.12_75/50%)]"
                  min={0}
                />
              </FieldRow>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              onClick={() => { reset(); setOpen(false); }}
              className="flex-1 h-9 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 h-9 text-sm bg-[oklch(0.75_0.12_75)] text-[oklch(0.12_0.04_255)] hover:bg-[oklch(0.80_0.12_75)] font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add to Library
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
