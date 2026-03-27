/**
 * IroFi Database Client — Drizzle ORM + PostgreSQL
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Disable prepared statements for Supabase connection pooling compatibility
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
export type DB = typeof db;