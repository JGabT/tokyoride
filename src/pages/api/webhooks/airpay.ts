import type { APIRoute } from "astro";
import { applyPaymentEvent, paymentMode, verifyAirpaySignature } from "@/lib/payments";

export const prerender = false;

/**
 * AirPay callback endpoint.
 * Configure this URL as the merchant callback:
 *   https://tokyoride.co/api/webhooks/airpay
 *
 * The signature scheme must be confirmed with AirPay before go-live.
 */
export const POST: APIRoute = async ({ request }) => {
  const raw = await request.text();
  const signature =
    request.headers.get("x-airpay-signature") ??
    request.headers.get("x-signature");

  if (paymentMode() === "live") {
    const valid = await verifyAirpaySignature(raw, signature);
    if (!valid) {
      return new Response(JSON.stringify({ error: "invalid signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response(JSON.stringify({ error: "invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const type: string = payload.type ?? payload.event_type ?? "checkout.successful";
  const eventId: string =
    payload.event_id ??
    payload.eventId ??
    `${payload.checkout_id ?? payload.reference_id ?? "unknown"}:${type}`;

  const result = await applyPaymentEvent({
    eventId,
    type,
    bookingRef: payload.reference_id ?? payload.referenceId,
    checkoutId: payload.checkout_id ?? payload.checkoutId,
    txnId: payload.transaction_id ?? payload.txn_id,
    amountJpy: Number(payload.amount ?? 0),
  });

  return new Response(JSON.stringify({ received: true, ...result }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
