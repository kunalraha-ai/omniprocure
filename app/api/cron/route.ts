/**
 * app/api/cron/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Internal cron trigger endpoint.
 * Railway Cron Service hits GET /api/cron every 6 or 24 hours.
 * Secured with CRON_SECRET env var so only Railway can call it.
 *
 * Set in Railway:
 *   CRON_SECRET = any random string e.g. "omni-cron-xyz123"
 *
 * Railway Cron Service command:
 *   curl -X GET https://omniprocure.online/api/cron \
 *     -H "x-cron-secret: $CRON_SECRET"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/procurement'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  // ── Auth check ──────────────────────────────────────────────────────────
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  console.log(`[Cron] Monitor run started at ${startedAt}`)

  try {
    // ── Fetch all active MPNs from monitored_parts ──────────────────────
    const { data: parts, error } = await supabaseAdmin
      .from('monitored_parts')
      .select('mpn')
      .eq('is_active', true)

    if (error) throw error

    const mpns = (parts ?? []).map((p: { mpn: string }) => p.mpn)

    if (!mpns.length) {
      console.log('[Cron] No active parts to monitor.')
      return NextResponse.json({
        success: true,
        message: 'No active parts to monitor.',
        mpnsChecked: 0,
        startedAt,
      })
    }

    // ── Call /api/monitor internally ────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://omniprocure.online'
    const monitorRes = await fetch(`${baseUrl}/api/monitor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Pass internal secret so monitor knows it's a cron call
        'x-cron-secret': process.env.CRON_SECRET ?? '',
      },
      body: JSON.stringify({ mpns }),
    })

    if (!monitorRes.ok) {
      const text = await monitorRes.text()
      throw new Error(`Monitor API returned ${monitorRes.status}: ${text}`)
    }

    const monitorResult = await monitorRes.json()

    console.log(`[Cron] Monitor complete. MPNs checked: ${mpns.length}, Alerts saved: ${monitorResult.alertsSaved ?? 0}`)

    return NextResponse.json({
      success: true,
      startedAt,
      completedAt: new Date().toISOString(),
      mpnsChecked: mpns.length,
      alertsSaved: monitorResult.alertsSaved ?? 0,
      analysis: monitorResult.analysis,
    })

  } catch (err: any) {
    console.error('[Cron] Error:', err?.message)
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 })
  }
}