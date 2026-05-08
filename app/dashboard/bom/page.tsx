'use client'

import { useState, useCallback, useRef } from 'react'
import {
  Upload, FileText, X, CheckCircle, AlertCircle,
  Loader2, Package, ClipboardList, ChevronDown, ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BomResultRow {
  mpn: string
  part_name: string
  best_supplier: string
  price: number | null
  lead_time: string
  stock_status: 'In Stock' | 'Low Stock' | 'Out of Stock' | string
  quantity?: number
}

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function stockBadgeStyle(status: string) {
  switch (status) {
    case 'In Stock':
      return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    case 'Low Stock':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
    case 'Out of Stock':
      return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target?.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}

async function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      // Strip data URL prefix
      resolve(result.split(',')[1])
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardBomPage() {
  // File upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Manual input state
  const [manualInput, setManualInput] = useState('')

  // Submission state
  const [submitState, setSubmitState] = useState<SubmitState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [results, setResults] = useState<BomResultRow[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [showResults, setShowResults] = useState(true)

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && isValidFile(file)) setSelectedFile(file)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && isValidFile(file)) setSelectedFile(file)
  }

  function isValidFile(file: File) {
    return (
      file.type === 'text/csv' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.name.endsWith('.csv') ||
      file.name.endsWith('.xlsx') ||
      file.name.endsWith('.xls')
    )
  }

  // ── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit(source: 'file' | 'manual') {
    setSubmitState('loading')
    setErrorMessage('')
    setResults([])
    setSavedCount(0)

    try {
      let payload: Record<string, unknown>

      if (source === 'file' && selectedFile) {
        const isExcel =
          selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')

        if (isExcel) {
          const base64 = await readFileAsBase64(selectedFile)
          payload = {
            source: 'file',
            filename: selectedFile.name,
            file_type: 'excel',
            file_base64: base64,
          }
        } else {
          const text = await readFileAsText(selectedFile)
          payload = {
            source: 'file',
            filename: selectedFile.name,
            file_type: 'csv',
            file_content: text,
          }
        }
      } else if (source === 'manual') {
        const lines = manualInput
          .split('\n')
          .map(l => l.trim())
          .filter(Boolean)

        if (lines.length === 0) {
          setErrorMessage('Please enter at least one part number.')
          setSubmitState('error')
          return
        }

        payload = {
          source: 'manual',
          part_numbers: lines,
        }
      } else {
        setErrorMessage('No input provided.')
        setSubmitState('error')
        return
      }

      const webhookUrl = process.env.NEXT_PUBLIC_N8N_BOM_WEBHOOK
      if (!webhookUrl) throw new Error('Webhook URL is not configured.')

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Webhook returned ${response.status}: ${text}`)
      }

      const data: BomResultRow[] = await response.json()

      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No results returned from the webhook.')
      }

      setResults(data)

      // ── Save to Supabase ──────────────────────────────────────────────────
      const rows = data.map(row => ({
        mpn: row.mpn,
        part_name: row.part_name,
        quantity: row.quantity ?? 1,
        is_active: true,
      }))

      const { error: dbError, count } = await supabase
        .from('monitored_parts')
        .upsert(rows, { onConflict: 'mpn', count: 'exact' })

      if (dbError) throw new Error(`Supabase error: ${dbError.message}`)

      setSavedCount(count ?? rows.length)
      setSubmitState('success')
      setShowResults(true)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unknown error occurred.'
      setErrorMessage(msg)
      setSubmitState('error')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isLoading = submitState === 'loading'

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-foreground">BOM Upload</h1>
        <p className="text-muted-foreground">
          Upload a bill of materials or paste part numbers to run procurement analysis.
        </p>
      </div>

      {/* ── Input Section ── */}
      <Tabs defaultValue="file">
        <TabsList>
          <TabsTrigger value="file" className="gap-2">
            <Upload className="w-4 h-4" />
            File Upload
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2">
            <ClipboardList className="w-4 h-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        {/* File Upload Tab */}
        <TabsContent value="file" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Upload className="w-4 h-4" />
                Upload BOM File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="w-8 h-8 text-primary" />
                    <div className="text-left">
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatFileSize(selectedFile.size)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2 h-8 w-8 shrink-0"
                      onClick={e => {
                        e.stopPropagation()
                        setSelectedFile(null)
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                    <p className="font-medium text-foreground mb-1">
                      Drop your BOM file here
                    </p>
                    <p className="text-sm text-muted-foreground">
                      CSV, Excel (.xlsx, .xls) — up to 10 MB
                    </p>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              <Button
                className="w-full"
                disabled={!selectedFile || isLoading}
                onClick={() => handleSubmit('file')}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  'Submit BOM'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry Tab */}
        <TabsContent value="manual" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ClipboardList className="w-4 h-4" />
                Manual Part Number Entry
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">
                  Part Numbers
                </label>
                <Textarea
                  placeholder={"Enter one MPN per line, e.g.:\nATMEGA328P-PU\nSTM32F103C8T6\nLM358P"}
                  className="min-h-[160px] font-mono text-sm resize-none"
                  value={manualInput}
                  onChange={e => setManualInput(e.target.value)}
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {manualInput.split('\n').filter(l => l.trim()).length} part number(s) entered
                </p>
              </div>

              <Button
                className="w-full"
                disabled={!manualInput.trim() || isLoading}
                onClick={() => handleSubmit('manual')}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing…
                  </>
                ) : (
                  'Submit Part Numbers'
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Loading Banner ── */}
      {isLoading && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-primary shrink-0" />
            <div>
              <p className="font-medium text-foreground">Analyzing your BOM…</p>
              <p className="text-sm text-muted-foreground">
                Querying suppliers and checking stock. This may take a moment.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Error Banner ── */}
      {submitState === 'error' && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-destructive">Processing failed</p>
              <p className="text-sm text-muted-foreground mt-0.5">{errorMessage}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Success Banner ── */}
      {submitState === 'success' && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="flex items-center gap-3 py-4">
            <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
            <div>
              <p className="font-medium text-foreground">
                Analysis complete — {results.length} part{results.length !== 1 ? 's' : ''} found
              </p>
              <p className="text-sm text-muted-foreground">
                {savedCount} part{savedCount !== 1 ? 's' : ''} saved to monitored parts.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Results Table ── */}
      {results.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Package className="w-4 h-4" />
              Procurement Results
              <Badge variant="secondary" className="ml-1">{results.length}</Badge>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => setShowResults(v => !v)}
            >
              {showResults ? (
                <><ChevronUp className="w-4 h-4" /> Hide</>
              ) : (
                <><ChevronDown className="w-4 h-4" /> Show</>
              )}
            </Button>
          </CardHeader>

          {showResults && (
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MPN</TableHead>
                      <TableHead>Part Name</TableHead>
                      <TableHead>Best Supplier</TableHead>
                      <TableHead>Unit Price</TableHead>
                      <TableHead>Lead Time</TableHead>
                      <TableHead>Stock</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((row, i) => (
                      <TableRow key={row.mpn + i}>
                        <TableCell className="font-mono text-sm font-medium">
                          {row.mpn}
                        </TableCell>
                        <TableCell className="text-foreground">{row.part_name}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.best_supplier}
                        </TableCell>
                        <TableCell>
                          {row.price != null
                            ? `$${Number(row.price).toFixed(4)}`
                            : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.lead_time || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge className={stockBadgeStyle(row.stock_status)}>
                            {row.stock_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  )
}