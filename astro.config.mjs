import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://tokyoride.co",
  output: "server",
  // We use our own cookie sessions in D1, so skip the Workers KV session store.
  session: false,
  adapter: cloudflare({ imageService: "passthrough" }),
  redirects: {
    "/tours": "/courses",
    "/tours/[slug]": "/courses/[slug]",
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: ["react", "react-dom", "react/jsx-dev-runtime", "react/jsx-runtime"],
    },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
    server: {
      watch: {
        usePolling: true,
        interval: 100,
      },
    },
  },
});
