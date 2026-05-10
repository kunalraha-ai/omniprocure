/**
 * GET /api/gmail-auth/callback
 * Receives OAuth code from Google, exchanges for tokens, saves refresh_token to Supabase
 */
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/procurement";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.json({ error: `Google OAuth error: ${error}` }, { status: 400 });
  }

  if (!code) {
    return NextResponse.json({ error: "No code received from Google" }, { status: 400 });
  }

  // Exchange code for tokens
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  const tokens = await tokenRes.json();

  if (!tokens.refresh_token) {
    return NextResponse.json({
      error: "No refresh_token returned. Make sure prompt=consent was set.",
      tokens,
    }, { status: 400 });
  }

  // Save refresh token to Supabase gmail_watch table
  await supabaseAdmin.from("gmail_watch").upsert({
    email: "yhwach149@gmail.com",
    refresh_token: tokens.refresh_token,
    updated_at: new Date().toISOString(),
  }, { onConflict: "email" });

  console.log("[GmailAuth] Refresh token saved ✅");

  return NextResponse.json({
    success: true,
    message: "✅ Gmail OAuth complete! Refresh token saved. You can now set up the Gmail watch.",
    next: "POST https://omniprocure.online/api/gmail-watch to activate push notifications",
  });
}