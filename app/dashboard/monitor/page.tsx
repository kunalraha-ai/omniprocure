'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Eye, AlertTriangle, Package, RefreshCw, Trash2,
  Loader2, Search, ToggleLeft, ToggleRight, Upload
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonitoredPart {
  id: string
  mpn: string
  part_name: string
  quantity: number
  is_active: boolean
  created_at: string
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardMonitorPage() {
  const [parts, setParts] = useState<MonitoredPart[]>([])
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchParts = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')

    const { data, error } = await supabase
      .from('monitored_parts')
      .select('id, mpn, part_name, quantity, is_active, created_at')
      .order('created_at', { ascending: false })

    if (error) {
      setErrorMessage(error.message)
      setFetchState('error')
      return
    }

    setParts(data ?? [])
    setFetchState('success')
  }, [])

  useEffect(() => { fetchParts() }, [fetchParts])

  // ── Toggle is_active ───────────────────────────────────────────────────────

  async function toggleActive(part: MonitoredPart) {
    setTogglingId(part.id)
    const { error } = await supabase
      .from('monitored_parts')
      .update({ is_active: !part.is_active })
      .eq('id', part.id)

    if (!error) {
      setParts(prev =>
        prev.map(p => p.id === part.id ? { ...p, is_active: !p.is_active } : p)
      )
    }
    setTogglingId(null)
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function deletePart(id: string) {
    setDeletingId(id)
    const { error } = await supabase
      .from('monitored_parts')
      .delete()
      .eq('id', id)

    if (!error) {
      setParts(prev => prev.filter(p => p.id !== id))
    }
    setDeletingId(null)
  }

  // ── Filter ─────────────────────────────────────────────────────────────────

  const filtered = parts.filter(p => {
    const q = searchTerm.toLowerCase()
    return (
      p.mpn.toLowerCase().includes(q) ||
      p.part_name.toLowerCase().includes(q)
    )
  })

  const activeCount = parts.filter(p => p.is_active).length
  const inactiveCount = parts.length - activeCount

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLoading = fetchState === 'loading'

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Monitor Components</h1>
          <p className="text-muted-foreground">
            Track pricing, stock, and lead time for your monitored parts.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchParts}
          disabled={isLoading}
          className="self-start sm:self-auto gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Parts</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '—' : parts.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Package className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '—' : activeCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">Inactive</p>
                <p className="text-2xl font-bold text-foreground">
                  {isLoading ? '—' : inactiveCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Search ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by MPN or part name…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className="pl-9"
          disabled={isLoading}
        />
      </div>

      {/* ── Main Card ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Monitored Parts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">

          {/* Loading */}
          {isLoading && (
            <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading monitored parts…</span>
            </div>
          )}

          {/* Error */}
          {fetchState === 'error' && (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
              <p className="font-medium text-foreground">Failed to load parts</p>
              <p className="text-sm text-muted-foreground">{errorMessage}</p>
              <Button variant="outline" size="sm" onClick={fetchParts}>
                Try again
              </Button>
            </div>
          )}

          {/* Empty state */}
          {fetchState === 'success' && parts.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
              <div className="p-3 bg-muted rounded-full">
                <Package className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground">
                No components being monitored yet.
              </p>
              <p className="text-sm text-muted-foreground">
                Upload a BOM to get started.
              </p>
              <Button asChild size="sm" className="mt-1 gap-2">
                <Link href="/dashboard/bom">
                  <Upload className="w-4 h-4" />
                  Upload a BOM
                </Link>
              </Button>
            </div>
          )}

          {/* Table */}
          {fetchState === 'success' && parts.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>MPN</TableHead>
                    <TableHead>Part Name</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Date Added</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-16 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                        No parts match "{searchTerm}"
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map(part => (
                      <TableRow key={part.id} className={!part.is_active ? 'opacity-50' : ''}>
                        <TableCell className="font-mono text-sm font-medium">
                          {part.mpn}
                        </TableCell>
                        <TableCell className="text-foreground">{part.part_name}</TableCell>
                        <TableCell className="text-muted-foreground">{part.quantity}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(part.created_at).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric'
                          })}
                        </TableCell>
                        <TableCell>
                          {part.is_active ? (
                            <Badge className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {/* Toggle */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              disabled={togglingId === part.id}
                              onClick={() => toggleActive(part)}
                              title={part.is_active ? 'Deactivate' : 'Activate'}
                            >
                              {togglingId === part.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : part.is_active ? (
                                <ToggleRight className="w-4 h-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                              )}
                            </Button>

                            {/* Delete */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 hover:text-destructive"
                                  disabled={deletingId === part.id}
                                  title="Delete"
                                >
                                  {deletingId === part.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4" />
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Remove part?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    <span className="font-mono font-medium">{part.mpn}</span> will be
                                    removed from your monitored parts. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={() => deletePart(part.id)}
                                  >
                                    Remove
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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