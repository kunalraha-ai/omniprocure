"use client";

import { Button } from "@/components/ui/button"
import RotatingText from "@/components/RotatingText";
import Aurora from "@/components/Aurora";
import Link from "next/link";

const ArrowRight = () => (
  <svg
    className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
)

export function HeroSection() {
  return (
    <section className="min-h-screen flex items-center justify-center px-4 py-20 relative overflow-hidden">

      {/* ── Aurora background ── */}
      <div className="absolute inset-0 z-0">
        <Aurora
          colorStops={["#1e1b4b", "#3730a3", "#0f172a"]}
          amplitude={1.2}
          blend={0.6}
          speed={0.8}
        />
      </div>

      {/* ── Dark base so text is always readable ── */}
      <div className="absolute inset-0 z-0 bg-slate-950/60" />

      <div className="max-w-4xl mx-auto text-center relative z-10 animate-fade-in-hero">

        {/* Badge */}
        <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium mb-8 mt-12 animate-fade-in-badge">
          <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>
          Powered by Tinyfish + Claude AI
        </div>

        {/* Main Heading */}
        <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold text-balance mb-6 animate-fade-in-heading">
          <span className="text-white">Automate Your</span>
          <br />
          <span className="inline-flex items-center justify-center flex-wrap gap-2 mt-4 sm:mt-6 md:mt-8">
            <span className="text-white">Hardware</span>
            <RotatingText
              texts={["Procurement", "Sourcing", "Purchasing", "Quoting", "Ordering"]}
              mainClassName="px-2 sm:px-2 md:px-3 bg-white text-black overflow-hidden py-1 sm:py-1 md:py-2 justify-center rounded-lg shadow-lg"
              staggerFrom={"last"}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "-120%" }}
              staggerDuration={0.025}
              splitLevelClassName="overflow-hidden pb-1 sm:pb-1 md:pb-1"
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              rotationInterval={2000}
            />
          </span>
        </h1>

        {/* Subheading */}
        <p className="text-base sm:text-xl md:text-2xl text-white/70 text-balance max-w-sm sm:max-w-3xl mx-auto mb-8 sm:mb-12 leading-relaxed px-4 sm:px-0 animate-fade-in-subheading font-light">
          Enter any Manufacturer Part Number and our AI agents instantly browse Mouser, DigiKey & LCSC live — Claude picks the best supplier and generates your Purchase Order in one click.
        </p>

        {/* CTA — single button linking to /dashboard */}
        <div className="flex items-center justify-center mb-8 sm:mb-16 animate-fade-in-buttons">
          <Link href="/dashboard">
            <Button
              size="lg"
              className="bg-white text-black rounded-full px-10 py-4 text-lg font-semibold transition-all duration-300 hover:bg-gray-100 hover:scale-105 hover:shadow-xl group cursor-pointer"
            >
              Start Sourcing
              <ArrowRight />
            </Button>
          </Link>
        </div>

        {/* Trust bar */}
        <div className="text-center px-4 hidden sm:block overflow-hidden animate-fade-in-trust">
          <p className="text-sm text-white/40 mb-6 uppercase tracking-widest font-medium">Live data from</p>
          <div className="relative overflow-hidden w-full max-w-4xl mx-auto">
            <div className="flex items-center gap-12 opacity-50 hover:opacity-70 transition-all duration-500 animate-slide-left">
              <div className="flex items-center gap-12 whitespace-nowrap">
                {["Mouser Electronics", "DigiKey", "LCSC", "Tinyfish AI", "Claude AI", "Supabase"].map((name) => (
                  <div key={name} className="text-base sm:text-lg font-semibold text-white">{name}</div>
                ))}
              </div>
              {/* Duplicate for seamless loop */}
              <div className="flex items-center gap-12 whitespace-nowrap">
                {["Mouser Electronics", "DigiKey", "LCSC", "Tinyfish AI", "Claude AI", "Supabase"].map((name) => (
                  <div key={name + "-dup"} className="text-base sm:text-lg font-semibold text-white">{name}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile trust bar */}
        <div className="text-center px-4 mb-8 sm:hidden overflow-hidden animate-fade-in-trust">
          <p className="text-sm text-white/40 mb-4 uppercase tracking-widest font-medium">Live data from</p>
          <div className="relative overflow-hidden w-full max-w-sm mx-auto">
            <div className="absolute left-0 top-0 w-8 h-full bg-gradient-to-r from-slate-950 to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 w-8 h-full bg-gradient-to-l from-slate-950 to-transparent z-10 pointer-events-none" />
            <div className="flex items-center gap-6 opacity-50 animate-slide-left-mobile">
              <div className="flex items-center gap-6 whitespace-nowrap">
                {["Mouser", "DigiKey", "LCSC", "Tinyfish", "Claude AI"].map((name) => (
                  <div key={name} className="text-sm font-semibold text-white">{name}</div>
                ))}
              </div>
              <div className="flex items-center gap-6 whitespace-nowrap">
                {["Mouser", "DigiKey", "LCSC", "Tinyfish", "Claude AI"].map((name) => (
                  <div key={name + "-dup"} className="text-sm font-semibold text-white">{name}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}