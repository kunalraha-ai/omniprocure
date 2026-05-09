'use client'

import { useCallback, useRef, useState, useEffect } from 'react'
import {
  Upload, ClipboardList, X, Loader2, Package,
  AlertCircle, ChevronUp, ChevronDown, FileText, ShoppingCart, CheckCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'

interface BomResultRow {
  mpn: string
  part_name: string
  qty: number
  best_supplier: string | null
  price: number | null
  lead_time: string
  stock_status: string
  status: 'sourced' | 'partial' | 'unfound'
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

type BomEvent = {
  type: string
  message?: string
  count?: number
  item?: BomResultRow
  totalItems?: number
  sourced?: number
  partial?: number
  unfound?: number
  estimatedCost?: number
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(1))} ${sizes[i]}`
}

function stockBadgeStyle(status: string) {
  switch (status) {
    case 'In Stock':  return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    case 'Low Stock': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
    case 'Out of Stock': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    default: return 'bg-muted text-muted-foreground'
  }
}

function parseSseChunk(chunk: string): BomEvent | null {
  const line = chunk.split('\n').find((row) => row.startsWith('data:'))
  if (!line) return null
  try {
    return JSON.parse(line.replace(/^data:\s*/, '')) as BomEvent
  } catch {
    return null
  }
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => resolve(event.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

export default function DashboardBomPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [results, setResults] = useState<BomResultRow[]>([])
  const [summary, setSummary] = useState<{
    totalItems: number; sourced: number; partial: number
    unfound: number; estimatedCost: number
  } | null>(null)
  const [streamEvents, setStreamEvents] = useState<string[]>([])
  const [showResults, setShowResults] = useState(true)
  const [lastFilename, setLastFilename] = useState<string>('')
  const [loadingPrevious, setLoadingPrevious] = useState(true)
  // Track which MPNs have been requested as PO (mpn -> 'loading' | 'done' | 'error')
  const [poRequests, setPoRequests] = useState<Record<string, 'loading' | 'done' | 'error'>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isLoading = submitState === 'loading'

  // ── Load last BOM from Supabase on mount ──────────────────────────────────
  useEffect(() => {
    async function loadLastBom() {
      try {
        const { data, error } = await supabase
          .from('bom_uploads')
          .select('filename, line_items, item_count, uploaded_at')
          .order('uploaded_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (error || !data) return

        const items = data.line_items as any[]
        if (!items?.length) return

        const rows: BomResultRow[] = items.map((r: any) => ({
          mpn: r.mpn,
          part_name: r.description ?? r.part_name ?? '',
          qty: r.qty ?? r.quantity ?? 1,
          best_supplier: r.bestSupplier ?? r.best_supplier ?? null,
          price: r.bestPrice ?? r.price ?? null,
          lead_time: r.lead_time ?? '—',
          stock_status: r.stock_status ?? (r.totalInStock > 0 ? 'In Stock' : 'Out of Stock'),
          status: r.status ?? 'unfound',
        }))

        setResults(rows)
        setLastFilename(data.filename)
        setSummary({
          totalItems: data.item_count,
          sourced: rows.filter(r => r.status === 'sourced').length,
          partial: rows.filter(r => r.status === 'partial').length,
          unfound: rows.filter(r => r.status === 'unfound').length,
          estimatedCost: rows.reduce((sum, r) => sum + ((r.price ?? 0) * r.qty), 0),
        })
        setSubmitState('success')
      } catch (e) {
        // Silently fail — fresh state is fine
      } finally {
        setLoadingPrevious(false)
      }
    }
    loadLastBom()
  }, [])

  // ── Request PO for a single row ───────────────────────────────────────────
  async function requestPO(row: BomResultRow) {
    if (!row.best_supplier || row.price == null) return
    setPoRequests(prev => ({ ...prev, [row.mpn]: 'loading' }))
    try {
      const res = await fetch('/api/request-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mpn: row.mpn,
          supplier: row.best_supplier,
          price: row.price,
          currency: 'USD',
          moq: row.qty,
          leadTime: row.lead_time,
          total_value: (row.price ?? 0) * row.qty,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(err)
      }
      setPoRequests(prev => ({ ...prev, [row.mpn]: 'done' }))
    } catch (e) {
      setPoRequests(prev => ({ ...prev, [row.mpn]: 'error' }))
    }
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault(); setIsDragOver(true)
  }, [])
  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault(); setIsDragOver(false)
  }, [])
  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault(); setIsDragOver(false)
    const file = event.dataTransfer.files[0]
    if (file && isValidFile(file)) setSelectedFile(file)
  }, [])

  function isValidFile(file: File) {
    return file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.txt')
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && isValidFile(file)) setSelectedFile(file)
  }

  async function saveMonitoredParts(rows: BomResultRow[]) {
    if (!rows.length) return
    const payload = rows.map((row) => ({
      mpn: row.mpn,
      part_name: row.part_name,
      quantity: row.qty,
      is_active: true,
    }))
    await supabase.from('monitored_parts').upsert(payload, { onConflict: 'mpn', count: 'exact' })
  }

  async function submitBom(raw: string, filename: string) {
    setSubmitState('loading')
    setErrorMessage('')
    setResults([])
    setSummary(null)
    setStreamEvents([])
    setLastFilename(filename)
    setPoRequests({})

    const response = await fetch('/api/bom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw, filename }),
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(text || `Request failed with ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response stream available')

    const decoder = new TextDecoder()
    let buffer = ''
    const collectedResults: BomResultRow[] = []

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const chunks = buffer.split('\n\n')
      buffer = chunks.pop() ?? ''

      for (const chunk of chunks) {
        const event = parseSseChunk(chunk)
        if (!event) continue

        setStreamEvents((prev) => [
          `${new Date().toLocaleTimeString()}: ${event.type}`,
          ...prev.slice(0, 19),
        ])

        if (event.type === 'line_item_result' && event.item) {
          collectedResults.push(event.item)
          setResults((prev) => [...prev, event.item!])
          continue
        }

        if (event.type === 'complete') {
          setSummary({
            totalItems: event.totalItems ?? 0,
            sourced: event.sourced ?? 0,
            partial: event.partial ?? 0,
            unfound: event.unfound ?? 0,
            estimatedCost: event.estimatedCost ?? 0,
          })
          continue
        }

        if (event.type === 'error') {
          throw new Error(event.message ?? 'Unknown error during BOM processing')
        }
      }
    }

    await saveMonitoredParts(collectedResults)
    setSubmitState('success')
  }

  async function handleSubmit(source: 'file' | 'manual') {
    try {
      let raw = ''
      let filename = 'manual-entry'

      if (source === 'file') {
        if (!selectedFile) { setErrorMessage('Please select a CSV file first.'); setSubmitState('error'); return }
        if (!isValidFile(selectedFile)) { setErrorMessage('Only CSV files are supported.'); setSubmitState('error'); return }
        raw = await readFileAsText(selectedFile)
        filename = selectedFile.name
      } else {
        const lines = manualInput.split('\n').map(l => l.trim()).filter(Boolean)
        if (!lines.length) { setErrorMessage('Please enter at least one part number.'); setSubmitState('error'); return }
        raw = lines.join('\n')
      }

      await submitBom(raw, filename)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      setSubmitState('error')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel-elevated rounded-[2rem] border-slate-700/70 p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-primary">
              AI BOM Analyzer
            </span>
            <div>
              <h1 className="text-3xl font-bold text-on-surface">BOM Upload</h1>
              <p className="mt-2 text-sm text-on-surface-variant">
                Upload a BOM or paste part numbers to source suppliers, compare quotes, and save monitored parts automatically.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Current stage</p>
              <p className="mt-3 text-2xl font-semibold text-on-surface">
                {submitState === 'loading' ? 'Analyzing' : submitState === 'success' ? 'Complete' : 'Ready'}
              </p>
            </div>
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Results</p>
              <p className="mt-3 text-2xl font-semibold text-on-surface">
                {loadingPrevious ? '…' : results.length}
              </p>
            </div>
            <div className="glass-panel rounded-3xl p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Saved parts</p>
              <p className="mt-3 text-2xl font-semibold text-on-surface">
                {loadingPrevious ? '…' : results.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">

          {/* Upload panel */}
          <div className="glass-panel rounded-3xl border-slate-700/60 p-6">
            <Tabs defaultValue="file">
              <TabsList className="grid grid-cols-2 gap-2 p-1 rounded-3xl bg-slate-950/70">
                <TabsTrigger value="file" className="gap-2 rounded-3xl">
                  <Upload className="w-4 h-4" /> File Upload
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-2 rounded-3xl">
                  <ClipboardList className="w-4 h-4" /> Manual Entry
                </TabsTrigger>
              </TabsList>

              <TabsContent value="file" className="mt-6">
                <Card className="glass-panel rounded-3xl border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-on-surface flex items-center gap-2">
                      <Upload className="w-4 h-4" /> Upload BOM
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div
                      className={`glass-panel rounded-3xl border-dashed border-slate-600 p-8 text-center transition-all cursor-pointer ${isDragOver ? 'border-primary bg-primary-soft' : 'hover:border-primary/80'}`}
                      onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {selectedFile ? (
                        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                          <FileText className="w-8 h-8 text-primary" />
                          <div className="text-left">
                            <p className="font-medium text-on-surface">{selectedFile.name}</p>
                            <p className="text-sm text-on-surface-variant">{formatFileSize(selectedFile.size)}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="ml-2 h-8 w-8"
                            onClick={e => { e.stopPropagation(); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = '' }}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Upload className="w-10 h-10 text-on-surface-variant mx-auto mb-3" />
                          <p className="font-medium text-on-surface mb-1">Drop your BOM file here</p>
                          <p className="text-sm text-on-surface-variant">CSV only — each line should include one MPN.</p>
                        </>
                      )}
                      <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
                    </div>
                    <Button className="w-full glass-button-primary rounded-3xl py-4 text-sm font-semibold"
                      disabled={!selectedFile || isLoading} onClick={() => handleSubmit('file')}>
                      {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : 'Submit BOM'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="manual" className="mt-6">
                <Card className="glass-panel rounded-3xl border-slate-700/50">
                  <CardHeader>
                    <CardTitle className="text-base font-semibold text-on-surface flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" /> Manual Part Numbers
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-on-surface block">Part numbers</label>
                      <Textarea
                        placeholder={'Enter one MPN per line, e.g.:\nATMEGA328P-PU\nSTM32F103C8T6\nLM358P'}
                        className="glass-input min-h-[160px] w-full rounded-3xl px-4 py-3 font-mono text-sm text-on-surface resize-none"
                        value={manualInput}
                        onChange={e => setManualInput(e.target.value)}
                        disabled={isLoading}
                      />
                      <p className="text-xs text-on-surface-variant">
                        {manualInput.split('\n').filter(l => l.trim()).length} part number(s) entered
                      </p>
                    </div>
                    <Button className="w-full glass-button-primary rounded-3xl py-4 text-sm font-semibold"
                      disabled={!manualInput.trim() || isLoading} onClick={() => handleSubmit('manual')}>
                      {isLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing…</> : 'Submit Part Numbers'}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Error */}
          {submitState === 'error' && (
            <Card className="glass-panel rounded-3xl border-red-500/20 bg-red-500/10">
              <CardContent className="flex items-start gap-3 py-4">
                <AlertCircle className="w-5 h-5 text-red-300 mt-0.5" />
                <div>
                  <p className="font-medium text-on-surface">Processing failed</p>
                  <p className="text-sm text-on-surface-variant mt-1">{errorMessage}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results */}
          {results.length > 0 && (
            <Card className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-3 py-4 px-6 border-b border-slate-700/70">
                <CardTitle className="flex items-center gap-2 text-base font-semibold text-on-surface">
                  <Package className="w-4 h-4" />
                  Procurement Results
                  <Badge variant="secondary" className="ml-1">{results.length}</Badge>
                  {lastFilename && (
                    <span className="text-xs text-on-surface-variant font-normal ml-1">— {lastFilename}</span>
                  )}
                </CardTitle>
                <Button variant="ghost" size="sm" className="gap-1 text-on-surface-variant"
                  onClick={() => setShowResults(v => !v)}>
                  {showResults ? <><ChevronUp className="w-4 h-4" />Hide</> : <><ChevronDown className="w-4 h-4" />Show</>}
                </Button>
              </CardHeader>
              {showResults && (
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-950/80">
                          <TableHead>MPN</TableHead>
                          <TableHead>Part Name</TableHead>
                          <TableHead>Best Supplier</TableHead>
                          <TableHead>Unit Price</TableHead>
                          <TableHead>Lead Time</TableHead>
                          <TableHead>Stock</TableHead>
                          <TableHead>Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map((row, index) => {
                          const poState = poRequests[row.mpn]
                          const canRequest = row.best_supplier && row.price != null && !poState
                          return (
                            <TableRow key={`${row.mpn}-${index}`}>
                              <TableCell className="font-mono text-sm font-medium text-on-surface">{row.mpn}</TableCell>
                              <TableCell className="text-on-surface">{row.part_name}</TableCell>
                              <TableCell className="text-on-surface-variant">{row.best_supplier ?? '—'}</TableCell>
                              <TableCell className="text-on-surface">{row.price != null ? `$${row.price.toFixed(4)}` : '—'}</TableCell>
                              <TableCell className="text-on-surface-variant">{row.lead_time || '—'}</TableCell>
                              <TableCell>
                                <Badge className={stockBadgeStyle(row.stock_status)}>{row.stock_status}</Badge>
                              </TableCell>
                              <TableCell>
                                {poState === 'done' ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                    <CheckCircle className="w-3.5 h-3.5" /> Requested
                                  </span>
                                ) : poState === 'error' ? (
                                  <button onClick={() => requestPO(row)}
                                    className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300 transition-colors">
                                    <AlertCircle className="w-3.5 h-3.5" /> Retry
                                  </button>
                                ) : (
                                  <button
                                    disabled={!canRequest || poState === 'loading'}
                                    onClick={() => requestPO(row)}
                                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                                    style={{
                                      background: 'rgba(125,211,252,0.12)',
                                      border: '1px solid rgba(125,211,252,0.25)',
                                      color: '#7dd3fc',
                                    }}
                                  >
                                    {poState === 'loading'
                                      ? <><Loader2 className="w-3 h-3 animate-spin" />Requesting…</>
                                      : <><ShoppingCart className="w-3 h-3" />Request PO</>
                                    }
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <div className="glass-panel rounded-3xl border-slate-700/60 p-6">
            <h2 className="text-base font-semibold text-on-surface">Progress Summary</h2>
            <div className="mt-4 grid gap-3">
              {[
                { label: 'Parts found',      value: loadingPrevious ? '…' : (summary?.totalItems ?? 0) },
                { label: 'Supplier matches', value: loadingPrevious ? '…' : (summary?.sourced ?? 0) },
                { label: 'Estimated cost',   value: loadingPrevious ? '…' : `$${(summary?.estimatedCost ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-3xl border border-slate-700/80 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">{label}</p>
                  <p className="mt-2 text-3xl font-semibold text-on-surface">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-3xl border-slate-700/60 p-6">
            <h2 className="text-base font-semibold text-on-surface">Live events</h2>
            <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
              {streamEvents.length === 0 ? (
                <div className="rounded-3xl border border-slate-700/80 bg-slate-950/60 p-4 text-sm text-on-surface-variant">
                  {loadingPrevious ? 'Loading previous results…' : 'Waiting for import events to appear.'}
                </div>
              ) : (
                streamEvents.map((event, index) => (
                  <div key={`${event}-${index}`} className="rounded-3xl border border-slate-700/80 bg-slate-950/60 px-4 py-3 text-xs text-on-surface-variant">
                    {event}
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}