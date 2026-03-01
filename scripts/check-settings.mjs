import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

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

// Check user_settings
const [settings] = await conn.query('SELECT * FROM user_settings');
console.log('=== User Settings ===');
for (const s of settings) {
  console.log(`  userId=${s.userId} | activePortfolioId=${s.activePortfolioId}`);
}

// Update active portfolio to Current Portfolio - latest
await conn.query(
  "UPDATE user_settings SET activePortfolioId = 'YCOgcAYRi5SK_oRpQInyM' WHERE userId = 1"
);
console.log('\nUpdated activePortfolioId to YCOgcAYRi5SK_oRpQInyM (Current Portfolio - latest)');

// Verify
const [updated] = await conn.query('SELECT * FROM user_settings');
console.log('\n=== Updated User Settings ===');
for (const s of updated) {
  console.log(`  userId=${s.userId} | activePortfolioId=${s.activePortfolioId}`);
}

await conn.end();
