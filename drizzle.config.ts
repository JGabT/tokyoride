import { defineConfig } from "drizzle-kit";

// Generate SQL migrations for D1:
//   pnpm db:generate
//   pnpm db:migrate:local   (dev, via miniflare)
//   pnpm db:migrate         (production)
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
});
