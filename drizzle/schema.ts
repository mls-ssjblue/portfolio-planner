import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, double, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Portfolios — one user can have multiple portfolios.
 */
export const portfolios = mysqlTable("portfolios", {
  id: varchar("id", { length: 32 }).primaryKey(), // nanoid from client
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  totalCapital: double("totalCapital").notNull().default(100000),
  allocationMode: mysqlEnum("allocationMode", ["percentage", "dollar"]).notNull().default("percentage"),
  cashPct: double("cashPct").notNull().default(100),
  projectionYears: int("projectionYears").notNull().default(5),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

/**
 * Portfolio stocks — positions within a portfolio.
 * stockId references the stock id in the frontend sampleData.
 */
export const portfolioStocks = mysqlTable("portfolio_stocks", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: varchar("portfolioId", { length: 32 }).notNull().references(() => portfolios.id, { onDelete: "cascade" }),
  stockId: varchar("stockId", { length: 64 }).notNull(),
  allocationPct: double("allocationPct").notNull().default(0),
  sortOrder: int("sortOrder").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PortfolioStock = typeof portfolioStocks.$inferSelect;
export type InsertPortfolioStock = typeof portfolioStocks.$inferInsert;

/**
 * Stock projection overrides — user-customized projections per stock.
 * Stored as JSON blob since the structure is complex.
 */
export const stockProjections = mysqlTable("stock_projections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  stockId: varchar("stockId", { length: 64 }).notNull(),
  projectionsJson: json("projectionsJson").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockProjection = typeof stockProjections.$inferSelect;
export type InsertStockProjection = typeof stockProjections.$inferInsert;

/**
 * User settings — stores active portfolio id and other preferences.
 */
export const userSettings = mysqlTable("user_settings", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  activePortfolioId: varchar("activePortfolioId", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;