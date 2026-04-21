"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import {
  Search, Settings, X, CheckCircle, Package, Clock,
  Download, Zap, Database, RefreshCw, ShieldCheck, Lock,
  ChevronRight, Star, AlertCircle, Loader2,
  History, Trash2, RotateCcw,
  ExternalLink, Cpu, ShoppingCart,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CatalogItem { part: string; desc: string; }

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

interface HistoryItem { id: string; part_number: string; searched_at: string; }

type SearchPhase = "idle" | "searching" | "done" | "error";

// ── Supabase singleton ────────────────────────────────────────────────────────
const getSupabase = (() => {
  let inst: ReturnType<typeof createClient> | null = null;
  return () => {
    if (inst) return inst;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) inst = createClient(url, key);
    } catch {}
    return inst;
  };
})();
const supabase = getSupabase();

// ── Constants ─────────────────────────────────────────────────────────────────
// Must match SUPPLIERS array in small-suppliers/route.ts exactly
const SUPPLIER_NAMES: Array<{ name: string; tier: "standard" | "chinese" }> = [
  { name: "LCSC",     tier: "standard" },
  { name: "UTSource", tier: "chinese"  },
  { name: "Alibaba",  tier: "chinese"  },
];
const FALLBACK_CATALOG: CatalogItem[] = [
  { part: "STM32F103C8T6",      desc: "ARM Cortex-M3 Microcontroller" },
  { part: "NRF52840-QIAA-R",    desc: "Bluetooth 5.0 SoC" },
  { part: "LM358DR2G",          desc: "Dual Op-Amp, SOIC-8" },
  { part: "GRM188R71H104KA93D", desc: "Ceramic Capacitor 100nF" },
  { part: "TPS63020DSJR",       desc: "Buck-Boost Converter" },
  { part: "ESP32-WROOM-32",     desc: "Wi-Fi + BT SoC Module" },
  { part: "AMS1117-3.3",        desc: "LDO Voltage Regulator 3.3V" },
  { part: "MPU-6050",           desc: "6-Axis IMU Sensor" },
];

const SETTINGS_TOGGLES = [
  { label: "NetSuite ERP Sync",        sub: "Connect to Oracle NetSuite GL",  icon: Database,    enabled: false },
  { label: "SAP S/4HANA Connector",    sub: "Bidirectional PO sync",          icon: RefreshCw,   enabled: false },
  { label: "Slack Procurement Alerts", sub: "Notify #procurement channel",    icon: Zap,         enabled: false },
  { label: "SOC 2 Audit Logging",      sub: "Immutable event trail",          icon: ShieldCheck, enabled: true  },
];

const TIER_STYLE = {
  standard: {
    color: "#a5b4fc",
    bg: "rgba(99,102,241,0.12)",
    border: "rgba(99,102,241,0.3)",
  },
  chinese: {
    color: "#fb923c",
    bg: "rgba(249,115,22,0.10)",
    border: "rgba(249,115,22,0.3)",
  },
};

// ── Atom logo ─────────────────────────────────────────────────────────────────
function AtomLogo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="url(#al1)" strokeWidth="3.5" fill="none"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="url(#al2)" strokeWidth="3.5" fill="none" transform="rotate(60 50 50)"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="url(#al3)" strokeWidth="3.5" fill="none" transform="rotate(120 50 50)"/>
      <circle cx="50" cy="50" r="9" fill="url(#alC)"/>
      <circle cx="95" cy="50" r="4.5" fill="#60a5fa"/>
      <circle cx="27.5" cy="25.5" r="4.5" fill="#818cf8"/>
      <circle cx="27.5" cy="74.5" r="4.5" fill="#6366f1"/>
      <defs>
        <linearGradient id="al1" x1="5" y1="50" x2="95" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#818cf8"/><stop offset="1" stopColor="#60a5fa"/></linearGradient>
        <linearGradient id="al2" x1="5" y1="50" x2="95" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#38bdf8"/></linearGradient>
        <linearGradient id="al3" x1="5" y1="50" x2="95" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#60a5fa"/></linearGradient>
        <radialGradient id="alC" cx="50%" cy="50%" r="50%"><stop stopColor="#60a5fa"/><stop offset="1" stopColor="#6366f1"/></radialGradient>
      </defs>
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl animate-slide-up"
      style={{ background: "rgba(30,27,75,0.97)", border: "1px solid rgba(99,102,241,0.3)", backdropFilter: "blur(12px)" }}>
      <CheckCircle size={16} className="text-indigo-400" />
      <span className="font-medium text-sm text-white">{message}</span>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div className="relative w-9 h-5 rounded-full transition-colors duration-200"
      style={{ background: enabled ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.1)" }}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${enabled ? "translate-x-4 bg-white" : "translate-x-0.5 bg-white/60"}`} />
    </div>
  );
}

