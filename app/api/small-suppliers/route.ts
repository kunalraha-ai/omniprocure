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

// Results for one variant MPN
export interface VariantResult {
  variantMpn: string;
  packageDesc: string; // e.g. "SMD / TQFP-32"
  suppliers: SupplierResult[];
}

export interface EquivalentIC {
  mpn: string;
  manufacturer: string;
  description: string;
  whyEquivalent: string; // plain-English explanation
  suppliers: SupplierResult[]; // fetched after Claude suggests it
}

interface ClaudeRanking {
  winner: string;
  reason: string;
  recommendedIndex: number;
}

interface CacheRow {
  results: SupplierResult[];
  claude_recommendation: ClaudeRanking | null;
  variant_results: VariantResult[];
  equivalent_ics: EquivalentIC[];
  updated_at: string;
  hit_count: number;
}

// ── Package suffix map ────────────────────────────────────────────────────────
// Maps suffix → human-readable package description.
// Used both to generate candidate variants and to label them in the UI.
const PACKAGE_SUFFIXES: Record<string, string> = {
  // AVR / ATmega style
  "PU":   "DIP (Through-hole)",
  "AU":   "TQFP-32 (SMD)",
  "MU":   "QFN-32 (SMD)",
  "ANR":  "TQFP-32 (SMD, T&R)",
  "MMH":  "QFN-32 (SMD, lead-free)",
  // STM32 style
  "T6":   "LQFP-48",
  "T7":   "LQFP-64",
  "C8T6": "LQFP-48",
  "RBT6": "LQFP-64",
  // Generic
  "N":    "DIP (Through-hole)",
  "D":    "SOIC-8 (SMD)",
  "P":    "DIP-8 (Through-hole)",
  "W":    "WSON (SMD)",
  "TR":   "Tape & Reel",
  "T":    "Tape & Reel",
  "R":    "Tape & Reel",
};

// ── Currency helpers ──────────────────────────────────────────────────────────
const CURRENCY_FALLBACK = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY"];
const TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, CAD: 0.74,
  AUD: 0.65, JPY: 0.0067, CNY: 0.14,
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function normalizeMpn(mpn: string): string {
  return mpn.toUpperCase().replace(/[\s\-_.]/g, "");
}

function normalizeSupplierName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|bv|ag|srl|pty|plc)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
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
  const candidates = [...CURRENCY_FALLBACK, sourceCurrency?.toUpperCase()].filter(Boolean);
  for (const cur of candidates) {
    const list = prices?.[cur];
    if (!list || list.length === 0) continue;
    const parsed = parseFloat(list[0].unit_price);
    if (isNaN(parsed) || parsed <= 0) continue;
    const inUsd = cur === "USD" ? parsed : parsed * (TO_USD[cur] ?? 1);
    return { price: parseFloat(inUsd.toFixed(6)), currency: cur };
  }
  return { price: null, currency: "USD" };
}

