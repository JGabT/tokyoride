# Deploying to Cloudflare Workers

Astro runs on Workers, data lives in **D1**, uploads in **R2**. One deploy, no
servers to patch. `wrangler.jsonc` holds the bindings.

## 1. One-time setup

```bash
pnpm install
pnpm exec wrangler login
```

Create the database and bucket:

```bash
pnpm exec wrangler d1 create tokyoride
# copy the database_id into wrangler.jsonc  -> d1_databases[0].database_id

pnpm exec wrangler r2 bucket create tokyoride-media
```

Apply the schema:

```bash
pnpm db:migrate        # remote D1
pnpm db:migrate:local  # local dev database (miniflare)
```

## 2. Secrets

Set these before the first seed, or the demo password ships with the site:

```bash
pnpm exec wrangler secret put ADMIN_EMAIL       # e.g. sam@tokyoride.co
pnpm exec wrangler secret put ADMIN_PASSWORD    # a real password
pnpm exec wrangler secret put AIRPAY_SECRET
pnpm exec wrangler secret put RESEND_API_KEY
pnpm exec wrangler secret put EMAIL_FROM
pnpm exec wrangler secret put CRON_SECRET
```

Non-secret values live in `wrangler.jsonc` under `"vars"`. For production set:

```jsonc
"PUBLIC_BASE_URL": "https://tokyoride.co",
"AIRPAY_MODE": "live",          // or "mock" to keep the sandbox checkout
```

## 3. Deploy

```bash
pnpm deploy
```

Then attach the domain: Cloudflare dashboard → Workers → `tokyoride` →
**Settings → Domains & Routes → Add custom domain** → `tokyoride.co`.

## 4. First-run seed

The seed endpoint allows an unauthenticated bootstrap **only while no admin
account exists**. After that it needs an admin session plus `confirm=RESET`.

```bash
curl -X POST https://tokyoride.co/api/admin/seed \
  -H 'Origin: https://tokyoride.co' \
  -d 'confirm=RESET'
```

Or use **Admin → Settings → Demo data** (type `RESET`). That wipes everything
and rebuilds the three courses, fleet and 90 days of departures.

## 5. Housekeeping

- **Cron**: hit `https://tokyoride.co/api/cron/sweep?secret=$CRON_SECRET` every
  5 minutes (cron-job.org, Cloudflare Cron Trigger, GitHub Actions). It expires
  unpaid holds and retries queued email. Holds also expire on the next booking
  or dashboard load, so this is a safety net rather than critical.
- **Uploads** go to the `tokyoride-media` R2 bucket via `MEDIA`.
- **Backups**: D1 has point-in-time restore on paid plans; for free, run
  `wrangler d1 export tokyoride --remote --output backup.sql` on a schedule.
- **Logs**: `wrangler tail tokyoride`.

## Local development

```bash
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev            # workerd + local D1 + local R2
pnpm db:seed        # seeds through the running dev server
```

`astro dev` runs the real Workers runtime, so what works locally works deployed.

## Notes

- `session: false` in `astro.config.mjs` — auth uses our own cookie sessions in
  D1, so there is no KV namespace.
- Map tiles are a build-time setting (`PUBLIC_MAP_TILE_URL` in `.env`); the
  default Esri endpoint needs no key.
- `nodejs_compat` is enabled for small Node dependencies.
