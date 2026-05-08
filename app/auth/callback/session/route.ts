import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * POST /auth/callback/session
 * Receives { access_token, refresh_token } from the client-side hash-fragment
 * fallback and sets them as server-side cookies so middleware can read them.
 */
export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return NextResponse.json({ ok: false, error: "Missing tokens" }, { status: 400 });
    }

    const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const response = NextResponse.json({ ok: true });

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll: () =>
          request.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: (cookies) => {
          cookies.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
          });
        },
      },
    });

    const { error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      console.error("[auth/callback/session] setSession error:", error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: 401 });
    }

    return response;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}