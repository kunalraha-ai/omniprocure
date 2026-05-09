/**
 * lib/notify.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Slack + Email notifications for OmniProcure
 * - Alert notifications (price spikes, stock issues)
 * - PO approved notifications
 * - PO pending approval reminders
 * ─────────────────────────────────────────────────────────────────────────────
 */

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const NOTIFY_EMAIL = 'yhwach149@gmail.com';
const FROM_EMAIL = 'onboarding@resend.dev';
const APP_URL = 'https://omniprocure.online';

// ── Slack ─────────────────────────────────────────────────────────────────────
async function sendSlack(blocks: object[], text: string): Promise<void> {
  if (!SLACK_WEBHOOK) {
    console.warn('[Notify] SLACK_WEBHOOK_URL not set — skipping Slack');
    return;
  }
  try {
    const res = await fetch(SLACK_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    });
    if (!res.ok) console.error('[Notify] Slack error:', res.status, await res.text());
    else console.log('[Notify] Slack sent ✓');
  } catch (e: any) {
    console.error('[Notify] Slack failed:', e?.message);
  }
}

// ── Email via Resend ──────────────────────────────────────────────────────────
async function sendEmail(subject: string, html: string): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn('[Notify] RESEND_API_KEY not set — skipping email');
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: NOTIFY_EMAIL,
        subject,
        html,
      }),
    });
    if (!res.ok) console.error('[Notify] Email error:', res.status, await res.text());
    else console.log('[Notify] Email sent ✓');
  } catch (e: any) {
    console.error('[Notify] Email failed:', e?.message);
  }
}

// ── Alert notification ────────────────────────────────────────────────────────
export async function notifyAlert(params: {
  mpn: string;
  urgency: 'low' | 'medium' | 'high' | 'none';
  summary: string;
  recommendation: string;
}): Promise<void> {
  const { mpn, urgency, summary, recommendation } = params;

  const urgencyEmoji = urgency === 'high' ? '🔴' : urgency === 'medium' ? '🟡' : '🟢';
  const urgencyLabel = urgency.toUpperCase();

  // Slack
  await sendSlack([
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${urgencyEmoji} Supply Chain Alert — ${mpn}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*MPN:*\n${mpn}` },
        { type: 'mrkdwn', text: `*Urgency:*\n${urgencyLabel}` },
        { type: 'mrkdwn', text: `*Summary:*\n${summary}` },
        { type: 'mrkdwn', text: `*Recommendation:*\n${recommendation}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔔 View Alerts' },
          url: `${APP_URL}/dashboard/alerts`,
          style: 'danger',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '📦 View Monitor' },
          url: `${APP_URL}/dashboard/monitor`,
        },
      ],
    },
  ], `${urgencyEmoji} Supply Chain Alert for ${mpn}: ${summary}`);

  // Email
  await sendEmail(
    `${urgencyEmoji} OmniProcure Alert: ${mpn} — ${urgencyLabel}`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f1524; padding: 24px; border-radius: 12px; border-left: 4px solid ${urgency === 'high' ? '#ff6b6b' : urgency === 'medium' ? '#fac775' : '#7dd3fc'};">
        <h2 style="color: #e0e8f0; margin: 0 0 16px;">${urgencyEmoji} Supply Chain Alert</h2>
        <table style="width: 100%; color: #a0b4c4; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">MPN</td><td>${mpn}</td></tr>
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">Urgency</td><td>${urgencyLabel}</td></tr>
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">Summary</td><td>${summary}</td></tr>
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">Recommendation</td><td>${recommendation}</td></tr>
        </table>
        <a href="${APP_URL}/dashboard/alerts" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #7dd3fc; color: #0f1524; border-radius: 8px; text-decoration: none; font-weight: bold;">View Alerts →</a>
      </div>
    </div>
    `
  );
}

// ── PO approved notification ──────────────────────────────────────────────────
export async function notifyPoApproved(params: {
  poNumber: string;
  mpn: string;
  supplier: string;
  totalValue: number;
  hitlId: string;
}): Promise<void> {
  const { poNumber, mpn, supplier, totalValue, hitlId } = params;

  // Slack
  await sendSlack([
    {
      type: 'header',
      text: { type: 'plain_text', text: '✅ Purchase Order Approved' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*PO Number:*\n${poNumber}` },
        { type: 'mrkdwn', text: `*MPN:*\n${mpn}` },
        { type: 'mrkdwn', text: `*Supplier:*\n${supplier}` },
        { type: 'mrkdwn', text: `*Total Value:*\n$${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📋 View PO' },
          url: `${APP_URL}/dashboard/orders`,
          style: 'primary',
        },
      ],
    },
  ], `✅ PO Approved: ${poNumber} for ${mpn} from ${supplier} — $${totalValue.toFixed(2)}`);

  // Email
  await sendEmail(
    `✅ PO Approved: ${poNumber} — ${mpn}`,
    `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #0f1524; padding: 24px; border-radius: 12px; border-left: 4px solid #7dd3fc;">
        <h2 style="color: #e0e8f0; margin: 0 0 16px;">✅ Purchase Order Approved</h2>
        <table style="width: 100%; color: #a0b4c4; font-size: 14px;">
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">PO Number</td><td>${poNumber}</td></tr>
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">MPN</td><td>${mpn}</td></tr>
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">Supplier</td><td>${supplier}</td></tr>
          <tr><td style="padding: 6px 0; color: #7dd3fc; font-weight: bold;">Total Value</td><td>$${totalValue.toFixed(2)}</td></tr>
        </table>
        <a href="${APP_URL}/dashboard/orders" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #7dd3fc; color: #0f1524; border-radius: 8px; text-decoration: none; font-weight: bold;">View Order →</a>
      </div>
    </div>
    `
  );
}

// ── PO pending approval reminder ──────────────────────────────────────────────
export async function notifyPoPending(params: {
  mpn: string;
  supplier: string;
  totalValue: number;
  hitlId: string;
  aiRecommendation?: string;
}): Promise<void> {
  const { mpn, supplier, totalValue, hitlId, aiRecommendation } = params;

  await sendSlack([
    {
      type: 'header',
      text: { type: 'plain_text', text: '⏳ PO Awaiting Your Approval' },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*MPN:*\n${mpn}` },
        { type: 'mrkdwn', text: `*Supplier:*\n${supplier}` },
        { type: 'mrkdwn', text: `*Total Value:*\n$${totalValue.toFixed(2)}` },
        { type: 'mrkdwn', text: `*AI Recommendation:*\n${aiRecommendation ?? 'Review required'}` },
      ],
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '✅ Review & Approve' },
          url: `${APP_URL}/dashboard/orders`,
          style: 'primary',
        },
      ],
    },
  ], `⏳ PO pending approval for ${mpn} from ${supplier} — $${totalValue.toFixed(2)}`);
}