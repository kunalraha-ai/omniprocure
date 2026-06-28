'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  User, Bell, Shield, Save, Lock, ExternalLink,
  Loader2, AlertTriangle, CheckCircle, Send, Trash2,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { supabase } from '@/lib/supabase'

type Tier = 'free' | 'paid'

interface UserSettings {
  id: string
  email: string
  tier: Tier
  monitoring_frequency: string
  slack_webhook: string | null
  alert_email: string | null
}

type FetchState = 'idle' | 'loading' | 'success' | 'error'
interface ToastMsg { type: 'success' | 'error'; text: string }

// ─── Steel Gray + Sky Blue tokens ───────────────────────────────────────────
const C = {
  bg:          '#1c202a',
  sidebar:     '#232833',
  green:       '#5ebcf8', // Sky Blue
  greenDark:   '#7dd3fc',
  greenSoft:   'rgba(94, 188, 248, 0.10)',
  greenBorder: 'rgba(94, 188, 248, 0.25)',
  text:        '#f1f5f9',
  muted:       '#94a3b8',
  mutedLight:  '#64748b',
  card:        '#232833',
  cardBorder:  '#2f3644',
  cardShadow:  '6px 6px 12px #12141a, -6px -6px 12px #2d3443',
  shadowInner: 'inset 3px 3px 6px #12141a, inset -3px -3px 6px #2d3443',
  divider:     '#2f3644',
  rowHover:    'rgba(94, 188, 248, 0.03)',
  warn:        '#fbbf24',
  warnSoft:    'rgba(245, 158, 11, 0.12)',
  warnBorder:  'rgba(245, 158, 11, 0.3)',
  danger:      '#f87171',
  dangerSoft:  'rgba(239, 68, 68, 0.12)',
  dangerBorder:'rgba(239, 68, 68, 0.3)',
}

function Toast({ toast, onDismiss }: { toast: ToastMsg; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])
  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-lg border text-sm font-bold shadow-card-raised"
      style={{
        background: C.card,
        borderColor: toast.type === 'success' ? C.greenBorder : C.dangerBorder,
        color: C.text
      }}>
      {toast.type === 'success'
        ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: '#34d399' }} />
        : <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: '#f87171' }} />}
      {toast.text}
    </div>
  )
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 24px', borderBottom: `1.5px solid ${C.divider}` }}>
        <Icon className="w-4.5 h-4.5" style={{ color: C.green }} />
        <h2 style={{ fontSize: 15, fontWeight: 800, color: C.text, margin: 0 }}>{title}</h2>
      </div>
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>{children}</div>
    </div>
  )
}

