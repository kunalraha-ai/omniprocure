import Link from "next/link";
import BomDemo from "@/components/BomDemo";

export default function Page() {
  const C = {
    bg: "#1c202a",
    card: "#232833",
    border: "#2f3644",
    sky: "#5ebcf8",
    skyHover: "#7dd3fc",
    text: "#f1f5f9",
    muted: "#94a3b8",
    mutedDim: "#64748b",
    shadow: "6px 6px 12px #12141a, -6px -6px 12px #262c3a",
    shadowInner: "inset 4px 4px 8px #12141a, inset -4px -4px 8px #262c3a",
  };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, color: C.text, minHeight: "100vh", position: "relative", overflowX: "hidden" }}>

      {/* Neumorphic Ambient Glows */}
      <div style={{ position: "fixed", width: 450, height: 450, borderRadius: "50%", background: "radial-gradient(circle, rgba(94,188,248,0.06), transparent 70%)", top: -100, right: -100, pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(148,163,184,0.04), transparent 70%)", bottom: 100, left: -100, pointerEvents: "none", zIndex: 0 }} />

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 48px", position: "relative", zIndex: 10 }}>
        <span style={{ fontFamily: "'Syne', sans-serif", fontWeight: 800, fontSize: 20, color: C.sky, letterSpacing: "-0.5px" }}>OmniProcure</span>
        <Link href="/dashboard" style={{
          display: "inline-block",
          background: C.card,
          color: C.sky,
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 700,
          fontSize: 13.5,
          padding: "9px 24px",
          borderRadius: 50,
          boxShadow: C.shadow,
          border: `1.5px solid ${C.border}`,
          textDecoration: "none",
          transition: "all 0.2s ease"
        }}>
          Sign in
        </Link>
      </nav>

      {/* Hero Section */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 48, padding: "64px 48px 40px", alignItems: "center", position: "relative", zIndex: 5, maxWidth: 1150, margin: "0 auto" }}>

        {/* Hero Left */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.sky, letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: 18 }}>AI-Native Sourcing Engine</div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 54, fontWeight: 800, lineHeight: 1.08, color: C.text, letterSpacing: "-2px", marginBottom: 24 }}>
            Cut procurement<br />
            time from{" "}
            <span style={{ color: C.sky }}>3 hours<br />to 3 minutes</span>
          </h1>
          <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.75, maxWidth: 450, marginBottom: 36 }}>
            Parse complex BOMs, query 140+ distributors concurrently, and map packaging variants in real-time. Zero spreadsheets, infinite velocity.
          </p>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 48 }}>
            <Link href="/dashboard" style={{
              display: "inline-block",
              background: C.sky,
              color: C.bg,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: 14.5,
              padding: "14px 32px",
              borderRadius: 50,
              boxShadow: "4px 4px 10px #12141a",
              textDecoration: "none",
              transition: "transform 0.15s ease"
            }}>
              Get Started
            </Link>
            <a href="mailto:yhwach149@gmail.com" style={{
              display: "inline-block",
              background: C.card,
              color: C.sky,
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              padding: "13px 28px",
              borderRadius: 50,
              boxShadow: C.shadow,
              border: `1px solid ${C.border}`,
              textDecoration: "none",
              transition: "all 0.2s ease"
            }}>
              Contact Us
            </a>
          </div>
          
          {/* Stats Bar */}
          <div style={{ display: "flex", gap: 32 }}>
            {[["140+", "Distributors integrated"], ["10+", "Beta users in production"], ["98%", "Stock risk coverage"]].map(([num, lbl]) => (
              <div key={lbl}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 26, fontWeight: 800, color: C.sky, letterSpacing: "-1px" }}>{num}</div>
                <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 500, marginTop: 2 }}>{lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hero Right — Bento style mock UI */}
        <div>
          <div style={{ background: C.card, borderRadius: 24, padding: 28, boxShadow: C.shadow, border: `1.5px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <span style={{ fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, color: C.sky }}>BOM Sourcing telemetry</span>
              <span style={{ background: "rgba(94,188,248,0.12)", color: C.sky, fontSize: 11, fontWeight: 700, padding: "4px 12px", borderRadius: 50 }}>14 items sourced</span>
            </div>
            {[
              { part: "STM32F405RGT6", meta: "Mouser, DigiKey +4", price: "$4.20", tag: "In Stock", tagBg: "rgba(16,185,129,0.12)", tagColor: "#34d399" },
              { part: "LM358DR Op-Amp", meta: "Arrow, LCSC +2", price: "$0.08", tag: "Low Stock", tagBg: "rgba(245,158,11,0.12)", tagColor: "#fbbf24" },
              { part: "AMS1117-3.3 LDO", meta: "Farnell only", price: "$0.14", tag: "Single Source", tagBg: "rgba(239,68,68,0.12)", tagColor: "#f87171" },
            ].map((row, i, arr) => (
              <div key={row.part} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: i < arr.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div>
                  <div style={{ fontSize: 13.5, color: C.text, fontWeight: 600, fontFamily: "monospace" }}>{row.part}</div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>{row.meta}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: C.sky }}>{row.price}</div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 12, background: row.tagBg, color: row.tagColor, display: "inline-block", marginTop: 4 }}>{row.tag}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: "rgba(18,20,26,0.5)", borderRadius: 20, padding: "18px 24px", marginTop: 16, boxShadow: C.shadowInner, border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.sky, letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>AI Sourcing Recommendation</div>
            <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6 }}>
              AMS1117-3.3 is currently single-sourced via Farnell. I identified **3 drop-in alternates** with active stock and **18% lower average cost**.
            </div>
          </div>
        </div>
      </div>

      {/* Sourcing Partner Bar */}
      <div style={{ padding: "48px 48px 24px", position: "relative", zIndex: 5, maxWidth: 1150, margin: "0 auto" }}>
        <div style={{ fontSize: 11.5, color: C.muted, fontWeight: 700, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 20, textAlign: "center" }}>Connected Distributor Networks</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          {["Mouser", "DigiKey", "Arrow", "Farnell", "LCSC", "RS Components", "Future Electronics", "+130 more"].map((name) => (
            <span key={name} style={{
              background: C.card,
              border: `1.5px solid ${C.border}`,
              boxShadow: "3px 3px 6px #12141a",
              borderRadius: 50,
              padding: "8px 20px",
              fontSize: 12.5,
              fontWeight: 600,
              color: C.sky
            }}>{name}</span>
          ))}
        </div>
      </div>

      {/* Bento Grid Features */}
      <div style={{ padding: "72px 48px 32px", position: "relative", zIndex: 5, maxWidth: 1150, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: C.sky, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Platform Capabilities</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: C.text, textAlign: "center", letterSpacing: "-1.5px", marginBottom: 48 }}>
          Everything electronics procurement needs
        </h2>
        
        {/* Bento Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
          {[
            { icon: "📄", title: "Real-time BOM Parsing", body: "Upload any BOM format. Surf options, unit pricing, and lead-times across distributors instantly.", stat: "10x", statLbl: "faster than manual sourcing" },
            { icon: "📡", title: "Supply Chain Telemetry", body: "Continuous background watch on critical parts with alerts for price volatility, low stocks, and lead-times.", stat: "24/7", statLbl: "automated active checks" },
            { icon: "🤖", title: "AI Agentic Copilot", body: "Chat command interface with live tool-use. Ask about stock levels, alternates, or trigger monitoring checks.", stat: "Instant", statLbl: "answers with tool actions" },
          ].map((f) => (
            <div key={f.title} style={{
              background: C.card,
              borderRadius: 24,
              padding: "32px 28px",
              boxShadow: C.shadow,
              border: `1.5px solid ${C.border}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              transition: "transform 0.2s ease"
            }}>
              <div>
                <div style={{ width: 44, height: 44, background: "rgba(94,188,248,0.12)", borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 20 }}>{f.icon}</div>
                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 800, color: C.sky, marginBottom: 12 }}>{f.title}</h3>
                <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.7 }}>{f.body}</p>
              </div>
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 24, fontWeight: 800, color: C.text, letterSpacing: "-1px" }}>{f.stat}</div>
                <div style={{ fontSize: 11, color: C.mutedDim, marginTop: 2 }}>{f.statLbl}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Demo Section */}
      <div style={{ padding: "64px 48px 48px", position: "relative", zIndex: 5, maxWidth: 1150, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: C.sky, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", textAlign: "center", marginBottom: 12 }}>Interactive Sandbox</div>
        <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: 36, fontWeight: 800, color: C.text, textAlign: "center", letterSpacing: "-1.5px", marginBottom: 16 }}>Test run your BOM</h2>
        <p style={{ fontSize: 14.5, color: C.muted, textAlign: "center", lineHeight: 1.65, maxWidth: 500, margin: "0 auto 36px" }}>
          Paste your BOM spreadsheet contents, list of MPNs, or raw CSV text. Our system parses it with Claude and gets live pricing immediately.
        </p>
        
        {/* Neumorphic Demo Container */}
        <div style={{ background: C.card, borderRadius: 28, padding: 32, boxShadow: C.shadow, border: `1.5px solid ${C.border}` }}>
          <BomDemo />
        </div>
      </div>

      {/* Footer */}
      <footer style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "32px 48px", marginTop: 64, borderTop: `1.5px solid ${C.border}`, position: "relative", zIndex: 5 }}>
        <span style={{ fontSize: 12.5, color: C.muted }}>&copy; 2026 OmniProcure. AI-Native Procurement Sourcing.</span>
        <div style={{ display: "flex", gap: 24 }}>
          <a href="mailto:yhwach149@gmail.com" style={{ fontSize: 12.5, color: C.sky, textDecoration: "none" }}>Contact Support</a>
          <span style={{ fontSize: 12.5, color: C.mutedDim }}>Privacy Policy</span>
          <span style={{ fontSize: 12.5, color: C.mutedDim }}>Terms of Service</span>
        </div>
      </footer>

    </div>
  );
}
