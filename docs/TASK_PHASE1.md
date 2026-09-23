# Task: phase 1 — foundation (done 2026-09-23)

Scope: database, storefront, admin panel, ops workflows, tests. Same working method as `mulaem-dash`.

## What was built

1. **Database** (`supabase/migrations/001_init.sql`, `002_place_order_search_path.sql`), applied to the live project `oxsttfljqbunanmwdzft`:
   - tables: profiles, settings, categories, products, product_variants (size/colour/stock/price override), product_images,
     shipping_rates, orders, order_items, order_events, stock_movements; storage bucket `product-images` (public read, staff write).
   - `place_order(jsonb)` — security definer, callable by anon: validates input, computes prices/shipping/VAT server-side,
     locks variants (`for update`), reserves stock, writes the order + items + events, returns order_no + access token.
     Limits: qty 1–10 per variant, 30 lines, 5 orders/hour/phone, city must exist in shipping_rates, payment method must be enabled.
   - `get_order(order_no, key)` — returns the order for the customer when key is the access token or the customer's phone.
   - triggers: `orders_guard` freezes money fields and forbids reopening cancelled orders; `orders_after_update` logs status/payment
     events and restores stock once on cancellation; `variants_stock_log` records manual stock edits.
   - RLS: anon reads active catalogue + public settings; staff manage catalogue and orders (no insert/delete on orders);
     admin edits settings and profiles; blocked profiles see nothing.
2. **Storefront** (`index.html`, `css/store.css`, `js/store.js`): home, shop with category/search/sort, product page with
   size/colour selection and stock awareness, cart (localStorage), checkout (name, phone, city → fee, address, payment method),
   order page (bank details + WhatsApp receipt link, or COD note), order tracking by order no + phone, returns policy.
3. **Admin** (`admin/`): login by username, dashboard KPIs, orders (filters, detail, status/payment updates, notes, cancel,
   print invoice), products (variants table, image upload with client-side resize, reorder/delete), categories, shipping,
   settings (admin only).
4. **Ops**: `keepalive.yml` (daily RPC ping), `backup.yml` (nightly pg_dump artifact, needs `SUPABASE_DB_URL`).

## Acceptance test — results

- `tests/db.test.sql`: 21/21 PASS on the live database (anon isolation, price/VAT computed server-side, stock reserve/restore,
  disabled payment method rejected, bad phone/city/qty/ids rejected, staff cannot change totals or reopen cancelled orders,
  blocked staff sees nothing).
- `tests/e2e/store.spec.js`: 10/10 PASS (browse, filter, size selection, add to cart, cart totals, checkout, order page, tracking, wrong phone rejected).
- `tests/e2e/admin.spec.js`: 12/12 PASS (login, dashboard, order confirm/paid/cancel, notes, product edit/add with image upload,
  duplicate variant rejected, categories, settings, mobile layout, logout).

## Known limits (deliberate, see ROADMAP)

- Online payment gateway not wired yet (phase 2); `pay_gateway` setting stays `0`.
- No automatic cancellation of stale unpaid orders (phase 3).
- Simple print invoice without ZATCA QR (phase 4).
- Single-page app: product pages are not indexable by search engines (phase 5).
