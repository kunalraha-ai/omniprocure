"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import {
  Search, Settings, X, CheckCircle, Package,
  Download, Zap, Database, RefreshCw, ShieldCheck, Lock,
  ChevronRight, Star, AlertCircle, Loader2,
  ExternalLink, Globe, ChevronUp, ChevronDown, ArrowUpDown,
  Info, TriangleAlert, BadgeCheck, ShieldAlert,
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

const DISTRIBUTOR_NETWORK = [
  {
    region: "Americas", flag: "🌎",
    distributors: ["Digi-Key","Mouser Electronics","Arrow Electronics","Avnet","Future Electronics","Newark / element14","TTI Inc.","Allied Electronics","Rochester Electronics","Heilind Electronics","Sager Electronics","Master Electronics","Fusion Worldwide","Richardson RFPD","EACO Corporation","Symmetry Electronics","Bisco Industries","Braemac","Wyle Electronics","Quest Components"],
  },
  {
    region: "Europe", flag: "🌍",
    distributors: ["RS Components","Farnell","Rutronik","Distrelec","TME (Transfer Multisort Elektronik)","Bürklin Elektronik","Schukat Electronic","Reichelt Elektronik","Conrad Electronic","Elfa Distrelec","Würth Elektronik","EBV Elektronik (Avnet)","SOS electronic","Codico","Telsys","ELBRO","Ineltek","IMP Electronics","Selfa","Compo Elektronik","Westdev","Anglia Components","Acal BFi","Myrra","GSA Electronics","tti Europe"],
  },
  {
    region: "Asia-Pacific", flag: "🌏",
    distributors: ["LCSC Electronics","Chip1Stop (Macnica)","Winsource Electronics","WT Microelectronics","WPG Holdings","HK Winsome","Easyparts","Seeed Studio","UTSOURCE","ICkey.cn","BuyICnow","Ariat Technology","Sunrise Technology","Halo Technology","Good Components","IC Station","Element14 Asia","RS Components Asia","Mouser Asia","Digi-Key Asia"],
  },
  {
    region: "Global / Independent", flag: "🌐",
    distributors: ["RFMW","IEC Electronics","Component Distributors Inc.","ePlanning Inc.","Comchip Technology","Southern Electronics","Jameco Electronics","Adafruit Industries","SparkFun Electronics","Multicomp Pro","CUI Devices","Portage Electric Products","McM Electronics","Global Specialties","SurplusGizmos"],
  },
];

const SETTINGS_TOGGLES = [
  { label: "NetSuite ERP Sync",        sub: "Connect to Oracle NetSuite GL",  icon: Database,    enabled: false },
  { label: "SAP S/4HANA Connector",    sub: "Bidirectional PO sync",          icon: RefreshCw,   enabled: false },
  { label: "Slack Procurement Alerts", sub: "Notify #procurement channel",    icon: Zap,         enabled: false },
  { label: "SOC 2 Audit Logging",      sub: "Immutable event trail",          icon: ShieldCheck, enabled: true  },
];

// ── Stock classification — for badges only, NEVER for hiding rows ─────────────
// Every row the API returns is shown. Low stock gets a warning, not removal.
function stockTier(stock: number): "high" | "medium" | "low" | "suspect" | "zero" {
  if (stock === 0)   return "zero";
  if (stock < 5)     return "suspect";    // ⚠ very low — likely stale data
  if (stock < 25)    return "low";        // amber — worth flagging
  if (stock < 500)   return "medium";     // blue
  return "high";                          // green
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function AtomLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="#1a56db" strokeWidth="5" fill="none"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="#1a56db" strokeWidth="5" fill="none" transform="rotate(60 50 50)" opacity="0.5"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="#1a56db" strokeWidth="5" fill="none" transform="rotate(120 50 50)" opacity="0.25"/>
      <circle cx="50" cy="50" r="7" fill="#1a56db"/>
    </svg>
  );
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-lg shadow-xl"
      style={{ background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}>
      <CheckCircle size={15} style={{ color: "#16a34a" }} />
      <span className="text-sm font-medium" style={{ color: "#111827" }}>{message}</span>
    </div>
  );
}

function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div className="relative w-9 h-5 rounded-full transition-colors duration-200"
      style={{ background: enabled ? "#1a56db" : "#d1d5db" }}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
    </div>
  );
}

