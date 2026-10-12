# Paid delivery verification — 12 October 2026

Private delivery sources and code hashes have no direct grants to anonymous or
signed-in clients. RLS explicitly denies direct access. Private SECURITY DEFINER
functions implement only the narrowly scoped redemption/receipt operations;
public wrappers use SECURITY INVOKER. Owner code status checks auth.uid().
Publication and redemption lock the public page before codes to avoid inverse
lock ordering. A code row lock prevents two browsers claiming the same code.
Republishing preserves consumed codes and the version delivered to the buyer.

PostgreSQL/PGlite and jsdom tests passed. A transaction on the real Supabase
project verified publish, source exclusion, redeem, second-receipt denial and
resume; test records were rolled back. Phone visual testing and payment-provider
verification were not performed. Payment confirmation remains manual.

The security advisor reports one independent Auth setting:
[Leaked password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
is disabled. Review availability and configuration in Supabase Auth; this
change does not alter the organization's plan or billing.

New delivery indexes have not yet seen production use. They support foreign-key
lookups and receipt retrieval and are intentionally retained.

The buyer can copy a delivered file, external URL, or their browser receipt.
The system controls first code activation; it is not DRM. Keeping receipt data
allows repeat downloads from the same browser. Clearing that data or changing
browser/device requires the seller to issue a new code. Unpublishing hides the
product and prevents redemption/resumption until it is published again.
