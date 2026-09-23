# Task: phase 2 — online payment (Moyasar)

Status 2026-09-23: **code built and deployed, dormant until the merchant account exists.** Nothing in the storefront changes
until the owner flips `pay_gateway` to `1` in settings.

## What is already in place

- `supabase/functions/moyasar-verify/index.ts` — deployed to the live project (`verify_jwt = false`, it authenticates by
  order access token / webhook secret). Without `MOYASAR_SECRET_KEY` it answers 503 "الدفع الإلكتروني غير مفعّل".
- `supabase/migrations/003_gateway.sql` — unique index on `orders.gateway_payment_id`; `get_order` returns `id` + `access_token`.
- Storefront: when `pay_gateway = 1` and `moyasar_publishable_key` is set, checkout offers "الدفع الإلكتروني" first, the order is
  created with `payment_status = pending`, and the order page mounts the Moyasar form (mysr 1.14.0, `methods: creditcard + stcpay`,
  `supported_networks: mada/visa/mastercard`, `metadata: {order_id, order_no}`). The callback URL is the store root with
  `?pay=BR-xxxx&t=<token>`; `boot()` turns the gateway's `?id=…&status=…` into `#/order/BR-xxxx?t=…&pid=…`, and the order page
  calls `moyasar-verify` — **the `status` in the URL is never trusted**. Failed payment → order stays payable with a notice.
- Tests: `tests/e2e/gateway.spec.js` (3/3 PASS on the mock: pending order + correct init options, failed payment keeps the order
  payable, paid verified server-side and shown as paid).

## Owner's steps (in this order)

1. Open a Moyasar merchant account with the commercial registration and bank account; get **test** keys first
   (`pk_test_…`, `sk_test_…`).
2. Supabase → Edge Functions → Secrets (or CLI): `MOYASAR_SECRET_KEY=sk_test_…`.
   Optional but recommended: `MOYASAR_WEBHOOK_SECRET=<random string>` and, in Moyasar dashboard, a webhook to
   `https://oxsttfljqbunanmwdzft.supabase.co/functions/v1/moyasar-verify` with that secret token (events: payment paid/failed).
3. Admin → الإعدادات: `moyasar_publishable_key = pk_test_…`, `pay_gateway = 1`.
4. Place a test order with a Moyasar test card → order page shows "تم استلام الدفع", admin shows «مدفوع» with `gateway_payment_id`.
5. Switch both keys to live (`pk_live_…` in settings, `sk_live_…` in secrets). Apple Pay needs the extra `apple_pay` form config
   and merchant validation — a separate small task once the domain is final.

## Acceptance test (live, with test keys)

- Paid test card → `payment_status = paid`, `paid_at` set, event «الدفع: مدفوع» by «بوابة الدفع»; second verification call is idempotent.
- Tampered amount (pay 1 SAR for a 265 SAR order using the test key directly) → order stays unpaid, event `mismatch …` logged.
- Payment id of another order → 400 «عملية الدفع لا تخص هذا الطلب».
- Declined test card → `payment_status = failed`, form shown again.
- Webhook with wrong `secret_token` → 401; with the right one → same result as the page flow.

## Not in this phase

- Automatic cancellation of orders left `pending` (phase 3) — until then staff cancel them from the orders page (stock is restored).
- Refunds from the admin panel (use the Moyasar dashboard; mark `payment_status = refunded` manually).
