import { eq, and, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  portfolios,
  portfolioStocks,
  stockProjections,
  userSettings,
  type InsertPortfolio,
  type InsertUserSettings,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Portfolio helpers ─────────────────────────────────────────────────────────

export async function getPortfoliosByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolios).where(eq(portfolios.userId, userId));
}

export async function getAllPortfoliosWithStocks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const userPortfolios = await db.select().from(portfolios).where(eq(portfolios.userId, userId));
  if (userPortfolios.length === 0) return [];
  // Fetch all stocks for all portfolios in one query
  const allStocks = await db.select().from(portfolioStocks)
    .where(
      userPortfolios.length === 1
        ? eq(portfolioStocks.portfolioId, userPortfolios[0].id)
        : inArray(portfolioStocks.portfolioId, userPortfolios.map((p) => p.id))
    )
    .orderBy(portfolioStocks.sortOrder);
  return userPortfolios.map((p) => ({
    ...p,
    stocks: allStocks.filter((s) => s.portfolioId === p.id),
  }));
}

export async function getPortfolioWithStocks(portfolioId: string, userId: number) {
  const db = await getDb();
  if (!db) return null;
  const [portfolio] = await db.select().from(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)))
    .limit(1);
  if (!portfolio) return null;
  const stocks = await db.select().from(portfolioStocks)
    .where(eq(portfolioStocks.portfolioId, portfolioId))
    .orderBy(portfolioStocks.sortOrder);
  return { ...portfolio, stocks };
}

export async function upsertPortfolio(data: InsertPortfolio) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(portfolios).values(data).onDuplicateKeyUpdate({
    set: {
      name: data.name,
      totalCapital: data.totalCapital,
      allocationMode: data.allocationMode,
      cashPct: data.cashPct,
      projectionYears: data.projectionYears,
      updatedAt: new Date(),
    },
  });
}

export async function deletePortfolio(portfolioId: string, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portfolios)
    .where(and(eq(portfolios.id, portfolioId), eq(portfolios.userId, userId)));
}

/**
 * Delete all portfolios for a user that are NOT in the provided keepIds list.
 * Used by pushPortfolios to ensure the DB matches the client's current state exactly.
 */
export async function deletePortfoliosNotInList(userId: number, keepIds: string[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ id: portfolios.id })
    .from(portfolios)
    .where(eq(portfolios.userId, userId));
  const toDelete = existing.map((p) => p.id).filter((id) => !keepIds.includes(id));
  if (toDelete.length > 0) {
    await db.delete(portfolios)
      .where(and(eq(portfolios.userId, userId), inArray(portfolios.id, toDelete)));
  }
}

export async function replacePortfolioStocks(
  portfolioId: string,
  stocks: { stockId: string; allocationPct: number; sortOrder: number }[]
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(portfolioStocks).where(eq(portfolioStocks.portfolioId, portfolioId));
  if (stocks.length > 0) {
    await db.insert(portfolioStocks).values(
      stocks.map((s) => ({
        portfolioId,
        stockId: s.stockId,
        allocationPct: s.allocationPct,
        sortOrder: s.sortOrder,
      }))
    );
  }
}

// ── Stock projection helpers ──────────────────────────────────────────────────

export async function getStockProjectionsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stockProjections).where(eq(stockProjections.userId, userId));
}

export async function upsertStockProjection(userId: number, stockId: string, projectionsJson: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select({ id: stockProjections.id })
    .from(stockProjections)
    .where(and(eq(stockProjections.userId, userId), eq(stockProjections.stockId, stockId)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(stockProjections)
      .set({ projectionsJson, updatedAt: new Date() })
      .where(and(eq(stockProjections.userId, userId), eq(stockProjections.stockId, stockId)));
  } else {
    await db.insert(stockProjections).values({ userId, stockId, projectionsJson });
  }
}

// ── User settings helpers ─────────────────────────────────────────────────────

export async function getUserSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function upsertUserSettings(data: InsertUserSettings) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(userSettings).values(data).onDuplicateKeyUpdate({
    set: { activePortfolioId: data.activePortfolioId, updatedAt: new Date() },
  });
}
