import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import {
  bookings,
  departures,
  mapFeatures,
  tourRates,
  tours,
  vehicles,
  type Tour,
  type Vehicle,
} from "./db/schema";

export type VehicleWithRate = Vehicle & { priceJpy: number; rateId: string };

export async function getActiveTours(): Promise<Tour[]> {
  return db
    .select()
    .from(tours)
    .where(eq(tours.status, "active"))
    .orderBy(asc(tours.sort), asc(tours.title));
}

export async function getAllTours(): Promise<Tour[]> {
  return db.select().from(tours).orderBy(asc(tours.sort), asc(tours.title));
}

export async function getTour(slug: string): Promise<Tour | null> {
  const rows = await db.select().from(tours).where(eq(tours.id, slug)).limit(1);
  return rows[0] ?? null;
}

export async function getVehicles(activeOnly = true): Promise<Vehicle[]> {
  const query = db.select().from(vehicles);
  const rows = activeOnly
    ? await query.where(eq(vehicles.active, 1)).orderBy(asc(vehicles.sort))
    : await query.orderBy(asc(vehicles.sort));
  return rows;
}

export async function getFleetForTour(tourId: string): Promise<VehicleWithRate[]> {
  const rows = await db
    .select({ vehicle: vehicles, rate: tourRates })
    .from(tourRates)
    .innerJoin(vehicles, eq(vehicles.id, tourRates.vehicleId))
    .where(
      and(
        eq(tourRates.tourId, tourId),
        eq(tourRates.active, 1),
        eq(vehicles.active, 1),
      ),
    )
    .orderBy(asc(vehicles.sort));

  return rows.map(({ vehicle, rate }) => ({
    ...vehicle,
    priceJpy: rate.priceJpy,
    rateId: rate.id,
  }));
}

export async function getFromPrice(tourId: string): Promise<number | null> {
  const fleet = await getFleetForTour(tourId);
  if (!fleet.length) return null;
  return Math.min(...fleet.map((v) => v.priceJpy));
}

export async function getTourMap(ownerId: string) {
  return db
    .select()
    .from(mapFeatures)
    .where(and(eq(mapFeatures.ownerType, "tour"), eq(mapFeatures.ownerId, ownerId)))
    .orderBy(asc(mapFeatures.sort));
}

export async function getSiteMap() {
  return db
    .select()
    .from(mapFeatures)
    .where(eq(mapFeatures.ownerType, "site"))
    .orderBy(asc(mapFeatures.sort));
}

export async function getRateMatrix(): Promise<
  { tourId: string; vehicleId: string; priceJpy: number; active: number; id: string }[]
> {
  return db.select().from(tourRates);
}

export async function getBookingsForDeparture(departureId: string) {
  return db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.departureId, departureId),
        inArray(bookings.status, ["pending", "paid", "confirmed"]),
      ),
    );
}

export async function getDeparture(id: string) {
  const rows = await db
    .select()
    .from(departures)
    .where(eq(departures.id, id))
    .limit(1);
  return rows[0] ?? null;
}
