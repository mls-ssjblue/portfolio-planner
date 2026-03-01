import { createConnection } from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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

// This is what the server does: select without ORDER BY
const [portfolios] = await conn.query('SELECT id, name, createdAt FROM portfolios WHERE userId = 1');
console.log('=== Portfolios (no ORDER BY, as server returns) ===');
portfolios.forEach((p, i) => {
  console.log(`  [${i}] ${p.id} | "${p.name}" | created=${p.createdAt}`);
});

// Now check stocks
const [stocks] = await conn.query('SELECT portfolioId, COUNT(*) as cnt FROM portfolio_stocks GROUP BY portfolioId');
console.log('\n=== Stocks per portfolio ===');
for (const s of stocks) {
  const p = portfolios.find(p => p.id === s.portfolioId);
  console.log(`  ${s.portfolioId} (${p?.name}) | stocks=${s.cnt}`);
}

await conn.end();
