import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export * from "./schema";

/**
 * Returns true if the Neon database connection string is configured in the environment.
 */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

/**
 * Lazy singleton Drizzle ORM client connected to Neon PostgreSQL over HTTP.
 */
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (!isDatabaseConfigured()) {
    return null;
  }
  if (!dbInstance) {
    const sql = neon(process.env.DATABASE_URL!);
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    const instance = getDb();
    if (!instance) {
      throw new Error(
        "Neon Database is not configured. Please set the DATABASE_URL environment variable in your .env.local file."
      );
    }
    return (instance as unknown as Record<string, unknown>)[prop as string];
  },
});
