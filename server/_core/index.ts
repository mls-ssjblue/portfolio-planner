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
    await Promise.all(toFetch.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=2d`;
        const r = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://finance.yahoo.com/",
          }
        });
        if (!r.ok) {
          console.error(`[prices] ${ticker}: HTTP ${r.status}`);
          return;
        }
        const json = await r.json() as any;
        const meta = json?.chart?.result?.[0]?.meta;
        if (!meta) {
          console.error(`[prices] ${ticker}: no meta in response`);
          return;
        }
        const price = meta.regularMarketPrice ?? 0;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
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
