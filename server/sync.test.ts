/**
 * Tests for cloud sync tRPC procedures.
 * Verifies that sync.load, sync.pushPortfolios, sync.deletePortfolio,
 * and sync.pushStockProjection behave correctly.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the db module so tests don't need a real database
vi.mock("./db", () => ({
  getAllPortfoliosWithStocks: vi.fn().mockResolvedValue([]),
  getStockProjectionsByUserId: vi.fn().mockResolvedValue([]),
  getUserSettings: vi.fn().mockResolvedValue(null),
  upsertPortfolio: vi.fn().mockResolvedValue(undefined),
  deletePortfolio: vi.fn().mockResolvedValue(undefined),
  deletePortfoliosNotInList: vi.fn().mockResolvedValue(undefined),
  replacePortfolioStocks: vi.fn().mockResolvedValue(undefined),
  upsertStockProjection: vi.fn().mockResolvedValue(undefined),
  upsertUserSettings: vi.fn().mockResolvedValue(undefined),
}));

function createAuthContext(userId = 1): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: {
      id: userId,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
  return { ctx };
}

describe("sync.load", () => {
  it("returns empty portfolios and projections for a new user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sync.load();
    expect(result.portfolios).toEqual([]);
    expect(result.projections).toEqual([]);
    expect(result.activePortfolioId).toBeNull();
  });
});

describe("sync.pushPortfolios", () => {
  it("accepts a valid portfolio payload and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sync.pushPortfolios({
      portfolios: [
        {
          id: "portfolio-1",
          name: "My Portfolio",
          totalCapital: 100000,
          allocationMode: "percentage",
          cashPct: 20,
          projectionYears: 5,
          stocks: [
            { stockId: "AAPL", allocationPct: 40, sortOrder: 0 },
            { stockId: "NVDA", allocationPct: 40, sortOrder: 1 },
          ],
        },
      ],
      activePortfolioId: "portfolio-1",
    });
    expect(result).toEqual({ success: true });
  });

  it("accepts an empty portfolios array", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sync.pushPortfolios({
      portfolios: [],
      activePortfolioId: null,
    });
    expect(result).toEqual({ success: true });
  });
});

describe("sync.deletePortfolio", () => {
  it("accepts a valid portfolio ID and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sync.deletePortfolio({ portfolioId: "portfolio-1" });
    expect(result).toEqual({ success: true });
  });
});

describe("sync.pushStockProjection", () => {
  it("accepts a valid stock projection payload and returns success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.sync.pushStockProjection({
      stockId: "AAPL",
      projections: {
        bear: {
          netIncomeGrowthRate: 8,
          revenueGrowthRate: 5,
          netMarginPct: 22,
          peMultiple: 20,
          psMultiple: 5,
          fcfMultiple: 20,
          fcfMarginPct: 22,
        },
        base: {
          netIncomeGrowthRate: 15,
          revenueGrowthRate: 10,
          netMarginPct: 25,
          peMultiple: 28,
          psMultiple: 7,
          fcfMultiple: 25,
          fcfMarginPct: 25,
        },
        bull: {
          netIncomeGrowthRate: 25,
          revenueGrowthRate: 18,
          netMarginPct: 28,
          peMultiple: 35,
          psMultiple: 9,
          fcfMultiple: 32,
          fcfMarginPct: 28,
        },
        currentPrice: 220.5,
        currentMarketCapB: 3300,
        currentRevenueB: 400,
        currentNetIncomeB: 100,
        currentEPS: 6.5,
        currentEPSForward: 7.2,
        currentSharesB: 15.3,
        currentFCFB: 95,
        currentNetMarginPct: 25,
        currentGrossMarginPct: 46,
        currentRevenueGrowthPct: 6,
        currentPE: 33,
        currentPEForward: 30,
        currentPS: 8.2,
        valuationMethod: "pe",
        dataAsOf: "2026-02-28",
      },
    });
    expect(result).toEqual({ success: true });
  });
});
