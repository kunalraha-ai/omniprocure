'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart, Clock, CheckCircle, XCircle, DollarSign,
  RefreshCw, Search, Loader2, AlertTriangle, ChevronDown,
  ChevronUp, Package, Send
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
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
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'sent', label: 'Sent' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending:  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
    sent:     'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  }
  const icons: Record<OrderStatus, React.ReactNode> = {
    pending:  <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
    sent:     <Send className="w-3 h-3" />,
  }
  const labels: Record<OrderStatus, string> = {
    pending: 'Pending', approved: 'Approved', rejected: 'Rejected', sent: 'Sent',
  }
  return (
    <Badge className={`gap-1 ${styles[status] ?? 'bg-slate-900/60 text-on-surface-variant'}`}>
      {icons[status]}
      {labels[status] ?? status}
    </Badge>
  )
}

// ─── Expandable Row ───────────────────────────────────────────────────────────

function OrderRow({ order }: { order: Order }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <TableRow className="group">
        <TableCell className="font-mono text-sm font-medium text-on-surface">{order.mpn}</TableCell>
        <TableCell className="text-on-surface">{order.part_name}</TableCell>
        <TableCell className="text-on-surface-variant">{order.supplier}</TableCell>
        <TableCell className="text-on-surface-variant">{order.quantity.toLocaleString()}</TableCell>
        <TableCell className="text-on-surface-variant">${Number(order.unit_price).toFixed(4)}</TableCell>
        <TableCell className="font-medium text-on-surface">${Number(order.total_price).toFixed(2)}</TableCell>
        <TableCell><StatusBadge status={order.status} /></TableCell>
        <TableCell className="text-on-surface-variant text-sm">
          {new Date(order.created_at).toLocaleDateString(undefined, {
            year: 'numeric', month: 'short', day: 'numeric'
          })}
        </TableCell>
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 text-xs"
            onClick={() => setExpanded(v => !v)}
          >
            {expanded ? (
              <><ChevronUp className="w-3 h-3" /> Hide</>
            ) : (
              <><ChevronDown className="w-3 h-3" /> Details</>
            )}
          </Button>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-slate-950/50 hover:bg-slate-950/70">
          <TableCell colSpan={9} className="py-4 px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs font-medium text-on-surface-variant mb-0.5">Order ID</p>
                <p className="font-mono text-on-surface">{order.id}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant mb-0.5">Part Name</p>
                <p className="text-on-surface">{order.part_name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant mb-0.5">Quantity × Unit Price</p>
                <p className="text-on-surface">
                  {order.quantity.toLocaleString()} × ${Number(order.unit_price).toFixed(4)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant mb-0.5">Created</p>
                <p className="text-on-surface">
                  {new Date(order.created_at).toLocaleString(undefined, {
                    dateStyle: 'medium', timeStyle: 'short'
                  })}
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | OrderStatus>('all')

  const fetchOrders = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')

    const { data, error } = await supabase
      .from('orders')
      .select('id, mpn, part_name, supplier, quantity, unit_price, total_price, status, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setFetchState('error')
      return
    }

    setOrders(data ?? [])
    setFetchState('success')
  }, [])

  useEffect(() => { fetchOrders() }, [fetchOrders])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const totalValue = orders.reduce((sum, o) => sum + Number(o.total_price), 0)
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const sentCount = orders.filter(o => o.status === 'sent').length

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = orders.filter(o => {
    const q = searchTerm.toLowerCase()
    const matchesSearch = o.mpn.toLowerCase().includes(q) || o.supplier.toLowerCase().includes(q)
    const matchesTab = activeTab === 'all' || o.status === activeTab
    return matchesSearch && matchesTab
  })

  const tabCount = (tab: 'all' | OrderStatus) =>
    tab === 'all' ? orders.length : orders.filter(o => o.status === tab).length

  const isLoading = fetchState === 'loading'

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-on-surface">Orders</h1>
          <p className="text-on-surface-variant">
            Track purchase orders, approvals, and fulfillment status.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrders}
          disabled={isLoading}
          className="self-start sm:self-auto gap-2 glass-button-secondary rounded-3xl"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="glass-panel-elevated rounded-3xl border-slate-700/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/70">
                <ShoppingCart className="w-4 h-4 text-on-surface" />
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Total Orders</p>
                <p className="text-2xl font-bold text-on-surface">
                  {isLoading ? '—' : orders.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel-elevated rounded-3xl border-slate-700/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/70">
                <Clock className="w-4 h-4 text-on-surface" />
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Pending Approval</p>
                <p className="text-2xl font-bold text-on-surface">
                  {isLoading ? '—' : pendingCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel-elevated rounded-3xl border-slate-700/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/70">
                <Package className="w-4 h-4 text-on-surface" />
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Sent</p>
                <p className="text-2xl font-bold text-on-surface">
                  {isLoading ? '—' : sentCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel-elevated rounded-3xl border-slate-700/70">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950/70">
                <DollarSign className="w-4 h-4 text-on-surface" />
              </div>
              <div>
                <p className="text-xs font-medium text-on-surface-variant">Total Value</p>
                <p className="text-2xl font-bold text-on-surface">
                  {isLoading ? '—' : `$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Filter Tabs + Search ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_TABS.map(tab => {
            const count = tabCount(tab.value)
            const isActive = activeTab === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                disabled={isLoading}
                className={`
                  inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium
                  transition-colors border
                  ${isActive
                    ? 'bg-slate-900/80 text-on-surface border-slate-700/80'
                    : 'bg-white/5 text-on-surface-variant border-slate-700/50 hover:text-on-surface hover:border-slate-500/60'
                  }
                `}
              >
                {tab.label}
                <span className={`
                  text-xs px-1.5 py-0.5 rounded-full font-mono
                  ${isActive ? 'bg-slate-950/70' : 'bg-slate-800/50'}
                `}>
                  {isLoading ? '—' : count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant pointer-events-none" />
          <Input
            placeholder="Search MPN or supplier…"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 rounded-3xl glass-input"
            disabled={isLoading}
          />
        </div>
      </div>

      {/* ── Table Card ── */}
      <Card className="glass-panel-elevated rounded-3xl border-slate-700/70 overflow-hidden">
        <CardHeader className="border-b border-slate-700/75 pb-3 px-6 py-4">
          <CardTitle className="text-base font-semibold text-on-surface">Purchase Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center gap-3 py-16 text-on-surface-variant">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading orders…</span>
            </div>
          )}

          {/* Error */}
          {fetchState === 'error' && (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <p className="font-medium text-on-surface">Failed to load orders</p>
              <p className="text-sm text-on-surface-variant">{errorMessage}</p>
              <Button variant="outline" size="sm" className="glass-button-secondary rounded-3xl" onClick={fetchOrders}>Try again</Button>
            </div>
          )}

          {/* Empty */}
          {fetchState === 'success' && orders.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950/70">
                <ShoppingCart className="w-6 h-6 text-on-surface-variant" />
              </div>
              <p className="font-medium text-on-surface">No orders yet.</p>
              <p className="text-sm text-on-surface-variant max-w-sm">
                Upload a BOM and approve a quote to generate your first PO.
              </p>
            </div>
          )}

          {/* Table */}
          {fetchState === 'success' && orders.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-950/80">
                    <TableHead>MPN</TableHead>
                    <TableHead>Part Name</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Total Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date Created</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-on-surface-variant text-sm">
                        No orders match your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(order => <OrderRow key={order.id} order={order} />)
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}