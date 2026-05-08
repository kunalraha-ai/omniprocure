"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const navItems = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "BOM Upload", href: "/dashboard/bom" },
  { label: "Monitor", href: "/dashboard/monitor" },
  { label: "Orders", href: "/dashboard/orders" },
  { label: "Alerts", href: "/dashboard/alerts" },
  { label: "Settings", href: "/dashboard/settings" },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [darkMode, setDarkMode] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("omniprocure-theme");
    const initial =
      savedTheme === "dark" ||
      (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(initial);
  }, []);

  useEffect(() => {
    const element = document.documentElement;
    element.classList.toggle("dark", darkMode);
    window.localStorage.setItem("omniprocure-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const handleLogout = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  return (
    <div className={darkMode ? "min-h-screen bg-slate-950 text-slate-100" : "min-h-screen bg-slate-50 text-slate-950"}>
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <aside className="flex w-full max-w-[280px] flex-col rounded-3xl border border-slate-200 bg-white px-4 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-10 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">OmniProcure</div>
              <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-50">Dashboard</div>
            </div>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    "block rounded-2xl px-4 py-3 text-sm font-medium transition " +
                    (isActive
                      ? "bg-slate-950 text-white shadow-sm dark:bg-slate-700"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">Theme</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Switch between light and dark UI.</p>
              </div>
              <button
                type="button"
                onClick={() => setDarkMode(!darkMode)}
                className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                {darkMode ? "Dark" : "Light"}
              </button>
            </div>
          </div>

          <div className="mt-auto pt-6">
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-700 dark:bg-red-950 dark:text-red-200 dark:hover:bg-red-900"
            >
              {signingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col rounded-3xl bg-white p-6 shadow-sm dark:bg-slate-950 dark:text-slate-100">
          {children}
        </main>
      </div>
    </div>
  );
}
