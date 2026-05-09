'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User, Bell, Shield, Save, Lock, ExternalLink,
  Loader2, AlertTriangle, CheckCircle, Send, Trash2,
  RefreshCw, Package
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type Tier = 'free' | 'paid'

interface UserSettings {
  id: string
  email: string
  tier: Tier
  monitoring_frequency: string
  slack_webhook: string | null
  alert_email: string | null
  preferred_suppliers: string[]
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'

const ALL_SUPPLIERS = ['Mouser', 'DigiKey', 'LCSC', 'Avnet', 'Firewall'] as const

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastMsg { type: 'success' | 'error'; text: string }

function Toast({ toast, onDismiss }: { toast: ToastMsg; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium transition-all
        ${toast.type === 'success'
          ? 'glass-panel border-green-500/30 text-on-surface'
          : 'glass-panel border-red-500/30 text-on-surface'
        }`}
    >
      {toast.type === 'success'
        ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
        : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
      }
      {toast.text}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon, title, children
}: {
  icon: React.ElementType; title: string; children: React.ReactNode
}) {
  return (
    <div className="glass-panel rounded-3xl border-slate-700/60 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-5 border-b border-slate-700/70">
        <Icon className="w-4 h-4 text-on-surface-variant" />
        <h2 className="text-base font-semibold text-on-surface">{title}</h2>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardSettingsPage() {
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMsg | null>(null)

  const [slackEnabled, setSlackEnabled] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [testingSlack, setTestingSlack] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)

  const [clearingParts, setClearingParts] = useState(false)
  const [clearingAlerts, setClearingAlerts] = useState(false)

  // ── Fetch ────────────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    setFetchState('loading')
    setErrorMessage('')

    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user?.id) {
      setErrorMessage('Could not load your session. Please refresh the page or sign in again.')
      setFetchState('error')
      return
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, tier, monitoring_frequency, slack_webhook, alert_email, preferred_suppliers')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      setErrorMessage(error.message)
      setFetchState('error')
      return
    }

    if (!data) {
      const defaults: UserSettings = {
        id: user.id,
        email: user.email ?? '',
        tier: 'free',
        monitoring_frequency: '24h',
        slack_webhook: null,
        alert_email: null,
        preferred_suppliers: [],
      }
      setSettings(defaults)
      setSlackEnabled(false)
      setEmailEnabled(false)
      setFetchState('success')
      return
    }

    const row = data as UserSettings
    setSettings(row)
    setSlackEnabled(!!row.slack_webhook)
    setEmailEnabled(!!row.alert_email)
    setFetchState('success')
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  // ── Field helpers ────────────────────────────────────────────────────────

  function updateField<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  function toggleSupplier(supplier: string) {
    if (!settings) return
    const current = settings.preferred_suppliers ?? []
    const next = current.includes(supplier)
      ? current.filter(s => s !== supplier)
      : [...current, supplier]
    updateField('preferred_suppliers', next)
  }

  // ── Save ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!settings) return
    setSaving(true)

    const patch = {
      monitoring_frequency: settings.monitoring_frequency,
      slack_webhook: slackEnabled ? settings.slack_webhook : null,
      alert_email: emailEnabled ? settings.alert_email : null,
      preferred_suppliers: settings.preferred_suppliers,
    }

    const { error } = await supabase
      .from('users')
      .update(patch)
      .eq('id', settings.id)

    setSaving(false)
    if (error) {
      setToast({ type: 'error', text: `Save failed: ${error.message}` })
    } else {
      setToast({ type: 'success', text: 'Settings saved successfully.' })
    }
  }

  // ── Test notifications ───────────────────────────────────────────────────

  async function testSlack() {
    if (!settings?.slack_webhook) return
    setTestingSlack(true)
    try {
      await fetch(settings.slack_webhook, {
        method: 'POST',
        body: JSON.stringify({ text: '✅ OmniProcure test message — Slack integration is working!' }),
      })
      setToast({ type: 'success', text: 'Test Slack message sent.' })
    } catch {
      setToast({ type: 'error', text: 'Failed to send test Slack message.' })
    }
    setTestingSlack(false)
  }

  async function testEmail() {
    if (!settings?.alert_email) return
    setTestingEmail(true)
    try {
      const response = await fetch('/api/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: settings.alert_email }),
      })
      if (!response.ok) {
        const body = await response.json()
        throw new Error(body?.error || 'Email test failed')
      }
      setToast({ type: 'success', text: `Test email sent to ${settings.alert_email}.` })
    } catch (error) {
      setToast({ type: 'error', text: error instanceof Error ? error.message : 'Test email failed.' })
    }
    setTestingEmail(false)
  }

  // ── Danger zone ──────────────────────────────────────────────────────────

  async function clearMonitoredParts() {
    if (!settings) return
    setClearingParts(true)
    const { error } = await supabase.from('monitored_parts').delete().neq('id', '')
    setClearingParts(false)
    if (error) {
      setToast({ type: 'error', text: `Failed: ${error.message}` })
    } else {
      setToast({ type: 'success', text: 'All monitored parts cleared.' })
    }
  }

  async function clearAlerts() {
    if (!settings) return
    setClearingAlerts(true)
    const { error } = await supabase.from('alerts').delete().neq('id', '')
    setClearingAlerts(false)
    if (error) {
      setToast({ type: 'error', text: `Failed: ${error.message}` })
    } else {
      setToast({ type: 'success', text: 'All alerts cleared.' })
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const isPaid = settings?.tier === 'paid'

  if (fetchState === 'loading') {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-on-surface-variant">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Loading settings…</span>
      </div>
    )
  }

  if (fetchState === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="font-medium text-on-surface">Failed to load settings</p>
        <p className="text-sm text-on-surface-variant">{errorMessage}</p>
        <Button variant="outline" size="sm" onClick={fetchSettings} className="gap-2 mt-1">
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div className="space-y-6 max-w-2xl">

      {/* Header */}
      <div className="glass-panel-elevated rounded-[2rem] border-slate-700/70 p-8">
        <h1 className="text-3xl font-bold text-on-surface mb-1">Settings</h1>
        <p className="text-on-surface-variant">Manage your account, notifications, and integrations.</p>
      </div>

      {/* Account */}
      <Section icon={User} title="Account">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Email</Label>
          <p className="text-on-surface font-medium">{settings.email}</p>
        </div>

        <Separator className="border-slate-700/70" />

        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Account tier</Label>
            <div className="mt-2">
              {isPaid ? (
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/15 text-indigo-300">
                  Founding Member — $99/mo
                </span>
              ) : (
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-slate-700/50 text-on-surface-variant">
                  Free Trial
                </span>
              )}
            </div>
          </div>
          {!isPaid && (
            <Button asChild size="sm" className="gap-2 shrink-0 glass-button-primary rounded-2xl">
              <a href={process.env.NEXT_PUBLIC_STRIPE_LINK ?? '#'} target="_blank" rel="noopener noreferrer">
                Upgrade <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
        </div>

        <Separator className="border-slate-700/70" />

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-[0.24em] text-on-surface-variant">Monitoring Frequency</Label>
          <div className="flex flex-col gap-2 mt-2">
            {[
              { value: '24h', label: '24 hours', sublabel: 'Current plan', available: true },
              { value: '6h',  label: '6 hours',  sublabel: 'Founding Member only', available: isPaid },
            ].map(opt => (
              <button
                key={opt.value}
                disabled={!opt.available}
                onClick={() => opt.available && updateField('monitoring_frequency', opt.value)}
                className={`
                  flex items-center justify-between px-4 py-3 rounded-2xl border text-left transition-colors text-sm
                  ${settings.monitoring_frequency === opt.value
                    ? 'border-primary/60 bg-primary-soft text-on-surface'
                    : 'border-slate-700/60 hover:border-slate-600/80 text-on-surface-variant'
                  }
                  ${!opt.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div>
                  <span className="font-medium text-on-surface">{opt.label}</span>
                  <span className="ml-2 text-xs text-on-surface-variant">{opt.sublabel}</span>
                </div>
                <div className="flex items-center gap-2">
                  {!opt.available && <Lock className="w-3.5 h-3.5 text-on-surface-variant" />}
                  {settings.monitoring_frequency === opt.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Notifications */}
      <Section icon={Bell} title="Notifications">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-on-surface">Slack Webhook</Label>
              <p className="text-xs text-on-surface-variant mt-0.5">Post alerts to a Slack channel</p>
            </div>
            <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
          </div>
          {slackEnabled && (
            <div className="flex gap-2">
              <Input
                placeholder="https://hooks.slack.com/services/…"
                value={settings.slack_webhook ?? ''}
                onChange={e => updateField('slack_webhook', e.target.value)}
                className="glass-input rounded-2xl font-mono text-sm text-on-surface"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 rounded-2xl border-slate-700/60"
                disabled={!settings.slack_webhook || testingSlack}
                onClick={testSlack}
              >
                {testingSlack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Test
              </Button>
            </div>
          )}
        </div>

        <Separator className="border-slate-700/70" />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium text-on-surface">Alert Email</Label>
              <p className="text-xs text-on-surface-variant mt-0.5">Receive alerts by email</p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>
          {emailEnabled && (
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="alerts@yourcompany.com"
                value={settings.alert_email ?? ''}
                onChange={e => updateField('alert_email', e.target.value)}
                className="glass-input rounded-2xl text-on-surface"
              />
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 rounded-2xl border-slate-700/60"
                disabled={!settings.alert_email || testingEmail}
                onClick={testEmail}
              >
                {testingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Test
              </Button>
            </div>
          )}
        </div>
      </Section>

      {/* Suppliers */}
      <Section icon={Package} title="Preferred Suppliers">
        <p className="text-sm text-on-surface-variant -mt-1">
          OmniProcure will prioritise these suppliers when sourcing quotes.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ALL_SUPPLIERS.map(supplier => {
            const checked = (settings.preferred_suppliers ?? []).includes(supplier)
            return (
              <button
                key={supplier}
                onClick={() => toggleSupplier(supplier)}
                className={`
                  flex items-center gap-2.5 px-3 py-2.5 rounded-2xl border text-sm transition-colors text-left
                  ${checked
                    ? 'border-primary/60 bg-primary-soft text-on-surface font-medium'
                    : 'border-slate-700/60 text-on-surface-variant hover:border-slate-600/80 hover:text-on-surface'
                  }
                `}
              >
                <Checkbox checked={checked} onCheckedChange={() => toggleSupplier(supplier)} className="pointer-events-none" />
                {supplier}
              </button>
            )
          })}
        </div>
      </Section>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2 min-w-32 glass-button-primary rounded-2xl">
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Save className="w-4 h-4" /> Save Settings</>
          }
        </Button>
      </div>

      {/* Danger Zone */}
      <Section icon={Shield} title="Danger Zone">
        <p className="text-sm text-on-surface-variant -mt-1">
          These actions are permanent and cannot be undone.
        </p>
        <div className="space-y-3">
          {[
            {
              label: 'Clear all monitored parts',
              desc: 'Removes all parts from your monitoring list.',
              loading: clearingParts,
              action: clearMonitoredParts,
              confirmTitle: 'Clear all monitored parts?',
              confirmDesc: "This will permanently delete every part from your monitoring list. You'll need to re-upload a BOM to start monitoring again.",
              confirmText: 'Yes, clear all parts',
              btnText: 'Clear parts',
            },
            {
              label: 'Clear all alerts',
              desc: 'Dismisses every alert in your alerts inbox.',
              loading: clearingAlerts,
              action: clearAlerts,
              confirmTitle: 'Clear all alerts?',
              confirmDesc: 'This will permanently delete all alerts. New alerts will still be generated on your next monitoring run.',
              confirmText: 'Yes, clear all alerts',
              btnText: 'Clear alerts',
            },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between p-4 rounded-2xl border border-red-500/20 bg-red-500/5">
              <div>
                <p className="text-sm font-medium text-on-surface">{item.label}</p>
                <p className="text-xs text-on-surface-variant mt-0.5">{item.desc}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 rounded-2xl border-red-500/40 text-red-400 hover:bg-red-500/10"
                    disabled={item.loading}
                  >
                    {item.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {item.btnText}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{item.confirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>{item.confirmDesc}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={item.action}
                    >
                      {item.confirmText}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </Section>

      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}