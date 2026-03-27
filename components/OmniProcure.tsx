"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Search,
  Settings,
  X,
  CheckCircle,
  Package,
  TrendingDown,
  Clock,
  Download,
  Zap,
  Database,
  RefreshCw,
  ShieldCheck,
  Lock,
  ChevronRight,
  Terminal,
  Star,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface CatalogItem {
  part: string;
  desc: string;
}

interface SupplierResult {
  name: string;
  price: number;
  currency: string;
  stock: number;
  leadTime: string;
  url: string;
  recommended?: boolean;
}

interface ProcureResult {
  partNumber: string;
  suppliers: SupplierResult[];
  recommendation: {
    winner: string;
    reason: string;
  };
}

// ── Supabase (graceful fallback) ───────────────────────────────────────────────
const FALLBACK_CATALOG: CatalogItem[] = [
  { part: "STM32F103C8T6", desc: "ARM Cortex-M3 Microcontroller, 72MHz" },
  { part: "GRM188R71H104KA93D", desc: "Multilayer Ceramic Capacitor 100nF" },
  { part: "LM358DR2G", desc: "Dual General Purpose Op-Amp, SOIC-8" },
  { part: "NRF52840-QIAA-R", desc: "Bluetooth 5.0 SoC, ARM Cortex-M4" },
  { part: "TPS63020DSJR", desc: "Buck-Boost Converter, 1.8A, 96% Eff." },
];

let supabase: ReturnType<typeof createClient> | null = null;
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) supabase = createClient(url, key);
} catch (_) {}

// ── Terminal lines ──────────────────────────────────────────────────────────────
const TERMINAL_LINES = [
  "> Initializing Tinyfish Agent...",
  "> Authenticating session tokens...",
  "> Bypassing bot protections on DigiKey & Mouser...",
  "> Dispatching parallel scrape workers [2x]...",
  "> Extracting pricing JSON from supplier endpoints...",
  "> Normalizing currency & lead-time fields...",
  "> Running Claude 3.5 Sonnet analysis...",
  "> Ranking suppliers by price × availability score...",
  "> Generating procurement recommendation...",
  "> ✓ Analysis complete.",
];

// ── Settings toggles ────────────────────────────────────────────────────────────
const SETTINGS_TOGGLES = [
  { label: "NetSuite ERP Sync", sub: "Connect to Oracle NetSuite GL", icon: Database, enabled: false },
  { label: "SAP S/4HANA Connector", sub: "Bidirectional PO sync", icon: RefreshCw, enabled: false },
  { label: "Slack Procurement Alerts", sub: "Notify #procurement channel", icon: Zap, enabled: false },
  { label: "SOC 2 Audit Logging", sub: "Immutable event trail", icon: ShieldCheck, enabled: true },
  { label: "Auto-PO Approval ≤$500", sub: "Requires finance sign-off above", icon: CheckCircle, enabled: false },
];

// ── Toast component ─────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-emerald-500 text-white px-5 py-3.5 rounded-xl shadow-2xl shadow-emerald-500/30 animate-slide-up">
      <CheckCircle size={18} />
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
}