export default function DashboardSettingsPage() {
  const [fetchState, setFetchState] = useState<FetchState>('idle')
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<ToastMsg | null>(null)
  const [slackEnabled, setSlackEnabled] = useState(false)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [testingSlack, setTestingSlack] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [clearingParts, setClearingParts] = useState(false)
  const [clearingAlerts, setClearingAlerts] = useState(false)

  const fetchSettings = useCallback(async () => {
    setFetchState('loading')

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      setFetchState('error')
      return
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, tier, monitoring_frequency, slack_webhook, alert_email')
      .eq('id', user.id)
      .maybeSingle()

    if (error) {
      setFetchState('error')
      return
    }

    if (!data) {
      const newUser: UserSettings = {
        id: user.id,
        email: user.email ?? '',
        tier: 'free',
        monitoring_frequency: '24h',
        slack_webhook: null,
        alert_email: user.email ?? null,
      }
      await supabase.from('users').insert(newUser)
      setSettings(newUser)
      setEmailEnabled(!!newUser.alert_email)
      setFetchState('success')
      return
    }

    setSettings(data as UserSettings)
    setSlackEnabled(!!data.slack_webhook)
    setEmailEnabled(!!data.alert_email)
    setFetchState('success')
  }, [])

  useEffect(() => { fetchSettings() }, [fetchSettings])

  function updateField<K extends keyof UserSettings>(key: K, value: UserSettings[K]) {
    setSettings(prev => prev ? { ...prev, [key]: value } : prev)
  }

  async function handleSave() {
    if (!settings) return
    setSaving(true)
    const { error } = await supabase
      .from('users')
      .update({
        monitoring_frequency: settings.monitoring_frequency,
        slack_webhook: slackEnabled ? settings.slack_webhook : null,
        alert_email: emailEnabled ? settings.alert_email : null,
      })
      .eq('id', settings.id)
    setSaving(false)
    setToast(error
      ? { type: 'error', text: `Save failed: ${error.message}` }
      : { type: 'success', text: 'Settings saved successfully.' }
    )
  }

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

  async function clearMonitoredParts() {
    setClearingParts(true)
    const { error } = await supabase.from('monitored_parts').delete().gte('created_at', '2000-01-01')
    setClearingParts(false)
    setToast(error
      ? { type: 'error', text: `Failed: ${error.message}` }
      : { type: 'success', text: 'All monitored parts cleared.' }
    )
  }

  async function clearAlerts() {
    setClearingAlerts(true)
    const { error } = await supabase.from('alerts').delete().gte('created_at', '2000-01-01')
    setClearingAlerts(false)
    setToast(error
      ? { type: 'error', text: `Failed: ${error.message}` }
      : { type: 'success', text: 'All alerts cleared.' }
    )
  }

  const isPaid = settings?.tier === 'paid'

  if (fetchState === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '96px 0', color: C.muted }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: C.green }} />
        <span className="text-sm font-bold">Retrieving profile settings…</span>
      </div>
    )
  }

  if (fetchState === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '96px 0', textAlign: 'center' }}>
        <AlertTriangle className="w-8 h-8" style={{ color: C.danger }} />
        <p className="font-bold text-lg" style={{ color: C.text }}>Settings unavailable</p>
        <Button variant="outline" size="sm" onClick={fetchSettings} className="gap-2 mt-1 shadow-neu-raised-sm"
          style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, color: C.green }}>
          <RefreshCw className="w-4 h-4" /> Try again
        </Button>
      </div>
    )
  }

  if (!settings) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>

      {/* Header card */}
      <div style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow, borderRadius: 24, padding: '24px 28px' }}>
        <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: 30, fontWeight: 800, color: C.text, letterSpacing: '-1px', margin: 0 }}>System Settings</h1>
        <p style={{ marginTop: 6, fontSize: 14.5, color: C.muted, margin: 0 }}>Manage credentials, alerts, Slack webhooks, and device triggers.</p>
      </div>

      <Section icon={User} title="Account Details">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Label style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Account Email</Label>
          <p style={{ fontSize: 14.5, fontWeight: 700, color: C.text, margin: 0 }}>{settings.email}</p>
        </div>

        <Separator style={{ background: C.divider }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <Label style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Subscription Tier</Label>
            <div style={{ marginTop: 8 }}>
              {isPaid ? (
                <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 50, fontSize: 11.5, fontWeight: 700, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>
                  Founding Member — $99/mo
                </span>
              ) : (
                <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 50, fontSize: 11.5, fontWeight: 700, background: C.greenSoft, color: C.green, border: `1px solid ${C.greenBorder}` }}>
                  Free Trial
                </span>
              )}
            </div>
          </div>
          {!isPaid && (
            <Button asChild size="sm" className="gap-2 shrink-0 rounded-2xl shadow-neu-raised-sm" style={{ background: C.green, color: C.bg }}>
              <a href={process.env.NEXT_PUBLIC_STRIPE_LINK ?? '#'} target="_blank" rel="noopener noreferrer">
                Upgrade <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </Button>
          )}
        </div>

        <Separator style={{ background: C.divider }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Label style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>Monitoring Frequency</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
            {[
              { value: '24h', label: '24 hours', sublabel: 'Current plan setting', available: true },
              { value: '6h', label: '6 hours', sublabel: 'Founding Member tier only', available: isPaid },
            ].map(opt => (
              <button
                key={opt.value}
                disabled={!opt.available}
                onClick={() => opt.available && updateField('monitoring_frequency', opt.value)}
                className="shadow-neu-raised-sm"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 18px', borderRadius: 16, border: `1px solid ${settings.monitoring_frequency === opt.value ? C.green : C.cardBorder}`,
                  background: settings.monitoring_frequency === opt.value ? C.greenSoft : C.card,
                  textAlign: 'left', cursor: opt.available ? 'pointer' : 'not-allowed', opacity: opt.available ? 1 : 0.5,
                  transition: 'all 0.15s'
                }}
              >
                <div>
                  <span style={{ fontWeight: 700, fontSize: 13.5, color: C.text }}>{opt.label}</span>
                  <span style={{ marginLeft: 8, fontSize: 11.5, color: C.muted }}>{opt.sublabel}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {!opt.available && <Lock className="w-3.5 h-3.5" style={{ color: C.muted }} />}
                  {settings.monitoring_frequency === opt.value && <div style={{ width: 8, height: 8, borderRadius: '50%', background: C.green, boxShadow: `0 0 6px ${C.green}` }} />}
                </div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section icon={Bell} title="System Notifications">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Label style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Slack Webhook</Label>
              <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Post warning telemetry to Slack channels</p>
            </div>
            <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
          </div>
          {slackEnabled && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Input
                placeholder="https://hooks.slack.com/services/…"
                value={settings.slack_webhook ?? ''}
                onChange={e => updateField('slack_webhook', e.target.value)}
                className="font-mono text-xs shadow-neu-sunken-sm"
                style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, color: C.text, borderRadius: 12 }}
              />
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 shadow-neu-raised-sm"
                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, color: C.green, borderRadius: 12 }}
                disabled={!settings.slack_webhook || testingSlack} onClick={testSlack}>
                {testingSlack ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Test
              </Button>
            </div>
          )}
        </div>

        <Separator style={{ background: C.divider }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Label style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Alert Email</Label>
              <p style={{ fontSize: 12, color: C.muted, margin: '2px 0 0' }}>Receive high priority alerts via email</p>
            </div>
            <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
          </div>
          {emailEnabled && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <Input
                type="email"
                placeholder="alerts@yourcompany.com"
                value={settings.alert_email ?? ''}
                onChange={e => updateField('alert_email', e.target.value)}
                className="shadow-neu-sunken-sm"
                style={{ background: C.bg, border: `1px solid ${C.cardBorder}`, color: C.text, borderRadius: 12 }}
              />
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5 shadow-neu-raised-sm"
                style={{ background: C.card, border: `1px solid ${C.cardBorder}`, color: C.green, borderRadius: 12 }}
                disabled={!settings.alert_email || testingEmail} onClick={testEmail}>
                {testingEmail ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Test
              </Button>
            </div>
          )}
        </div>
      </Section>

      {/* Save Trigger Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={handleSave} disabled={saving} className="shadow-neu-raised-sm"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minWidth: 140, padding: '11px 24px', borderRadius: 50, border: 'none', background: C.green, color: C.bg, fontWeight: 700, cursor: 'pointer' }}>
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
            : <><Save className="w-4 h-4" /> Save Config</>}
        </button>
      </div>

      <Section icon={Shield} title="Danger Area">
        <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>These actions are destructive and cannot be undone.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            {
              label: 'Clear monitored parts list',
              desc: 'Removes all imported BOM components from tracking.',
              loading: clearingParts,
              action: clearMonitoredParts,
              confirmTitle: 'Are you absolutely sure?',
              confirmDesc: "This will permanently clear all components currently being monitored.",
              confirmText: 'Yes, clear all parts',
              btnText: 'Clear parts',
            },
            {
              label: 'Clear alerts logs',
              desc: 'Empties the active warning and alerts inbox.',
              loading: clearingAlerts,
              action: clearAlerts,
              confirmTitle: 'Are you absolutely sure?',
              confirmDesc: 'This will permanently remove all alerts.',
              confirmText: 'Yes, clear all alerts',
              btnText: 'Clear alerts',
            },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 18px', borderRadius: 16, border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}>
              <div>
                <p style={{ fontSize: 13.5, fontWeight: 700, color: C.text, margin: 0 }}>{item.label}</p>
                <p style={{ fontSize: 11.5, color: C.muted, margin: '2px 0 0' }}>{item.desc}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm"
                    className="shrink-0 gap-1.5 rounded-2xl shadow-neu-raised-sm"
                    style={{ border: '1px solid rgba(239,68,68,0.4)', color: '#f87171', background: C.card }}
                    disabled={item.loading}>
                    {item.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    {item.btnText}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent style={{ background: C.card, border: `1.5px solid ${C.cardBorder}`, boxShadow: C.cardShadow }}>
                  <AlertDialogHeader>
                    <AlertDialogTitle style={{ color: C.text }}>{item.confirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription style={{ color: C.muted }}>{item.confirmDesc}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel style={{ background: C.bg, border: `1.5px solid ${C.cardBorder}`, color: C.text }}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      style={{ background: '#ef4444', color: '#1c202a' }}
                      onClick={item.action}>
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