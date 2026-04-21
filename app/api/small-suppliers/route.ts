import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface SupplierResult {
  supplier: string;
  tier: "standard" | "chinese";
  mpn: string;
  price: number | null;
  currency: string;
  stock: number;
  leadTime: string;
  url: string;
  moq: number;
  reason: string;
}

interface ClaudeRanking {
  winner: string;
  reason: string;
  recommendedIndex: number;
}

interface CacheRow {
  results: SupplierResult[];
  claude_recommendation: ClaudeRanking | null;
  updated_at: string;
  hit_count: number;
}

// ── Supplier config ───────────────────────────────────────────────────────────
//
//  LCSC     ✅ PROVEN  — lcsc.com. Static HTML. USD. Fast.
//  UTSource ✅ PROVEN  — utsource.net. Chinese. Zero bot protection. USD. (slice from char 8000)
//  Alibaba  ✅ PROVEN  — alibaba.com. Chinese marketplace. USD.
//
const SUPPLIERS: Array<{
  name: string;
  tier: "standard" | "chinese";
  searchQuery: (mpn: string) => string;
  urlMustContain: string;
  fetchTimeoutMs: number;
  contentSliceStart?: number;
}> = [
  {
    name: "LCSC",
    tier: "standard",
    searchQuery: (mpn) => `${mpn} site:lcsc.com/product-detail`,
    urlMustContain: "lcsc.com/product-detail",
    fetchTimeoutMs: 295000,
  },
  {
    name: "UTSource",
    tier: "chinese",
    searchQuery: (mpn) => `${mpn} site:utsource.net/itm/p`,
    urlMustContain: "utsource.net/itm/p",
    fetchTimeoutMs: 295000,
    contentSliceStart: 8000,
  },
  {
    name: "Alibaba",
    tier: "chinese",
    searchQuery: (mpn) => `"${mpn}" electronic component site:alibaba.com/product-detail`,
    urlMustContain: "alibaba.com/product-detail",
    fetchTimeoutMs: 295000,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeMpn(mpn: string): string {
  return mpn.toUpperCase().replace(/[\s\-_.]/g, "");
}

function sseEvent(type: string, data: unknown): string {
  return `data: ${JSON.stringify({
    type,
    ...(typeof data === "object" && data !== null ? data : { payload: data }),
  })}\n\n`;
}

// ── TinyFish Search API ───────────────────────────────────────────────────────
async function searchForUrl(
  label: string,
  query: string,
  urlMustContain: string
): Promise<string | null> {
  const apiKey = process.env.TINYFISH_API_KEY!;
  console.log(`[Search:${label}] "${query}"`);
  try {
    const res = await fetch(
      `https://api.search.tinyfish.ai?query=${encodeURIComponent(query)}&location=US&language=en`,
      { headers: { "X-API-Key": apiKey }, signal: AbortSignal.timeout(10000) }
    );
    console.log(`[Search:${label}] HTTP ${res.status}`);
    if (!res.ok) return null;
    const data = await res.json();
    const results: Array<{ url: string }> = data.results ?? [];
    console.log(`[Search:${label}] ${results.length} results`);
    results.slice(0, 5).forEach((r, i) => console.log(`  [${i}] ${r.url}`));
    const match = results.find((r) => r.url.includes(urlMustContain));
    console.log(`[Search:${label}] ${match ? `✅ ${match.url}` : "❌ No match"}`);
    return match?.url ?? null;
  } catch (err: any) {
    console.log(`[Search:${label}] ❌ ${err?.message}`);
    return null;
  }
}

// ── TinyFish Fetch API ────────────────────────────────────────────────────────
async function fetchPage(
  label: string,
  url: string,
  timeoutMs: number
): Promise<string | null> {
  const apiKey = process.env.TINYFISH_API_KEY!;
  console.log(`[Fetch:${label}] → ${url}`);
  try {
    const res = await fetch("https://api.fetch.tinyfish.ai", {
      method: "POST",
      headers: { "X-API-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        urls: [url],
        format: "markdown",
        proxy_config: { country_code: "US" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    console.log(`[Fetch:${label}] HTTP ${res.status}`);
    if (!res.ok) {
      const err = await res.text();
      console.log(`[Fetch:${label}] ❌ ${err.slice(0, 150)}`);
      return null;
    }
    const data = await res.json();
    const text: string = (data.results ?? [])[0]?.text ?? "";
    console.log(`[Fetch:${label}] ${text.length} chars`);
    if (text.length > 0) console.log(`[Fetch:${label}] Preview:\n${text.slice(0, 300)}\n---`);
    return text.length > 150 ? text : null;
  } catch (err: any) {
    console.log(`[Fetch:${label}] ❌ ${err?.message}`);
    return null;
  }
}

// ── Claude Haiku: parse product page ─────────────────────────────────────────
async function parseWithClaude(
  mpn: string,
  supplierName: string,
  tier: "standard" | "chinese",
  url: string,
  rawText: string,
  sliceStart: number = 0
): Promise<SupplierResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const content = rawText.slice(sliceStart, sliceStart + 4000);
  console.log(`[Claude:${supplierName}] Parsing chars ${sliceStart}-${sliceStart + content.length} of ${rawText.length}`);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content:
              `Parse this ${supplierName} product page for electronic component "${mpn}".\n\n` +
              `Page content:\n---\n${content}\n---\n\n` +
              `Rules:\n` +
              `- Only extract if this page is specifically about "${mpn}" (exact or direct variant)\n` +
              `- Must be the bare IC/component — reject dev boards, kits, modules\n` +
              `- Price must be a realistic unit price for a common IC (not $0, not absurdly high)\n` +
              `- Extract whatever currency is shown (USD, CNY, EUR, etc.) — never reject based on currency\n` +
              `- For CNY prices: extract the number shown directly (e.g. ¥25.81 → price: 25.81, currency: "CNY")\n` +
              `- For Alibaba: extract any listed or starting price shown on the page\n` +
              `- Extract: unit price for smallest qty, stock quantity, MOQ, lead time\n` +
              `- If lead time not shown: use "In stock" when stock > 0, else "Contact supplier"\n` +
              `- If stock not shown but item is listed as available: use stock: 999\n\n` +
              `Respond ONLY with raw JSON (no markdown fences):\n` +
              `{"found":true,"price":<number>,"currency":"<ISO code>","stock":<integer>,"moq":<integer>,"leadTime":"<string>","reason":"<brief explanation>"}\n` +
              `If not clearly this product or no price at all: {"found":false,"reason":"<why rejected>"}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      console.log(`[Claude:${supplierName}] ❌ HTTP ${res.status}`);
      return null;
    }
    const d = await res.json();
    const text: string = d?.content?.[0]?.text ?? "";
    console.log(`[Claude:${supplierName}] Response: ${text}`);

    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) { console.log(`[Claude:${supplierName}] ❌ No JSON`); return null; }
    const parsed = JSON.parse(match[0]);
    if (!parsed.found) { 
      console.log(`[Claude:${supplierName}] found=false: ${parsed.reason}`);
      return {
        supplier: supplierName,
        tier,
        mpn,
        price: null,
        currency: "USD",
        stock: 0,
        leadTime: "N/A",
        url,
        moq: 1,
        reason: parsed.reason ?? "Product not found or not matching criteria",
      };
    }
    if (!parsed.price || parsed.price <= 0) { 
      console.log(`[Claude:${supplierName}] ❌ Invalid price`);
      return {
        supplier: supplierName,
        tier,
        mpn,
        price: null,
        currency: "USD",
        stock: 0,
        leadTime: "N/A",
        url,
        moq: 1,
        reason: "Invalid or missing price information",
      };
    }

    return {
      supplier: supplierName,
      tier,
      mpn,
      price: parseFloat(String(parsed.price)),
      currency: parsed.currency ?? "USD",
      stock: parseInt(String(parsed.stock ?? "0")) || 0,
      leadTime: parsed.leadTime ?? "Contact supplier",
      url,
      moq: parseInt(String(parsed.moq ?? "1")) || 1,
      reason: parsed.reason ?? "Product found with valid pricing",
    };
  } catch (err: any) {
    console.log(`[Claude:${supplierName}] ❌ ${err?.message}`);
    return null;
  }
}

// ── Claude Haiku: rank results ────────────────────────────────────────────────
async function rankWithClaude(
  mpn: string,
  suppliers: SupplierResult[]
): Promise<ClaudeRanking> {
  const fallback = (): ClaudeRanking => {
    const inStock = suppliers.filter((s) => s.stock > 0);
    const pool = inStock.length > 0 ? inStock : suppliers;
    const best = pool.reduce(
      (bi, s, i) => ((s.price ?? 9999) < (pool[bi].price ?? 9999) ? i : bi),
      0
    );
    const idx = suppliers.findIndex((s) => s.supplier === pool[best].supplier);
    return {
      winner: suppliers[idx].supplier,
      reason: `${suppliers[idx].supplier} offers the best price with confirmed availability.`,
      recommendedIndex: idx,
    };
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || suppliers.length <= 1) {
    console.log(`[Rank] Fallback`);
    return fallback();
  }

  console.log(`[Rank] Ranking ${suppliers.length} suppliers`);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [
          {
            role: "user",
            content:
              `Rank supplier quotes for "${mpn}". Score: availability 40%, price 35%, reliability 25%.\n` +
              `Currency conversions: CNY × 0.138 = USD. EUR × 1.08 = USD.\n` +
              `LCSC is most reliable for genuine parts.\n\n` +
              JSON.stringify(
                suppliers.map((s, i) => ({
                  index: i,
                  supplier: s.supplier,
                  tier: s.tier,
                  price: s.price,
                  currency: s.currency,
                  stock: s.stock,
                  moq: s.moq,
                  leadTime: s.leadTime,
                }))
              ) +
              `\n\nRespond ONLY with raw JSON:\n{"winner":"<supplier name>","recommendedIndex":<number>,"reason":"<max 120 chars>"}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const d = await res.json();
    const text: string = d?.content?.[0]?.text ?? "";
    console.log(`[Rank] Response: ${text}`);
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) throw new Error("No JSON");
    const p = JSON.parse(m[0]);
    console.log(`[Rank] ✅ Winner: ${p.winner}`);
    return {
      winner: p.winner ?? suppliers[0].supplier,
      reason: p.reason ?? "Best overall value.",
      recommendedIndex: typeof p.recommendedIndex === "number" ? p.recommendedIndex : 0,
    };
  } catch (err: any) {
    console.log(`[Rank] ❌ ${err?.message}, fallback`);
    return fallback();
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────
async function checkCache(mpnNormalized: string): Promise<CacheRow | null> {
  try {
    const { data } = await supabase
      .from("search_cache")
      .select("*")
      .eq("mpn_normalized", mpnNormalized)
      .single();
    if (!data) { console.log(`[Cache] Miss: ${mpnNormalized}`); return null; }
    const ageHours = (Date.now() - new Date(data.updated_at).getTime()) / 3_600_000;
    console.log(`[Cache] ${ageHours < 72 ? "Hit" : "Stale"}: ${mpnNormalized} (${ageHours.toFixed(1)}h)`);
    return ageHours < 72 ? (data as CacheRow) : null;
  } catch {
    console.log(`[Cache] Miss: ${mpnNormalized}`);
    return null;
  }
}

async function saveCache(
  mpnNormalized: string,
  results: SupplierResult[],
  recommendation: ClaudeRanking | null
) {
  try {
    await supabase.from("search_cache").upsert(
      {
        mpn_normalized: mpnNormalized,
        results,
        claude_recommendation: recommendation,
        updated_at: new Date().toISOString(),
        hit_count: 1,
      },
      { onConflict: "mpn_normalized" }
    );
    console.log(`[Cache] ✅ Saved ${mpnNormalized} (${results.length} results)`);
  } catch (err: any) {
    console.log(`[Cache] ❌ ${err?.message}`);
  }
}

async function bumpHitCount(mpnNormalized: string, current: number) {
  try {
    await supabase
      .from("search_cache")
      .update({ hit_count: current + 1 })
      .eq("mpn_normalized", mpnNormalized);
  } catch {}
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json();
  const mpn: string = body?.mpn?.trim();
  if (!mpn) return new Response("mpn required", { status: 400 });
  const mpnNormalized = normalizeMpn(mpn);

  console.log(`\n${"═".repeat(60)}`);
  console.log(`[OmniProcure] ${mpn} (normalized: ${mpnNormalized})`);
  console.log(`[OmniProcure] TINYFISH:${!!process.env.TINYFISH_API_KEY} ANTHROPIC:${!!process.env.ANTHROPIC_API_KEY}`);
  console.log(`${"═".repeat(60)}\n`);

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
        // ── 1. Cache ──────────────────────────────────────────────────────
        const cached = await checkCache(mpnNormalized);
        if (cached) {
          send("started", { message: "Cache hit — serving instantly", cached: true, totalSuppliers: SUPPLIERS.length });
          const results: SupplierResult[] = cached.results ?? [];
          for (const s of SUPPLIERS) {
            const r = results.find((res) => res.supplier === s.name);
            if (r) {
              send("supplier_found", { supplier: r });
            } else {
              // Not found in cache, send with default reason
              send("supplier_found", { supplier: {
                supplier: s.name,
                tier: s.tier,
                mpn,
                price: null,
                currency: "USD",
                stock: 0,
                leadTime: "N/A",
                url: "",
                moq: 1,
                reason: "Not found in cached search results",
              } });
            }
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
          send("complete", {
            mpn,
            suppliers: results,
            recommendation: (cached as any).claude_recommendation,
            totalFound: results.length,
            cached: true,
            cachedAt: (cached as any).updated_at,
          });
          bumpHitCount(mpnNormalized, (cached as any).hit_count ?? 1);
          close();
          return;
        }

        // ── 2. Announce all → skeleton cards ─────────────────────────────
        send("started", {
          message: `Searching ${SUPPLIERS.length} suppliers for ${mpn}`,
          cached: false,
          totalSuppliers: SUPPLIERS.length,
        });
        for (const s of SUPPLIERS) send("supplier_searching", { name: s.name, tier: s.tier });

        const found: SupplierResult[] = [];
        const globalStart = Date.now();

        // ── 3. All 3 in parallel — Search + Fetch ─────────────────────────
        await Promise.all(
          SUPPLIERS.map(async (supplier) => {
            const t0 = Date.now();
            console.log(`\n[${supplier.name}] Starting`);
            try {
              const productUrl = await searchForUrl(
                supplier.name,
                supplier.searchQuery(mpn),
                supplier.urlMustContain
              );
              if (!productUrl) {
                console.log(`[${supplier.name}] ❌ No URL found`);
                send("supplier_not_found", { name: supplier.name, tier: supplier.tier });
                return;
              }

              const rawText = await fetchPage(supplier.name, productUrl, supplier.fetchTimeoutMs);
              if (!rawText) {
                console.log(`[${supplier.name}] ❌ Empty fetch`);
                if (supplier.name === "Alibaba") {
                  // Special handling for Alibaba bot protection
                  const alibabaResult: SupplierResult = {
                    supplier: supplier.name,
                    tier: supplier.tier,
                    mpn,
                    price: null,
                    currency: "USD",
                    stock: 0,
                    leadTime: "N/A",
                    url: `https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(mpn)}`,
                    moq: 1,
                    reason: "Alibaba's page could not be fetched due to bot protection. Visit directly to check pricing.",
                  };
                  send("supplier_found", { supplier: alibabaResult });
                  console.log(`[${supplier.name}] ⚠️ Bot protected - providing search link`);
                } else {
                  send("supplier_not_found", { name: supplier.name, tier: supplier.tier });
                }
                return;
              }

              const result = await parseWithClaude(
                mpn,
                supplier.name,
                supplier.tier,
                productUrl,
                rawText,
                supplier.contentSliceStart ?? 0
              );
              const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

              if (result) {
                if (result.price != null) {
                  found.push(result);
                  console.log(`[${supplier.name}] ✅ ${result.currency} ${result.price}, stock:${result.stock} (${elapsed}s)`);
                } else {
                  console.log(`[${supplier.name}] ❌ Not found (${elapsed}s): ${result.reason}`);
                }
                send("supplier_found", { supplier: result });
              } else {
                send("supplier_not_found", { name: supplier.name, tier: supplier.tier });
                console.log(`[${supplier.name}] ❌ Parse failed (${elapsed}s)`);
              }
            } catch (err: any) {
              const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
              console.log(`[${supplier.name}] ❌ Exception (${elapsed}s): ${err?.message}`);
              // Send as not found with reason
              send("supplier_found", { supplier: {
                supplier: supplier.name,
                tier: supplier.tier,
                mpn,
                price: null,
                currency: "USD",
                stock: 0,
                leadTime: "N/A",
                url: "",
                moq: 1,
                reason: `Failed to search: ${err?.message ?? "Unknown error"}`,
              } });
            }
          })
        );

        const totalElapsed = ((Date.now() - globalStart) / 1000).toFixed(1);
        console.log(`\n[OmniProcure] ✅ ${totalElapsed}s — ${found.length}/${SUPPLIERS.length} found`);
        found.forEach((r) => console.log(`  ✅ ${r.supplier}: ${r.currency} ${r.price}, stock:${r.stock}`));

        // ── 4. Rank ───────────────────────────────────────────────────────
        let recommendation: ClaudeRanking | null = null;
        const foundWithPrice = found.filter(s => s.price != null);
        if (foundWithPrice.length > 1) {
          recommendation = await rankWithClaude(mpn, foundWithPrice);
        } else if (foundWithPrice.length === 1) {
          console.log(`[Rank] Single — auto: ${foundWithPrice[0].supplier}`);
        }

        // ── 5. Cache + complete ───────────────────────────────────────────
        if (found.length > 0) saveCache(mpnNormalized, found, recommendation);

        send("complete", {
          mpn,
          suppliers: found,
          recommendation,
          totalFound: found.length,
          cached: false,
        });
      } catch (err: any) {
        console.log(`[OmniProcure] ❌ Fatal: ${err?.message}`);
        send("error", { message: err?.message ?? "Unknown error" });
      } finally {
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