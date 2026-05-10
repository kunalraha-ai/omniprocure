/**
 * app/api/cron/route.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Internal cron trigger endpoint.
 * Railway Cron Service hits GET /api/cron every 6 or 24 hours.
 * Secured with CRON_SECRET env var so only Railway can call it.
 *
 * Does two things:
 *  1. Runs price/stock monitor for all active MPNs
 *  2. Renews Gmail watch if it expires within 2 days
 *
 * Set in Railway:
 *   CRON_SECRET = any random string e.g. "omni-cron-xyz123"
 *
 * Railway Cron Service command:
 *   curl -X GET https://omniprocure.online/api/cron \
 *     -H "x-cron-secret: $CRON_SECRET"
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/procurement";

export const maxDuration = 60;

// ── Helper: get fresh access token ───────────────────────────────────────────
async function getAccessToken(): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin
      .from("gmail_watch")
      .select("refresh_token")
      .eq("email", "yhwach149@gmail.com")
      .single();

    if (!data?.refresh_token) return null;

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
    return tokens.access_token ?? null;
  } catch {
    return null;
  }
}

// ── Helper: renew Gmail watch if expiring soon ────────────────────────────────
async function renewGmailWatchIfNeeded(): Promise<{ renewed: boolean; reason: string }> {
  const { data } = await supabaseAdmin
    .from("gmail_watch")
    .select("expires_at")
    .eq("email", "yhwach149@gmail.com")
    .single();

  if (!data?.expires_at) {
    return { renewed: false, reason: "No expiry found" };
  }

  const expiresAt = new Date(data.expires_at);
  const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

  if (expiresAt > twoDaysFromNow) {
    return { renewed: false, reason: `Watch valid until ${expiresAt.toISOString()}` };
  }

  // Renew — get access token and re-subscribe
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return { renewed: false, reason: "Could not get access token for renewal" };
  }

  const watchRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/watch",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/${process.env.GMAIL_PUBSUB_TOPIC ?? "gmail-ingest"}`,
        labelIds: ["INBOX"],
      }),
    }
  );

  const watchData = await watchRes.json();
  if (!watchData.historyId) {
    return { renewed: false, reason: `Watch renewal failed: ${JSON.stringify(watchData)}` };
  }

  const newExpiry = new Date(Number(watchData.expiration)).toISOString();

  await supabaseAdmin
    .from("gmail_watch")
    .update({
      expires_at: newExpiry,
      history_id: watchData.historyId,
      updated_at: new Date().toISOString(),
    })
    .eq("email", "yhwach149@gmail.com");

  console.log(`[Cron] ✅ Gmail watch renewed until ${newExpiry}`);
  return { renewed: true, reason: `Renewed until ${newExpiry}` };
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // Auth check
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  console.log(`[Cron] Run started at ${startedAt}`);

  try {
    // ── 1. Renew Gmail watch if expiring soon ─────────────────────────────
    const watchRenewal = await renewGmailWatchIfNeeded();
    console.log(`[Cron] Gmail watch: ${watchRenewal.reason}`);

    // ── 2. Fetch all active MPNs ──────────────────────────────────────────
    const { data: parts, error } = await supabaseAdmin
      .from("monitored_parts")
      .select("mpn")
      .eq("is_active", true);

    if (error) throw error;

    const mpns = (parts ?? []).map((p: { mpn: string }) => p.mpn);

    if (!mpns.length) {
      console.log("[Cron] No active parts to monitor.");
      return NextResponse.json({
        success: true,
        message: "No active parts to monitor.",
        mpnsChecked: 0,
        startedAt,
        gmailWatch: watchRenewal,
      });
    }

    // ── 3. Call /api/monitor ──────────────────────────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://omniprocure.online";
    const monitorRes = await fetch(`${baseUrl}/api/monitor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": process.env.CRON_SECRET ?? "",
      },
      body: JSON.stringify({ mpns }),
    });

    if (!monitorRes.ok) {
      const text = await monitorRes.text();
      throw new Error(`Monitor API returned ${monitorRes.status}: ${text}`);
    }

    const monitorResult = await monitorRes.json();

    console.log(
      `[Cron] Monitor complete. MPNs: ${mpns.length}, Alerts: ${monitorResult.alertsSaved ?? 0}`
    );

    return NextResponse.json({
      success: true,
      startedAt,
      completedAt: new Date().toISOString(),
      mpnsChecked: mpns.length,
      alertsSaved: monitorResult.alertsSaved ?? 0,
      analysis: monitorResult.analysis,
      gmailWatch: watchRenewal,
    });
  } catch (err: any) {
    console.error("[Cron] Error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}