// Internal Yelp suggestion queue endpoint. Requires repository write access.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-github-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers });

const rest = (path: string, init: RequestInit = {}) =>
  fetch(Deno.env.get("SUPABASE_URL") + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      Authorization: "Bearer " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      ...(init.headers || {})
    }
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  try {
    const token = req.headers.get("x-github-token") || "";
    const githubHeaders = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json"
    };
    if (token.length < 20 || token.length > 500) {
      return reply({ error: "GitHub authentication required" }, 401);
    }

    const user = await fetch("https://api.github.com/user", { headers: githubHeaders });
    if (!user.ok) return reply({ error: "GitHub authentication failed" }, 403);
    const repo = await fetch("https://api.github.com/repos/thegreekdirectory/platform", {
      headers: githubHeaders
    });
    if (!repo.ok) return reply({ error: "Repository access denied" }, 403);
    const permissions = (await repo.json()).permissions;
    if (!permissions?.push && !permissions?.admin) {
      return reply({ error: "Repository write access required" }, 403);
    }

    const body = await req.json();
    if (body.action === "list") {
      const query = new URLSearchParams({
        select: "id,created_at,yelp_id,business_name,address,yelp_url,relationship,note",
        status: "eq.pending",
        order: "created_at.desc",
        limit: "250"
      });
      const response = await rest("greek_owned_yelp_extension_suggestions?" + query.toString());
      if (!response.ok) return reply({ error: "Yelp suggestion queue unavailable" }, 502);
      return reply({ suggestions: await response.json() });
    }

    if (body.action === "review") {
      if (typeof body.id !== "string" || !["approved", "denied"].includes(body.status)) {
        return reply({ error: "Invalid review" }, 400);
      }

      const lookup = new URLSearchParams({
        select: "id,yelp_id",
        id: "eq." + body.id,
        status: "eq.pending",
        limit: "1"
      });
      const response = await rest("greek_owned_yelp_extension_suggestions?" + lookup.toString());
      const rows = await response.json();
      if (!response.ok || !rows.length) {
        return reply({ error: "Suggestion is no longer pending" }, 409);
      }

      if (body.status === "approved") {
        const listingQuery = new URLSearchParams({
          select: "id",
          visible: "eq.true",
          yelp_id: "eq." + rows[0].yelp_id,
          limit: "1"
        });
        const listingResponse = await rest("listings?" + listingQuery.toString());
        if (!listingResponse.ok) return reply({ error: "Could not verify listing" }, 502);
        if ((await listingResponse.json()).length) {
          return reply({ error: "Yelp ID already belongs to a visible listing" }, 409);
        }
      }

      const update = await rest(
        "greek_owned_yelp_extension_suggestions?" +
          new URLSearchParams({ id: "eq." + body.id, status: "eq.pending" }).toString(),
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Prefer: "return=representation"
          },
          body: JSON.stringify({
            status: body.status,
            reviewed_at: new Date().toISOString(),
            review_notes: typeof body.reviewNotes === "string" ? body.reviewNotes.slice(0, 2000) : null
          })
        }
      );
      if (!update.ok || !(await update.json()).length) {
        return reply({ error: "Review could not be saved" }, 409);
      }
      return reply({ reviewed: true, status: body.status });
    }

    return reply({ error: "Unknown action" }, 400);
  } catch {
    return reply({ error: "Invalid request" }, 400);
  }
});