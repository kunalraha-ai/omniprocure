/**
 * /api/request-po/[id]
 * ─────────────────────────────────────────────────────────────────────────────
 * GET    → current status of one HITL request
 * PATCH  → approve / reject / modify  { decision: "approved"|"rejected"|"modified", note?: string }
 *
 * On approval: Claude generates PO text → saved to po_history table
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import {
  supabaseAdmin,
  updateHitlStatus,
  generatePoText,
  logAuditEvent,
} from "@/lib/procurement";

export const maxDuration = 45;

// ── GET: status ───────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const { data, error } = await supabaseAdmin
      .from("hitl_queue").select("*").eq("id", id).single();
    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, request: data });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}

// ── PATCH: decide ─────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  const body = await req.json();
  const decision: "approved" | "rejected" | "modified" = body?.decision;
  const note: string | undefined = body?.note;

  if (!["approved", "rejected", "modified"].includes(decision)) {
    return NextResponse.json({ error: "decision must be approved, rejected, or modified" }, { status: 400 });
  }

  // Fetch the original request
  const { data: hitl, error } = await supabaseAdmin
    .from("hitl_queue").select("*").eq("id", id).single();
  if (error || !hitl) return NextResponse.json({ error: "HITL request not found" }, { status: 404 });
  if (hitl.status !== "pending") {
    return NextResponse.json({ error: `Already ${hitl.status}` }, { status: 409 });
  }

  // Update HITL queue
  await updateHitlStatus(id, decision, note);

  // Audit log
  await logAuditEvent({
    action: `hitl_${decision}`,
    supplier: hitl.supplier,
    mpn: hitl.mpn,
    unit_price: hitl.price,
    total_value: hitl.total_value,
    decision,
    details: { hitlId: id, note, action: hitl.action },
  });

  // If approved or modified → generate PO
  if (decision === "approved" || decision === "modified") {
    try {
      const poText = await generatePoText({
        supplier: hitl.supplier,
        mpn: hitl.mpn,
        price: hitl.price,
        moq: hitl.moq,
        leadTime: hitl.lead_time ?? "",
        region: hitl.region ?? "Global",
        modNote: note,
      });

      const poNumber = `PO-${Date.now().toString().slice(-8)}`;

      await supabaseAdmin.from("po_history").insert({
        po_number: poNumber,
        supplier: hitl.supplier,
        mpn: hitl.mpn,
        unit_price: hitl.price,
        moq: hitl.moq,
        total_value: hitl.total_value,
        po_text: poText,
        hitl_id: id,
        generated_at: new Date().toISOString(),
      });

      return NextResponse.json({
        success: true,
        decision,
        poNumber,
        poText,
        message: `PO ${poNumber} generated and saved.`,
      });
    } catch (err: any) {
      console.error("[RequestPO] PO generation failed:", err?.message);
      return NextResponse.json({
        success: true,
        decision,
        warning: "Decision recorded but PO generation failed. Retry via /api/request-po/[id]/generate-po",
      });
    }
  }

  // Rejected
  return NextResponse.json({ success: true, decision, message: "Request rejected and logged." });
}