"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import {
  Search, Settings, X, CheckCircle, Package,
  Download, Zap, Database, RefreshCw, ShieldCheck, Lock,
  ChevronRight, Star, AlertCircle, Loader2,
  ExternalLink, Globe, ChevronUp, ChevronDown, ArrowUpDown,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CatalogItem { part: string; desc: string; }

interface SupplierResult {
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

type SearchPhase = "idle" | "searching" | "done" | "error";
type SortKey = "ai" | "price" | "stock" | "leadtime";
type SortDir = "asc" | "desc";

// ── Supabase ──────────────────────────────────────────────────────────────────
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

// ── Atom logo ─────────────────────────────────────────────────────────────────
function AtomLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="white" strokeWidth="4" fill="none"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="white" strokeWidth="4" fill="none" transform="rotate(60 50 50)" opacity="0.6"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="white" strokeWidth="4" fill="none" transform="rotate(120 50 50)" opacity="0.3"/>
      <circle cx="50" cy="50" r="7" fill="white"/>
    </svg>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-2xl"
      style={{ background: "#000", border: "1px solid #333" }}>
      <CheckCircle size={13} className="text-white shrink-0" />
      <span className="text-xs font-mono text-white">{message}</span>
    </div>
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div className="relative w-9 h-5 rounded-full transition-colors duration-200"
      style={{ background: enabled ? "#fff" : "#222" }}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-transform duration-200 ${enabled ? "translate-x-4 bg-black" : "translate-x-0.5 bg-neutral-600"}`} />
    </div>
  );
}

// ── StockBadge ────────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock > 1000) return (
    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded whitespace-nowrap"
      style={{ color: "#22c55e", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)" }}>
      {stock.toLocaleString()}
    </span>
  );
  if (stock > 0) return (
    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded whitespace-nowrap"
      style={{ color: "#eab308", background: "rgba(234,179,8,0.07)", border: "1px solid rgba(234,179,8,0.15)" }}>
      {stock.toLocaleString()}
    </span>
  );
  return (
    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded whitespace-nowrap"
      style={{ color: "#444", background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
      0
    </span>
  );
}

// ── SortIcon ──────────────────────────────────────────────────────────────────
function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== column) return <ArrowUpDown size={10} style={{ color: "#333" }} />;
  return sortDir === "asc"
    ? <ChevronUp size={10} className="text-white" />
    : <ChevronDown size={10} className="text-white" />;
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

  const [phase, setPhase] = useState<SearchPhase>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [found, setFound] = useState<SupplierResult[]>([]);
  const [recommendation, setRecommendation] = useState<ClaudeRanking | null>(null);
  const [cached, setCached] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [currentMpn, setCurrentMpn] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("ai");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
    setSuggestions(catalog.filter(c =>
      c.part.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
    ).slice(0, 6));
  }, [query, catalog, selectedPart]);

  // ── Handle column sort ────────────────────────────────────────────────────
  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ── Sorted + split results ────────────────────────────────────────────────
  const { actionable, passive } = (() => {
    const act = found.filter(s => s.hasPrice && s.stock > 0);
    const pas = found.filter(s => !s.hasPrice || s.stock === 0);

    const sortFn = (a: SupplierResult, b: SupplierResult) => {
      let diff = 0;
      if (sortKey === "price") diff = (a.price ?? 9999) - (b.price ?? 9999);
      else if (sortKey === "stock") diff = b.stock - a.stock;
      else if (sortKey === "leadtime") diff = a.stock > 0 ? -1 : 1;
      else {
        const aRec = recommendation && found.indexOf(a) === recommendation.recommendedIndex ? -1 : 0;
        const bRec = recommendation && found.indexOf(b) === recommendation.recommendedIndex ? -1 : 0;
        diff = aRec - bRec || (a.price ?? 9999) - (b.price ?? 9999);
      }
      return sortDir === "asc" ? diff : -diff;
    };

    return { actionable: [...act].sort(sortFn), passive: pas };
  })();

  // ── Main search ───────────────────────────────────────────────────────────
  const runSearch = useCallback(async (mpn: string) => {
    const clean = mpn.trim().toUpperCase();
    setCurrentMpn(clean);
    setSelectedPart({ part: clean, desc: "" });
    setQuery(clean);
    setSuggestions([]);
    setPhase("searching");
    setIsLoading(true);
    setFound([]);
    setRecommendation(null);
    setCached(false);
    setCachedAt(null);
    setSortKey("ai");
    setSortDir("asc");

    try {
      const res = await fetch("/api/small-suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mpn: clean }),
      });
      if (!res.ok) { setPhase("error"); setIsLoading(false); return; }

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
            if (ev.type === "supplier_found") setFound(prev => [...prev, ev.supplier]);
            if (ev.type === "complete") {
              setRecommendation(ev.recommendation ?? null);
              setCached(ev.cached ?? false);
              setCachedAt(ev.cachedAt ?? null);
              setPhase("done");
              setIsLoading(false);
            }
            if (ev.type === "error") { setPhase("error"); setIsLoading(false); }
          } catch {}
        }
      }
      setPhase("done");
      setIsLoading(false);
    } catch { setPhase("error"); setIsLoading(false); }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() && !selectedPart) runSearch(query.trim());
  }, [query, selectedPart, runSearch]);

  const reset = () => {
    setQuery(""); setSelectedPart(null); setCurrentMpn("");
    setPhase("idle"); setIsLoading(false);
    setFound([]); setRecommendation(null);
    setCached(false); setCachedAt(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // ── PDF ───────────────────────────────────────────────────────────────────
  const generatePDF = useCallback(async (supplier: SupplierResult) => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const poNumber = `PO-${Date.now().toString().slice(-8)}`;
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    doc.setFillColor(0,0,0); doc.rect(0,0,210,40,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont("helvetica","bold");
    doc.text("OMNIPROCURE",14,18);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(160,160,160);
    doc.text("Autonomous B2B Procurement Platform",14,26);
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("PURCHASE ORDER",196,18,{align:"right"});
    doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text(poNumber,196,26,{align:"right"});

    doc.setTextColor(30,30,30); doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("FROM",14,52);
    doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
    doc.text("Your Company Name",14,58);
    doc.text("Your Address",14,63);
    doc.text("procurement@yourcompany.com",14,68);

    doc.setTextColor(30,30,30); doc.setFont("helvetica","bold"); doc.text("SUPPLIER",110,52);
    doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
    doc.text(supplier.supplier,110,58);
    doc.text(`Region: ${supplier.region || "Global"}`,110,63);
    doc.text(`Stock: ${supplier.stock.toLocaleString()} units`,110,68);
    doc.text(`Lead Time: ${supplier.leadTime}`,110,73);

    doc.setDrawColor(200,200,200); doc.setLineWidth(0.3); doc.line(14,80,196,80);
    doc.setFontSize(9); doc.setTextColor(80,80,80);
    doc.text(`Issue Date: ${today}`,14,87);
    doc.text("Valid For: 30 Days",100,87);
    doc.text("Currency: USD",160,87);

    autoTable(doc,{
      startY: 95,
      head:[["#","Part Number","Supplier","Region","Unit Price (USD)","MOQ","Total (MOQ)"]],
      body:[["1", currentMpn, supplier.supplier, supplier.region || "Global",
        `USD ${supplier.price?.toFixed(3) ?? "TBD"}`,
        String(supplier.moq),
        `USD ${((supplier.price ?? 0) * supplier.moq).toFixed(2)}`]],
      headStyles:{fillColor:[0,0,0],textColor:255,fontStyle:"bold",fontSize:8},
      bodyStyles:{fontSize:8,textColor:[30,30,30]},
      alternateRowStyles:{fillColor:[248,248,248]},
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const isRec = recommendation && found.indexOf(supplier) === recommendation.recommendedIndex;
    if (isRec && recommendation) {
      doc.setFillColor(0,0,0); doc.roundedRect(14,finalY,170,14,2,2,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont("helvetica","bold");
      doc.text("AI RECOMMENDED — " + recommendation.reason.slice(0,90), 17, finalY+9);
    }

    doc.setFillColor(248,248,248); doc.rect(0,270,210,27,"F");
    doc.setTextColor(160,160,160); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
    doc.text("Auto-generated by OmniProcure AI. Verify pricing before submission.",105,278,{align:"center"});
    doc.text("OmniProcure · OEM Secrets API · Claude AI · omniprocure.online",105,284,{align:"center"});
    doc.save(`PO_${currentMpn}_${supplier.supplier.replace(/\s+/g,"_")}.pdf`);
    setToast(`PO generated for ${supplier.supplier}`);
  }, [found, currentMpn, recommendation]);

  const hasResults = phase !== "idle";

  // ── Table Row ─────────────────────────────────────────────────────────────
  const TableRow = ({ s, isRecommended, dim }: { s: SupplierResult; isRecommended: boolean; dim?: boolean }) => (
    <tr
      className="group transition-colors"
      style={{
        borderBottom: "1px solid #111",
        background: isRecommended ? "#0d0d0d" : "transparent",
        opacity: dim ? 0.3 : 1,
      }}
      onMouseEnter={e => { if (!isRecommended) (e.currentTarget as HTMLElement).style.background = "#060606"; }}
      onMouseLeave={e => { if (!isRecommended) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      {/* Distributor */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {isRecommended && <Star size={10} className="text-white fill-white shrink-0" />}
          <div>
            <div className="text-sm font-mono font-medium text-white whitespace-nowrap">{s.supplier}</div>
            <div className="text-xs font-mono mt-0.5" style={{ color: "#333" }}>{s.mpn}</div>
          </div>
        </div>
      </td>

      {/* Region */}
      <td className="py-3 px-4">
        <span className="text-xs font-mono px-2 py-0.5 rounded whitespace-nowrap"
          style={{ color: "#555", background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
          {s.region || "Global"}
        </span>
      </td>

      {/* Stock */}
      <td className="py-3 px-4 text-center">
        <StockBadge stock={s.stock} />
      </td>

      {/* MOQ */}
      <td className="py-3 px-4 text-center">
        <span className="text-xs font-mono" style={{ color: "#444" }}>{s.moq > 0 ? s.moq : "—"}</span>
      </td>

      {/* Price */}
      <td className="py-3 px-4 text-right">
        {s.price != null ? (
          <span className="text-sm font-mono font-bold text-white">
            {s.price.toFixed(3)}
            <span className="text-xs font-normal ml-1" style={{ color: "#444" }}>USD</span>
          </span>
        ) : (
          <span className="text-xs font-mono italic" style={{ color: "#333" }}>On request</span>
        )}
      </td>

      {/* Lead Time */}
      <td className="py-3 px-4 text-center">
        <span className="text-xs font-mono whitespace-nowrap" style={{ color: "#555" }}>{s.leadTime || "—"}</span>
      </td>

      {/* Actions */}
      <td className="py-3 px-4">
        <div className="flex items-center gap-2 justify-end">
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-mono px-2 py-1 rounded transition-all"
              style={{ color: "#444", border: "1px solid #1a1a1a", background: "#050505" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = "#333"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#444"; (e.currentTarget as HTMLElement).style.borderColor = "#1a1a1a"; }}>
              <ExternalLink size={10} />
              <span className="hidden sm:inline">View</span>
            </a>
          )}
          {s.hasPrice && s.stock > 0 && (
            <button
              onClick={() => generatePDF(s)}
              className="flex items-center gap-1 text-xs font-mono font-bold px-2.5 py-1 rounded transition-all whitespace-nowrap"
              style={isRecommended
                ? { background: "#fff", color: "#000", border: "1px solid #fff" }
                : { background: "#0a0a0a", color: "#888", border: "1px solid #222" }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "#fff";
                (e.currentTarget as HTMLElement).style.color = "#000";
                (e.currentTarget as HTMLElement).style.borderColor = "#fff";
              }}
              onMouseLeave={e => {
                if (!isRecommended) {
                  (e.currentTarget as HTMLElement).style.background = "#0a0a0a";
                  (e.currentTarget as HTMLElement).style.color = "#888";
                  (e.currentTarget as HTMLElement).style.borderColor = "#222";
                }
              }}>
              <Download size={10} />
              PO
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen" style={{ background: "#000", fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-6"
        style={{ background: "#000", borderBottom: "1px solid #111" }}>
        <div className="flex items-center gap-3">
          <Link href="/"
            className="flex items-center gap-1 mr-2 transition-opacity hover:opacity-50"
            style={{ color: "#444" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <AtomLogo size={20} />
          <span className="text-sm font-bold text-white tracking-tight">OmniProcure</span>
          <span className="text-xs px-2 py-0.5 rounded font-mono hidden sm:inline"
            style={{ color: "#444", background: "#0a0a0a", border: "1px solid #111" }}>
            command center
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded font-mono"
            style={{ background: "#0a0a0a", border: "1px solid #111" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: "#fff" }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
            </span>
            <span className="text-xs text-white">live</span>
          </div>

          {cached && phase === "done" && (
            <span className="hidden sm:inline text-xs font-mono px-2.5 py-1 rounded"
              style={{ color: "#555", background: "#0a0a0a", border: "1px solid #111" }}>
              ⚡ cached
            </span>
          )}

          <button onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded flex items-center justify-center transition-all"
            style={{ border: "1px solid #111", background: "#000", color: "#444" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#333"; (e.currentTarget as HTMLElement).style.color = "#fff"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#111"; (e.currentTarget as HTMLElement).style.color = "#444"; }}>
            <Settings size={13} />
          </button>
        </div>
      </nav>

      <main className="pt-14 min-h-screen flex flex-col items-center px-4 pb-16">

        {/* Hero */}
        <div className="mt-16 mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Globe size={11} style={{ color: "#444" }} />
            <span className="text-xs font-mono" style={{ color: "#444" }}>
              OEM Secrets · 140+ Distributors · Claude AI
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mb-3 font-mono">
            Parts Sourcing
          </h1>
          <p className="text-xs max-w-md mx-auto leading-relaxed font-mono" style={{ color: "#444" }}>
            Enter any MPN → search 140+ global distributors → Claude picks the best → generate PO
          </p>
        </div>

        {/* Search */}
        <div className="w-full max-w-2xl relative mb-10">
          <div className="flex items-center gap-3 px-4 py-3 transition-all rounded-lg"
            style={selectedPart
              ? { background: "#0a0a0a", border: "1px solid #fff" }
              : { background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
            {selectedPart
              ? <Lock size={13} style={{ color: "#fff" }} className="shrink-0" />
              : <Search size={13} style={{ color: "#333" }} className="shrink-0" />}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!!selectedPart}
              placeholder="STM32F103C8T6, MPU-6050, LM358DR2G…"
              className="flex-1 bg-transparent text-white text-sm outline-none font-mono disabled:cursor-not-allowed placeholder-neutral-700"
              autoComplete="off"
            />
            {selectedPart ? (
              <button onClick={reset} style={{ color: "#444" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#fff"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#444"}>
                <X size={13} />
              </button>
            ) : query.trim() ? (
              <button
                onClick={() => runSearch(query.trim())}
                className="text-xs font-mono font-bold px-3 py-1.5 rounded transition-all"
                style={{ background: "#fff", color: "#000" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#e5e5e5"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#fff"}>
                Search ↵
              </button>
            ) : null}
          </div>

          {/* Suggestions */}
          {query.trim() && !selectedPart && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 overflow-hidden z-30 rounded-lg"
              style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
              {suggestions.map((item, i) => (
                <button key={i} onClick={() => runSearch(item.part)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ borderBottom: "1px solid #0d0d0d" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#0a0a0a"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  <Package size={11} style={{ color: "#333" }} className="shrink-0" />
                  <div>
                    <div className="text-xs font-mono font-bold text-white">{item.part}</div>
                    <div className="text-xs font-mono mt-0.5" style={{ color: "#333" }}>{item.desc}</div>
                  </div>
                  <ChevronRight size={11} style={{ color: "#222" }} className="ml-auto" />
                </button>
              ))}
              <button onClick={() => runSearch(query.trim())}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#0a0a0a"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <Search size={11} style={{ color: "#fff" }} className="shrink-0" />
                <span className="text-xs font-mono font-bold text-white">
                  Search &quot;{query.trim().toUpperCase()}&quot;
                </span>
                <ChevronRight size={11} style={{ color: "#333" }} className="ml-auto" />
              </button>
            </div>
          )}
        </div>

        {/* ── RESULTS ── */}
        {hasResults && (
          <div className="w-full max-w-6xl space-y-3">

            {/* Status */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <div className="flex items-center gap-3">
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "#444" }}>
                    <Loader2 size={11} className="animate-spin text-white" />
                    querying 140+ distributors…
                  </div>
                )}
                {phase === "done" && (
                  <div className="flex items-center gap-1.5 text-xs font-mono" style={{ color: "#555" }}>
                    <CheckCircle size={11} className="text-white" />
                    {found.length} suppliers · {actionable.length} actionable
                    {cached && cachedAt && (
                      <span style={{ color: "#333" }}>· cached {new Date(cachedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="text-xs font-mono font-bold text-white">{currentMpn}</div>
            </div>

            {/* AI Banner */}
            {recommendation && actionable.length > 0 && (
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg"
                style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
                <Star size={11} className="text-white fill-white shrink-0" />
                <p className="text-xs font-mono" style={{ color: "#555" }}>
                  <span className="text-white font-bold">ai pick: {recommendation.winner}</span>
                  {" — "}{recommendation.reason}
                </p>
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading && found.length === 0 && (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #111" }}>
                <div className="px-4 py-2.5 flex items-center gap-2"
                  style={{ borderBottom: "1px solid #111", background: "#050505" }}>
                  <Loader2 size={11} className="animate-spin text-white" />
                  <span className="text-xs font-mono" style={{ color: "#333" }}>querying oem secrets api...</span>
                </div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-6 px-4 py-3.5 animate-pulse"
                    style={{ borderBottom: "1px solid #0a0a0a" }}>
                    <div className="h-2 w-36 rounded" style={{ background: "#111" }} />
                    <div className="h-2 w-14 rounded" style={{ background: "#0d0d0d" }} />
                    <div className="h-2 w-14 rounded ml-auto" style={{ background: "#111" }} />
                    <div className="h-2 w-20 rounded" style={{ background: "#0d0d0d" }} />
                    <div className="h-2 w-10 rounded" style={{ background: "#111" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            {found.length > 0 && (
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid #111" }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "#050505", borderBottom: "1px solid #111" }}>
                        {[
                          { key: null,        label: "Distributor", align: "left"   },
                          { key: null,        label: "Region",      align: "left"   },
                          { key: "stock",     label: "Stock",       align: "center" },
                          { key: null,        label: "MOQ",         align: "center" },
                          { key: "price",     label: "Unit Price",  align: "right"  },
                          { key: "leadtime",  label: "Lead Time",   align: "center" },
                          { key: null,        label: "Actions",     align: "right"  },
                        ].map(({ key, label, align }) => (
                          <th key={label}
                            className={`px-4 py-2.5 text-${align} ${key ? "cursor-pointer select-none" : ""}`}
                            onClick={key ? () => handleSort(key as SortKey) : undefined}>
                            <div className={`flex items-center gap-1 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
                              <span className="text-xs font-mono font-bold tracking-widest uppercase"
                                style={{ color: key && sortKey === key ? "#fff" : "#333" }}>
                                {label}
                              </span>
                              {key && <SortIcon column={key as SortKey} sortKey={sortKey} sortDir={sortDir} />}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {actionable.map((s, i) => (
                        <TableRow
                          key={`${s.supplier}-${i}`}
                          s={s}
                          isRecommended={!!(recommendation && found.indexOf(s) === recommendation.recommendedIndex)}
                        />
                      ))}

