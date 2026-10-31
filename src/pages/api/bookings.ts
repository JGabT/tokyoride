import type { APIRoute } from "astro";
import { z } from "zod";
import { createBooking } from "@/lib/bookings";
import { startCheckout } from "@/lib/payments";

export const prerender = false;

const driverSchema = z.object({
  name: z.string().min(2).max(120),
  // Country/license are only mandatory for self-drive courses; createBooking
  // enforces that based on the course's driver mode.
  country: z.string().max(80).optional().default(""),
  license: z.string().max(60).optional().default(""),
  idp: z.string().max(60).optional().default(""),
  dob: z.string().max(20).optional().default(""),
});

const schema = z.object({
  tourId: z.string().min(1),
  departureId: z.string().min(1),
  vehicleIds: z.array(z.string().min(1)).min(1).max(6),
  customer: z.object({
    name: z.string().min(2).max(120),
    email: z.email().max(160),
    phone: z.string().max(40).optional().default(""),
    country: z.string().max(80).optional().default(""),
  }),
  drivers: z.record(z.string(), driverSchema),
  notes: z.string().max(1000).optional().default(""),
  pickup: z.string().max(240).optional(),
  dropoff: z.string().max(240).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid request body." }, 400);
  }

  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return json(
      {
        error: "Check the booking details and try again.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      400,
    );
  }

  const result = await createBooking(parsed.data);
  if (!result.ok) return json({ error: result.reason }, 400);

  try {
    const checkout = await startCheckout(result.bookingId);
    return json({
      ref: result.ref,
      totalJpy: result.totalJpy,
      url: checkout.url,
    });
  } catch (error) {
    return json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not start the payment session.",
      },
      500,
    );
  }
};
