// Portfolio Planner — Add Custom Stock Dialog
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Allows adding any stock not in the catalog with manual entry

import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Plus, Info } from 'lucide-react';
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
  const [currentRevenueB, setCurrentRevenueB] = useState('');
  const [currentNetIncomeB, setCurrentNetIncomeB] = useState('');
  const [currentSharesB, setCurrentSharesB] = useState('');

  const reset = () => {
    setTicker(''); setName(''); setIndustry('Technology');
    setCurrentPrice(''); setCurrentRevenueB('');
    setCurrentNetIncomeB(''); setCurrentSharesB('');
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
    const revB = parseFloat(currentRevenueB) || 0;
    const niB = parseFloat(currentNetIncomeB) || 0;
    const sharesB = parseFloat(currentSharesB) || 0.5;
    const netMarginPct = revB > 0 ? (niB / revB) * 100 : 10;
    const eps = sharesB > 0 ? niB / sharesB : 0;
    const pe = eps > 0 ? price / eps : 20;
    const ps = revB > 0 ? (price * sharesB) / revB : 5;
    const fcfB = niB * 0.8;

    const stock = {
      id: nanoid(),
      ticker: t,
      name: n,
      industry,
      tag: industry.split(' ')[0],
      projections: {
        ...DEFAULT_PROJECTIONS,
        currentPrice: price,
        currentMarketCapB: price * sharesB,
        currentRevenueB: revB,
        currentNetIncomeB: niB,
        currentEPS: parseFloat(eps.toFixed(3)),
        currentEPSForward: parseFloat(eps.toFixed(3)),
        currentSharesB: sharesB,
        currentFCFB: fcfB,
        currentNetMarginPct: parseFloat(netMarginPct.toFixed(2)),
        currentGrossMarginPct: 0,
        currentRevenueGrowthPct: 10,
        currentPE: parseFloat(pe.toFixed(2)),
        currentPEForward: parseFloat(pe.toFixed(2)),
        currentPS: parseFloat(ps.toFixed(2)),
        valuationMethod: 'pe' as const,
        dataAsOf: new Date().toISOString().split('T')[0],
        bear: {
          ...DEFAULT_PROJECTIONS.bear,
          netMarginPct: Math.max(-20, netMarginPct * 0.7),
        },
        base: {
          ...DEFAULT_PROJECTIONS.base,
          netMarginPct: netMarginPct,
        },
        bull: {
          ...DEFAULT_PROJECTIONS.bull,
          netMarginPct: Math.min(80, netMarginPct * 1.4),
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
          style={{ touchAction: 'manipulation' }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-[oklch(0.68_0.12_75)] hover:bg-[oklch(0.68_0.12_75/5%)] border border-[oklch(1_0_0/8%)] hover:border-[oklch(0.68_0.12_75/22%)] transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Custom Stock
        </button>
      </DialogTrigger>

      <DialogContent className="bg-[oklch(0.21_0.03_155)] border-[oklch(1_0_0/10%)] text-foreground max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <Plus className="w-4 h-4 text-[oklch(0.68_0.12_75)]" />
            Add Custom Stock
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Ticker Symbol *">
              <Input
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="e.g. NVDA"
                className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)] uppercase"
                maxLength={10}
              />
            </FieldRow>
            <FieldRow label="Company Name *">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. NVIDIA Corp."
                className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
              />
            </FieldRow>
          </div>

          <FieldRow label="Industry">
            <Select value={industry} onValueChange={(v) => setIndustry(v as Industry)}>
              <SelectTrigger className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[oklch(0.24_0.03_155)] border-[oklch(1_0_0/10%)]">
                {INDUSTRIES.map((ind) => (
                  <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Current Price ($)" tooltip="Latest stock price in USD">
              <Input
                type="number"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="e.g. 150"
                className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
                min={0}
                step={0.01}
              />
            </FieldRow>
            <FieldRow label="Shares Outstanding (B)" tooltip="Shares outstanding in billions">
              <Input
                type="number"
                value={currentSharesB}
                onChange={(e) => setCurrentSharesB(e.target.value)}
                placeholder="e.g. 2.5"
                className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
                min={0}
                step={0.01}
              />
            </FieldRow>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FieldRow label="Revenue TTM ($B)" tooltip="Trailing twelve months revenue in billions">
              <Input
                type="number"
                value={currentRevenueB}
                onChange={(e) => setCurrentRevenueB(e.target.value)}
                placeholder="e.g. 5.2"
                className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
                min={0}
                step={0.1}
              />
            </FieldRow>
            <FieldRow label="Net Income TTM ($B)" tooltip="Trailing twelve months net income in billions">
              <Input
                type="number"
                value={currentNetIncomeB}
                onChange={(e) => setCurrentNetIncomeB(e.target.value)}
                placeholder="e.g. 0.8"
                className="h-8 text-sm bg-[oklch(1_0_0/5%)] border-[oklch(1_0_0/10%)]"
                step={0.01}
              />
            </FieldRow>
          </div>

          <div className="p-3 rounded-lg bg-[oklch(0.68_0.12_75/5%)] border border-[oklch(0.68_0.12_75/14%)]">
            <p className="text-[11px] text-[oklch(0.68_0.12_75)]">
              EPS, P/E, P/S, and net margin will be auto-calculated from the values above.
              You can fine-tune projections in the Projection Drawer after adding.
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9 text-sm border-[oklch(1_0_0/10%)] text-muted-foreground"
              onClick={() => { reset(); setOpen(false); }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 h-9 text-sm bg-[oklch(0.68_0.12_75)] hover:bg-[oklch(0.62_0.10_75)] text-[oklch(0.1_0_0)]"
              onClick={handleSubmit}
            >
              Add to Library
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
