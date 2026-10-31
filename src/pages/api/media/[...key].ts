import type { APIRoute } from "astro";
import { mediaBucket } from "@/lib/runtime";

export const prerender = false;

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
};

export const GET: APIRoute = async ({ params }) => {
  const key = params.key ?? "";
  if (!key || key.includes("..") || key.includes("\\")) {
    return new Response("Not found", { status: 404 });
  }

  const object = await mediaBucket().get(key);
  if (!object) return new Response("Not found", { status: 404 });

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const type =
    object.httpMetadata?.contentType ?? TYPES[ext] ?? "application/octet-stream";

  return new Response(object.body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
