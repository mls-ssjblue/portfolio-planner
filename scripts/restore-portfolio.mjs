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

// Portfolio IDs from DB
const CURRENT_PORTFOLIO_ID = 'YCOgcAYRi5SK_oRpQInyM';

// Stocks from screenshot - 21 positions in "Current Portfolio - latest"
// Capital was $500,891 at time of screenshot
const stocks = [
  { stockId: 'amd',   allocationPct: 42.3 },
  { stockId: 'nvda',  allocationPct: 11.9 },
  { stockId: 'mu',    allocationPct: 9.0  },
  { stockId: 'hims',  allocationPct: 7.3  },
  { stockId: 'googl', allocationPct: 5.3  },
  { stockId: 'elf',   allocationPct: 3.2  },
  { stockId: 'tln',   allocationPct: 3.2  },
  { stockId: 'leu',   allocationPct: 2.9  },
  { stockId: 'cls',   allocationPct: 2.4  },
  { stockId: 'amzn',  allocationPct: 2.1  },
  { stockId: 'hnst',  allocationPct: 1.7  },
  { stockId: 'ionq',  allocationPct: 1.7  },
  { stockId: 'nu',    allocationPct: 1.6  },
  { stockId: 'fubo',  allocationPct: 1.3  },
  { stockId: 'ceg',   allocationPct: 1.0  },
  { stockId: 'iren',  allocationPct: 1.0  },
  { stockId: 'pltr',  allocationPct: 0.8  },
  { stockId: 'sofi',  allocationPct: 0.7  },
  { stockId: 'msft',  allocationPct: 0.4  },
  { stockId: 'grrr',  allocationPct: 0.3  },
  { stockId: 'smci',  allocationPct: 0.1  },
];

// Total allocated = sum of all percentages
const totalAllocated = stocks.reduce((s, x) => s + x.allocationPct, 0);
const cashPct = Math.max(0, 100 - totalAllocated);

console.log(`Total allocated: ${totalAllocated.toFixed(1)}%, Cash: ${cashPct.toFixed(1)}%`);

// Clear existing stocks for this portfolio first
await conn.query('DELETE FROM portfolio_stocks WHERE portfolioId = ?', [CURRENT_PORTFOLIO_ID]);

// Update cashPct on the portfolio
await conn.query('UPDATE portfolios SET cashPct = ? WHERE id = ?', [cashPct, CURRENT_PORTFOLIO_ID]);

// Insert all stocks
for (let i = 0; i < stocks.length; i++) {
  const { stockId, allocationPct } = stocks[i];
  await conn.query(
    'INSERT INTO portfolio_stocks (portfolioId, stockId, allocationPct, sortOrder) VALUES (?, ?, ?, ?)',
    [CURRENT_PORTFOLIO_ID, stockId, allocationPct, i]
  );
  console.log(`  Inserted ${stockId} @ ${allocationPct}%`);
}

console.log(`\nRestored ${stocks.length} stocks to "Current Portfolio - latest"`);
console.log(`Cash set to ${cashPct.toFixed(2)}%`);

await conn.end();
