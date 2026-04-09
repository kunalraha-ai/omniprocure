import { NextRequest } from "next/server";

export const maxDuration = 120;

interface SupplierResult {
  name: string; price: number; currency: string;
  stock: number; leadTime: string; url: string; recommended?: boolean;
}

async function runTinyfishAgent(url: string, goal: string): Promise<string> {
  const apiKey = process.env.TINYFISH_API_KEY!;
  const res = await fetch("https://agent.tinyfish.ai/v1/automation/run-sse", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
    body: JSON.stringify({ url, goal, proxy_config: { enabled: false } }),
  });
  if (!res.ok) throw new Error(`Tinyfish HTTP ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let lastResult = "", buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n"); buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      try {
        const parsed = JSON.parse(raw);
        if (parsed.result !== undefined && parsed.result !== null)
          lastResult = typeof parsed.result === "string" ? parsed.result : JSON.stringify(parsed.result);
        if (parsed.output !== undefined)
          lastResult = typeof parsed.output === "string" ? parsed.output : JSON.stringify(parsed.output);
        if (parsed.status === "FAILED" || parsed.type === "ERROR") throw new Error("Tinyfish agent failed");
      } catch { if (raw.length > 5) lastResult = raw; }
    }
  }
  return lastResult;
}

async function scrapeSupplier(supplierName: string, supplierUrl: string, partNumber: string): Promise<SupplierResult | null> {
  const goal = `Find part number "${partNumber}" on this page. Return ONLY this JSON:\n{"found":true,"price":<number>,"stock":<number>,"leadTime":"<string>","currency":"USD"}\nIf not found: {"found":false}`;
  try {
    const raw = await runTinyfishAgent(supplierUrl, goal);
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) return null;
    const data = JSON.parse(jsonMatch[0]);
    if (!data.found || data.price == null) return null;
    return {
      name: supplierName,
      price: parseFloat(String(data.price).replace(/[^0-9.]/g, "")),
      currency: data.currency ?? "USD",
      stock: parseInt(String(data.stock ?? "0").replace(/[^0-9]/g, "")) || 0,
      leadTime: data.leadTime ?? "Contact supplier",
      url: supplierUrl,
    };
  } catch { return null; }
}

async function analyzeWithClaude(partNumber: string, suppliers: SupplierResult[]): Promise<{ winner: string; reason: string; recommendedIndex: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const fallback = () => { const b = suppliers.reduce((bi, s, i) => s.price < suppliers[bi].price ? i : bi, 0); return { winner: suppliers[b].name, reason: `${suppliers[b].name} offers the best value.`, recommendedIndex: b }; };
  if (!apiKey) return fallback();
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 256, messages: [{ role: "user", content: `Analyze supplier quotes for "${partNumber}". Data:\n${JSON.stringify(suppliers)}\nScoring: price 60%, stock 30%, lead time 10%.\nRespond ONLY JSON: {"winner":"<n>","recommendedIndex":<num>,"reason":"<120 chars>"}` }] }),
    });
    if (!r.ok) throw new Error();
    const d = await r.json();
    const text = d?.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error();
    const p = JSON.parse(m[0]);
    return { winner: p.winner ?? suppliers[0].name, reason: p.reason ?? "Best overall value.", recommendedIndex: typeof p.recommendedIndex === "number" ? p.recommendedIndex : 0 };
  } catch { return fallback(); }
}

async function claudeAsk(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return "[]";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 512, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return "[]";
    const d = await r.json();
    return d?.content?.[0]?.text ?? "[]";
  } catch { return "[]"; }
}

function sseEvent(type: string, data: unknown): string {
  return `data: ${JSON.stringify({ type, ...(typeof data === "object" && data !== null ? data : { payload: data }) })}\n\n`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const partNumber = body?.partNumber?.trim();
  if (!partNumber) return new Response("partNumber required", { status: 400 });

  const SUPPLIERS = [
    { name: "Mouser Electronics", url: `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(partNumber)}` },
    { name: "DigiKey", url: `https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(partNumber)}` },
    { name: "LCSC", url: `https://www.lcsc.com/search?q=${encodeURIComponent(partNumber)}` },
  ];

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (type: string, data: unknown) => {
        if (closed) return;
        try { controller.enqueue(new TextEncoder().encode(sseEvent(type, data))); }
        catch { closed = true; }
      };
      const safeClose = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      try {
        // Immediately announce all 3 so UI can show skeleton cards
        for (const s of SUPPLIERS) send("supplier_searching", { name: s.name, url: s.url });

        const found: SupplierResult[] = [];
        const notFound: string[] = [];

        await Promise.all(SUPPLIERS.map(async (s) => {
          try {
            const result = await scrapeSupplier(s.name, s.url, partNumber);
            if (result) { found.push(result); send("supplier_found", { supplier: result }); }
            else { notFound.push(s.name); send("supplier_not_found", { name: s.name, url: s.url }); }
          } catch { notFound.push(s.name); send("supplier_not_found", { name: s.name, url: s.url }); }
        }));

        if (found.length === 0) {
          send("analyzing", { message: "Asking Claude for alternative SKUs..." });
          const text = await claudeAsk(`An engineer searched for "${partNumber}" on Mouser, DigiKey, and LCSC but found nothing. This may be a marketing name (e.g. "RP2040" should be "SC0914") or partial MPN. Suggest up to 3 correct distributor MPNs.\n\nRespond ONLY with valid JSON array:\n[{"mpn":"<exact MPN>","description":"<why correct>"}]\n\nIf unsure: []`);
          const m = text.match(/\[[\s\S]*\]/);
          const aliases = m ? JSON.parse(m[0]) : [];
          send("not_found", { partNumber, aliases });
          safeClose(); return;
        }

        send("analyzing", { message: "Claude AI is comparing suppliers..." });

        // Run Claude analysis + alternatives in parallel
        const altPromises = [
          ...notFound.map(name => claudeAsk(`The electronic component "${partNumber}" is not listed at ${name}. Suggest up to 2 drop-in alternative or substitute components.\n\nRespond ONLY JSON array: [{"mpn":"<MPN>","description":"<why suitable>"}]\n\nIf unsure: []`).then(t => { const m = t.match(/\[[\s\S]*\]/); return { name, alts: m ? JSON.parse(m[0]) : [] }; })),
          ...found.filter(s => s.stock === 0).map(s => claudeAsk(`The electronic component "${partNumber}" is out of stock at ${s.name}. Suggest up to 2 drop-in alternatives.\n\nRespond ONLY JSON array: [{"mpn":"<MPN>","description":"<why suitable>"}]\n\nIf unsure: []`).then(t => { const m = t.match(/\[[\s\S]*\]/); return { name: s.name, alts: m ? JSON.parse(m[0]) : [] }; })),
        ];

        const [analysis, ...altResults] = await Promise.all([
          found.length === 1
            ? Promise.resolve({ winner: found[0].name, reason: `Only ${found[0].name} has this part.`, recommendedIndex: 0 })
            : analyzeWithClaude(partNumber, found),
          ...altPromises,
        ]);

        for (const r of altResults as { name: string; alts: any[] }[]) {
          if (r.alts.length > 0) send("alternatives", { forSupplier: r.name, alternatives: r.alts });
        }

        const tagged = found.map((s, i) => ({ ...s, recommended: i === (analysis as any).recommendedIndex }));
        send("complete", { partNumber, suppliers: tagged, recommendation: { winner: (analysis as any).winner, reason: (analysis as any).reason } });
      } catch (err) {
        send("error", { message: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" },
  });
}