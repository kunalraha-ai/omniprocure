"use client"

import { useEffect, useRef, useState } from "react"

// ── Atom Logo ──────────────────────────────────────────────────────────────────
function AtomLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="url(#fs1)" strokeWidth="4" fill="none"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="url(#fs2)" strokeWidth="4" fill="none" transform="rotate(60 50 50)"/>
      <ellipse cx="50" cy="50" rx="45" ry="18" stroke="url(#fs3)" strokeWidth="4" fill="none" transform="rotate(120 50 50)"/>
      <circle cx="50" cy="50" r="9" fill="url(#fsC)"/>
      <defs>
        <linearGradient id="fs1" x1="5" y1="50" x2="95" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#818cf8"/><stop offset="1" stopColor="#60a5fa"/></linearGradient>
        <linearGradient id="fs2" x1="5" y1="50" x2="95" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#6366f1"/><stop offset="1" stopColor="#38bdf8"/></linearGradient>
        <linearGradient id="fs3" x1="5" y1="50" x2="95" y2="50" gradientUnits="userSpaceOnUse"><stop stopColor="#a78bfa"/><stop offset="1" stopColor="#60a5fa"/></linearGradient>
        <radialGradient id="fsC" cx="50%" cy="50%" r="50%"><stop stopColor="#60a5fa"/><stop offset="1" stopColor="#6366f1"/></radialGradient>
      </defs>
    </svg>
  )
}

// ── Demo 1: Live Agent Scraping (Mouser / DigiKey / LCSC) ─────────────────────
const AgentScrapingDemo = ({ isActive }: { isActive: boolean }) => {
  const suppliers = ["Mouser", "DigiKey", "LCSC"]
  const [activeSupplier, setActiveSupplier] = useState(0)
  const [progress, setProgress] = useState([0, 0, 0])
  const [done, setDone] = useState([false, false, false])

  useEffect(() => {
    if (!isActive) return
    setProgress([0, 0, 0])
    setDone([false, false, false])
    setActiveSupplier(0)

    suppliers.forEach((_, idx) => {
      const delay = idx * 1200
      setTimeout(() => {
        setActiveSupplier(idx)
        const interval = setInterval(() => {
          setProgress(prev => {
            const next = [...prev]
            next[idx] = Math.min(next[idx] + 8, 100)
            return next
          })
        }, 60)
        setTimeout(() => {
          clearInterval(interval)
          setProgress(prev => { const n = [...prev]; n[idx] = 100; return n })
          setDone(prev => { const n = [...prev]; n[idx] = true; return n })
        }, 900)
      }, delay)
    })
  }, [isActive])

  return (
    <div className="bg-slate-50 rounded-xl p-4 h-36 flex flex-col justify-center gap-2.5">
      {suppliers.map((name, i) => (
        <div key={name} className="flex items-center gap-3">
          <span className="text-xs font-mono font-semibold text-slate-600 w-14">{name}</span>
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-100"
              style={{
                width: `${progress[i]}%`,
                background: done[i] ? "#22c55e" : "linear-gradient(90deg,#6366f1,#60a5fa)"
              }}
            />
          </div>
          <span className="text-xs w-6 text-right">
            {done[i] ? "✓" : progress[i] > 0 ? `${progress[i]}%` : "—"}
          </span>
        </div>
      ))}
      <div className="text-[10px] text-slate-400 mt-1 text-center">
        {done.every(Boolean) ? "✓ All suppliers scraped" : `Browsing ${suppliers[activeSupplier]} live...`}
      </div>
    </div>
  )
}

