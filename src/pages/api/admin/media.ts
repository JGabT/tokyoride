import type { APIRoute } from "astro";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { getSessionUser } from "@/lib/auth";
import { mediaBucket } from "@/lib/runtime";
import { newId } from "@/lib/ids";

export const prerender = false;

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"];

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return redirect("/admin/media?error=nofile");
  }
  if (!ALLOWED.includes(file.type)) {
    return redirect("/admin/media?error=type");
  }
  if (file.size > 12 * 1024 * 1024) {
    return redirect("/admin/media?error=size");
  }

  const ext = (file.name.split(".").pop() ?? "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const key = `${newId("img").slice(0, 16)}.${ext}`;

  await mediaBucket().put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  await db.insert(media).values({
    id: newId("med"),
    key,
    filename: file.name,
    contentType: file.type,
    size: file.size,
    createdAt: Date.now(),
  });

  return redirect(`/admin/media?uploaded=${encodeURIComponent(key)}`);
};
