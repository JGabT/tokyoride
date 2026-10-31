import { and, eq, sql } from "drizzle-orm";
import { db } from "./db";
import {
  bookingVehicles,
  bookings,
  customers,
  departures,
  payments,
  receipts,
  resourceBlocks,
  tours,
  vehicles,
} from "./db/schema";
import { newId, randomCode } from "./ids";
import { formatJpy, jstLong, jstTime } from "./dates";
import { queueNotification } from "./notify";

export type BookingDetail = Awaited<ReturnType<typeof getBookingDetail>>;

export async function getBookingDetail(bookingId: string) {
  const rows = await db
    .select({
      booking: bookings,
      customer: customers,
      departure: departures,
      tour: tours,
    })
    .from(bookings)
    .innerJoin(customers, eq(customers.id, bookings.customerId))
    .innerJoin(departures, eq(departures.id, bookings.departureId))
    .innerJoin(tours, eq(tours.id, departures.tourId))
    .where(eq(bookings.id, bookingId))
    .limit(1);

  const base = rows[0];
  if (!base) return null;

  const cars = await db
    .select({ link: bookingVehicles, vehicle: vehicles })
    .from(bookingVehicles)
    .innerJoin(vehicles, eq(vehicles.id, bookingVehicles.vehicleId))
    .where(eq(bookingVehicles.bookingId, bookingId));

  return { ...base, cars };
}

export async function getBookingByRef(ref: string) {
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.ref, ref))
    .limit(1);
  return rows[0] ?? null;
}

export async function issueReceipt(bookingId: string) {
  const existing = await db
    .select()
    .from(receipts)
    .where(eq(receipts.bookingId, bookingId))
    .limit(1);
  if (existing.length) return existing[0];

  const detail = await getBookingDetail(bookingId);
  if (!detail) throw new Error("Booking not found");

  const count = await db.select({ n: sql<number>`count(*)` }).from(receipts);
  const seq = (count[0]?.n ?? 0) + 1;
  const year = new Date().getFullYear();
  const number = `TR-${year}-${String(seq).padStart(4, "0")}`;
  const token = randomCode(24);

  const tax = Math.round(detail.booking.totalJpy / 1.1 * 0.1);

  const snapshot = {
    number,
    issuedAt: Date.now(),
    customer: detail.customer,
    tour: { id: detail.tour.id, title: detail.tour.title },
    departure: {
      startsAt: detail.departure.startsAt,
      endsAt: detail.departure.endsAt,
    },
    pickup: detail.booking.pickup ?? null,
    dropoff: detail.booking.dropoff ?? null,
    cars: detail.cars.map((c) => ({
      name: c.vehicle.name,
      chassisCode: c.vehicle.chassisCode,
      driver: c.link.driverName,
      priceJpy: c.link.priceJpy,
    })),
    totalJpy: detail.booking.totalJpy,
    taxJpy: tax,
    subtotalJpy: detail.booking.totalJpy - tax,
    currency: "JPY",
  };

  const row = {
    id: newId("rcp"),
    bookingId,
    number,
    token,
    issuedAt: Date.now(),
    snapshot: JSON.stringify(snapshot),
  };
  await db.insert(receipts).values(row);
  return row;
}

export async function getReceiptByToken(token: string) {
  const rows = await db
    .select()
    .from(receipts)
    .where(eq(receipts.token, token))
    .limit(1);
  return rows[0] ?? null;
}

export async function markPaid(
  bookingId: string,
  providerTxnId: string,
  provider: string,
) {
  const detail = await getBookingDetail(bookingId);
  if (!detail) return { ok: false, reason: "not_found" as const };

  if (detail.booking.status === "confirmed" || detail.booking.status === "paid") {
    return { ok: true, already: true as const };
  }

  const now = Date.now();
  await db
    .update(bookings)
    .set({ status: "confirmed", paidAt: now, updatedAt: now })
    .where(eq(bookings.id, bookingId));

  await db
    .update(payments)
    .set({
      status: "paid",
      providerTxnId,
      provider,
      updatedAt: now,
    })
    .where(eq(payments.bookingId, bookingId));

  const receipt = await issueReceipt(bookingId);
  const cars = detail.cars
    .map((c) => `${c.vehicle.name} (${c.vehicle.chassisCode || "JDM"})`)
    .join(", ");

  await queueNotification({
    bookingId,
    kind: "booking_confirmed",
    recipient: detail.customer.email,
    subject: `Booking confirmed — ${detail.booking.ref} · ${detail.tour.title}`,
    body: [
      `Hi ${detail.customer.name},`,
      ``,
      `Your cars are confirmed.`,
      ``,
      `Booking: ${detail.booking.ref}`,
      `Tour: ${detail.tour.title}`,
      `Pickup: ${jstLong(detail.departure.startsAt)} at ${jstTime(detail.departure.startsAt)} JST`,
      `Cars: ${cars}`,
      ...(detail.booking.pickup
        ? [`Pickup: ${detail.booking.pickup}`, `Drop-off: ${detail.booking.dropoff ?? "—"}`]
        : []),
      `Total: ${formatJpy(detail.booking.totalJpy)} (tax included)`,
      `Receipt: /receipt/${receipt.token}`,
      ``,
      `Bring your passport, home license and International Driving Permit.`,
      `See you in Fujisawa.`,
    ].join("\n"),
  });

  await queueNotification({
    bookingId,
    kind: "admin_new_booking",
    recipient: process.env.ADMIN_ALERT_EMAIL ?? "hello@tokyoride.co",
    subject: `New booking ${detail.booking.ref} — ${formatJpy(detail.booking.totalJpy)}`,
    body: `${detail.customer.name} booked ${cars} on ${detail.tour.title} for ${jstLong(detail.departure.startsAt)}.`,
  });

  return { ok: true, already: false as const, receipt };
}

export async function cancelBooking(bookingId: string, reason: string) {
  const now = Date.now();
  await db
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: now, updatedAt: now, notes: reason })
    .where(eq(bookings.id, bookingId));
  await db
    .delete(resourceBlocks)
    .where(eq(resourceBlocks.bookingId, bookingId));
}

export async function markExpired(bookingId: string) {
  const now = Date.now();
  await db
    .update(bookings)
    .set({ status: "expired", updatedAt: now })
    .where(and(eq(bookings.id, bookingId), eq(bookings.status, "pending")));
  await db.delete(resourceBlocks).where(eq(resourceBlocks.bookingId, bookingId));
}
