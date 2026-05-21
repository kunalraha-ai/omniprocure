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

// ── Accent colours matching the landing page ──────────────────────────────────
const C = {
  bg:          "#071a10",
  surface:     "rgba(7,26,16,0.55)",
  border:      "rgba(27,122,82,0.18)",
  borderHover: "rgba(27,122,82,0.35)",
  green:       "#1b7a52",
  greenSoft:   "rgba(27,122,82,0.15)",
  text:        "#dff0e8",
  muted:       "#7aaa8e",
  mutedDim:    "#3e6b52",
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
      {/* ── Ambient glows ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="ambient-glow-primary"  style={{ top: "-8%",   left: "-4%" }} />
        <div className="ambient-glow-tertiary" style={{ bottom: "-18%", right: "-8%" }} />
      </div>

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className="hidden md:flex flex-col w-60 min-h-screen fixed left-0 top-0 z-20"
        style={{
          background: "rgba(5,18,10,0.75)",
          backdropFilter: "blur(20px)",
          borderRight: `1px solid ${C.border}`,
        }}
      >
        {/* Logo */}
        <div
          className="flex items-center gap-3 px-5 py-5"
          style={{ borderBottom: `1px solid ${C.border}` }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: C.greenSoft, border: `1px solid rgba(27,122,82,0.35)` }}
          >
            {/* Simple leaf/hexagon mark using the landing page's green */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 7v10l8 5 8-5V7z" stroke="#1b7a52" strokeWidth="1.8" strokeLinejoin="round" fill="rgba(27,122,82,0.15)" />
              <circle cx="12" cy="12" r="2.5" fill="#1b7a52" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ fontFamily: "'Syne', sans-serif", color: C.text }}>
              OmniProcure
            </div>
            <div className="text-xs" style={{ color: C.muted }}>AI Procurement</div>
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
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150 group"
                style={{
                  background: active ? C.greenSoft : "transparent",
                  borderLeft: active ? `2px solid ${C.green}` : "2px solid transparent",
                  color: active ? "#dff0e8" : C.muted,
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(27,122,82,0.08)"; }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: "19px",
                    fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0",
                    color: active ? C.green : C.muted,
                  }}
                >
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.label === "Alerts" && pendingCount > 0 && (
                  <span
                    className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{
                      background: "rgba(239,68,68,0.15)",
                      color: "#f87171",
                      border: "1px solid rgba(239,68,68,0.25)",
                    }}
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
              style={{ background: C.green, animation: "pulse 2s infinite", boxShadow: `0 0 6px ${C.green}` }}
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
            background: "rgba(5,18,10,0.8)",
            backdropFilter: "blur(16px)",
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <span className="md:hidden text-base font-bold" style={{ fontFamily: "'Syne', sans-serif", color: C.text }}>
              OmniProcure
            </span>
            {/* Breadcrumb */}
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
              style={{ background: "rgba(7,26,16,0.5)", border: `1px solid ${C.border}` }}
            >
              <span className="material-symbols-outlined" style={{ color: C.mutedDim, fontSize: "17px" }}>search</span>
              <input
                className="bg-transparent text-sm outline-none w-full"
                placeholder="Search…"
                style={{ color: C.text }}
              />
            </div>

            {/* Notifications bell */}
            <button
              className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(7,26,16,0.6)", border: `1px solid ${C.border}` }}
            >
              <span className="material-symbols-outlined" style={{ color: C.muted, fontSize: "20px" }}>
                notifications
              </span>
              {pendingCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ background: "#ef4444" }}
                />
              )}
            </button>

            {/* Avatar */}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(7,26,16,0.8)", border: `1px solid rgba(27,122,82,0.3)` }}
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
