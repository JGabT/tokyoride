import type { APIRoute } from "astro";
import { getBookingByRef } from "@/lib/receipts";
import { startCheckout } from "@/lib/payments";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const ref = url.searchParams.get("ref") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const booking = ref ? await getBookingByRef(ref) : null;

  if (!booking || booking.accessToken !== token) {
    return new Response("Not found", { status: 404 });
  }

  if (booking.status !== "pending") {
    return new Response(null, {
      status: 302,
      headers: {
        Location: `/bookings/${booking.ref}?t=${booking.accessToken}`,
      },
    });
  }

  const checkout = await startCheckout(booking.id, url.origin);
  return new Response(null, {
    status: 302,
    headers: { Location: checkout.url },
  });
};
