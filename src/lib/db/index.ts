import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";
import { d1 } from "../runtime";

export type AppDb = DrizzleD1Database<typeof schema>;

let cached: { instance: AppDb; binding: unknown } | null = null;

/**
 * Drizzle over the D1 binding. Bindings are stable per isolate, so the
 * instance is created once and reused.
 */
function current(): AppDb {
  const binding = d1();
  if (!cached || cached.binding !== binding) {
    cached = { instance: drizzle(binding, { schema }), binding };
  }
  return cached.instance;
}

// The app imports `db` as a plain object everywhere; forward every property
// lookup to the live D1-backed instance.
export const db: AppDb = new Proxy({} as AppDb, {
  get(_target, prop) {
    return (current() as any)[prop];
  },
});

export { schema };
