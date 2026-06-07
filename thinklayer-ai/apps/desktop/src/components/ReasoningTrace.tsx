import { ChatResult } from "../api";

// Shows the operational trace (not internal chain-of-thought): what the
// orchestrator did, how long each stage took, and the verifier's confidence.
export function ReasoningTrace({ result }: { result: ChatResult }) {
  const meta = result.metadata as Record<string, unknown>;
  return (
    <aside className="trace">
      <h3>Reasoning workflow</h3>
      <ul className="trace-steps">
        {result.trace.map((s, i) => (
          <li key={i}>
            <span className="step-name">{s.step}</span>
            <span className="step-detail">{s.detail}</span>
            <span className="step-ms">{s.ms} ms</span>
          </li>
        ))}
      </ul>
      <dl className="trace-meta">
        <dt>Task type</dt>
        <dd>{String(meta.task_type ?? "—")}</dd>
        <dt>Verifier confidence</dt>
        <dd>{meta.verifier_confidence != null ? `${meta.verifier_confidence}%` : "—"}</dd>
        <dt>Total time</dt>
        <dd>{String(meta.total_ms ?? "—")} ms</dd>
      </dl>
      <details>
        <summary>Plan</summary>
        <pre>{result.plan ?? "—"}</pre>
      </details>
      <details>
        <summary>Critique</summary>
        <pre>{result.critique ?? "—"}</pre>
      </details>
      <details>
        <summary>Verification</summary>
        <pre>{result.verification ?? "—"}</pre>
      </details>
    </aside>
  );
}
