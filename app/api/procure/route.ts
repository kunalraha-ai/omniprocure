import { NextRequest, NextResponse } from "next/server";

// ── Increase Next.js route timeout to 120s ─────────────────────────────────────
export const maxDuration = 120;

// ── Types ──────────────────────────────────────────────────────────────────────
interface SupplierResult {
  name: string;
  price: number;
  currency: string;
  stock: number;
  leadTime: string;
  url: string;
  recommended?: boolean;
}

// ── Read Tinyfish SSE stream properly ─────────────────────────────────────────
async function runTinyfishAgent(url: string, goal: string): Promise<string> {
  const apiKey = process.env.TINYFISH_API_KEY!;

  console.log(`[Tinyfish] Starting agent for: ${url}`);

  const res = await fetch("https://agent.tinyfish.ai/v1/automation/run-sse", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      url,
      goal,
      proxy_config: { enabled: false },
    }),
    // No AbortSignal here — let Next.js maxDuration handle it
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tinyfish HTTP ${res.status}: ${errText}`);
  }

  // Read SSE stream chunk by chunk
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let lastResult = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep incomplete last line

    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const raw = line.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;

      try {
        const parsed = JSON.parse(raw);
        console.log(`[Tinyfish] Event type:`, parsed.type ?? parsed.status ?? "unknown");

        // Capture result from COMPLETE or final events
        if (parsed.result !== undefined && parsed.result !== null) {
          lastResult = typeof parsed.result === "string"
            ? parsed.result
            : JSON.stringify(parsed.result);
        }

        // Some versions send output directly
        if (parsed.output !== undefined) {
          lastResult = typeof parsed.output === "string"
            ? parsed.output
            : JSON.stringify(parsed.output);
        }

        // Check for failure
        if (parsed.status === "FAILED" || parsed.type === "ERROR") {
          throw new Error(`Tinyfish agent failed: ${parsed.message ?? "unknown"}`);
        }
      } catch (parseErr) {
        // Not JSON — might be plain text result
        if (raw.length > 5) lastResult = raw;
      }
    }
  }

  console.log(`[Tinyfish] Final result length: ${lastResult.length}`);
  return lastResult;
}

// ── Scrape one supplier ────────────────────────────────────────────────────────
async function scrapeSupplier(
  supplierName: string,
  supplierUrl: string,
  partNumber: string
): Promise<SupplierResult | null> {
  const goal = `Find part number "${partNumber}" on this page. Extract the unit price and stock quantity. Return ONLY this JSON:
{"found":true,"price":<number>,"stock":<number>,"leadTime":"<string>","currency":"USD"}
If part not found, return: {"found":false}`;

  try {
    const raw = await runTinyfishAgent(supplierUrl, goal);
    console.log(`[OmniProcure] ${supplierName} raw response:`, raw.slice(0, 500));

    if (!raw) {
      console.warn(`[OmniProcure] ${supplierName}: empty response`);
      return null;
    }

    // Extract JSON from response (handles cases where there's surrounding text)
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      console.warn(`[OmniProcure] ${supplierName}: no JSON in response`);
      return null;
    }

    const data = JSON.parse(jsonMatch[0]);

    if (!data.found || data.price == null) {
      console.log(`[OmniProcure] ${supplierName}: part not found`);
      return null;
    }

    return {
      name: supplierName,
      price: parseFloat(String(data.price).replace(/[^0-9.]/g, "")),
      currency: data.currency ?? "USD",
      stock: parseInt(String(data.stock ?? "0").replace(/[^0-9]/g, "")) || 0,
      leadTime: data.leadTime ?? "Contact supplier",
      url: supplierUrl,
    };
  } catch (err) {
    console.error(`[OmniProcure] ${supplierName} error:`, err);
    return null;
  }
}

// ── Claude 3.5 Sonnet analysis ─────────────────────────────────────────────────
async function analyzeWithClaude(
  partNumber: string,
  suppliers: SupplierResult[]
): Promise<{ winner: string; reason: string; recommendedIndex: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Rule-based fallback
  const fallback = () => {
    const bestIdx = suppliers.reduce((bi, s, i) => s.price < suppliers[bi].price ? i : bi, 0);
    return {
      winner: suppliers[bestIdx].name,
      reason: `${suppliers[bestIdx].name} offers the lowest unit price at $${suppliers[bestIdx].price.toFixed(3)}.`,
      recommendedIndex: bestIdx,
    };
  };

  if (!apiKey) return fallback();

  const prompt = `You are a senior procurement analyst. Analyze these real-time supplier quotes for electronic component "${partNumber}" and select the best supplier.

Data:
${JSON.stringify(suppliers, null, 2)}

Scoring weights: price 60%, stock availability 30%, lead time 10%.

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "winner": "<exact supplier name>",
  "recommendedIndex": <0 or 1>,
  "reason": "<one sentence under 120 chars>"
}`;

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) throw new Error(`Claude ${claudeRes.status}`);

    const claudeData = await claudeRes.json();
    const text = claudeData?.content?.[0]?.text ?? "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in Claude response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      winner: parsed.winner ?? suppliers[0].name,
      reason: parsed.reason ?? "Best overall value.",
      recommendedIndex: typeof parsed.recommendedIndex === "number" ? parsed.recommendedIndex : 0,
    };
  } catch (err) {
    console.error("[OmniProcure] Claude error:", err);
    return fallback();
  }
}

// ── POST handler ───────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const partNumber = body?.partNumber?.trim();

    if (!partNumber) {
      return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
    }

    console.log(`\n[OmniProcure] ═══ Searching: ${partNumber} ═══`);

    // Scrape both suppliers in parallel using direct search URLs
    const [mouserResult, digikeyResult] = await Promise.all([
      scrapeSupplier(
        "Mouser Electronics",
        `https://www.mouser.com/Search/Refine?Keyword=${encodeURIComponent(partNumber)}`,
        partNumber
      ),
      scrapeSupplier(
        "DigiKey",
        `https://www.digikey.com/en/products/result?keywords=${encodeURIComponent(partNumber)}`,
        partNumber
      ),
    ]);

    const validSuppliers = [mouserResult, digikeyResult].filter(Boolean) as SupplierResult[];

    // Neither found — return not found
    if (validSuppliers.length === 0) {
      console.log(`[OmniProcure] ✗ Not found on either supplier`);
      return NextResponse.json({ notFound: true, partNumber });
    }

    // Only one found
    if (validSuppliers.length === 1) {
      const only = { ...validSuppliers[0], recommended: true };
      return NextResponse.json({
        partNumber,
        suppliers: [only],
        recommendation: {
          winner: only.name,
          reason: `Only ${only.name} currently has this part in stock.`,
        },
      });
    }

    // Both found — Claude picks the winner
    const analysis = await analyzeWithClaude(partNumber, validSuppliers);
    const taggedSuppliers = validSuppliers.map((s, i) => ({
      ...s,
      recommended: i === analysis.recommendedIndex,
    }));

    console.log(`[OmniProcure] ✓ Winner: ${analysis.winner}`);

    return NextResponse.json({
      partNumber,
      suppliers: taggedSuppliers,
      recommendation: {
        winner: analysis.winner,
        reason: analysis.reason,
      },
    });
  } catch (err: unknown) {
    console.error("[OmniProcure] Fatal:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}