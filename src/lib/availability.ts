import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "./db";
import {
  bookings,
  departures,
  resourceBlocks,
  type Departure,
} from "./db/schema";
import { getFleetForTour } from "./catalog";

export type DepartureAvailability = {
  id: string;
  tourId: string;
  startsAt: number;
  endsAt: number;
  capacity: number;
  vehiclesLeft: string[];
  seatsLeft: number;
  available: boolean;
};

const TURNAROUND_MIN = 60 * 60 * 1000;

export function blockRange(startsAt: number, endsAt: number) {
  return { startsAt, endsAt: endsAt + TURNAROUND_MIN };
}

/**
 * Departures in [from, to] with the vehicles still free. A vehicle is free
 * when it has no overlapping resource block.
 */
export async function getAvailability(
  tourId: string,
  from: number,
  to: number,
): Promise<DepartureAvailability[]> {
  const [fleet, deps] = await Promise.all([
    getFleetForTour(tourId),
    db
      .select()
      .from(departures)
      .where(
        and(
          eq(departures.tourId, tourId),
          eq(departures.status, "open"),
          gte(departures.startsAt, from),
          lte(departures.startsAt, to),
        ),
      )
      .orderBy(asc(departures.startsAt)),
  ]);

  if (!deps.length) return [];

  const vehicleIds = fleet.map((v) => v.id);
  const blocks = vehicleIds.length
    ? await db
        .select()
        .from(resourceBlocks)
        .where(
          and(
            eq(resourceBlocks.resourceType, "vehicle"),
            gte(resourceBlocks.endsAt, from),
            lte(resourceBlocks.startsAt, to),
          ),
        )
    : [];

  return deps.map((dep) => {
    const blocked = new Set(
      blocks
        .filter(
          (b) =>
            vehicleIds.includes(b.resourceId) &&
            b.startsAt < dep.endsAt + TURNAROUND_MIN &&
            b.endsAt > dep.startsAt,
        )
        .map((b) => b.resourceId),
    );

    const vehiclesLeft = fleet.filter((v) => !blocked.has(v.id));
    return {
      id: dep.id,
      tourId: dep.tourId,
      startsAt: dep.startsAt,
      endsAt: dep.endsAt,
      capacity: dep.capacity,
      vehiclesLeft: vehiclesLeft.map((v) => v.id),
      seatsLeft: vehiclesLeft.reduce((sum, v) => sum + v.seats, 0),
      available: vehiclesLeft.length > 0 && vehiclesLeft.length <= dep.capacity,
    };
  });
}

export type ClaimResult =
  | { ok: true; vehicleIds: string[] }
  | { ok: false; reason: string };

/**
 * Read-only availability check for a set of vehicles on one departure.
 * D1 has no interactive transactions, so the actual claim inserts the blocks
 * and then verifies no rival beat us to it (see insertBlocks / verifyClaim).
 */
export async function checkClaim(
  departure: Departure,
  vehicleIds: string[],
  fleet: { id: string }[],
): Promise<ClaimResult> {
  const unique = [...new Set(vehicleIds)];
  if (!unique.length) return { ok: false, reason: "Select at least one car." };
  if (unique.length > departure.capacity) {
    return {
      ok: false,
      reason: "Not enough cars available for this departure.",
    };
  }
  const known = new Set(fleet.map((v) => v.id));
  if (unique.some((id) => !known.has(id))) {
    return {
      ok: false,
      reason: "One of the selected cars is not offered on this course.",
    };
  }

  const existing = await db
    .select()
    .from(resourceBlocks)
    .where(
      and(
        eq(resourceBlocks.resourceType, "vehicle"),
        gte(resourceBlocks.endsAt, departure.startsAt),
        lte(resourceBlocks.startsAt, departure.endsAt + TURNAROUND_MIN),
      ),
    );

  const conflict = existing.some(
    (b) =>
      unique.includes(b.resourceId) &&
      b.startsAt < departure.endsAt + TURNAROUND_MIN &&
      b.endsAt > departure.startsAt,
  );

  if (conflict) {
    return {
      ok: false,
      reason: "Sorry — one of those cars was just taken. Pick another.",
    };
  }

  return { ok: true, vehicleIds: unique };
}

/** Insert the booking's resource blocks (the claim itself). */
export async function insertBlocks(
  departure: Departure,
  vehicleIds: string[],
  bookingId: string,
): Promise<void> {
  const now = Date.now();
  for (const vehicleId of vehicleIds) {
    await db.insert(resourceBlocks).values({
      id: crypto.randomUUID(),
      resourceType: "vehicle",
      resourceId: vehicleId,
      startsAt: departure.startsAt,
      endsAt: departure.endsAt,
      kind: "booking",
      bookingId,
      note: "",
      createdAt: now,
    });
  }
}

/**
 * Post-insert verification: if a rival booking claimed one of our cars first,
 * the newcomer backs out. Winner = earlier createdAt (then lower id).
 */
export async function verifyClaim(
  departure: Departure,
  vehicleIds: string[],
  bookingId: string,
  createdAt: number,
): Promise<boolean> {
  const rivals = await db
    .select()
    .from(resourceBlocks)
    .where(
      and(
        eq(resourceBlocks.resourceType, "vehicle"),
        gte(resourceBlocks.endsAt, departure.startsAt),
        lte(resourceBlocks.startsAt, departure.endsAt + TURNAROUND_MIN),
      ),
    );

  for (const rival of rivals) {
    if (rival.bookingId === bookingId) continue;
    if (!vehicleIds.includes(rival.resourceId)) continue;
    if (rival.startsAt >= departure.endsAt + TURNAROUND_MIN) continue;
    if (rival.endsAt <= departure.startsAt) continue;

    const rivalOlder =
      rival.createdAt < createdAt ||
      (rival.createdAt === createdAt &&
        String(rival.bookingId ?? "").localeCompare(bookingId) < 0);
    if (rivalOlder) return false;
  }

  return true;
}

/** Release vehicle blocks when a booking is cancelled or expires. */
export async function releaseBooking(bookingId: string) {
  await db.delete(resourceBlocks).where(eq(resourceBlocks.bookingId, bookingId));
}

/** Expire unpaid holds so the cars go back on sale. */
export async function expireStaleHolds(): Promise<number> {
  const now = Date.now();
  const stale = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.status, "pending"), lte(bookings.holdExpiresAt, now)));

  for (const booking of stale) {
    await db
      .update(bookings)
      .set({ status: "expired", updatedAt: now })
      .where(eq(bookings.id, booking.id));
    await db
      .delete(resourceBlocks)
      .where(eq(resourceBlocks.bookingId, booking.id));
  }
  return stale.length;
}