function mapToSupplierResult(item: OemSecretsStock, mpn: string): SupplierResult {
  const { price, currency } = extractPrice(item.prices, item.source_currency);
  const hasPrice = price !== null;
  const stock = item.quantity_in_stock ?? 0;
  const supplier = (item.distributor.distributor_common_name || item.distributor.distributor_name || "").trim();
  return {
    supplier, mpn, price, currency, stock,
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

function deduplicateBySupplier(results: SupplierResult[]): SupplierResult[] {
  const map = new Map<string, SupplierResult>();
  for (const curr of results) {
    const key = normalizeSupplierName(curr.supplier);
    if (!key) continue;
    const existing = map.get(key);
    if (!existing) { map.set(key, curr); continue; }
    const existingScore = getScore(existing);
    const currScore = getScore(curr);
    if (currScore > existingScore) {
      map.set(key, curr);
    } else if (currScore === existingScore) {
      if (curr.stock > existing.stock) {
        map.set(key, curr);
      } else if (curr.stock === existing.stock && curr.price !== null && existing.price !== null && curr.price < existing.price) {
        map.set(key, curr);
      }
    }
  }
  return Array.from(map.values());
}

// ── OEM Secrets fetch (shared) ────────────────────────────────────────────────
async function fetchOemSecrets(mpn: string): Promise<SupplierResult[]> {
  const apiKey = process.env.OEM_SECRETS_API_KEY!;
  const url = `https://oemsecretsapi.com/partsearch?apiKey=${apiKey}&searchTerm=${encodeURIComponent(mpn)}&currency=USD`;

  console.log(`[OemSecrets] Fetching: ${mpn}`);
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`OEM Secrets API error: ${res.status}`);

  const data: OemSecretsResponse = await res.json();
  console.log(`[OemSecrets] ${mpn}: ${data.parts_returned} rows`);
  if (!data.stock || data.stock.length === 0) return [];

  const mapped = data.stock.map(item => mapToSupplierResult(item, mpn));
  const deduped = deduplicateBySupplier(mapped);
  return deduped.sort((a, b) => {
    const scoreDiff = getScore(b) - getScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    if (a.price !== null && b.price !== null) return a.price - b.price;
    return 0;
  });
}

// ── SKU Variant generation ────────────────────────────────────────────────────
// Parses the input MPN to find its base + current suffix, then generates
// candidate variants using the other suffixes in the map.
// Avoids returning the original MPN as a variant.
function generateVariantMpns(mpn: string): Array<{ variantMpn: string; packageDesc: string }> {
  const upper = mpn.toUpperCase();
  const variants: Array<{ variantMpn: string; packageDesc: string }> = [];

  // Sort suffixes longest-first so "ANR" matches before "AU", etc.
  const sortedSuffixes = Object.keys(PACKAGE_SUFFIXES).sort((a, b) => b.length - a.length);

  // Find which suffix the input ends with (if any)
  let base = upper;
  let foundCurrentSuffix = false;

  for (const suffix of sortedSuffixes) {
    if (upper.endsWith(suffix) && upper.length > suffix.length) {
      base = upper.slice(0, upper.length - suffix.length);
      foundCurrentSuffix = true;
      break;
    }
  }

  // If we couldn't identify a known suffix, the part itself is the base.
  // Still try appending common suffixes.
  for (const suffix of sortedSuffixes) {
    const candidate = `${base}${suffix}`;
    if (candidate === upper) continue; // skip self
    // Basic sanity: don't generate absurdly long MPNs
    if (candidate.length > 24) continue;
    variants.push({ variantMpn: candidate, packageDesc: PACKAGE_SUFFIXES[suffix] });
  }

  // Deduplicate by variantMpn
  const seen = new Set<string>();
  return variants.filter(v => {
    if (seen.has(v.variantMpn)) return false;
    seen.add(v.variantMpn);
    return true;
  });
}

// Fetch variants in parallel, cap at 6 candidates to avoid blowing the budget.
// Only include a variant in results if OEM Secrets actually returns stock for it.
async function fetchVariants(mpn: string): Promise<VariantResult[]> {
  const candidates = generateVariantMpns(mpn).slice(0, 6);
  if (candidates.length === 0) return [];

  console.log(`[Variants] Checking ${candidates.length} candidates for ${mpn}`);

  const settled = await Promise.allSettled(
    candidates.map(async ({ variantMpn, packageDesc }) => {
      const suppliers = await fetchOemSecrets(variantMpn);
      return { variantMpn, packageDesc, suppliers };
    })
  );

  const results: VariantResult[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value.suppliers.length > 0) {
      results.push(r.value);
      console.log(`[Variants] ${r.value.variantMpn}: ${r.value.suppliers.length} suppliers`);
    }
  }

  return results;
}

// ── Claude: rank + equivalent ICs (two separate calls, run in parallel) ───────

