/**
 * POST /api/monitor
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches live price + stock data for a list of MPNs from OEM Secrets,
 * sends to Claude for analysis, returns alert data.
 * Call this on a cron (Vercel cron / your own scheduler) or on demand.
 *
 * POST body: { mpns?: string[] }  — omit to use watchlist table
 * GET       : returns current watchlist from Supabase
 *
 * PUT  /api/monitor  : add MPN to watchlist  { mpn, label? }
 * DELETE /api/monitor: remove MPN            { mpn }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchOemSecrets,
  analyzeMarketData,
  logAuditEvent,
  supabaseAdmin,
  SupplierResult,
} from "@/lib/procurement";

export const maxDuration = 60;

// ── GET: watchlist ─────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("watchlist")
      .select("*")
      .order("added_at", { ascending: false });
    return NextResponse.json({ success: true, watchlist: data ?? [] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── PUT: add to watchlist ─────────────────────────────────────────────────────
export async function PUT(req: NextRequest) {
  const { mpn, label } = await req.json();
  if (!mpn) return NextResponse.json({ error: "mpn required" }, { status: 400 });
  try {
    await supabaseAdmin.from("watchlist").upsert(
      { mpn: mpn.toUpperCase(), label: label ?? mpn, added_at: new Date().toISOString() },
      { onConflict: "mpn" }
    );
    return NextResponse.json({ success: true, message: `${mpn} added to watchlist` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── DELETE: remove from watchlist ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  const { mpn } = await req.json();
  if (!mpn) return NextResponse.json({ error: "mpn required" }, { status: 400 });
  try {
    await supabaseAdmin.from("watchlist").delete().eq("mpn", mpn.toUpperCase());
    return NextResponse.json({ success: true, message: `${mpn} removed from watchlist` });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── POST: run monitor check ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  let mpns: string[] = body?.mpns ?? [];

  // If no mpns provided, pull from watchlist table
  if (!mpns.length) {
    const { data } = await supabaseAdmin.from("watchlist").select("mpn");
    mpns = (data ?? []).map((r: { mpn: string }) => r.mpn);
  }

  if (!mpns.length) {
    return NextResponse.json({ success: true, message: "No parts to monitor. Add parts to watchlist.", alerts: [] });
  }

  try {
    // Fetch live data for all MPNs in parallel
    const fetchResults = await Promise.allSettled(
      mpns.map(async (mpn) => ({
        mpn,
        suppliers: await fetchOemSecrets(mpn),
      }))
    );

    const allSuppliers: SupplierResult[] = fetchResults
      .filter((r): r is PromiseFulfilledResult<{ mpn: string; suppliers: SupplierResult[] }> => r.status === "fulfilled")
      .flatMap(r => r.value.suppliers);

    // Per-part summaries
    const partSummaries = fetchResults
      .filter((r): r is PromiseFulfilledResult<{ mpn: string; suppliers: SupplierResult[] }> => r.status === "fulfilled")
      .map(r => {
        const inStock = r.value.suppliers.filter(s => s.hasPrice && s.stock > 0);
        const best = inStock[0];
        return {
          mpn: r.value.mpn,
          totalStock: inStock.reduce((sum, s) => sum + s.stock, 0),
          supplierCount: inStock.length,
          bestPrice: best?.price ?? null,
          bestLeadTime: best?.leadTime ?? null,
          status: inStock.length === 0 ? "out_of_stock" : inStock.length === 1 ? "single_source" : "healthy",
        };
      });

    // Claude analysis
    const analysis = await analyzeMarketData(allSuppliers);

    // Update last_checked_at in watchlist
    await Promise.allSettled(
      mpns.map(mpn =>
        supabaseAdmin.from("watchlist")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("mpn", mpn)
      )
    );

    // Audit log
    await logAuditEvent({
      action: "monitor_check",
      details: {
        mpnsChecked: mpns,
        alert: analysis?.alert,
        urgency: analysis?.urgency,
        recommendation: analysis?.recommendation,
      },
    });

    // If alert, update last_alert_at
    if (analysis?.alert) {
      await Promise.allSettled(
        (analysis.flaggedParts ?? []).map(mpn =>
          supabaseAdmin.from("watchlist")
            .update({ last_alert_at: new Date().toISOString() })
            .eq("mpn", mpn)
        )
      );
    }

    return NextResponse.json({
      success: true,
      checkedAt: new Date().toISOString(),
      mpnsChecked: mpns.length,
      partSummaries,
      analysis: analysis ?? { alert: false, urgency: "none", summary: "All clear", recommendation: "hold", flaggedParts: [] },
    });

  } catch (err: any) {
    console.error("[Monitor] Error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}