import { and, eq } from "drizzle-orm";
import { db } from "./db";
import {
  bookingVehicles,
  bookings,
  customers,
  departures,
  type Departure,
} from "./db/schema";
import { getFleetForTour, getTour } from "./catalog";
import {
  checkClaim,
  expireStaleHolds,
  insertBlocks,
  releaseBooking,
  verifyClaim,
} from "./availability";
import { accessToken, bookingRef, newId } from "./ids";
import { env } from "./runtime";

const HOLD_MINUTES = 30;

export type DriverInput = {
  name: string;
  country: string;
  license: string;
  idp: string;
  dob: string;
};

export type CreateBookingInput = {
  tourId: string;
  departureId: string;
  vehicleIds: string[];
  customer: { name: string; email: string; phone: string; country: string };
  drivers: Record<string, DriverInput>;
  notes?: string;
  pickup?: string;
  dropoff?: string;
};

export type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      ref: string;
      accessToken: string;
      totalJpy: number;
    }
  | { ok: false; reason: string; field?: string };

export async function createBooking(
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  await expireStaleHolds();

  const tour = await getTour(input.tourId);
  if (!tour || tour.status !== "active") {
    return { ok: false, reason: "Course not available." };
  }

  const depRows = await db
    .select()
    .from(departures)
    .where(
      and(
        eq(departures.id, input.departureId),
        eq(departures.tourId, input.tourId),
      ),
    )
    .limit(1);
  const departure = depRows[0] as Departure | undefined;

  if (!departure) return { ok: false, reason: "Departure not found." };
  if (departure.status !== "open") {
    return { ok: false, reason: "This departure is closed." };
  }

  const leadHours = Number(env("BOOKING_LEAD_HOURS", "6")) || 6;
  if (departure.startsAt < Date.now() + leadHours * 3600_000) {
    return {
      ok: false,
      reason: `Bookings close ${leadHours}h before pickup. Contact us for a last-minute car.`,
    };
  }

  const fleet = await getFleetForTour(input.tourId);
  const rateByVehicle = new Map(fleet.map((v) => [v.id, v]));

  const selected = [...new Set(input.vehicleIds)];
  if (!selected.length) return { ok: false, reason: "Select at least one car." };
  if (selected.some((id) => !rateByVehicle.has(id))) {
    return { ok: false, reason: "A selected car is not available on this course." };
  }

  // Driver details: license info is only needed when the guest drives.
  const selfDrive = tour.driverMode === "self";
  for (const vehicleId of selected) {
    const driver = input.drivers?.[vehicleId];
    if (!driver?.name || (selfDrive && !driver.country)) {
      return {
        ok: false,
        reason: selfDrive
          ? "Each car needs a named driver."
          : "Each car needs a lead passenger.",
      };
    }
    if (selfDrive && !driver.license) {
      return {
        ok: false,
        reason: "Each driver needs a licence number for self-drive courses.",
      };
    }
  }

  if (tour.pickupDropoff) {
    if (!input.pickup?.trim() || !input.dropoff?.trim()) {
      return {
        ok: false,
        reason: "Add a pickup and drop-off point for this course.",
        field: "pickup",
      };
    }
  }

  const totalJpy = selected.reduce(
    (sum, id) => sum + (rateByVehicle.get(id)?.priceJpy ?? 0),
    0,
  );

  if (!input.customer.email?.includes("@")) {
    return { ok: false, reason: "A valid email is required.", field: "email" };
  }

  const bookingId = newId("bkg");
  const ref = bookingRef();
  const token = accessToken();
  const now = Date.now();

  const claim = await checkClaim(departure, selected, fleet);
  if (!claim.ok) return { ok: false, reason: claim.reason };

  const customerId = newId("cus");

  try {
    await db.insert(customers).values({
      id: customerId,
      name: input.customer.name,
      email: input.customer.email.toLowerCase(),
      phone: input.customer.phone,
      country: input.customer.country,
      notes: "",
      createdAt: now,
    });

    await db.insert(bookings).values({
      id: bookingId,
      ref,
      accessToken: token,
      customerId,
      departureId: departure.id,
      status: "pending",
      totalJpy,
      currency: "JPY",
      holdExpiresAt: now + HOLD_MINUTES * 60_000,
      notes: input.notes ?? "",
      pickup: input.pickup?.trim() || null,
      dropoff: input.dropoff?.trim() || null,
      source: "web",
      createdAt: now,
      updatedAt: now,
    });

    await insertBlocks(departure, selected, bookingId);

    for (const vehicleId of selected) {
      const rate = rateByVehicle.get(vehicleId)!;
      const driver = input.drivers[vehicleId];
      await db.insert(bookingVehicles).values({
        id: newId("bv"),
        bookingId,
        vehicleId,
        rateId: rate.rateId,
        priceJpy: rate.priceJpy,
        driverName: driver.name,
        driverCountry: driver.country,
        driverLicense: selfDrive ? driver.license : "",
        driverIdp: selfDrive ? driver.idp ?? "" : "",
        driverDob: driver.dob ?? "",
      });
    }
  } catch (error) {
    await releaseBooking(bookingId);
    const message =
      error instanceof Error ? error.message : "Could not create booking.";
    return { ok: false, reason: message };
  }

  // D1 has no transactions: verify the claim after the fact and back out if a
  // rival booking won the same car.
  const winner = await verifyClaim(departure, selected, bookingId, now);
  if (!winner) {
    await releaseBooking(bookingId);
    await db
      .update(bookings)
      .set({ status: "expired", updatedAt: Date.now() })
      .where(eq(bookings.id, bookingId));
    return {
      ok: false,
      reason: "Sorry — one of those cars was just taken. Pick another.",
    };
  }

  return { ok: true, bookingId, ref, accessToken: token, totalJpy };
}
