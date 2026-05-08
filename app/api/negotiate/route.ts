/**
 * POST /api/negotiate
 * ─────────────────────────────────────────────────────────────────────────────
 * Two modes:
 *   1. { mode: "parse",     emailText, from, subject }
 *      → Claude extracts quote data + decides if negotiation needed
 *
 *   2. { mode: "draft",     supplier, mpn, unitPrice, currency, moq, negotiationReason }
 *      → Claude drafts a counter-offer email body
 *      → Stages a HITL request before the email is sent
 *
 *   3. { mode: "send",      hitlId }
 *      → Checks HITL approval status, if approved returns draft for sending
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import {
  analyzeQuoteEmail,
  draftCounterOffer,
  createHitlRequest,
  logAuditEvent,
  supabaseAdmin,
} from "@/lib/procurement";

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const mode: "parse" | "draft" | "send" = body?.mode ?? "parse";

  // ── Mode 1: Parse incoming quote email ──────────────────────────────────────
  if (mode === "parse") {
    const { emailText, from, subject } = body;
    if (!emailText) return NextResponse.json({ error: "emailText required" }, { status: 400 });

    try {
      const quote = await analyzeQuoteEmail(emailText, from ?? "", subject ?? "");
      if (!quote) return NextResponse.json({ error: "Claude could not parse quote" }, { status: 422 });

      // Log receipt
      await logAuditEvent({
        action: "quote_received",
        supplier: quote.supplier,
        mpn: quote.mpn,
        unit_price: quote.unitPrice,
        details: {
          currency: quote.currency, moq: quote.moq, leadTime: quote.leadTime,
          validUntil: quote.validUntil, shouldNegotiate: quote.shouldNegotiate,
          negotiationReason: quote.negotiationReason, from, subject,
        },
      });

      return NextResponse.json({ success: true, mode: "parse", quote });

    } catch (err: any) {
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }
  }

  // ── Mode 2: Draft counter-offer + stage HITL ─────────────────────────────────
  if (mode === "draft") {
    const { supplier, mpn, unitPrice, currency = "USD", moq = 1, negotiationReason } = body;
    if (!supplier || !mpn) return NextResponse.json({ error: "supplier and mpn required" }, { status: 400 });

    try {
      // Draft the counter-offer email
      const draft = await draftCounterOffer(supplier, mpn, unitPrice, currency, moq, negotiationReason ?? "Better pricing requested");

      // Stage HITL approval before sending
      const id = `hitl-neg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await createHitlRequest({
        id,
        action: "negotiate_quote",
        supplier, mpn,
        price: unitPrice,
        currency,
        stock: 0,
        moq,
        leadTime: body.leadTime ?? "",
        region: body.region ?? "Global",
        url: body.url ?? "",
        totalValue: unitPrice * moq,
        reason: negotiationReason ?? "Better pricing requested",
        aiRecommendation: `Counter-offer drafted. Awaiting approval to send to ${supplier}.`,
      });

      await logAuditEvent({
        action: "negotiate_draft_created",
        supplier, mpn,
        unit_price: unitPrice,
        details: { hitlId: id, negotiationReason },
      });

      return NextResponse.json({
        success: true,
        mode: "draft",
        hitlId: id,
        draft,
        message: "Counter-offer drafted. Approve via /api/request-po/[id] before sending.",
      });

    } catch (err: any) {
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }
  }

  // ── Mode 3: Check approval and return draft for sending ──────────────────────
  if (mode === "send") {
    const { hitlId } = body;
    if (!hitlId) return NextResponse.json({ error: "hitlId required" }, { status: 400 });

    try {
      const { data: hitl } = await supabaseAdmin
        .from("hitl_queue").select("*").eq("id", hitlId).single();

      if (!hitl) return NextResponse.json({ error: "HITL request not found" }, { status: 404 });
      if (hitl.status === "pending") return NextResponse.json({ success: false, status: "pending", message: "Awaiting approval" });
      if (hitl.status === "rejected") return NextResponse.json({ success: false, status: "rejected", message: "Negotiation rejected by approver" });

      // Approved or modified — re-draft with any modification note
      const draft = await draftCounterOffer(
        hitl.supplier, hitl.mpn, hitl.price, hitl.currency,
        hitl.moq, hitl.reason ?? "Better pricing requested"
      );

      await logAuditEvent({
        action: "negotiate_quote_sent",
        supplier: hitl.supplier,
        mpn: hitl.mpn,
        unit_price: hitl.price,
        decision: hitl.status,
        details: { hitlId, modifiedNote: hitl.modified_note },
      });

      return NextResponse.json({
        success: true,
        status: hitl.status,
        supplier: hitl.supplier,
        draft,
        modifiedNote: hitl.modified_note ?? null,
        message: `Approved. Send this email to your supplier contact for ${hitl.mpn}.`,
      });

    } catch (err: any) {
      return NextResponse.json({ error: err?.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Invalid mode. Use parse | draft | send" }, { status: 400 });
}