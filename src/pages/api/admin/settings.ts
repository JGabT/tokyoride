import type { APIRoute } from "astro";
import { getSessionUser } from "@/lib/auth";
import { SETTING_KEYS, setSetting } from "@/lib/settings";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  if (!(await getSessionUser(cookies))) return redirect("/admin/login");

  const form = await request.formData();
  for (const key of SETTING_KEYS) {
    if (form.has(key)) {
      await setSetting(key, String(form.get(key) ?? ""));
    }
  }

  return redirect("/admin/settings?saved=1");
};
