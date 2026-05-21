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
    'In Stock':     { bg: '#e8f7ef', color: '#0a5c35', dot: '#1b7a52' },
    'Low Stock':    { bg: '#fef3e2', color: '#7a4f0a', dot: '#d97706' },
    'Out of Stock': { bg: '#fdecea', color: '#7a1a0a', dot: '#ef4444' },
  }
  const s = map[status]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20,
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
            background: 'linear-gradient(90deg, rgba(10,34,24,0.07) 25%, rgba(10,34,24,0.13) 50%, rgba(10,34,24,0.07) 75%)',
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
          border-color: rgba(10,34,24,0.35) !important;
          box-shadow: 0 0 0 3px rgba(27,122,82,0.09);
        }
        .demo-btn-primary {
          transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
        }
        .demo-btn-primary:hover:not(:disabled) {
          background: #0f2d1c !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(7,26,16,0.22);
        }
        .demo-btn-primary:active:not(:disabled) {
          transform: translateY(0);
        }
        .demo-sample-btn {
          transition: all 0.15s;
          cursor: pointer;
        }
        .demo-sample-btn:hover {
          background: rgba(27,122,82,0.1) !important;
          border-color: rgba(27,122,82,0.35) !important;
          color: #0a5c35 !important;
        }
        .demo-save-btn {
          transition: background 0.15s, transform 0.12s;
        }
        .demo-save-btn:hover {
          background: #0f2d1c !important;
          transform: translateY(-1px);
        }
        tr:hover td {
          background: rgba(10,34,24,0.025);
        }
      `}</style>

      {/* ── Input Panel ─────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        border: '1px solid rgba(10,34,24,0.1)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 4px 28px rgba(10,34,24,0.07)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(10,34,24,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#071a10', marginBottom: 2 }}>
              Live BOM Analyzer
            </div>
            <div style={{ fontSize: 11.5, color: '#5a8a6e' }}>
              Paste any BOM · CSV, text, or freeform — no account needed
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SAMPLE_BOMS.map(s => (
              <button
                key={s.label}
                onClick={() => { reset(); setBom(s.value) }}
                className="demo-sample-btn"
                style={{
                  fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20,
                  border: '1px solid rgba(10,34,24,0.16)', background: 'transparent',
                  color: '#3e6b52',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea */}
        <div style={{ padding: '16px 20px 12px' }}>
          <textarea
            className="demo-textarea"
            value={bom}
            onChange={e => { reset(); setBom(e.target.value) }}
            rows={6}
            placeholder={`Paste your BOM here — any format works.\n\nExample:\nMPN,Description,Qty\nSTM32F103C8T6,ARM Cortex-M3,2\nAMS1117-3.3,LDO Regulator,4`}
            style={{
              width: '100%', resize: 'vertical', padding: '12px 14px',
              fontSize: 12.5, fontFamily: 'monospace', lineHeight: 1.65,
              background: '#f7faf8', border: '1px solid rgba(10,34,24,0.11)',
              borderRadius: 12, color: '#071a10',
            }}
          />
        </div>

        {/* CTA row */}
        <div style={{
          padding: '0 20px 18px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          {/* Status */}
          <div style={{ fontSize: 12, color: '#5a8a6e', minWidth: 0 }}>
            {isRunning ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#1b7a52',
                  animation: 'pulse-dot 1s infinite', display: 'inline-block', flexShrink: 0,
                }} />
                {statusMsg}
              </span>
            ) : phase === 'done' ? (
              <span style={{ color: '#0a5c35', fontWeight: 600 }}>
                ✓ {summary?.totalItems} parts analyzed
              </span>
            ) : phase === 'error' ? (
              <span style={{ color: '#c0392b' }}>⚠ {errorMsg}</span>
            ) : (
              <span>Pick a sample or paste your own BOM above</span>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {phase !== 'idle' && (
              <button
                onClick={reset}
                style={{
                  fontSize: 12.5, fontWeight: 600, padding: '9px 16px', borderRadius: 50,
                  border: '1.5px solid rgba(10,34,24,0.2)', background: 'transparent',
                  color: '#3e6b52', cursor: 'pointer',
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
                fontSize: 13, fontWeight: 700, padding: '10px 22px', borderRadius: 50,
                border: '2px solid #071a10',
                background: isRunning ? '#3e6b52' : '#1b7a52',
                color: '#fff', cursor: isRunning ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
                opacity: !bom.trim() ? 0.5 : 1,
              }}
            >
              {isRunning ? (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ animation: 'spin 0.9s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                  Analyzing…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Analyze BOM
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ── Results Table ──────────────────────────────────────────────────── */}
      {(items.length > 0 || isRunning) && (
        <div style={{
          marginTop: 14,
          background: '#fff',
          border: '1px solid rgba(10,34,24,0.1)',
          borderRadius: 20,
          overflow: 'hidden',
          boxShadow: '0 4px 28px rgba(10,34,24,0.07)',
          animation: 'fade-up 0.3s ease',
        }}>
          {/* Table header bar */}
          <div style={{
            padding: '13px 20px',
            borderBottom: '1px solid rgba(10,34,24,0.07)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#071a10' }}>
              Results
              {parsedCount > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 11, fontWeight: 600,
                  background: '#e8f7ef', color: '#0a5c35',
                  padding: '2px 8px', borderRadius: 12,
                }}>
                  {items.length} / {parsedCount} parts
                </span>
              )}
            </span>
            {isRunning && (
              <span style={{ fontSize: 11.5, color: '#5a8a6e', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: '#1b7a52',
                  animation: 'pulse-dot 1s infinite', display: 'inline-block',
                }} />
                Querying distributors…
              </span>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: '#f7faf8' }}>
                  {['MPN', 'Description', 'Qty', 'Best Supplier', 'Unit Price', 'Lead Time', 'Stock'].map(h => (
                    <th key={h} style={{
                      padding: '10px 16px', textAlign: 'left',
                      fontSize: 10.5, fontWeight: 700, color: '#3e6b52',
                      letterSpacing: '0.06em', textTransform: 'uppercase',
                      borderBottom: '1px solid rgba(10,34,24,0.07)', whiteSpace: 'nowrap',
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
                    style={{ borderBottom: '1px solid rgba(10,34,24,0.045)' }}
                  >
                    <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontWeight: 600, color: '#071a10', whiteSpace: 'nowrap' }}>
                      {item.mpn}
                    </td>
                    <td style={{ padding: '13px 16px', color: '#3e6b52', maxWidth: 190 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.part_name || '—'}
                      </div>
                    </td>
                    <td style={{ padding: '13px 16px', color: '#071a10', fontWeight: 600, textAlign: 'center' }}>
                      {item.qty}
                    </td>
                    <td style={{ padding: '13px 16px', color: '#071a10', whiteSpace: 'nowrap' }}>
                      {item.best_supplier ?? (
                        <span style={{ color: '#bbb', fontStyle: 'italic' }}>
                          {item.status === 'unfound' ? 'Not found' : 'Contact supplier'}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '13px 16px', fontWeight: 700, color: '#1b7a52', whiteSpace: 'nowrap' }}>
                      {item.price != null
                        ? `$${item.price.toFixed(3)}`
                        : <span style={{ color: '#bbb', fontStyle: 'italic', fontWeight: 400 }}>RFQ</span>
                      }
                    </td>
                    <td style={{ padding: '13px 16px', color: '#3e6b52', whiteSpace: 'nowrap' }}>
                      {item.lead_time || '—'}
                    </td>
                    <td style={{ padding: '13px 16px' }}>
                      <StatusBadge status={item.stock_status} />
                    </td>
                  </tr>
                ))}

                {/* Skeleton rows while still loading */}
                {isRunning && parsedCount > items.length && (
                  Array.from({ length: Math.min(parsedCount - items.length, 4) }).map((_, i) => (
                    <SkeletonRow key={`sk-${i}`} />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Summary + CTA bar ──────────────────────────────────────────── */}
          {summary && (
            <div style={{
              padding: '14px 20px',
              borderTop: '1px solid rgba(10,34,24,0.07)',
              background: '#f7faf8',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: 14,
            }}>
              {/* Pill stats */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                  { label: 'Sourced',   value: summary.sourced,  bg: '#e8f7ef', color: '#0a5c35' },
                  { label: 'Partial',   value: summary.partial,  bg: '#fef3e2', color: '#7a4f0a' },
                  { label: 'Not Found', value: summary.unfound,  bg: '#fdecea', color: '#7a1a0a' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 9px', borderRadius: 12,
                      background: s.bg, color: s.color,
                    }}>
                      {s.value}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#5a8a6e' }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* Cost + CTA */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10.5, color: '#5a8a6e', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>
                    Est. BOM Cost
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: '#071a10', letterSpacing: '-0.5px', lineHeight: 1 }}>
                    ${summary.estimatedCost.toFixed(2)}
                  </div>
                </div>
                <a
                  href="/auth/login"
                  className="demo-save-btn"
                  style={{
                    display: 'inline-block', fontSize: 12.5, fontWeight: 700,
                    padding: '10px 20px', borderRadius: 50,
                    background: '#071a10', color: '#dff0e8',
                    textDecoration: 'none', whiteSpace: 'nowrap',
                    border: '2px solid #071a10',
                  }}
                >
                  Save & Monitor →
                </a>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
