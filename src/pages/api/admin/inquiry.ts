import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { inquiries } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "read");

  if (id) {
    await db.update(inquiries).set({ status }).where(eq(inquiries.id, id));
  }

  return redirect("/admin/inbox");
};
