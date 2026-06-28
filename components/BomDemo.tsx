'use client'

import { useState, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineItemResult {
  mpn: string
  part_name: string
  qty: number
  best_supplier: string | null
  price: number | null
  lead_time: string
  stock_status: 'In Stock' | 'Low Stock' | 'Out of Stock'
  status: 'sourced' | 'partial' | 'unfound'
}

interface Summary {
  totalItems: number
  sourced: number
  partial: number
  unfound: number
  estimatedCost: number
}

type Phase = 'idle' | 'parsing' | 'searching' | 'done' | 'error'

// ── Sample BOMs ───────────────────────────────────────────────────────────────
const SAMPLE_BOMS = [
  {
    label: 'ESP32 IoT Board',
    value: `MPN,Description,Qty,Manufacturer
ESP32-WROOM-32,WiFi+BT SoC Module,4,Espressif
AMS1117-3.3,LDO Voltage Regulator 3.3V,4,AMS
CP2102N-A02-GQFN28R,USB-UART Bridge,2,Silicon Labs
GRM188R71C104KA01D,100nF 0402 MLCC Capacitor,40,Murata
RC0402FR-0710KL,10K 0402 Resistor,20,Yageo`,
  },
  {
    label: 'STM32 Motor Controller',
    value: `MPN,Description,Qty,Manufacturer
STM32F103C8T6,ARM Cortex-M3 MCU,2,STMicroelectronics
DRV8833PWPR,Dual H-Bridge Motor Driver,2,Texas Instruments
LM358DR,Dual Op-Amp SOIC-8,4,Texas Instruments
AMS1117-5.0,LDO Voltage Regulator 5V,2,AMS
GRM188R61A106KE69D,10uF 0402 MLCC,10,Murata`,
  },
  {
    label: 'Pi Hat (Power)',
    value: `MPN,Description,Qty,Manufacturer
TPS54360BDDAR,3.5A Buck Converter,1,Texas Instruments
TPS2553DBVR,USB Power Switch,2,Texas Instruments
CSD17581Q5A,30V N-Channel FET,4,Texas Instruments
GRM21BR61A106KE19L,10uF 0805 Capacitor,8,Murata
CRCW04021K00FKED,1K 0402 Resistor,6,Vishay`,
  },
]

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: LineItemResult['stock_status'] }) {
  const map = {
    'In Stock':     { bg: 'rgba(16,185,129,0.12)', color: '#34d399', dot: '#10b981' },
    'Low Stock':    { bg: 'rgba(245,158,11,0.12)', color: '#fbbf24', dot: '#f59e0b' },
    'Out of Stock': { bg: 'rgba(239,68,68,0.12)',  color: '#f87171', dot: '#ef4444' },
  }
  const s = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {status}
    </span>
  )
}

