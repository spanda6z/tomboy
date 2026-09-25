import pg from "pg";
import { config } from "./config.js";
const { Pool } = pg;

export const pool = config.databaseUrl ? new Pool({ connectionString: config.databaseUrl, max: 5 }) : null;

export async function initDb() {
  if (!pool) {
    console.warn("DATABASE_URL not configured; running without persistent database logging.");
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS events (id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS executions (id BIGSERIAL PRIMARY KEY, side TEXT NOT NULL, sol_amount NUMERIC NOT NULL, signature TEXT, status TEXT NOT NULL, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS jobs (id BIGSERIAL PRIMARY KEY, chat_id BIGINT NOT NULL, package_id TEXT NOT NULL, budget_sol NUMERIC NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', deposit_signature TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
  `);
}
export async function logEvent(kind: string, payload: unknown) {
  if (!pool) return;
  await pool.query("INSERT INTO events(kind,payload) VALUES($1,$2)", [kind, JSON.stringify(payload)]);
}
export async function logExecution(side: string, solAmount: number, status: string, signature?: string, error?: string) {
  if (!pool) return;
  await pool.query("INSERT INTO executions(side,sol_amount,status,signature,error) VALUES($1,$2,$3,$4,$5)", [side, solAmount, status, signature ?? null, error ?? null]);
}
export async function createJob(input: { chatId: number; packageId: string; budgetSol: number }) {
  if (!pool) return { id: "local", ...input, status: "PENDING" };
  const r = await pool.query("INSERT INTO jobs(chat_id,package_id,budget_sol) VALUES($1,$2,$3) RETURNING id,chat_id,package_id,budget_sol,status,deposit_signature,created_at", [input.chatId, input.packageId, input.budgetSol]);
  return r.rows[0];
}
export async function getJob(id: number) {
  if (!pool) return null;
  const r = await pool.query("SELECT * FROM jobs WHERE id=$1", [id]);
  return r.rows[0] ?? null;
}
export async function listJobs(chatId: number) {
  if (!pool) return [];
  const r = await pool.query("SELECT * FROM jobs WHERE chat_id=$1 ORDER BY id DESC LIMIT 20", [chatId]);
  return r.rows;
}
