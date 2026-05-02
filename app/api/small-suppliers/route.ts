import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

// ── Supabase ──────────────────────────────────────────────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface OemSecretsStock {
  part_number: string;
  source_part_number: string;
  prices: Record<string, Array<{ unit_break: string; unit_price: string }>>;
  distributor: {
    distributor_name: string;
    distributor_common_name: string;
    distributor_region: string;
    distributor_logo: string;
  };
  source_currency: string;
  quantity_in_stock: number;
  lead_time: string;
  buy_now_url: string;
  moq?: number;
  life_cycle?: string;
  date_code?: string;
  datasheet_url?: string;
}

interface OemSecretsResponse {
  version: string;
  status: string;
  country_code: string;
  parts_returned: number;
  stock: OemSecretsStock[];
}

export interface SupplierResult {
  supplier: string;
  mpn: string;
  price: number | null;
  currency: string;
  stock: number;
  leadTime: string;
  url: string;
  moq: number;
  reason: string;
  region: string;
  hasPrice: boolean;
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

// ── Currency fallback order ───────────────────────────────────────────────────
// Try USD first, then common alternatives. We store the resolved price in USD
// but note the source currency so the UI can show it accurately.
const CURRENCY_FALLBACK = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY"];

// Rough conversion rates to USD (good enough for ranking; not for invoicing)
const TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  CAD: 0.74,
  AUD: 0.65,
  JPY: 0.0067,
  CNY: 0.14,
};

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

function getScore(s: SupplierResult): number {
  if (s.hasPrice && s.stock > 0) return 3;
  if (s.hasPrice && s.stock === 0) return 2;
  if (!s.hasPrice && s.stock > 0) return 1;
  return 0;
}

function extractPrice(
  prices: Record<string, Array<{ unit_break: string; unit_price: string }>>,
  sourceCurrency: string
): { price: number | null; currency: string } {
  // 1. Prefer USD directly
  // 2. Fall back through CURRENCY_FALLBACK
  // 3. Fall back to source_currency from the API
  const candidates = [
    ...CURRENCY_FALLBACK,
    sourceCurrency?.toUpperCase(),
  ].filter(Boolean);

  for (const cur of candidates) {
    const list = prices?.[cur];
    if (!list || list.length === 0) continue;
    const parsed = parseFloat(list[0].unit_price);
    if (isNaN(parsed) || parsed <= 0) continue;
    // Convert to USD for consistent ranking
    const inUsd = cur === "USD" ? parsed : parsed * (TO_USD[cur] ?? 1);
    return { price: parseFloat(inUsd.toFixed(6)), currency: cur };
  }
  return { price: null, currency: "USD" };
}

function mapToSupplierResult(item: OemSecretsStock, mpn: string): SupplierResult {
  const { price, currency } = extractPrice(item.prices, item.source_currency);
  const hasPrice = price !== null;
  const stock = item.quantity_in_stock ?? 0;

  return {
    supplier: item.distributor.distributor_common_name || item.distributor.distributor_name,
    mpn,
    price,
    currency,
    stock,
    leadTime: item.lead_time || (stock > 0 ? "In stock" : "Contact supplier"),
    url: item.buy_now_url || "",
    moq: item.moq ?? 1,
    reason: hasPrice
      ? `Listed at USD ${price?.toFixed(3)} with ${stock.toLocaleString()} units in stock`
      : "Price available on request — contact distributor directly",
    region: item.distributor.distributor_region || "Global",
    hasPrice,
  };
}

// ── Dedup: one row per distributor, keep best (score tier → highest stock) ────
function deduplicateBySupplier(results: SupplierResult[]): SupplierResult[] {
  return results.reduce((acc, curr) => {
    const existingIdx = acc.findIndex(s => s.supplier === curr.supplier);
    if (existingIdx === -1) {
      acc.push(curr);
    } else {
      const existing = acc[existingIdx];
      const existingScore = getScore(existing);
      const currScore = getScore(curr);
      if (currScore > existingScore) {
        acc[existingIdx] = curr;
      } else if (currScore === existingScore && curr.stock > existing.stock) {
        acc[existingIdx] = curr;
      }
    }
    return acc;
  }, [] as SupplierResult[]);
}

