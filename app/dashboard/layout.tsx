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

// ── Landing-page design tokens (light) ───────────────────────────────────────
const C = {
  bg:           "#dff0e8",
  sidebar:      "#ffffff",
  border:       "rgba(10,34,24,0.10)",
  borderStrong: "rgba(10,34,24,0.18)",
  green:        "#1b7a52",
  greenSoft:    "#e8f7ef",
  greenBorder:  "rgba(27,122,82,0.25)",
  text:         "#071a10",
  muted:        "#3e6b52",
  mutedDim:     "#7aaa8e",
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
      {/* ── Ambient blobs (matching landing page) ─────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="ambient-glow-primary"  style={{ top: "-6%",   right: "-4%"  }} />
        <div className="ambient-glow-tertiary" style={{ bottom: "-12%", left: "-6%" }} />
      </div>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-60 min-h-screen fixed left-0 top-0 z-20"
        style={{
          background: C.sidebar,
          borderRight: `1px solid ${C.border}`,
          boxShadow: "2px 0 16px rgba(10,34,24,0.05)",
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 7v10l8 5 8-5V7z" stroke="#1b7a52" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(27,122,82,0.15)" />
              <circle cx="12" cy="12" r="2.5" fill="#1b7a52" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif", color: C.text }}>
              OmniProcure
            </div>
            <div className="text-xs" style={{ color: C.mutedDim }}>AI Procurement</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 py-4 flex-1">
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
                  fontWeight: active ? 600 : 400,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(27,122,82,0.06)"; }}
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
                    className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "#fdecea", color: "#7a1a0a", border: "1px solid rgba(248,113,113,0.3)" }}
                  >
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Status footer */}
        <div className="px-5 py-4" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: C.green, boxShadow: `0 0 5px rgba(27,122,82,0.4)` }}
            />
            <span className="text-xs" style={{ color: C.mutedDim }}>All systems operational</span>
          </div>
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:ml-60 min-h-screen relative z-10">

        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-6 py-3"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(12px)",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div className="flex items-center gap-3">
            <span className="md:hidden text-base font-bold" style={{ fontFamily: "'Syne', sans-serif", color: C.text }}>
              OmniProcure
            </span>
            <div className="hidden md:flex items-center gap-2 text-sm" style={{ color: C.muted }}>
              <span style={{ color: C.mutedDim, fontSize: 12 }}>Dashboard</span>
              <span style={{ color: C.mutedDim }}>›</span>
              <span style={{ color: C.text, fontWeight: 500 }}>
                {NAV_ITEMS.find(i => i.href !== "/dashboard" && pathname.startsWith(i.href))?.label ?? "Overview"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search */}
            <div
              className="hidden md:flex items-center gap-2 rounded-full px-4 py-2 w-52"
              style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}
            >
              <span className="material-symbols-outlined" style={{ color: C.mutedDim, fontSize: "17px" }}>search</span>
              <input
                className="bg-transparent text-sm outline-none w-full placeholder:text-[#7aaa8e]"
                placeholder="Search…"
                style={{ color: C.text }}
              />
            </div>

            {/* Notifications bell */}
            <button
              className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(27,122,82,0.18)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = C.greenSoft}
            >
              <span className="material-symbols-outlined" style={{ color: C.muted, fontSize: "20px" }}>
                notifications
              </span>
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "#ef4444" }} />
              )}
            </button>

            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: C.greenSoft, border: `1px solid ${C.greenBorder}` }}
            >
              <span className="material-symbols-outlined" style={{ color: C.muted, fontSize: "17px" }}>person</span>
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
