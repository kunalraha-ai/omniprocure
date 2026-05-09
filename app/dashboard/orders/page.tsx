'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Clock, CheckCircle, XCircle, DollarSign,
  RefreshCw, Search, Loader2, AlertTriangle, ChevronDown,
  ChevronUp, Package, Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderStatus = 'pending' | 'approved' | 'rejected' | 'sent'

interface Order {
  id: string
  mpn: string
  part_name: string
  supplier: string
  quantity: number
  unit_price: number
  total_price: number
  status: OrderStatus
  created_at: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

const STATUS_TABS: { value: 'all' | OrderStatus; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'pending',  label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'sent',     label: 'Sent' },
]

// ─── Glacier status badge ─────────────────────────────────────────────────────

function GlacierStatusBadge({ status }: { status: OrderStatus }) {
  const cfg: Record<OrderStatus, { bg: string; border: string; color: string; icon: React.ReactNode; label: string }> = {
    pending:  { bg: 'rgba(200,160,240,0.15)', border: 'rgba(200,160,240,0.3)',  color: '#c8a0f0', icon: <Clock className="w-3 h-3" />,         label: 'Awaiting Approval' },
    approved: { bg: 'rgba(125,211,252,0.15)', border: 'rgba(125,211,252,0.3)',  color: '#7dd3fc', icon: <CheckCircle className="w-3 h-3" />,    label: 'PO Generated' },
    rejected: { bg: 'rgba(255,107,107,0.15)', border: 'rgba(255,107,107,0.3)',  color: '#ff6b6b', icon: <XCircle className="w-3 h-3" />,        label: 'Rejected' },
    sent:     { bg: 'rgba(136,180,204,0.15)', border: 'rgba(136,180,204,0.3)',  color: '#88b4cc', icon: <Send className="w-3 h-3" />,           label: 'Shipped' },
  }
  const c = cfg[status]
  return (
    <span className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.color }}>
      {c.icon}{c.label}
    </span>
  )
}

// ─── Expandable Order Row ─────────────────────────────────────────────────────

