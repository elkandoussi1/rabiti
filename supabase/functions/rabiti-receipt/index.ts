/* Receipt upload for Rabiti manual payments.
 *
 * A buyer who paid by bank transfer or CashPlus sends the receipt image from
 * the order page. The order's secret token is the only credential, so it is
 * checked here before anything is written: the bucket is private and has no
 * anonymous insert policy, and only the store owner can read the file back.
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

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "application/pdf": "pdf",
};

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

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  if (!supabaseUrl || !serviceKey) {
    console.error("rabiti-receipt: missing Supabase environment");
    return json({ error: "server_not_configured" }, 500);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: "invalid_form" }, 400);
  }

  const slug = String(form.get("slug") ?? "").trim();
  const orderNo = String(form.get("order_no") ?? "").trim();
  const token = String(form.get("token") ?? "").trim();
  const ref = String(form.get("ref") ?? "").trim().slice(0, 500);
  const file = form.get("file");

  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) return json({ error: "invalid_store" }, 400);
  if (!/^RB-[A-Z0-9]{10}$/.test(orderNo)) return json({ error: "invalid_order" }, 400);
  if (!/^[a-f0-9]{64}$/.test(token)) return json({ error: "invalid_token" }, 401);
  if (!(file instanceof File)) return json({ error: "missing_file" }, 400);

  const type = String(file.type || "").toLowerCase().split(";")[0].trim();
  const extension = EXTENSIONS[type];
  if (!extension) return json({ error: "unsupported_type" }, 415);
  if (file.size <= 0) return json({ error: "empty_file" }, 400);
  if (file.size > MAX_BYTES) return json({ error: "file_too_large" }, 413);

  /* The order must exist and still be waiting for payment. */
  const lookup = await fetch(`${supabaseUrl}/rest/v1/rpc/rabiti_order_status`, {
    method: "POST",
    headers: { ...authHeaders(serviceKey), "Content-Type": "application/json" },
    body: JSON.stringify({ p_slug: slug, p_order_no: orderNo, p_token: token }),
  });
  if (!lookup.ok) {
    console.error("rabiti-receipt: order lookup failed", lookup.status);
    return json({ error: "lookup_failed" }, 502);
  }
  const order = await lookup.json();
  if (!order || typeof order !== "object") return json({ error: "order_not_found" }, 404);
  if (order.status !== "pending") return json({ error: "order_closed" }, 409);

  const path = `${slug}/${orderNo}/${crypto.randomUUID()}.${extension}`;
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/rabiti-receipts/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(serviceKey),
      "Content-Type": type,
      "x-upsert": "false",
      "cache-control": "max-age=3600",
    },
    body: file,
  });
  if (!upload.ok) {
    console.error("rabiti-receipt: upload failed", upload.status, (await upload.text()).slice(0, 300));
    return json({ error: "upload_failed" }, 502);
  }

  const claim = await fetch(`${supabaseUrl}/rest/v1/rpc/rabiti_order_claim_paid`, {
    method: "POST",
    headers: { ...authHeaders(serviceKey), "Content-Type": "application/json" },
    body: JSON.stringify({
      p_slug: slug,
      p_order_no: orderNo,
      p_token: token,
      p_ref: ref,
      p_receipt: path,
    }),
  });
  const claimed = claim.ok ? await claim.json() : null;
  if (claimed !== true) {
    /* Do not leave an orphan file behind when the claim is rejected. */
    await fetch(`${supabaseUrl}/storage/v1/object/rabiti-receipts/${path}`, {
      method: "DELETE",
      headers: authHeaders(serviceKey),
    }).catch(() => {});
    console.error("rabiti-receipt: claim rejected", claim.status);
    return json({ error: "claim_rejected" }, 409);
  }

  return json({ ok: true, receipt: path });
});