// ── Demo 2: Side-by-Side Price Comparison ─────────────────────────────────────
const PriceComparisonDemo = ({ isActive }: { isActive: boolean }) => {
  const [visible, setVisible] = useState(false)
  const [highlight, setHighlight] = useState<number | null>(null)

  const rows = [
    { supplier: "Mouser", price: "$0.847", stock: "12,400", lead: "2 days", best: false },
    { supplier: "DigiKey", price: "$0.791", stock: "8,200",  lead: "3 days", best: true  },
    { supplier: "LCSC",   price: "$0.923", stock: "45,000", lead: "5 days", best: false },
  ]

  useEffect(() => {
    if (!isActive) return
    setVisible(false)
    setHighlight(null)
    const t1 = setTimeout(() => setVisible(true), 400)
    const t2 = setTimeout(() => setHighlight(1), 1200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [isActive])

  return (
    <div className="bg-slate-50 rounded-xl p-3 h-36 overflow-hidden">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-1">
        MPN: STM32F103C8T6
      </div>
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div
            key={row.supplier}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs transition-all duration-500 ${
              visible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
            } ${highlight === i ? "bg-blue-50 border border-blue-200" : "bg-white border border-slate-100"}`}
            style={{ transitionDelay: `${i * 150}ms` }}
          >
            <span className="font-semibold text-slate-700 w-12">{row.supplier}</span>
            <span className="font-bold text-slate-900 w-14">{row.price}</span>
            <span className="text-slate-400 flex-1">{row.stock} units</span>
            <span className="text-slate-400">{row.lead}</span>
            {row.best && highlight === i && (
              <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Best</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Demo 3: Claude AI Recommendation ─────────────────────────────────────────
const ClaudeRecommendationDemo = ({ isActive }: { isActive: boolean }) => {
  const [step, setStep] = useState(0)
  const lines = [
    "Analyzing 3 supplier quotes...",
    "Comparing price per unit...",
    "Checking stock availability...",
    "Factoring in lead times...",
  ]

  useEffect(() => {
    if (!isActive) return
    setStep(0)
    lines.forEach((_, i) => {
      setTimeout(() => setStep(i + 1), 600 + i * 700)
    })
  }, [isActive])

  return (
    <div className="bg-slate-50 rounded-xl p-4 h-36 overflow-hidden">
      <div className="flex items-center gap-2 mb-3">
        <AtomLogo size={16} />
        <span className="text-xs font-bold text-slate-700">Claude AI is analyzing...</span>
      </div>
      <div className="space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className={`flex items-center gap-2 transition-all duration-400 ${step > i ? "opacity-100" : "opacity-0"}`}>
            <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
            </svg>
            <span className="text-xs text-slate-600">{line}</span>
          </div>
        ))}
      </div>
      {step >= lines.length && (
        <div className="mt-2 text-xs font-bold px-2 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-700">
          ★ DigiKey recommended — best price & stock
        </div>
      )}
    </div>
  )
}

// ── Demo 4: Purchase Order Generation ─────────────────────────────────────────
const POGenerationDemo = ({ isActive }: { isActive: boolean }) => {
  const [stage, setStage] = useState<"idle" | "building" | "done">("idle")
  const [fields, setFields] = useState([false, false, false, false])

  useEffect(() => {
    if (!isActive) return
    setStage("idle")
    setFields([false, false, false, false])

    const t1 = setTimeout(() => setStage("building"), 500)
    const t2 = setTimeout(() => setFields([true, false, false, false]), 800)
    const t3 = setTimeout(() => setFields([true, true, false, false]), 1200)
    const t4 = setTimeout(() => setFields([true, true, true, false]), 1600)
    const t5 = setTimeout(() => setFields([true, true, true, true]), 2000)
    const t6 = setTimeout(() => setStage("done"), 2400)

    return () => [t1,t2,t3,t4,t5,t6].forEach(clearTimeout)
  }, [isActive])

  const rows = ["Supplier: DigiKey", "Part: STM32F103C8T6", "Qty: 100 units", "Total: $94.69 + GST"]

  return (
    <div className="bg-slate-50 rounded-xl p-4 h-36 flex flex-col justify-between overflow-hidden">
      <div className="space-y-1.5">
        {rows.map((row, i) => (
          <div key={i} className={`text-xs px-2 py-1 rounded transition-all duration-400 ${
            fields[i] ? "bg-white border border-slate-200 text-slate-700" : "bg-slate-100 text-transparent"
          }`}>
            {fields[i] ? row : "████████████"}
          </div>
        ))}
      </div>
      <div className={`flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs font-bold transition-all duration-500 ${
        stage === "done"
          ? "bg-emerald-500 text-white"
          : stage === "building"
          ? "bg-blue-100 text-blue-600"
          : "bg-slate-200 text-slate-400"
      }`}>
        {stage === "done" ? "✓ PDF Purchase Order Ready" : stage === "building" ? "Building PO..." : "Waiting..."}
      </div>
    </div>
  )
}

// ── Demo 5: Search History & Audit Trail ──────────────────────────────────────
const HistoryDemo = ({ isActive }: { isActive: boolean }) => {
  const entries = [
    { part: "STM32F103C8T6", time: "2 mins ago", saved: "$12.40" },
    { part: "NRF52840-QIAA-R", time: "1 hr ago", saved: "$8.72" },
    { part: "TPS63020DSJR", time: "3 hrs ago", saved: "$21.30" },
  ]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!isActive) return
    setVisible(false)
    const t = setTimeout(() => setVisible(true), 400)
    return () => clearTimeout(t)
  }, [isActive])

  return (
    <div className="bg-slate-50 rounded-xl p-4 h-36 overflow-hidden">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Recent Searches</div>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <div key={i} className={`flex items-center gap-2 transition-all duration-500 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"}`}
            style={{ transitionDelay: `${i * 150}ms` }}>
            <svg className="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span className="text-xs font-mono font-semibold text-slate-700 flex-1">{e.part}</span>
            <span className="text-[10px] text-emerald-600 font-bold">{e.saved} saved</span>
            <span className="text-[10px] text-slate-400">{e.time}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Demo 6: ERP / Slack Integrations ─────────────────────────────────────────
const IntegrationsDemo = ({ isActive }: { isActive: boolean }) => {
  const integrations = [
    { name: "NetSuite ERP", icon: "🏢", connected: false },
    { name: "SAP S/4HANA", icon: "⚙️", connected: false },
    { name: "Slack Alerts", icon: "💬", connected: false },
    { name: "SOC 2 Logs", icon: "🔒", connected: false },
  ]
  const [states, setStates] = useState(integrations.map(i => i.connected))

  useEffect(() => {
    if (!isActive) return
    setStates([false, false, false, false])
    integrations.forEach((_, i) => {
      setTimeout(() => {
        setStates(prev => { const n = [...prev]; n[i] = true; return n })
      }, 500 + i * 400)
    })
  }, [isActive])

  return (
    <div className="bg-slate-50 rounded-xl p-4 h-36">
      <div className="grid grid-cols-2 gap-2">
        {integrations.map((item, i) => (
          <div key={i} className={`flex items-center gap-2 p-2 rounded-lg text-xs transition-all duration-500 ${
            states[i] ? "bg-emerald-50 border border-emerald-100" : "bg-white border border-slate-200"
          }`}>
            <span>{item.icon}</span>
            <span className="text-slate-700 font-medium text-[11px]">{item.name}</span>
            <div className={`ml-auto w-2 h-2 rounded-full transition-colors duration-500 ${states[i] ? "bg-emerald-500" : "bg-slate-300"}`} />
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[10px] text-slate-400">
        {states.filter(Boolean).length}/4 connected
      </div>
    </div>
  )
}

// ── Feature definitions ────────────────────────────────────────────────────────
const features = [
  {
    title: "Live Supplier Scraping",
    description: "Tinyfish agents autonomously browse Mouser, DigiKey & LCSC in real-time — bypassing bot protections to fetch live pricing and stock the moment you search.",
    demo: AgentScrapingDemo,
    size: "large",
  },
  {
    title: "Side-by-Side Price Comparison",
    description: "All supplier results are normalized and displayed as clean comparison cards — price per unit, stock levels, and lead times at a glance.",
    demo: PriceComparisonDemo,
    size: "medium",
  },
  {
    title: "Claude AI Recommendation",
    description: "Claude analyzes every quote and picks the optimal supplier based on price, availability, and lead time — with a plain-English reason why.",
    demo: ClaudeRecommendationDemo,
    size: "medium",
  },
  {
    title: "Instant PO Generation",
    description: "One click generates a professional PDF Purchase Order pre-filled with the winning supplier, part details, GST calculation, and your company info.",
    demo: POGenerationDemo,
    size: "large",
  },
  {
    title: "Search History & Audit Trail",
    description: "Every MPN search is saved to your account. Revisit past queries instantly and track cost savings over time.",
    demo: HistoryDemo,
    size: "medium",
  },
  {
    title: "Enterprise Integrations",
    description: "Connect OmniProcure to your ERP (NetSuite, SAP), Slack procurement channel, and SOC 2 audit logging for a fully automated procurement workflow.",
    demo: IntegrationsDemo,
    size: "medium",
  },
]

// ── Main section ───────────────────────────────────────────────────────────────
export function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [isVisible, setIsVisible] = useState(false)
  const [activeDemo, setActiveDemo] = useState<number | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { threshold: 0.1, rootMargin: "0px 0px -100px 0px" },
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => { if (sectionRef.current) observer.unobserve(sectionRef.current) }
  }, [])

  return (
    <section id="features" ref={sectionRef} className="relative z-10">
      <div className="bg-white rounded-t-[3rem] pt-16 sm:pt-24 pb-16 sm:pb-24 px-4 relative overflow-hidden">

        {/* Dot grid background */}
        <div className="absolute inset-0 opacity-[0.025]">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgb(0,0,0) 1px, transparent 0)`,
            backgroundSize: "24px 24px",
          }} />
        </div>

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="absolute w-1 h-1 bg-indigo-200 rounded-full animate-float"
              style={{ left: `${20 + i * 15}%`, top: `${30 + (i % 3) * 20}%`, animationDelay: `${i * 0.5}s`, animationDuration: `${4 + i * 0.5}s` }} />
          ))}
        </div>

        <div className="max-w-7xl mx-auto relative">

          {/* Section header */}
          <div className={`text-center mb-12 sm:mb-20 transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-sm font-medium mb-6">
              <AtomLogo size={18} />
              Autonomous Procurement — Powered by Tinyfish + Claude AI
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-900 text-balance mb-4 sm:mb-6">
              Your AI Sourcing Agent{" "}
              <span className="bg-gradient-to-r from-indigo-500 to-blue-400 bg-clip-text text-transparent">
                Never Stops
              </span>
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-slate-500 max-w-3xl mx-auto font-light leading-relaxed">
              From MPN search to signed Purchase Order — OmniProcure handles the entire sourcing workflow autonomously, so your team can focus on building.
            </p>
          </div>

          {/* Feature cards grid */}
          <div className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 transition-all duration-1000 delay-300 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}>
            {features.map((feature, index) => (
              <div
                key={index}
                className={`group transition-all duration-1000 ${feature.size === "large" ? "md:col-span-2" : ""}`}
                style={{ transitionDelay: isVisible ? `${300 + index * 100}ms` : "0ms" }}
                onMouseEnter={() => setActiveDemo(index)}
                onMouseLeave={() => setActiveDemo(null)}
              >
                <div className="bg-white rounded-2xl p-6 sm:p-8 h-full shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-slate-200 hover:border-indigo-100">
                  <div className="mb-6">
                    <feature.demo isActive={activeDemo === index || isVisible} />
                  </div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 mb-4 group-hover:text-indigo-600 transition-colors duration-300">
                    {feature.title}
                  </h3>
                  <p className="text-slate-500 text-sm sm:text-base leading-relaxed">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        .animate-float { animation: float 4s ease-in-out infinite; }
      `}</style>
    </section>
  )
}