import { useEffect, useRef, useState } from "react";
import { api, ChatResult, ModelInfo, ReasoningMode } from "./api";
import { ModelSelector } from "./components/ModelSelector";
import { ReasoningTrace } from "./components/ReasoningTrace";

interface Turn {
  role: "user" | "assistant";
  content: string;
  result?: ChatResult;
}

export default function App() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [modelId, setModelId] = useState("ollama:llama3.2");
  const [mode, setMode] = useState<ReasoningMode>("deep");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [selected, setSelected] = useState<ChatResult | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .listModels()
      .then((res) => {
        setModels(res.models);
        if (res.default) setModelId(res.default);
      })
      .catch(() => setError("Backend offline. Start it with: uvicorn backend.main:app --port 8000"));
  }, []);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [turns]);

  async function send() {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput("");
    setError(null);
    setTurns((t) => [...t, { role: "user", content: prompt }]);
    setLoading(true);
    try {
      const result = await api.chat({ prompt, model_id: modelId, mode, conversation_id: conversationId });
      setConversationId(result.conversation_id);
      setTurns((t) => [...t, { role: "assistant", content: result.final_answer, result }]);
      setSelected(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app">
      <header>
        <h1>ThinkLayer AI</h1>
        <ModelSelector
          models={models}
          modelId={modelId}
          mode={mode}
          onModelChange={setModelId}
          onModeChange={setMode}
        />
      </header>

      <div className="body">
        <main className="chat">
          {turns.map((turn, i) => (
            <div
              key={i}
              className={`msg ${turn.role}`}
              onClick={() => turn.result && setSelected(turn.result)}
            >
              <div className="msg-role">{turn.role}</div>
              <div className="msg-content">{turn.content}</div>
            </div>
          ))}
          {loading && <div className="msg assistant"><em>thinking…</em></div>}
          {error && <div className="error">{error}</div>}
          <div ref={endRef} />
        </main>

        {selected && <ReasoningTrace result={selected} />}
      </div>

      <footer>
        <textarea
          value={input}
          placeholder="Ask anything — ThinkLayer plans, solves, critiques and verifies before answering."
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button onClick={send} disabled={loading}>
          Send
        </button>
      </footer>
    </div>
  );
}
