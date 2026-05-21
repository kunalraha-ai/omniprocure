/**
 * lib/notify.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Alert notification layer for the monitor route.
 * Supports optional webhook delivery (set NOTIFY_WEBHOOK_URL in .env).
 * Falls back to console logging when no webhook is configured.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface AlertPayload {
  mpn: string;
  urgency: "none" | "low" | "medium" | "high";
  summary: string;
  recommendation: "buy_now" | "watch" | "hold";
}

/**
 * Send an alert notification.
 * - If NOTIFY_WEBHOOK_URL is set, POSTs the payload as JSON.
 * - Otherwise logs to console (safe no-op for local / CI builds).
 */
export async function notifyAlert(payload: AlertPayload): Promise<void> {
  const webhookUrl = process.env.NOTIFY_WEBHOOK_URL;

  if (!webhookUrl) {
    console.log(
      `[Notify] Alert suppressed (no NOTIFY_WEBHOOK_URL) — MPN: ${payload.mpn} | urgency: ${payload.urgency} | ${payload.summary}`
    );
    return;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        sentAt: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.error(`[Notify] Webhook failed (${res.status}) for MPN: ${payload.mpn}`);
    } else {
      console.log(`[Notify] Alert sent for MPN: ${payload.mpn} (urgency: ${payload.urgency})`);
    }
  } catch (err: any) {
    console.error(`[Notify] Webhook error for MPN: ${payload.mpn} —`, err?.message);
  }
}
