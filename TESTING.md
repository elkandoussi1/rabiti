# Verification

Install dependencies and run the local suite:

```sh
npm ci
npm test
```

The suite is intentionally split so a failure points at one layer.

- `tests/schema.cjs` applies `supabase/schema.sql` then `supabase/v2.sql` in
  PGlite. It covers publishing, secret exclusion, order creation, coupon
  validation, download gating, manual payment confirmation, order status,
  owner isolation, and statistics.
- `tests/units.mjs` imports the shared modules with a small `window` shim and
  checks draft normalization, product normalization, pricing helpers, slug
  validation, and safe URL handling.
- `tests/static.cjs` checks the shell files, PWA manifest, service-worker asset
  list, release version, and that obsolete local-mode and checkout files are gone.
- `tests/functions.cjs` checks the Edge Function source for the required
  security properties: no private key in responses, order-token verification,
  HMAC signature check, and service-role usage.

These tests do not cover:

- a real Supabase project, Auth email delivery, or RLS under real JWTs;
- a real YouCan Pay sandbox/live payment;
- Edge Function deployment;
- an installed PWA on a phone;
- cross-browser visual regression.

Before production, complete the manual checks in `SETUP-AR.md` and
`ACTIVATION-STATUS.md`. The browser QA checklist is:

1. Register, confirm email, sign in, create a store.
2. Add links, a paid product, and a manual payment method.
3. Publish, open the store in a private window, create an order.
4. Confirm the download is blocked, mark the order paid, download it.
5. Apply a coupon and verify the total.
6. Connect YouCan Pay sandbox, pay with `4242 4242 4242 4242`, verify the
   webhook marks the order delivered.
7. Resize to a phone viewport and test the dashboard and storefront.
