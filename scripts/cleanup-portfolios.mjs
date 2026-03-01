// Script to list and clean up portfolios in the DB
import { createConnection } from 'mysql2/promise';

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL env var not set');
  process.exit(1);
}

const conn = await createConnection(dbUrl);

// List all portfolios
const [rows] = await conn.query('SELECT id, name, userId, createdAt FROM portfolios ORDER BY userId, createdAt');
console.log('\n=== All portfolios in DB ===');
rows.forEach((r, i) => console.log(`[${i}] id=${r.id} | name="${r.name}" | userId=${r.userId} | created=${r.createdAt}`));

await conn.end();
