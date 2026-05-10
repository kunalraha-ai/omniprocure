"use client";
import "./glacier.css";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
  { label: "Overview",  href: "/dashboard",          icon: "dashboard" },
  { label: "Chat", href: "/dashboard/chat", icon: "smart_toy" },
  { label: "Monitor",   href: "/dashboard/monitor",  icon: "satellite_alt" },
  { label: "Orders",    href: "/dashboard/orders",   icon: "shopping_cart" },
  { label: "Alerts",    href: "/dashboard/alerts",   icon: "notifications_active" },
  { label: "Settings",  href: "/dashboard/settings", icon: "settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  // Poll HITL queue for pending count
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
    <div className="min-h-screen bg-background text-on-surface font-body flex overflow-x-hidden"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#0a0e1a", color: "#e0e8f0" }}>

      {/* Ambient background glows */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="ambient-glow-primary" style={{ top: "-10%", left: "-5%" }} />
        <div className="ambient-glow-tertiary" style={{ bottom: "-20%", right: "-10%" }} />
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen glass-panel z-20 fixed left-0 top-0"
        style={{ borderRight: "1px solid rgba(125,211,252,0.1)" }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b"
          style={{ borderColor: "rgba(125,211,252,0.1)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(125,211,252,0.15)", border: "1px solid rgba(125,211,252,0.3)" }}>
            <span className="material-symbols-outlined text-primary text-lg"
              style={{ fontVariationSettings: "'FILL' 1", color: "#7dd3fc" }}>hexagon</span>
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight" style={{ color: "#e0e8f0" }}>OmniProcure</div>
            <div className="text-xs" style={{ color: "#a0b4c4" }}>AI Procurement</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
          {NAV_ITEMS.map(item => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative"
                style={{
                  background: active ? "rgba(125,211,252,0.1)" : "transparent",
                  borderLeft: active ? "2px solid #7dd3fc" : "2px solid transparent",
                  color: active ? "#7dd3fc" : "#a0b4c4",
                }}>
                <span className="material-symbols-outlined text-lg transition-colors"
                  style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0", fontSize: "20px" }}>
                  {item.icon}
                </span>
                <span className="text-sm font-medium">{item.label}</span>
                {item.label === "Orders" && pendingCount > 0 && (
                  <span className="ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(200,160,240,0.2)", color: "#c8a0f0", border: "1px solid rgba(200,160,240,0.3)" }}>
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t" style={{ borderColor: "rgba(125,211,252,0.1)" }}>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: "#7dd3fc" }} />
            <span className="text-xs" style={{ color: "#a0b4c4" }}>All systems operational</span>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col md:ml-60 min-h-screen relative z-10">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-8 py-3 glass-panel"
          style={{ borderBottom: "1px solid rgba(125,211,252,0.1)" }}>
          <div className="flex items-center gap-3">
            {/* Mobile logo */}
            <span className="md:hidden text-base font-bold" style={{ color: "#e0e8f0" }}>OmniProcure</span>
            {/* Page breadcrumb */}
            <div className="hidden md:flex items-center gap-2 text-sm" style={{ color: "#a0b4c4" }}>
              {NAV_ITEMS.find(i => i.href !== "/dashboard" && pathname.startsWith(i.href))?.label ?? "Overview"}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Search */}
            <div className="glass-input hidden md:flex items-center gap-2 rounded-full px-4 py-2 w-52">
              <span className="material-symbols-outlined text-sm" style={{ color: "#a0b4c4", fontSize: "18px" }}>search</span>
              <input className="bg-transparent text-sm outline-none w-full placeholder:text-on-surface-variant"
                placeholder="Search..."
                style={{ color: "#e0e8f0" }} />
            </div>
            {/* Notifications */}
            <button className="relative w-9 h-9 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "rgba(15,21,36,0.6)", border: "1px solid rgba(125,211,252,0.1)" }}>
              <span className="material-symbols-outlined text-lg" style={{ color: "#a0b4c4", fontSize: "20px" }}>notifications</span>
              {pendingCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: "#ff6b6b" }} />
              )}
            </button>
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(26,36,56,0.8)", border: "1px solid rgba(125,211,252,0.2)" }}>
              <span className="material-symbols-outlined" style={{ color: "#a0b4c4", fontSize: "18px" }}>person</span>
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