async function rankWithClaude(mpn: string, suppliers: SupplierResult[]): Promise<ClaudeRanking> {
  const fallback = (): ClaudeRanking => {
    const actionable = suppliers.filter(s => s.hasPrice && s.stock > 0);
    const pool = actionable.length > 0 ? actionable : suppliers.filter(s => s.hasPrice);
    if (pool.length === 0) return { winner: suppliers[0].supplier, reason: "Only available option.", recommendedIndex: 0 };
    const best = pool.reduce((bi, s, i) => ((s.price ?? 9999) < (pool[bi].price ?? 9999) ? i : bi), 0);
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

  const topActionable = actionable.slice(0, 30);
  console.log(`[Rank] Sending ${topActionable.length} suppliers to Claude`);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 200,
        messages: [{
          role: "user",
          content:
            `You are a procurement expert. Pick the single best supplier for "${mpn}".\n` +
            `Scoring: stock availability 40%, unit price 35%, lead time & reliability 25%.\n` +
            `Only consider suppliers where hasPrice=true and stock>0.\n\n` +
            JSON.stringify(topActionable.map(s => ({
              index: suppliers.findIndex(x => x.supplier === s.supplier),
              supplier: s.supplier, price: s.price, stock: s.stock,
              moq: s.moq, leadTime: s.leadTime, region: s.region,
            }))) +
            `\n\nRespond ONLY with raw JSON (no markdown):\n` +
            `{"winner":"<name>","recommendedIndex":<n>,"reason":"<max 120 chars>"}`,
        }],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const d = await res.json();
    const text: string = d?.content?.[0]?.text ?? "";
    const m = text.match(/\{[\s\S]*?\}/);
    if (!m) throw new Error("No JSON");
    const p = JSON.parse(m[0]);
    return {
      winner: p.winner ?? suppliers[0].supplier,
      reason: p.reason ?? "Best overall value.",
      recommendedIndex: typeof p.recommendedIndex === "number" ? p.recommendedIndex : 0,
    };
  } catch (err: any) {
    console.log(`[Rank] Fallback: ${err?.message}`);
    return fallback();
  }
}

// Ask Claude to suggest 3 functionally equivalent ICs.
// Returns structured suggestions; we then fetch live stock for each.
async function suggestEquivalentICs(
  mpn: string
): Promise<Array<{ mpn: string; manufacturer: string; description: string; whyEquivalent: string }>> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];

  console.log(`[EquivICs] Asking Claude for equivalents of ${mpn}`);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{
          role: "user",
          content:
            `You are an electronics engineer. Suggest exactly 3 functionally equivalent ICs to "${mpn}".\n` +
            `Rules:\n` +
            `- Must be from a DIFFERENT manufacturer\n` +
            `- Must be functionally equivalent (same purpose, compatible pinout or drop-in replacement)\n` +
            `- Must be real, currently manufactured parts that are commonly available\n` +
            `- Prefer parts that are popular and widely stocked\n\n` +
            `Respond ONLY with raw JSON array (no markdown, no explanation outside JSON):\n` +
            `[{"mpn":"<exact MPN>","manufacturer":"<name>","description":"<10 words max>","whyEquivalent":"<max 100 chars, plain English, explain key specs match>"}]`,
        }],
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const d = await res.json();
    const text: string = d?.content?.[0]?.text ?? "";
    console.log(`[EquivICs] Claude response: ${text}`);
    // Extract JSON array from response
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) throw new Error("No JSON array");
    const parsed = JSON.parse(m[0]);
    if (!Array.isArray(parsed)) throw new Error("Not an array");
    return parsed.slice(0, 3).map((item: any) => ({
      mpn: String(item.mpn ?? "").trim(),
      manufacturer: String(item.manufacturer ?? "").trim(),
      description: String(item.description ?? "").trim(),
      whyEquivalent: String(item.whyEquivalent ?? "").trim(),
    })).filter(item => item.mpn.length > 0);
  } catch (err: any) {
    console.log(`[EquivICs] Failed: ${err?.message}`);
    return [];
  }
}

// Fetch stock for each suggested equivalent IC in parallel
async function fetchEquivalentICs(mpn: string): Promise<EquivalentIC[]> {
  const suggestions = await suggestEquivalentICs(mpn);
  if (suggestions.length === 0) return [];

  console.log(`[EquivICs] Fetching stock for ${suggestions.length} equivalents`);

  const settled = await Promise.allSettled(
    suggestions.map(async (s) => {
      const suppliers = await fetchOemSecrets(s.mpn);
      return { ...s, suppliers };
    })
  );

  return settled
    .filter((r): r is PromiseFulfilledResult<EquivalentIC> => r.status === "fulfilled")
    .map(r => r.value);
}

// ── Cache ─────────────────────────────────────────────────────────────────────
const CACHE_TTL_HOURS = 24;

