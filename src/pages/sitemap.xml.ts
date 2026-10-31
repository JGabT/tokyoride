import type { APIRoute } from "astro";
import { getActiveTours } from "@/lib/catalog";

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const origin = site?.toString().replace(/\/$/, "") ?? "https://tokyoride.co";
  const tours = await getActiveTours();

  const urls = [
    { loc: `${origin}/`, priority: "1.0" },
    { loc: `${origin}/courses`, priority: "0.9" },
    { loc: `${origin}/fleet`, priority: "0.8" },
    { loc: `${origin}/about`, priority: "0.5" },
    { loc: `${origin}/contact`, priority: "0.5" },
    ...tours.map((t) => ({ loc: `${origin}/courses/${t.id}`, priority: "0.8" })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${u.loc}</loc><changefreq>weekly</changefreq><priority>${u.priority}</priority></url>`,
  )
  .join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
};
