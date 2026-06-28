"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "assistant";
  content: string;
  created_at?: string;
}

interface Session {
  session_id: string;
  content: string;
  created_at: string;
}

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code style="background:rgba(94,188,248,0.12);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;color:#5ebcf8">$1</code>')
    .replace(/^• (.+)$/gm, '<div style="display:flex;gap:8px;margin:2px 0"><span style="color:#5ebcf8;margin-top:2px">•</span><span>$1</span></div>')
    .replace(/\n/g, "<br/>");
}

// ── Suggested prompts ─────────────────────────────────────────────────────────
const SUGGESTIONS = [
  { icon: "inventory_2", text: "What's the stock on ESP32-WROOM-32?" },
  { icon: "notifications_active", text: "Show me all high urgency alerts" },
  { icon: "satellite_alt", text: "Run a monitor check on all watched parts" },
  { icon: "playlist_add", text: "Add STM32F103C8T6 to my watchlist" },
  { icon: "upload_file", text: "Upload a BOM file to source parts" },
  { icon: "bar_chart", text: "What components are being monitored?" },
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const C = {
    bg: "#1c202a",
    sidebar: "#232833",
    card: "#232833",
    border: "#2f3644",
    sky: "#5ebcf8",
    skySoft: "rgba(94, 188, 248, 0.12)",
    text: "#f1f5f9",
    muted: "#94a3b8",
    mutedDim: "#64748b",
    shadow: "6px 6px 12px #12141a, -6px -6px 12px #262c3a",
    shadowInner: "inset 3px 3px 6px #12141a, inset -3px -3px 6px #262c3a",
  };

  // Load sessions list
  useEffect(() => {
    fetch("/api/chat")
      .then(r => r.json())
      .then(d => setSessions(d.sessions ?? []));
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load a session
  const loadSession = useCallback(async (sid: string) => {
    setSessionId(sid);
    const res = await fetch(`/api/chat?sessionId=${sid}`);
    const data = await res.json();
    setMessages(data.messages ?? []);
  }, []);

  // New session
  const newSession = useCallback(() => {
    setSessionId(null);
    setMessages([]);
    inputRef.current?.focus();
  }, []);

  // Send message
  const send = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;

    setInput("");
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId }),
      });
      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        fetch("/api/chat").then(r => r.json()).then(d => setSessions(d.sessions ?? []));
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? data.error ?? "Something went wrong." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Connection error. Please try again." }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, sessionId]);

  // Handle BOM file upload
  const handleBomFile = useCallback(async (file: File) => {
    if (!file) return;
    const isValid = file.name.endsWith(".csv") || file.name.endsWith(".txt");
    if (!isValid) {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Only CSV files are supported for BOM upload." }]);
      return;
    }

    setUploadingFile(true);
    setMessages(prev => [...prev,
      { role: "user", content: `📎 Uploading BOM: **${file.name}**` },
      { role: "assistant", content: `📋 Got it! Parsing **${file.name}** now — I'll source suppliers for each part and add them to your monitored parts list...` }
    ]);
    setLoading(true);

    try {
      const text = await file.text();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Parse and source this BOM file named "${file.name}":\n\n${text}`,
          sessionId,
          isBom: true,
        }),
      });
      const data = await res.json();

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId);
        fetch("/api/chat").then(r => r.json()).then(d => setSessions(d.sessions ?? []));
      }

      setMessages(prev => [...prev, { role: "assistant", content: data.reply ?? "BOM processed." }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Failed to process BOM. Please try again." }]);
    } finally {
      setLoading(false);
      setUploadingFile(false);
    }
  }, [sessionId]);

  // Drag and drop on the whole chat area
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleBomFile(file);
  };

  // Handle Enter key
  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-[calc(100vh-80px)] gap-0 -m-6 md:-m-8 overflow-hidden" style={{ background: C.bg }}>

      {/* ── Sessions Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="flex flex-col transition-all duration-300 overflow-hidden"
        style={{
          width: sidebarOpen ? "240px" : "0px",
          minWidth: sidebarOpen ? "240px" : "0px",
          borderRight: `1.5px solid ${C.border}`,
          background: C.sidebar,
        }}
      >
        <div className="flex items-center justify-between px-4 py-4 flex-shrink-0" style={{ borderBottom: `1.5px solid ${C.border}` }}>
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: C.sky }}>History</span>
          <button
            onClick={newSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-neu-raised-sm"
            style={{ background: C.bg, color: C.sky, border: `1px solid ${C.border}` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-2">
          {sessions.length === 0 && (
            <p className="text-xs text-center py-8 px-4" style={{ color: C.mutedDim }}>No conversations yet</p>
          )}
          {sessions.map(s => (
            <button
              key={s.session_id}
              onClick={() => loadSession(s.session_id)}
              className="w-full text-left px-3 py-2.5 rounded-xl mb-1.5 transition-all"
              style={{
                background: sessionId === s.session_id ? C.skySoft : "transparent",
                border: sessionId === s.session_id ? `1px solid ${C.sky}` : "1px solid transparent",
              }}
            >
              <p className="text-xs font-bold truncate" style={{ color: sessionId === s.session_id ? C.sky : C.text }}>
                {s.content.slice(0, 40)}...
              </p>
              <p className="text-[10px] mt-1 font-semibold" style={{ color: sessionId === s.session_id ? C.sky : C.mutedDim }}>
                {new Date(s.created_at).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* ── Main Chat Area ────────────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-hidden relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {dragOver && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ background: "rgba(28,32,42,0.9)", border: `2.5px dashed ${C.sky}` }}>
            <span className="material-symbols-outlined" style={{ fontSize: "48px", color: C.sky }}>upload_file</span>
            <p className="text-lg font-bold" style={{ color: C.sky }}>Drop your BOM CSV here to parse</p>
          </div>
        )}

        {/* Chat header */}
        <div
          className="flex items-center gap-3 px-6 py-3.5 flex-shrink-0"
          style={{ borderBottom: `1.5px solid ${C.border}`, background: C.sidebar }}
        >
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors shadow-neu-raised-sm"
            style={{ background: C.bg, color: C.muted, border: `1px solid ${C.border}` }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>menu</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-neu-raised-sm"
              style={{ background: C.bg, border: `1px solid ${C.border}` }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: C.sky, fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
            </div>
            <div>
              <p className="text-sm font-bold" style={{ color: C.text }}>OmniProcure AI Assistant</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#34d399" }} />
                <span className="text-xs font-semibold" style={{ color: C.mutedDim }}>Telemetry API channels active</span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {sessionId && (
              <button
                onClick={newSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-neu-raised-sm"
                style={{ background: C.bg, color: C.sky, border: `1px solid ${C.border}` }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
                New Chat
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

          {/* Empty state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center h-full gap-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-card-raised"
                  style={{ background: C.card, border: `1.5px solid ${C.border}` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "32px", color: C.sky, fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: C.text }}>Sourcing AI Agent</h2>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  Provide a component part number to analyze distributor inventories, or drag and drop a BOM file here to run a batch import.
                </p>
              </div>

              {/* Suggestions bento grid */}
              <div className="grid grid-cols-2 gap-3 w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => s.icon === "upload_file" ? fileInputRef.current?.click() : send(s.text)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all shadow-neu-raised-sm"
                    style={{ background: C.card, border: `1px solid ${C.border}` }}
                    onMouseEnter={e => { (e.currentTarget.style.borderColor = C.sky); }}
                    onMouseLeave={e => { (e.currentTarget.style.borderColor = C.border); }}
                  >
                    <span className="material-symbols-outlined flex-shrink-0"
                      style={{ fontSize: "18px", color: C.sky, fontVariationSettings: "'FILL' 1" }}>
                      {s.icon}
                    </span>
                    <span className="text-xs font-bold" style={{ color: C.muted }}>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 shadow-neu-raised-sm"
                  style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "15px", color: C.sky, fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                </div>
              )}
              <div
                className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-neu-raised-sm"
                style={msg.role === "user"
                  ? { background: C.skySoft, border: `1px solid ${C.sky}`, color: C.text, borderRadius: "18px 18px 4px 18px" }
                  : { background: C.card, border: `1px solid ${C.border}`, color: C.text, borderRadius: "18px 18px 18px 4px" }
                }
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5 shadow-neu-raised-sm"
                  style={{ background: C.card, border: `1px solid ${C.border}` }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "15px", color: C.muted }}>person</span>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {(loading || uploadingFile) && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center shadow-neu-raised-sm"
                style={{ background: C.card, border: `1px solid ${C.border}` }}>
                <span className="material-symbols-outlined" style={{ fontSize: "15px", color: C.sky, fontVariationSettings: "'FILL' 1" }}>
                  smart_toy
                </span>
              </div>
              <div className="px-4 py-3 rounded-2xl flex items-center gap-2 shadow-neu-raised-sm"
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: "18px 18px 18px 4px" }}>
                {uploadingFile && <span className="text-xs mr-1 font-semibold" style={{ color: C.sky }}>Processing BOM file...</span>}
                {[0, 1, 2].map(j => (
                  <span key={j} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: C.sky, animation: "bounce 1.2s infinite", animationDelay: `${j * 0.2}s`, display: "inline-block" }} />
                ))}
                <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-6px);opacity:1} }`}</style>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-6 py-4"
          style={{ borderTop: `1.5px solid ${C.border}`, background: C.sidebar }}>
          <div className="flex items-end gap-3 rounded-2xl px-4 py-3 shadow-neu-sunken"
            style={{ background: C.bg, border: `1px solid ${C.border}` }}>

            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload BOM CSV"
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all mb-0.5 shadow-neu-raised-sm"
              style={{
                background: C.card,
                border: `1px solid ${C.border}`,
                color: C.sky,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.border; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.card; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>upload_file</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleBomFile(f); e.target.value = ""; }}
            />

            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKey}
              placeholder="Ask about stock, alerts, or upload a BOM CSV..."
              className="flex-1 bg-transparent outline-none resize-none text-sm leading-relaxed"
              style={{ color: C.text, maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-neu-raised-sm"
              style={{
                background: input.trim() && !loading ? C.sky : C.card,
                border: "none",
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              }}
            >
              <span className="material-symbols-outlined"
                style={{ fontSize: "18px", color: input.trim() && !loading ? C.bg : C.mutedDim, fontVariationSettings: "'FILL' 1" }}>
                send
              </span>
            </button>
          </div>
          <p className="text-xs text-center mt-2 font-semibold" style={{ color: C.mutedDim }}>
            Enter to send · Shift+Enter for new line · Drag &amp; drop BOM files directly into the window
          </p>
        </div>
      </div>
    </div>
  );
}