"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import {
  Search, Settings, X, CheckCircle, Package,
  TrendingDown, Clock, Download, Zap, Database,
  RefreshCw, ShieldCheck, Lock, ChevronRight, Star,
  AlertCircle, Loader2, LogOut, Mail, Eye, EyeOff,
  History, Trash2, RotateCcw,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface CatalogItem { part: string; desc: string; }
interface SupplierResult {
  name: string; price: number; currency: string;
  stock: number; leadTime: string; url: string; recommended?: boolean;
}
interface ProcureResult {
  partNumber: string;
  suppliers: SupplierResult[];
  recommendation: { winner: string; reason: string; };
}

interface AliasItem { mpn: string; description: string; }

interface HistoryItem {
  id: string;
  part_number: string;
  searched_at: string;
}

// ── Supabase ───────────────────────────────────────────────────────────────────
const FALLBACK_CATALOG: CatalogItem[] = [
  { part: "STM32F103C8T6", desc: "ARM Cortex-M3 Microcontroller, 72MHz" },
  { part: "GRM188R71H104KA93D", desc: "Multilayer Ceramic Capacitor 100nF" },
  { part: "LM358DR2G", desc: "Dual General Purpose Op-Amp, SOIC-8" },
  { part: "NRF52840-QIAA-R", desc: "Bluetooth 5.0 SoC, ARM Cortex-M4" },
  { part: "TPS63020DSJR", desc: "Buck-Boost Converter, 1.8A, 96% Eff." },
];

// ── Singleton Supabase client ──────────────────────────────────────────────────
const getSupabase = (() => {
  let instance: ReturnType<typeof createClient> | null = null;
  return () => {
    if (instance) return instance;
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (url && key) instance = createClient(url, key);
    } catch (_) {}
    return instance;
  };
})();

const supabase = getSupabase();

// ── Constants ──────────────────────────────────────────────────────────────────
const SETTINGS_TOGGLES = [
  { label: "NetSuite ERP Sync", sub: "Connect to Oracle NetSuite GL", icon: Database, enabled: false },
  { label: "SAP S/4HANA Connector", sub: "Bidirectional PO sync", icon: RefreshCw, enabled: false },
  { label: "Slack Procurement Alerts", sub: "Notify #procurement channel", icon: Zap, enabled: false },
  { label: "SOC 2 Audit Logging", sub: "Immutable event trail", icon: ShieldCheck, enabled: true },
  { label: "Auto-PO Approval ≤$500", sub: "Requires finance sign-off above", icon: CheckCircle, enabled: false },
];

const WAITING_LINES = [
  "Initializing Tinyfish Agent...",
  "Authenticating session tokens...",
  "Bypassing bot protections on DigiKey & Mouser...",
  "Dispatching parallel scrape workers...",
  "Extracting pricing from supplier endpoints...",
  "Normalizing currency & lead-time fields...",
  "Running Claude 3.5 Sonnet analysis...",
  "Ranking suppliers by price & availability...",
];

