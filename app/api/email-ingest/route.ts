/**
 * app/api/email-ingest/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Gmail push notification receiver.
 * Google Pub/Sub calls POST /api/email-ingest when a new email arrives.
 * Uses OAuth refresh token (saved in gmail_watch table) to fetch the email.
 * Parses quote emails with Claude → saves to Supabase → notifies Slack.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/procurement";

export const maxDuration = 60;

// ── Helper: get a fresh access token using the saved refresh token ────────────
async function getAccessToken(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("gmail_watch")
    .select("refresh_token")
    .eq("email", "yhwach149@gmail.com")
    .single();

  if (error || !data?.refresh_token) {
    throw new Error("No refresh token found in Supabase gmail_watch table");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      refresh_token: data.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const tokens = await res.json();
  if (!tokens.access_token) {
    throw new Error(`Failed to refresh access token: ${JSON.stringify(tokens)}`);
  }

  return tokens.access_token;
}

// ── Helper: fetch email body from Gmail API ───────────────────────────────────
async function fetchEmailBody(messageId: string, accessToken: string): Promise<{ subject: string; from: string; body: string }> {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  const msg = await res.json();
  const headers = msg.payload?.headers ?? [];
  const subject = headers.find((h: any) => h.name === "Subject")?.value ?? "(no subject)";
  const from = headers.find((h: any) => h.name === "From")?.value ?? "(unknown sender)";

  // Extract plain text body
  let body = "";
  const findBody = (parts: any[]): string => {
    for (const part of parts ?? []) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64").toString("utf-8");
      }
      if (part.parts) {
        const found = findBody(part.parts);
        if (found) return found;
      }
    }
    return "";
  };

  if (msg.payload?.body?.data) {
    body = Buffer.from(msg.payload.body.data, "base64").toString("utf-8");
  } else if (msg.payload?.parts) {
    body = findBody(msg.payload.parts);
  }

  return { subject, from, body };
}

// ── Helper: parse quote with Claude ──────────────────────────────────────────
async function parseQuoteWithClaude(subject: string, from: string, body: string) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: `You are a procurement assistant. Extract structured quote data from this supplier email.

From: ${from}
Subject: ${subject}
Body:
${body}

Respond ONLY with a JSON object (no markdown, no explanation):
{
  "supplier_name": "string",
  "supplier_email": "string",
  "mpn": "string or null",
  "part_description": "string or null",
  "unit_price": number or null,
  "currency": "USD" or other,
  "moq": number or null,
  "lead_time_days": number or null,
  "notes": "string or null",
  "is_quote": true or false
}

If this is not a supplier quote email, set is_quote to false and other fields to null.`,
        },
      ],
    }),
  });

  const data = await res.json();
  const text = data.content?.[0]?.text ?? "{}";
  try {
    return JSON.parse(text.replace(/```json|```/g, "").trim());
  } catch {
    return { is_quote: false };
  }
}

// ── Helper: send Slack notification ──────────────────────────────────────────
async function notifySlack(quote: any, orderId: string) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const price = quote.unit_price ? `$${quote.unit_price} ${quote.currency ?? "USD"}` : "TBD";
  const moq = quote.moq ? `MOQ ${quote.moq}` : "";
  const lead = quote.lead_time_days ? `Lead time ${quote.lead_time_days}d` : "";

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `📧 *New Supplier Quote Received*`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `📧 *New Supplier Quote*\n*Supplier:* ${quote.supplier_name ?? "Unknown"}\n*Part:* ${quote.mpn ?? quote.part_description ?? "Unknown"}\n*Price:* ${price}  ${moq}  ${lead}\n*Notes:* ${quote.notes ?? "—"}`,
          },
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "✅ Approve" },
              style: "primary",
              url: `https://omniprocure.online/dashboard/orders?action=approve&id=${orderId}`,
            },
            {
              type: "button",
              text: { type: "plain_text", text: "❌ Reject" },
              style: "danger",
              url: `https://omniprocure.online/dashboard/orders?action=reject&id=${orderId}`,
            },
          ],
        },
      ],
    }),
  });
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Google Pub/Sub sends base64-encoded message data
    const messageData = body?.message?.data;
    if (!messageData) {
      return NextResponse.json({ error: "No message data" }, { status: 400 });
    }

    const decoded = JSON.parse(Buffer.from(messageData, "base64").toString("utf-8"));
    const historyId = decoded.historyId;
    const emailAddress = decoded.emailAddress;

    console.log(`[EmailIngest] Pub/Sub notification — historyId: ${historyId}, email: ${emailAddress}`);

    // Get access token
    const accessToken = await getAccessToken();

    // Fetch history to find new message IDs
    const { data: watchRow } = await supabaseAdmin
      .from("gmail_watch")
      .select("history_id")
      .eq("email", "yhwach149@gmail.com")
      .single();

    const sinceHistoryId = watchRow?.history_id ?? historyId;

    const historyRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${sinceHistoryId}&historyTypes=messageAdded`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const historyData = await historyRes.json();

    // Update stored history_id
    await supabaseAdmin
      .from("gmail_watch")
      .update({ history_id: historyId, updated_at: new Date().toISOString() })
      .eq("email", "yhwach149@gmail.com");

    const messages = historyData.history?.flatMap((h: any) =>
      (h.messagesAdded ?? []).map((m: any) => m.message)
    ) ?? [];

    if (!messages.length) {
      console.log("[EmailIngest] No new messages in history.");
      return NextResponse.json({ success: true, processed: 0 });
    }

    let processed = 0;

    for (const msg of messages) {
      try {
        const { subject, from, body: emailBody } = await fetchEmailBody(msg.id, accessToken);

        console.log(`[EmailIngest] Processing: "${subject}" from ${from}`);

        // Parse with Claude
        const quote = await parseQuoteWithClaude(subject, from, emailBody);

        if (!quote.is_quote) {
          console.log(`[EmailIngest] Not a quote email, skipping.`);
          continue;
        }

        // Save to Supabase orders table as HITL pending
        const { data: order, error: insertError } = await supabaseAdmin
          .from("orders")
          .insert({
            supplier_name: quote.supplier_name,
            supplier_email: quote.supplier_email,
            mpn: quote.mpn,
            part_description: quote.part_description,
            unit_price: quote.unit_price,
            currency: quote.currency ?? "USD",
            moq: quote.moq,
            lead_time_days: quote.lead_time_days,
            notes: quote.notes,
            status: "pending_review",
            source: "email",
            raw_email_subject: subject,
            created_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("[EmailIngest] Insert error:", insertError.message);
          continue;
        }

        // Notify Slack
        await notifySlack(quote, order.id);

        console.log(`[EmailIngest] ✅ Saved order ${order.id} and notified Slack`);
        processed++;
      } catch (msgErr: any) {
        console.error(`[EmailIngest] Error processing message ${msg.id}:`, msgErr?.message);
      }
    }

    return NextResponse.json({ success: true, processed });
  } catch (err: any) {
    console.error("[EmailIngest] Fatal error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}