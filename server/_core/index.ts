import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerChatRoutes } from "./chat";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ── In-memory price cache (server-side proxy to avoid CORS) ─────────────────
const serverPriceCache = new Map<string, { price: number; change: number; changePct: number; fetchedAt: number }>();
const SERVER_CACHE_TTL = 60_000;

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Stock price proxy — fetches from Yahoo Finance server-side (no CORS issues)
  app.get("/api/prices", async (req, res) => {
    const tickersParam = req.query.tickers as string;
    if (!tickersParam) return res.json({});
    const tickers = tickersParam.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean).slice(0, 30);
    const result: Record<string, { price: number; change: number; changePct: number }> = {};
    const toFetch = tickers.filter((t) => {
      const cached = serverPriceCache.get(t);
      if (cached && Date.now() - cached.fetchedAt < SERVER_CACHE_TTL) {
        result[t] = { price: cached.price, change: cached.change, changePct: cached.changePct };
        return false;
      }
      return true;
    });
    // Fetch prices from stooq.com (no auth required, works from Railway)
    // Use historical endpoint to get last 2 trading days so we can compute day % change
    const today = new Date();
    const d2 = today.toISOString().slice(0, 10).replace(/-/g, '');
    const past = new Date(today); past.setDate(past.getDate() - 7);
    const d1 = past.toISOString().slice(0, 10).replace(/-/g, '');

    await Promise.all(toFetch.map(async (ticker) => {
      try {
        // stooq uses lowercase ticker with .us suffix for US stocks
        const sym = ticker.toLowerCase() + '.us';
        const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(sym)}&d1=${d1}&d2=${d2}&i=d`;
        const r = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/csv,*/*" }
        });
        if (!r.ok) {
          console.error(`[prices] ${ticker}: HTTP ${r.status}`);
          return;
        }
        const csv = await r.text();
        const lines = csv.trim().split('\n').filter(l => l && !l.startsWith('Date'));
        if (lines.length === 0) {
          console.error(`[prices] ${ticker}: no data rows`);
          return;
        }
        // Lines are in ascending date order; last line = most recent
        const parseLine = (l: string) => { const p = l.split(','); return parseFloat(p[4]); }; // Close is col 4
        const price = parseLine(lines[lines.length - 1]);
        const prevClose = lines.length >= 2 ? parseLine(lines[lines.length - 2]) : price;
        if (!price || isNaN(price)) {
          console.error(`[prices] ${ticker}: invalid price`, lines[lines.length - 1]);
          return;
        }
        const change = price - prevClose;
        const changePct = prevClose > 0 ? (change / prevClose) * 100 : 0;
        const entry = { price, change, changePct, fetchedAt: Date.now() };
        serverPriceCache.set(ticker, entry);
        result[ticker] = { price, change, changePct };
      } catch (err) {
        console.error(`[prices] ${ticker}: fetch error`, err);
      }
    }));
    res.json(result);
  });

  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // Chat API with streaming and tool calling
  registerChatRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
