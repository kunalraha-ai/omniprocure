/**
 * POST /api/monitor
 * ─────────────────────────────────────────────────────────────────────────────
 * Fetches live price + stock data, analyses with Claude, saves alerts.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import {
  fetchOemSecrets,
  analyzeMarketData,
  logAuditEvent,
  supabaseAdmin,
  SupplierResult,
  notifyAlert,
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
    await notifyAlert({
      mpn: flaggedMpn,
      urgency: analysis.urgency,
      summary: analysis.summary,
      recommendation: analysis.recommendation ?? 'hold',
    });
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

  if (!mpns.length) {
    const { data } = await supabaseAdmin.from("watchlist").select("mpn");
    mpns = (data ?? []).map((r: { mpn: string }) => r.mpn);
  }

  // Also pull from monitored_parts if watchlist is empty
  if (!mpns.length) {
    const { data } = await supabaseAdmin
      .from("monitored_parts")
      .select("mpn")
      .eq("is_active", true);
    mpns = (data ?? []).map((r: { mpn: string }) => r.mpn);
  }

  if (!mpns.length) {
    return NextResponse.json({
      success: true,
      message: "No parts to monitor. Upload a BOM first.",
      alerts: [],
    });
  }

  try {
    const fetchResults = await Promise.allSettled(
      mpns.map(async (mpn) => ({
        mpn,
        suppliers: await fetchOemSecrets(mpn),
      }))
    );

    const allSuppliers: SupplierResult[] = fetchResults
      .filter((r): r is PromiseFulfilledResult<{ mpn: string; suppliers: SupplierResult[] }> =>
        r.status === "fulfilled"
      )
      .flatMap(r => r.value.suppliers);

    const partSummaries = fetchResults
      .filter((r): r is PromiseFulfilledResult<{ mpn: string; suppliers: SupplierResult[] }> =>
        r.status === "fulfilled"
      )
      .map(r => {
        const inStock = r.value.suppliers.filter(s => s.hasPrice && s.stock > 0);
        const best = inStock[0];
        return {
          mpn: r.value.mpn,
          totalStock: inStock.reduce((sum, s) => sum + s.stock, 0),
          supplierCount: inStock.length,
          bestPrice: best?.price ?? null,
          bestLeadTime: best?.leadTime ?? null,
          status: inStock.length === 0
            ? "out_of_stock"
            : inStock.length === 1
            ? "single_source"
            : "healthy",
        };
      });

    // Claude analysis
    const analysis = await analyzeMarketData(allSuppliers);

    // ✅ Save alerts to Supabase if Claude flagged anything
    const savedAlerts: any[] = [];
    if (analysis?.alert && analysis.flaggedParts?.length) {
      for (const flaggedMpn of analysis.flaggedParts) {
        try {
          const { data: alertData } = await supabaseAdmin
            .from("alerts")
            .insert({
              mpn: flaggedMpn.toUpperCase(),
              urgency: analysis.urgency,
              summary: analysis.summary,
              recommendation: analysis.recommendation ?? null,
              flagged_by: "monitor",
              is_read: false,
              created_at: new Date().toISOString(),
            })
            .select()
            .single();

          if (alertData) savedAlerts.push(alertData);
        } catch (e: any) {
          console.error(`[Monitor] Failed to save alert for ${flaggedMpn}:`, e?.message);
        }
      }
    }

    // ✅ Also auto-alert any part with zero stock across all suppliers
    for (const part of partSummaries) {
      if (part.status === "out_of_stock") {
        // Avoid duplicate alerts — check if one exists in last 24h
        const { data: existing } = await supabaseAdmin
          .from("alerts")
          .select("id")
          .eq("mpn", part.mpn)
          .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
          .limit(1);

        if (!existing?.length) {
          await supabaseAdmin.from("alerts").insert({
            mpn: part.mpn,
            urgency: "high",
            summary: `${part.mpn} has zero stock across all suppliers.`,
            recommendation: "buy_now",
            flagged_by: "monitor",
            is_read: false,
            created_at: new Date().toISOString(),
          });
        }
      }
    }

    // Update last_checked_at
    await Promise.allSettled(
      mpns.map(mpn =>
        supabaseAdmin
          .from("watchlist")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("mpn", mpn)
      )
    );

    await logAuditEvent({
      action: "monitor_check",
      details: {
        mpnsChecked: mpns,
        alert: analysis?.alert,
        urgency: analysis?.urgency,
        recommendation: analysis?.recommendation,
        alertsSaved: savedAlerts.length,
      },
    });

    if (analysis?.alert) {
      await Promise.allSettled(
        (analysis.flaggedParts ?? []).map(mpn =>
          supabaseAdmin
            .from("watchlist")
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
      alertsSaved: savedAlerts.length,
      analysis: analysis ?? {
        alert: false,
        urgency: "none",
        summary: "All clear",
        recommendation: "hold",
        flaggedParts: [],
      },
    });

  } catch (err: any) {
    console.error("[Monitor] Error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}