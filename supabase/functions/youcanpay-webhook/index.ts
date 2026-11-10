/* YouCan Pay webhook for Rabiti.
 *
 * YouCan Pay signs the raw request body with the store's private key. We look
 * up the order and the matching store secret with the service role, verify the
 * signature, then mark the order paid exactly once.
 */
const encoder = new TextEncoder();

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const toHex = (bytes: ArrayBuffer) =>
  Array.from(new Uint8Array(bytes)).map((b) => b.toString(16).padStart(2, "0")).join("");

const toBase64 = (bytes: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)));

const safeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};

const signatureMatches = async (raw: string, secret: string, header: string) => {
  const provided = header.replace(/^sha256=/i, "").trim().toLowerCase();
  if (!provided) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, encoder.encode(raw));
  return safeEqual(provided, toHex(digest)) || safeEqual(provided, toBase64(digest).toLowerCase());
};

/* Supabase is moving from the legacy service_role JWT to secret keys. Prefer
 * the injected secret-key dictionary, then fall back to the legacy variable. */
const serviceKey = (() => {
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const value = parsed.default ?? Object.values(parsed)[0];
      if (typeof value === "string" && value) return value;
    } catch { /* fall through to the legacy key */ }
  }
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
})();

const authHeaders = (key: string) =>
  key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey) {
    console.error("youcanpay-webhook: missing Supabase environment");
    return json({ error: "server_not_configured" }, 500);
  }

  const raw = await req.text();
  if (!raw || raw.length > 256_000) return json({ error: "invalid_body" }, 400);

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const transaction = (payload.transaction ?? {}) as Record<string, unknown>;
  const orderNo = String(
    transaction.order_id ?? transaction.orderId ?? payload.order_id ?? "",
  ).trim();
  if (!orderNo || orderNo.length > 80) return json({ error: "invalid_order" }, 400);

  const rest = (path: string, init: RequestInit = {}) =>
    fetch(`${supabaseUrl}/rest/v1/${path}`, {
      ...init,
      headers: {
        ...authHeaders(serviceKey),
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });

  let order: Record<string, unknown> | null = null;
  let secret: Record<string, unknown> | null = null;
  try {
    const orderResponse = await rest(
      `rabiti_orders?order_no=eq.${encodeURIComponent(orderNo)}&select=order_no,store_slug,status,total_minor,currency&limit=1`,
    );
    if (!orderResponse.ok) {
      console.error("youcanpay-webhook: order lookup failed", orderResponse.status);
      return json({ error: "lookup_failed" }, 502);
    }
    const orders = await orderResponse.json();
    order = Array.isArray(orders) ? orders[0] ?? null : null;
    if (!order) return json({ error: "order_not_found" }, 404);

    const secretResponse = await rest(
      `rabiti_payment_secrets?store_slug=eq.${encodeURIComponent(String(order.store_slug))}&provider=eq.youcanpay&select=private_key,sandbox&limit=1`,
    );
    if (!secretResponse.ok) {
      console.error("youcanpay-webhook: secret lookup failed", secretResponse.status);
      return json({ error: "lookup_failed" }, 502);
    }
    const secrets = await secretResponse.json();
    secret = Array.isArray(secrets) ? secrets[0] ?? null : null;
  } catch (error) {
    console.error("youcanpay-webhook: lookup error", error instanceof Error ? error.message : "unknown");
    return json({ error: "lookup_failed" }, 502);
  }

  if (!secret?.private_key) return json({ error: "payment_not_configured" }, 409);

  const signature = req.headers.get("x-youcanpay-signature") ?? "";
  if (!(await signatureMatches(raw, String(secret.private_key), signature))) {
    return json({ error: "invalid_signature" }, 401);
  }

  const payloadSandbox = payload.sandbox ?? transaction.sandbox;
  if (typeof payloadSandbox === "boolean" && payloadSandbox !== (secret.sandbox === true)) {
    return json({ error: "sandbox_mismatch" }, 400);
  }

  const event = String(payload.event ?? payload.type ?? "").toLowerCase();
  const status = String(transaction.status ?? "").toLowerCase();
  const isPaid = event === "transaction.paid" || event === "payment.paid" ||
    event === "paid" || status === "paid" || transaction.paid === true;
  if (!isPaid) return json({ ok: true, ignored: true });

  const amount = Number(
    transaction.base_amount ?? payload.base_amount ?? transaction.amount ?? payload.amount,
  );
  const currency = String(
    transaction.base_currency ?? payload.base_currency ?? transaction.currency ?? payload.currency ?? "",
  ).toUpperCase();
  if (!Number.isInteger(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    console.error("youcanpay-webhook: invalid amount or currency", { amount, currency });
    return json({ error: "invalid_amount" }, 400);
  }

  const providerRef = String(
    transaction.id ?? transaction.transaction_id ?? transaction.reference ?? payload.id ?? "",
  ).slice(0, 200);
  const eventId = String(
    payload.id ?? payload.event_id ?? transaction.id ?? transaction.transaction_id ?? providerRef ?? orderNo,
  ).slice(0, 200);

  try {
    const response = await rest("rpc/rabiti_confirm_payment", {
      method: "POST",
      body: JSON.stringify({
        p_order_no: orderNo,
        p_provider: "youcanpay",
        p_provider_ref: providerRef,
        p_amount_minor: amount,
        p_currency: currency,
        p_event_id: eventId,
        p_payload: payload,
      }),
    });
    const text = await response.text();
    if (!response.ok) {
      console.error("youcanpay-webhook: confirm failed", response.status, text.slice(0, 500));
      if (text.includes("PAYMENT_MISMATCH")) return json({ error: "payment_mismatch" }, 400);
      return json({ error: "confirm_failed" }, 500);
    }
    return json({ ok: true });
  } catch (error) {
    console.error("youcanpay-webhook: confirm error", error instanceof Error ? error.message : "unknown");
    return json({ error: "confirm_failed" }, 500);
  }
});
