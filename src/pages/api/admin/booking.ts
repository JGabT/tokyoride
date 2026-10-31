import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { bookings } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { cancelBooking, markExpired, markPaid } from "@/lib/receipts";
import { releaseBooking } from "@/lib/availability";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const action = String(form.get("action") ?? "");
  const back = String(form.get("back") ?? `/admin/bookings/${id}`);

  if (!id) return redirect("/admin/bookings");

  if (action === "confirm") {
    await markPaid(id, `MANUAL-${Date.now().toString(36).toUpperCase()}`, "manual");
  } else if (action === "cancel") {
    await cancelBooking(id, String(form.get("reason") ?? "Cancelled by staff"));
  } else if (action === "expire") {
    await markExpired(id);
  } else if (action === "refund") {
    await db
      .update(bookings)
      .set({ status: "refunded", updatedAt: Date.now() })
      .where(eq(bookings.id, id));
    await releaseBooking(id);
  }

  return redirect(back);
};
