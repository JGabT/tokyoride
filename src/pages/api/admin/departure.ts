import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { departures, resourceBlocks, tours } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { jstToUtc } from "@/lib/dates";
import { newId } from "@/lib/ids";
import { fillDepartures } from "@/lib/schedule";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  const action = String(form.get("action") ?? "create");
  const id = String(form.get("id") ?? "");
  const back = String(form.get("back") ?? "") || "/admin/departures?saved=1";
  const goBack = () => redirect(back);

  if (action === "fill") {
    const created = await fillDepartures(90);
    const joiner = back.includes("?") ? "&" : "?";
    return redirect(`${back}${joiner}filled=${created}`);
  }

  if (action === "close" || action === "open") {
    await db
      .update(departures)
      .set({ status: action === "close" ? "closed" : "open" })
      .where(eq(departures.id, id));
    return goBack();
  }

  if (action === "delete") {
    await db.delete(departures).where(eq(departures.id, id));
    return goBack();
  }

  if (action === "block") {
    const vehicleId = String(form.get("vehicleId") ?? "");
    const date = String(form.get("date") ?? "");
    const time = String(form.get("time") ?? "09:00");
    const hours = Number(form.get("hours") ?? 8);
    if (!vehicleId || !date) return goBack();
    const startsAt = jstToUtc(date, time);
    await db.insert(resourceBlocks).values({
      id: newId("blk"),
      resourceType: "vehicle",
      resourceId: vehicleId,
      startsAt,
      endsAt: startsAt + hours * 3600_000,
      kind: "maintenance",
      bookingId: null,
      note: String(form.get("note") ?? "Maintenance"),
      createdAt: Date.now(),
    });
    return goBack();
  }

  const tourId = String(form.get("tourId") ?? "");
  const date = String(form.get("date") ?? "");
  const time = String(form.get("time") ?? "19:00");
  const capacity = Math.max(1, Number(form.get("capacity") ?? 4));

  if (!tourId || !date) return goBack();

  const tourRows = await db.select().from(tours).where(eq(tours.id, tourId)).limit(1);
  const tour = tourRows[0];
  if (!tour) return goBack();

  const startsAt = jstToUtc(date, time);

  try {
    await db.insert(departures).values({
      id: newId("dep"),
      tourId,
      startsAt,
      endsAt: startsAt + tour.durationHours * 3600_000,
      capacity,
      status: "open",
      note: "",
      createdAt: Date.now(),
    });
  } catch {
    return goBack();
  }

  return goBack();
};
