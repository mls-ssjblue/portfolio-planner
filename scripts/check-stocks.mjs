import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

// Load env from .env file if present, otherwise use process.env
const __dir = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = join(__dir, '..', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch {}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1); }

const conn = await createConnection(dbUrl);

const [portfolios] = await conn.query('SELECT id, name, totalCapital, cashPct FROM portfolios ORDER BY createdAt');
console.log('=== Portfolios ===');
for (const p of portfolios) {
  console.log(`  ${p.id} | "${p.name}" | capital=${p.totalCapital} | cash=${p.cashPct}%`);
}

const [stocks] = await conn.query('SELECT portfolioId, stockId, allocationPct, sortOrder FROM portfolio_stocks ORDER BY portfolioId, sortOrder');
console.log(`\n=== Portfolio Stocks (total: ${stocks.length}) ===`);
for (const s of stocks) {
  console.log(`  portfolio=${s.portfolioId} | stock=${s.stockId} | alloc=${s.allocationPct}% | order=${s.sortOrder}`);
}

await conn.end();
