import type { APIRoute } from "astro";
import { getBookingDetail } from "@/lib/receipts";
import { settleMock } from "@/lib/payments";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData();
  const bookingId = String(form.get("bookingId") ?? "");
  const token = String(form.get("token") ?? "");
  const outcome = String(form.get("outcome") ?? "cancelled");

  const detail = await getBookingDetail(bookingId);
  if (!detail || detail.booking.accessToken !== token) {
    return new Response("Not found", { status: 404 });
  }

  if (detail.booking.status === "pending") {
    if (outcome === "paid" || outcome === "cancelled" || outcome === "expired") {
      await settleMock(bookingId, outcome);
    }
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: `/bookings/${detail.booking.ref}?t=${detail.booking.accessToken}`,
    },
  });
};
