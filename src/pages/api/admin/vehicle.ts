import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { newId } from "@/lib/ids";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  const action = String(form.get("action") ?? "save");
  const id = String(form.get("id") ?? "");

  if (action === "delete" && id) {
    await db.update(vehicles).set({ active: 0 }).where(eq(vehicles.id, id));
    return redirect("/admin/fleet?archived=1");
  }

  const values = {
    name: String(form.get("name") ?? "").trim(),
    chassisCode: String(form.get("chassisCode") ?? "").trim().toUpperCase(),
    kind: String(form.get("kind") ?? "car"),
    seats: Number(form.get("seats") ?? 2),
    luggage: String(form.get("luggage") ?? ""),
    transmission: String(form.get("transmission") ?? "Manual"),
    engineCode: String(form.get("engineCode") ?? ""),
    drivetrain: String(form.get("drivetrain") ?? ""),
    photo: String(form.get("photo") ?? "") || null,
    blurb: String(form.get("blurb") ?? ""),
    specs: JSON.stringify(
      String(form.get("specs") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
    active: form.get("active") ? 1 : 0,
    sort: Number(form.get("sort") ?? 0),
  };

  if (!values.name) return redirect("/admin/fleet?error=name");

  if (id) {
    await db.update(vehicles).set(values).where(eq(vehicles.id, id));
  } else {
    await db.insert(vehicles).values({ id: newId("veh"), ...values, createdAt: Date.now() });
  }

  return redirect("/admin/fleet?saved=1");
};
