import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tourRates } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

export const prerender = false;

/**
 * Matrix save. Field names look like `rate_<tourId>_<vehicleId>`.
 * Blank means "not offered".
 */
export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  const now = Date.now();

  for (const [key, raw] of form.entries()) {
    if (!key.startsWith("rate_")) continue;
    const [, tourId, vehicleId] = key.split("__");
    if (!tourId || !vehicleId) continue;

    const value = String(raw).trim();
    const existing = await db
      .select()
      .from(tourRates)
      .where(and(eq(tourRates.tourId, tourId), eq(tourRates.vehicleId, vehicleId)))
      .limit(1);

    if (!value) {
      if (existing.length) {
        await db
          .update(tourRates)
          .set({ active: 0, updatedAt: now })
          .where(eq(tourRates.id, existing[0].id));
      }
      continue;
    }

    const price = Math.max(0, Math.round(Number(value.replace(/[^\d]/g, ""))));
    if (existing.length) {
      await db
        .update(tourRates)
        .set({ priceJpy: price, active: 1, updatedAt: now })
        .where(eq(tourRates.id, existing[0].id));
    } else {
      await db.insert(tourRates).values({
        id: crypto.randomUUID(),
        tourId,
        vehicleId,
        priceJpy: price,
        active: 1,
        updatedAt: now,
      });
    }
  }

  return redirect("/admin/rates?saved=1");
};
