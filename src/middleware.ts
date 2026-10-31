import { defineMiddleware } from "astro:middleware";
import { getSessionUser } from "./lib/auth";

export const onRequest = defineMiddleware(async (context, next) => {
  if (!context.url.pathname.startsWith("/admin")) return next();

  const user = await getSessionUser(context.cookies);
  context.locals.user = user;

  const path = context.url.pathname.replace(/\/$/, "") || "/";
  if (path === "/admin/login") {
    if (user) return context.redirect("/admin");
    return next();
  }

  if (!user) {
    const next = encodeURIComponent(context.url.pathname + context.url.search);
    return context.redirect(`/admin/login?next=${next}`);
  }

  return next();
});
