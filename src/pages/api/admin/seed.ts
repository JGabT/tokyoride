import type { APIRoute } from "astro";
import { sql } from "drizzle-orm";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { seedDatabase } from "@/lib/seed";

export const prerender = false;

/**
 * Destructive: wipes and reseeds demo content. Requires an admin session and
 * an explicit confirm value so a stray POST cannot reset the site.
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  // Bootstrap: allow the very first seed when no admin account exists yet.
  const [admins] = await db
    .select({ n: sql<number>`count(*)` })
    .from(adminUsers);
  const hasAdmin = (admins?.n ?? 0) > 0;
  const user = await getSessionUser(cookies);
  if (hasAdmin && !user) return redirect("/admin/login");

  const form = await request.formData();
  if (String(form.get("confirm") ?? "") !== "RESET") {
    return redirect("/admin/settings?error=confirm");
  }

  const result = await seedDatabase();
  return redirect(
    `/admin/settings?seeded=${result.courses}&departures=${result.departures}`,
  );
};
