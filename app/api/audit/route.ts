/**
 * GET /api/audit
 * ─────────────────────────────────────────────────────────────────────────────
 * Returns audit trail entries from Supabase.
 * Query params:
 *   ?action=generate_po   filter by action type
 *   ?mpn=STM32F103C8T6    filter by MPN
 *   ?limit=50             max rows (default 100)
 *   ?page=1               pagination
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin, logAuditEvent } from "@/lib/procurement";

export const maxDuration = 15;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action  = searchParams.get("action");
  const mpn     = searchParams.get("mpn");
  const limit   = Math.min(parseInt(searchParams.get("limit") ?? "100"), 500);
  const page    = Math.max(parseInt(searchParams.get("page") ?? "1"), 1);
  const offset  = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from("audit_trail")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (action) query = query.eq("action", action);
    if (mpn)    query = query.ilike("mpn", `%${mpn}%`);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      success: true,
      events: data ?? [],
      total: count ?? 0,
      page,
      limit,
      pages: Math.ceil((count ?? 0) / limit),
    });

  } catch (err: any) {
    console.error("[Audit] GET error:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// Allow manual audit event logging from trusted server contexts
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body?.action) return NextResponse.json({ error: "action required" }, { status: 400 });
  try {
    await logAuditEvent(body);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}