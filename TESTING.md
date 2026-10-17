# Verification

Install development dependencies using `npm ci`, then run `npm test`.
Runtime hosting is still static; npm is only needed for tests.

- `tests/database.cjs` executes schema.sql in PGlite (PostgreSQL WASM), creates
  anonymous/authenticated roles and a simulated auth.uid(), and checks:
  owner isolation, private drafts, public snapshots, denied direct public writes,
  omitted secret/hidden product fields, revision conflicts, paid-product guard,
  and owner-scoped unpublish.
- `tests/ui.cjs` uses jsdom with a mocked Supabase client. It checks cloud editor
  initialization, the publishing panel, save-before-publish, blocked publication
  on conflicts, public product details/back, and unsafe link/style filtering.

These tests passed locally. They do not test real Supabase email delivery,
OAuth/SMTP configuration, an installed phone PWA, or an actual hosted project.
Browser visual testing was unavailable because the Chromium download failed.
Complete the real-service checks in SETUP-AR.md before public rollout.

Paid delivery tests execute paid-delivery.sql and cover private sources/codes, redemption, same-receipt retries, second-browser rejection, owner-only code status, republishing without code reset, revocation, and unpublished products. UI tests cover manual checkout, lost-response retry, receipt preservation, and fast code generation.

External checkout: tests/checkout.cjs applies external-checkout.sql and verifies valid product URLs, forged/unsafe URL rejection, public secret exclusion, editor save, and customer purchase/details links. No real third-party payment or account activation was performed.
