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
    .replace(/`(.+?)`/g, '<code style="background:rgba(125,211,252,0.1);padding:1px 5px;border-radius:4px;font-family:monospace;font-size:0.85em;color:#7dd3fc">$1</code>')
    .replace(/^• (.+)$/gm, '<div style="display:flex;gap:8px;margin:2px 0"><span style="color:#7dd3fc;margin-top:2px">•</span><span>$1</span></div>')
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

// ── Main Page ─────────────────────────────────────────────────────────────────
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
    <div className="flex h-[calc(100vh-80px)] gap-0 -m-6 md:-m-8 overflow-hidden">

      {/* ── Sessions Sidebar ─────────────────────────────────────────────── */}
      <aside
        className="flex flex-col transition-all duration-300 overflow-hidden"
        style={{
          width: sidebarOpen ? "240px" : "0px",
          minWidth: sidebarOpen ? "240px" : "0px",
          borderRight: "1px solid rgba(125,211,252,0.08)",
          background: "rgba(10,14,26,0.6)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-4 flex-shrink-0" style={{ borderBottom: "1px solid rgba(125,211,252,0.08)" }}>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#7dd3fc" }}>History</span>
          <button
            onClick={newSession}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{ background: "rgba(125,211,252,0.1)", color: "#7dd3fc", border: "1px solid rgba(125,211,252,0.2)" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "14px" }}>add</span>
            New
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-2">
          {sessions.length === 0 && (
            <p className="text-xs text-center py-8 px-4" style={{ color: "#4a6070" }}>No conversations yet</p>
          )}
          {sessions.map(s => (
            <button
              key={s.session_id}
              onClick={() => loadSession(s.session_id)}
              className="w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all"
              style={{
                background: sessionId === s.session_id ? "rgba(125,211,252,0.1)" : "transparent",
                border: sessionId === s.session_id ? "1px solid rgba(125,211,252,0.2)" : "1px solid transparent",
              }}
            >
              <p className="text-xs font-medium truncate" style={{ color: sessionId === s.session_id ? "#7dd3fc" : "#a0b4c4" }}>
                {s.content.slice(0, 40)}...
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#4a6070" }}>
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
            style={{ background: "rgba(10,14,26,0.85)", border: "2px dashed rgba(125,211,252,0.5)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: "48px", color: "#7dd3fc" }}>upload_file</span>
            <p className="text-lg font-semibold" style={{ color: "#7dd3fc" }}>Drop your BOM CSV here</p>
          </div>
        )}

        {/* Chat header */}
        <div
          className="flex items-center gap-3 px-6 py-3 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(125,211,252,0.08)", background: "rgba(10,14,26,0.4)" }}
        >
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: "rgba(125,211,252,0.05)", color: "#a0b4c4" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>menu</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(125,211,252,0.12)", border: "1px solid rgba(125,211,252,0.25)" }}>
              <span className="material-symbols-outlined" style={{ fontSize: "16px", color: "#7dd3fc", fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e0e8f0" }}>OmniProcure AI</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22c55e" }} />
                <span className="text-xs" style={{ color: "#4a6070" }}>Live — OEM API + BOM upload ready</span>
              </div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {sessionId && (
              <button
                onClick={newSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all"
                style={{ background: "rgba(125,211,252,0.08)", color: "#7dd3fc", border: "1px solid rgba(125,211,252,0.15)" }}
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
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: "rgba(125,211,252,0.1)", border: "1px solid rgba(125,211,252,0.2)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "32px", color: "#7dd3fc", fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                </div>
                <h2 className="text-xl font-semibold mb-2" style={{ color: "#e0e8f0" }}>OmniProcure AI</h2>
                <p className="text-sm" style={{ color: "#a0b4c4" }}>
                  Ask about component stock, pricing, alerts, or drop a BOM CSV to source parts instantly.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 w-full">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => s.icon === "upload_file" ? fileInputRef.current?.click() : send(s.text)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all"
                    style={{ background: "rgba(15,21,36,0.6)", border: "1px solid rgba(125,211,252,0.1)" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(125,211,252,0.3)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(125,211,252,0.1)")}
                  >
                    <span className="material-symbols-outlined flex-shrink-0"
                      style={{ fontSize: "18px", color: "#7dd3fc", fontVariationSettings: "'FILL' 1" }}>
                      {s.icon}
                    </span>
                    <span className="text-xs" style={{ color: "#a0b4c4" }}>{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message bubbles */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: "rgba(125,211,252,0.12)", border: "1px solid rgba(125,211,252,0.2)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#7dd3fc", fontVariationSettings: "'FILL' 1" }}>
                    smart_toy
                  </span>
                </div>
              )}
              <div
                className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={msg.role === "user"
                  ? { background: "rgba(125,211,252,0.12)", border: "1px solid rgba(125,211,252,0.2)", color: "#e0e8f0", borderRadius: "18px 18px 4px 18px" }
                  : { background: "rgba(15,21,36,0.7)", border: "1px solid rgba(125,211,252,0.08)", color: "#c8d8e4", borderRadius: "18px 18px 18px 4px" }
                }
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
              />
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ background: "rgba(26,36,56,0.8)", border: "1px solid rgba(125,211,252,0.15)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#a0b4c4" }}>person</span>
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {(loading || uploadingFile) && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center"
                style={{ background: "rgba(125,211,252,0.12)", border: "1px solid rgba(125,211,252,0.2)" }}>
                <span className="material-symbols-outlined" style={{ fontSize: "15px", color: "#7dd3fc", fontVariationSettings: "'FILL' 1" }}>
                  smart_toy
                </span>
              </div>
              <div className="px-4 py-3 rounded-2xl flex items-center gap-2"
                style={{ background: "rgba(15,21,36,0.7)", border: "1px solid rgba(125,211,252,0.08)", borderRadius: "18px 18px 18px 4px" }}>
                {uploadingFile && <span className="text-xs mr-1" style={{ color: "#7dd3fc" }}>Sourcing BOM...</span>}
                {[0, 1, 2].map(j => (
                  <span key={j} className="w-1.5 h-1.5 rounded-full"
                    style={{ background: "#7dd3fc", animation: "bounce 1.2s infinite", animationDelay: `${j * 0.2}s`, display: "inline-block" }} />
                ))}
                <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0);opacity:0.4} 40%{transform:translateY(-6px);opacity:1} }`}</style>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex-shrink-0 px-6 py-4"
          style={{ borderTop: "1px solid rgba(125,211,252,0.08)", background: "rgba(10,14,26,0.4)" }}>
          <div className="flex items-end gap-3 rounded-2xl px-4 py-3"
            style={{ background: "rgba(15,21,36,0.8)", border: "1px solid rgba(125,211,252,0.15)" }}>

            {/* File upload button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              title="Upload BOM CSV"
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all mb-0.5"
              style={{
                background: "rgba(125,211,252,0.08)",
                border: "1px solid rgba(125,211,252,0.15)",
                color: "#7dd3fc",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(125,211,252,0.18)")}
              onMouseLeave={e => (e.currentTarget.style.background = "rgba(125,211,252,0.08)")}
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
              style={{ color: "#e0e8f0", maxHeight: "120px", overflowY: "auto" }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: input.trim() && !loading ? "rgba(125,211,252,0.2)" : "rgba(125,211,252,0.05)",
                border: `1px solid ${input.trim() && !loading ? "rgba(125,211,252,0.4)" : "rgba(125,211,252,0.1)"}`,
                cursor: input.trim() && !loading ? "pointer" : "not-allowed",
              }}
            >
              <span className="material-symbols-outlined"
                style={{ fontSize: "18px", color: input.trim() && !loading ? "#7dd3fc" : "#4a6070", fontVariationSettings: "'FILL' 1" }}>
                send
              </span>
            </button>
          </div>
          <p className="text-xs text-center mt-2" style={{ color: "#4a6070" }}>
            Enter to send · Shift+Enter for new line · Drop a CSV to upload BOM
          </p>
        </div>
      </div>
    </div>
  );
}