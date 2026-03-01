import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import {
  getAllPortfoliosWithStocks,
  getStockProjectionsByUserId,
  getUserSettings,
  upsertPortfolio,
  deletePortfolio,
  deletePortfoliosNotInList,
  replacePortfolioStocks,
  upsertStockProjection,
  upsertUserSettings,
} from "./db";

// ── Zod schemas ───────────────────────────────────────────────────────────────

const portfolioStockSchema = z.object({
  stockId: z.string(),
  allocationPct: z.number(),
  sortOrder: z.number().int(),
});

const portfolioSchema = z.object({
  id: z.string(),
  name: z.string(),
  totalCapital: z.number(),
  allocationMode: z.enum(["percentage", "dollar"]),
  cashPct: z.number(),
  projectionYears: z.number().int(),
  stocks: z.array(portfolioStockSchema),
});

const scenarioSchema = z.object({
  revenueGrowthRate: z.number(),
  netMarginPct: z.number(),
  peMultiple: z.number(),
  psMultiple: z.number(),
  fcfMultiple: z.number(),
  fcfMarginPct: z.number(),
  targetPriceOverride: z.number().optional(),
});

const stockProjectionsSchema = z.object({
  bear: scenarioSchema,
  base: scenarioSchema,
  bull: scenarioSchema,
  currentPrice: z.number(),
  currentMarketCapB: z.number(),
  currentRevenueB: z.number(),
  currentNetIncomeB: z.number(),
  currentEPS: z.number(),
  currentEPSForward: z.number(),
  currentSharesB: z.number(),
  currentFCFB: z.number(),
  currentNetMarginPct: z.number(),
  currentGrossMarginPct: z.number(),
  currentRevenueGrowthPct: z.number(),
  currentPE: z.number(),
  currentPEForward: z.number(),
  currentPS: z.number(),
  valuationMethod: z.enum(["pe", "ps", "fcf", "price"]),
  dataAsOf: z.string().optional(),
});

// ── Router ────────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  sync: router({
    /**
     * Load all cloud data for the current user in one call.
     * Returns portfolios (with stocks), stock projection overrides, and active portfolio setting.
     */
    load: protectedProcedure.query(async ({ ctx }) => {
      const userId = ctx.user.id;
      const [dbPortfolios, dbProjections, settings] = await Promise.all([
        getAllPortfoliosWithStocks(userId),
        getStockProjectionsByUserId(userId),
        getUserSettings(userId),
      ]);
      return {
        portfolios: dbPortfolios,
        projections: dbProjections.map((p) => ({
          stockId: p.stockId,
          projectionsJson: p.projectionsJson,
        })),
        activePortfolioId: settings?.activePortfolioId ?? null,
      };
    }),

    /**
     * Push all portfolios and their stocks to the DB.
     * Called whenever portfolio state changes (debounced on client).
     */
    pushPortfolios: protectedProcedure
      .input(z.object({
        portfolios: z.array(portfolioSchema),
        activePortfolioId: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const userId = ctx.user.id;
        // First upsert all current portfolios
        await Promise.all(
          input.portfolios.map(async (p) => {
            await upsertPortfolio({
              id: p.id,
              userId,
              name: p.name,
              totalCapital: p.totalCapital,
              allocationMode: p.allocationMode,
              cashPct: p.cashPct,
              projectionYears: p.projectionYears,
            });
            await replacePortfolioStocks(p.id, p.stocks);
          })
        );
        // Then delete any DB portfolios that are no longer in the client's list
        // This prevents deleted portfolios from reappearing on refresh
        await deletePortfoliosNotInList(userId, input.portfolios.map((p) => p.id));
        await upsertUserSettings({
          userId,
          activePortfolioId: input.activePortfolioId ?? undefined,
        });
        return { success: true };
      }),

    /**
     * Delete a portfolio from the DB.
     */
    deletePortfolio: protectedProcedure
      .input(z.object({ portfolioId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await deletePortfolio(input.portfolioId, ctx.user.id);
        return { success: true };
      }),

    /**
     * Push a single stock's projection overrides to the DB.
     * Called when the user edits projections in the drawer.
     */
    pushStockProjection: protectedProcedure
      .input(z.object({
        stockId: z.string(),
        projections: stockProjectionsSchema,
      }))
      .mutation(async ({ ctx, input }) => {
        await upsertStockProjection(ctx.user.id, input.stockId, input.projections);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
