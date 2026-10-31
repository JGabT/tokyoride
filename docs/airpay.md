# AirPay integration

Run-time config lives in `wrangler.jsonc` (`vars`) and Cloudflare secrets — see
[DEPLOY.md](../DEPLOY.md).

The site ships with a working **sandbox** of the AirPay flow so the booking
journey can be demoed and tested before the merchant account is live.

```
Guest                     Tokyoride site                    AirPay
  |                              |                              |
  |-- pick date/cars ----------->|                              |
  |                              |-- create booking (pending)   |
  |                              |-- hold cars 30 min           |
  |                              |-- POST /v1/checkout -------->|
  |<-- redirect checkout_url ----|                              |
  |---------------------- pays on hosted page ----------------->|
  |                              |<---- webhook (signed) -------|
  |                              |-- verify + dedupe            |
  |                              |-- confirm booking            |
  |                              |-- issue receipt              |
  |                              |-- queue receipt email        |
  |<-- return_url: /bookings/.. -|                              |
```

## Files

| File | Role |
| --- | --- |
| `src/lib/payments.ts` | provider adapter: start checkout, verify signature, apply events |
| `src/pages/api/webhooks/airpay.ts` | callback endpoint to register in the merchant dashboard |
| `src/pages/api/payments/mock.ts` | sandbox settlement, calls the same event pipeline |
| `src/pages/pay/mock/[id].astro` | sandbox hosted-checkout page |
| `src/pages/api/bookings.ts` | creates the booking + hold, then opens checkout |

## Sandbox behaviour (`AIRPAY_MODE=mock`)

1. Booking is created as `pending`, cars are held for 30 minutes.
2. The guest is sent to `/pay/mock/:bookingId`, styled like a hosted gateway.
3. **Pay** triggers `checkout.successful` through `applyPaymentEvent`.
4. **Cancel** triggers `checkout.cancelled` and releases the cars.
5. **Let it expire** triggers `checkout.expired` and releases the cars.
6. The receipt, confirmation email and admin alert are produced exactly as in
   production.

Because settlement goes through `applyPaymentEvent`, the sandbox exercises the
real webhook logic — idempotency, amount checks, status transitions — not a
shortcut.

## Before switching to live

Get these answers from the AirPay merchant team, then fill `.env`:

1. **Currency.** Confirm the online channel supports `JPY`. A JPY-capable POS
   terminal does not guarantee the e-commerce gateway is enabled for JPY.
2. **API product and base URL.** AirPay exposes several incompatible APIs
   (India `/v4`, ShopeePay-style `/v1/checkout`, PH carrier billing). Confirm
   which one the merchant account is provisioned for.
3. **Amount units.** The documented v1 API takes amounts inflated by 100. For
   JPY (no minor unit) confirm whether ¥45,000 is `45000` or `4500000`. Test in
   sandbox before the first live yen.
4. **Signature scheme.** The adapter currently signs `timestamp.body` with
   HMAC-SHA256 and sends `X-Client-Id`, `X-Timestamp`, `X-Signature`. Replace
   with the scheme in the merchant contract.
5. **Callback signing.** Register `https://tokyoride.co/api/webhooks/airpay` and
   confirm the header name (`x-airpay-signature` is assumed).
6. **Refunds.** Confirm whether refunds are API-driven or dashboard-only. Admin
   refunds currently update our status and release the cars; the gateway-side
   refund must match.
7. **Settlement.** Currency, cycle and fees, for the reconciliation report.

## Switching on live mode

```env
AIRPAY_MODE="live"
AIRPAY_BASE_URL="https://api.gw.airpay..."   # from the merchant team
AIRPAY_MERCHANT_ID="..."
AIRPAY_SECRET="..."
PUBLIC_BASE_URL="https://tokyoride.co"
```

Then restart the server. The mock pages return a "no longer active" state and
`/pay/mock/*` is no longer reachable from checkout.

## Test matrix before go-live

- [ ] Success: booking confirmed, receipt `TR-YYYY-0001`, both emails sent
- [ ] Cancel: cars released, booking `cancelled`
- [ ] Expire: cars released, booking `expired`
- [ ] Duplicate webhook: second delivery is a no-op (`webhook_events` unique)
- [ ] Amount mismatch: rejected, not confirmed
- [ ] Two guests booking the same car: second gets a clean conflict message
- [ ] Convoy: two cars, one checkout, two holds
- [ ] Refund: status `refunded`, cars released
- [ ] Return URL opened without paying: still shows "awaiting payment"
- [ ] Webhook timeout / 500: AirPay retries, event applied once
