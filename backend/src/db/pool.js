import pg from 'pg';
import { config } from '../config.js';

pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, Number);

const connectionString = (() => {
  const url = new URL(config.databaseUrl);
  url.searchParams.delete('sslmode');
  return url.toString();
})();

// Both the iife and this achieve the same result
// const url = new URL(config.databaseUrl);
// url.searchParams.delete('sslmode');
// const connectionString = url.toString();

export const pool = new pg.Pool({
  connectionString,
  ssl: { rejectUnauthorized: true },
  max: 10,
});

export const query = (text, params) => pool.query(text, params);

export const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
