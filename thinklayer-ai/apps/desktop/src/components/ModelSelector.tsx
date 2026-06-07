import { ModelInfo, ReasoningMode } from "../api";

const MODES: ReasoningMode[] = ["fast", "deep", "research", "coding", "math", "agent"];

interface Props {
  models: ModelInfo[];
  modelId: string;
  mode: ReasoningMode;
  onModelChange: (id: string) => void;
  onModeChange: (mode: ReasoningMode) => void;
}

export function ModelSelector({ models, modelId, mode, onModelChange, onModeChange }: Props) {
  const available = models.filter((m) => m.available && m.name);
  return (
    <div className="topbar">
      <label>
        Model
        <select value={modelId} onChange={(e) => onModelChange(e.target.value)}>
          {available.length === 0 && <option value={modelId}>{modelId} (offline?)</option>}
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.id}
            </option>
          ))}
        </select>
      </label>
      <label>
        Mode
        <select value={mode} onChange={(e) => onModeChange(e.target.value as ReasoningMode)}>
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
