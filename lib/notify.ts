/**
 * Notification helper — sends alerts for flagged parts.
 *
 * TODO: Replace the stub below with a real implementation
 * (e.g. Slack webhook, email via Resend/SendGrid, or push notification).
 */

interface AlertPayload {
  mpn: string;
  urgency: string;
  summary: string;
  recommendation: string;
}

export async function notifyAlert(payload: AlertPayload): Promise<void> {
  // Stub: log the alert to stdout until a real channel is configured.
  console.log(
    `[notify] Alert for ${payload.mpn} (${payload.urgency}): ${payload.summary}`
  );
}
