'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Clock, CheckCircle, XCircle,
  RefreshCw, Search, Loader2, AlertTriangle,
  ChevronDown, ChevronUp, Package, Send
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type HitlStatus = 'pending' | 'approved' | 'rejected' | 'modified'

interface HitlOrder {
  id: string
  mpn: string
  supplier: string
  price: number | null
  currency: string
  moq: number
  lead_time: string
  total_value: number
  status: HitlStatus
  ai_recommendation: string | null
  created_at: string
  decided_at: string | null
  modified_note: string | null
  // from po_history join
  po_number?: string
  po_text?: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

const STATUS_TABS: { value: 'all' | HitlStatus; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

function GlacierStatusBadge({ status }: { status: HitlStatus }) {
  const cfg: Record<HitlStatus, { bg: string; border: string; color: string; icon: React.ReactNode; label: string }> = {
    pending:  { bg: 'rgba(200,160,240,0.15)', border: 'rgba(200,160,240,0.3)', color: '#c8a0f0', icon: <Clock className="w-3 h-3" />,      label: 'Awaiting Approval' },
    approved: { bg: 'rgba(125,211,252,0.15)', border: 'rgba(125,211,252,0.3)', color: '#7dd3fc', icon: <CheckCircle className="w-3 h-3" />, label: 'PO Generated' },
    rejected: { bg: 'rgba(255,107,107,0.15)', border: 'rgba(255,107,107,0.3)', color: '#ff6b6b', icon: <XCircle className="w-3 h-3" />,    label: 'Rejected' },
    modified: { bg: 'rgba(136,180,204,0.15)', border: 'rgba(136,180,204,0.3)', color: '#88b4cc', icon: <Send className="w-3 h-3" />,       label: 'Modified' },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.icon}{c.label}
    </span>
  )
}

function OrderRow({ order, selected, onSelect }: {
  order: HitlOrder; selected: boolean; onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div onClick={onSelect} className="cursor-pointer transition-colors"
        style={{
          padding: '1rem',
          borderBottom: selected ? '1px solid rgba(125,211,252,0.2)' : '1px solid rgba(74,96,112,0.3)',
          background: selected ? 'rgba(125,211,252,0.05)' : 'transparent',
        }}
        onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'rgba(20,28,46,0.5)' }}
        onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold" style={{ color: selected ? '#7dd3fc' : '#e0e8f0' }}>
              {order.id.slice(0, 8).toUpperCase()}
            </span>
            <GlacierStatusBadge status={order.status} />
          </div>
          <span className="text-base font-bold" style={{ color: selected ? '#e0e8f0' : '#a0b4c4' }}>
            ${Number(order.total_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        </div>
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm" style={{ color: '#a0b4c4' }}>
              Supplier: <span style={{ color: '#e0e8f0', fontWeight: 500 }}>{order.supplier}</span>
            </span>
            <span className="text-xs" style={{ color: '#4a6070' }}>
              {order.mpn} · {new Date(order.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          {selected && <span className="material-symbols-outlined text-xl" style={{ color: '#7dd3fc' }}>chevron_right</span>}
        </div>

        {expanded && (
          <div className="mt-3 pt-3 grid grid-cols-2 gap-3 text-xs" style={{ borderTop: '1px solid rgba(74,96,112,0.3)' }}>
            {[
              { label: 'Order ID',  value: order.id },
              { label: 'MPN',       value: order.mpn },
              { label: 'MOQ × Price', value: `${order.moq} × $${(order.price ?? 0).toFixed(4)}` },
              { label: 'Lead Time', value: order.lead_time || '—' },
              { label: 'Currency',  value: order.currency },
              { label: 'Created',   value: new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ color: '#a0b4c4' }} className="mb-0.5">{label}</p>
                <p style={{ color: '#e0e8f0' }} className="font-mono truncate">{value}</p>
              </div>
            ))}
          </div>
        )}

        <button onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          className="mt-2 flex items-center gap-1 text-xs transition-colors"
          style={{ color: '#4a6070' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#a0b4c4'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#4a6070'}
        >
          {expanded ? <><ChevronUp className="w-3 h-3" />Hide</> : <><ChevronDown className="w-3 h-3" />Details</>}
        </button>
      </div>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardOrdersPage() {
  const [orders, setOrders]       = useState<HitlOrder[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | HitlStatus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deciding, setDeciding]   = useState(false)
  const [decideError, setDecideError] = useState('')

  const fetchOrders = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')
    try {
      // Fetch hitl_queue joined with po_history
      const { data: hitlData, error: hitlError } = await supabase
        .from('hitl_queue')
        .select('*')
        .order('created_at', { ascending: false })

      if (hitlError) throw hitlError

      const { data: poData } = await supabase
        .from('po_history')
        .select('hitl_id, po_number, po_text')

      const poMap = new Map((poData ?? []).map((p: any) => [p.hitl_id, p]))

      const merged: HitlOrder[] = (hitlData ?? []).map((r: any) => ({
        id: r.id,
        mpn: r.mpn,
        supplier: r.supplier,
        price: r.price,
        currency: r.currency ?? 'USD',
        moq: r.moq ?? 1,
        lead_time: r.lead_time ?? '—',
        total_value: r.total_value ?? 0,
        status: r.status,
        ai_recommendation: r.ai_recommendation,
        created_at: r.created_at,
        decided_at: r.decided_at,
        modified_note: r.modified_note,
        po_number: poMap.get(r.id)?.po_number,
        po_text: poMap.get(r.id)?.po_text,
      }))

      setOrders(merged)
      setFetchState('success')

      const firstPending = merged.find(o => o.status === 'pending')
      if (firstPending) setSelectedId(firstPending.id)
      else if (merged.length > 0) setSelectedId(merged[0].id)
    } catch (e: any) {
      setErrorMessage(e?.message ?? 'Failed to load orders')
      setFetchState('error')
    }
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── Approve / Reject ──────────────────────────────────────────────────────
  async function decide(decision: 'approved' | 'rejected', note?: string) {
    if (!selectedId) return
    setDeciding(true)
    setDecideError('')
    try {
      const res = await fetch(`/api/request-po/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, note }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`)

      // Update local state
      setOrders(prev => prev.map(o =>
        o.id === selectedId
          ? { ...o, status: decision, po_number: data.poNumber, po_text: data.poText }
          : o
      ))
    } catch (e: any) {
      setDecideError(e?.message ?? 'Decision failed')
    } finally {
      setDeciding(false)
    }
  }

  const filtered = orders.filter(o => {
    const q = searchTerm.toLowerCase()
    return (o.mpn.toLowerCase().includes(q) || o.supplier.toLowerCase().includes(q)) &&
      (activeTab === 'all' || o.status === activeTab)
  })

  const tabCount = (tab: 'all' | HitlStatus) =>
    tab === 'all' ? orders.length : orders.filter(o => o.status === tab).length

  const selectedOrder  = orders.find(o => o.id === selectedId) ?? null
  const pendingCount   = orders.filter(o => o.status === 'pending').length
  const approvedCount  = orders.filter(o => o.status === 'approved').length
  const totalValue     = orders.reduce((sum, o) => sum + Number(o.total_value), 0)
  const isLoading      = fetchState === 'loading'

  return (
    <div className="relative min-h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.06), transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(61,32,96,0.2), transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col gap-6">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#e0e8f0' }}>
              Orders <span style={{ color: '#7dd3fc' }}>&amp;</span> HITL Approvals
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#a0b4c4' }}>
              Track purchase orders, approvals, and fulfillment status.
            </p>
          </div>
          <button onClick={fetchOrders} disabled={isLoading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{ background: 'rgba(26,36,56,0.5)', border: '1px solid rgba(160,180,196,0.2)', color: '#a0b4c4' }}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders',     value: orders.length,   icon: 'shopping_cart',   color: '#7dd3fc' },
            { label: 'Pending Approval', value: pendingCount,    icon: 'pending_actions', color: '#c8a0f0' },
            { label: 'Approved / PO',    value: approvedCount,   icon: 'verified',        color: '#88b4cc' },
            { label: 'Total Value',      value: `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, icon: 'payments', color: '#7dd3fc' },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="flex flex-col gap-3 rounded-xl p-5"
              style={{ background: 'rgba(15,21,36,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(125,211,252,0.1)' }}>
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#a0b4c4' }}>{label}</p>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                  <span className="material-symbols-outlined" style={{ color, fontSize: '18px' }}>{icon}</span>
                </div>
              </div>
              <p className="text-3xl font-bold leading-tight" style={{ color: '#e0e8f0' }}>
                {isLoading ? '—' : value}
              </p>
            </div>
          ))}
        </div>

        {/* Pending alert banner */}
        {pendingCount > 0 && !isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4"
            style={{ background: 'rgba(61,20,20,0.4)', border: '1px solid rgba(255,107,107,0.3)' }}>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'rgba(61,20,20,0.6)', border: '1px solid rgba(255,107,107,0.2)' }}>
                <span className="material-symbols-outlined text-xl" style={{ color: '#ff6b6b', fontVariationSettings: "'FILL' 1" }}>warning</span>
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: '#ffb3b3' }}>High Priority Alert</p>
                <p className="text-sm mt-0.5" style={{ color: '#a0b4c4' }}>
                  {pendingCount} Purchase Order{pendingCount > 1 ? 's' : ''} requiring immediate manual approval.
                </p>
              </div>
            </div>
            <button onClick={() => setActiveTab('pending')}
              className="rounded-lg px-5 py-2 text-sm font-medium transition-all whitespace-nowrap"
              style={{ background: 'rgba(26,36,56,0.5)', border: '1px solid rgba(160,180,196,0.2)', color: '#e0e8f0' }}>
              Review Now
            </button>
          </div>
        )}

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">

          {/* Left: Orders list */}
          <div className="w-full lg:w-5/12 xl:w-2/5 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-semibold" style={{ color: '#e0e8f0' }}>Active Orders</h3>
              <div className="flex gap-1">
                {STATUS_TABS.slice(0, 3).map(tab => (
                  <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                    className="px-2.5 py-1 rounded text-xs font-medium transition-all"
                    style={{
                      background: activeTab === tab.value ? 'rgba(125,211,252,0.15)' : 'transparent',
                      border: activeTab === tab.value ? '1px solid rgba(125,211,252,0.3)' : '1px solid transparent',
                      color: activeTab === tab.value ? '#7dd3fc' : '#a0b4c4',
                    }}>
                    {tab.label} {!isLoading && <span className="ml-1 opacity-70">{tabCount(tab.value)}</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{ background: 'rgba(15,21,36,0.4)', border: '1px solid rgba(125,211,252,0.1)' }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: '#a0b4c4' }} />
              <input placeholder="Search orders…" value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)} disabled={isLoading}
                className="bg-transparent text-sm outline-none w-full" style={{ color: '#e0e8f0' }} />
            </div>

            <div className="flex-1 flex flex-col overflow-hidden rounded-xl"
              style={{ background: 'rgba(15,21,36,0.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(125,211,252,0.1)' }}>

              {isLoading && (
                <div className="flex items-center justify-center gap-3 py-20" style={{ color: '#a0b4c4' }}>
                  <Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading orders…</span>
                </div>
              )}

              {fetchState === 'error' && (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                  <AlertTriangle className="w-8 h-8" style={{ color: '#ff6b6b' }} />
                  <p className="font-medium" style={{ color: '#e0e8f0' }}>Failed to load orders</p>
                  <p className="text-sm" style={{ color: '#a0b4c4' }}>{errorMessage}</p>
                </div>
              )}

              {fetchState === 'success' && orders.length === 0 && (
                <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(125,211,252,0.1)', border: '1px solid rgba(125,211,252,0.2)' }}>
                    <ShoppingCart className="w-7 h-7" style={{ color: '#7dd3fc' }} />
                  </div>
                  <p className="font-semibold" style={{ color: '#e0e8f0' }}>No orders yet</p>
                  <p className="text-sm max-w-xs" style={{ color: '#a0b4c4' }}>
                    Upload a BOM and approve a quote to generate your first PO.
                  </p>
                </div>
              )}

              {fetchState === 'success' && orders.length > 0 && (
                <div className="flex-1 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="py-12 text-center text-sm" style={{ color: '#a0b4c4' }}>No orders match your filters.</div>
                  ) : filtered.map(order => (
                    <OrderRow key={order.id} order={order} selected={selectedId === order.id} onSelect={() => setSelectedId(order.id)} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: PO detail + actions */}
          <div className="w-full lg:w-7/12 xl:w-3/5 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#e0e8f0' }}>
                {selectedOrder
                  ? <>Review: {selectedOrder.id.slice(0, 8).toUpperCase()}
                    {selectedOrder.status === 'pending' && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />}
                  </>
                  : 'Select an order'}
              </h3>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden rounded-xl"
              style={{ background: 'rgba(15,21,36,0.75)', backdropFilter: 'blur(24px)', border: '1px solid rgba(125,211,252,0.15)' }}>

              {!selectedOrder ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 py-24 px-6 text-center">
                  <Package className="w-7 h-7" style={{ color: '#7dd3fc' }} />
                  <p style={{ color: '#a0b4c4' }} className="text-sm">Select an order from the list to review</p>
                </div>
              ) : (
                <>
                  {/* PO Document */}
                  <div className="flex-1 overflow-y-auto p-6"
                    style={{ background: 'rgba(32,44,66,0.3)', borderBottom: '1px solid rgba(74,96,112,0.3)' }}>
                    <div className="max-w-2xl mx-auto rounded-lg p-8 font-mono text-sm"
                      style={{ background: 'rgba(20,28,46,0.8)', border: '1px solid rgba(74,96,112,0.5)', borderTop: '3px solid #7dd3fc' }}>

                      <div className="flex justify-between items-start mb-6 pb-4"
                        style={{ borderBottom: '1px solid rgba(74,96,112,0.4)' }}>
                        <div>
                          <h4 className="text-xl font-sans font-bold tracking-wider" style={{ color: '#e0e8f0' }}>PURCHASE ORDER</h4>
                          <p className="mt-2 text-xs" style={{ color: '#a0b4c4' }}>{selectedOrder.supplier}<br />Region: Global</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" style={{ color: '#e0e8f0' }}>
                            {selectedOrder.po_number ? `PO#: ${selectedOrder.po_number}` : `REQ#: ${selectedOrder.id.slice(0, 8).toUpperCase()}`}
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#a0b4c4' }}>Date: {new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                          <p className="text-xs" style={{ color: '#a0b4c4' }}>Terms: Net 30</p>
                        </div>
                      </div>

                      {/* Line items */}
                      <table className="w-full text-left mb-6">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(74,96,112,0.4)' }}>
                            {['MPN', 'MOQ', 'Unit Price', 'Total'].map(h => (
                              <th key={h} className="py-2 text-xs font-medium" style={{ color: '#e0e8f0', textAlign: h !== 'MPN' ? 'right' : 'left' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid rgba(74,96,112,0.2)' }}>
                            <td className="py-3 text-xs font-mono" style={{ color: '#7dd3fc' }}>{selectedOrder.mpn}</td>
                            <td className="py-3 text-xs text-right" style={{ color: '#a0b4c4' }}>{selectedOrder.moq}</td>
                            <td className="py-3 text-xs text-right" style={{ color: '#a0b4c4' }}>${(selectedOrder.price ?? 0).toFixed(4)}</td>
                            <td className="py-3 text-xs text-right font-medium" style={{ color: '#e0e8f0' }}>
                              ${Number(selectedOrder.total_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid rgba(74,96,112,0.5)' }}>
                            <td colSpan={3} className="py-3 text-right text-xs font-bold" style={{ color: '#e0e8f0' }}>TOTAL:</td>
                            <td className="py-3 text-right text-base font-bold" style={{ color: '#7dd3fc' }}>
                              ${Number(selectedOrder.total_value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* AI recommendation */}
                      {selectedOrder.ai_recommendation && (
                        <div className="rounded-lg p-3 text-xs mb-3"
                          style={{ background: 'rgba(61,32,96,0.3)', border: '1px solid rgba(200,160,240,0.2)', color: '#c8a0f0' }}>
                          <strong>AI Recommendation:</strong> {selectedOrder.ai_recommendation}
                        </div>
                      )}

                      {/* Generated PO text */}
                      {selectedOrder.po_text && (
                        <div className="rounded-lg p-3 text-xs whitespace-pre-wrap"
                          style={{ background: 'rgba(15,21,36,0.6)', border: '1px solid rgba(74,96,112,0.3)', color: '#a0b4c4', maxHeight: '200px', overflowY: 'auto' }}>
                          {selectedOrder.po_text}
                        </div>
                      )}

                      {selectedOrder.status === 'pending' && (
                        <div className="flex items-start gap-2 rounded-lg p-3 text-xs mt-3"
                          style={{ background: 'rgba(61,20,20,0.3)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b' }}>
                          <span className="material-symbols-outlined text-sm shrink-0">info</span>
                          Requires explicit human sign-off before PO is issued.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions panel */}
                  <div className="p-5 flex flex-col gap-4" style={{ background: 'rgba(20,28,46,0.8)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(61,32,96,0.6)', border: '1px solid rgba(200,160,240,0.3)' }}>
                        <span className="material-symbols-outlined text-sm" style={{ color: '#c8a0f0', fontVariationSettings: "'FILL' 1", fontSize: '16px' }}>smart_toy</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1" style={{ color: '#e0e8f0' }}>AI Audit Trail</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#a0b4c4' }}>
                          Reviewed PO for <span style={{ color: '#7dd3fc' }}>{selectedOrder.mpn}</span> from{' '}
                          <span style={{ color: '#e0e8f0' }}>{selectedOrder.supplier}</span>.{' '}
                          {selectedOrder.status === 'pending' ? 'Flagged for HITL review — awaiting human approval.'
                          : selectedOrder.status === 'approved' ? `PO ${selectedOrder.po_number ?? ''} generated and saved.`
                          : selectedOrder.status === 'rejected' ? 'Order rejected. No PO issued.'
                          : 'Order modified and processed.'}
                        </p>
                      </div>
                    </div>

                    {decideError && (
                      <p className="text-xs text-red-400 px-1">{decideError}</p>
                    )}

                    {/* ✅ Wired approve/reject buttons */}
                    {selectedOrder.status === 'pending' && (
                      <div className="flex gap-3 justify-end pt-3" style={{ borderTop: '1px solid rgba(74,96,112,0.3)' }}>
                        <button
                          disabled={deciding}
                          onClick={() => decide('rejected')}
                          className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                          style={{ background: 'rgba(26,36,56,0.5)', border: '1px solid rgba(160,180,196,0.2)', color: '#e0e8f0' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ff6b6b'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,107,0.3)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#e0e8f0'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,180,196,0.2)' }}
                        >
                          {deciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          Reject
                        </button>
                        <button
                          disabled={deciding}
                          onClick={() => decide('approved')}
                          className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                          style={{ background: 'rgba(125,211,252,0.15)', border: '1px solid rgba(125,211,252,0.3)', color: '#c8eaff' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.25)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.15)' }}
                        >
                          {deciding ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Approve &amp; Generate PO
                        </button>
                      </div>
                    )}

                    {selectedOrder.status !== 'pending' && (
                      <div className="flex justify-end pt-3" style={{ borderTop: '1px solid rgba(74,96,112,0.3)' }}>
                        <GlacierStatusBadge status={selectedOrder.status} />
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}