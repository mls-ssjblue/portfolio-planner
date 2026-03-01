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

// Check current stock IDs
const [stocks] = await conn.query('SELECT id, portfolioId, stockId FROM portfolio_stocks ORDER BY sortOrder');
console.log('Current stock IDs:', stocks.map(s => s.stockId).join(', '));

// Update all stockId values to uppercase
for (const stock of stocks) {
  const upper = stock.stockId.toUpperCase();
  if (upper !== stock.stockId) {
    await conn.query('UPDATE portfolio_stocks SET stockId = ? WHERE id = ?', [upper, stock.id]);
    console.log(`Updated: ${stock.stockId} -> ${upper}`);
  } else {
    console.log(`Already uppercase: ${stock.stockId}`);
  }
}

// Verify
const [updated] = await conn.query('SELECT stockId, allocationPct FROM portfolio_stocks ORDER BY sortOrder');
console.log('\nUpdated stock IDs:', updated.map(s => `${s.stockId}(${s.allocationPct}%)`).join(', '));

await conn.end();
console.log('\nDone!');
