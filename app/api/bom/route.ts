/**
 * POST /api/bom
 */

import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  parseBomWithClaude,
  fetchOemSecrets,
  logAuditEvent,
  supabaseAdmin,
  sseEvent,
  BomLineItem,
  SupplierResult,
} from "@/lib/procurement";
import { flushLangfuse, getLangfuseClient } from "@/lib/langfuse";

export const maxDuration = 60;

export interface BomLineResult extends BomLineItem {
  suppliers: SupplierResult[];
  bestPrice: number | null;
  bestSupplier: string | null;
  totalInStock: number;
  status: "sourced" | "partial" | "unfound";
}

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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const raw: string = body?.raw ?? "";
  const filename: string = body?.filename ?? "unknown";

  if (!raw.trim()) {
    return new Response("raw BOM data required", { status: 400 });
  }

  // Get user early before stream starts
  const userId = await getUserId(req);

  const stream = new ReadableStream({
    async start(controller) {
      const results: BomLineResult[] = [];
      let trace: any = null;
      try {
        const lf = getLangfuseClient();
        trace = lf?.trace({
          name: "bom-upload",
          userId: userId ?? undefined,
          input: { filename, rawLength: raw.length },
          metadata: { filename },
        });
      } catch {}
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

        let parseSpan: any = null;
        try {
          parseSpan = trace?.span({ name: "parse-bom", input: { rawLength: raw.length } });
        } catch {}
        const lineItems = await parseBomWithClaude(raw, userId ?? undefined);
        try {
          parseSpan?.end({ output: { itemCount: lineItems.length } });
        } catch {}
        if (!lineItems.length) {
          send("error", { message: "Could not extract any line items from BOM. Check format." });
          close();
          return;
        }

        send("parsed", { count: lineItems.length, items: lineItems });
        send("searching", { message: `Searching ${lineItems.length} parts across 140+ distributors…` });

        let sourceSpan: any = null;
        try {
          sourceSpan = trace?.span({ name: "source-parts", input: { partCount: lineItems.length } });
        } catch {}

        await Promise.allSettled(
          lineItems.map(async (item) => {
            const suppliers = await fetchOemSecrets(item.mpn, "bom").catch(() => []);
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

            send("line_item_result", {
              item: {
                mpn: result.mpn,
                part_name: result.description,
                qty: result.qty,
                best_supplier: result.bestSupplier,
                price: result.bestPrice,
                lead_time: best?.leadTime ?? "—",
                stock_status: inStock.length > 0
                  ? (best?.stock ?? 0) < 100 ? "Low Stock" : "In Stock"
                  : "Out of Stock",
                status: result.status,
              },
            });
          })
        );

        try {
          sourceSpan?.end({
            output: {
              sourced: results.filter(r => r.status === "sourced").length,
              partial: results.filter(r => r.status === "partial").length,
              unfound: results.filter(r => r.status === "unfound").length,
            },
          });
        } catch {}

        // Save to Supabase — stamp user_id on every row
        try {
          await supabaseAdmin.from("bom_uploads").insert({
            filename,
            line_items: results,
            item_count: results.length,
            uploaded_at: new Date().toISOString(),
            ...(userId ? { user_id: userId } : {}),
          });

          const monitoredPayload = results
            .filter(r => r.status === 'sourced' || r.status === 'partial')
            .map(r => ({
              mpn: r.mpn,
              part_name: r.description,
              quantity: r.qty,
              is_active: true,
              ...(userId ? { user_id: userId } : {}),
            }));

          if (monitoredPayload.length > 0) {
            const { error: upsertError } = await supabaseAdmin
              .from('monitored_parts')
              .upsert(monitoredPayload, {
                onConflict: userId ? 'mpn,user_id' : 'mpn',
              });
            if (upsertError) console.error('[BOM] monitored_parts upsert failed:', upsertError);
            else console.log('[BOM] monitored_parts saved:', monitoredPayload.length);
          }
        } catch (e: any) {
          console.error('[BOM] Supabase save failed:', e?.message);
        }

        await logAuditEvent({
          action: "bom_upload",
          details: {
            filename,
            itemCount: results.length,
            sourcedCount: results.filter(r => r.status === "sourced").length,
            userId,
          },
        });

        const sourced   = results.filter(r => r.status === "sourced").length;
        const partial   = results.filter(r => r.status === "partial").length;
        const unfound   = results.filter(r => r.status === "unfound").length;
        const totalCost = results.reduce((sum, r) => sum + ((r.bestPrice ?? 0) * r.qty), 0);

        send("complete", {
          totalItems: results.length, sourced, partial, unfound,
          estimatedCost: parseFloat(totalCost.toFixed(2)),
        });

      } catch (err: any) {
        console.error("[BOM] Fatal:", err?.message);
        send("error", { message: err?.message ?? "Unknown error" });
      } finally {
        try {
          trace?.update({ output: { totalItems: results.length } });
        } catch {}
        await flushLangfuse();
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}