// ── Toggle switch ───────────────────────────────────────────────────────────────
function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function OmniProcure() {
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([]);
  const [selectedPart, setSelectedPart] = useState<CatalogItem | null>(null);
  const [phase, setPhase] = useState<"idle" | "terminal" | "results">("idle");
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [results, setResults] = useState<ProcureResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Load catalog from Supabase or fallback
  useEffect(() => {
    async function loadCatalog() {
      if (!supabase) { setCatalog(FALLBACK_CATALOG); return; }
      try {
        const { data, error } = await supabase
          .from("supplier_catalog")
          .select("part, desc")
          .limit(50);
        if (error || !data?.length) throw new Error();
        setCatalog(data as CatalogItem[]);
      } catch {
        setCatalog(FALLBACK_CATALOG);
      }
    }
    loadCatalog();
  }, []);

  // Filter suggestions
  useEffect(() => {
    if (!query.trim() || selectedPart) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    setSuggestions(
      catalog
        .filter(c => c.part.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
        .slice(0, 6)
    );
  }, [query, catalog, selectedPart]);

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminalLines]);

  // ── Run sequence — defined FIRST so handleKeyDown can reference it ──────────
  const runSequence = useCallback(async (part: CatalogItem) => {
    setSelectedPart(part);
    setQuery(part.part);
    setSuggestions([]);
    setPhase("terminal");
    setTerminalLines([]);
    setResults(null);
    setError(null);

    const WAITING_LINES = [
      "> Initializing Tinyfish Agent...",
      "> Authenticating session tokens...",
      "> Bypassing bot protections on DigiKey & Mouser...",
      "> Dispatching parallel scrape workers [2x]...",
      "> Extracting pricing JSON from supplier endpoints...",
      "> Normalizing currency & lead-time fields...",
      "> Running Claude 3.5 Sonnet analysis...",
      "> Ranking suppliers by price x availability score...",
    ];

    const LOOPING_LINES = [
      "> Waiting for Mouser agent response...",
      "> Waiting for DigiKey agent response...",
      "> Agents still browsing live pages...",
      "> Processing supplier data...",
      "> Cross-referencing stock levels...",
      "> Validating pricing data...",
      "> Almost there...",
    ];

    let apiDone = false;
    let apiResult: any = null;
    let apiError: string | null = null;

    // Fire API call immediately — don't wait for it
    const apiPromise = fetch("/api/procure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partNumber: part.part }),
    })
      .then(async res => {
        if (!res.ok) throw new Error(`API error ${res.status}`);
        return res.json();
      })
      .then(data => { apiResult = data; })
      .catch(err => { apiError = err instanceof Error ? err.message : "Unknown error"; })
      .finally(() => { apiDone = true; });

    // Print first batch of lines while API runs
    for (let i = 0; i < WAITING_LINES.length; i++) {
      if (apiDone) break;
      await new Promise(r => setTimeout(r, 500 + Math.random() * 300));
      setTerminalLines(prev => [...prev, WAITING_LINES[i]]);
    }

    // Keep looping lines until API finishes
    let loopIdx = 0;
    while (!apiDone) {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
      if (apiDone) break;
      setTerminalLines(prev => [...prev, LOOPING_LINES[loopIdx % LOOPING_LINES.length]]);
      loopIdx++;
    }

    await apiPromise;

    setTerminalLines(prev => [...prev, "> Done. Generating recommendation..."]);
    await new Promise(r => setTimeout(r, 400));
    setTerminalLines(prev => [...prev, "> Analysis complete."]);
    await new Promise(r => setTimeout(r, 500));

    if (apiError) {
      setError(apiError);
      setPhase("results");
      return;
    }

    if (apiResult?.notFound) {
      setError(`"${part.part}" was not found on Mouser or DigiKey. Please verify the MPN and try again.`);
      setPhase("results");
      return;
    }

    setResults(apiResult as ProcureResult);
    setPhase("results");
  }, []);

  // ── Handle Enter key — defined AFTER runSequence ────────────────────────────
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && query.trim() && !selectedPart) {
        runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN search" });
      }
    },
    [query, selectedPart, runSequence]
  );

  // ── PDF generation ──────────────────────────────────────────────────────────
  const generatePDF = useCallback(async () => {
    if (!results) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const winner = results.suppliers.find(s => s.recommended) || results.suppliers[0];
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const poNumber = `PO-${Date.now().toString().slice(-8)}`;
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    doc.setFillColor(15, 23, 42);
    doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("OMNIPROCURE", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184);
    doc.text("Intelligent B2B Procurement Platform", 14, 26);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PURCHASE ORDER", 210 - 14, 18, { align: "right" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(poNumber, 210 - 14, 26, { align: "right" });

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("FROM", 14, 52);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text("Acme Electronics Ltd.", 14, 58);
    doc.text("12 Innovation Park, Pune 411057", 14, 63);
    doc.text("GST: 27AABCA1234F1Z5", 14, 68);
    doc.text("procurement@acme-electronics.com", 14, 73);

    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text("SUPPLIER", 110, 52);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(winner.name, 110, 58);
    doc.text(`Lead Time: ${winner.leadTime}`, 110, 63);
    doc.text(`Stock Available: ${winner.stock.toLocaleString()} units`, 110, 68);
    doc.text(`Source: ${winner.url}`, 110, 73);

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 80, 196, 80);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Issue Date: ${today}`, 14, 87);
    doc.text(`Valid For: 30 Days`, 100, 87);
    doc.text(`Currency: ${winner.currency}`, 160, 87);

    autoTable(doc, {
      startY: 95,
      head: [["#", "Part Number", "Description", "Qty", "Unit Price", "Total"]],
      body: [[
        "1",
        results.partNumber,
        winner.name,
        "100",
        `${winner.currency} ${winner.price.toFixed(2)}`,
        `${winner.currency} ${(winner.price * 100).toFixed(2)}`,
      ]],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 38 }, 4: { halign: "right" }, 5: { halign: "right" } },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("Subtotal:", 140, finalY);
    doc.text(`${winner.currency} ${(winner.price * 100).toFixed(2)}`, 196, finalY, { align: "right" });
    doc.text("GST (18%):", 140, finalY + 6);
    doc.text(`${winner.currency} ${(winner.price * 100 * 0.18).toFixed(2)}`, 196, finalY + 6, { align: "right" });
    doc.setDrawColor(226, 232, 240);
    doc.line(140, finalY + 9, 196, finalY + 9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(10);
    doc.text("TOTAL:", 140, finalY + 15);
    doc.text(`${winner.currency} ${(winner.price * 100 * 1.18).toFixed(2)}`, 196, finalY + 15, { align: "right" });

    doc.setFillColor(16, 185, 129);
    doc.roundedRect(14, finalY, 90, 18, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("★ CLAUDE RECOMMENDED SUPPLIER", 17, finalY + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(results.recommendation.reason.slice(0, 60), 17, finalY + 13);

    doc.setFillColor(248, 250, 252);
    doc.rect(0, 270, 210, 27, "F");
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text("This PO was auto-generated by OmniProcure AI. Verify pricing before submission.", 105, 278, { align: "center" });
    doc.text("OmniProcure · Tinyfish Hackathon 2025 · omniprocure.ai", 105, 284, { align: "center" });

    doc.save(`Purchase_Order_${results.partNumber}.pdf`);
    setToast("PO Generated Successfully");
  }, [results]);

  const reset = () => {
    setQuery("");
    setSelectedPart(null);
    setPhase("idle");
    setTerminalLines([]);
    setResults(null);
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans">

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-white/5 bg-[#080c14]/90 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <Package size={14} className="text-white" />
          </div>
          <span className="font-bold text-[15px] tracking-tight text-white">OmniProcure</span>
          <span className="text-zinc-600 text-xs mx-1">|</span>
          <span className="text-zinc-500 text-xs font-medium">Command Center</span>
        </div>
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-400 font-medium">Live Status: Operational</span>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-8 h-8 rounded-lg border border-white/8 hover:border-white/20 hover:bg-white/5 flex items-center justify-center transition-all"
          >
            <Settings size={15} className="text-zinc-400" />
          </button>
        </div>
      </nav>

      {/* ── Main content ── */}
      <main className="pt-14 min-h-screen flex flex-col items-center px-4">

        {/* Hero header */}
        <div className="mt-16 mb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
            <Zap size={11} />
            Powered by Tinyfish + Claude 3.5 Sonnet
          </div>
          <h1 className="text-4xl font-bold tracking-tight mb-3 bg-gradient-to-br from-white via-white to-zinc-400 bg-clip-text text-transparent">
            Intelligent Parts Procurement
          </h1>
          <p className="text-zinc-500 text-sm max-w-md mx-auto">
            Enter a Manufacturer Part Number to auto-source pricing from DigiKey &amp; Mouser, analyzed by AI.
          </p>
        </div>

        {/* ── Search input ── */}
        <div className="w-full max-w-2xl relative">
          <div className={`flex items-center gap-3 bg-[#0e1623] border rounded-2xl px-4 py-3.5 transition-all ${
            selectedPart
              ? "border-cyan-500/40 shadow-lg shadow-cyan-500/10"
              : "border-white/8 hover:border-white/15 focus-within:border-cyan-500/50 focus-within:shadow-lg focus-within:shadow-cyan-500/10"
          }`}>
            {selectedPart ? <Lock size={16} className="text-cyan-500 shrink-0" /> : <Search size={16} className="text-zinc-500 shrink-0" />}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!!selectedPart}
              placeholder="Enter Manufacturer Part Number (MPN)…"
              className="flex-1 bg-transparent text-white placeholder-zinc-600 text-sm outline-none font-mono disabled:cursor-not-allowed"
              autoComplete="off"
            />
            {selectedPart && (
              <button onClick={reset} className="text-zinc-500 hover:text-white transition-colors">
                <X size={15} />
              </button>
            )}
          </div>

          {/* Dropdown — visible whenever there's a query typed */}
          {query.trim() && !selectedPart && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-[#0e1623] border border-white/8 rounded-xl overflow-hidden shadow-2xl z-30">
              {suggestions.map((item, i) => (
                <button
                  key={i}
                  onClick={() => runSequence(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left border-b border-white/5"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-medium text-white">{item.part}</div>
                    <div className="text-xs text-zinc-500">{item.desc}</div>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600 ml-auto" />
                </button>
              ))}
              {/* Always-visible search anyway row */}
              <button
                onClick={() => runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN search" })}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-cyan-500/5 transition-colors text-left border-t border-white/5"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                  <Search size={14} className="text-cyan-400" />
                </div>
                <div>
                  <div className="text-sm font-mono font-medium text-cyan-400">
                    Search &quot;{query.trim().toUpperCase()}&quot;
                  </div>
                  <div className="text-xs text-zinc-500">Search this MPN across Mouser &amp; DigiKey</div>
                </div>
                <ChevronRight size={14} className="text-cyan-600 ml-auto" />
              </button>
            </div>
          )}
        </div>

        {/* ── Terminal Phase ── */}
        {phase === "terminal" && (
          <div className="w-full max-w-2xl mt-6 bg-[#060d18] border border-white/8 rounded-2xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-[#0a1220]">
              <Terminal size={14} className="text-cyan-400" />
              <span className="text-xs text-zinc-500 font-mono">tinyfish-agent — procurement.worker</span>
              <div className="ml-auto flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
              </div>
            </div>
            <div ref={terminalRef} className="px-4 py-4 space-y-1.5 h-52 overflow-y-auto font-mono text-sm">
              {terminalLines.map((line, i) => (
                <div
                  key={i}
                  className={`${
                    line.includes("✓") ? "text-emerald-400" : line.includes("Claude") ? "text-cyan-400" : "text-zinc-400"
                  } animate-fade-in`}
                >
                  {line}
                </div>
              ))}
              {terminalLines.length < TERMINAL_LINES.length && (
                <span className="inline-block w-2 h-4 bg-cyan-400 animate-pulse align-middle ml-1" />
              )}
            </div>
          </div>
        )}

        {/* ── Results Phase ── */}
        {phase === "results" && results && (
          <div className="w-full max-w-3xl mt-6 space-y-4 animate-fade-in">
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 flex items-center gap-3">
              <Star size={16} className="text-emerald-400 shrink-0" />
              <div>
                <span className="text-emerald-400 font-semibold text-sm">Claude Recommendation: </span>
                <span className="text-zinc-300 text-sm">{results.recommendation.reason}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.suppliers.map((s, i) => (
                <div
                  key={i}
                  className={`relative bg-[#0e1623] rounded-2xl p-5 border transition-all ${
                    s.recommended ? "border-emerald-500/40 shadow-lg shadow-emerald-500/10" : "border-white/8"
                  }`}
                >
                  {s.recommended && (
                    <div className="absolute -top-3 left-4 bg-emerald-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg">
                      <CheckCircle size={11} />
                      Claude Recommended
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white text-base">{s.name}</h3>
                      <p className="text-zinc-500 text-xs mt-0.5 font-mono">{results.partNumber}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{s.currency} {s.price.toFixed(2)}</div>
                      <div className="text-zinc-500 text-xs">per unit</div>
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-md bg-blue-500/10 flex items-center justify-center">
                        <Package size={12} className="text-blue-400" />
                      </div>
                      <span className="text-zinc-400">Stock:</span>
                      <span className={`font-medium ml-auto ${s.stock > 1000 ? "text-emerald-400" : s.stock > 0 ? "text-yellow-400" : "text-red-400"}`}>
                        {s.stock.toLocaleString()} units
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-md bg-purple-500/10 flex items-center justify-center">
                        <Clock size={12} className="text-purple-400" />
                      </div>
                      <span className="text-zinc-400">Lead Time:</span>
                      <span className="text-white font-medium ml-auto">{s.leadTime}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-6 h-6 rounded-md bg-cyan-500/10 flex items-center justify-center">
                        <TrendingDown size={12} className="text-cyan-400" />
                      </div>
                      <span className="text-zinc-400">100-unit total:</span>
                      <span className="text-white font-medium ml-auto">{s.currency} {(s.price * 100).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={generatePDF}
              className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3.5 rounded-xl transition-all shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 active:scale-[0.99]"
            >
              <Download size={17} />
              Draft Purchase Order (PDF)
            </button>
          </div>
        )}

        {/* Error / Not Found state */}
        {phase === "results" && error && (
          <div className="w-full max-w-2xl mt-6 bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-5 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <X size={16} className="text-red-400" />
            </div>
            <div>
              <div className="text-red-400 font-semibold text-sm mb-1">Part Not Found</div>
              <div className="text-zinc-400 text-sm">{error}</div>
              <button onClick={reset} className="mt-3 text-xs text-zinc-500 hover:text-white underline transition-colors">
                Search again
              </button>
            </div>
          </div>
        )}

        {/* Idle state */}
        {phase === "idle" && (
          <div className="mt-12 grid grid-cols-3 gap-3 w-full max-w-2xl">
            {[
              { icon: Zap, label: "AI-Powered Sourcing", sub: "Tinyfish scrapes DigiKey & Mouser" },
              { icon: ShieldCheck, label: "Claude 3.5 Analysis", sub: "Best price × availability scoring" },
              { icon: Download, label: "Instant PO Generation", sub: "One-click PDF purchase orders" },
            ].map(({ icon: Icon, label, sub }, i) => (
              <div key={i} className="bg-[#0e1623] border border-white/5 rounded-xl p-4 text-center">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-2.5">
                  <Icon size={16} className="text-cyan-400" />
                </div>
                <div className="text-white text-xs font-semibold mb-1">{label}</div>
                <div className="text-zinc-600 text-xs">{sub}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* ── Settings slide-over ── */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setSettingsOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-[#0a1220] border-l border-white/8 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-cyan-400" />
                <span className="font-semibold text-sm text-white">Enterprise Settings</span>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
              <p className="text-xs text-zinc-600 font-medium uppercase tracking-wider mb-4">Integrations</p>
              {SETTINGS_TOGGLES.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-3.5 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-white/4 flex items-center justify-center">
                      <t.icon size={13} className="text-zinc-400" />
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium">{t.label}</div>
                      <div className="text-xs text-zinc-600">{t.sub}</div>
                    </div>
                  </div>
                  <Toggle enabled={t.enabled} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-white/5">
              <p className="text-xs text-zinc-700 text-center">OmniProcure Enterprise v1.0.0</p>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        .animate-fade-in { animation: fade-in 0.3s ease forwards; }
        .animate-slide-up { animation: slide-up 0.3s ease forwards; }
      `}</style>
    </div>
  );
}