async function checkCache(mpnNormalized: string): Promise<CacheRow | null> {
  try {
    const { data } = await supabase
      .from("search_cache").select("*").eq("mpn_normalized", mpnNormalized).single();
    if (!data) return null;
    const ageHours = (Date.now() - new Date(data.updated_at).getTime()) / 3_600_000;
    const fresh = ageHours < CACHE_TTL_HOURS;
    console.log(`[Cache] ${fresh ? "Hit" : "Stale"}: ${mpnNormalized} (${ageHours.toFixed(1)}h)`);
    return fresh ? (data as CacheRow) : null;
  } catch { return null; }
}

async function saveCache(
  mpnNormalized: string,
  results: SupplierResult[],
  recommendation: ClaudeRanking | null,
  variantResults: VariantResult[],
  equivalentIcs: EquivalentIC[]
) {
  try {
    await supabase.from("search_cache").upsert(
      {
        mpn_normalized: mpnNormalized,
        results,
        claude_recommendation: recommendation,
        variant_results: variantResults,
        equivalent_ics: equivalentIcs,
        updated_at: new Date().toISOString(),
        hit_count: 1,
      },
      { onConflict: "mpn_normalized" }
    );
    console.log(`[Cache] Saved ${mpnNormalized} (${results.length} results, ${variantResults.length} variants, ${equivalentIcs.length} equiv)`);
  } catch (err: any) {
    console.log(`[Cache] Save failed: ${err?.message}`);
  }
}

async function bumpHitCount(mpnNormalized: string, current: number) {
  try {
    await supabase.from("search_cache").update({ hit_count: current + 1 }).eq("mpn_normalized", mpnNormalized);
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
        try { controller.enqueue(new TextEncoder().encode(sseEvent(type, data))); }
        catch { closed = true; }
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
          for (const r of (cached.results ?? [])) {
            send("supplier_found", { supplier: r });
            await new Promise(r => setTimeout(r, 15));
          }
          send("variant_results",   { variants: cached.variant_results ?? [] });
          send("equivalent_ics",    { equivalents: cached.equivalent_ics ?? [] });
          send("complete", {
            mpn, suppliers: cached.results ?? [],
            recommendation: cached.claude_recommendation,
            totalFound: (cached.results ?? []).length,
            cached: true, cachedAt: cached.updated_at,
          });
          bumpHitCount(mpnNormalized, cached.hit_count ?? 1);
          close();
          return;
        }

        // ── 2. Fan out: main search + variants + equivalents in parallel ─
        send("started", { message: `Searching for ${mpn}`, cached: false });
        send("supplier_searching", { name: "OEM Secrets", message: "Querying 140+ distributors + SKU variants + equivalent ICs in parallel…" });

        // All three network operations run at the same time
        const [mainResults, variantResults, equivalentIcs] = await Promise.all([
          fetchOemSecrets(mpn),
          fetchVariants(mpn),
          fetchEquivalentICs(mpn),
        ]);

        if (mainResults.length === 0) {
          send("variant_results", { variants: variantResults });
          send("equivalent_ics",  { equivalents: equivalentIcs });
          send("complete", { mpn, suppliers: [], recommendation: null, totalFound: 0, cached: false });
          close();
          return;
        }

        // ── 3. Stream main results ──────────────────────────────────────
        for (const r of mainResults) {
          send("supplier_found", { supplier: r });
          await new Promise(r => setTimeout(r, 15));
        }

        // ── 4. Claude ranking (runs after main fetch, variants/equiv already done) ──
        let recommendation: ClaudeRanking | null = null;
        const actionable = mainResults.filter(s => s.hasPrice && s.stock > 0);
        if (actionable.length >= 1) {
          recommendation = await rankWithClaude(mpn, mainResults);
        }

        // ── 5. Send variant + equivalent results ────────────────────────
        send("variant_results",  { variants: variantResults });
        send("equivalent_ics",   { equivalents: equivalentIcs });

        // ── 6. Cache + complete ─────────────────────────────────────────
        saveCache(mpnNormalized, mainResults, recommendation, variantResults, equivalentIcs);
        send("complete", {
          mpn, suppliers: mainResults, recommendation,
          totalFound: mainResults.length, cached: false,
        });

      } catch (err: any) {
        console.log(`[OmniProcure] Fatal: ${err?.message}`);
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