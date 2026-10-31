import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { adminUsers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createSession, verifyPassword } from "@/lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/admin");

  const rows = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email))
    .limit(1);

  const user = rows[0];
  const valid = user
    ? await verifyPassword(password, user.salt, user.passwordHash)
    : false;

  if (!user || !valid) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    return redirect(`/admin/login?error=1&next=${encodeURIComponent(next)}`);
  }

  await createSession(user.id, cookies);
  return redirect(next.startsWith("/admin") ? next : "/admin");
};
