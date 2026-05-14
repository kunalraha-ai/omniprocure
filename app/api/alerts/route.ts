/**
 * /api/alerts/route.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseAdmin, logAuditEvent } from "@/lib/procurement";

export const maxDuration = 15;

async function getUserId(req: NextRequest): Promise<string | null> {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
          setAll: () => {},
        },
      }
    );
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// ── GET: list alerts ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get("unread") === "true";
  const mpn = searchParams.get("mpn");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);

  try {
    let query = supabaseAdmin
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (unreadOnly) query = query.eq("is_read", false);
    if (mpn) query = query.eq("mpn", mpn.toUpperCase());

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, alerts: data ?? [], count: data?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── POST: create alert ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { mpn, urgency, summary, recommendation, flaggedBy = "monitor" } = body;

  if (!mpn || !urgency || !summary) {
    return NextResponse.json({ error: "mpn, urgency, and summary are required" }, { status: 400 });
  }

  const validUrgencies = ["low", "medium", "high"];
  if (!validUrgencies.includes(urgency)) {
    return NextResponse.json({ error: `urgency must be one of: ${validUrgencies.join(", ")}` }, { status: 400 });
  }

  const userId = await getUserId(req);

  try {
    const { data, error } = await supabaseAdmin
      .from("alerts")
      .insert({
        mpn: mpn.toUpperCase(),
        urgency,
        summary,
        recommendation: recommendation ?? null,
        flagged_by: flaggedBy,
        is_read: false,
        created_at: new Date().toISOString(),
        ...(userId ? { user_id: userId } : {}),
      })
      .select()
      .single();

    if (error) throw error;

    await logAuditEvent({
      action: "alert_created",
      mpn: mpn.toUpperCase(),
      details: { urgency, summary, flaggedBy, userId },
    });

    return NextResponse.json({ success: true, alert: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── PATCH: mark as read ───────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, markAllRead } = body;

  try {
    if (markAllRead) {
      const { error } = await supabaseAdmin
        .from("alerts")
        .update({ is_read: true })
        .eq("is_read", false);
      if (error) throw error;
      return NextResponse.json({ success: true, message: "All alerts marked as read" });
    }

    if (!id) return NextResponse.json({ error: "id or markAllRead required" }, { status: 400 });

    const { error } = await supabaseAdmin.from("alerts").update({ is_read: true }).eq("id", id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: `Alert ${id} marked as read` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── DELETE: remove alert ──────────────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  try {
    const { error } = await supabaseAdmin.from("alerts").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true, message: `Alert ${id} deleted` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}