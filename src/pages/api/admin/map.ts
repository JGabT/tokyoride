import type { APIRoute } from "astro";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { mapFeatures } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { newId } from "@/lib/ids";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  if (!(await getSessionUser(cookies))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }

  let body: {
    ownerType?: string;
    ownerId?: string;
    features?: { kind: string; label: string; lat: number; lng: number }[];
  };

  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const ownerType = body.ownerType === "site" ? "site" : "tour";
  const ownerId = ownerType === "site" ? "" : String(body.ownerId ?? "");
  const features = Array.isArray(body.features) ? body.features : [];

  await db
    .delete(mapFeatures)
    .where(
      and(
        eq(mapFeatures.ownerType, ownerType),
        eq(mapFeatures.ownerId, ownerId),
      ),
    );

  let sort = 0;
  for (const feature of features) {
    const lat = Number(feature.lat);
    const lng = Number(feature.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < 20 || lat > 46 || lng < 122 || lng > 154) continue; // Japan bbox
    await db.insert(mapFeatures).values({
      id: newId("map"),
      ownerType,
      ownerId,
      kind: ["start", "end", "waypoint", "poi"].includes(feature.kind)
        ? feature.kind
        : "waypoint",
      label: String(feature.label ?? "").slice(0, 80),
      lat: String(lat.toFixed(6)),
      lng: String(lng.toFixed(6)),
      sort: sort++,
    });
  }

  return new Response(JSON.stringify({ ok: true, count: sort }), {
    headers: { "Content-Type": "application/json" },
  });
};