                      {passive.length > 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-px" style={{ background: "#0d0d0d" }} />
                              <span className="text-xs font-mono whitespace-nowrap" style={{ color: "#222" }}>
                                out of stock / price on request
                              </span>
                              <div className="flex-1 h-px" style={{ background: "#0d0d0d" }} />
                            </div>
                          </td>
                        </tr>
                      )}

                      {passive.map((s, i) => (
                        <TableRow
                          key={`passive-${s.supplier}-${i}`}
                          s={s}
                          isRecommended={false}
                          dim={true}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 flex items-center justify-between flex-wrap gap-2"
                  style={{ borderTop: "1px solid #0d0d0d", background: "#050505" }}>
                  <span className="text-xs font-mono" style={{ color: "#222" }}>
                    {found.length} results · oem secrets · 1 api call
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono mr-1" style={{ color: "#222" }}>sort:</span>
                    {(["ai","price","stock","leadtime"] as SortKey[]).map(opt => (
                      <button key={opt} onClick={() => handleSort(opt)}
                        className="text-xs px-2 py-0.5 rounded font-mono transition-all"
                        style={sortKey === opt
                          ? { background: "#fff", color: "#000", border: "1px solid #fff" }
                          : { background: "transparent", color: "#333", border: "1px solid #111" }}
                        onMouseEnter={e => { if (sortKey !== opt) { (e.currentTarget as HTMLElement).style.borderColor = "#444"; (e.currentTarget as HTMLElement).style.color = "#888"; }}}
                        onMouseLeave={e => { if (sortKey !== opt) { (e.currentTarget as HTMLElement).style.borderColor = "#111"; (e.currentTarget as HTMLElement).style.color = "#333"; }}}>
                        {opt === "ai" ? "★ ai" : opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Errors */}
            {phase === "error" && (
              <div className="px-4 py-4 flex items-start gap-3 rounded-lg"
                style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
                <AlertCircle size={13} style={{ color: "#555" }} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-mono font-bold text-white mb-1">search failed</div>
                  <div className="text-xs font-mono" style={{ color: "#444" }}>check your connection and try again.</div>
                </div>
              </div>
            )}

            {phase === "done" && found.length === 0 && (
              <div className="px-4 py-4 flex items-start gap-3 rounded-lg"
                style={{ background: "#050505", border: "1px solid #1a1a1a" }}>
                <AlertCircle size={13} style={{ color: "#555" }} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-mono font-bold text-white mb-1">no results for {currentMpn}</div>
                  <div className="text-xs font-mono" style={{ color: "#444" }}>verify the mpn and try again.</div>
                </div>
              </div>
            )}

            <button onClick={reset}
              className="w-full text-center text-xs font-mono py-2 transition-colors"
              style={{ color: "#222" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#555"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#222"}>
              ← search a different part
            </button>
          </div>
        )}

        {/* ── IDLE ── */}
        {!hasResults && (
          <div className="mt-2 w-full max-w-4xl space-y-3">
            <div className="p-5 rounded-lg" style={{ background: "#050505", border: "1px solid #111" }}>
              <div className="flex items-center gap-2 mb-3">
                <Globe size={12} style={{ color: "#fff" }} />
                <span className="text-xs font-mono font-bold text-white">140+ Global Distributors</span>
              </div>
              <p className="text-xs font-mono leading-relaxed" style={{ color: "#444" }}>
                DigiKey · Mouser · Arrow · Avnet · Farnell · RS Components · LCSC · and 130+ more.
                One MPN, all distributors, prices in USD. Actionable results first.
              </p>
            </div>

            <div className="px-4 py-3 rounded-lg flex items-center gap-3"
              style={{ background: "#050505", border: "1px solid #111" }}>
              <Zap size={11} style={{ color: "#fff" }} className="shrink-0" />
              <p className="text-xs font-mono" style={{ color: "#444" }}>
                <span className="text-white">OEM Secrets API</span>
                {" "}— 1 search = 140+ distributors = 1 api call. repeated searches return{" "}
                <span className="text-white">instantly</span>.
              </p>
            </div>

            <div>
              <p className="text-xs font-mono font-bold tracking-widest uppercase mb-3 px-1" style={{ color: "#222" }}>
                Try these parts
              </p>
              <div className="flex flex-wrap gap-2">
                {FALLBACK_CATALOG.map((item, i) => (
                  <button key={i} onClick={() => runSearch(item.part)}
                    className="text-xs font-mono px-3 py-1.5 rounded transition-all"
                    style={{ background: "#050505", border: "1px solid #111", color: "#444" }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#fff";
                      (e.currentTarget as HTMLElement).style.color = "#fff";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = "#111";
                      (e.currentTarget as HTMLElement).style.color = "#444";
                    }}>
                    {item.part}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Settings */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.85)" }}
            onClick={() => setSettingsOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-72 z-50 flex flex-col"
            style={{ background: "#000", borderLeft: "1px solid #111" }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid #111" }}>
              <div className="flex items-center gap-2">
                <Settings size={12} className="text-white" />
                <span className="text-xs font-mono font-bold text-white">settings</span>
              </div>
              <button onClick={() => setSettingsOpen(false)}
                style={{ color: "#444" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#fff"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#444"}>
                <X size={13} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs font-mono font-bold tracking-widest uppercase mb-4" style={{ color: "#222" }}>
                Integrations
              </p>
              {SETTINGS_TOGGLES.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-3.5"
                  style={{ borderBottom: "1px solid #0d0d0d" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded flex items-center justify-center"
                      style={{ background: "#0a0a0a", border: "1px solid #111" }}>
                      <t.icon size={11} style={{ color: "#444" }} />
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-white">{t.label}</div>
                      <div className="text-xs font-mono mt-0.5" style={{ color: "#333" }}>{t.sub}</div>
                    </div>
                  </div>
                  <Toggle enabled={t.enabled} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4" style={{ borderTop: "1px solid #0d0d0d" }}>
              <p className="text-xs font-mono text-center" style={{ color: "#222" }}>
                omniprocure v4.0.0 · oem secrets api
              </p>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}