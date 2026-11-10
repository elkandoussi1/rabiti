/* YouCan Pay tokenization for Rabiti.
 *
 * The storefront sends the public order number and its secret access token.
 * We look up the store's YouCan Pay keys with the service role, then exchange
 * them for a short-lived payment token. The private key never reaches the
 * browser.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" },
  });

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const orderNo = String(body.order_no ?? "").trim();
  const orderToken = String(body.token ?? "").trim();
  const successUrl = String(body.success_url ?? "").trim();
  const errorUrl = String(body.error_url ?? "").trim();

  if (!orderNo || orderNo.length > 80) return json({ error: "invalid_order" }, 400);
  if (!/^[a-f0-9]{64}$/.test(orderToken)) return json({ error: "invalid_token" }, 401);
  if (!isHttpUrl(successUrl) || !isHttpUrl(errorUrl)) {
    return json({ error: "invalid_redirect" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!supabaseUrl || !serviceKey) {
    console.error("youcanpay-tokenize: missing Supabase environment");
    return json({ error: "server_not_configured" }, 500);
  }

  let secret: Record<string, unknown> | null = null;
  try {
    const response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/rabiti_payment_secret_for_order`,
      {
        method: "POST",
        headers: {
          ...authHeaders(serviceKey),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_order_no: orderNo, p_token: orderToken }),
      },
    );
    if (!response.ok) {
      console.error("youcanpay-tokenize: lookup failed", response.status);
      return json({ error: "lookup_failed" }, 502);
    }
    secret = await response.json();
  } catch (error) {
    console.error("youcanpay-tokenize: lookup error", error instanceof Error ? error.message : "unknown");
    return json({ error: "lookup_failed" }, 502);
  }

  if (!secret) return json({ error: "order_not_found" }, 404);
  if (!secret.enabled) return json({ error: "payment_not_configured" }, 409);
  if (!secret.public_key || !secret.private_key) {
    return json({ error: "payment_not_configured" }, 409);
  }
  if (secret.status !== "pending") return json({ error: "order_closed" }, 409);

  const amount = Number(secret.total_minor);
  const currency = String(secret.currency ?? "").toUpperCase();
  if (!Number.isInteger(amount) || amount <= 0 || !/^[A-Z]{3}$/.test(currency)) {
    return json({ error: "invalid_order_amount" }, 409);
  }

  const sandbox = secret.sandbox === true;
  const endpoint = sandbox
    ? "https://youcanpay.com/sandbox/api/tokenize"
    : "https://youcanpay.com/api/tokenize";

  const form = new URLSearchParams({
    pri_key: String(secret.private_key),
    order_id: String(secret.order_no ?? orderNo),
    amount: String(amount),
    currency,
    success_url: successUrl,
    error_url: errorUrl,
  });

  let payload: Record<string, unknown> = {};
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });
    const text = await response.text();
    try {
      payload = JSON.parse(text);
    } catch {
      console.error("youcanpay-tokenize: non-JSON response", response.status, text.slice(0, 300));
      return json({ error: "tokenize_failed" }, 502);
    }
    if (!response.ok) {
      console.error("youcanpay-tokenize: provider rejected", response.status, text.slice(0, 500));
      return json({ error: "tokenize_failed", status: response.status }, 502);
    }
  } catch (error) {
    console.error("youcanpay-tokenize: provider error", error instanceof Error ? error.message : "unknown");
    return json({ error: "tokenize_failed" }, 502);
  }

  const nested = payload.data as Record<string, unknown> | undefined;
  /* yp.js forwards this value to /pay as `token_id`, and that endpoint rejects
   * anything that is not a UUID with a 422 "invalid fields" error. YouCan Pay's
   * tokenize response carries both `token` (a short reference such as
   * `cp500014337`) and `transaction_id` (a UUID), so prefer whichever value is
   * actually a UUID and keep the first string as a fallback. */
  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const candidates = [
    payload.token, payload.transaction_id,
    nested?.token, nested?.transaction_id,
    payload.access_token, nested?.access_token,
  ].filter((value): value is string => typeof value === "string" && value.trim() !== "");
  const token = candidates.find(isUuid) ?? candidates[0];
  if (!token) {
    console.error("youcanpay-tokenize: provider returned no token", Object.keys(payload));
    return json({ error: "tokenize_failed" }, 502);
  }

  return json({
    token: String(token),
    public_key: String(secret.public_key),
    sandbox,
  });
});
