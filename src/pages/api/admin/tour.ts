import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { tours } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { newId } from "@/lib/ids";

export const prerender = false;

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  const action = String(form.get("action") ?? "save");
  const id = String(form.get("id") ?? "");

  if (action === "delete" && id) {
    await db.delete(tours).where(eq(tours.id, id));
    return redirect("/admin/tours?deleted=1");
  }

  const title = String(form.get("title") ?? "").trim();
  if (!title) return redirect("/admin/tours?error=title");

  const values = {
    title,
    subtitle: String(form.get("subtitle") ?? ""),
    body: String(form.get("body") ?? ""),
    durationHours: Number(form.get("durationHours") ?? 4),
    meetingLabel: String(form.get("meetingLabel") ?? ""),
    heroImage: String(form.get("heroImage") ?? "") || null,
    status: String(form.get("status") ?? "active"),
    featured: form.get("featured") ? 1 : 0,
    sort: Number(form.get("sort") ?? 0),
    driverMode: String(form.get("driverMode") ?? "self") === "staff" ? "staff" : "self",
    pickupDropoff: form.get("pickupDropoff") ? 1 : 0,
    updatedAt: Date.now(),
  };

  if (id) {
    await db.update(tours).set(values).where(eq(tours.id, id));
  } else {
    const base = slugify(title) || newId("tour");
    const existing = await db.select().from(tours).where(eq(tours.id, base));
    const finalId = existing.length ? `${base}-${Date.now().toString(36)}` : base;
    await db.insert(tours).values({ id: finalId, ...values, createdAt: Date.now() });
  }

  return redirect("/admin/tours?saved=1");
};
