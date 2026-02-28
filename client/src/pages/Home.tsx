// Portfolio Planner — Main Dashboard
// Design: Sophisticated Finance Dashboard (deep navy + gold)
// Layout: Left sidebar (stock library) | Center (portfolio manager) | Right (analytics)
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
import { usePortfolioStore } from '@/lib/store';
import { TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

export default function Home() {
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const createPortfolio = usePortfolioStore((s) => s.createPortfolio);
  const projectionDrawerOpen = usePortfolioStore((s) => s.projectionDrawerOpen);
  const addStockToPortfolio = usePortfolioStore((s) => s.addStockToPortfolio);
  const reorderPortfolioStocks = usePortfolioStore((s) => s.reorderPortfolioStocks);
  const activePortfolioId = usePortfolioStore((s) => s.activePortfolioId);

  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragTicker, setActiveDragTicker] = useState<string>('');
  const stockLibrary = usePortfolioStore((s) => s.stockLibrary);

  // Create default portfolio on first load
  useEffect(() => {
    if (portfolios.length === 0) {
      createPortfolio('My Portfolio');
    }
  }, []);

  // Sensors: require 8px movement before drag starts (prevents accidental drags on click)
  // Also add delay-based activation so scroll areas still work
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveDragId(id);
    const data = event.active.data.current;
    if (data?.type === 'library-stock') {
      const stock = stockLibrary.find((s) => s.id === data.stockId);
      setActiveDragTicker(stock?.ticker ?? '');
    } else {
      // Sortable row — id is the stockId
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
      // Accept drop on the drop zone OR on any existing stock row OR on the portfolio area
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
          background: 'oklch(0.12 0.04 255)',
          backgroundImage: `url("https://d2xsxph8kpxj0f.cloudfront.net/310519663323260294/jkQ9xJrmBM27yUbTi7dGC8/stock-card-bg-efvSKzMfYjakid25CnBPMB.webp")`,
          backgroundSize: '400px',
          backgroundBlendMode: 'overlay',
        }}
      >
        {/* Top Navigation Bar */}
        <header className="h-14 flex items-center justify-between px-4 border-b border-[oklch(1_0_0/8%)] bg-[oklch(0.13_0.04_255/95%)] backdrop-blur-sm shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[oklch(0.75_0.12_75)] flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-[oklch(0.12_0.04_255)]" />
            </div>
            <div>
              <h1 className="font-serif text-base font-semibold text-foreground leading-tight">Portfolio Planner</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Scenario-based investment planning</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <QuickStats />
          </div>
        </header>

        {/* Main layout */}
        <div className={`flex-1 overflow-hidden transition-all duration-300 ${projectionDrawerOpen ? 'mr-[480px]' : ''}`}>
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Stock Library Sidebar */}
            <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
              <StockLibrary />
            </ResizablePanel>

            <ResizableHandle className="w-px bg-[oklch(1_0_0/8%)] hover:bg-[oklch(0.75_0.12_75/40%)] transition-colors" />

            {/* Portfolio Manager — no longer owns DndContext */}
            <ResizablePanel defaultSize={45} minSize={30}>
              <PortfolioManager />
            </ResizablePanel>

            <ResizableHandle className="w-px bg-[oklch(1_0_0/8%)] hover:bg-[oklch(0.75_0.12_75/40%)] transition-colors" />

            {/* Analytics Panel */}
            <ResizablePanel defaultSize={37} minSize={25}>
              <AnalyticsPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Projection Drawer (slides in from right) */}
        <ProjectionDrawer />
      </div>

      {/* Drag Overlay — shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeDragId && (
          <div className="px-3 py-2 rounded-lg bg-[oklch(0.17_0.04_255)] border border-[oklch(0.75_0.12_75/70%)] shadow-2xl text-sm font-mono font-bold text-[oklch(0.75_0.12_75)] opacity-95 pointer-events-none">
            {activeDragTicker || 'Moving...'}
          </div>
        )}
      </DragOverlay>
    </DndContext>
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
    <div className="flex items-center gap-4">
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Capital</p>
        <p className="font-mono text-sm font-semibold text-[oklch(0.75_0.12_75)]">{formatK(capital)}</p>
      </div>
      <div className="w-px h-8 bg-[oklch(1_0_0/8%)]" />
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Positions</p>
        <p className="font-mono text-sm font-semibold text-foreground">{stockCount}</p>
      </div>
      <div className="w-px h-8 bg-[oklch(1_0_0/8%)]" />
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Portfolios</p>
        <p className="font-mono text-sm font-semibold text-foreground">{portfolios.length}</p>
      </div>
      <div className="w-px h-8 bg-[oklch(1_0_0/8%)]" />
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Horizon</p>
        <p className="font-mono text-sm font-semibold text-foreground">{activePortfolio.projectionYears}yr</p>
      </div>
    </div>
  );
}
