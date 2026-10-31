import type { APIRoute } from "astro";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    await db.run(sql`select 1`);
    return new Response(
      JSON.stringify({ ok: true, db: "up", time: new Date().toISOString() }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch {
    return new Response(JSON.stringify({ ok: false, db: "down" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
};
