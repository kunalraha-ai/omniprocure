"use client";
import "./glacier.css";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { label: "Overview",  href: "/dashboard",          icon: "dashboard" },
  { label: "Chat",      href: "/dashboard/chat",     icon: "smart_toy" },
  { label: "Monitor",   href: "/dashboard/monitor",  icon: "satellite_alt" },
  { label: "Alerts",    href: "/dashboard/alerts",   icon: "notifications_active" },
  { label: "Settings",  href: "/dashboard/settings", icon: "settings" },
];

// ── Steel Gray + Sky Blue design tokens ───────────────────────────────────────────
const C = {
  bg:           "#1c202a",
  sidebar:      "#232833",
  border:       "#2f3644",
  borderStrong: "#3e4759",
  green:        "#5ebcf8", // Sky blue
  greenSoft:    "rgba(94, 188, 248, 0.10)",
  greenBorder:  "rgba(94, 188, 248, 0.25)",
  text:         "#f1f5f9",
  muted:        "#94a3b8",
  mutedDim:     "#64748b",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        const res = await fetch("/api/request-po?pending=true");
        const data = await res.json();
        setPendingCount(data.count ?? 0);
      } catch {}
    };
    fetchPending();
    const iv = setInterval(fetchPending, 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div
      className="min-h-screen flex overflow-x-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif", backgroundColor: C.bg, color: C.text }}
    >
      {/* ── Ambient blobs ─────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="ambient-glow-primary"  style={{ top: "-6%",   right: "-4%"  }} />
        <div className="ambient-glow-tertiary" style={{ bottom: "-12%", left: "-6%" }} />
      </div>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-60 min-h-screen fixed left-0 top-0 z-20"
        style={{
          background: C.sidebar,
          borderRight: `1.5px solid ${C.border}`,
          boxShadow: "4px 0 20px rgba(0, 0, 0, 0.25)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: `1.5px solid ${C.border}` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-neu-raised-sm"
            style={{ background: C.bg, border: `1px solid ${C.border}` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 7v10l8 5 8-5V7z" stroke={C.green} strokeWidth="1.8" strokeLinejoin="round" fill="rgba(94, 188, 248, 0.15)" />
              <circle cx="12" cy="12" r="2.5" fill={C.green} />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif", color: C.text }}>
              OmniProcure
            </div>
            <div className="text-xs" style={{ color: C.green }}>AI Sourcing</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 py-5 flex-1">
          {NAV_ITEMS.map(item => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
                style={{
                  background: active ? C.greenSoft : "transparent",
                  borderLeft: active ? `2px solid ${C.green}` : "2px solid transparent",
                  color: active ? C.green : C.muted,
                  fontWeight: active ? 700 : 500,
                  boxShadow: active ? "inset 2px 2px 5px rgba(0, 0, 0, 0.15)" : "none",
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(94, 188, 248, 0.05)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "19px",
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                    color: active ? C.green : C.mutedDim,
                  }}
                >
                  {item.icon}
                </span>
                <span className="text-sm">{item.label}</span>
                {item.label === "Alerts" && pendingCount > 0 && (
                  <span
                    className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(239, 68, 68, 0.12)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.3)" }}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className="px-5 py-4" style={{ borderTop: `1.5px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: C.green, boxShadow: `0 0 8px ${C.green}` }}
            />
            <span className="text-xs font-semibold" style={{ color: C.muted }}>All systems active</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:ml-60 min-h-screen relative z-10">

        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-6 py-3"
          style={{
            background: "rgba(35, 40, 51, 0.85)",
            backdropFilter: "blur(16px)",
            borderBottom: `1.5px solid ${C.border}`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="md:hidden text-base font-extrabold" style={{ fontFamily: "'Syne', sans-serif", color: C.green }}>
              OmniProcure
            </span>
            <div className="hidden md:flex items-center gap-2 text-sm" style={{ color: C.muted }}>
              <span style={{ color: C.mutedDim, fontSize: 12 }}>Workspace</span>
              <span style={{ color: C.mutedDim }}>›</span>
              <span style={{ color: C.green, fontWeight: 700 }}>
                {NAV_ITEMS.find(i => i.href !== "/dashboard" && pathname.startsWith(i.href))?.label ?? "Overview"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div
              className="hidden md:flex items-center gap-2 rounded-full px-4 py-2 w-56 shadow-neu-sunken-sm"
              style={{ background: C.bg, border: `1px solid ${C.border}` }}
            >
              <span className="material-symbols-outlined" style={{ color: C.mutedDim, fontSize: "18px" }}>search</span>
              <input
                className="bg-transparent text-sm outline-none w-full placeholder:text-[#64748b]"
                placeholder="Search telemetry…"
                style={{ color: C.text }}
              />
            </div>

            {/* Notifications bell */}
            <button
              className="relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shadow-neu-raised-sm"
              style={{ background: C.sidebar, border: `1.5px solid ${C.border}` }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.bg; (e.currentTarget as HTMLElement).style.color = C.green; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.sidebar; (e.currentTarget as HTMLElement).style.color = C.text; }}
            >
              <span className="material-symbols-outlined" style={{ color: C.muted, fontSize: "20px" }}>
                notifications
              </span>
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444", boxShadow: "0 0 6px #ef4444" }} />
              )}
            </button>

            {/* Avatar */}
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center shadow-neu-raised-sm"
              style={{ background: C.sidebar, border: `1.5px solid ${C.border}` }}
            >
              <span className="material-symbols-outlined" style={{ color: C.green, fontSize: "18px" }}>person</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
