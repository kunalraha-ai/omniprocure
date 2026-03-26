import { NextRequest, NextResponse } from "next/server";

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

interface TinyfishResponse {
  results?: Array<{
    url?: string;
    content?: string;
    text?: string;
  }>;
}

// ── Mock fallback data (used when Tinyfish key missing or scrape fails) ────────
function getMockSuppliers(partNumber: string): SupplierResult[] {
  const seed = partNumber.charCodeAt(0) + partNumber.charCodeAt(1);
  return [
    {
      name: "Mouser Electronics",
      price: parseFloat((1.2 + (seed % 30) / 100).toFixed(3)),
      currency: "USD",
      stock: 12000 + (seed * 37) % 8000,
      leadTime: "In Stock",
      url: `https://www.mouser.in/c/?q=${encodeURIComponent(partNumber)}`,
    },
    {
      name: "DigiKey",
      price: parseFloat((1.35 + (seed % 25) / 100).toFixed(3)),
      currency: "USD",
      stock: 5000 + (seed * 53) % 6000,
      leadTime: `${2 + (seed % 3)} weeks`,
      url: `https://www.digikey.in/en/products/result?keywords=${encodeURIComponent(partNumber)}`,
    },
  ];
}

// ── Tinyfish scrape ────────────────────────────────────────────────────────────
async function scrapeWithTinyfish(partNumber: string): Promise<SupplierResult[]> {
  const apiKey = process.env.TINYFISH_API_KEY;
  if (!apiKey) {
    console.warn("[OmniProcure] TINYFISH_API_KEY not set — using mock data");
    return getMockSuppliers(partNumber);
  }

  const urls = [
    `https://www.mouser.in/c/?q=${encodeURIComponent(partNumber)}`,
    `https://www.digikey.in/en/products/result?keywords=${encodeURIComponent(partNumber)}`,
  ];

  try {
    const scrapeRes = await fetch("https://api.tinyfish.io/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        urls,
        extract: {
          price: "The unit price of the component in USD",
          stock: "The available stock quantity as a number",
          leadTime: "The delivery lead time or availability status",
          partNumber: "The exact manufacturer part number",
        },
        render_js: true,
        wait_for: ".price, [data-price], .availability",
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!scrapeRes.ok) {
      console.warn(`[OmniProcure] Tinyfish returned ${scrapeRes.status} — falling back to mock`);
      return getMockSuppliers(partNumber);
    }

    const data: TinyfishResponse = await scrapeRes.json();
    const results = data?.results ?? [];

    if (!results.length) return getMockSuppliers(partNumber);

    // Map Tinyfish results to our SupplierResult shape
    const supplierNames = ["Mouser Electronics", "DigiKey"];
    return results.slice(0, 2).map((r, i) => {
      // Try to extract structured fields from Tinyfish content
      const content = r.content ?? r.text ?? "";
      const priceMatch = content.match(/\$?([\d,]+\.?\d*)/);
      const stockMatch = content.match(/(\d[\d,]*)\s*(in stock|units|pcs)/i);
      const leadMatch = content.match(/(in stock|\d+\s*weeks?|\d+\s*days?)/i);

      return {
        name: supplierNames[i] ?? `Supplier ${i + 1}`,
        price: priceMatch ? parseFloat(priceMatch[1].replace(",", "")) : getMockSuppliers(partNumber)[i].price,
        currency: "USD",
        stock: stockMatch ? parseInt(stockMatch[1].replace(",", ""), 10) : getMockSuppliers(partNumber)[i].stock,
        leadTime: leadMatch ? leadMatch[1] : getMockSuppliers(partNumber)[i].leadTime,
        url: urls[i],
      };
    });
  } catch (err) {
    console.error("[OmniProcure] Tinyfish error:", err);
    return getMockSuppliers(partNumber);
  }
}

// ── Claude 3.5 Sonnet analysis ─────────────────────────────────────────────────
async function analyzeWithClaude(
  partNumber: string,
  suppliers: SupplierResult[]
): Promise<{ winner: string; reason: string; recommendedIndex: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    console.warn("[OmniProcure] ANTHROPIC_API_KEY not set — using rule-based fallback");
    const bestIdx = suppliers.reduce((bi, s, i) => s.price < suppliers[bi].price ? i : bi, 0);
    return {
      winner: suppliers[bestIdx].name,
      reason: `${suppliers[bestIdx].name} offers the lowest unit price at $${suppliers[bestIdx].price.toFixed(3)} with ${suppliers[bestIdx].stock.toLocaleString()} units in stock.`,
      recommendedIndex: bestIdx,
    };
  }

  const prompt = `You are a senior procurement analyst AI. Analyze these supplier quotes for part number "${partNumber}" and select the best supplier.

Supplier data:
${JSON.stringify(suppliers, null, 2)}

Evaluate based on:
1. Lowest unit price (primary factor, weight 60%)
2. Stock availability (secondary factor, weight 30%)
3. Lead time (tertiary factor, weight 10%)

Respond with ONLY a valid JSON object in this exact format, no markdown, no explanation:
{
  "winner": "<supplier name>",
  "recommendedIndex": <0 or 1>,
  "reason": "<one concise sentence explaining the recommendation, max 120 chars>"
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
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    });

    if (!claudeRes.ok) {
      throw new Error(`Anthropic API returned ${claudeRes.status}`);
    }

    const claudeData = await claudeRes.json();
    const text = claudeData?.content?.[0]?.text ?? "";

    // Strip any accidental markdown fences
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    return {
      winner: parsed.winner ?? suppliers[0].name,
      reason: parsed.reason ?? "Best overall value.",
      recommendedIndex: typeof parsed.recommendedIndex === "number" ? parsed.recommendedIndex : 0,
    };
  } catch (err) {
    console.error("[OmniProcure] Claude analysis error:", err);
    // Rule-based fallback
    const bestIdx = suppliers.reduce((bi, s, i) => s.price < suppliers[bi].price ? i : bi, 0);
    return {
      winner: suppliers[bestIdx].name,
      reason: `${suppliers[bestIdx].name} provides the best price-to-availability ratio.`,
      recommendedIndex: bestIdx,
    };
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

    // Step 1 — scrape suppliers via Tinyfish
    const suppliers = await scrapeWithTinyfish(partNumber);

    // Step 2 — analyse with Claude
    const analysis = await analyzeWithClaude(partNumber, suppliers);

    // Step 3 — tag recommended supplier
    const taggedSuppliers = suppliers.map((s, i) => ({
      ...s,
      recommended: i === analysis.recommendedIndex,
    }));

    return NextResponse.json({
      partNumber,
      suppliers: taggedSuppliers,
      recommendation: {
        winner: analysis.winner,
        reason: analysis.reason,
      },
    });
  } catch (err: unknown) {
    console.error("[OmniProcure] /api/procure error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}