const LOOPING_LINES = [
  "Waiting for Mouser agent response...",
  "Waiting for DigiKey agent response...",
  "Agents still browsing live pages...",
  "Processing supplier data...",
  "Cross-referencing stock levels...",
  "Validating pricing data...",
  "Almost there...",
];

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-2xl animate-slide-up">
      <CheckCircle size={16} style={{ color: "#7b9cc4" }} />
      <span className="font-medium text-sm">{message}</span>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div className={`relative w-9 h-5 rounded-full transition-colors duration-200`}
      style={{ background: enabled ? "#4a6fa5" : "#e2e8f0" }}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${enabled ? "translate-x-4" : "translate-x-0.5"}`} />
    </div>
  );
}

// ── Stock badge ────────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock > 1000) return <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">{stock.toLocaleString()} units</span>;
  if (stock > 0) return <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">{stock.toLocaleString()} units</span>;
  return <span className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 px-2 py-0.5 rounded-full">Out of Stock</span>;
}

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("Check your email to confirm your account.");
        setLoading(false);
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!supabase) return;
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  const handleGuest = () => { onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        style={{ background: "rgba(15,23,42,0.4)" }}
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">

        {/* Top gradient bar */}
        <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#7b9cc4,#4a6fa5,#dde8f8)" }} />

        <div className="px-8 pt-8 pb-8">
          {/* Header */}
          <button onClick={onClose} className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 transition-colors">
            <X size={18} />
          </button>

          <div className="mb-7 text-center">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md" style={{ background: "linear-gradient(135deg,#dde8f8,#7b9cc4)" }}>
              <Package size={22} style={{ color: "#1e2d4a" }} />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-1">
              {mode === "signin" ? "Welcome back" : "Create account"}
            </h2>
            <p className="text-sm text-slate-500">
              {mode === "signin" ? "Sign in to generate Purchase Orders" : "Start sourcing smarter today"}
            </p>
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 border-2 border-slate-200 hover:border-slate-300 bg-white rounded-2xl py-3 text-sm font-semibold text-slate-700 transition-all hover:shadow-sm mb-4 disabled:opacity-60"
          >
            {googleLoading ? <Loader2 size={16} className="animate-spin" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
            )}
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400 font-medium">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          {/* Email form */}
          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 border-2 border-slate-200 focus-within:border-[#7b9cc4] rounded-xl px-3 py-2.5 transition-colors">
                <Mail size={14} className="text-slate-400 shrink-0" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  className="flex-1 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Password</label>
              <div className="flex items-center gap-2 border-2 border-slate-200 focus-within:border-[#7b9cc4] rounded-xl px-3 py-2.5 transition-colors">
                <Lock size={14} className="text-slate-400 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="flex-1 text-sm text-slate-800 placeholder-slate-400 outline-none bg-transparent"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {error && (
              <div className={`text-xs px-3 py-2 rounded-lg ${error.includes("Check your email") ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-red-50 text-red-500 border border-red-100"}`}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "#4a6fa5" }}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {/* Switch mode */}
          <div className="mt-4 text-center">
            <button
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }}
              className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <span style={{ color: "#4a6fa5" }} className="font-semibold">
                {mode === "signin" ? "Sign up" : "Sign in"}
              </span>
            </button>
          </div>

          {/* Guest divider */}
          <div className="mt-5 pt-5 border-t border-slate-100 text-center">
            <button
              onClick={handleGuest}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Continue as guest — search only, no PO generation
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function OmniProcure() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [query, setQuery] = useState("");
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [suggestions, setSuggestions] = useState<CatalogItem[]>([]);
  const [selectedPart, setSelectedPart] = useState<CatalogItem | null>(null);
  const [phase, setPhase] = useState<"idle" | "loading" | "results">("idle");
  const [statusLines, setStatusLines] = useState<string[]>([]);
  const [currentStatus, setCurrentStatus] = useState("");
  const [results, setResults] = useState<ProcureResult | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [aliases, setAliases] = useState<AliasItem[]>([]);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // Auth state listener
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load search history
  const loadHistory = useCallback(async () => {
    if (!supabase || !user) { setSearchHistory([]); return; }
    try {
      const { data } = await supabase
        .from("search_history")
        .select("id, part_number, searched_at")
        .eq("user_id", user.id)
        .order("searched_at", { ascending: false });
      setSearchHistory(data as HistoryItem[] ?? []);
    } catch { setSearchHistory([]); }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Close history dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setHistoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Load catalog
  useEffect(() => {
    async function loadCatalog() {
      if (!supabase) { setCatalog(FALLBACK_CATALOG); return; }
      try {
        const { data, error } = await supabase.from("supplier_catalog").select("part, desc").limit(50);
        if (error || !data?.length) throw new Error();
        setCatalog(data as CatalogItem[]);
      } catch { setCatalog(FALLBACK_CATALOG); }
    }
    loadCatalog();
  }, []);

  // Filter suggestions
  useEffect(() => {
    if (!query.trim() || selectedPart) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    setSuggestions(catalog.filter(c => c.part.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)).slice(0, 6));
  }, [query, catalog, selectedPart]);

  // Sign out
  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setToast("Signed out successfully");
  };

  // Save to history
  const saveToHistory = useCallback(async (partNumber: string) => {
    if (!supabase || !user) return;
    try {
      await (supabase as any).from("search_history").insert({ user_id: user.id, part_number: partNumber });
      loadHistory();
    } catch {}
  }, [user, loadHistory]);

  // Clear all history
  const clearHistory = useCallback(async () => {
    if (!supabase || !user) return;
    try {
      await (supabase as any).from("search_history").delete().eq("user_id", user.id);
      setSearchHistory([]);
    } catch {}
  }, [user]);

  // Delete single history item
  const deleteHistoryItem = useCallback(async (id: string) => {
    if (!supabase) return;
    try {
      await (supabase as any).from("search_history").delete().eq("id", id);
      setSearchHistory(prev => prev.filter(h => h.id !== id));
    } catch {}
  }, []);

  // Run sequence
  const runSequence = useCallback(async (part: CatalogItem) => {
    setSelectedPart(part);
    setQuery(part.part);
    setSuggestions([]);
    setPhase("loading");
    setStatusLines([]);
    setCurrentStatus("Initializing Tinyfish Agent...");
    setResults(null);
    setError(null);
    setAliases([]);

    let apiDone = false;
    let apiResult: any = null;
    let apiError: string | null = null;

    const apiPromise = fetch("/api/procure", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partNumber: part.part }),
    })
      .then(async res => { if (!res.ok) throw new Error(`API error ${res.status}`); return res.json(); })
      .then(data => { apiResult = data; })
      .catch(err => { apiError = err instanceof Error ? err.message : "Unknown error"; })
      .finally(() => { apiDone = true; });

    for (let i = 0; i < WAITING_LINES.length; i++) {
      if (apiDone) break;
      setCurrentStatus(WAITING_LINES[i]);
      setStatusLines(prev => i > 0 ? [...prev, WAITING_LINES[i - 1]] : prev);
      await new Promise(r => setTimeout(r, 500 + Math.random() * 300));
    }

    let loopIdx = 0;
    while (!apiDone) {
      await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
      if (apiDone) break;
      setCurrentStatus(LOOPING_LINES[loopIdx % LOOPING_LINES.length]);
      loopIdx++;
    }

    await apiPromise;
    setCurrentStatus("Done. Building results...");
    await new Promise(r => setTimeout(r, 400));

    if (apiError) { setError(apiError); setPhase("results"); return; }
    if (apiResult?.notFound) {
      setError(`"${part.part}" was not found on Mouser or DigiKey.`);
      if (apiResult.aliases?.length) setAliases(apiResult.aliases);
      setPhase("results");
      return;
    }
    setResults(apiResult as ProcureResult);
    setPhase("results");
    saveToHistory(part.part);
  }, []);

  // Handle Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() && !selectedPart) {
      runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN search" });
    }
  }, [query, selectedPart, runSequence]);

  // PDF — triggers auth modal for guests
  const handlePDFClick = useCallback(() => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }
    generatePDF();
  }, [user, results]);

  // PDF generation
  const generatePDF = useCallback(async () => {
    if (!results) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const winner = results.suppliers.find(s => s.recommended) || results.suppliers[0];
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const poNumber = `PO-${Date.now().toString().slice(-8)}`;
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(22); doc.setFont("helvetica", "bold");
    doc.text("OMNIPROCURE", 14, 18);
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(148, 163, 184);
    doc.text("Intelligent B2B Procurement Platform", 14, 26);
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("PURCHASE ORDER", 196, 18, { align: "right" });
    doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(poNumber, 196, 26, { align: "right" });

    doc.setTextColor(30, 41, 59); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("FROM", 14, 52); doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
    doc.text("Acme Electronics Ltd.", 14, 58);
    doc.text("12 Innovation Park, Pune 411057", 14, 63);
    doc.text("GST: 27AABCA1234F1Z5", 14, 68);
    doc.text("procurement@acme-electronics.com", 14, 73);

    doc.setTextColor(30, 41, 59); doc.setFont("helvetica", "bold");
    doc.text("SUPPLIER", 110, 52); doc.setFont("helvetica", "normal"); doc.setTextColor(71, 85, 105);
    doc.text(winner.name, 110, 58);
    doc.text(`Lead Time: ${winner.leadTime}`, 110, 63);
    doc.text(`Stock: ${winner.stock.toLocaleString()} units`, 110, 68);

    doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3); doc.line(14, 80, 196, 80);
    doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    doc.text(`Issue Date: ${today}`, 14, 87);
    doc.text(`Valid For: 30 Days`, 100, 87);
    doc.text(`Currency: ${winner.currency}`, 160, 87);

    autoTable(doc, {
      startY: 95,
      head: [["#", "Part Number", "Description", "Qty", "Unit Price", "Total"]],
      body: [["1", results.partNumber, winner.name, "100", `${winner.currency} ${winner.price.toFixed(2)}`, `${winner.currency} ${(winner.price * 100).toFixed(2)}`]],
      headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 38 }, 4: { halign: "right" }, 5: { halign: "right" } },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9); doc.setTextColor(71, 85, 105);
    doc.text("Subtotal:", 140, finalY);
    doc.text(`${winner.currency} ${(winner.price * 100).toFixed(2)}`, 196, finalY, { align: "right" });
    doc.text("GST (18%):", 140, finalY + 6);
    doc.text(`${winner.currency} ${(winner.price * 100 * 0.18).toFixed(2)}`, 196, finalY + 6, { align: "right" });
    doc.setDrawColor(226, 232, 240); doc.line(140, finalY + 9, 196, finalY + 9);
    doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42); doc.setFontSize(10);
    doc.text("TOTAL:", 140, finalY + 15);
    doc.text(`${winner.currency} ${(winner.price * 100 * 1.18).toFixed(2)}`, 196, finalY + 15, { align: "right" });

    doc.setFillColor(74, 111, 165); doc.roundedRect(14, finalY, 90, 18, 2, 2, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("CLAUDE RECOMMENDED SUPPLIER", 17, finalY + 7);
    doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(results.recommendation.reason.slice(0, 60), 17, finalY + 13);

    doc.setFillColor(248, 250, 252); doc.rect(0, 270, 210, 27, "F");
    doc.setTextColor(148, 163, 184); doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    doc.text("Auto-generated by OmniProcure AI. Verify pricing before submission.", 105, 278, { align: "center" });
    doc.text("OmniProcure · Tinyfish Hackathon 2025 · omniprocure.ai", 105, 284, { align: "center" });

    doc.save(`Purchase_Order_${results.partNumber}.pdf`);
    setToast("PO Generated Successfully");
  }, [results]);

  const reset = () => {
    setQuery(""); setSelectedPart(null); setPhase("idle");
    setStatusLines([]); setResults(null); setError(null); setAliases([]);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? "";

  return (
    <div className="min-h-screen font-sans" style={{ fontFamily: "var(--font-geist), system-ui, sans-serif" }}>

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => { setToast("Signed in! You can now generate POs."); setTimeout(() => generatePDF(), 300); }}
        />
      )}

      {/* ── Navbar ── */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-14 border-b border-slate-100 bg-white/90 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shadow-sm" style={{ background: "#4a6fa5" }}>
            <Package size={14} className="text-white" />
          </div>
          <span className="font-bold text-[15px] tracking-tight text-slate-900">OmniProcure</span>
          <span className="text-slate-300 text-xs mx-1">|</span>
          <span className="text-slate-400 text-xs font-medium">Command Center</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-xs text-emerald-600 font-medium">Live: Operational</span>
          </div>

          {/* Auth area */}
          {authLoading ? (
            <Loader2 size={15} className="animate-spin text-slate-400" />
          ) : user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: "#4a6fa5" }}>
                  {userInitials}
                </div>
                <span className="text-xs text-slate-600 font-medium max-w-[120px] truncate">{user.email}</span>
              </div>
              <button onClick={handleSignOut} className="w-7 h-7 rounded-lg border border-slate-200 hover:bg-red-50 hover:border-red-200 flex items-center justify-center transition-all">
                <LogOut size={13} className="text-slate-400 hover:text-red-400" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="text-xs font-semibold text-white px-4 py-1.5 rounded-xl transition-all shadow-sm"
              style={{ background: "#4a6fa5" }}
            >
              Sign in
            </button>
          )}

          <button onClick={() => setSettingsOpen(true)} className="w-8 h-8 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 flex items-center justify-center transition-all">
            <Settings size={15} className="text-slate-400" />
          </button>
        </div>
      </nav>

      {/* ── Main ── */}
      <main
        className="pt-14 min-h-screen flex flex-col items-center px-4"
        style={{ backgroundColor: "#f1f4f8", backgroundImage: "radial-gradient(circle,#94a3b8 1.2px,transparent 1.2px)", backgroundSize: "22px 22px" }}
      >
        {/* Hero */}
        <div className="mt-20 mb-14 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "#dde8f8", border: "1px solid #c8d8f0", color: "#4a6fa5" }}>
            <Zap size={11} />
            Powered by Tinyfish + Claude 3.5 Sonnet
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-3">Intelligent Parts Procurement</h1>
          <p className="text-slate-500 text-sm max-w-md mx-auto leading-relaxed">
            Enter a Manufacturer Part Number to instantly source and compare live pricing from Mouser and DigiKey, analyzed by AI.
          </p>
          {!user && !authLoading && (
            <p className="text-xs text-slate-400 mt-3">
              Searching is free.{" "}
              <button onClick={() => setShowAuthModal(true)} className="font-semibold underline underline-offset-2 transition-colors" style={{ color: "#4a6fa5" }}>
                Sign in
              </button>{" "}
              to generate Purchase Orders.
            </p>
          )}
        </div>

        {/* ── Search ── */}
        <div className="w-full max-w-2xl relative">
          <div className={`flex items-center gap-3 bg-white border-2 rounded-2xl px-4 py-3.5 transition-all shadow-sm ${selectedPart ? "" : "hover:border-slate-300"}`}
            style={selectedPart ? { borderColor: "#7b9cc4", boxShadow: "0 4px 20px rgba(123,156,196,0.15)" } : {}}>
            {selectedPart
              ? <Lock size={16} style={{ color: "#4a6fa5" }} className="shrink-0" />
              : <Search size={16} className="text-slate-400 shrink-0" />}
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!!selectedPart}
              placeholder="Enter Manufacturer Part Number (MPN)…"
              className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-sm outline-none font-mono disabled:cursor-not-allowed"
              autoComplete="off"
            />
            {selectedPart
              ? <button onClick={reset} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={15} /></button>
              : query.trim() && (
                <button onClick={() => runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN" })}
                  className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                  style={{ background: "#4a6fa5" }}>
                  Search
                </button>
              )}
            {user && !selectedPart && (
              <button
                onClick={() => setHistoryOpen(h => !h)}
                className={`ml-1 w-8 h-8 rounded-lg border flex items-center justify-center transition-all shrink-0 ${historyOpen ? "border-[#7b9cc4] bg-[#dde8f8]" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}
                title="Search history"
              >
                <History size={14} style={{ color: historyOpen ? "#4a6fa5" : "#94a3b8" }} />
              </button>
            )}
          </div>

          {/* History dropdown */}
          {user && historyOpen && !selectedPart && (
            <div ref={historyRef} className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl z-30 animate-fade-in">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <History size={13} style={{ color: "#4a6fa5" }} />
                  <span className="text-xs font-bold text-slate-700">Search History</span>
                  <span className="text-xs text-slate-400">({searchHistory.length})</span>
                </div>
                {searchHistory.length > 0 && (
                  <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors font-medium">
                    <Trash2 size={11} />
                    Clear all
                  </button>
                )}
              </div>
              {searchHistory.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-slate-400">No searches yet</div>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  {searchHistory.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors group border-b border-slate-50 last:border-0">
                      <button
                        className="flex items-center gap-3 flex-1 text-left"
                        onClick={() => { setHistoryOpen(false); runSequence({ part: item.part_number, desc: "From history" }); }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#dde8f8", border: "1px solid #c8d8f0" }}>
                          <RotateCcw size={12} style={{ color: "#4a6fa5" }} />
                        </div>
                        <div>
                          <div className="text-sm font-mono font-semibold text-slate-800">{item.part_number}</div>
                          <div className="text-xs text-slate-400">{new Date(item.searched_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                        </div>
                      </button>
                      <button
                        onClick={() => deleteHistoryItem(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-400"
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions Dropdown */}
          {query.trim() && !selectedPart && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xl z-30">
              {suggestions.map((item, i) => (
                <button key={i} onClick={() => runSequence(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-50">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#dde8f8", border: "1px solid #c8d8f0" }}>
                    <Package size={13} style={{ color: "#4a6fa5" }} />
                  </div>
                  <div>
                    <div className="text-sm font-mono font-semibold text-slate-800">{item.part}</div>
                    <div className="text-xs text-slate-400">{item.desc}</div>
                  </div>
                  <ChevronRight size={14} className="text-slate-300 ml-auto" />
                </button>
              ))}
              <button
                onClick={() => runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN search" })}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 transition-colors text-left border-t border-slate-100">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "#4a6fa5" }}>
                  <Search size={13} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-mono font-semibold" style={{ color: "#4a6fa5" }}>Search &quot;{query.trim().toUpperCase()}&quot;</div>
                  <div className="text-xs text-slate-400">Search across Mouser &amp; DigiKey</div>
                </div>
                <ChevronRight size={14} style={{ color: "#7b9cc4" }} className="ml-auto" />
              </button>
            </div>
          )}
        </div>

        {/* ── Loading Phase ── */}
        {phase === "loading" && (
          <div className="w-full max-w-2xl mt-6 animate-fade-in">
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#4a6fa5" }}>
                  <Loader2 size={15} className="text-white animate-spin" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-800">Sourcing in progress</div>
                  <div className="text-xs text-slate-400">Live agents browsing Mouser &amp; DigiKey</div>
                </div>
                <div className="ml-auto flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#7b9cc4", animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
              <div className="rounded-xl px-4 py-3 mb-4" style={{ background: "#dde8f8", border: "1px solid #c8d8f0" }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#4a6fa5" }} />
                  <span className="text-xs font-mono font-medium" style={{ color: "#1e2d4a" }}>{currentStatus}</span>
                </div>
              </div>
              {statusLines.length > 0 && (
                <div className="space-y-1.5">
                  {statusLines.slice(-4).map((line, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-emerald-500 shrink-0" />
                      <span className="text-xs text-slate-400 font-mono">{line}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 h-1 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full animate-progress" style={{ background: "linear-gradient(90deg,#7b9cc4,#4a6fa5)" }} />
              </div>
            </div>
          </div>
        )}

        {/* ── Results Phase ── */}
        {phase === "results" && results && (
          <div className="w-full max-w-3xl mt-6 space-y-4 animate-fade-in">
            {/* Recommendation banner */}
            <div className="rounded-2xl px-5 py-4 flex items-start gap-3" style={{ background: "linear-gradient(135deg,#dde8f8,#e8eeff)", border: "1px solid #c8d8f0" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "#4a6fa5" }}>
                <Star size={14} className="text-white" />
              </div>
              <div>
                <div className="font-semibold text-sm mb-0.5" style={{ color: "#1e2d4a" }}>Claude Recommendation</div>
                <div className="text-sm" style={{ color: "#5a7a9e" }}>{results.recommendation.reason}</div>
              </div>
              <div className="text-xs font-mono shrink-0" style={{ color: "#7b9cc4" }}>{results.partNumber}</div>
            </div>

            {/* Supplier cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.suppliers.map((s, i) => (
                <div key={i} className="relative bg-white rounded-2xl p-5 border-2 transition-all"
                  style={s.recommended ? { borderColor: "#7b9cc4", boxShadow: "0 8px 30px rgba(123,156,196,0.2)" } : { borderColor: "#e2e8f0" }}>
                  {s.recommended && (
                    <div className="absolute -top-3 left-5 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-md" style={{ background: "#4a6fa5" }}>
                      <CheckCircle size={10} />Claude Recommended
                    </div>
                  )}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">{s.name}</h3>
                      <p className="text-slate-400 text-xs mt-0.5 font-mono">{results.partNumber}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-slate-900">${s.price.toFixed(3)}</div>
                      <div className="text-slate-400 text-xs">per unit</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-500"><Package size={13} className="text-slate-400" />Stock</div>
                      <StockBadge stock={s.stock} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-500"><Clock size={13} className="text-slate-400" />Lead Time</div>
                      <span className="text-sm font-semibold text-slate-700">{s.leadTime}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-slate-500"><TrendingDown size={13} className="text-slate-400" />100-unit total</div>
                      <span className="text-sm font-bold text-slate-800">${(s.price * 100).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 truncate">{s.url}</div>
                </div>
              ))}
            </div>

            {/* PDF button — same for guest and user, guest triggers modal */}
            <button
              onClick={handlePDFClick}
              className="w-full flex items-center justify-center gap-2.5 active:scale-[0.99] text-white font-semibold py-3.5 rounded-xl transition-all shadow-md"
              style={{ background: "#4a6fa5" }}
            >
              {user ? <Download size={16} /> : <Lock size={16} />}
              {user ? "Draft Purchase Order (PDF)" : "Sign in to Generate Purchase Order"}
            </button>

            <button onClick={reset} className="w-full text-center text-sm text-slate-400 hover:text-slate-600 transition-colors py-1">
              Search a different part
            </button>
          </div>
        )}

        {/* ── Error ── */}
        {phase === "results" && error && (
          <div className="w-full max-w-2xl mt-6 space-y-3 animate-fade-in">
            <div className="bg-white border-2 border-red-100 rounded-2xl px-5 py-5 flex items-start gap-4 shadow-sm">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                <AlertCircle size={16} className="text-red-400" />
              </div>
              <div className="flex-1">
                <div className="text-slate-800 font-semibold text-sm mb-1">Part Not Found</div>
                <div className="text-slate-500 text-sm leading-relaxed">{error}</div>
                <button onClick={reset} className="mt-3 text-xs font-medium transition-colors" style={{ color: "#4a6fa5" }}>Try another MPN →</button>
              </div>
            </div>

            {/* Claude alias suggestions */}
            {aliases.length > 0 && (
              <div className="bg-white border-2 rounded-2xl px-5 py-5 shadow-sm" style={{ borderColor: "#c8d8f0" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#dde8f8" }}>
                    <Search size={13} style={{ color: "#4a6fa5" }} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800">Did you mean one of these?</div>
                    <div className="text-xs text-slate-400">Claude identified these distributor SKUs for your search</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {aliases.map((alias, i) => (
                    <button
                      key={i}
                      onClick={() => { setError(null); setAliases([]); runSequence({ part: alias.mpn, desc: alias.description }); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border-2 hover:shadow-md transition-all text-left group"
                      style={{ borderColor: "#e8eeff", background: "linear-gradient(135deg,#f8faff,#f0f4ff)" }}
                    >
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform" style={{ background: "#4a6fa5" }}>
                        <Package size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-bold text-sm text-slate-900">{alias.mpn}</div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">{alias.description}</div>
                      </div>
                      <ChevronRight size={16} style={{ color: "#7b9cc4" }} className="shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Idle ── */}
        {phase === "idle" && (
          <div className="mt-20 w-full max-w-2xl space-y-10 animate-fade-in">
            <div className="grid grid-cols-3 gap-6">
              {[
                { icon: Zap, label: "Live Web Scraping", sub: "Tinyfish browses Mouser & DigiKey in real-time" },
                { icon: Star, label: "Claude 3.5 Analysis", sub: "AI picks the best supplier by price & stock" },
                { icon: Download, label: "Instant PO Generation", sub: "One-click professional PDF purchase orders" },
              ].map(({ icon: Icon, label, sub }, i) => (
                <div key={i} className="rounded-2xl p-7 text-center shadow-sm hover:shadow-md transition-all cursor-default" style={{ background: "linear-gradient(135deg,#dde8f8,#e8eeff)", border: "1px solid #c8d8f0" }}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(255,255,255,0.6)", border: "1px solid #b8cce8" }}>
                    <Icon size={22} style={{ color: "#4a6fa5" }} />
                  </div>
                  <div className="text-sm font-bold mb-2" style={{ color: "#1e2d4a" }}>{label}</div>
                  <div className="text-xs leading-relaxed" style={{ color: "#5a7a9e" }}>{sub}</div>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Try these parts</p>
              <div className="flex flex-wrap gap-2">
                {FALLBACK_CATALOG.map((item, i) => (
                  <button key={i} onClick={() => runSequence(item)}
                    className="bg-white border border-slate-200 hover:border-[#7b9cc4] text-slate-600 text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-all shadow-sm">
                    {item.part}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Settings panel ── */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40" onClick={() => setSettingsOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Settings size={15} style={{ color: "#4a6fa5" }} />
                <span className="font-bold text-sm text-slate-800">Enterprise Settings</span>
              </div>
              <button onClick={() => setSettingsOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Integrations</p>
              {SETTINGS_TOGGLES.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-3.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                      <t.icon size={13} className="text-slate-500" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-700">{t.label}</div>
                      <div className="text-xs text-slate-400">{t.sub}</div>
                    </div>
                  </div>
                  <Toggle enabled={t.enabled} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-100">
              <p className="text-xs text-slate-400 text-center">OmniProcure Enterprise v1.0.0</p>
            </div>
          </div>
        </>
      )}

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      <style jsx global>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes slide-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
        @keyframes progress { 0% { width: 5%; } 50% { width: 70%; } 90% { width: 90%; } 100% { width: 95%; } }
        .animate-fade-in { animation: fade-in 0.4s ease forwards; }
        .animate-slide-up { animation: slide-up 0.3s ease forwards; }
        .animate-progress { animation: progress 180s ease-out forwards; }
      `}</style>
    </div>
  );
}