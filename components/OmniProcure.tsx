"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import Link from "next/link";
import {
  Search, Settings, X, CheckCircle, Package,
  TrendingDown, Clock, Download, Zap, Database,
  RefreshCw, ShieldCheck, Lock, ChevronRight, Star,
  AlertCircle, Loader2, LogOut, Mail, Eye, EyeOff,
  History, Trash2, RotateCcw, ExternalLink, Lightbulb,
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
interface AlternativeSet { forSupplier: string; alternatives: AliasItem[]; }
interface HistoryItem { id: string; part_number: string; searched_at: string; }

// ── Supabase singleton ─────────────────────────────────────────────────────────
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
const FALLBACK_CATALOG: CatalogItem[] = [
  { part: "STM32F103C8T6", desc: "ARM Cortex-M3 Microcontroller, 72MHz" },
  { part: "GRM188R71H104KA93D", desc: "Multilayer Ceramic Capacitor 100nF" },
  { part: "LM358DR2G", desc: "Dual General Purpose Op-Amp, SOIC-8" },
  { part: "NRF52840-QIAA-R", desc: "Bluetooth 5.0 SoC, ARM Cortex-M4" },
  { part: "TPS63020DSJR", desc: "Buck-Boost Converter, 1.8A, 96% Eff." },
];

const SETTINGS_TOGGLES = [
  { label: "NetSuite ERP Sync", sub: "Connect to Oracle NetSuite GL", icon: Database, enabled: false },
  { label: "SAP S/4HANA Connector", sub: "Bidirectional PO sync", icon: RefreshCw, enabled: false },
  { label: "Slack Procurement Alerts", sub: "Notify #procurement channel", icon: Zap, enabled: false },
  { label: "SOC 2 Audit Logging", sub: "Immutable event trail", icon: ShieldCheck, enabled: true },
  { label: "Auto-PO Approval ≤$500", sub: "Requires finance sign-off above", icon: CheckCircle, enabled: false },
];

const WAITING_LINES = [
  "Initializing Tinyfish Agents...",
  "Bypassing bot protections on DigiKey, Mouser & LCSC...",
  "Dispatching parallel scrape workers [3x]...",
  "Extracting live pricing from supplier endpoints...",
  "Normalizing currency & lead-time fields...",
  "Running Claude AI analysis...",
];

const LOOPING_LINES = [
  "Agents still browsing live pages...",
  "Waiting for remaining supplier responses...",
  "Processing supplier data...",
  "Cross-referencing stock levels...",
  "Almost there...",
];

// ── AtomLogo ───────────────────────────────────────────────────────────────────
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

// ── Toast ──────────────────────────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl animate-slide-up"
      style={{ background: "rgba(30,27,75,0.95)", border: "1px solid rgba(99,102,241,0.3)", backdropFilter: "blur(12px)" }}>
      <CheckCircle size={16} className="text-indigo-400" />
      <span className="font-medium text-sm text-white">{message}</span>
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────
function Toggle({ enabled }: { enabled: boolean }) {
  return (
    <div className="relative w-9 h-5 rounded-full transition-colors duration-200"
      style={{ background: enabled ? "rgba(99,102,241,0.8)" : "rgba(255,255,255,0.1)" }}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200 ${enabled ? "translate-x-4 bg-white" : "translate-x-0.5 bg-white/60"}`} />
    </div>
  );
}

// ── Stock badge ────────────────────────────────────────────────────────────────
function StockBadge({ stock }: { stock: number }) {
  if (stock > 1000) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: "#34d399", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>{stock.toLocaleString()} units</span>;
  if (stock > 0) return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.2)" }}>{stock.toLocaleString()} units</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color: "#f87171", background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>Out of Stock</span>;
}

// ── Auth Modal ─────────────────────────────────────────────────────────────────
function AuthModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault(); if (!supabase) return;
    setLoading(true); setError("");
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setError("Check your email to confirm your account."); setLoading(false); return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onSuccess(); onClose();
    } catch (err: any) { setError(err.message ?? "Something went wrong"); }
    finally { setLoading(false); }
  };

  const handleGoogle = async () => {
    if (!supabase) return; setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
    if (error) { setError(error.message); setGoogleLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm" style={{ background: "rgba(3,7,18,0.7)" }} onClick={onClose} />
      <div className="relative w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-fade-in"
        style={{ background: "rgba(15,10,40,0.97)", border: "1px solid rgba(99,102,241,0.25)" }}>
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg,#818cf8,#6366f1,#60a5fa)" }} />
        <div className="px-8 pt-8 pb-8">
          <button onClick={onClose} className="absolute top-5 right-5 text-white/40 hover:text-white/70 transition-colors"><X size={18} /></button>
          <div className="mb-7 text-center">
            <div className="flex justify-center mb-4"><AtomLogo size={48} /></div>
            <h2 className="text-xl font-bold text-white mb-1">{mode === "signin" ? "Welcome back" : "Join OmniProcure"}</h2>
            <p className="text-sm text-white/50">{mode === "signin" ? "Sign in to generate Purchase Orders & track history" : "Start sourcing smarter with AI-powered procurement"}</p>
          </div>
          <button onClick={handleGoogle} disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl py-3 text-sm font-semibold text-white transition-all mb-4 disabled:opacity-60"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)" }}>
            {googleLoading ? <Loader2 size={16} className="animate-spin" /> : (
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-xs text-white/30 font-medium">or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>
          <form onSubmit={handleEmail} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">Email</label>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Mail size={14} className="text-white/30 shrink-0" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" required className="flex-1 text-sm text-white placeholder-white/20 outline-none bg-transparent" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-white/50 mb-1.5 block">Password</label>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Lock size={14} className="text-white/30 shrink-0" />
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required className="flex-1 text-sm text-white placeholder-white/20 outline-none bg-transparent" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-white/30 hover:text-white/60 transition-colors">{showPassword ? <EyeOff size={14} /> : <Eye size={14} />}</button>
              </div>
            </div>
            {error && <div className={`text-xs px-3 py-2 rounded-lg ${error.includes("Check your email") ? "text-emerald-400 bg-emerald-400/10 border border-emerald-400/20" : "text-red-400 bg-red-400/10 border border-red-400/20"}`}>{error}</div>}
            <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-white text-sm font-bold transition-all disabled:opacity-60 flex items-center justify-center gap-2" style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : null}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>
          <div className="mt-4 text-center">
            <button onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); }} className="text-xs text-white/40 hover:text-white/60 transition-colors">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <span className="text-indigo-400 font-semibold">{mode === "signin" ? "Sign up" : "Sign in"}</span>
            </button>
          </div>
          <div className="mt-5 pt-5 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <button onClick={onClose} className="text-xs text-white/25 hover:text-white/40 transition-colors">Continue as guest — search only, no PO generation</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Supplier Card ──────────────────────────────────────────────────────────────
function SupplierCard({
  supplier, partNumber, alternatives, onSearchAlternative,
}: {
  supplier: SupplierResult;
  partNumber: string;
  alternatives: AliasItem[];
  onSearchAlternative: (mpn: string) => void;
}) {
  const isRecommended = supplier.recommended;
  const hasNoStock = supplier.stock === 0;

  return (
    <div className="relative rounded-2xl p-5 transition-all animate-fade-in"
      style={isRecommended
        ? { background: "rgba(99,102,241,0.08)", border: "1.5px solid rgba(99,102,241,0.35)", boxShadow: "0 8px 40px rgba(99,102,241,0.15)" }
        : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
      {isRecommended && (
        <div className="absolute -top-3 left-5 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg"
          style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}>
          <CheckCircle size={10} />Claude Pick
        </div>
      )}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h3 className="font-bold text-white/90 text-base">{supplier.name}</h3>
          <p className="text-white/30 text-xs mt-0.5 font-mono">{partNumber}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">${supplier.price.toFixed(3)}</div>
          <div className="text-white/30 text-xs">per unit</div>
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/40"><Package size={13} className="text-white/25" />Stock</div>
          <StockBadge stock={supplier.stock} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/40"><Clock size={13} className="text-white/25" />Lead Time</div>
          <span className="text-sm font-semibold text-white/70">{supplier.leadTime}</span>
        </div>
      </div>

      {/* Clickable URL */}
      <a href={supplier.url} target="_blank" rel="noopener noreferrer"
        className="mt-4 pt-4 flex items-center gap-1.5 group transition-colors"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-xs text-white/20 truncate flex-1 group-hover:text-indigo-400 transition-colors">{supplier.url}</span>
        <ExternalLink size={11} className="text-white/15 group-hover:text-indigo-400 shrink-0 transition-colors" />
      </a>

      {/* Alternative suggestions for out-of-stock */}
      {hasNoStock && alternatives.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb size={11} className="text-yellow-400" />
            <span className="text-xs text-yellow-400/80 font-semibold">Alternative parts</span>
          </div>
          {alternatives.map((alt, i) => (
            <button key={i} onClick={() => onSearchAlternative(alt.mpn)}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left mt-1 transition-all hover:scale-[1.01]"
              style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-mono font-bold text-yellow-300">{alt.mpn}</div>
                <div className="text-xs text-white/30 truncate">{alt.description}</div>
              </div>
              <ChevronRight size={12} className="text-yellow-400/50 shrink-0" />
            </button>
          ))}
        </div>
      )}
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
  const [currentStatus, setCurrentStatus] = useState("");
  const [statusLines, setStatusLines] = useState<string[]>([]);

  // Streaming results state
  const [searchingSuppliers, setSearchingSuppliers] = useState<string[]>([]);
  const [streamedSuppliers, setStreamedSuppliers] = useState<SupplierResult[]>([]);
  const [notFoundSuppliers, setNotFoundSuppliers] = useState<string[]>([]);
  const [alternatives, setAlternatives] = useState<AlternativeSet[]>([]);
  const [recommendation, setRecommendation] = useState<{ winner: string; reason: string } | null>(null);
  const [partNumber, setPartNumber] = useState("");
  const [aliases, setAliases] = useState<AliasItem[]>([]);
  const [notFound, setNotFound] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchHistory, setSearchHistory] = useState<HistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  // Auth
  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setUser(data.session?.user ?? null); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  // History
  const loadHistory = useCallback(async () => {
    if (!supabase || !user) { setSearchHistory([]); return; }
    try {
      const { data } = await supabase.from("search_history").select("id, part_number, searched_at").eq("user_id", user.id).order("searched_at", { ascending: false });
      setSearchHistory(data as HistoryItem[] ?? []);
    } catch { setSearchHistory([]); }
  }, [user]);
  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => {
    function handleClick(e: MouseEvent) { if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false); }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Catalog
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

  useEffect(() => {
    if (!query.trim() || selectedPart) { setSuggestions([]); return; }
    const q = query.toLowerCase();
    setSuggestions(catalog.filter(c => c.part.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)).slice(0, 6));
  }, [query, catalog, selectedPart]);

  const handleSignOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut(); setUser(null); setToast("Signed out successfully");
  };

  const saveToHistory = useCallback(async (pn: string) => {
    if (!supabase || !user) return;
    try { await (supabase as any).from("search_history").insert({ user_id: user.id, part_number: pn }); loadHistory(); } catch {}
  }, [user, loadHistory]);

  const clearHistory = useCallback(async () => {
    if (!supabase || !user) return;
    try { await (supabase as any).from("search_history").delete().eq("user_id", user.id); setSearchHistory([]); } catch {}
  }, [user]);

  const deleteHistoryItem = useCallback(async (id: string) => {
    if (!supabase) return;
    try { await (supabase as any).from("search_history").delete().eq("id", id); setSearchHistory(prev => prev.filter(h => h.id !== id)); } catch {}
  }, []);

  // ── Streaming run sequence ──────────────────────────────────────────────────
  const runSequence = useCallback(async (part: CatalogItem) => {
    setSelectedPart(part); setQuery(part.part); setSuggestions([]);
    setPhase("loading"); setStatusLines([]); setCurrentStatus("Initializing Tinyfish Agents...");
    setSearchingSuppliers([]); setStreamedSuppliers([]); setNotFoundSuppliers([]); setAlternatives([]);
    setRecommendation(null); setAliases([]); setNotFound(false);
    setPartNumber(part.part);

    // Animate status while streaming
    let done = false;
    const animateStatus = async () => {
      for (let i = 0; i < WAITING_LINES.length; i++) {
        if (done) break;
        setCurrentStatus(WAITING_LINES[i]);
        setStatusLines(prev => i > 0 ? [...prev, WAITING_LINES[i - 1]] : prev);
        await new Promise(r => setTimeout(r, 600 + Math.random() * 300));
      }
      let li = 0;
      while (!done) {
        await new Promise(r => setTimeout(r, 900 + Math.random() * 400));
        if (done) break;
        setCurrentStatus(LOOPING_LINES[li % LOOPING_LINES.length]); li++;
      }
    };
    animateStatus();

    try {
      const res = await fetch("/api/procure-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partNumber: part.part }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const raw = line.slice(5).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);

            if (event.type === "supplier_searching") {
              setSearchingSuppliers(prev => [...prev, event.name]);
              setPhase("results");
            }
            if (event.type === "supplier_found") {
              setStreamedSuppliers(prev => [...prev, event.supplier]);
              setPhase("results"); // Show results section as soon as first supplier arrives
            }
            if (event.type === "supplier_not_found") {
              setNotFoundSuppliers(prev => [...prev, event.name]);
            }
            if (event.type === "alternatives") {
              setAlternatives(prev => [...prev, { forSupplier: event.forSupplier, alternatives: event.alternatives }]);
            }
            if (event.type === "analyzing") {
              setCurrentStatus("Claude AI is comparing suppliers...");
            }
            if (event.type === "complete") {
              setStreamedSuppliers(event.suppliers);
              setRecommendation(event.recommendation);
              saveToHistory(part.part);
            }
            if (event.type === "not_found") {
              setNotFound(true);
              setAliases(event.aliases ?? []);
              setPhase("results");
            }
          } catch {}
        }
      }
    } catch (err) {
      setNotFound(true); setPhase("results");
    } finally {
      done = true;
    }
  }, [saveToHistory]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim() && !selectedPart)
      runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN search" });
  }, [query, selectedPart, runSequence]);

  const generatePDF = useCallback(async () => {
    if (!streamedSuppliers.length) return;
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const winner = streamedSuppliers.find(s => s.recommended) || streamedSuppliers[0];
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const poNumber = `PO-${Date.now().toString().slice(-8)}`;
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    doc.setFillColor(15, 23, 42); doc.rect(0, 0, 210, 40, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(22); doc.setFont("helvetica","bold");
    doc.text("OMNIPROCURE", 14, 18);
    doc.setFontSize(9); doc.setFont("helvetica","normal"); doc.setTextColor(148,163,184);
    doc.text("Autonomous B2B Procurement Platform", 14, 26);
    doc.setTextColor(255,255,255); doc.setFontSize(14); doc.setFont("helvetica","bold");
    doc.text("PURCHASE ORDER", 196, 18, { align: "right" });
    doc.setFontSize(10); doc.setFont("helvetica","normal"); doc.text(poNumber, 196, 26, { align: "right" });

    doc.setTextColor(30,41,59); doc.setFontSize(9); doc.setFont("helvetica","bold");
    doc.text("FROM", 14, 52); doc.setFont("helvetica","normal"); doc.setTextColor(71,85,105);
    doc.text("Acme Electronics Ltd.", 14, 58); doc.text("12 Innovation Park, Pune 411057", 14, 63);
    doc.text("GST: 27AABCA1234F1Z5", 14, 68); doc.text("procurement@acme-electronics.com", 14, 73);

    doc.setTextColor(30,41,59); doc.setFont("helvetica","bold"); doc.text("SUPPLIER", 110, 52);
    doc.setFont("helvetica","normal"); doc.setTextColor(71,85,105);
    doc.text(winner.name, 110, 58); doc.text(`Lead Time: ${winner.leadTime}`, 110, 63);
    doc.text(`Stock: ${winner.stock.toLocaleString()} units`, 110, 68);

    doc.setDrawColor(226,232,240); doc.setLineWidth(0.3); doc.line(14, 80, 196, 80);
    doc.setFontSize(9); doc.setTextColor(71,85,105);
    doc.text(`Issue Date: ${today}`, 14, 87); doc.text(`Valid For: 30 Days`, 100, 87); doc.text(`Currency: ${winner.currency}`, 160, 87);

    autoTable(doc, {
      startY: 95,
      head: [["#","Part Number","Description","Qty","Unit Price","Total"]],
      body: [["1", partNumber, winner.name, "100", `${winner.currency} ${winner.price.toFixed(2)}`, `${winner.currency} ${(winner.price*100).toFixed(2)}`]],
      headStyles: { fillColor: [15,23,42], textColor: 255, fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: [30,41,59] },
      alternateRowStyles: { fillColor: [248,250,252] },
      columnStyles: { 0:{cellWidth:10}, 1:{cellWidth:38}, 4:{halign:"right"}, 5:{halign:"right"} },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(9); doc.setTextColor(71,85,105);
    doc.text("Subtotal:", 140, finalY); doc.text(`${winner.currency} ${(winner.price*100).toFixed(2)}`, 196, finalY, {align:"right"});
    doc.text("GST (18%):", 140, finalY+6); doc.text(`${winner.currency} ${(winner.price*100*0.18).toFixed(2)}`, 196, finalY+6, {align:"right"});
    doc.setDrawColor(226,232,240); doc.line(140, finalY+9, 196, finalY+9);
    doc.setFont("helvetica","bold"); doc.setTextColor(15,23,42); doc.setFontSize(10);
    doc.text("TOTAL:", 140, finalY+15); doc.text(`${winner.currency} ${(winner.price*100*1.18).toFixed(2)}`, 196, finalY+15, {align:"right"});

    doc.setFillColor(74,111,165); doc.roundedRect(14, finalY, 90, 18, 2, 2, "F");
    doc.setTextColor(255,255,255); doc.setFontSize(8); doc.setFont("helvetica","bold");
    doc.text("CLAUDE AI RECOMMENDED SUPPLIER", 17, finalY+7);
    doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
    if (recommendation) doc.text(recommendation.reason.slice(0, 60), 17, finalY+13);

    doc.setFillColor(248,250,252); doc.rect(0, 270, 210, 27, "F");
    doc.setTextColor(148,163,184); doc.setFontSize(7.5); doc.setFont("helvetica","normal");
    doc.text("Auto-generated by OmniProcure AI. Verify pricing before submission.", 105, 278, {align:"center"});
    doc.text("OmniProcure · Powered by Tinyfish + Claude AI · omniprocure.ai", 105, 284, {align:"center"});

    doc.save(`Purchase_Order_${partNumber}.pdf`);
    setToast("PO Generated Successfully");
  }, [streamedSuppliers, partNumber, recommendation]);

  const handlePDFClick = useCallback(() => {
    if (!user) { setShowAuthModal(true); return; }
    generatePDF();
  }, [user, generatePDF]);

  const reset = () => {
    setQuery(""); setSelectedPart(null); setPhase("idle");
    setSearchingSuppliers([]); setStreamedSuppliers([]); setNotFoundSuppliers([]); setAlternatives([]);
    setRecommendation(null); setAliases([]); setNotFound(false); setPartNumber("");
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const glass = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(12px)" };
  const userInitials = user?.email?.slice(0, 2).toUpperCase() ?? "";

  return (
    <div className="min-h-screen font-sans" style={{ fontFamily: "var(--font-geist), system-ui, sans-serif", background: "linear-gradient(135deg, #030712 0%, #0f0a2e 40%, #0c1445 70%, #030712 100%)" }}>
      {/* Ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] left-[-10%] w-[60vw] h-[60vw] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #4338ca 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #1d4ed8 0%, transparent 70%)", filter: "blur(100px)" }} />
        <div className="absolute top-[40%] left-[50%] w-[30vw] h-[30vw] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #7c3aed 0%, transparent 70%)", filter: "blur(60px)" }} />
      </div>

      {showAuthModal && <AuthModal onClose={() => setShowAuthModal(false)} onSuccess={() => { setToast("Signed in! You can now generate POs."); setTimeout(() => generatePDF(), 300); }} />}

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-40 h-16 flex items-center justify-between px-6"
        style={{ background: "rgba(3,7,18,0.7)", borderBottom: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(20px)" }}>
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors mr-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></Link>
          <AtomLogo size={28} />
          <span className="font-bold text-[16px] tracking-tight text-white">OmniProcure</span>
          <span className="hidden sm:block text-white/15 text-sm mx-1">|</span>
          <span className="hidden sm:block text-white/40 text-xs font-medium tracking-wide">Command Center</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)" }}>
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" /></span>
            <span className="text-xs text-emerald-400 font-semibold">Live: Operational</span>
          </div>
          {authLoading ? <Loader2 size={15} className="animate-spin text-white/40" /> : user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: "linear-gradient(135deg,#6366f1,#4f46e5)" }}>{userInitials}</div>
                <span className="text-xs text-white/60 font-medium max-w-[130px] truncate">{user.email}</span>
              </div>
              <button onClick={handleSignOut} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/10" style={{ border: "1px solid rgba(255,255,255,0.08)" }} title="Sign out"><LogOut size={13} className="text-white/40" /></button>
            </div>
          ) : (
            <button onClick={() => setShowAuthModal(true)} className="text-xs font-semibold text-white px-4 py-2 rounded-xl transition-all" style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}>Sign in</button>
          )}
          <button onClick={() => setSettingsOpen(true)} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white/5" style={{ border: "1px solid rgba(255,255,255,0.08)" }}><Settings size={15} className="text-white/40" /></button>
        </div>
      </nav>

      {/* Main */}
      <main className="relative z-10 pt-16 min-h-screen flex flex-col items-center px-4">
        {/* Hero */}
        <div className="mt-20 mb-14 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc" }}>
            <Zap size={11} />Powered by Tinyfish + Claude AI
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white mb-3">Autonomous Parts Sourcing</h1>
          <p className="text-white/50 text-sm max-w-md mx-auto leading-relaxed">Enter a Manufacturer Part Number. AI agents browse Mouser, DigiKey & LCSC live, compare pricing and stock in real-time.</p>
          {!user && !authLoading && (
            <p className="text-xs text-white/30 mt-3">Search is free. <button onClick={() => setShowAuthModal(true)} className="font-semibold underline underline-offset-2 text-indigo-400">Sign in</button> to generate Purchase Orders.</p>
          )}
        </div>

        {/* Search */}
        <div className="w-full max-w-2xl relative">
          <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-all"
            style={selectedPart
              ? { background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(99,102,241,0.5)", boxShadow: "0 0 30px rgba(99,102,241,0.15)" }
              : { background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.1)" }}>
            {selectedPart ? <Lock size={16} className="text-indigo-400 shrink-0" /> : <Search size={16} className="text-white/30 shrink-0" />}
            <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={handleKeyDown}
              disabled={!!selectedPart} placeholder="Enter Manufacturer Part Number (MPN)…"
              className="flex-1 bg-transparent text-white placeholder-white/25 text-sm outline-none font-mono disabled:cursor-not-allowed" autoComplete="off" />
            {selectedPart
              ? <button onClick={reset} className="text-white/30 hover:text-white/60 transition-colors"><X size={15} /></button>
              : query.trim() && <button onClick={() => runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN" })} className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all" style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}>Search</button>
            }
            {user && !selectedPart && (
              <button onClick={() => setHistoryOpen(h => !h)} className="ml-1 w-8 h-8 rounded-lg flex items-center justify-center transition-all shrink-0"
                style={historyOpen ? { background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)" } : { border: "1px solid rgba(255,255,255,0.08)" }} title="Search history">
                <History size={14} className={historyOpen ? "text-indigo-400" : "text-white/30"} />
              </button>
            )}
          </div>

          {/* History dropdown */}
          {user && historyOpen && !selectedPart && (
            <div ref={historyRef} className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-30 animate-fade-in"
              style={{ background: "rgba(10,8,30,0.97)", border: "1px solid rgba(99,102,241,0.2)", backdropFilter: "blur(20px)" }}>
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-2"><History size={13} className="text-indigo-400" /><span className="text-xs font-bold text-white/70">Recent Searches</span><span className="text-xs text-white/25">({searchHistory.length})</span></div>
                {searchHistory.length > 0 && <button onClick={clearHistory} className="flex items-center gap-1 text-xs text-red-400/70 hover:text-red-400 transition-colors font-medium"><Trash2 size={11} />Clear all</button>}
              </div>
              {searchHistory.length === 0 ? <div className="px-4 py-6 text-center text-xs text-white/25">No searches yet</div> : (
                <div className="max-h-72 overflow-y-auto">
                  {searchHistory.map(item => (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 group transition-colors" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <button className="flex items-center gap-3 flex-1 text-left" onClick={() => { setHistoryOpen(false); runSequence({ part: item.part_number, desc: "From history" }); }}>
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.2)" }}><RotateCcw size={12} className="text-indigo-400" /></div>
                        <div><div className="text-sm font-mono font-semibold text-white/80">{item.part_number}</div><div className="text-xs text-white/30">{new Date(item.searched_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div>
                      </button>
                      <button onClick={() => deleteHistoryItem(item.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-white/20 hover:text-red-400"><X size={13} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Suggestions dropdown */}
          {query.trim() && !selectedPart && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden shadow-2xl z-30"
              style={{ background: "rgba(10,8,30,0.97)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(20px)" }}>
              {suggestions.map((item, i) => (
                <button key={i} onClick={() => runSequence(item)} className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.04)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.2)" }}><Package size={13} className="text-indigo-400" /></div>
                  <div><div className="text-sm font-mono font-semibold text-white/80">{item.part}</div><div className="text-xs text-white/30">{item.desc}</div></div>
                  <ChevronRight size={14} className="text-white/20 ml-auto" />
                </button>
              ))}
              <button onClick={() => runSequence({ part: query.trim().toUpperCase(), desc: "Custom MPN search" })} className="w-full flex items-center gap-3 px-4 py-3 transition-colors text-left" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.08)")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}><Search size={13} className="text-white" /></div>
                <div><div className="text-sm font-mono font-semibold text-indigo-400">Search &quot;{query.trim().toUpperCase()}&quot;</div><div className="text-xs text-white/30">Live search across Mouser, DigiKey &amp; LCSC</div></div>
                <ChevronRight size={14} className="text-indigo-400/50 ml-auto" />
              </button>
            </div>
          )}
        </div>

        {/* Loading status bar */}
        {phase === "loading" && (
          <div className="w-full max-w-2xl mt-6 animate-fade-in">
            <div className="rounded-2xl p-6" style={glass}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}>
                  <Loader2 size={15} className="text-white animate-spin" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-white/80">Agent sourcing in progress</div>
                  <div className="text-xs text-white/35">Cards appear as each supplier responds</div>
                </div>
                <div className="ml-auto flex gap-1">{[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "#818cf8", animationDelay: `${i*0.15}s` }} />)}</div>
              </div>
              <div className="rounded-xl px-4 py-3 mb-3" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-indigo-400" />
                  <span className="text-xs font-mono font-medium text-indigo-300">{currentStatus}</span>
                </div>
              </div>
              {statusLines.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {statusLines.slice(-3).map((line, i) => <div key={i} className="flex items-center gap-2"><CheckCircle size={12} className="text-emerald-400 shrink-0" /><span className="text-xs text-white/30 font-mono">{line}</span></div>)}
                </div>
              )}
              {/* Supplier status pills */}
              <div className="flex gap-2 flex-wrap">
                {["Mouser Electronics", "DigiKey", "LCSC"].map(name => {
                  const found = streamedSuppliers.find(s => s.name === name);
                  const notFoundS = notFoundSuppliers.includes(name);
                  return (
                    <div key={name} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={found ? { background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", color: "#34d399" }
                        : notFoundS ? { background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#f87171" }
                        : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.3)" }}>
                      {found ? <CheckCircle size={10} /> : notFoundS ? <X size={10} /> : <Loader2 size={10} className="animate-spin" />}
                      {name}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 h-px rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full animate-progress" style={{ background: "linear-gradient(90deg,#6366f1,#818cf8,#60a5fa)" }} />
              </div>
            </div>
          </div>
        )}

        {/* Results — show as they stream in */}
        {(phase === "results" || (phase === "loading" && streamedSuppliers.length > 0)) && !notFound && (
          <div className="w-full max-w-3xl mt-6 space-y-4">
            {/* Recommendation banner — only when complete */}
            {recommendation && (
              <div className="rounded-2xl px-5 py-4 flex items-start gap-3 animate-fade-in" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)" }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}><Star size={14} className="text-white" /></div>
                <div>
                  <div className="font-semibold text-sm mb-0.5 text-white/90">Claude AI Recommendation</div>
                  <div className="text-sm text-white/50">{recommendation.reason}</div>
                </div>
                <div className="text-xs font-mono shrink-0 text-indigo-400">{partNumber}</div>
              </div>
            )}

            {/* Supplier cards — appear immediately, fill in when data arrives */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {searchingSuppliers.map((name) => {
                const found = streamedSuppliers.find(s => s.name === name);
                const notFoundS = notFoundSuppliers.includes(name);
                if (found) return (
                  <SupplierCard key={name} supplier={found} partNumber={partNumber}
                    alternatives={alternatives.find(a => a.forSupplier === name)?.alternatives ?? []}
                    onSearchAlternative={mpn => { reset(); setTimeout(() => runSequence({ part: mpn, desc: "Alternative part" }), 100); }} />
                );
                return (
                  <div key={name} className="rounded-2xl p-5 animate-fade-in"
                    style={notFoundS
                      ? { background: "rgba(248,113,113,0.04)", border: "1px solid rgba(248,113,113,0.15)" }
                      : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(99,102,241,0.2)" }}>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <div className="font-bold text-white/80 text-base">{name}</div>
                        <div className="text-white/30 text-xs mt-0.5 font-mono">{partNumber}</div>
                      </div>
                      {notFoundS
                        ? <span className="text-xs text-red-400/70 font-medium px-2 py-1 rounded-full" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}>Not Found</span>
                        : <Loader2 size={16} className="text-indigo-400 animate-spin" />
                      }
                    </div>
                    {notFoundS ? (
                      <div className="text-xs text-white/30">This part is not listed on {name}</div>
                    ) : (
                      <div className="space-y-2.5">
                        <div className="rounded-lg px-3 py-2.5" style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-indigo-400" />
                            <span className="text-xs text-indigo-300/80 font-mono font-medium">Tinyfish agent running...</span>
                          </div>
                          {["Navigating supplier portal...", "Locating part number...", "Extracting live pricing..."].map((line, li) => (
                            <div key={li} className="flex items-center gap-2 mt-1">
                              <div className="w-1 h-1 rounded-full bg-white/15 shrink-0" />
                              <span className="text-xs text-white/25 font-mono">{line}</span>
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="h-3 w-12 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
                          <div className="h-7 w-20 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="h-3 w-16 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
                          <div className="h-5 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* PDF button — only when done */}
            {recommendation && (
              <>
                <button onClick={handlePDFClick} className="w-full flex items-center justify-center gap-2.5 active:scale-[0.99] text-white font-semibold py-3.5 rounded-xl transition-all hover:opacity-90 animate-fade-in"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)", boxShadow: "0 4px 20px rgba(99,102,241,0.3)" }}>
                  {user ? <Download size={16} /> : <Lock size={16} />}
                  {user ? "Generate Purchase Order (PDF)" : "Sign in to Generate Purchase Order"}
                </button>
                <button onClick={reset} className="w-full text-center text-sm text-white/25 hover:text-white/50 transition-colors py-1">Search a different part</button>
              </>
            )}
          </div>
        )}

        {/* Not found + aliases */}
        {notFound && (
          <div className="w-full max-w-2xl mt-6 space-y-4 animate-fade-in">
            <div className="rounded-2xl px-5 py-5 flex items-start gap-4" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)" }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)" }}><AlertCircle size={16} className="text-red-400" /></div>
              <div>
                <div className="text-white/80 font-semibold text-sm mb-1">Part Not Found</div>
                <div className="text-white/40 text-sm leading-relaxed">&quot;{partNumber}&quot; was not found on Mouser, DigiKey or LCSC. This may be a marketing name rather than a distributor MPN.</div>
                <button onClick={reset} className="mt-3 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors">Try another MPN →</button>
              </div>
            </div>

            {aliases.length > 0 && (
              <div className="rounded-2xl px-5 py-5" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.2)" }}><Search size={13} className="text-indigo-400" /></div>
                  <div>
                    <div className="text-sm font-bold text-white/80">Did you mean one of these?</div>
                    <div className="text-xs text-white/30">Claude identified these distributor SKUs for your search</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {aliases.map((alias, i) => (
                    <button key={i} onClick={() => { reset(); setTimeout(() => runSequence({ part: alias.mpn, desc: alias.description }), 100); }}
                      className="w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group hover:scale-[1.01]"
                      style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)" }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: "linear-gradient(135deg,#4f46e5,#6366f1)" }}><Package size={16} className="text-white" /></div>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono font-bold text-sm text-white/90">{alias.mpn}</div>
                        <div className="text-xs text-white/40 mt-0.5 truncate">{alias.description}</div>
                      </div>
                      <ChevronRight size={16} className="text-indigo-400/50 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Idle */}
        {phase === "idle" && (
          <div className="mt-16 w-full max-w-2xl space-y-10 animate-fade-in">
            <div className="grid grid-cols-3 gap-4">
              {[
                { icon: Zap, label: "Autonomous Agents", sub: "Tinyfish agents browse Mouser, DigiKey & LCSC — cards appear as each responds" },
                { icon: Star, label: "Claude AI Analysis", sub: "Claude compares price, stock & lead times and picks the winner" },
                { icon: Download, label: "Instant PO Generation", sub: "One-click professional PDF purchase orders, ready to send" },
              ].map(({ icon: Icon, label, sub }, i) => (
                <div key={i} className="rounded-2xl p-6 text-center transition-all cursor-default hover:scale-[1.02]" style={glass}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.2)" }}><Icon size={20} className="text-indigo-400" /></div>
                  <div className="text-sm font-bold mb-2 text-white/80">{label}</div>
                  <div className="text-xs leading-relaxed text-white/35">{sub}</div>
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-3">Try these parts</p>
              <div className="flex flex-wrap gap-2">
                {FALLBACK_CATALOG.map((item, i) => (
                  <button key={i} onClick={() => runSequence(item)} className="text-white/50 text-xs font-mono font-medium px-3 py-1.5 rounded-lg transition-all hover:text-white/80"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
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

      {/* Settings */}
      {settingsOpen && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={() => setSettingsOpen(false)} />
          <div className="fixed top-0 right-0 h-full w-80 z-50 flex flex-col shadow-2xl" style={{ background: "rgba(8,5,25,0.98)", borderLeft: "1px solid rgba(99,102,241,0.15)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-2"><Settings size={15} className="text-indigo-400" /><span className="font-bold text-sm text-white/80">Enterprise Settings</span></div>
              <button onClick={() => setSettingsOpen(false)} className="text-white/30 hover:text-white/60 transition-colors"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <p className="text-xs font-semibold text-white/25 uppercase tracking-wider mb-4">Integrations</p>
              {SETTINGS_TOGGLES.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-3.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}><t.icon size={13} className="text-white/40" /></div>
                    <div><div className="text-sm font-semibold text-white/70">{t.label}</div><div className="text-xs text-white/30">{t.sub}</div></div>
                  </div>
                  <Toggle enabled={t.enabled} />
                </div>
              ))}
            </div>
            <div className="px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="text-xs text-white/20 text-center">OmniProcure Enterprise v1.0.0</p>
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