function StockBadge({ stock }: { stock: number }) {
  const tier = stockTier(stock);

  if (tier === "zero") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
      style={{ color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
      0
    </span>
  );
  if (tier === "suspect") return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded"
      style={{ color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a" }}>
      <TriangleAlert size={9} />
      {stock.toLocaleString()}
    </span>
  );
  if (tier === "low") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
      style={{ color: "#b45309", background: "#fffbeb", border: "1px solid #fde68a" }}>
      {stock.toLocaleString()}
    </span>
  );
  if (tier === "medium") return (
    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded"
      style={{ color: "#1d4ed8", background: "#eff6ff", border: "1px solid #bfdbfe" }}>
      {stock.toLocaleString()}
    </span>
  );
  return (
    <span className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded"
      style={{ color: "#15803d", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
      {stock.toLocaleString()}
    </span>
  );
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== column) return <ArrowUpDown size={11} style={{ color: "#9ca3af" }} />;
  return sortDir === "asc"
    ? <ChevronUp size={11} style={{ color: "#1a56db" }} />
    : <ChevronDown size={11} style={{ color: "#1a56db" }} />;
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

  useEffect(() => {
    if (!query.trim() || selectedPart) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    setSuggestions(catalog.filter(c =>
      c.part.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
    ).slice(0, 6));
  }, [query, catalog, selectedPart]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // ── Split results into sections — NO rows are ever hidden ─────────────────
  // Section 1: has price + stock > 0  → fully actionable
  // Section 2: has price + stock = 0  → out of stock but priced
  // Section 3: no price               → contact for quote
  // ALL three sections render. Nothing is dropped.
  const { withPriceInStock, outOfStock, onRequest, totalActionable } = (() => {
    const inStock   = found.filter(s => s.hasPrice && s.stock > 0);
    const noStock   = found.filter(s => s.hasPrice && s.stock === 0);
    const noPrice   = found.filter(s => !s.hasPrice);

    const sortFn = (a: SupplierResult, b: SupplierResult) => {
      let diff = 0;
      if (sortKey === "price")    diff = (a.price ?? 9999) - (b.price ?? 9999);
      else if (sortKey === "stock")    diff = b.stock - a.stock;
      else if (sortKey === "leadtime") diff = (a.leadTime ?? "").localeCompare(b.leadTime ?? "");
      else {
        // AI sort: recommended first, then price
        const aRec = recommendation && found.indexOf(a) === recommendation.recommendedIndex ? -1 : 0;
        const bRec = recommendation && found.indexOf(b) === recommendation.recommendedIndex ? -1 : 0;
        diff = aRec - bRec || (a.price ?? 9999) - (b.price ?? 9999);
      }
      return sortDir === "asc" ? diff : -diff;
    };

    return {
      withPriceInStock: [...inStock].sort(sortFn),
      outOfStock: [...noStock].sort(sortFn),
      onRequest: noPrice,
      totalActionable: inStock.length,
    };
  })();

  // ── Search ────────────────────────────────────────────────────────────────
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

    doc.setFillColor(26,86,219); doc.rect(0,0,210,40,"F");
    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont("helvetica","bold");
    doc.text("OMNIPROCURE",14,18);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(200,220,255);
    doc.text("Autonomous B2B Procurement Platform",14,26);
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("PURCHASE ORDER",196,18,{align:"right"});
    doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text(poNumber,196,26,{align:"right"});

    doc.setTextColor(30,30,30); doc.setFontSize(9); doc.setFont("helvetica","bold"); doc.text("FROM",14,52);
    doc.setFont("helvetica","normal"); doc.setTextColor(80,80,80);
    doc.text("Your Company Name",14,58); doc.text("Your Address",14,63);
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
      body:[["1", currentMpn, supplier.supplier, supplier.region||"Global",
        `USD ${supplier.price?.toFixed(3)??"TBD"}`, String(supplier.moq),
        `USD ${((supplier.price??0)*supplier.moq).toFixed(2)}`]],
      headStyles:{fillColor:[26,86,219],textColor:255,fontStyle:"bold",fontSize:8},
      bodyStyles:{fontSize:8,textColor:[30,30,30]},
      alternateRowStyles:{fillColor:[248,250,255]},
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    const isRec = recommendation && found.indexOf(supplier) === recommendation.recommendedIndex;
    if (isRec && recommendation) {
      doc.setFillColor(26,86,219); doc.roundedRect(14,finalY,170,14,2,2,"F");
      doc.setTextColor(255,255,255); doc.setFontSize(7.5); doc.setFont("helvetica","bold");
      doc.text("AI RECOMMENDED — " + recommendation.reason.slice(0,90), 17, finalY+9);
    }

    doc.setFillColor(248,250,255); doc.rect(0,270,210,27,"F");
    doc.setTextColor(160,160,160); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
    doc.text("Auto-generated by OmniProcure AI. Verify pricing and stock before submission.",105,278,{align:"center"});
    doc.text("OmniProcure · OEM Secrets API · Claude AI · omniprocure.online",105,284,{align:"center"});
    doc.save(`PO_${currentMpn}_${supplier.supplier.replace(/\s+/g,"_")}.pdf`);
    setToast(`PO generated for ${supplier.supplier}`);
  }, [found, currentMpn, recommendation]);

  const hasResults = phase !== "idle";

  // ── Row components ────────────────────────────────────────────────────────

  // Full actionable row — has price + stock
  const ActionableRow = ({ s, isRecommended }: { s: SupplierResult; isRecommended: boolean }) => {
    const tier = stockTier(s.stock);
    const isSuspect = tier === "suspect" || tier === "low";
    return (
      <tr className="group transition-colors"
        style={{ borderBottom: "1px solid #f1f5f9", background: isRecommended ? "#eff6ff" : "transparent" }}
        onMouseEnter={e => { if (!isRecommended) (e.currentTarget as HTMLElement).style.background = "#f8fafc"; }}
        onMouseLeave={e => { if (!isRecommended) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>

        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            {isRecommended && <BadgeCheck size={14} style={{ color: "#1a56db" }} className="shrink-0" />}
            <div>
              <div className="text-sm font-semibold whitespace-nowrap" style={{ color: "#111827" }}>{s.supplier}</div>
              <div className="text-xs mt-0.5 font-mono" style={{ color: "#9ca3af" }}>{s.mpn}</div>
            </div>
          </div>
        </td>

        <td className="py-3 px-4">
          <span className="text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap"
            style={{ color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
            {s.region || "Global"}
          </span>
        </td>

        <td className="py-3 px-4 text-center">
          <div className="flex flex-col items-center gap-0.5">
            <StockBadge stock={s.stock} />
            {isSuspect && (
              <span className="text-xs leading-none" style={{ color: "#b45309" }}>verify qty</span>
            )}
          </div>
        </td>

        <td className="py-3 px-4 text-center">
          <span className="text-sm font-medium" style={{ color: "#374151" }}>
            {s.moq > 0 ? s.moq.toLocaleString() : "—"}
          </span>
        </td>

        {/* Price — biggest & boldest number on the row */}
        <td className="py-3 px-4 text-right">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-lg font-bold leading-none" style={{ color: "#111827" }}>
              ${s.price?.toFixed(3)}
            </span>
            <span className="text-xs" style={{ color: "#9ca3af" }}>per unit · USD</span>
          </div>
        </td>

        <td className="py-3 px-4 text-center">
          <span className="text-sm font-medium whitespace-nowrap" style={{ color: "#374151" }}>
            {s.leadTime || "—"}
          </span>
        </td>

        <td className="py-3 px-4 text-center hidden lg:table-cell">
          <span className="text-xs inline-flex items-center gap-1" style={{ color: "#d1d5db" }}>
            <ShieldAlert size={10} />
            Verify before ordering
          </span>
        </td>

        <td className="py-3 px-4">
          <div className="flex items-center gap-2 justify-end">
            {s.url && (
              <a href={s.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all"
                style={{ color: "#374151", border: "1px solid #e5e7eb", background: "#fff" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a56db"; (e.currentTarget as HTMLElement).style.color = "#1a56db"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLElement).style.color = "#374151"; }}>
                <ExternalLink size={11} /> View
              </a>
            )}
            <button onClick={() => generatePDF(s)}
              className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-md transition-all whitespace-nowrap"
              style={isRecommended
                ? { background: "#1a56db", color: "#fff", border: "1px solid #1a56db" }
                : { background: "#fff", color: "#374151", border: "1px solid #e5e7eb" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#1a56db"; (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.borderColor = "#1a56db"; }}
              onMouseLeave={e => { if (!isRecommended) { (e.currentTarget as HTMLElement).style.background = "#fff"; (e.currentTarget as HTMLElement).style.color = "#374151"; (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; } }}>
              <Download size={10} /> PO
            </button>
          </div>
        </td>
      </tr>
    );
  };

  // Dimmed row — priced but out of stock
  const OutOfStockRow = ({ s }: { s: SupplierResult }) => (
    <tr className="transition-colors"
      style={{ borderBottom: "1px solid #f1f5f9", opacity: 0.55 }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <td className="py-2.5 px-4">
        <div className="text-sm font-semibold" style={{ color: "#374151" }}>{s.supplier}</div>
        <div className="text-xs font-mono mt-0.5" style={{ color: "#9ca3af" }}>{s.mpn}</div>
      </td>
      <td className="py-2.5 px-4">
        <span className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
          {s.region || "Global"}
        </span>
      </td>
      <td className="py-2.5 px-4 text-center"><StockBadge stock={0} /></td>
      <td className="py-2.5 px-4 text-center">
        <span className="text-sm font-medium" style={{ color: "#374151" }}>
          {s.moq > 0 ? s.moq.toLocaleString() : "—"}
        </span>
      </td>
      <td className="py-2.5 px-4 text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-base font-bold" style={{ color: "#6b7280" }}>${s.price?.toFixed(3)}</span>
          <span className="text-xs" style={{ color: "#9ca3af" }}>per unit · USD</span>
        </div>
      </td>
      <td className="py-2.5 px-4 text-center">
        <span className="text-sm" style={{ color: "#9ca3af" }}>{s.leadTime || "Contact supplier"}</span>
      </td>
      <td className="py-2.5 px-4 hidden lg:table-cell" />
      <td className="py-2.5 px-4">
        <div className="flex justify-end">
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all"
              style={{ color: "#374151", border: "1px solid #e5e7eb", background: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a56db"; (e.currentTarget as HTMLElement).style.color = "#1a56db"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLElement).style.color = "#374151"; }}>
              <ExternalLink size={11} /> View
            </a>
          )}
        </div>
      </td>
    </tr>
  );

  // Price-on-request row — no price data
  const OnRequestRow = ({ s }: { s: SupplierResult }) => (
    <tr className="transition-colors"
      style={{ borderBottom: "1px solid #f1f5f9", opacity: 0.6 }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
      <td className="py-2.5 px-4">
        <div className="text-sm font-semibold" style={{ color: "#374151" }}>{s.supplier}</div>
        <div className="text-xs font-mono mt-0.5" style={{ color: "#9ca3af" }}>{s.mpn}</div>
      </td>
      <td className="py-2.5 px-4">
        <span className="text-xs px-2 py-0.5 rounded font-medium"
          style={{ color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
          {s.region || "Global"}
        </span>
      </td>
      <td className="py-2.5 px-4 text-center"><StockBadge stock={s.stock} /></td>
      <td className="py-2.5 px-4 text-center">
        <span className="text-sm font-medium" style={{ color: "#374151" }}>
          {s.moq > 0 ? s.moq.toLocaleString() : "—"}
        </span>
      </td>
      <td className="py-2.5 px-4 text-right">
        <span className="text-sm italic" style={{ color: "#9ca3af" }}>Price on request</span>
      </td>
      <td className="py-2.5 px-4 text-center">
        <span className="text-sm" style={{ color: "#9ca3af" }}>{s.leadTime || "—"}</span>
      </td>
      <td className="py-2.5 px-4 hidden lg:table-cell" />
      <td className="py-2.5 px-4">
        <div className="flex justify-end">
          {s.url && (
            <a href={s.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all"
              style={{ color: "#374151", border: "1px solid #e5e7eb", background: "#fff" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a56db"; (e.currentTarget as HTMLElement).style.color = "#1a56db"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLElement).style.color = "#374151"; }}>
              <ExternalLink size={11} /> Contact
            </a>
          )}
        </div>
      </td>
    </tr>
  );

  // ── Section divider ───────────────────────────────────────────────────────
  const SectionDivider = ({ label, count }: { label: string; count: number }) => (
    <tr>
      <td colSpan={8} className="px-4 pt-4 pb-1.5">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
          <span className="text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
            style={{ color: "#9ca3af" }}>
            {label} · {count}
          </span>
          <div className="flex-1 h-px" style={{ background: "#e5e7eb" }} />
        </div>
      </td>
    </tr>
  );

  return (
    <div className="min-h-screen" style={{ background: "#f8fafc", fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-6"
        style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1 mr-1 transition-opacity hover:opacity-60"
            style={{ color: "#9ca3af" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Link>
          <AtomLogo size={20} />
          <span className="text-base font-bold tracking-tight" style={{ color: "#111827" }}>OmniProcure</span>
          <span className="text-xs px-2 py-0.5 rounded font-medium hidden sm:inline"
            style={{ color: "#1a56db", background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            command center
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-md"
            style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: "#16a34a" }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: "#16a34a" }} />
            </span>
            <span className="text-xs font-medium" style={{ color: "#15803d" }}>live</span>
          </div>
          {cached && phase === "done" && (
            <span className="hidden sm:inline text-xs font-medium px-2.5 py-1.5 rounded-md"
              style={{ color: "#6b7280", background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
              ⚡ cached
            </span>
          )}
          <button onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-all"
            style={{ border: "1px solid #e5e7eb", background: "#fff", color: "#6b7280" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a56db"; (e.currentTarget as HTMLElement).style.color = "#1a56db"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLElement).style.color = "#6b7280"; }}>
            <Settings size={14} />
          </button>
        </div>
      </nav>

      <main className="pt-14 min-h-screen flex flex-col items-center px-4 pb-16">

        {/* Hero */}
        <div className="mt-14 mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full"
            style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
            <Globe size={12} style={{ color: "#1a56db" }} />
            <span className="text-xs font-medium" style={{ color: "#1a56db" }}>
              OEM Secrets · 140+ Distributors · Claude AI
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-3" style={{ color: "#111827" }}>
            Electronic Parts Sourcing
          </h1>
          <p className="text-sm max-w-md mx-auto leading-relaxed" style={{ color: "#6b7280" }}>
            Enter any MPN → search 140+ global distributors → AI picks the best deal → generate PO
          </p>
        </div>

        {/* Search */}
        <div className="w-full max-w-2xl relative mb-8">
          <div className="flex items-center gap-3 px-4 py-3 transition-all rounded-xl"
            style={selectedPart
              ? { background: "#fff", border: "2px solid #1a56db", boxShadow: "0 0 0 3px rgba(26,86,219,0.08)" }
              : { background: "#fff", border: "1.5px solid #e5e7eb", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            {selectedPart
              ? <Lock size={15} style={{ color: "#1a56db" }} className="shrink-0" />
              : <Search size={15} style={{ color: "#9ca3af" }} className="shrink-0" />}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!!selectedPart}
              placeholder="e.g. ATMEGA328P-PU, STM32F103C8T6, MPU-6050…"
              className="flex-1 bg-transparent text-base outline-none disabled:cursor-not-allowed"
              style={{ color: "#111827" }}
              autoComplete="off"
            />
            {selectedPart ? (
              <button onClick={reset} style={{ color: "#9ca3af" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#374151"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9ca3af"}>
                <X size={15} />
              </button>
            ) : query.trim() ? (
              <button onClick={() => runSearch(query.trim())}
                className="text-sm font-semibold px-4 py-1.5 rounded-lg transition-all"
                style={{ background: "#1a56db", color: "#fff" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#1e40af"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#1a56db"}>
                Search
              </button>
            ) : null}
          </div>

          {query.trim() && !selectedPart && suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 overflow-hidden z-30 rounded-xl shadow-lg"
              style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
              {suggestions.map((item, i) => (
                <button key={i} onClick={() => runSearch(item.part)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ borderBottom: "1px solid #f1f5f9" }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                  <Package size={13} style={{ color: "#9ca3af" }} className="shrink-0" />
                  <div>
                    <div className="text-sm font-semibold" style={{ color: "#111827" }}>{item.part}</div>
                    <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{item.desc}</div>
                  </div>
                  <ChevronRight size={13} style={{ color: "#d1d5db" }} className="ml-auto" />
                </button>
              ))}
              <button onClick={() => runSearch(query.trim())}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f8fafc"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
                <Search size={13} style={{ color: "#1a56db" }} className="shrink-0" />
                <span className="text-sm font-semibold" style={{ color: "#1a56db" }}>
                  Search &quot;{query.trim().toUpperCase()}&quot;
                </span>
              </button>
            </div>
          )}
        </div>

        {/* ── RESULTS ── */}
        {hasResults && (
          <div className="w-full max-w-7xl space-y-3">

            {/* Status bar */}
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 text-sm" style={{ color: "#6b7280" }}>
                {isLoading ? (
                  <>
                    <Loader2 size={14} className="animate-spin" style={{ color: "#1a56db" }} />
                    Querying 140+ distributors…
                    {found.length > 0 && (
                      <span style={{ color: "#9ca3af" }}>({found.length} so far)</span>
                    )}
                  </>
                ) : phase === "done" ? (
                  <>
                    <CheckCircle size={14} style={{ color: "#16a34a" }} />
                    <span>
                      <strong style={{ color: "#111827" }}>{found.length}</strong> total suppliers
                      {" · "}
                      <strong style={{ color: "#111827" }}>{totalActionable}</strong> with price &amp; stock
                      {outOfStock.length > 0 && (
                        <span style={{ color: "#9ca3af" }}> · {outOfStock.length} out of stock</span>
                      )}
                      {onRequest.length > 0 && (
                        <span style={{ color: "#9ca3af" }}> · {onRequest.length} price on request</span>
                      )}
                      {cached && cachedAt && (
                        <span style={{ color: "#9ca3af" }}> · cached {new Date(cachedAt).toLocaleDateString()}</span>
                      )}
                    </span>
                  </>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-mono" style={{ color: "#111827" }}>{currentMpn}</span>
                <button onClick={reset}
                  className="text-xs font-medium px-2.5 py-1 rounded-md transition-all"
                  style={{ color: "#6b7280", border: "1px solid #e5e7eb", background: "#fff" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#111827"; (e.currentTarget as HTMLElement).style.borderColor = "#9ca3af"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#6b7280"; (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; }}>
                  ← New search
                </button>
              </div>
            </div>

            {/* AI Recommendation Banner */}
            {recommendation && totalActionable > 0 && (
              <div className="rounded-xl p-4"
                style={{ background: "#eff6ff", border: "1.5px solid #bfdbfe" }}>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "#1a56db" }}>
                    <BadgeCheck size={14} className="text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold" style={{ color: "#1e3a8a" }}>
                        AI Recommendation: {recommendation.winner}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: "#1a56db", color: "#fff" }}>Best pick</span>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#1d4ed8" }}>
                      <strong>Why this supplier won:</strong> {recommendation.reason}
                    </p>
                    <p className="text-xs mt-1.5" style={{ color: "#60a5fa" }}>
                      Scored on: stock availability (40%) · unit price (35%) · lead time &amp; reliability (25%)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading skeleton */}
            {isLoading && found.length === 0 && (
              <div className="rounded-xl overflow-hidden bg-white shadow-sm"
                style={{ border: "1px solid #e5e7eb" }}>
                <div className="px-4 py-3 flex items-center gap-2"
                  style={{ borderBottom: "1px solid #f1f5f9", background: "#f8fafc" }}>
                  <Loader2 size={13} className="animate-spin" style={{ color: "#1a56db" }} />
                  <span className="text-sm" style={{ color: "#6b7280" }}>Querying OEM Secrets API across 140+ distributors…</span>
                </div>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center gap-6 px-4 py-4 animate-pulse"
                    style={{ borderBottom: "1px solid #f1f5f9" }}>
                    <div className="h-3 w-40 rounded-md" style={{ background: "#e5e7eb" }} />
                    <div className="h-3 w-16 rounded-md" style={{ background: "#f1f5f9" }} />
                    <div className="h-5 w-16 rounded-md ml-auto" style={{ background: "#e5e7eb" }} />
                    <div className="h-3 w-24 rounded-md" style={{ background: "#f1f5f9" }} />
                    <div className="h-3 w-12 rounded-md" style={{ background: "#e5e7eb" }} />
                  </div>
                ))}
              </div>
            )}

            {/* Main results table — ALL rows rendered, no cap */}
            {found.length > 0 && (
              <div className="rounded-xl overflow-hidden bg-white shadow-sm"
                style={{ border: "1px solid #e5e7eb" }}>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1.5px solid #e5e7eb" }}>
                        {([
                          { key: null,       label: "Distributor",  align: "left"   },
                          { key: null,       label: "Region",       align: "left"   },
                          { key: "stock",    label: "Stock",        align: "center" },
                          { key: null,       label: "MOQ",          align: "center" },
                          { key: "price",    label: "Unit Price",   align: "right"  },
                          { key: "leadtime", label: "Lead Time",    align: "center" },
                          { key: null,       label: "",             align: "center" },
                          { key: null,       label: "Actions",      align: "right"  },
                        ] as { key: SortKey | null; label: string; align: string }[]).map(({ key, label, align }) => (
                          <th key={label + (key ?? "")}
                            className={`px-4 py-2.5 text-${align} ${key ? "cursor-pointer select-none" : ""}`}
                            onClick={key ? () => handleSort(key) : undefined}>
                            <div className={`flex items-center gap-1.5 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : ""}`}>
                              <span className="text-xs font-semibold tracking-wide uppercase"
                                style={{ color: key && sortKey === key ? "#1a56db" : "#6b7280" }}>
                                {label}
                              </span>
                              {key && <SortIcon column={key} sortKey={sortKey} sortDir={sortDir} />}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>

                      {/* ── Section 1: Price + stock ── */}
                      {withPriceInStock.map((s, i) => (
                        <ActionableRow
                          key={`in-${s.supplier}-${i}`}
                          s={s}
                          isRecommended={!!(recommendation && found.indexOf(s) === recommendation.recommendedIndex)}
                        />
                      ))}

                      {/* ── Section 2: Out of stock (priced) ── */}
                      {outOfStock.length > 0 && (
                        <>
                          <SectionDivider label="Out of stock — priced" count={outOfStock.length} />
                          {outOfStock.map((s, i) => (
                            <OutOfStockRow key={`oos-${s.supplier}-${i}`} s={s} />
                          ))}
                        </>
                      )}

                      {/* ── Section 3: Price on request ── */}
                      {onRequest.length > 0 && (
                        <>
                          <SectionDivider label="Price on request — contact supplier" count={onRequest.length} />
                          {onRequest.map((s, i) => (
                            <OnRequestRow key={`req-${s.supplier}-${i}`} s={s} />
                          ))}
                        </>
                      )}

                    </tbody>
                  </table>
                </div>

                {/* Table footer */}
                <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2"
                  style={{ borderTop: "1px solid #f1f5f9", background: "#f8fafc" }}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs" style={{ color: "#9ca3af" }}>
                      {found.length} of {found.length} suppliers shown · OEM Secrets API · no results hidden
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 text-xs" style={{ color: "#d1d5db" }}>
                      <ShieldAlert size={10} />
                      Always verify stock &amp; pricing before submitting a PO
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium mr-1" style={{ color: "#6b7280" }}>Sort:</span>
                    {(["ai","price","stock","leadtime"] as SortKey[]).map(opt => (
                      <button key={opt} onClick={() => handleSort(opt)}
                        className="text-xs px-2.5 py-1 rounded-md font-medium transition-all"
                        style={sortKey === opt
                          ? { background: "#1a56db", color: "#fff", border: "1px solid #1a56db" }
                          : { background: "#fff", color: "#6b7280", border: "1px solid #e5e7eb" }}
                        onMouseEnter={e => { if (sortKey !== opt) { (e.currentTarget as HTMLElement).style.borderColor = "#1a56db"; (e.currentTarget as HTMLElement).style.color = "#1a56db"; }}}
                        onMouseLeave={e => { if (sortKey !== opt) { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLElement).style.color = "#6b7280"; }}}>
                        {opt === "ai" ? "★ AI" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Error states */}
            {phase === "error" && (
              <div className="px-5 py-4 flex items-start gap-3 rounded-xl bg-white shadow-sm"
                style={{ border: "1px solid #fecaca" }}>
                <AlertCircle size={15} style={{ color: "#dc2626" }} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold mb-0.5" style={{ color: "#111827" }}>Search failed</div>
                  <div className="text-sm" style={{ color: "#6b7280" }}>Check your connection and try again.</div>
                </div>
              </div>
            )}

            {phase === "done" && found.length === 0 && (
              <div className="px-5 py-4 flex items-start gap-3 rounded-xl bg-white shadow-sm"
                style={{ border: "1px solid #e5e7eb" }}>
                <AlertCircle size={15} style={{ color: "#9ca3af" }} className="shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold mb-0.5" style={{ color: "#111827" }}>No results for {currentMpn}</div>
                  <div className="text-sm" style={{ color: "#6b7280" }}>Verify the MPN and try again. Check for alternate part numbers or manufacturer variants.</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── IDLE ── */}
        {!hasResults && (
          <div className="mt-2 w-full max-w-4xl space-y-4">
            <div className="p-5 rounded-xl bg-white shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-2 mb-4">
                <Globe size={14} style={{ color: "#1a56db" }} />
                <span className="text-sm font-semibold" style={{ color: "#111827" }}>
                  140+ Global Distributor Network via OEM Secrets
                </span>
              </div>
              <div className="space-y-4">
                {DISTRIBUTOR_NETWORK.map((group) => (
                  <div key={group.region}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm">{group.flag}</span>
                      <span className="text-xs font-semibold tracking-widest uppercase"
                        style={{ color: "#6b7280" }}>{group.region}</span>
                      <div className="flex-1 h-px ml-1" style={{ background: "#e5e7eb" }} />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {group.distributors.map((d) => (
                        <span key={d} className="text-xs font-medium px-2 py-0.5 rounded-md"
                          style={{ color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                          {d}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-4 pt-3" style={{ color: "#9ca3af", borderTop: "1px solid #f1f5f9" }}>
                + 60 additional regional &amp; specialty distributors queried simultaneously
              </p>
            </div>

            <div className="px-4 py-3 rounded-xl bg-white shadow-sm flex items-center gap-3"
              style={{ border: "1px solid #e5e7eb" }}>
              <Zap size={13} style={{ color: "#1a56db" }} className="shrink-0" />
              <p className="text-sm" style={{ color: "#374151" }}>
                <span className="font-semibold" style={{ color: "#111827" }}>OEM Secrets API</span>
                {" "}— 1 search = 140+ distributors = 1 API call.{" "}
                <span className="font-semibold">All results shown, no cap.</span>
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold tracking-widest uppercase mb-2.5 px-1"
                style={{ color: "#9ca3af" }}>Try these parts</p>
              <div className="flex flex-wrap gap-2">
                {FALLBACK_CATALOG.map((item, i) => (
                  <button key={i} onClick={() => runSearch(item.part)}
                    className="text-sm font-medium px-3 py-1.5 rounded-lg transition-all bg-white shadow-sm"
                    style={{ border: "1px solid #e5e7eb", color: "#374151" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#1a56db"; (e.currentTarget as HTMLElement).style.color = "#1a56db"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e5e7eb"; (e.currentTarget as HTMLElement).style.color = "#374151"; }}>
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
          <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={() => setSettingsOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col shadow-2xl"
            style={{ background: "#fff", borderLeft: "1px solid #e5e7eb" }}>
            <div className="flex items-center justify-between px-5 py-4"
              style={{ borderBottom: "1px solid #e5e7eb" }}>
              <div className="flex items-center gap-2">
                <Settings size={14} style={{ color: "#374151" }} />
                <span className="text-sm font-semibold" style={{ color: "#111827" }}>Settings</span>
              </div>
              <button onClick={() => setSettingsOpen(false)}
                style={{ color: "#9ca3af" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#374151"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#9ca3af"}>
                <X size={15} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs font-semibold tracking-widest uppercase mb-4"
                style={{ color: "#9ca3af" }}>Integrations</p>
              {SETTINGS_TOGGLES.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-3.5"
                  style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: "#f3f4f6", border: "1px solid #e5e7eb" }}>
                      <t.icon size={12} style={{ color: "#6b7280" }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: "#111827" }}>{t.label}</div>
                      <div className="text-xs mt-0.5" style={{ color: "#9ca3af" }}>{t.sub}</div>
                    </div>
                  </div>
                  <Toggle enabled={t.enabled} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4" style={{ borderTop: "1px solid #f1f5f9" }}>
              <p className="text-xs text-center" style={{ color: "#9ca3af" }}>
                OmniProcure v4.0.0 · OEM Secrets API
              </p>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}