const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const validUuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value);

const normalizeYelpId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^[A-Za-z0-9_-]{1,255}$/.test(id) ? id : null;
};

const clean = (value: unknown, max: number): string | null =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;

async function scopedInstallationId(installationId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(installationId + ":yelp-suggestions")
  );
  const hash = Array.from(new Uint8Array(digest).slice(0, 16),
    (x) => x.toString(16).padStart(2, "0")).join("").split("");
  hash[12] = "5";
  hash[16] = "a";
  const value = hash.join("");
  return value.slice(0, 8) + "-" + value.slice(8, 12) + "-" +
    value.slice(12, 16) + "-" + value.slice(16, 20) + "-" + value.slice(20);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const installationId = body?.installationId;
    const yelpId = normalizeYelpId(body?.yelpId);
    const businessName = clean(body?.businessName, 200);
    const address = clean(body?.address, 300);
    const note = clean(body?.note, 500);
    const relationship = body?.relationship;

    if (!validUuid(installationId) || !yelpId || !businessName) {
      return reply({ error: "Invalid business details" }, 400);
    }
    if (!["owner", "family_friend", "knows"].includes(relationship)) {
      return reply({ error: "Choose a relationship option" }, 400);
    }

    const base = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!base || !key) return reply({ error: "Suggestion service is not configured" }, 503);

    const scopedId = await scopedInstallationId(installationId);
    const quota = await fetch(base + "/rest/v1/rpc/consume_greek_owned_extension_quota", {
      method: "POST",
      headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_installation_id: scopedId,
        p_max_requests: 5,
        p_window_seconds: 3600
      })
    });
    if (!quota.ok || await quota.json() !== true) {
      return reply({ error: "Suggestion limit reached. Try again later." }, 429);
    }

    const existsQuery = new URLSearchParams({
      select: "yelp_id",
      visible: "eq.true",
      yelp_id: "eq." + yelpId,
      limit: "1"
    });
    const exists = await fetch(base + "/rest/v1/listings?" + existsQuery.toString(), {
      headers: { apikey: key, Authorization: "Bearer " + key }
    });
    if (!exists.ok) return reply({ error: "Could not verify listing" }, 502);
    if ((await exists.json()).length) return reply({ message: "Already listed" }, 409);

    const yelpUrl = "https://www.yelp.com/biz/" + encodeURIComponent(yelpId);
    const insert = await fetch(base + "/rest/v1/greek_owned_yelp_extension_suggestions", {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "return=minimal"
      },
      body: JSON.stringify({
        yelp_id: yelpId,
        business_name: businessName,
        address,
        yelp_url: yelpUrl,
        relationship,
        note
      })
    });
    if (insert.status === 409) return reply({ message: "Suggestion already pending" }, 409);
    if (!insert.ok) {
      console.error("TGD Yelp suggestion insert failed with status", insert.status);
      return reply({ error: "Could not submit suggestion" }, 502);
    }

    return reply({
      message: "Thank you. Your suggestion will be reviewed by The Greek Directory."
    }, 201);
  } catch (error) {
    console.error("TGD Yelp suggestion request failed:", error instanceof Error ? error.message : "unknown error");
    return reply({ error: "Invalid request" }, 400);
  }
});