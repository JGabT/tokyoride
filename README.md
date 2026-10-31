# Tokyoride

JDM driving courses from Fujisawa, with booking, payments and a CMS.
**Astro SSR on Cloudflare Workers + D1 + R2**, React islands, Tailwind 4.

## Three courses

| Course | What it is | Driver |
| --- | --- | --- |
| **A — Full Tour with Driver** | 4-hour chauffeured run | Ours |
| **B — Self Drive** | 4 hours in the car you pick | Yours |
| **C — Point A to Point B** | 2-hour transfer, pickup + drop-off | Ours |

Pricing is flat **per car**, per course (the matrix in `/admin/rates`), for the
R32, R34, R35, AE86 and the support van.

## Local development

```bash
pnpm install
cp .dev.vars.example .dev.vars   # local secrets (no keys needed for mock mode)
pnpm db:migrate:local            # apply Drizzle migrations to local D1
pnpm dev                         # workerd + local D1 + local R2
pnpm db:seed                     # seed courses, fleet, 90 days of departures
```

http://localhost:4321 · admin at `/admin` (`sam@tokyoride.co` / `tokyoride2026`
until you set `ADMIN_PASSWORD`).

`astro dev` runs the real Workers runtime through Cloudflare's Vite plugin, so
local behaviour matches production.

## Deploy

See [DEPLOY.md](DEPLOY.md). Short version:

```bash
wrangler login
wrangler d1 create tokyoride        # paste database_id into wrangler.jsonc
wrangler r2 bucket create tokyoride-media
pnpm db:migrate
pnpm deploy
```

## Structure

```
src/
  lib/
    db/            Drizzle schema + D1 client
    runtime.ts     bindings + env helpers (cloudflare:workers)
    availability   per-car holds, overlap checks, hold expiry
    bookings       booking creation, race-safe car claims
    payments       AirPay adapter + mock provider + webhook pipeline
    receipts       receipt numbering, tax split, confirmation emails
    seed.ts        three courses, fleet, 90 days of departures
    catalog        courses, fleet, rates, maps
    settings       site copy and legal fields
  components/
    booking/       BookingWidget (calendar → cars → pickup/passenger → pay)
    map/           Leaflet map (public)
    admin/         Leaflet map editor
  pages/
    index, tours, fleet, about, contact
    tours/[slug]   course page + map + booking widget
    bookings/[ref] customer status page
    receipt/[token] printable receipt
    pay/mock/[id]  AirPay sandbox checkout
    admin/         dashboard, bookings, calendar, courses, fleet, pricing,
                   payments, maps, media, inbox, settings
    api/           bookings, payments, webhooks, cron, media, health, admin
drizzle/           SQL migrations applied with wrangler d1 migrations
wrangler.jsonc     D1 + R2 + vars bindings
```

## Booking model

- A **course** (`tours` table) has a duration, a driver mode and an optional
  pickup/drop-off flag.
- A **departure** is one dated instance with `capacity` cars.
- A **rate** is the flat price for one vehicle on one course.
- Booking claims a `resource_block` per car. D1 has no interactive
  transactions, so the claim is inserted then verified: if a rival booking
  claimed the same car first, the newcomer releases and returns a conflict.
- Holds last 30 minutes. Unpaid holds expire on the next booking, dashboard
  load, or `GET /api/cron/sweep`.

## Admin CMS

Everything the operator edits hits D1 — no deploys:

- **Courses** — copy, duration, driver mode, pickup/drop-off, status
- **Fleet** — cars, chassis codes, specs, photos, active/archived
- **Pricing** — course × vehicle matrix
- **Calendar** — month view, add/close departures, block a car, fill 90 days
- **Bookings** — confirm, cancel, refund, receipts, pickup details
- **Maps** — click-to-drop start/waypoint/end pins per course
- **Media** — uploads to R2, served from `/api/media/<key>`
- **Payments** — sandbox/live mode, flow diagram, recent attempts
- **Settings** — hero copy, contact, legal details, demo reset

## Payments

Default `AIRPAY_MODE=mock` runs a sandbox checkout at `/pay/mock/:id` that
settles through the real webhook pipeline (signature check, dedupe, amount
check, receipt, email). See [docs/airpay.md](docs/airpay.md) for the live-mode
checklist.

## Email

Without `RESEND_API_KEY`, emails are queued in D1 and shown per booking.
With a key they send through Resend from `EMAIL_FROM`.

## Map tiles

Default is Esri World Street Map (keyless, romanized labels). CARTO now needs
an API key; point `PUBLIC_MAP_TILE_URL` in `.env` at a keyed provider — see the
comment in `src/lib/map.ts`.
