import { withSupabase } from "npm:@supabase/server@^1";

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

export default {
  fetch: withSupabase({ auth: "user" }, async (request, { supabase }) => {
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

    let organizationId = "";
    try {
      const body = await request.json();
      organizationId = typeof body?.organization_id === "string" ? body.organization_id : "";
    } catch {
      return json(400, { error: "invalid_json" });
    }

    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(organizationId)) {
      return json(400, { error: "invalid_organization_id" });
    }

    // RLS restricts this query to the signed-in user's active membership.
    const { data: membership, error } = await supabase
      .from("aym_org_members")
      .select("organization_id, role, party_ref, is_active")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .maybeSingle();

    if (error) {
      console.error("party-bootstrap lookup failed", error.code);
      return json(500, { error: "membership_lookup_failed" });
    }
    if (!membership) return json(403, { error: "organization_access_denied" });

    return json(200, {
      organization_id: membership.organization_id,
      role: membership.role,
      party_ref: membership.party_ref,
    });
  }),
};
