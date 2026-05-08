/**
 * POST /api/bom
 * ─────────────────────────────────────────────────────────────────────────────
 * Accepts a BOM as JSON text or CSV string, parses it with Claude,
 * then searches OEM Secrets for every line item in parallel.
 * Streams results back as SSE so the UI can show progress.
 *
 * Body: { raw: string, filename?: string }
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest } from "next/server";
import {
  parseBomWithClaude,
  fetchOemSecrets,
  logAuditEvent,
  supabaseAdmin,
  sseEvent,
  BomLineItem,
  SupplierResult,
} from "@/lib/procurement";

export const maxDuration = 60;

export interface BomLineResult extends BomLineItem {
  suppliers: SupplierResult[];
  bestPrice: number | null;
  bestSupplier: string | null;
  totalInStock: number;
  status: "sourced" | "partial" | "unfound";
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const raw: string = body?.raw ?? "";
  const filename: string = body?.filename ?? "unknown";

  if (!raw.trim()) {
    return new Response("raw BOM data required", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (type: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(new TextEncoder().encode(sseEvent(type, data))); }
        catch { closed = true; }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      try {
        send("started", { message: "Parsing BOM with Claude…" });

        // 1. Parse BOM → line items
        const lineItems = await parseBomWithClaude(raw);
        if (!lineItems.length) {
          send("error", { message: "Could not extract any line items from BOM. Check format." });
          close();
          return;
        }

        send("parsed", { count: lineItems.length, items: lineItems });

        // 2. Search OEM Secrets for all line items in parallel
        send("searching", { message: `Searching ${lineItems.length} parts across 140+ distributors…` });

        const results: BomLineResult[] = [];

        await Promise.allSettled(
          lineItems.map(async (item) => {
            const suppliers = await fetchOemSecrets(item.mpn).catch(() => []);
            const inStock = suppliers.filter(s => s.hasPrice && s.stock > 0);
            const best = inStock.sort((a, b) => (a.price ?? 9999) - (b.price ?? 9999))[0];
            const result: BomLineResult = {
              ...item,
              suppliers,
              bestPrice: best?.price ?? null,
              bestSupplier: best?.supplier ?? null,
              totalInStock: inStock.reduce((sum, s) => sum + s.stock, 0),
              status: inStock.length > 0 ? "sourced" : suppliers.length > 0 ? "partial" : "unfound",
            };
            results.push(result);
            send("line_item_result", { item: result });
          })
        );

        // 3. Save to Supabase
        try {
          await supabaseAdmin.from("bom_uploads").insert({
            filename,
            line_items: results,
            item_count: results.length,
            uploaded_at: new Date().toISOString(),
          });
        } catch {}

        // 4. Audit log
        await logAuditEvent({
          action: "bom_upload",
          details: { filename, itemCount: results.length, sourcedCount: results.filter(r => r.status === "sourced").length },
        });

        // 5. Summary
        const sourced   = results.filter(r => r.status === "sourced").length;
        const partial   = results.filter(r => r.status === "partial").length;
        const unfound   = results.filter(r => r.status === "unfound").length;
        const totalCost = results.reduce((sum, r) => sum + ((r.bestPrice ?? 0) * r.qty), 0);

        send("complete", {
          totalItems: results.length, sourced, partial, unfound,
          estimatedCost: parseFloat(totalCost.toFixed(2)),
          results,
        });

      } catch (err: any) {
        console.error("[BOM] Fatal:", err?.message);
        send("error", { message: err?.message ?? "Unknown error" });
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}