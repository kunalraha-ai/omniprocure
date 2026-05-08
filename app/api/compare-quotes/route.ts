/**
 * POST /api/compare-quotes
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts a list of supplier quotes for one MPN, asks Claude to rank them,
 * assigns a risk flag, and logs to audit trail.
 *
 * Body: { mpn: string, suppliers: SupplierResult[] }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import {
  rankWithClaude,
  logAuditEvent,
  SupplierResult,
  ClaudeRanking,
} from "@/lib/procurement";

export const maxDuration = 30;

interface CompareQuotesResponse {
  mpn: string;
  ranking: ClaudeRanking;
  riskFlag: "none" | "low" | "medium" | "high";
  riskReason: string;
  rankedAt: string;
}

function assessRisk(ranking: ClaudeRanking, suppliers: SupplierResult[]): { riskFlag: "none" | "low" | "medium" | "high"; riskReason: string } {
  const winner = suppliers[ranking.recommendedIndex];
  if (!winner) return { riskFlag: "high", riskReason: "Could not identify winning supplier" };

  const inStock = suppliers.filter(s => s.hasPrice && s.stock > 0);
  const singleSource = inStock.length === 1;
  const lowStock = winner.stock < 50;
  const longLead = winner.leadTime?.toLowerCase().includes("week") &&
    parseInt(winner.leadTime) > 8;
  const suspectPrice = winner.price !== null && winner.price < 0.001;

  if (singleSource && lowStock) return { riskFlag: "high", riskReason: "Single source with low stock — supply chain risk" };
  if (singleSource) return { riskFlag: "medium", riskReason: "Only one supplier with price and stock" };
  if (lowStock) return { riskFlag: "medium", riskReason: `Low stock at winner (${winner.stock} units)` };
  if (longLead) return { riskFlag: "low", riskReason: "Lead time exceeds 8 weeks" };
  if (suspectPrice) return { riskFlag: "low", riskReason: "Price seems unusually low — verify before ordering" };
  if (inStock.length >= 3) return { riskFlag: "none", riskReason: "Multiple stocked sources — good supply" };
  return { riskFlag: "none", riskReason: "Adequate supply available" };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mpn: string = body?.mpn?.trim();
  const suppliers: SupplierResult[] = body?.suppliers ?? [];

  if (!mpn) return NextResponse.json({ error: "mpn required" }, { status: 400 });
  if (!suppliers.length) return NextResponse.json({ error: "suppliers array required" }, { status: 400 });

  try {
    const ranking = await rankWithClaude(mpn, suppliers);
    const { riskFlag, riskReason } = assessRisk(ranking, suppliers);

    const response: CompareQuotesResponse = {
      mpn,
      ranking,
      riskFlag,
      riskReason,
      rankedAt: new Date().toISOString(),
    };

    // Audit log
    await logAuditEvent({
      action: "compare_quotes",
      mpn,
      supplier: ranking.winner,
      details: { riskFlag, riskReason, supplierCount: suppliers.length, reason: ranking.reason },
    });

    return NextResponse.json({ success: true, ...response });
  } catch (err: any) {
    console.error("[CompareQuotes] Error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}