// ── StockBadge ────────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock > 1000) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
      {stock.toLocaleString()} units
    </span>
  );
  if (stock > 0) return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>
      {stock.toLocaleString()} units
    </span>
  );
  return (
    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>
      Out of Stock
    </span>
  );
}

// ── SupplierCard ──────────────────────────────────────────────────────────────
function SupplierCard({
  supplier, loading = false, name, tier, isRecommended = false,
}: {
  supplier?: SupplierResult;
  name?: string;
  tier?: "standard" | "chinese";
  loading?: boolean;
  isRecommended?: boolean;
}) {
  const displayName = supplier?.supplier ?? name ?? "Supplier";
  const cardTier = supplier?.tier ?? tier ?? "standard";
  const style = TIER_STYLE[cardTier];

  if (loading) return (
    <div className="rounded-2xl p-5 animate-fade-in"
      style={{ background: style.bg, border: `1px solid ${style.border}` }}>
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-white/70 text-sm">{displayName}</div>
        <Loader2 size={14} className="animate-spin" style={{ color: style.color }} />
      </div>
      <div className="rounded-xl px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: style.color }} />
          <span className="text-xs font-mono" style={{ color: style.color }}>Searching via TinyFish...</span>
        </div>
        {["Finding product URL...", "Fetching page content...", "Parsing price & stock..."].map((l, i) => (
          <div key={i} className="flex items-center gap-2 mt-1">
            <div className="w-1 h-1 rounded-full bg-white/10" />
            <span className="text-xs text-white/20 font-mono">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="relative rounded-2xl p-5 animate-fade-in transition-all"
      style={isRecommended
        ? { background: "rgba(99,102,241,0.10)", border: "1.5px solid rgba(99,102,241,0.45)", boxShadow: "0 8px 40px rgba(99,102,241,0.18)" }
        : { background: style.bg, border: `1px solid ${style.border}` }}>

      {isRecommended && (
        <div className="absolute -top-3 left-4 flex items-center gap-1.5 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg"
          style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}>
          <Star size={10} />Best Choice
        </div>
      )}

      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-white/90 text-base">{supplier.supplier}</span>
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ color: style.color, background: style.bg, border: `1px solid ${style.border}` }}>
              {cardTier === "standard" ? "Standard" : "Chinese"}
            </span>
          </div>
          <div className="text-white/30 text-xs font-mono">{supplier.mpn}</div>
        </div>
        <div className="text-right">
          {supplier.price != null ? (
            <>
              <div className="text-xl font-bold text-white">
                {supplier.currency} {supplier.price.toFixed(supplier.currency === "CNY" ? 2 : 3)}
              </div>
              <div className="text-white/30 text-xs">per unit · MOQ {supplier.moq}</div>
            </>
          ) : (
            <div className="text-sm text-white/40">Not listed</div>
          )}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-white/40"><Package size={11} />Stock</div>
          <StockBadge stock={supplier.stock} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-white/40"><Clock size={11} />Lead Time</div>
          <span className="text-xs font-semibold text-white/70">{supplier.leadTime}</span>
        </div>
      </div>

      <div className="mb-4">
        <div className="text-xs font-semibold text-white/60 mb-2">Reasoning</div>
        <div className="text-xs text-white/50 leading-relaxed bg-white/5 rounded-lg p-3 border border-white/10">
          {supplier.reason}
        </div>
      </div>

      <a href={supplier.url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 group transition-colors pt-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs text-white/20 truncate flex-1 group-hover:text-indigo-400 transition-colors">{supplier.url}</span>
        <ExternalLink size={11} className="text-white/15 group-hover:text-indigo-400 shrink-0 transition-colors" />
      </a>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function OmniProcure() {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([]);
  const [selectedPart, setSelectedPart] = useState<CatalogItem | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [searching, setSearching] = useState<Array<{ name: string; tier: "standard" | "chinese" }>>([]);
  const [found, setFound] = useState<SupplierResult[]>([]);
  const [recommendation, setRecommendation] = useState<ClaudeRanking | null>(null);
  const [cached, setCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [currentMpn, setCurrentMpn] = useState("");

  // ── History ───────────────────────────────────────────────────────────────
  const loadHistory = useCallback(async () => {
    if (!supabase) { setSearchHistory([]); return; }
    try {
      // Load history without user filter - show all recent searches
      const { data } = await supabase
        .from("search_history").select("id, part_number, searched_at")
        .order("searched_at", { ascending: false }).limit(20);
      setSearchHistory((data as HistoryItem[]) ?? []);
    } catch { setSearchHistory([]); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Catalog ───────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      if (!supabase) { setCatalog(FALLBACK_CATALOG); return; }
      try {
        const { data, error } = await supabase.from("supplier_catalog").select("part, desc").limit(100);
        if (error || !data?.length) throw new Error();
        setCatalog(data as CatalogItem[]);
      } catch { setCatalog(FALLBACK_CATALOG); }
    }
    load();
  }, []);

  // ── Suggestions ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim() || selectedPart) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    setSuggestions(catalog.filter(c => c.part.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)).slice(0, 6));
  }, [query, catalog, selectedPart]);

  const clearHistory = useCallback(async () => {
    if (!supabase) return;
    try {
      // Clear all history since no user authentication
      await (supabase as any).from("search_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      setSearchHistory([]);
    } catch {}
  }, []);

  const deleteHistoryItem = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      await (supabase as any).from("search_history").delete().eq("id", id);
      setSearchHistory(prev => prev.filter(h => h.id !== id));
    } catch {}
  }, []);

  // ── Main search ───────────────────────────────────────────────────────────
  const runSearch = useCallback(async (mpn: string) => {
    const clean = mpn.trim().toUpperCase();
    setCurrentMpn(clean);
    setSelectedPart({ part: clean, desc: "" });
    setQuery(clean);
    setSuggestions([]);
    setPhase("searching");
    setSearching([]);
    setFound([]);
    setRecommendation(null);
    setCached(false);
    setCachedAt(null);

    if (supabase) {
      try {
        // Insert search history without user association
        await (supabase as any).from("search_history").insert({ part_number: clean });
        loadHistory();
      } catch {}
    }

    try {
      const res = await fetch("/api/small-suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpn: clean, userId: null }),
      });
      if (!res.ok) { setPhase("error"); return; }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const ev = JSON.parse(raw);
            if (ev.type === "supplier_searching") {
              setSearching(prev => [...prev, { name: ev.name, tier: ev.tier ?? "standard" }]);
            }
            if (ev.type === "supplier_found") {
              setFound(prev => [...prev, ev.supplier]);
            }
            if (ev.type === "complete") {
              setRecommendation(ev.recommendation ?? null);
              setCached(ev.cached ?? false);
              setCachedAt(ev.cachedAt ?? null);
              setPhase("done");
            }
            if (ev.type === "error") setPhase("error");
          } catch {}
        }
      }
      setPhase("done");
    } catch { setPhase("error"); }
  }, [loadHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() && !selectedPart) runSearch(query.trim());
  }, [query, selectedPart, runSearch]);

  const reset = () => {
    setQuery(""); setSelectedPart(null); setCurrentMpn("");
    setPhase("idle");
    setSearching([]); setFound([]);
    setRecommendation(null); setCached(false); setCachedAt(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const generatePDF = useCallback(async () => {
    const foundWithPrice = found.filter(s => s.price != null);
    const winner = recommendation && foundWithPrice[recommendation.recommendedIndex] ? foundWithPrice[recommendation.recommendedIndex] : foundWithPrice[0];
    if (!winner) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const poNumber = `PO-${Date.now().toString().slice(-8)}`;
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    doc.setFillColor(15,23,42); doc.rect(0,0,210,40,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont("helvetica","bold");
    doc.text("OMNIPROCURE",14,18);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(148,163,184);
    doc.text("Autonomous B2B Procurement Platform",14,26);
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("PURCHASE ORDER",196,18,{align:"right"});
    doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text(poNumber,196,26,{align:"right"});

    doc.setTextColor(30,41,59); doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("FROM",14,52);
    doc.setFont("helvetica","normal"); doc.setTextColor(71,85,105);
    doc.text("Acme Electronics Ltd.",14,58); doc.text("12 Innovation Park, Pune 411057",14,63);
    doc.text("GST: 27AABCA1234F1Z5",14,68); doc.text("procurement@acme-electronics.com",14,73);

    doc.setTextColor(30,41,59); doc.setFont("helvetica","bold"); doc.text("SUPPLIER",110,52);
    doc.setFont("helvetica","normal"); doc.setTextColor(71,85,105);
    doc.text(winner.supplier,110,58);
    doc.text(`Platform: ${winner.tier==="chinese"?"Chinese Marketplace":"Authorized Distributor"}`,110,63);
    doc.text(`Stock: ${winner.stock.toLocaleString()} units`,110,68);
    doc.text(`Lead Time: ${winner.leadTime}`,110,73);

    doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(14,80,196,80);
    doc.setFontSize(9); doc.setTextColor(71,85,105);
    doc.text(`Issue Date: ${today}`,14,87); doc.text("Valid For: 30 Days",100,87); doc.text(`Currency: ${winner.currency}`,160,87);

    autoTable(doc,{
      startY:95,
      head:[["#","Part Number","Supplier","Platform","Unit Price","MOQ","Total (MOQ)"]],
      body:[["1",currentMpn,winner.supplier,winner.tier==="chinese"?"Chinese":"Standard",
        `${winner.currency} ${winner.price?.toFixed(winner.currency==="CNY"?2:3)??"TBD"}`,
        String(winner.moq),`${winner.currency} ${((winner.price??0)*winner.moq).toFixed(2)}`]],
      headStyles:{fillColor:[15,23,42],textColor:255,fontStyle:"bold",fontSize:8},
      bodyStyles:{fontSize:8,textColor:[30,41,59]},
      alternateRowStyles:{fillColor:[248,250,252]},
    });

    const finalY=(doc as any).lastAutoTable.finalY+10;
    if(recommendation){
      doc.setFillColor(74,111,165); doc.roundedRect(14,finalY,130,14,2,2,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont("helvetica","bold");
      doc.text("AI RECOMMENDED — "+recommendation.reason.slice(0,75),17,finalY+9);
    }
    doc.setFillColor(248,250,252); doc.rect(0,270,210,27,"F");
    doc.setTextColor(148,163,184); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
    doc.text("Auto-generated by OmniProcure AI. Verify pricing before submission.",105,278,{align:"center"});
    doc.text("OmniProcure · TinyFish Search+Fetch · Claude AI · omniprocure.online",105,284,{align:"center"});
    doc.save(`Purchase_Order_${currentMpn}.pdf`);
    setToast("PO Generated Successfully");
  }, [found, currentMpn, recommendation]);

  const handlePDFClick = () => {
    generatePDF();
  };

  const hasResults = phase !== "idle";

  // Use searching state if available, else fallback to SUPPLIER_NAMES
  const displaySuppliers = searching.length > 0 ? searching : SUPPLIER_NAMES;

  return (
    <div className="min-h-screen font-sans"
      style={{ fontFamily:"var(--font-geist),system-ui,sans-serif", background:"linear-gradient(135deg,#030712 0%,#0f0a2e 40%,#0c1445 70%,#030712 100%)" }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full opacity-20"
          style={{ background:"radial-gradient(circle,#4338ca 0%,transparent 70%)", filter:"blur(80px)" }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full opacity-15"
          style={{ background:"radial-gradient(circle,#1d4ed8 0%,transparent 70%)", filter:"blur(100px)" }} />
      </div>



      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-6"
        style={{ background:"rgba(3,7,18,0.75)", borderBottom:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(20px)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors mr-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <AtomLogo size={28} />
          <span className="font-bold text-[16px] tracking-tight text-white">OmniProcure</span>
          <span className="hidden sm:block text-white/15 text-sm mx-1">|</span>
          <span className="hidden sm:block text-white/40 text-xs font-medium">Command Center</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full"
            style={{ background:"rgba(52,211,153,0.1)", border:"1px solid rgba(52,211,153,0.2)" }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span className="text-xs text-emerald-400 font-semibold">Live</span>
          </div>

          {cached && phase === "done" && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-semibold"
              style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#a5b4fc" }}>
              ⚡ Cached
            </div>
          )}

          <button onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5 transition-colors"
            style={{ border:"1px solid rgba(255,255,255,0.08)" }}>
            <Settings size={15} className="text-white/40" />
          </button>
        </div>
      </nav>

      <main className="relative z-10 pt-16 min-h-screen flex flex-col items-center px-4 pb-16">

        {/* Hero */}
        <div className="mt-14 mb-10 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-5"
            style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.3)", color:"#a5b4fc" }}>
            <Zap size={11} />TinyFish Search + Fetch · Claude AI
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">Autonomous Parts Sourcing</h1>
          <p className="text-white/50 text-sm max-w-xl mx-auto leading-relaxed">
            Enter any MPN.{" "}
            <span className="text-indigo-400 font-semibold">LCSC & UTSource</span>{" "}
            plus{" "}
            <span className="text-orange-400 font-semibold">Alibaba</span>
            {" "}— searched in parallel. Claude AI picks the winner.
          </p>
        </div>

        {/* Search box */}
        <div className="w-full max-w-2xl relative mb-8">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all"
            style={selectedPart
              ? { background:"rgba(255,255,255,0.06)", border:"1.5px solid rgba(99,102,241,0.5)", boxShadow:"0 0 30px rgba(99,102,241,0.15)" }
              : { background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(255,255,255,0.1)" }}>
            {selectedPart
              ? <Lock size={16} className="text-indigo-400 shrink-0" />
              : <Search size={16} className="text-white/30 shrink-0" />}
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown} disabled={!!selectedPart}
              placeholder="Enter MPN e.g. STM32F103C8T6, LM358DR2G…"
              className="flex-1 bg-transparent text-white placeholder-white/25 text-sm outline-none font-mono disabled:cursor-not-allowed"
              autoComplete="off" />
            {selectedPart ? (
              <button onClick={reset} className="text-white/30 hover:text-white/60 transition-colors"><X size={15} /></button>
            ) : query.trim() ? (
              <button onClick={() => runSearch(query.trim())}
                className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-opacity hover:opacity-90"
                style={{ background:"linear-gradient(135deg,#4f46e5,#6366f1)" }}>
                Search
              </button>
            ) : null}
            {!selectedPart && (
              <button onClick={() => setHistoryOpen(h => !h)}
                className="ml-1 w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors"
                style={historyOpen
                  ? { background:"rgba(99,102,241,0.2)", border:"1px solid rgba(99,102,241,0.4)" }
                  : { border:"1px solid rgba(255,255,255,0.08)" }}>
                <History size={14} className={historyOpen ? "text-indigo-400" : "text-white/30"} />
              </button>
            )}
          </div>

          {/* History dropdown */}
          {historyOpen && !selectedPart && (
            <div ref={historyRef}
              className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-30 animate-fade-in"
              style={{ background:"rgba(10,8,30,0.97)", border:"1px solid rgba(99,102,241,0.2)", backdropFilter:"blur(20px)" }}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2">
                  <History size={13} className="text-indigo-400" />
                  <span className="text-xs font-bold text-white/70">Recent</span>
                  <span className="text-xs text-white/25">({searchHistory.length})</span>
                </div>
                {searchHistory.length > 0 && (
                  <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 font-medium">
                    <Trash2 size={11} />Clear
                  </button>
                )}
              </div>
              {searchHistory.length === 0 ? (
                <div className="px-4 py-5 text-center text-xs text-white/25">No searches yet</div>
              ) : (
                <div className="max-h-56 overflow-y-auto">
                  {searchHistory.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 group cursor-pointer transition-colors"
                      style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <button className="flex items-center gap-3 flex-1 text-left"
                        onClick={() => { setHistoryOpen(false); runSearch(item.part_number); }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.2)" }}>
                          <RotateCcw size={12} className="text-indigo-400" />
                        </div>
                        <div>
                          <div className="text-sm font-mono font-semibold text-white/80">{item.part_number}</div>
                          <div className="text-xs text-white/30">
                            {new Date(item.searched_at).toLocaleDateString("en-US", { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                          </div>
                        </div>
                      </button>
                      <button onClick={() => deleteHistoryItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all">
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions dropdown */}
          {query.trim() && !selectedPart && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-30 animate-fade-in"
              style={{ background:"rgba(10,8,30,0.97)", border:"1px solid rgba(255,255,255,0.08)", backdropFilter:"blur(20px)" }}>
              {suggestions.map((item, i) => (
                <button key={i} onClick={() => runSearch(item.part)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.2)" }}>
                    <Package size={13} className="text-indigo-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-white/80">{item.part}</div>
                    <div className="text-xs text-white/30">{item.desc}</div>
                  </div>
                  <ChevronRight size={14} className="text-white/20 ml-auto" />
                </button>
              ))}
              <button onClick={() => runSearch(query.trim())}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                style={{ borderTop:"1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background:"linear-gradient(135deg,#4f46e5,#6366f1)" }}>
                  <Search size={13} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-mono font-semibold text-indigo-400">Search &quot;{query.trim().toUpperCase()}&quot;</div>
                  <div className="text-xs text-white/30">Search all 3 supplier networks</div>
                </div>
                <ChevronRight size={14} className="text-indigo-400/50 ml-auto" />
              </button>
            </div>
          )}
        </div>

        {/* ── RESULTS ── */}
        {hasResults && (
          <div className="w-full max-w-5xl space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background:"rgba(99,102,241,0.12)", border:"1px solid rgba(99,102,241,0.25)", color:"#a5b4fc" }}>
                    <Cpu size={11} />Standard
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background:"rgba(249,115,22,0.10)", border:"1px solid rgba(249,115,22,0.25)", color:"#fb923c" }}>
                    <ShoppingCart size={11} />Chinese
                  </div>
                </div>
                {phase === "searching" && (
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    <Loader2 size={12} className="animate-spin text-indigo-400" />
                    Searching in parallel…
                  </div>
                )}
                {phase === "done" && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                    <CheckCircle size={12} />
                    {found.length} found
                    {cached && cachedAt && (
                      <span className="text-white/25 font-normal ml-1">
                        · cached {new Date(cachedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-xs text-white/20 font-mono">{currentMpn}</div>
            </div>

            {/* Claude recommendation banner */}
            {recommendation && found.length > 0 && (
              <div className="rounded-2xl px-5 py-4 flex items-start gap-3 animate-fade-in"
                style={{ background:"rgba(99,102,241,0.08)", border:"1px solid rgba(99,102,241,0.2)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background:"linear-gradient(135deg,#4f46e5,#6366f1)" }}>
                  <Star size={14} className="text-white" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-sm text-white/90 mb-0.5">Claude AI Recommendation</div>
                  <div className="text-sm text-white/50">{recommendation.reason}</div>
                </div>
                <div className="text-xs font-bold px-2 py-1 rounded-lg text-indigo-300"
                  style={{ background:"rgba(99,102,241,0.15)", border:"1px solid rgba(99,102,241,0.2)" }}>
                  {recommendation.winner}
                </div>
              </div>
            )}

            {/* Supplier grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {displaySuppliers.map(({ name, tier }) => {
                const supplierResult = found.find(s => s.supplier === name);
                const isLoading = !supplierResult && phase === "searching";
                const foundWithPrice = found.filter(s => s.price != null);
                const supplierIndex = foundWithPrice.findIndex(s => s.supplier === name);
                const isRecommended = recommendation && supplierIndex >= 0 ? supplierIndex === recommendation.recommendedIndex : false;
                return <SupplierCard key={name} supplier={supplierResult} loading={isLoading} name={name} tier={tier} isRecommended={isRecommended} />;
              })}
            </div>

            {phase === "error" && (
              <div className="rounded-2xl px-5 py-5 flex items-start gap-4"
                style={{ background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.2)" }}>
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-white/80 font-semibold text-sm mb-1">Search failed</div>
                  <div className="text-white/40 text-sm">Check your connection and try again.</div>
                </div>
              </div>
            )}

            {phase === "done" && found.length === 0 && (
              <div className="rounded-2xl px-5 py-5 flex items-start gap-4"
                style={{ background:"rgba(248,113,113,0.06)", border:"1px solid rgba(248,113,113,0.2)" }}>
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-white/80 font-semibold text-sm mb-1">No results found for {currentMpn}</div>
                  <div className="text-white/40 text-sm">Verify the MPN and try again. Some parts may not be listed on these platforms.</div>
                </div>
              </div>
            )}

            {phase === "done" && found.length > 0 && (
              <button onClick={handlePDFClick}
                className="w-full flex items-center justify-center gap-2.5 text-white font-semibold py-3.5 rounded-xl animate-fade-in transition-opacity hover:opacity-90"
                style={{ background:"linear-gradient(135deg,#4f46e5,#6366f1)", boxShadow:"0 4px 20px rgba(99,102,241,0.3)" }}>
                <Download size={16} />
                Generate Purchase Order (PDF)
              </button>
            )}

            <button onClick={reset} className="w-full text-center text-sm text-white/20 hover:text-white/40 py-2 transition-colors">
              ← Search a different part
            </button>
          </div>
        )}

        {/* ── IDLE ── */}
        {!hasResults && (
          <div className="mt-2 w-full max-w-4xl space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl p-6" style={{ background:"rgba(99,102,241,0.06)", border:"1px solid rgba(99,102,241,0.2)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background:"linear-gradient(135deg,#4f46e5,#6366f1)" }}>
                    <Cpu size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-white/90 text-sm">Standard Distributors</div>
                    <div className="text-xs text-indigo-400">LCSC</div>
                  </div>
                </div>
                <div className="text-xs text-white/40 leading-relaxed">
                  Authorized distributors with verified stock, structured pricing, and reliable lead times. Best for production orders.
                </div>
              </div>
              <div className="rounded-2xl p-6" style={{ background:"rgba(249,115,22,0.06)", border:"1px solid rgba(249,115,22,0.2)" }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background:"linear-gradient(135deg,#c2410c,#ea580c)" }}>
                    <ShoppingCart size={18} className="text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-white/90 text-sm">Chinese Platforms</div>
                    <div className="text-xs text-orange-400">Alibaba · UTSource</div>
                  </div>
                </div>
                <div className="text-xs text-white/40 leading-relaxed">
                  Competitive pricing for samples and bulk. Alibaba for large orders, UTSource for authorized IC sourcing direct from China.
                </div>
              </div>
            </div>

            <div className="rounded-xl px-4 py-3 flex items-center gap-3"
              style={{ background:"rgba(52,211,153,0.06)", border:"1px solid rgba(52,211,153,0.15)" }}>
              <Zap size={14} className="text-emerald-400 shrink-0" />
              <p className="text-xs text-white/40">
                <span className="text-emerald-400 font-semibold">TinyFish Search + Fetch</span>
                {" "}— all 3 suppliers searched in parallel using open product pages. Results in ~15s.
                Cached results return <span className="text-white/70 font-semibold">instantly.</span>
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-3">Try these parts</p>
              <div className="flex flex-wrap gap-2">
                {FALLBACK_CATALOG.map((item, i) => (
                  <button key={i} onClick={() => runSearch(item.part)}
                    className="text-white/50 text-xs font-mono font-medium px-3 py-1.5 rounded-lg hover:text-white/80 transition-all"
                    style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}>
                    {item.part}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings panel */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-40 transition-opacity"
            style={{ background:"rgba(0,0,0,0.5)", backdropFilter:"blur(4px)" }}
            onClick={() => setSettingsOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col shadow-2xl"
            style={{ background:"rgba(8,5,25,0.98)", borderLeft:"1px solid rgba(99,102,241,0.15)" }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2">
                <Settings size={15} className="text-indigo-400" />
                <span className="font-bold text-sm text-white/80">Enterprise Settings</span>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-white/30 hover:text-white/60 transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-4">Integrations</p>
              {SETTINGS_TOGGLES.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-3.5"
                  style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)" }}>
                      <t.icon size={13} className="text-white/40" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white/70">{t.label}</div>
                      <div className="text-xs text-white/30">{t.sub}</div>
                    </div>
                  </div>
                  <Toggle enabled={t.enabled} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4" style={{ borderTop:"1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs text-white/20 text-center">OmniProcure v3.0.0 · TinyFish S+F</p>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

    </div>
  );
}