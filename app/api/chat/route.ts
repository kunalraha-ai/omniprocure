/**
 * POST /api/chat
 * ─────────────────────────────────────────────────────────────────────────────
 * OmniProcure AI Command Center
 * Claude with tool use — can query OEM API, Supabase tables, manage watchlist
 * Persists conversation history to Supabase chat_sessions table
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { fetchOemSecrets, logAuditEvent, supabaseAdmin } from "@/lib/procurement";

export const maxDuration = 60;

// ── Tool definitions for Claude ───────────────────────────────────────────────
const TOOLS = [
  {
    name: "query_stock",
    description:
      "Fetch live stock, pricing, and supplier data for a component MPN from OEM Secrets API. Use this when the user asks about availability, price, stock levels, or suppliers for any part.",
    input_schema: {
      type: "object",
      properties: {
        mpn: { type: "string", description: "The manufacturer part number to look up, e.g. ESP32-WROOM-32" },
      },
      required: ["mpn"],
    },
  },
  {
    name: "get_alerts",
    description:
      "Get current supply chain alerts from the database. Use when user asks about alerts, warnings, issues, or what needs attention.",
    input_schema: {
      type: "object",
      properties: {
        urgency: { type: "string", enum: ["high", "medium", "low", "all"], description: "Filter by urgency level" },
        limit: { type: "number", description: "Max number of alerts to return (default 10)" },
      },
    },
  },
  {
    name: "get_watchlist",
    description: "Get the current watchlist of monitored components.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "add_to_watchlist",
    description: "Add a component MPN to the watchlist for ongoing monitoring.",
    input_schema: {
      type: "object",
      properties: {
        mpn: { type: "string", description: "The MPN to add to watchlist" },
        label: { type: "string", description: "Optional friendly label for this part" },
      },
      required: ["mpn"],
    },
  },
  {
    name: "get_monitored_parts",
    description: "Get all parts currently being monitored from uploaded BOMs.",
    input_schema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "get_email_quotes",
    description: "Get recent supplier quote emails that were received and parsed.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["pending", "hitl_created", "approved", "rejected", "all"] },
        limit: { type: "number" },
      },
    },
  },
  {
    name: "run_monitor_check",
    description:
      "Trigger a live monitoring check for all watched components. Use when user asks to run a check, refresh data, or scan for issues now.",
    input_schema: {
      type: "object",
      properties: {
        mpns: {
          type: "array",
          items: { type: "string" },
          description: "Specific MPNs to check. Leave empty to check all watchlist items.",
        },
      },
    },
  },
  {
    name: "mark_alert_read",
    description: "Mark an alert as read/resolved.",
    input_schema: {
      type: "object",
      properties: {
        alert_id: { type: "string", description: "The alert ID to mark as read" },
      },
      required: ["alert_id"],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────
async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case "query_stock": {
        const suppliers = await fetchOemSecrets(input.mpn);
        if (!suppliers.length) return `No stock data found for ${input.mpn}.`;
        const inStock = suppliers.filter(s => s.stock > 0);
        const summary = suppliers.slice(0, 6).map(s =>
          `• ${s.supplier}: ${s.stock > 0 ? `${s.stock.toLocaleString()} units` : "OUT OF STOCK"} | Price: ${s.hasPrice ? `$${s.price?.toFixed(4)}` : "N/A"} | Lead: ${s.leadTime || "unknown"}`
        ).join("\n");
        return `Live data for ${input.mpn.toUpperCase()}:\nIn stock at ${inStock.length}/${suppliers.length} suppliers:\n${summary}`;
      }

      case "get_alerts": {
        const urgency = input.urgency ?? "all";
        const limit = input.limit ?? 10;
        let query = supabaseAdmin.from("alerts").select("*").order("created_at", { ascending: false }).limit(limit);
        if (urgency !== "all") query = query.eq("urgency", urgency);
        const { data } = await query;
        if (!data?.length) return "No alerts found.";
        return JSON.stringify(data.map(a => ({
          id: a.id, mpn: a.mpn, urgency: a.urgency,
          summary: a.summary, recommendation: a.recommendation,
          created_at: a.created_at, is_read: a.is_read,
        })));
      }

      case "get_watchlist": {
        const { data } = await supabaseAdmin.from("watchlist").select("*").order("added_at", { ascending: false });
        if (!data?.length) return "Watchlist is empty.";
        return JSON.stringify(data);
      }

      case "add_to_watchlist": {
        await supabaseAdmin.from("watchlist").upsert(
          { mpn: input.mpn.toUpperCase(), label: input.label ?? input.mpn, added_at: new Date().toISOString() },
          { onConflict: "mpn" }
        );
        return `✅ ${input.mpn.toUpperCase()} added to watchlist. It will be monitored in the next check.`;
      }

      case "get_monitored_parts": {
        const { data } = await supabaseAdmin
          .from("monitored_parts").select("*").eq("is_active", true)
          .limit(input.limit ?? 20);
        if (!data?.length) return "No parts being monitored. Upload a BOM first.";
        return JSON.stringify(data);
      }

      case "get_email_quotes": {
        const status = input.status ?? "all";
        const limit = input.limit ?? 10;
        let query = supabaseAdmin.from("email_quotes").select("*").order("received_at", { ascending: false }).limit(limit);
        if (status !== "all") query = query.eq("status", status);
        const { data } = await query;
        if (!data?.length) return "No email quotes found.";
        return JSON.stringify(data);
      }

      case "run_monitor_check": {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://omniprocure.online"}/api/monitor`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mpns: input.mpns ?? [] }),
        });
        const data = await res.json();
        return `Monitor check complete. Checked ${data.mpnsChecked} parts. Alerts saved: ${data.alertsSaved}. ${data.analysis?.summary ?? ""}`;
      }

      case "mark_alert_read": {
        await supabaseAdmin.from("alerts").update({ is_read: true }).eq("id", input.alert_id);
        return `✅ Alert ${input.alert_id} marked as read.`;
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Tool error: ${err?.message}`;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

    const sid = sessionId ?? `session-${Date.now()}`;

    // Load conversation history from Supabase
    const { data: historyRows } = await supabaseAdmin
      .from("chat_sessions")
      .select("role, content")
      .eq("session_id", sid)
      .order("created_at", { ascending: true })
      .limit(40); // keep last 40 messages for context

    const history = (historyRows ?? []).map(r => ({ role: r.role, content: r.content }));

    // Append new user message
    const messages = [...history, { role: "user", content: message }];

    // Save user message
    await supabaseAdmin.from("chat_sessions").insert({
      session_id: sid,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    });

    // ── Agentic loop: Claude + tool use ──────────────────────────────────────
    let currentMessages = messages;
    let finalText = "";
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      iterations++;

      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: `You are OmniProcure AI — an expert procurement assistant with live access to component stock data, supplier pricing, and the OmniProcure platform.

You help electronics procurement teams by:
- Checking live stock and pricing for any component MPN via OEM Secrets API
- Monitoring supply chain alerts and flagging risks
- Managing watchlists of critical components
- Reviewing supplier email quotes
- Triggering monitoring checks on demand

When a user asks about a component (e.g. "what's the stock on ESP32?"), ALWAYS use query_stock to get live data. Don't guess.
When asked about alerts or issues, use get_alerts.
Be concise, direct, and actionable. Format numbers clearly. Use bullet points for multi-item responses.
Current date: ${new Date().toISOString().split("T")[0]}`,
          messages: currentMessages,
          tools: TOOLS,
        }),
      });

      const claudeData = await claudeRes.json();

      if (!claudeRes.ok) {
        throw new Error(`Claude API error: ${JSON.stringify(claudeData)}`);
      }

      // Check stop reason
      if (claudeData.stop_reason === "end_turn") {
        finalText = claudeData.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n");
        break;
      }

      // Handle tool use
      if (claudeData.stop_reason === "tool_use") {
        const toolUseBlocks = claudeData.content.filter((b: any) => b.type === "tool_use");

        // Add assistant message with tool calls
        currentMessages = [...currentMessages, { role: "assistant", content: claudeData.content }];

        // Execute all tools in parallel
        const toolResults = await Promise.all(
          toolUseBlocks.map(async (block: any) => {
            const result = await executeTool(block.name, block.input);
            return {
              type: "tool_result",
              tool_use_id: block.id,
              content: result,
            };
          })
        );

        // Add tool results
        currentMessages = [...currentMessages, { role: "user", content: toolResults }];
        continue;
      }

      // Fallback: extract any text
      finalText = claudeData.content
        ?.filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n") ?? "I couldn't process that request.";
      break;
    }

    // Save assistant response
    await supabaseAdmin.from("chat_sessions").insert({
      session_id: sid,
      role: "assistant",
      content: finalText,
      created_at: new Date().toISOString(),
    });

    await logAuditEvent({
      action: "chat_message",
      details: { sessionId: sid, userMessage: message.slice(0, 100), iterations },
    });

    return NextResponse.json({ success: true, sessionId: sid, reply: finalText });

  } catch (err: any) {
    console.error("[Chat] Error:", err?.message);
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

// ── GET: load session history ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    // Return list of sessions
    const { data } = await supabaseAdmin
      .from("chat_sessions")
      .select("session_id, content, created_at")
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(20);
    const sessions = [...new Map((data ?? []).map(r => [r.session_id, r])).values()];
    return NextResponse.json({ sessions });
  }

  const { data } = await supabaseAdmin
    .from("chat_sessions")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: data ?? [] });
}