// ── OEM Secrets API ───────────────────────────────────────────────────────────
async function fetchOemSecrets(mpn: string): Promise<SupplierResult[]> {
  const apiKey = process.env.OEM_SECRETS_API_KEY!;
  const url = `https://oemsecretsapi.com/partsearch?apiKey=${apiKey}&searchTerm=${encodeURIComponent(mpn)}&currency=USD`;

  console.log(`[OemSecrets] Fetching: ${mpn}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });

  if (!res.ok) {
    console.log(`[OemSecrets] HTTP ${res.status}`);
    throw new Error(`OEM Secrets API error: ${res.status}`);
  }

  const data: OemSecretsResponse = await res.json();
  console.log(`[OemSecrets] ${data.parts_returned} parts returned`);

  if (!data.stock || data.stock.length === 0) return [];

  // 1. Map all to SupplierResult
  const mapped = data.stock.map(item => mapToSupplierResult(item, mpn));

  // 2. Deduplicate — one row per distributor
  const deduped = deduplicateBySupplier(mapped);

  // 3. Sort: score desc, then price asc within same tier
  const sorted = deduped.sort((a, b) => {
    const scoreDiff = getScore(b) - getScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.price !== null && b.price !== null) return a.price - b.price;
    return 0;
  });

  // 4. Return ALL unique suppliers (no arbitrary cap — UI shows everything)
  console.log(`[OemSecrets] ${deduped.length} unique suppliers after dedup`);
  return sorted;
}

// ── Claude: rank results ──────────────────────────────────────────────────────
async function rankWithClaude(mpn: string, suppliers: SupplierResult[]): Promise<ClaudeRanking> {
  const fallback = (): ClaudeRanking => {
    const actionable = suppliers.filter(s => s.hasPrice && s.stock > 0);
    const pool = actionable.length > 0 ? actionable : suppliers.filter(s => s.hasPrice);
    if (pool.length === 0) {
      return { winner: suppliers[0].supplier, reason: "Only available option.", recommendedIndex: 0 };
    }
    const best = pool.reduce(
      (bi, s, i) => ((s.price ?? 9999) < (pool[bi].price ?? 9999) ? i : bi),
      0
    );
    const idx = suppliers.findIndex(s => s.supplier === pool[best].supplier);
    return {
      winner: suppliers[idx].supplier,
      reason: `${suppliers[idx].supplier} offers the best price with stock available.`,
      recommendedIndex: idx,
    };
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const actionable = suppliers.filter(s => s.hasPrice && s.stock > 0);
  if (!apiKey || actionable.length <= 1) return fallback();

  console.log(`[Rank] Ranking ${actionable.length} actionable suppliers via Claude`);

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
              `You are a procurement expert. Pick the single best supplier for "${mpn}".\n` +
              `Scoring: stock availability 40%, unit price 35%, lead time & reliability 25%.\n` +
              `Only consider suppliers where hasPrice=true and stock>0.\n\n` +
              JSON.stringify(
                actionable.map(s => ({
                  index: suppliers.findIndex(x => x.supplier === s.supplier),
                  supplier: s.supplier,
                  price: s.price,
                  stock: s.stock,
                  moq: s.moq,
                  leadTime: s.leadTime,
                  region: s.region,
                }))
              ) +
              `\n\nRespond ONLY with raw JSON (no markdown, no code fences):\n` +
              `{"winner":"<supplier name>","recommendedIndex":<index in original array>,"reason":"<max 120 chars>"}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const d = await res.json();
    const text: string = d?.content?.[0]?.text ?? "";
    console.log(`[Rank] Claude response: ${text}`);
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) throw new Error("No JSON in response");
    const p = JSON.parse(m[0]);
    return {
      winner: p.winner ?? suppliers[0].supplier,
      reason: p.reason ?? "Best overall value.",
      recommendedIndex: typeof p.recommendedIndex === "number" ? p.recommendedIndex : 0,
    };
  } catch (err: any) {
    console.log(`[Rank] Claude fallback triggered: ${err?.message}`);
    return fallback();
  }
}

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_TTL_HOURS = 24; // Reduced from 72h — pricing data changes daily

async function checkCache(mpnNormalized: string): Promise<CacheRow | null> {
  try {
    const { data } = await supabase
      .from("search_cache")
      .select("*")
      .eq("mpn_normalized", mpnNormalized)
      .single();
    if (!data) return null;
    const ageHours = (Date.now() - new Date(data.updated_at).getTime()) / 3_600_000;
    const fresh = ageHours < CACHE_TTL_HOURS;
    console.log(`[Cache] ${fresh ? "Hit" : "Stale"}: ${mpnNormalized} (${ageHours.toFixed(1)}h old)`);
    return fresh ? (data as CacheRow) : null;
  } catch {
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
    console.log(`[Cache] Saved ${mpnNormalized} (${results.length} results)`);
  } catch (err: any) {
    console.log(`[Cache] Save failed: ${err?.message}`);
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
  console.log(`${"═".repeat(60)}\n`);

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;

      const send = (type: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(new TextEncoder().encode(sseEvent(type, data)));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      try {
        // ── 1. Cache check ──────────────────────────────────────────────
        const cached = await checkCache(mpnNormalized);
        if (cached) {
          send("started", { message: "Cache hit — serving instantly", cached: true });
          const results: SupplierResult[] = cached.results ?? [];
          for (const r of results) {
            send("supplier_found", { supplier: r });
            await new Promise(resolve => setTimeout(resolve, 30));
          }
          send("complete", {
            mpn,
            suppliers: results,
            recommendation: cached.claude_recommendation,
            totalFound: results.length,
            cached: true,
            cachedAt: cached.updated_at,
          });
          bumpHitCount(mpnNormalized, cached.hit_count ?? 1);
          close();
          return;
        }

        // ── 2. Fetch from OEM Secrets ───────────────────────────────────
        send("started", { message: `Fetching suppliers for ${mpn}`, cached: false });
        send("supplier_searching", {
          name: "OEM Secrets",
          message: "Querying 140+ global distributors...",
        });

        const results = await fetchOemSecrets(mpn);

        if (results.length === 0) {
          send("complete", {
            mpn,
            suppliers: [],
            recommendation: null,
            totalFound: 0,
            cached: false,
          });
          close();
          return;
        }

        // ── 3. Stream results one by one ────────────────────────────────
        for (const r of results) {
          send("supplier_found", { supplier: r });
          await new Promise(resolve => setTimeout(resolve, 30));
        }

        // ── 4. Claude ranking (actionable suppliers only) ───────────────
        let recommendation: ClaudeRanking | null = null;
        const actionable = results.filter(s => s.hasPrice && s.stock > 0);
        if (actionable.length >= 1) {
          recommendation = await rankWithClaude(mpn, results);
        }

        // ── 5. Persist to cache + complete ──────────────────────────────
        saveCache(mpnNormalized, results, recommendation);
        send("complete", {
          mpn,
          suppliers: results,
          recommendation,
          totalFound: results.length,
          cached: false,
        });

      } catch (err: any) {
        console.log(`[OmniProcure] Fatal error: ${err?.message}`);
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