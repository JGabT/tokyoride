import { eq, sql } from "drizzle-orm";
import { db } from "./db";
import { departures, tours } from "./db/schema";
import { jstDateKey, jstTime, jstToUtc, addDays } from "./dates";
import { newId } from "./ids";

const LEAD_HOURS = 12;
const MAX_TIMES_PER_TOUR = 4;

/**
 * Ensures every active course has departures on every day for the next
 * `daysAhead` days, at that course's usual time(s). Existing departures are
 * left alone — the unique index on course + start time makes this safe to
 * re-run.
 */
export async function fillDepartures(daysAhead = 90): Promise<number> {
  const now = Date.now();
  const today = jstDateKey(now);
  const activeTours = await db
    .select()
    .from(tours)
    .where(eq(tours.status, "active"));

  const [before] = await db
    .select({ n: sql<number>`count(*)` })
    .from(departures);

  for (const tour of activeTours) {
    const existing = await db
      .select({ startsAt: departures.startsAt, capacity: departures.capacity })
      .from(departures)
      .where(eq(departures.tourId, tour.id));

    const times = [...new Set(existing.map((row) => jstTime(row.startsAt)))]
      .sort()
      .slice(0, MAX_TIMES_PER_TOUR);
    const capacity = existing[0]?.capacity ?? 4;

    const schedule = times.length ? times : ["10:00"];

    for (let day = 0; day < daysAhead; day++) {
      const dateKey = addDays(today, day);

      for (const time of schedule) {
        const startsAt = jstToUtc(dateKey, time);
        if (startsAt < now + LEAD_HOURS * 3600_000) continue;

        await db
          .insert(departures)
          .values({
            id: newId("dep"),
            tourId: tour.id,
            startsAt,
            endsAt: startsAt + tour.durationHours * 3600_000,
            capacity,
            status: "open",
            note: "",
            createdAt: now,
          })
          .onConflictDoNothing();
      }
    }
  }

  const [after] = await db
    .select({ n: sql<number>`count(*)` })
    .from(departures);

  return (after?.n ?? 0) - (before?.n ?? 0);
}
