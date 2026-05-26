/**
 * POST /api/chat
 * GET  /api/chat
 * ─────────────────────────────────────────────────────────────────────────────
 * OmniProcure AI Command Center
 * Claude with tool use — scoped per authenticated Supabase user
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchOemSecrets, logAuditEvent, supabaseAdmin } from "@/lib/procurement";
import { flushLangfuse, getLangfuseClient } from "@/lib/langfuse";

export const maxDuration = 60;

// ── Get authenticated user from request cookies ───────────────────────────────
async function getAuthUser(req: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll().map(c => ({ name: c.name, value: c.value })),
        setAll: () => {},
      },
    }
  );
  const { data } = await supabase.auth.getUser();
  return data.user;
}

// ── Tool definitions ──────────────────────────────────────────────────────────
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
  {
    name: "create_alert",
    description:
      "Save a supply chain alert to the database. Use this whenever you identify a real issue: single source risk, out of stock, long lead time (>8 weeks), limited stock (<500 units), price spike, or any procurement risk. ALWAYS call this tool — never just mention the issue conversationally without saving it.",
    input_schema: {
      type: "object",
      properties: {
        mpn: { type: "string", description: "The part number with the issue" },
        urgency: {
          type: "string",
          enum: ["low", "medium", "high"],
          description: "high = critical/OOS/single source risk. medium = long lead time/limited stock. low = watch only.",
        },
        summary: { type: "string", description: "One sentence describing the issue clearly" },
        recommendation: { type: "string", description: "buy_now, watch, or hold" },
      },
      required: ["mpn", "urgency", "summary", "recommendation"],
    },
  },
  {
    name: "parse_bom",
    description:
      "Parse a BOM (Bill of Materials) CSV text, source suppliers for each part via OEM API, and save all parts to monitored_parts. Use when the user uploads a BOM file or pastes a list of MPNs to source.",
    input_schema: {
      type: "object",
      properties: {
        raw: { type: "string", description: "Raw CSV text content of the BOM" },
        filename: { type: "string", description: "Original filename" },
      },
      required: ["raw"],
    },
  },
];

// ── Tool execution ────────────────────────────────────────────────────────────
async function executeTool(name: string, input: any): Promise<string> {
  try {
    switch (name) {
      case "query_stock": {
        const suppliers = await fetchOemSecrets(input.mpn, "chat");
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
        const mpn = input.mpn.toUpperCase();
        await supabaseAdmin.from("watchlist").upsert(
          { mpn, label: input.label ?? mpn, added_at: new Date().toISOString() },
          { onConflict: "mpn" }
        );
        await supabaseAdmin.from("monitored_parts").upsert(
          { mpn, part_name: input.label ?? mpn, quantity: 1, is_active: true, created_at: new Date().toISOString() },
          { onConflict: "mpn" }
        );
        return `✅ ${mpn} added to watchlist and monitoring. It will appear on your Monitor page.`;
      }

      case "get_monitored_parts": {
        const { data } = await supabaseAdmin
          .from("monitored_parts").select("*").eq("is_active", true)
          .limit(input.limit ?? 20);
        if (!data?.length) return "No parts being monitored. Upload a BOM first.";
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

      case "create_alert": {
        const { error } = await supabaseAdmin
          .from("alerts")
          .insert({
            mpn: input.mpn.toUpperCase(),
            urgency: input.urgency,
            summary: input.summary,
            recommendation: input.recommendation,
            flagged_by: "chat",
            is_read: false,
            created_at: new Date().toISOString(),
          });
        if (error) return `Failed to save alert: ${error.message}`;
        return `✅ Alert saved for ${input.mpn.toUpperCase()} (${input.urgency} urgency). It will appear in your Alerts page immediately.`;
      }

      case "parse_bom": {
        const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? "https://omniprocure.online"}/api/bom`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw: input.raw, filename: input.filename ?? "chat-upload.csv" }),
        });
        const reader = res.body?.getReader();
        if (!reader) return "BOM API unavailable.";
        const decoder = new TextDecoder();
        let summary = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value);
          const lines = text.split("\n").filter(l => l.startsWith("data:"));
          for (const line of lines) {
            try {
              const evt = JSON.parse(line.replace("data:", "").trim());
              if (evt.type === "complete") {
                summary = `✅ BOM processed: ${evt.totalItems} parts found. ${evt.sourced} sourced, ${evt.partial} partial, ${evt.unfound} unfound. Estimated cost: $${evt.estimatedCost?.toFixed(2)}. All parts added to monitored_parts.`;
              }
            } catch {}
          }
        }
        return summary || "BOM processed and parts saved to monitoring.";
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (err: any) {
    return `Tool error: ${err?.message}`;
  }
}

// ── POST: send message ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { message, sessionId } = await req.json();
    if (!message) return NextResponse.json({ error: "message required" }, { status: 400 });

    const sid = sessionId ?? `session-${Date.now()}`;
    const userId = user.id;
    const lf = getLangfuseClient();
    let trace: any = null;
    if (lf) {
      try {
        trace = lf.trace({
          id: `chat-${sid}-${Date.now()}`,
          name: "chat-turn",
          userId,
          sessionId: sid,
          input: message,
          metadata: { sessionId: sid },
        });
      } catch {}
    }

    // Load history scoped to this user + session
    const { data: historyRows } = await supabaseAdmin
      .from("chat_sessions")
      .select("role, content")
      .eq("session_id", sid)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(40);

    const history = (historyRows ?? []).map(r => ({ role: r.role, content: r.content }));
    const messages = [...history, { role: "user", content: message }];

    // Save user message with user_id
    await supabaseAdmin.from("chat_sessions").insert({
      session_id: sid,
      user_id: userId,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    });

    // ── Agentic loop ──────────────────────────────────────────────────────────
    let currentMessages = messages;
    let finalText = "";
    let iterations = 0;
    const MAX_ITERATIONS = 5;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      let iterSpan: any = null;
      let gen: any = null;
      try {
        iterSpan = trace?.span({
          name: `iteration-${iterations}`,
          input: { messageCount: currentMessages.length },
        });
      } catch {}
      try {
        gen = trace?.generation({
          name: "claude-sonnet-chat",
          model: "claude-sonnet-4-20250514",
          input: currentMessages,
          startTime: new Date(),
        });
      } catch {}

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
- Triggering monitoring checks on demand

When a user asks about a component, ALWAYS use query_stock to get live data. Don't guess.
When asked about alerts or issues, use get_alerts.

CRITICAL ALERT RULES — these are non-negotiable:
- If query_stock returns ANY of these conditions, you MUST call create_alert immediately:
  1. Only 1 supplier has stock (single source risk)
  2. Lead time > 8 weeks on any supplier
  3. Total stock < 500 units across all suppliers
  4. Zero stock across all suppliers (out of stock)
  5. No pricing available from any supplier
- Do NOT just mention the issue in text — always save it with create_alert.
- After saving the alert, tell the user it's been saved to their Alerts page.

Be concise, direct, and actionable. Format numbers clearly. Use bullet points for multi-item responses.
Current date: ${new Date().toISOString().split("T")[0]}`,
          messages: currentMessages,
          tools: TOOLS,
        }),
      });

      const claudeData = await claudeRes.json();

      if (!claudeRes.ok) {
        try {
          iterSpan?.end({ level: "ERROR", statusMessage: `Claude API error: ${claudeRes.status}` });
          gen?.end({ level: "ERROR", statusMessage: `Claude API error: ${claudeRes.status}` });
        } catch {}
        throw new Error(`Claude API error: ${JSON.stringify(claudeData)}`);
      }

      try {
        iterSpan?.end({ output: { stopReason: claudeData.stop_reason } });
      } catch {}
      try {
        gen?.end({
          output: claudeData.content,
          usage: {
            input: claudeData.usage?.input_tokens ?? 0,
            output: claudeData.usage?.output_tokens ?? 0,
            total: (claudeData.usage?.input_tokens ?? 0) + (claudeData.usage?.output_tokens ?? 0),
            unit: "TOKENS",
          },
        });
      } catch {}

      if (claudeData.stop_reason === "end_turn") {
        finalText = claudeData.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("\n");
        break;
      }

      if (claudeData.stop_reason === "tool_use") {
        const toolUseBlocks = claudeData.content.filter((b: any) => b.type === "tool_use");
        currentMessages = [...currentMessages, { role: "assistant", content: claudeData.content }];

        const toolResults = [];
        for (const block of toolUseBlocks) {
          let toolSpan: any = null;
          try {
            toolSpan = trace?.span({
              name: `tool:${block.name}`,
              input: block.input,
            });
          } catch {}
          const content = await executeTool(block.name, block.input);
          try {
            toolSpan?.end({ output: content });
          } catch {}
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content,
          });
        }

        currentMessages = [...currentMessages, { role: "user", content: toolResults }];
        continue;
      }

      finalText = claudeData.content
        ?.filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n") ?? "I couldn't process that request.";
      break;
    }

    // Save assistant response with user_id
    await supabaseAdmin.from("chat_sessions").insert({
      session_id: sid,
      user_id: userId,
      role: "assistant",
      content: finalText,
      created_at: new Date().toISOString(),
    });

    await logAuditEvent({
      action: "chat_message",
      details: { sessionId: sid, userId, userMessage: message.slice(0, 100), iterations },
    });

    try {
      trace?.update({ output: finalText });
    } catch {}
    await flushLangfuse();

    return NextResponse.json({ success: true, sessionId: sid, reply: finalText });

  } catch (err: any) {
    console.error("[Chat] Error:", err?.message);
    await flushLangfuse();
    return NextResponse.json({ error: err?.message ?? "Unknown error" }, { status: 500 });
  }
}

// ── GET: load sessions scoped to user ────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("sessionId");

  if (!sessionId) {
    // List this user's sessions only
    const { data } = await supabaseAdmin
      .from("chat_sessions")
      .select("session_id, content, created_at")
      .eq("user_id", user.id)
      .eq("role", "user")
      .order("created_at", { ascending: false })
      .limit(20);
    const sessions = [...new Map((data ?? []).map(r => [r.session_id, r])).values()];
    return NextResponse.json({ sessions });
  }

  // Load specific session — scoped to this user
  const { data } = await supabaseAdmin
    .from("chat_sessions")
    .select("role, content, created_at")
    .eq("session_id", sessionId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ messages: data ?? [] });
}