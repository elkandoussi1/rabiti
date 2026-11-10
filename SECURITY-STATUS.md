# Security status — Rabiti 2.1

This document describes the controls in the new schema and the limits of the
testing performed. It is not a third-party security audit.

## Access control

- `rabiti_stores` and `rabiti_pages` keep the original RLS policies: an owner
  reads and writes only their own store; everyone can read published pages.
- `rabiti_orders` is readable only by the store owner. Buyers never query the
  table directly; they use `rabiti_order_status` with the order number and a
  64-character access token.
- `rabiti_order_events` is readable only by the store owner through an RLS
  policy that joins the order to the store.
- `rabiti_payment_secrets` has no grants to `anon` or `authenticated`. The
  private YouCan Pay key is read only by service-role Edge Functions.
- `rabiti_discounts` is owner-scoped through RLS.

## Publishing

`rabiti_publish` builds a fresh public payload. It copies only public fields:
profile, design, texts, shop contact details, SEO, links, public payment
instructions, and product display data. It never copies `src`, `data`, `lm`,
internal notes, or payment secrets. Paid product delivery URLs are stored only
in the private draft.

## Orders and delivery

- Creating an order recalculates prices from the published payload; the browser
  cannot choose the amount.
- `rabiti_order_status` and `rabiti_order_download` require the matching access
  token and do not return internal notes.
- Download is refused until the order is `paid` or `delivered`.
- Cancelling or refunding closes download access.
- `rabiti_confirm_payment` is service-role only, checks amount and currency,
  and records a unique provider event id to make retries idempotent.

## YouCan Pay

- Tokenization happens in `youcanpay-tokenize`. The browser sends the order
  number and access token; the function returns a short-lived payment token and
  the public key, never the private key.
- The webhook verifies `X-YOUCANPAY-SIGNATURE` as HMAC-SHA256 over the raw body
  with the store's private key. It also checks the sandbox flag and the order
  amount/currency.
- Edge Functions are deployed with `--no-verify-jwt` because buyers do not have
  a Supabase session. Their own token/signature checks are the authentication.

## Known limits

- No email receipts or password-protected downloads.
- No DRM: a buyer can save or share a delivered file or URL.
- No automatic refund call to YouCan Pay.
- No rate limiting beyond the order-creation throttle in SQL.
- No live payment, real Supabase project, or third-party penetration test was
  performed while preparing this version. Run the checks in `SETUP-AR.md` and
  `TESTING.md` before production.
