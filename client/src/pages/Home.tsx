// Portfolio Planner — Main Dashboard
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Desktop: Left sidebar (stock library) | Center (portfolio manager) | Right (analytics)
// Mobile: Full-screen panels with bottom tab navigation
// DndContext is at the top level so StockLibrary (draggable) and PortfolioManager (droppable) share the same context

import { useEffect, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import StockLibrary from '@/components/StockLibrary';
import PortfolioManager from '@/components/PortfolioManager';
import AnalyticsPanel from '@/components/AnalyticsPanel';
import ProjectionDrawer from '@/components/ProjectionDrawer';
import { nanoid } from 'nanoid';
import { usePortfolioStore } from '@/lib/store';
import { TrendingUp, BookOpen, BarChart3, PieChart, X, Cloud, CloudOff, LogIn, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/_core/hooks/useAuth';
import { useCloudSync } from '@/hooks/useCloudSync';
import { getLoginUrl } from '@/const';

type MobileTab = 'library' | 'portfolio' | 'analytics';

export default function Home() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { isSyncing } = useCloudSync(isAuthenticated);

  const portfolios = usePortfolioStore((s) => s.portfolios);
  const hasHydrated = usePortfolioStore((s) => s._hasHydrated);
  const createPortfolio = usePortfolioStore((s) => s.createPortfolio);
  const projectionDrawerOpen = usePortfolioStore((s) => s.projectionDrawerOpen);
  const setProjectionDrawerOpen = usePortfolioStore((s) => s.setProjectionDrawerOpen);
  const addStockToPortfolio = usePortfolioStore((s) => s.addStockToPortfolio);
  const reorderPortfolioStocks = usePortfolioStore((s) => s.reorderPortfolioStocks);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragTicker, setActiveDragTicker] = useState<string>('');
  const [mobileTab, setMobileTab] = useState<MobileTab>('portfolio');
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);

  // After hydration, inject Current Portfolio if it doesn't already exist
  const stockLibraryForInit = usePortfolioStore((s) => s.stockLibrary);
  const setHasHydrated = usePortfolioStore((s) => s.setHasHydrated);

  // Fallback: if no persisted data exists, onRehydrateStorage fires before React mounts
  // so _hasHydrated never transitions. Force it after 50ms.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!usePortfolioStore.getState()._hasHydrated) {
        setHasHydrated(true);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Fallback injection: only fires on a truly fresh session (no localStorage at all).
  // The store's onRehydrateStorage and loadCloudData handle all other cases.
  const currentPortfolioInjected = usePortfolioStore((s) => s._currentPortfolioInjected);
  const createCurrentPortfolioFromLibrary = usePortfolioStore((s) => s.createCurrentPortfolioFromLibrary);
  useEffect(() => {
    if (!hasHydrated) return;
    if (stockLibraryForInit.length === 0) return;
    // Guard: if the store already has it (from localStorage or cloud), do nothing
    if (currentPortfolioInjected) return;
    if (portfolios.some((p) => p.name === 'Current Portfolio')) return;
    // Only reach here on a completely fresh session with no persisted data
    createCurrentPortfolioFromLibrary();
  }, [hasHydrated, stockLibraryForInit.length, currentPortfolioInjected]);

  // Sensors: require 8px movement before drag starts (prevents accidental drags on click)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveDragId(id);
    const data = event.active.data.current;
    if (data?.type === 'library-stock') {
      const stock = stockLibrary.find((s) => s.id === data.stockId);
      setActiveDragTicker(stock?.ticker ?? '');
      // On mobile, auto-switch to portfolio tab when dragging starts
      setMobileTab('portfolio');
    } else {
      const stock = stockLibrary.find((s) => s.id === id);
      setActiveDragTicker(stock?.ticker ?? '');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    setActiveDragTicker('');
    const { active, over } = event;
    if (!over) return;

    const activeData = event.active.data.current;
    const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);

    // ── Drop from library into portfolio ──────────────────────────────────
    if (activeData?.type === 'library-stock') {
      const overId = String(over.id);
      if (
        overId === 'portfolio-drop-zone' ||
        overId === 'portfolio-drop-bottom' ||
        (activePortfolio && activePortfolio.stocks.some((s) => s.stockId === overId))
      ) {
        addStockToPortfolio(activeData.stockId);
        toast.success('Stock added to portfolio');
      }
      return;
    }

    // ── Reorder within portfolio ───────────────────────────────────────────
    if (activePortfolio && active.id !== over.id) {
      const oldIndex = activePortfolio.stocks.findIndex((s) => s.stockId === active.id);
      const newIndex = activePortfolio.stocks.findIndex((s) => s.stockId === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        reorderPortfolioStocks(arrayMove(activePortfolio.stocks, oldIndex, newIndex));
      }
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={{
          background: 'oklch(0.19 0.03 155)',
          backgroundImage: `url("https://d2xsxph8kpxj0f.cloudfront.net/310519663323260294/jkQ9xJrmBM27yUbTi7dGC8/stock-card-bg-efvSKzMfYjakid25CnBPMB.webp")`,
          backgroundSize: '400px',
          backgroundBlendMode: 'overlay',
        }}
      >
        {/* Top Navigation Bar */}
        <header className="h-12 md:h-14 flex items-center justify-between px-3 md:px-4 border-b border-[oklch(1_0_0/8%)] bg-[oklch(0.20_0.03_155/95%)] backdrop-blur-sm shrink-0 z-10">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-7 h-7 md:w-8 md:h-8 rounded-lg bg-[oklch(0.68_0.12_75)] flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-[oklch(0.19_0.03_155)]" />
            </div>
            <div>
              <h1 className="font-serif text-sm md:text-base font-semibold text-foreground leading-tight">Portfolio Planner</h1>
              <p className="hidden sm:block text-[10px] text-muted-foreground leading-tight">Scenario-based investment planning</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <QuickStats />
            <SyncStatus isAuthenticated={isAuthenticated} authLoading={authLoading} isSyncing={isSyncing} />
          </div>
        </header>

        {/* ── Desktop Layout (md+): Two resizable panels; Analytics is a tab inside the right panel ── */}
        <div className={`hidden md:flex flex-1 overflow-hidden transition-all duration-300 ${projectionDrawerOpen ? 'mr-[480px]' : ''}`}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
              <StockLibrary />
            </ResizablePanel>
            <ResizableHandle className="w-px bg-[oklch(1_0_0/8%)] hover:bg-[oklch(0.68_0.12_75/30%)] transition-colors" />
            <ResizablePanel defaultSize={82} minSize={50}>
              <PortfolioManagerWithAnalytics />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* ── Mobile Layout (<md): Single panel with bottom tabs ── */}
        <div className="flex md:hidden flex-1 overflow-hidden" style={{ minHeight: 0 }}>
          {/* Panel: Library */}
          {mobileTab === 'library' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <StockLibrary />
            </div>
          )}
          {/* Panel: Portfolio */}
          {mobileTab === 'portfolio' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <PortfolioManager />
            </div>
          )}
          {/* Panel: Analytics */}
          {mobileTab === 'analytics' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <AnalyticsPanel />
            </div>
          )}

          {/* Mobile Projection Drawer overlay */}
          {projectionDrawerOpen && (
            <div className="absolute inset-0 z-50 bg-[oklch(0.19_0.03_155/95%)] backdrop-blur-sm flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[oklch(1_0_0/8%)] shrink-0">
                <h2 className="font-serif text-base font-semibold text-foreground">Stock Projections</h2>
                <button
                  onClick={() => setProjectionDrawerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-[oklch(1_0_0/8%)] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <ProjectionDrawer mobileMode />
              </div>
            </div>
          )}
        </div>

        {/* ── Desktop Projection Drawer (slides in from right) ── */}
        <div className="hidden md:block">
          <ProjectionDrawer />
        </div>

        {/* ── Mobile Bottom Navigation ── */}
        <nav className="flex md:hidden shrink-0 border-t border-[oklch(1_0_0/8%)] bg-[oklch(0.20_0.03_155/98%)] backdrop-blur-sm">
          <MobileTabButton
            label="Library"
            icon={<BookOpen className="w-5 h-5" />}
            active={mobileTab === 'library'}
            onClick={() => setMobileTab('library')}
          />
          <MobileTabButton
            label="Portfolio"
            icon={<BarChart3 className="w-5 h-5" />}
            active={mobileTab === 'portfolio'}
            onClick={() => setMobileTab('portfolio')}
          />
          <MobileTabButton
            label="Analytics"
            icon={<PieChart className="w-5 h-5" />}
            active={mobileTab === 'analytics'}
            onClick={() => setMobileTab('analytics')}
          />
        </nav>
      </div>

      {/* Drag Overlay — shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeDragId && (
          <div className="px-3 py-2 rounded-lg bg-[oklch(0.24_0.03_155)] border border-[oklch(0.68_0.12_75/55%)] shadow-2xl text-sm font-mono font-bold text-[oklch(0.68_0.12_75)] opacity-95 pointer-events-none">
            {activeDragTicker || 'Moving...'}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function MobileTabButton({ label, icon, active, onClick }: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors
        ${active
          ? 'text-[oklch(0.68_0.12_75)]'
          : 'text-muted-foreground hover:text-foreground'
        }`}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
      {active && (
        <div className="absolute bottom-0 w-8 h-0.5 bg-[oklch(0.68_0.12_75)] rounded-t-full" />
      )}
    </button>
  );
}

function QuickStats() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);

  const activePortfolio = portfolios.find((p) => p.id === activePortfolioId);
  if (!activePortfolio) return null;

  const stockCount = activePortfolio.stocks.length;
  const capital = activePortfolio.totalCapital;

  const formatK = (v: number) => {
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toFixed(0)}`;
  };

  return (
    <div className="flex items-center gap-2 md:gap-4">
      <div className="text-center">
        <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">Capital</p>
        <p className="font-mono text-xs md:text-sm font-semibold text-[oklch(0.68_0.12_75)]">{formatK(capital)}</p>
      </div>
      <div className="w-px h-6 md:h-8 bg-[oklch(1_0_0/8%)]" />
      <div className="text-center">
        <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">Positions</p>
        <p className="font-mono text-xs md:text-sm font-semibold text-foreground">{stockCount}</p>
      </div>
      <div className="hidden sm:block w-px h-6 md:h-8 bg-[oklch(1_0_0/8%)]" />
      <div className="hidden sm:block text-center">
        <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">Portfolios</p>
        <p className="font-mono text-xs md:text-sm font-semibold text-foreground">{portfolios.length}</p>
      </div>
      <div className="hidden sm:block w-px h-6 md:h-8 bg-[oklch(1_0_0/8%)]" />
      <div className="hidden sm:block text-center">
        <p className="text-[9px] md:text-[10px] text-muted-foreground uppercase tracking-wider">Horizon</p>
        <p className="font-mono text-xs md:text-sm font-semibold text-foreground">{activePortfolio.projectionYears}yr</p>
      </div>
    </div>
  );
}

function SyncStatus({ isAuthenticated, authLoading, isSyncing }: {
  isAuthenticated: boolean;
  authLoading: boolean;
  isSyncing: boolean;
}) {
  if (authLoading) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        <span className="hidden sm:block text-[10px]">Loading...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <a
        href={getLoginUrl()}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[oklch(0.68_0.12_75/10%)] hover:bg-[oklch(0.68_0.12_75/18%)] border border-[oklch(0.68_0.12_75/22%)] text-[oklch(0.68_0.12_75)] transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" />
        <span className="text-[11px] font-medium">Sign in to sync</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-muted-foreground">
      {isSyncing ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin text-[oklch(0.68_0.12_75)]" />
          <span className="hidden sm:block text-[10px] text-[oklch(0.68_0.12_75)]">Saving...</span>
        </>
      ) : (
        <>
          <Cloud className="w-3.5 h-3.5 text-[oklch(0.58_0.12_145)]" />
          <span className="hidden sm:block text-[10px] text-[oklch(0.58_0.12_145)]">Synced</span>
        </>
      )}
    </div>
  );
}

// ── Desktop: Portfolio + Analytics as tabs ───────────────────────────────────
function PortfolioManagerWithAnalytics() {
  const [activeTab, setActiveTab] = useState<'portfolio' | 'analytics'>('portfolio');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex shrink-0 border-b border-[oklch(1_0_0/8%)] bg-[oklch(0.20_0.03_155/80%)]">
        <button
          onClick={() => setActiveTab('portfolio')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'portfolio'
              ? 'border-[oklch(0.68_0.12_75)] text-[oklch(0.68_0.12_75)]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Portfolio
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'analytics'
              ? 'border-[oklch(0.68_0.12_75)] text-[oklch(0.68_0.12_75)]'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <PieChart className="w-3.5 h-3.5" />
          Analytics
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'portfolio' ? <PortfolioManager /> : <AnalyticsPanel />}
      </div>
    </div>
  );
}
