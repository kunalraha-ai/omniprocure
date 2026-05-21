import Link from "next/link";
import BomDemo from "@/components/BomDemo";

export default function Page() {
  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: "#dff0e8", minHeight: "100vh", position: "relative", overflowX: "hidden" }}>

      {/* Blob accents */}
      <div style={{ position: "fixed", width: 320, height: 320, borderRadius: "50%", background: "#f5e6d8", top: -80, right: -60, opacity: 0.9, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", width: 180, height: 180, borderRadius: "50%", background: "#f5e6d8", bottom: 200, left: -50, opacity: 0.65, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", width: 100, height: 100, borderRadius: "50%", background: "#c8e8d8", bottom: 80, right: 120, opacity: 0.5, pointerEvents: "none", zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 48px", position: "relative", zIndex: 10 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 19, color: "#071a10", letterSpacing: "-0.4px" }}>OmniProcure</span>
        <Link href="/dashboard" style={{ display: "inline-block", background: "transparent", color: "#071a10", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, padding: "9px 20px", borderRadius: 50, border: "2.5px solid #071a10", textDecoration: "none", lineHeight: 1 }}>
          Sign in
        </Link>
      </nav>

      {/* Hero */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32, padding: "48px 48px 0", alignItems: "center", position: "relative", zIndex: 5, maxWidth: 1100, margin: "0 auto" }}>

        {/* Left */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#0a5c35", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 18 }}>AI-Native Procurement</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 52, fontWeight: 800, lineHeight: 1.04, color: "#071a10", letterSpacing: "-2px", marginBottom: 20 }}>
            Cut procurement<br />
            time from{" "}
            <span style={{ color: "#1b7a52" }}>3 hours<br />to 3 minutes</span>
          </h1>
          <p style={{ fontSize: 15.5, color: "#1e3d2c", lineHeight: 1.72, maxWidth: 400, marginBottom: 36 }}>
            Parse BOMs, compare suppliers across 140+ distributors, and monitor stock risks in real time. One platform, zero spreadsheets.
          </p>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 40 }}>
            <Link href="/dashboard" style={{ display: "inline-block", background: "#071a10", color: "#dff0e8", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, padding: "13px 28px", borderRadius: 50, border: "2.5px solid #071a10", textDecoration: "none", lineHeight: 1 }}>
              Get Started
            </Link>
            <a href="mailto:yhwach149@gmail.com" style={{ display: "inline-block", background: "transparent", color: "#071a10", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, fontSize: 14, padding: "12px 24px", borderRadius: 50, border: "2.5px solid #071a10", textDecoration: "none", lineHeight: 1 }}>
              Contact Us
            </a>
          </div>
          <div style={{ display: "flex", gap: 28 }}>
            {[["140+", "Distributors integrated"], ["10+", "Beta users in production"], ["98%", "Stock risk coverage"]].map(([num, lbl]) => (
              <div key={lbl}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: "#1b7a52", letterSpacing: "-1px" }}>{num}</div>
                <div style={{ fontSize: 11.5, color: "#3e6b52", fontWeight: 500, marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right — mock UI */}
        <div>
          <div style={{ background: "#fff", borderRadius: 20, padding: 24, border: "1px solid rgba(10,34,24,0.08)", boxShadow: "0 8px 40px rgba(10,34,24,0.07)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 700, color: "#071a10" }}>BOM Analysis</span>
              <span style={{ background: "#e8f7ef", color: "#0a5c35", fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20 }}>14 components found</span>
            </div>
            {[
              { part: "STM32F4", meta: "Mouser, DigiKey +3", price: "$4.20", tag: "In Stock", tagBg: "#e8f7ef", tagColor: "#0a5c35" },
              { part: "LM358N Op-Amp", meta: "Arrow, LCSC +2", price: "$0.38", tag: "Low Stock", tagBg: "#fef3e2", tagColor: "#7a4f0a" },
              { part: "AMS1117-3.3", meta: "Farnell only", price: "$1.10", tag: "Risk", tagBg: "#fdecea", tagColor: "#7a1a0a" },
            ].map((row, i, arr) => (
              <div key={row.part} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: i < arr.length - 1 ? "1px solid #f0f4f2" : "none" }}>
                <div>
                  <div style={{ fontSize: 13, color: "#071a10", fontWeight: 500 }}>{row.part}</div>
                  <div style={{ fontSize: 11.5, color: "#7aaa8e" }}>{row.meta}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#071a10" }}>{row.price}</div>
                  <span style={{ fontSize: 10.5, fontWeight: 600, padding: "3px 8px", borderRadius: 12, background: row.tagBg, color: row.tagColor }}>{row.tag}</span>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: "#071a10", borderRadius: 16, padding: "16px 20px", marginTop: 12 }}>
            <div style={{ fontSize: 12, color: "#7aaa8e", marginBottom: 10 }}>AI Copilot</div>
            <div style={{ fontSize: 13, color: "#dff0e8", lineHeight: 1.6 }}>
              AMS1117-3.3 is single-sourced. I found 3 alternatives with better availability and 18% lower cost.
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div style={{ padding: "32px 48px", position: "relative", zIndex: 5, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11.5, color: "#3a6650", fontWeight: 600, letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 16, textAlign: "center" }}>Sourcing across top distributors</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {["Mouser", "DigiKey", "Arrow", "Farnell", "LCSC", "RS Components", "Future Electronics", "+133 more"].map((name) => (
            <span key={name} style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(10,34,24,0.15)", borderRadius: 50, padding: "7px 18px", fontSize: 12, fontWeight: 600, color: "#1e3d2c" }}>{name}</span>
          ))}
        </div>
      </div>

      {/* Features */}
      <div style={{ padding: "48px 48px 0", position: "relative", zIndex: 5, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11.5, color: "#0a5c35", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}>What it does</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: "#071a10", textAlign: "center", letterSpacing: "-1px", marginBottom: 8 }}>Everything procurement needs</h2>
        <p style={{ fontSize: 14.5, color: "#1e3d2c", textAlign: "center", lineHeight: 1.65, maxWidth: 480, margin: "0 auto 36px" }}>
          From upload to decision in minutes. No more tab-switching, no more manual comparisons.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {[
            { icon: "📄", title: "Real-time BOM Parsing", body: "Upload any BOM format and instantly surface supplier options, live pricing, and lead times across 140+ distributors.", stat: "10x", statLbl: "faster than manual sourcing" },
            { icon: "📡", title: "Supply Chain Monitor", body: "Continuous watch on critical components with AI alerts for price spikes, shortages, and single-source risks.", stat: "24/7", statLbl: "automated monitoring" },
            { icon: "🤖", title: "AI Copilot", body: "Ask anything about stock levels, alternates, or risks. Get instant sourcing recommendations grounded in live data.", stat: "Instant", statLbl: "answers, no waiting" },
          ].map((f) => (
            <div key={f.title} style={{ background: "#fff", borderRadius: 18, padding: "28px 24px", border: "1px solid rgba(10,34,24,0.07)" }}>
              <div style={{ width: 40, height: 40, background: "#e8f7ef", borderRadius: 11, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 18 }}>{f.icon}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 16, fontWeight: 700, color: "#071a10", marginBottom: 9 }}>{f.title}</div>
              <div style={{ fontSize: 13.5, color: "#2e5040", lineHeight: 1.65 }}>{f.body}</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 22, fontWeight: 800, color: "#1b7a52", marginTop: 14, letterSpacing: "-1px" }}>{f.stat}</div>
              <div style={{ fontSize: 11, color: "#5a8a6e", marginTop: 2 }}>{f.statLbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Demo */}
      <div style={{ padding: "56px 48px 0", position: "relative", zIndex: 5, maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11.5, color: "#0a5c35", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}>Try it now</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 32, fontWeight: 800, color: "#071a10", textAlign: "center", letterSpacing: "-1px", marginBottom: 8 }}>See it work on your BOM</h2>
        <p style={{ fontSize: 14.5, color: "#1e3d2c", textAlign: "center", lineHeight: 1.65, maxWidth: 440, margin: "0 auto 28px" }}>
          Paste any BOM — CSV, text, or freeform. No signup, no demo call. Real pricing from 140+ distributors in seconds.
        </p>
        <BomDemo />
      </div>

      {/* Footer */}
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "28px 48px", marginTop: 48, borderTop: "1px solid rgba(10,34,24,0.15)", position: "relative", zIndex: 5 }}>
        <span style={{ fontSize: 12.5, color: "#3a6650" }}>2025 OmniProcure. AI-Native Procurement.</span>
        <div style={{ display: "flex", gap: 20 }}>
          <a href="mailto:yhwach149@gmail.com" style={{ fontSize: 12.5, color: "#3a6650", textDecoration: "none" }}>Contact</a>
          <span style={{ fontSize: 12.5, color: "#3a6650" }}>Privacy</span>
          <span style={{ fontSize: 12.5, color: "#3a6650" }}>Terms</span>
        </div>
      </footer>

    </div>
  );
}
