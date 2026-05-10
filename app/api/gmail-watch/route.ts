/**
 * POST /api/gmail-watch
 * GET  /api/gmail-watch
 * ─────────────────────────────────────────────────────────────────────────────
 * Sets up (or renews) Gmail push notifications using OAuth refresh token.
 * Call POST once to activate, then weekly via cron to renew (expires every 7d).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/procurement";

export const maxDuration = 30;

// ── Get access token from saved refresh token ─────────────────────────────────
async function getAccessToken(): Promise<string> {
  // Load refresh token from Supabase
  const { data, error } = await supabaseAdmin
    .from("gmail_watch")
    .select("refresh_token")
    .eq("email", "yhwach149@gmail.com")
    .single();

  if (error || !data?.refresh_token) {
    throw new Error("No refresh token found. Visit /api/gmail-auth first.");
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

// ── GET: check watch status ───────────────────────────────────────────────────
export async function GET() {
  try {
    const { data } = await supabaseAdmin
      .from("gmail_watch")
      .select("*")
      .eq("email", "yhwach149@gmail.com")
      .single();

    if (!data) {
      return NextResponse.json({ active: false, message: "No watch configured. POST to setup." });
    }

    const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
    const now = new Date();
    const hoursLeft = expiresAt
      ? Math.round((expiresAt.getTime() - now.getTime()) / 3_600_000)
      : 0;

    return NextResponse.json({
      active: expiresAt ? expiresAt > now : false,
      email: data.email,
      expiresAt: data.expires_at,
      hoursLeft,
      lastHistoryId: data.last_history_id,
      hasRefreshToken: !!data.refresh_token,
      needsRenewal: hoursLeft < 24,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}

// ── POST: setup or renew Gmail watch ─────────────────────────────────────────
export async function POST(_req: NextRequest) {
  try {
    const accessToken = await getAccessToken();
    const topicName = process.env.GOOGLE_PUBSUB_TOPIC!;

    // Call Gmail watch API
    const watchRes = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/yhwach149@gmail.com/watch",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topicName,
          labelIds: ["INBOX"],
          labelFilterBehavior: "INCLUDE",
        }),
      }
    );

    const watchData = await watchRes.json();
    if (!watchRes.ok) {
      throw new Error(`Gmail watch failed: ${JSON.stringify(watchData)}`);
    }

    const expiresAt = new Date(Number(watchData.expiration)).toISOString();

    // Save/update watch record
    await supabaseAdmin.from("gmail_watch").upsert(
      {
        email: "yhwach149@gmail.com",
        history_id: watchData.historyId,
        last_history_id: watchData.historyId,
        expires_at: expiresAt,
        topic: topicName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    console.log(`[GmailWatch] Watch active. Expires: ${expiresAt}`);

    return NextResponse.json({
      success: true,
      historyId: watchData.historyId,
      expiresAt,
      message: "✅ Gmail watch active! Emails to yhwach149@gmail.com will trigger /api/email-ingest.",
    });

  } catch (err: any) {
    console.error("[GmailWatch] Error:", err?.message);
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}