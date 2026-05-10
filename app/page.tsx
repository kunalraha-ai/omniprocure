import Link from "next/link";

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col relative overflow-x-hidden" style={{ 
      background: "radial-gradient(circle at top left, rgba(125,211,252,0.05) 0%, #0a0e1a 50%), radial-gradient(circle at bottom right, rgba(200,160,240,0.05) 0%, #0a0e1a 50%), #0a0e1a",
      color: "#e0e8f0", 
      fontFamily: "'Inter', sans-serif" 
    }}>

      {/* Ambient Background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]" style={{ background: "rgba(125,211,252,0.12)" }} />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px]" style={{ background: "rgba(200,160,240,0.12)" }} />
      </div>

      {/* Nav */}
      <nav className="fixed top-0 w-full z-40 backdrop-blur-xl" style={{ background: "rgba(15,21,36,0.6)", borderBottom: "1px solid rgba(125,211,252,0.1)" }}>
        <div className="flex items-center justify-between px-6 h-16 max-w-7xl mx-auto w-full">
          <span className="text-xl font-semibold tracking-tight" style={{ color: "#e0e8f0" }}>OmniProcure</span>
          <Link href="/dashboard" className="px-5 py-2 rounded-xl text-sm font-medium transition-all" style={{ background: "rgba(125,211,252,0.1)", border: "1px solid rgba(125,211,252,0.3)", color: "#7dd3fc" }}>
            Sign in →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 relative z-10 flex flex-col items-center justify-center text-center px-6 pt-32 pb-24 max-w-4xl mx-auto w-full gap-24">
        <section className="flex flex-col items-center gap-8 w-full">
          <div className="rounded-3xl p-10 md:p-16 flex flex-col items-center gap-8 relative overflow-hidden w-full" style={{ background: "rgba(15,21,36,0.75)", backdropFilter: "blur(24px)", border: "1px solid rgba(125,211,252,0.15)", boxShadow: "0 0 30px rgba(125,211,252,0.05)" }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, rgba(125,211,252,0.05), transparent)" }} />

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium" style={{ border: "1px solid rgba(125,211,252,0.2)", background: "rgba(125,211,252,0.05)", color: "#7dd3fc" }}>
              ✦ Intelligence Activated
            </div>

            <h1 className="text-4xl md:text-6xl font-semibold tracking-tight leading-tight" style={{ color: "#e0e8f0" }}>
              AI-Native Procurement for{" "}
              <br />
              <span style={{ background: "linear-gradient(to right, #7dd3fc, #c8a0f0)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Electronic Components
              </span>
            </h1>

            <p className="text-lg md:text-xl max-w-2xl" style={{ color: "#a0b4c4" }}>
              Automate supply chain intelligence. Parse BOMs, compare suppliers, and monitor stock risks — all in one AI-powered platform.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2 w-full justify-center">
              <Link href="/dashboard" className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2" style={{ background: "rgba(125,211,252,0.15)", border: "1px solid rgba(125,211,252,0.4)", color: "#7dd3fc" }}>
                Get Started →
              </Link>
              <a href="mailto:yhwach149@gmail.com" className="w-full sm:w-auto px-8 py-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2" style={{ background: "rgba(15,21,36,0.6)", border: "1px solid rgba(125,211,252,0.1)", color: "#a0b4c4" }}>
                Contact Us
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
          {[
            { icon: "📄", title: "Real-time BOM Parsing", desc: "Upload a BOM and instantly source suppliers, compare pricing, and identify stock risks across 140+ distributors.", color: "#7dd3fc" },
            { icon: "📊", title: "Supply Chain Monitor", desc: "Continuous monitoring of your critical components with AI-generated alerts for price spikes and stock shortages.", color: "#c8a0f0" },
            { icon: "🤖", title: "AI Copilot", desc: "Ask OmniProcure AI anything — stock levels, alternates, risks, supplier recommendations — and get instant answers.", color: "#7dd3fc" },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl p-6 flex flex-col gap-4 text-left transition-all" style={{ background: "rgba(15,21,36,0.6)", backdropFilter: "blur(16px)", border: "1px solid rgba(125,211,252,0.1)" }}>
              <div className="text-3xl">{f.icon}</div>
              <h3 className="text-lg font-semibold" style={{ color: "#e0e8f0" }}>{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "#a0b4c4" }}>{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-6 relative z-10" style={{ borderTop: "1px solid rgba(125,211,252,0.08)" }}>
        <div className="flex flex-col md:flex-row justify-between items-center px-8 max-w-7xl mx-auto gap-4">
          <p className="text-xs" style={{ color: "#4a6070" }}>© 2025 OmniProcure. AI-Native Procurement.</p>
          <div className="flex items-center gap-6 text-xs" style={{ color: "#4a6070" }}>
            <a href="mailto:yhwach149@gmail.com" className="hover:text-primary transition-colors">Contact</a>
            <span>Privacy</span>
            <span>Terms</span>
          </div>
        </div>
      </footer>
    </div>
  );
}