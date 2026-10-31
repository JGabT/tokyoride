import { env as cfEnv } from "cloudflare:workers";

/**
 * Runtime config and bindings.
 *
 * In Astro 6+ with the Cloudflare adapter, Workers bindings and secrets are
 * exposed directly on `cloudflare:workers` env — no `locals.runtime` hop.
 */
type Bindings = Record<string, unknown>;

export function bindings(): Bindings {
  return cfEnv as unknown as Bindings;
}

/** Runtime string config: vars/secrets first, then build-time PUBLIC_ values. */
export function env(name: string, fallback = ""): string {
  const fromRuntime = bindings()[name];
  if (typeof fromRuntime === "string" && fromRuntime !== "") return fromRuntime;

  const fromBuild = (import.meta.env as Record<string, unknown>)[name];
  if (typeof fromBuild === "string" && fromBuild !== "") return fromBuild;

  return fallback;
}

export function d1(): any {
  const binding = bindings().DB;
  if (!binding) throw new Error("D1 binding 'DB' is missing in wrangler.jsonc");
  return binding;
}

export function mediaBucket(): any {
  const binding = bindings().MEDIA;
  if (!binding) throw new Error("R2 binding 'MEDIA' is missing in wrangler.jsonc");
  return binding;
}
