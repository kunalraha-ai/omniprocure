export default function ObservabilityPage() {
  return (
    <div style={{ height: "calc(100vh - 80px)", display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <h1>Observability</h1>
        <p>Live LLM traces, cost, and latency via Langfuse.</p>
      </div>
      <iframe
        src={process.env.NEXT_PUBLIC_LANGFUSE_DASHBOARD_URL ?? "https://cloud.langfuse.com"}
        style={{ flex: 1, border: "none", borderRadius: 12 }}
      />
    </div>
  );
}