function OrderRow({ order, selected, onSelect }: {
  order: Order
  selected: boolean
  onSelect: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isSelected = selected

  return (
    <>
      {/* Main row — acts as list item like Stitch design */}
      <div
        onClick={onSelect}
        className="cursor-pointer transition-colors"
        style={{
          padding: '1rem',
          borderBottom: isSelected
            ? '1px solid rgba(125,211,252,0.2)'
            : '1px solid rgba(74,96,112,0.3)',
          background: isSelected ? 'rgba(125,211,252,0.05)' : 'transparent',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(20,28,46,0.5)' }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold" style={{ color: isSelected ? '#7dd3fc' : '#e0e8f0' }}>
              {order.id.slice(0, 8).toUpperCase()}
            </span>
            <GlacierStatusBadge status={order.status} />
          </div>
          <span className="text-base font-bold" style={{ color: isSelected ? '#e0e8f0' : '#a0b4c4' }}>
            ${Number(order.total_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
          {isSelected && (
            <span className="material-symbols-outlined text-xl" style={{ color: '#7dd3fc' }}>chevron_right</span>
          )}
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-3 pt-3 grid grid-cols-2 gap-3 text-xs"
            style={{ borderTop: '1px solid rgba(74,96,112,0.3)' }}>
            {[
              { label: 'Order ID', value: order.id },
              { label: 'Part Name', value: order.part_name },
              { label: 'Qty × Unit', value: `${order.quantity.toLocaleString()} × $${Number(order.unit_price).toFixed(4)}` },
              { label: 'Created', value: new Date(order.created_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p style={{ color: '#a0b4c4' }} className="mb-0.5">{label}</p>
                <p style={{ color: '#e0e8f0' }} className="font-mono">{value}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
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
  const [orders, setOrders]         = useState<Order[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab]   = useState<'all' | OrderStatus>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')
    const { data, error } = await supabase
      .from('orders')
      .select('id, mpn, part_name, supplier, quantity, unit_price, total_price, status, created_at')
      .order('created_at', { ascending: false })
    if (error) { setErrorMessage(error.message); setFetchState('error'); return }
    setOrders(data ?? [])
    setFetchState('success')
    // Auto-select first pending
    const firstPending = (data ?? []).find((o: Order) => o.status === 'pending')
    if (firstPending) setSelectedId(firstPending.id)
    else if ((data ?? []).length > 0) setSelectedId((data ?? [])[0].id)
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  const totalValue    = orders.reduce((sum, o) => sum + Number(o.total_price), 0)
  const pendingCount  = orders.filter(o => o.status === 'pending').length
  const sentCount     = orders.filter(o => o.status === 'sent').length
  const isLoading     = fetchState === 'loading'

  const filtered = orders.filter(o => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = o.mpn.toLowerCase().includes(q) || o.supplier.toLowerCase().includes(q)
    const matchesTab = activeTab === 'all' || o.status === activeTab
    return matchesSearch && matchesTab
  })

  const tabCount = (tab: 'all' | OrderStatus) =>
    tab === 'all' ? orders.length : orders.filter(o => o.status === tab).length

  const selectedOrder = orders.find(o => o.id === selectedId) ?? null
  const hasPendingAlert = pendingCount > 0

  return (
    <div className="relative min-h-full flex flex-col gap-6" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ── Ambient glows ── */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute left-1/4 top-0 h-96 w-96 rounded-full blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(125,211,252,0.06), transparent 70%)' }} />
        <div className="absolute bottom-0 right-1/4 h-[500px] w-[500px] rounded-full blur-[150px]"
          style={{ background: 'radial-gradient(circle, rgba(61,32,96,0.2), transparent 70%)' }} />
      </div>

      <div className="relative z-10 flex flex-col gap-6">

        {/* ── Page header ── */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#e0e8f0' }}>
              Orders <span style={{ color: '#7dd3fc' }}>&amp;</span> HITL Approvals
            </h1>
            <p className="mt-1 text-sm" style={{ color: '#a0b4c4' }}>
              Track purchase orders, approvals, and fulfillment status.
            </p>
          </div>
          <button
            onClick={fetchOrders}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all"
            style={{
              background: 'rgba(26,36,56,0.5)',
              border: '1px solid rgba(160,180,196,0.2)',
              color: '#a0b4c4',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,180,196,0.4)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,180,196,0.2)'}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* ── Metric cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Orders',     value: orders.length,   icon: 'shopping_cart',    color: '#7dd3fc' },
            { label: 'Pending Approval', value: pendingCount,    icon: 'pending_actions',  color: '#c8a0f0' },
            { label: 'Sent',             value: sentCount,       icon: 'local_shipping',   color: '#88b4cc' },
            {
              label: 'Total Value',
              value: isLoading ? '—' : `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              icon: 'payments', color: '#7dd3fc',
            },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="flex flex-col gap-3 rounded-xl p-5 transition-colors"
              style={{
                background: 'rgba(15,21,36,0.6)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(125,211,252,0.1)',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(17,24,40,0.5)'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'rgba(15,21,36,0.6)'}
            >
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

        {/* ── High-priority alert banner ── */}
        {hasPendingAlert && !isLoading && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl p-4"
            style={{
              background: 'rgba(61,20,20,0.4)',
              border: '1px solid rgba(255,107,107,0.3)',
              boxShadow: '0 0 30px rgba(255,107,107,0.05)',
            }}>
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
            <button
              onClick={() => setActiveTab('pending')}
              className="rounded-lg px-5 py-2 text-sm font-medium transition-all whitespace-nowrap"
              style={{
                background: 'rgba(26,36,56,0.5)',
                border: '1px solid rgba(160,180,196,0.2)',
                color: '#e0e8f0',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ff6b6b'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,107,0.3)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#e0e8f0'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,180,196,0.2)' }}
            >
              Review Now
            </button>
          </div>
        )}

        {/* ── Main two-column layout ── */}
        <div className="flex flex-col lg:flex-row gap-6 min-h-[600px]">

          {/* ── Left: Active Orders list ── */}
          <div className="w-full lg:w-5/12 xl:w-2/5 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-semibold" style={{ color: '#e0e8f0' }}>Active Orders</h3>
              {/* Filter tabs */}
              <div className="flex gap-1">
                {STATUS_TABS.slice(0, 3).map(tab => (
                  <button key={tab.value} onClick={() => setActiveTab(tab.value)}
                    className="px-2.5 py-1 rounded text-xs font-medium transition-all"
                    style={{
                      background: activeTab === tab.value ? 'rgba(125,211,252,0.15)' : 'transparent',
                      border: activeTab === tab.value ? '1px solid rgba(125,211,252,0.3)' : '1px solid transparent',
                      color: activeTab === tab.value ? '#7dd3fc' : '#a0b4c4',
                    }}>
                    {tab.label}
                    {!isLoading && (
                      <span className="ml-1 opacity-70">{tabCount(tab.value)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Search */}
            <div className="flex items-center gap-2 rounded-full px-4 py-2"
              style={{ background: 'rgba(15,21,36,0.4)', border: '1px solid rgba(125,211,252,0.1)' }}>
              <Search className="w-4 h-4 shrink-0" style={{ color: '#a0b4c4' }} />
              <input
                placeholder="Search orders…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                disabled={isLoading}
                className="bg-transparent text-sm outline-none w-full"
                style={{ color: '#e0e8f0' }}
              />
            </div>

            {/* List panel */}
            <div className="flex-1 flex flex-col overflow-hidden rounded-xl"
              style={{
                background: 'rgba(15,21,36,0.6)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(125,211,252,0.1)',
              }}>

              {/* Loading */}
              {isLoading && (
                <div className="flex items-center justify-center gap-3 py-20" style={{ color: '#a0b4c4' }}>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading orders…</span>
                </div>
              )}

              {/* Error */}
              {fetchState === 'error' && (
                <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
                  <AlertTriangle className="w-8 h-8" style={{ color: '#ff6b6b' }} />
                  <p className="font-medium" style={{ color: '#e0e8f0' }}>Failed to load orders</p>
                  <p className="text-sm" style={{ color: '#a0b4c4' }}>{errorMessage}</p>
                  <button onClick={fetchOrders} className="rounded-lg px-4 py-2 text-sm transition-all"
                    style={{ background: 'rgba(26,36,56,0.5)', border: '1px solid rgba(160,180,196,0.2)', color: '#a0b4c4' }}>
                    Try again
                  </button>
                </div>
              )}

              {/* Empty */}
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

              {/* Orders list */}
              {fetchState === 'success' && orders.length > 0 && (
                <div className="flex-1 overflow-y-auto">
                  {filtered.length === 0 ? (
                    <div className="py-12 text-center text-sm" style={{ color: '#a0b4c4' }}>
                      No orders match your filters.
                    </div>
                  ) : (
                    filtered.map(order => (
                      <OrderRow
                        key={order.id}
                        order={order}
                        selected={selectedId === order.id}
                        onSelect={() => setSelectedId(order.id)}
                      />
                    ))
                  )}
                  <div className="px-4 py-3" style={{ borderTop: '1px solid rgba(74,96,112,0.3)' }}>
                    <button className="w-full py-2 text-sm transition-colors" style={{ color: '#a0b4c4' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#e0e8f0'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#a0b4c4'}>
                      View All Orders
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Document preview & AI audit trail ── */}
          <div className="w-full lg:w-7/12 xl:w-3/5 flex flex-col gap-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#e0e8f0' }}>
                {selectedOrder
                  ? <>Review: {selectedOrder.id.slice(0, 8).toUpperCase()}
                    {selectedOrder.status === 'pending' && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />
                    )}
                  </>
                  : 'Select an order'}
              </h3>
              {selectedOrder && (
                <button className="flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-all"
                  style={{ background: 'rgba(26,36,56,0.5)', border: '1px solid rgba(160,180,196,0.2)', color: '#a0b4c4' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(125,211,252,0.3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,180,196,0.2)'}
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Download PDF
                </button>
              )}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden rounded-xl"
              style={{
                background: 'rgba(15,21,36,0.75)',
                backdropFilter: 'blur(24px)',
                border: '1px solid rgba(125,211,252,0.15)',
              }}>

              {!selectedOrder ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 py-24 px-6 text-center">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(125,211,252,0.08)', border: '1px solid rgba(125,211,252,0.15)' }}>
                    <Package className="w-7 h-7" style={{ color: '#7dd3fc' }} />
                  </div>
                  <p style={{ color: '#a0b4c4' }} className="text-sm">Select an order from the list to review</p>
                </div>
              ) : (
                <>
                  {/* ── PO Document preview ── */}
                  <div className="flex-1 overflow-y-auto p-6 relative"
                    style={{ background: 'rgba(32,44,66,0.3)', borderBottom: '1px solid rgba(74,96,112,0.3)' }}>
                    {/* Subtle glow behind doc */}
                    <div className="absolute inset-x-10 top-10 bottom-10 rounded-2xl blur-2xl pointer-events-none"
                      style={{ background: 'rgba(255,255,255,0.03)' }} />

                    {/* Pseudo PDF */}
                    <div className="relative max-w-2xl mx-auto rounded-lg p-8 font-mono text-sm"
                      style={{
                        background: 'rgba(20,28,46,0.8)',
                        border: '1px solid rgba(74,96,112,0.5)',
                        borderTop: '3px solid #7dd3fc',
                        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
                      }}>
                      {/* PO header */}
                      <div className="flex justify-between items-start mb-6 pb-4"
                        style={{ borderBottom: '1px solid rgba(74,96,112,0.4)' }}>
                        <div>
                          <h4 className="text-xl font-sans font-bold tracking-wider" style={{ color: '#e0e8f0' }}>
                            PURCHASE ORDER
                          </h4>
                          <p className="mt-2 text-xs" style={{ color: '#a0b4c4' }}>
                            {selectedOrder.supplier}<br />
                            Region: Global
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold" style={{ color: '#e0e8f0' }}>
                            PO#: {selectedOrder.id.slice(0, 8).toUpperCase()}
                          </p>
                          <p className="text-xs mt-1" style={{ color: '#a0b4c4' }}>
                            Date: {new Date(selectedOrder.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-xs" style={{ color: '#a0b4c4' }}>Terms: Net 30</p>
                        </div>
                      </div>

                      {/* Line items */}
                      <table className="w-full text-left mb-6">
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(74,96,112,0.4)' }}>
                            {['Item Description', 'Qty', 'Unit Price', 'Total'].map(h => (
                              <th key={h} className="py-2 text-xs font-medium"
                                style={{ color: '#e0e8f0', textAlign: h === 'Total' || h === 'Unit Price' || h === 'Qty' ? 'right' : 'left' }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid rgba(74,96,112,0.2)' }}>
                            <td className="py-3 text-xs" style={{ color: '#a0b4c4' }}>
                              {selectedOrder.part_name}<br />
                              <span className="font-mono" style={{ color: '#7dd3fc' }}>{selectedOrder.mpn}</span>
                            </td>
                            <td className="py-3 text-xs text-right" style={{ color: '#a0b4c4' }}>
                              {selectedOrder.quantity.toLocaleString()}
                            </td>
                            <td className="py-3 text-xs text-right" style={{ color: '#a0b4c4' }}>
                              ${Number(selectedOrder.unit_price).toFixed(4)}
                            </td>
                            <td className="py-3 text-xs text-right font-medium" style={{ color: '#e0e8f0' }}>
                              ${Number(selectedOrder.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot>
                          <tr style={{ borderTop: '2px solid rgba(74,96,112,0.5)' }}>
                            <td colSpan={3} className="py-3 text-right text-xs font-bold" style={{ color: '#e0e8f0' }}>
                              TOTAL AMOUNT:
                            </td>
                            <td className="py-3 text-right text-base font-bold" style={{ color: '#7dd3fc' }}>
                              ${Number(selectedOrder.total_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Pending warning */}
                      {selectedOrder.status === 'pending' && (
                        <div className="flex items-start gap-2 rounded-lg p-3 text-xs"
                          style={{ background: 'rgba(61,20,20,0.3)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b' }}>
                          <span className="material-symbols-outlined text-sm shrink-0">info</span>
                          Amount requires explicit human sign-off before PO is issued.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── AI Audit Trail & Actions ── */}
                  <div className="p-5 flex flex-col gap-4"
                    style={{ background: 'rgba(20,28,46,0.8)' }}>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          background: 'rgba(61,32,96,0.6)',
                          border: '1px solid rgba(200,160,240,0.3)',
                          boxShadow: '0 0 15px rgba(200,160,240,0.15)',
                        }}>
                        <span className="material-symbols-outlined text-sm"
                          style={{ color: '#c8a0f0', fontVariationSettings: "'FILL' 1", fontSize: '16px' }}>smart_toy</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1" style={{ color: '#e0e8f0' }}>AI Audit Trail</p>
                        <p className="text-xs leading-relaxed mb-2" style={{ color: '#a0b4c4' }}>
                          Reviewed PO for <span style={{ color: '#7dd3fc' }}>{selectedOrder.mpn}</span> from{' '}
                          <span style={{ color: '#e0e8f0' }}>{selectedOrder.supplier}</span>.
                          {selectedOrder.status === 'pending'
                            ? ' Flagged for HITL review — awaiting human approval before execution.'
                            : selectedOrder.status === 'approved'
                            ? ' Pricing validated. Contract terms matched. PO approved and generated.'
                            : selectedOrder.status === 'rejected'
                            ? ' Order rejected. No PO was issued.'
                            : ' Order shipped and fulfilled.'
                          }
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <span className="px-2 py-1 rounded text-xs flex items-center gap-1"
                            style={{ background: 'rgba(26,36,56,0.8)', border: '1px solid rgba(74,96,112,0.3)', color: '#88b4cc' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>check_circle</span>
                            Pricing Validated
                          </span>
                          <span className="px-2 py-1 rounded text-xs flex items-center gap-1"
                            style={{ background: 'rgba(26,36,56,0.8)', border: '1px solid rgba(74,96,112,0.3)', color: '#88b4cc' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>check_circle</span>
                            SOC 2 Logged
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Action buttons — only show for pending */}
                    {selectedOrder.status === 'pending' && (
                      <div className="flex gap-3 justify-end pt-3"
                        style={{ borderTop: '1px solid rgba(74,96,112,0.3)' }}>
                        <button className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                          style={{
                            background: 'rgba(26,36,56,0.5)',
                            border: '1px solid rgba(160,180,196,0.2)',
                            color: '#e0e8f0',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#ff6b6b'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,107,107,0.3)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#e0e8f0'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(160,180,196,0.2)' }}
                        >
                          Reject &amp; Escalate
                        </button>
                        <button className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
                          style={{
                            background: 'rgba(125,211,252,0.15)',
                            border: '1px solid rgba(125,211,252,0.3)',
                            color: '#c8eaff',
                          }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.25)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 0 20px rgba(125,211,252,0.1)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(125,211,252,0.15)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
                        >
                          <span className="material-symbols-outlined text-lg">verified</span>
                          Approve &amp; Generate PO
                        </button>
                      </div>
                    )}

                    {/* Non-pending status display */}
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