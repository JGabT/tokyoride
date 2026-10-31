import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { bookings, payments, webhookEvents } from "./db/schema";
import { getBookingDetail, markPaid, markExpired, cancelBooking } from "./receipts";
import { hmac, newId } from "./ids";
import { env } from "./runtime";
import { formatJpy } from "./dates";

export type PaymentMode = "mock" | "live";

export function paymentMode(): PaymentMode {
  return env("AIRPAY_MODE") === "live" ? "live" : "mock";
}

export function publicBaseUrl(): string {
  return env("PUBLIC_BASE_URL", "http://localhost:4321");
}

export type CheckoutSession = {
  provider: string;
  checkoutId: string;
  url: string;
  amountJpy: number;
};

/**
 * Starts a checkout for a pending booking.
 *
 * In mock mode this points at /pay/mock/:id which reproduces the AirPay
 * hosted page and settles through the same webhook path as production.
 */
export async function startCheckout(bookingId: string): Promise<CheckoutSession> {
  const detail = await getBookingDetail(bookingId);
  if (!detail) throw new Error("Booking not found");
  if (detail.booking.status !== "pending") {
    throw new Error(`Booking is ${detail.booking.status}`);
  }

  const existing = await db
    .select()
    .from(payments)
    .where(
      and(eq(payments.bookingId, bookingId), eq(payments.status, "created")),
    )
    .limit(1);

  if (existing.length) {
    try {
      const payload = JSON.parse(existing[0].payload);
      return {
        provider: existing[0].provider,
        checkoutId: existing[0].providerCheckoutId,
        url: payload.checkoutUrl,
        amountJpy: existing[0].amountJpy,
      };
    } catch {
      /* fall through and create a new session */
    }
  }

  const provider = paymentMode() === "live" ? "airpay" : "airpay-mock";
  const checkoutId =
    paymentMode() === "live"
      ? await createAirpayCheckout(detail)
      : `mock_${newId("chk")}`;

  const url =
    paymentMode() === "live"
      ? checkoutId
      : `${publicBaseUrl()}/pay/mock/${bookingId}?t=${detail.booking.accessToken}`;

  if (paymentMode() === "live") {
    await db.insert(payments).values({
      id: newId("pay"),
      bookingId,
      provider,
      providerCheckoutId: "",
      amountJpy: detail.booking.totalJpy,
      status: "created",
      payload: JSON.stringify({ checkoutId }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return {
      provider,
      checkoutId: "",
      url,
      amountJpy: detail.booking.totalJpy,
    };
  }

  await db.insert(payments).values({
    id: newId("pay"),
    bookingId,
    provider,
    providerCheckoutId: checkoutId,
    amountJpy: detail.booking.totalJpy,
    status: "created",
    payload: JSON.stringify({
      checkoutUrl: url,
      amountJpy: detail.booking.totalJpy,
      reference: detail.booking.ref,
      customer: {
        name: detail.customer.name,
        email: detail.customer.email,
        phone: detail.customer.phone,
      },
    }),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return { provider, checkoutId, url, amountJpy: detail.booking.totalJpy };
}

/**
 * AirPay hosted checkout (ShopeePay-style v1 endpoint).
 * Confirm the exact signature scheme and base URL with the merchant account
 * manager before going live — see docs/airpay.md.
 */
async function createAirpayCheckout(
  detail: NonNullable<Awaited<ReturnType<typeof getBookingDetail>>>,
): Promise<string> {
  const base = env("AIRPAY_BASE_URL");
  const merchantId = env("AIRPAY_MERCHANT_ID");
  const secret = env("AIRPAY_SECRET");
  if (!base || !merchantId || !secret) {
    throw new Error(
      "AirPay live mode selected but AIRPAY_BASE_URL / AIRPAY_MERCHANT_ID / AIRPAY_SECRET are missing.",
    );
  }

  const body = JSON.stringify({
    reference_id: detail.booking.ref,
    merchant_ext_id: merchantId,
    amount: detail.booking.totalJpy,
    currency: "JPY",
    return_url: `${publicBaseUrl()}/bookings/${detail.booking.ref}?t=${detail.booking.accessToken}`,
    locale: "en",
    items: detail.cars.map((c) => ({
      name: `${detail.tour.title} — ${c.vehicle.name}`,
      quantity: 1,
      price: c.link.priceJpy,
    })),
    customer: {
      name: detail.customer.name,
      email: detail.customer.email,
      phone_number: detail.customer.phone,
    },
  });

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = await hmac(secret, `${timestamp}.${body}`);

  const res = await fetch(`${base.replace(/\/$/, "")}/v1/checkout`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": merchantId,
      "X-Timestamp": timestamp,
      "X-Signature": signature,
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`AirPay checkout failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as {
    checkout_url?: string;
    checkout_id?: string;
  };
  if (!json.checkout_url) throw new Error("AirPay did not return checkout_url");
  return json.checkout_url;
}

export async function verifyAirpaySignature(
  rawBody: string,
  signature: string | null,
): Promise<boolean> {
  const secret = env("AIRPAY_SECRET");
  if (!secret) return false;
  if (!signature) return false;
  const expected = await hmac(secret, rawBody);
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

export type PaymentEvent = {
  eventId: string;
  type: string;
  bookingRef?: string;
  checkoutId?: string;
  txnId?: string;
  amountJpy?: number;
};

/**
 * Idempotent event application. Both the real webhook and the mock
 * checkout funnel through here.
 */
export async function applyPaymentEvent(event: PaymentEvent) {
  try {
    await db.insert(webhookEvents).values({
      id: newId("evt"),
      provider: "airpay",
      eventId: event.eventId,
      type: event.type,
      payload: JSON.stringify(event),
      processedAt: null,
      createdAt: Date.now(),
    });
  } catch {
    return { ok: true, duplicate: true };
  }

  let bookingId: string | null = null;

  if (event.bookingRef) {
    const rows = await db
      .select()
      .from(bookings)
      .where(eq(bookings.ref, event.bookingRef))
      .limit(1);
    bookingId = rows[0]?.id ?? null;
  }

  if (!bookingId && event.checkoutId) {
    const rows = await db
      .select()
      .from(payments)
      .where(eq(payments.providerCheckoutId, event.checkoutId))
      .limit(1);
    bookingId = rows[0]?.bookingId ?? null;
  }

  if (!bookingId) {
    await db
      .update(webhookEvents)
      .set({ processedAt: Date.now() })
      .where(eq(webhookEvents.eventId, event.eventId));
    return { ok: false, reason: "booking_not_found" };
  }

  const bookingRows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);
  const booking = bookingRows[0];

  if (
    booking &&
    event.type === "checkout.successful" &&
    event.amountJpy &&
    event.amountJpy !== booking.totalJpy
  ) {
    await db
      .update(webhookEvents)
      .set({ processedAt: Date.now() })
      .where(eq(webhookEvents.eventId, event.eventId));
    return {
      ok: false,
      reason: "amount_mismatch",
      expected: booking.totalJpy,
      received: event.amountJpy,
    };
  }

  let result: Record<string, unknown> = {};

  switch (event.type) {
    case "checkout.successful":
    case "payment.paid": {
      const paid = await markPaid(bookingId, event.txnId ?? "", "airpay");
      result = paid;
      break;
    }
    case "checkout.expired": {
      await markExpired(bookingId);
      result = { expired: true };
      break;
    }
    case "checkout.cancelled":
    case "payment.failed": {
      await cancelBooking(bookingId, "Payment cancelled");
      result = { cancelled: true };
      break;
    }
    case "refund.successful": {
      await db
        .update(bookings)
        .set({ status: "refunded", updatedAt: Date.now() })
        .where(eq(bookings.id, bookingId));
      result = { refunded: true };
      break;
    }
    default:
      result = { ignored: event.type };
  }

  await db
    .update(webhookEvents)
    .set({ processedAt: Date.now() })
    .where(eq(webhookEvents.eventId, event.eventId));

  return { ok: true, duplicate: false, ...result };
}

/** Used by the mock checkout page to simulate AirPay's callback. */
export async function settleMock(
  bookingId: string,
  outcome: "paid" | "cancelled" | "expired",
) {
  const detail = await getBookingDetail(bookingId);
  if (!detail) return { ok: false as const, reason: "not_found" };

  if (detail.booking.status === "confirmed") {
    return { ok: true as const, already: true };
  }

  const paymentRow = await db
    .select()
    .from(payments)
    .where(eq(payments.bookingId, bookingId))
    .limit(1);

  const checkoutId = paymentRow[0]?.providerCheckoutId ?? `mock_${bookingId}`;
  const txnId = `MOCK-${Date.now().toString(36).toUpperCase()}`;

  const type =
    outcome === "paid"
      ? "checkout.successful"
      : outcome === "cancelled"
        ? "checkout.cancelled"
        : "checkout.expired";

  const eventId = `${checkoutId}:${type}`;

  if (outcome !== "paid") {
    await db
      .update(payments)
      .set({
        status: outcome === "cancelled" ? "failed" : "expired",
        updatedAt: Date.now(),
      })
      .where(eq(payments.bookingId, bookingId));
  }

  const applied = await applyPaymentEvent({
    eventId,
    type,
    bookingRef: detail.booking.ref,
    checkoutId,
    txnId,
    amountJpy: detail.booking.totalJpy,
  });

  return { ...applied, txnId, amountJpy: detail.booking.totalJpy };
}

export function describeAmount(amount: number) {
  return `${formatJpy(amount)} JPY`;
}
