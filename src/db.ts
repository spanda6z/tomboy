import pg from "pg";
import { config } from "./config.js";
const { Pool } = pg;

export const pool = config.databaseUrl
  ? new Pool({
      connectionString: config.databaseUrl,
      max: 5,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
    })
  : null;

export async function initDb() {
  if (!pool) {
    console.warn("DATABASE_URL not configured; running without persistent database logging.");
    return;
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS events (id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  CREATE TABLE IF NOT EXISTS executions (id BIGSERIAL PRIMARY KEY, side TEXT NOT NULL, sol_amount NUMERIC NOT NULL, signature TEXT, status TEXT NOT NULL, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());`);
}

export async function logEvent(kind: string, payload: unknown) {
  if (!pool) return;
  await pool.query("INSERT INTO events(kind,payload) VALUES($1,$2)", [kind, JSON.stringify(payload)]);
}

export async function logExecution(side: string, solAmount: number, status: string, signature?: string, error?: string) {
  if (!pool) return;
  await pool.query(
    "INSERT INTO executions(side,sol_amount,status,signature,error) VALUES($1,$2,$3,$4,$5)",
    [side, solAmount, status, signature ?? null, error ?? null],
  );
}