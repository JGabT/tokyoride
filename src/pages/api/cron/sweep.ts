import type { APIRoute } from "astro";
import { expireStaleHolds } from "@/lib/availability";
import { retryQueued } from "@/lib/notify";
import { env } from "@/lib/runtime";

export const prerender = false;

async function run(request: Request) {
  const secret = env("CRON_SECRET");
  if (secret) {
    const header =
      request.headers.get("x-cron-secret") ??
      new URL(request.url).searchParams.get("secret");
    if (header !== secret) {
      return new Response("Unauthorized", { status: 401 });
    }
  }

  const expired = await expireStaleHolds();
  const sent = await retryQueued(25);

  return new Response(
    JSON.stringify({ ok: true, expired, emailsSent: sent }),
    { headers: { "Content-Type": "application/json" } },
  );
}

export const GET: APIRoute = ({ request }) => run(request);
export const POST: APIRoute = ({ request }) => run(request);
