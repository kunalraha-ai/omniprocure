/**
 * lib/procurement.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all procurement logic.
 * Imported by every API route — no n8n, no external orchestrator.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createClient } from "@supabase/supabase-js";

// ── Supabase (service role — server only) ─────────────────────────────────────
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OemSecretsStock {
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
}

export interface OemSecretsResponse {
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

export interface VariantResult {
  variantMpn: string;
  packageDesc: string;
  suppliers: SupplierResult[];
}

export interface EquivalentIC {
  mpn: string;
  manufacturer: string;
  description: string;
  whyEquivalent: string;
  suppliers: SupplierResult[];
}

export interface ClaudeRanking {
  winner: string;
  reason: string;
  recommendedIndex: number;
}

export interface BomLineItem {
  mpn: string;
  description: string;
  qty: number;
  manufacturer: string;
}

export interface AuditEvent {
  action: string;
  supplier?: string;
  mpn?: string;
  unit_price?: number | null;
  total_value?: number | null;
  decision?: string;
  details?: Record<string, unknown>;
}

export interface HitlRequest {
  id: string;
  action: "generate_po" | "negotiate_quote" | "send_po";
  supplier: string;
  mpn: string;
  price: number | null;
  currency: string;
  stock: number;
  moq: number;
  leadTime: string;
  region: string;
  url: string;
  totalValue: number;
  reason: string;
  aiRecommendation?: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected" | "modified";
  modifiedNote?: string;
}

// ── Currency helpers ──────────────────────────────────────────────────────────
const CURRENCY_FALLBACK = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY", "CNY"];
const TO_USD: Record<string, number> = {
  USD: 1, EUR: 1.09, GBP: 1.27, CAD: 0.74,
  AUD: 0.65, JPY: 0.0067, CNY: 0.14,
};

// ── Package suffix map ────────────────────────────────────────────────────────
export const PACKAGE_SUFFIXES: Record<string, string> = {
  "PU": "DIP (Through-hole)", "AU": "TQFP-32 (SMD)", "MU": "QFN-32 (SMD)",
  "ANR": "TQFP-32 (SMD, T&R)", "MMH": "QFN-32 (SMD, lead-free)",
  "T6": "LQFP-48", "T7": "LQFP-64", "C8T6": "LQFP-48", "RBT6": "LQFP-64",
  "N": "DIP (Through-hole)", "D": "SOIC-8 (SMD)", "P": "DIP-8 (Through-hole)",
  "W": "WSON (SMD)", "TR": "Tape & Reel", "T": "Tape & Reel", "R": "Tape & Reel",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
export function normalizeMpn(mpn: string): string {
  return mpn.toUpperCase().replace(/[\s\-_.]/g, "");
}

function normalizeSupplierName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(inc|llc|ltd|corp|co|gmbh|bv|ag|srl|pty|plc)\b/g, "")
    .replace(/\s+/g, " ").trim();
}

export function sseEvent(type: string, data: unknown): string {
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
    if (!list?.length) continue;
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
    if (currScore > existingScore) { map.set(key, curr); continue; }
    if (currScore === existingScore) {
      if (curr.stock > existing.stock) { map.set(key, curr); continue; }
      if (curr.stock === existing.stock && curr.price !== null && existing.price !== null && curr.price < existing.price)
        map.set(key, curr);
    }
  }
  return Array.from(map.values());
}

// ── OEM Secrets ───────────────────────────────────────────────────────────────
export async function fetchOemSecrets(mpn: string): Promise<SupplierResult[]> {
  const apiKey = process.env.OEM_SECRETS_API_KEY!;
  const url = `https://oemsecretsapi.com/partsearch?apiKey=${apiKey}&searchTerm=${encodeURIComponent(mpn)}&currency=USD`;
  const res = await fetch(url, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error(`OEM Secrets API error: ${res.status}`);
  const data: OemSecretsResponse = await res.json();
  if (!data.stock?.length) return [];
  const mapped = data.stock.map(item => mapToSupplierResult(item, mpn));
  const deduped = deduplicateBySupplier(mapped);
  return deduped.sort((a, b) => {
    const sd = getScore(b) - getScore(a);
    if (sd !== 0) return sd;
    if (a.price !== null && b.price !== null) return a.price - b.price;
    return 0;
  });
}

// ── SKU Variants ──────────────────────────────────────────────────────────────
export function generateVariantMpns(mpn: string): Array<{ variantMpn: string; packageDesc: string }> {
  const upper = mpn.toUpperCase();
  const sorted = Object.keys(PACKAGE_SUFFIXES).sort((a, b) => b.length - a.length);
  let base = upper;
  for (const suffix of sorted) {
    if (upper.endsWith(suffix) && upper.length > suffix.length) {
      base = upper.slice(0, upper.length - suffix.length);
      break;
    }
  }
  const seen = new Set<string>();
  return sorted.flatMap(suffix => {
    const candidate = `${base}${suffix}`;
    if (candidate === upper || candidate.length > 24 || seen.has(candidate)) return [];
    seen.add(candidate);
    return [{ variantMpn: candidate, packageDesc: PACKAGE_SUFFIXES[suffix] }];
  });
}

export async function fetchVariants(mpn: string): Promise<VariantResult[]> {
  const candidates = generateVariantMpns(mpn).slice(0, 6);
  if (!candidates.length) return [];
  const settled = await Promise.allSettled(
    candidates.map(async ({ variantMpn, packageDesc }) => ({
      variantMpn, packageDesc, suppliers: await fetchOemSecrets(variantMpn),
    }))
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<VariantResult> => r.status === "fulfilled" && r.value.suppliers.length > 0)
    .map(r => r.value);
}

// ── Claude helpers ────────────────────────────────────────────────────────────
async function claudeJson<T>(prompt: string, maxTokens: number, timeout = 12_000): Promise<T | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: maxTokens, messages: [{ role: "user", content: prompt }] }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) throw new Error(`Claude HTTP ${res.status}`);
    const d = await res.json();
    const text: string = d?.content?.[0]?.text ?? "";
    // Try array first, then object
    const arrMatch = text.match(/\[[\s\S]*\]/);
    const objMatch = text.match(/\{[\s\S]*\}/);
    // Prefer whichever comes first in the text
    const arrIdx = arrMatch ? text.indexOf(arrMatch[0]) : Infinity;
    const objIdx = objMatch ? text.indexOf(objMatch[0]) : Infinity;
    const raw = arrIdx < objIdx ? arrMatch : objMatch;
    if (!raw) throw new Error("No JSON in response");
    return JSON.parse(raw[0]) as T;
  } catch (err: any) {
    console.error(`[Claude] Error: ${err?.message}`);
    return null;
  }
}

export async function rankWithClaude(mpn: string, suppliers: SupplierResult[]): Promise<ClaudeRanking> {
  const fallback = (): ClaudeRanking => {
    const actionable = suppliers.filter(s => s.hasPrice && s.stock > 0);
    const pool = actionable.length ? actionable : suppliers.filter(s => s.hasPrice);
    if (!pool.length) return { winner: suppliers[0]?.supplier ?? "—", reason: "Only available option.", recommendedIndex: 0 };
    const best = pool.reduce((bi, s, i) => ((s.price ?? 9999) < (pool[bi].price ?? 9999) ? i : bi), 0);
    const idx = suppliers.findIndex(s => s.supplier === pool[best].supplier);
    return { winner: suppliers[idx].supplier, reason: `Best price with stock available.`, recommendedIndex: idx };
  };
  const actionable = suppliers.filter(s => s.hasPrice && s.stock > 0);
  if (actionable.length <= 1) return fallback();
  const result = await claudeJson<ClaudeRanking>(
    `You are a procurement expert. Pick the single best supplier for "${mpn}".
Scoring: stock availability 40%, unit price 35%, lead time & reliability 25%.
Only consider suppliers where hasPrice=true and stock>0.

${JSON.stringify(actionable.slice(0, 30).map(s => ({
  index: suppliers.findIndex(x => x.supplier === s.supplier),
  supplier: s.supplier, price: s.price, stock: s.stock,
  moq: s.moq, leadTime: s.leadTime, region: s.region,
})))}

Respond ONLY with raw JSON (no markdown):
{"winner":"<name>","recommendedIndex":<n>,"reason":"<max 120 chars>"}`,
    200
  );
  if (!result || typeof result.winner !== "string") return fallback();
  return result;
}

export async function suggestEquivalentICs(mpn: string): Promise<Array<{ mpn: string; manufacturer: string; description: string; whyEquivalent: string }>> {
  const result = await claudeJson<Array<{ mpn: string; manufacturer: string; description: string; whyEquivalent: string }>>(
    `You are an electronics engineer. Suggest exactly 3 functionally equivalent ICs to "${mpn}".
Rules:
- Must be from a DIFFERENT manufacturer
- Must be functionally equivalent (same purpose, compatible pinout or drop-in replacement)
- Must be real, currently manufactured parts that are commonly available

Respond ONLY with raw JSON array (no markdown):
[{"mpn":"<exact MPN>","manufacturer":"<name>","description":"<10 words max>","whyEquivalent":"<max 100 chars>"}]`,
    600
  );
  if (!Array.isArray(result)) return [];
  return result.slice(0, 3).filter(i => typeof i.mpn === "string" && i.mpn.length > 0);
}

export async function fetchEquivalentICs(mpn: string): Promise<EquivalentIC[]> {
  const suggestions = await suggestEquivalentICs(mpn);
  if (!suggestions.length) return [];
  const settled = await Promise.allSettled(
    suggestions.map(async s => ({ ...s, suppliers: await fetchOemSecrets(s.mpn) }))
  );
  return settled
    .filter((r): r is PromiseFulfilledResult<EquivalentIC> => r.status === "fulfilled")
    .map(r => r.value);
}

// ── BOM parsing ───────────────────────────────────────────────────────────────
export async function parseBomWithClaude(rawData: string): Promise<BomLineItem[]> {
  const result = await claudeJson<BomLineItem[]>(
    `You are a procurement expert. Extract all line items from the following BOM data.
Return ONLY a raw JSON array — no markdown, no explanation:
[{"mpn":"string","description":"string","qty":1,"manufacturer":"string"}]

BOM data:
${rawData.slice(0, 8000)}`,
    2000
  );
  if (!Array.isArray(result)) return [];
  return result.filter(i => typeof i.mpn === "string" && i.mpn.length > 0);
}

// ── Quote analysis ────────────────────────────────────────────────────────────
export async function analyzeQuoteEmail(emailText: string, from: string, subject: string) {
  return claudeJson<{
    supplier: string; mpn: string; unitPrice: number; currency: string;
    moq: number; leadTime: string; validUntil: string; notes: string;
    shouldNegotiate: boolean; negotiationReason: string;
  }>(
    `You are a procurement analyst. Extract all quote details from this supplier email.
From: ${from}
Subject: ${subject}
Body: ${emailText.slice(0, 4000)}

Return ONLY raw JSON (no markdown):
{"supplier":"string","mpn":"string","unitPrice":0,"currency":"USD","moq":1,"leadTime":"string","validUntil":"string","notes":"string","shouldNegotiate":true,"negotiationReason":"string"}`,
    1000
  );
}

export async function draftCounterOffer(supplier: string, mpn: string, unitPrice: number, currency: string, moq: number, negotiationReason: string): Promise<string> {
  const result = await claudeJson<string>(
    `Draft a professional procurement counter-offer email body to ${supplier}.
Current quote: $${unitPrice} ${currency} for MPN ${mpn}, MOQ ${moq} units.
Reason to negotiate: ${negotiationReason}
Aim for 8-15% price reduction or better MOQ. Be professional and concise.
Return ONLY the plain text email body — no subject line, no JSON wrapper.`,
    800
  );
  return typeof result === "string" ? result : `Dear ${supplier},\n\nThank you for your quote for ${mpn}. We would like to discuss the pricing further. Could you consider a revised price for a similar or larger quantity?\n\nBest regards,\nProcurement Team`;
}

export async function generatePoText(params: {
  supplier: string; mpn: string; price: number | null; moq: number;
  leadTime: string; region: string; modNote?: string;
}): Promise<string> {
  const poNumber = `PO-${Date.now().toString().slice(-8)}`;
  const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const result = await claudeJson<string>(
    `Generate a formal purchase order in plain text.
PO Number: ${poNumber}
Date: ${today}
Supplier: ${params.supplier}
MPN: ${params.mpn}
Unit Price: USD ${params.price?.toFixed(4) ?? "TBD"}
Quantity (MOQ): ${params.moq}
Total Value: USD ${((params.price ?? 0) * params.moq).toFixed(2)}
Lead Time: ${params.leadTime}
Region: ${params.region}
${params.modNote ? `Special instructions: ${params.modNote}` : ""}
Status: HUMAN APPROVED

Include standard T&Cs, payment terms (Net 30), and delivery expectations.
Return ONLY the plain text PO — no JSON wrapper.`,
    1500
  );
  return typeof result === "string" ? result : `PURCHASE ORDER ${poNumber}\nDate: ${today}\nSupplier: ${params.supplier}\nMPN: ${params.mpn}\nUnit Price: USD ${params.price?.toFixed(4)}\nQty: ${params.moq}\nStatus: HUMAN APPROVED`;
}

// ── Price / stock monitor ─────────────────────────────────────────────────────
export async function analyzeMarketData(stockData: SupplierResult[]) {
  return claudeJson<{
    alert: boolean; urgency: "none" | "low" | "medium" | "high";
    summary: string; recommendation: "buy_now" | "watch" | "hold";
    flaggedParts: string[];
  }>(
    `You are a procurement analyst monitoring electronic parts market data.
Analyze this live supplier data and flag:
1. Stock dropping below 100 units for any part
2. Lead times exceeding 8 weeks
3. Any part with zero stock across all suppliers

Data: ${JSON.stringify(stockData.slice(0, 20))}

Respond ONLY with raw JSON:
{"alert":true,"urgency":"none|low|medium|high","summary":"max 200 chars","recommendation":"buy_now|watch|hold","flaggedParts":["mpn1"]}`,
    400
  );
}

// ── Supabase: Cache ───────────────────────────────────────────────────────────
const CACHE_TTL_HOURS = 24;

export async function checkCache(mpnNormalized: string) {
  try {
    const { data } = await supabaseAdmin
      .from("search_cache").select("*").eq("mpn_normalized", mpnNormalized).single();
    if (!data) return null;
    const ageHours = (Date.now() - new Date(data.updated_at).getTime()) / 3_600_000;
    return ageHours < CACHE_TTL_HOURS ? data : null;
  } catch { return null; }
}

export async function saveCache(
  mpnNormalized: string, results: SupplierResult[], recommendation: ClaudeRanking | null,
  variantResults: VariantResult[], equivalentIcs: EquivalentIC[]
) {
  try {
    await supabaseAdmin.from("search_cache").upsert(
      { mpn_normalized: mpnNormalized, results, claude_recommendation: recommendation, variant_results: variantResults, equivalent_ics: equivalentIcs, updated_at: new Date().toISOString(), hit_count: 1 },
      { onConflict: "mpn_normalized" }
    );
  } catch (e: any) { console.error("[Cache] Save failed:", e?.message); }
}

export async function bumpHitCount(mpnNormalized: string, current: number) {
  try { await supabaseAdmin.from("search_cache").update({ hit_count: current + 1 }).eq("mpn_normalized", mpnNormalized); } catch {}
}

// ── Supabase: Audit trail ─────────────────────────────────────────────────────
export async function logAuditEvent(event: AuditEvent) {
  try {
    await supabaseAdmin.from("audit_trail").insert({
      action: event.action,
      supplier: event.supplier ?? null,
      mpn: event.mpn ?? null,
      unit_price: event.unit_price ?? null,
      total_value: event.total_value ?? null,
      decision: event.decision ?? null,
      details: event.details ? JSON.stringify(event.details) : null,
      created_at: new Date().toISOString(),
    });
  } catch (e: any) { console.error("[Audit] Log failed:", e?.message); }
}

// ── Supabase: HITL queue ──────────────────────────────────────────────────────
export async function createHitlRequest(req: Omit<HitlRequest, "createdAt" | "status">): Promise<string> {
  const id = req.id;
  try {
    await supabaseAdmin.from("hitl_queue").insert({
      id,
      action: req.action,
      supplier: req.supplier,
      mpn: req.mpn,
      price: req.price,
      currency: req.currency,
      stock: req.stock,
      moq: req.moq,
      lead_time: req.leadTime,
      region: req.region,
      url: req.url,
      total_value: req.totalValue,
      reason: req.reason,
      ai_recommendation: req.aiRecommendation ?? null,
      status: "pending",
      created_at: new Date().toISOString(),
    });
  } catch (e: any) { console.error("[HITL] Queue insert failed:", e?.message); }
  return id;
}

export async function updateHitlStatus(id: string, status: "approved" | "rejected" | "modified", modifiedNote?: string) {
  try {
    await supabaseAdmin.from("hitl_queue").update({
      status,
      modified_note: modifiedNote ?? null,
      decided_at: new Date().toISOString(),
    }).eq("id", id);
  } catch (e: any) { console.error("[HITL] Status update failed:", e?.message); }
}

export async function getPendingHitlRequests(): Promise<HitlRequest[]> {
  try {
    const { data } = await supabaseAdmin
      .from("hitl_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });
    return (data ?? []).map(r => ({
      id: r.id, action: r.action, supplier: r.supplier, mpn: r.mpn,
      price: r.price, currency: r.currency, stock: r.stock, moq: r.moq,
      leadTime: r.lead_time, region: r.region, url: r.url,
      totalValue: r.total_value, reason: r.reason,
      aiRecommendation: r.ai_recommendation, createdAt: r.created_at,
      status: r.status, modifiedNote: r.modified_note,
    }));
  } catch { return []; }
}

export async function getAllHitlRequests(): Promise<HitlRequest[]> {
  try {
    const { data } = await supabaseAdmin
      .from("hitl_queue")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map(r => ({
      id: r.id, action: r.action, supplier: r.supplier, mpn: r.mpn,
      price: r.price, currency: r.currency, stock: r.stock, moq: r.moq,
      leadTime: r.lead_time, region: r.region, url: r.url,
      totalValue: r.total_value, reason: r.reason,
      aiRecommendation: r.ai_recommendation, createdAt: r.created_at,
      status: r.status, modifiedNote: r.modified_note,
    }));
  } catch { return []; }
}