// ── Skeleton row ──────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr>
      {[120, 80, 40, 100, 70, 80, 90].map((w, i) => (
        <td key={i} style={{ padding: '14px 16px' }}>
          <div style={{
            height: 12, width: w, borderRadius: 6,
            background: 'linear-gradient(90deg, #2d3341 25%, #353c4d 50%, #2d3341 75%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.4s infinite',
          }} />
        </td>
      ))}
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function BomDemo() {
  const [phase, setPhase]         = useState<Phase>('idle')
  const [bom, setBom]             = useState(SAMPLE_BOMS[0].value)
  const [items, setItems]         = useState<LineItemResult[]>([])
  const [summary, setSummary]     = useState<Summary | null>(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [errorMsg, setErrorMsg]   = useState('')
  const [parsedCount, setParsedCount] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const C = {
    bg: "#1c202a",
    card: "#232833",
    cardElevated: "#282e3b",
    border: "#2f3644",
    sky: "#5ebcf8",
    skyHover: "#7dd3fc",
    text: "#f1f5f9",
    muted: "#94a3b8",
    mutedDim: "#64748b",
    shadow: "6px 6px 12px #12141a, -6px -6px 12px #262c3a",
    shadowInner: "inset 3px 3px 6px #12141a, inset -3px -3px 6px #262c3a",
  };

  const reset = () => {
    abortRef.current?.abort()
    setPhase('idle')
    setItems([])
    setSummary(null)
    setStatusMsg('')
    setErrorMsg('')
    setParsedCount(0)
  }

  const runDemo = async () => {
    if (!bom.trim()) return
    reset()
    await new Promise(r => setTimeout(r, 50))

    setPhase('parsing')
    setStatusMsg('Parsing BOM with Claude…')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw: bom, filename: 'demo' }),
        signal: controller.signal,
      })

      if (!res.ok || !res.body) {
        setPhase('error')
        setErrorMsg(`API error: ${res.status}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            if (evt.type === 'started')   setStatusMsg(evt.message)
            if (evt.type === 'parsed') {
              setParsedCount(evt.count)
              setPhase('searching')
              setStatusMsg(`Found ${evt.count} components — querying 140+ distributors…`)
            }
            if (evt.type === 'searching') setStatusMsg(evt.message)
            if (evt.type === 'line_item_result') {
              setItems(prev => [...prev, evt.item])
            }
            if (evt.type === 'complete') {
              setSummary({
                totalItems:    evt.totalItems,
                sourced:       evt.sourced,
                partial:       evt.partial,
                unfound:       evt.unfound,
                estimatedCost: evt.estimatedCost,
              })
              setPhase('done')
            }
            if (evt.type === 'error') {
              setPhase('error')
              setErrorMsg(evt.message)
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setPhase('error')
        setErrorMsg(err?.message ?? 'Unknown error')
      }
    }
  }

  const isRunning = phase === 'parsing' || phase === 'searching'

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.3; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .demo-row-enter {
          animation: fade-up 0.28s ease forwards;
        }
        .demo-textarea:focus {
          outline: none;
          border-color: ${C.sky} !important;
          box-shadow: inset 2px 2px 4px #12141a, inset -2px -2px 4px #262c3a, 0 0 0 2px rgba(94, 188, 248, 0.2);
        }
        .demo-btn-primary {
          transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
        }
        .demo-btn-primary:hover:not(:disabled) {
          background: ${C.skyHover} !important;
          transform: translateY(-1px);
        }
        .demo-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .demo-sample-btn {
          transition: all 0.15s;
          cursor: pointer;
        }
        .demo-sample-btn:hover {
          background: rgba(94, 188, 248, 0.12) !important;
          border-color: ${C.sky} !important;
          color: ${C.skyHover} !important;
        }
        .demo-save-btn {
          transition: background 0.15s, transform 0.12s;
        }
        .demo-save-btn:hover {
          background: ${C.skyHover} !important;
          transform: translateY(-1px);
        }
        tr:hover td {
          background: rgba(94, 188, 248, 0.03) !important;
        }
      `}</style>

      {/* ── Input Panel ─────────────────────────────────────────────────────── */}
      <div style={{
        background: C.card,
        border: `1.5px solid ${C.border}`,
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: C.shadow,
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.sky, marginBottom: 2 }}>
              Live BOM Sourcing Simulator
            </div>
            <div style={{ fontSize: 12, color: C.muted }}>
              Select a hardware profile or paste components to source instantly
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SAMPLE_BOMS.map(s => (
              <button
                key={s.label}
                onClick={() => { reset(); setBom(s.value) }}
                className="demo-sample-btn"
                style={{
                  fontSize: 11, fontWeight: 700, padding: '6px 14px', borderRadius: 20,
                  border: `1.5px solid ${C.border}`, background: C.bg,
                  color: C.muted,
                  boxShadow: '2px 2px 4px #12141a, -2px -2px 4px #262c3a'
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div style={{ padding: '20px 24px 16px' }}>
          <textarea
            className="demo-textarea"
            value={bom}
            onChange={e => { reset(); setBom(e.target.value) }}
            rows={6}
            placeholder={`Paste your BOM here — any format works.\n\nExample:\nMPN,Description,Qty\nSTM32F103C8T6,ARM Cortex-M3,2\nAMS1117-3.3,LDO Regulator,4`}
            style={{
              width: '100%', resize: 'vertical', padding: '14px 16px',
              fontSize: 12.5, fontFamily: 'monospace', lineHeight: 1.65,
              background: C.bg, border: `1.5px solid ${C.border}`,
              borderRadius: 14, color: C.text,
              boxShadow: C.shadowInner,
              transition: 'all 0.2s ease',
            }}
          />
        </div>

        {/* CTA row */}
        <div style={{
          padding: '0 24px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          {/* Status */}
          <div style={{ fontSize: 12.5, color: C.muted, minWidth: 0 }}>
            {isRunning ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.sky }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', background: C.sky,
                  animation: 'pulse-dot 1s infinite', display: 'inline-block', flexShrink: 0,
                }} />
                {statusMsg}
              </span>
            ) : phase === 'done' ? (
              <span style={{ color: '#34d399', fontWeight: 700 }}>
                ✓ Sourced {summary?.totalItems} parts successfully
              </span>
            ) : phase === 'error' ? (
              <span style={{ color: '#f87171', fontWeight: 600 }}>⚠ {errorMsg}</span>
            ) : (
              <span>Select one of the sample BOM configs to run a live trace</span>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            {phase !== 'idle' && (
              <button
                onClick={reset}
                style={{
                  fontSize: 13, fontWeight: 700, padding: '9px 18px', borderRadius: 50,
                  border: `1.5px solid ${C.border}`, background: C.bg,
                  color: C.muted, cursor: 'pointer',
                  boxShadow: '2px 2px 4px #12141a, -2px -2px 4px #262c3a',
                  transition: 'all 0.15s ease'
                }}
              >
                Reset
              </button>
            )}
            <button
              onClick={runDemo}
              disabled={isRunning || !bom.trim()}
              className="demo-btn-primary"
              style={{
                fontSize: 13, fontWeight: 700, padding: '10px 24px', borderRadius: 50,
                border: 'none',
                background: isRunning ? C.border : C.sky,
                color: isRunning ? C.muted : C.bg,
                cursor: isRunning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: !bom.trim() ? 0.45 : 1,
              }}
            >
              {isRunning ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ animation: 'spin 0.9s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Trace running…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Search live
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Results Table ──────────────────────────────────────────────────── */}
      {(items.length > 0 || isRunning) && (
        <div style={{
          marginTop: 20,
          background: C.card,
          border: `1.5px solid ${C.border}`,
          borderRadius: 24,
          overflow: 'hidden',
          boxShadow: C.shadow,
          animation: 'fade-up 0.3s ease',
        }}>
          {/* Table header bar */}
          <div style={{
            padding: '16px 24px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: C.sky }}>
              Telemetry Output
              {parsedCount > 0 && (
                <span style={{
                  marginLeft: 10, fontSize: 11, fontWeight: 800,
                  background: 'rgba(94,188,248,0.12)', color: C.sky,
                  padding: '2px 10px', borderRadius: 12,
                }}>
                  {items.length} / {parsedCount} parts resolved
                </span>
              )}
            </span>
            {isRunning && (
              <span style={{ fontSize: 12, color: C.sky, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: C.sky,
                  animation: 'pulse-dot 1s infinite', display: 'inline-block',
                }} />
                Live querying…
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.bg }}>
                  {['MPN', 'Description', 'Qty', 'Best Supplier', 'Unit Price', 'Lead Time', 'Stock'].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, color: C.muted,
                      letterSpacing: '0.08em', textTransform: 'uppercase',
                      borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr
                    key={`${item.mpn}-${i}`}
                    className="demo-row-enter"
                    style={{ borderBottom: `1px solid ${C.border}` }}
                  >
                    <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 600, color: C.text, whiteSpace: 'nowrap' }}>
                      {item.mpn}
                    </td>
                    <td style={{ padding: '14px 16px', color: C.muted, maxWidth: 220 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.part_name || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', color: C.text, fontWeight: 700, textAlign: 'center' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '14px 16px', color: C.text, whiteSpace: 'nowrap' }}>
                      {item.best_supplier ?? (
                        <span style={{ color: C.mutedDim, fontStyle: 'italic' }}>
                          {item.status === 'unfound' ? 'Not resolved' : 'Request RFQ'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: 800, color: C.sky, whiteSpace: 'nowrap' }}>
                      {item.price != null
                        ? `$${item.price.toFixed(4)}`
                        : <span style={{ color: C.mutedDim, fontStyle: 'italic', fontWeight: 400 }}>RFQ</span>
                      }
                    </td>
                    <td style={{ padding: '14px 16px', color: C.muted, whiteSpace: 'nowrap' }}>
                      {item.lead_time || '—'}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <StatusBadge status={item.stock_status} />
                    </td>
                  </tr>
                ))}

                {/* Skeleton rows while still loading */}
                {isRunning && parsedCount > items.length && (
                  Array.from({ length: Math.min(parsedCount - items.length, 3) }).map((_, i) => (
                    <SkeletonRow key={`sk-${i}`} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Summary + CTA bar ──────────────────────────────────────────── */}
          {summary && (
            <div style={{
              padding: '18px 24px',
              borderTop: `1px solid ${C.border}`,
              background: C.bg,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 14,
            }}>
              {/* Pill stats */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { label: 'Sourced',   value: summary.sourced,  bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
                  { label: 'Partial',   value: summary.partial,  bg: 'rgba(245,158,11,0.12)', color: '#fbbf24' },
                  { label: 'Not Found', value: summary.unfound,  bg: 'rgba(239,68,68,0.12)',  color: '#f87171' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 12,
                      background: s.bg, color: s.color,
                      boxShadow: '1px 1px 2px rgba(0,0,0,0.15)'
                    }}>
                      {s.value}
                    </span>
                    <span style={{ fontSize: 12, color: C.muted }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Cost + CTA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
                    Est. Total Cost
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: C.sky, letterSpacing: '-0.5px', lineHeight: 1 }}>
                    ${summary.estimatedCost.toFixed(2)}
                  </div>
                </div>
                <a
                  href="/auth/login"
                  className="demo-save-btn"
                  style={{
                    display: 'inline-block', fontSize: 13, fontWeight: 700,
                    padding: '10px 24px', borderRadius: 50,
                    background: C.sky, color: C.bg,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                    boxShadow: '3px 3px 6px #12141a',
                    transition: 'all 0.15s ease'
                  }}
                >
                  Save &amp; Monitor →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
