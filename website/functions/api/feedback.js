const allowedFeatures = new Set([
  "local_md",
  "shareable_html",
  "highlight_annotate",
  "export_pdf"
]);

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });

const isEmail = (value) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const hashValue = async (value) => {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const normalizeText = (value, maxLength) =>
  String(value || "").trim().slice(0, maxLength);

const validatePayload = (body) => {
  const type = normalizeText(body.type, 32);
  const email = normalizeText(body.email, 120);
  const message = normalizeText(body.message, 500);
  const customFeature = normalizeText(body.customFeature, 150);
  const features = Array.isArray(body.features)
    ? body.features.filter((feature) => allowedFeatures.has(feature))
    : [];

  if (type !== "feedback" && type !== "waiting_list") {
    return { error: "invalid_type" };
  }

  if (type === "feedback" && message.length === 0) {
    return { error: "invalid_message" };
  }

  if (type === "waiting_list") {
    if (!isEmail(email)) {
      return { error: "invalid_email" };
    }

    if (features.length === 0 && customFeature.length === 0) {
      return { error: "empty_interest" };
    }
  }

  return {
    data: {
      type,
      email,
      message,
      customFeature,
      features,
      source: normalizeText(body.source || "website_feedback_page", 80),
      locale: normalizeText(body.locale || "en", 16),
      pageUrl: normalizeText(body.pageUrl, 500)
    }
  };
};

export const onRequestOptions = () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type"
    }
  });

export const onRequestPost = async ({ request, env }) => {
  if (!env.DB) {
    return json({ ok: false, error: "missing_database_binding" }, 500);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  if (body.company) {
    return json({ ok: true });
  }

  const { data, error } = validatePayload(body);
  if (error) {
    return json({ ok: false, error }, 400);
  }

  const ip = request.headers.get("cf-connecting-ip") || "";
  const userAgent = normalizeText(request.headers.get("user-agent"), 500);
  const ipHash = ip ? await hashValue(`${ip}:${userAgent}`) : "";
  const now = new Date();
  const createdAt = now.toISOString();
  const windowStart = new Date(now.getTime() - 10 * 60 * 1000).toISOString();

  if (ipHash) {
    const recent = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM feedback_entries WHERE ip_hash = ? AND created_at >= ?"
    )
      .bind(ipHash, windowStart)
      .first();

    if (recent && recent.count >= 5) {
      return json({ ok: false, error: "rate_limited" }, 429);
    }
  }

  await env.DB.prepare(
    `INSERT INTO feedback_entries (
      id, type, email, message, features_json, custom_feature,
      source, locale, page_url, user_agent, ip_hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      data.type,
      data.email || null,
      data.message || null,
      JSON.stringify(data.features),
      data.customFeature || null,
      data.source,
      data.locale,
      data.pageUrl,
      userAgent,
      ipHash || null,
      createdAt
    )
    .run();

  return json({ ok: true });
};

export const onRequest = () => json({ ok: false, error: "method_not_allowed" }, 405);
