/**
 * POST /api/request-po
 * ─────────────────────────────────────────────────────────────────────────────
 * Stages a PO request to the HITL queue in Supabase.
 * The UI polls /api/request-po/[id] for status.
 * On approval → generates PO text with Claude → saves to po_history.
 *
 * Body: HitlRequest payload (supplier, mpn, price, moq, etc.)
 *
 * GET /api/request-po/[id]        → get status of one request
 * GET /api/request-po             → list all pending requests
 * PATCH /api/request-po/[id]      → approve / reject / modify
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createHitlRequest,
  getPendingHitlRequests,
  getAllHitlRequests,
  logAuditEvent,
  notifyPoApproved,
  notifyPoPending,
  HitlRequest,
} from "@/lib/procurement";

export const maxDuration = 30;

// ── POST: stage new HITL request ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();

  const {
    action = "generate_po",
    supplier, mpn, price, currency = "USD",
    stock = 0, moq = 1, leadTime = "", region = "Global",
    url = "", totalValue, reason = "", aiRecommendation,
  } = body;

  if (!supplier || !mpn) {
    return NextResponse.json({ error: "supplier and mpn are required" }, { status: 400 });
  }

  await notifyPoPending({
    mpn, supplier,
    totalValue: total_value ?? price * moq,
    hitlId: id,
    aiRecommendation,
  });
  const id = `hitl-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const computedTotal = totalValue ?? ((price ?? 0) * moq);

  const hitlReq: Omit<HitlRequest, "createdAt" | "status"> = {
    id, action, supplier, mpn, price, currency, stock, moq,
    leadTime, region, url,
    totalValue: computedTotal,
    reason, aiRecommendation,
  };

  await createHitlRequest(hitlReq);

  // Audit: request staged
  await logAuditEvent({
    action: `hitl_staged_${action}`,
    supplier, mpn,
    unit_price: price,
    total_value: computedTotal,
    decision: "pending",
    details: { hitlId: id, aiRecommendation },
  });

  return NextResponse.json({
    success: true,
    id,
    status: "pending",
    message: "PO request staged for human approval. Poll /api/request-po/${id} for status.",
  });
}

// ── GET: list requests ────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pendingOnly = searchParams.get("pending") === "true";

  const requests = pendingOnly
    ? await getPendingHitlRequests()
    : await getAllHitlRequests();

  return NextResponse.json({ success: true, requests, count: requests.length });
}