import { useEffect, useState } from 'react';
import { aiApi, getToken, setToken, type Agent, type AuthUser, type AgentRunResult } from '../lib/aiApi';

type Status = 'loading' | 'unauthenticated' | 'ready' | 'error';

export default function AIAgentsPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => { void bootstrap(); }, []);

  async function bootstrap() {
    try {
      if (!getToken()) { setStatus('unauthenticated'); return; }
      const me = await aiApi.me();
      setUser(me.user);
      const list = await aiApi.listAgents();
      setAgents(list.agents);
      setStatus('ready');
    } catch (e) {
      setToken(null);
      setStatus('unauthenticated');
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function refresh() {
    const list = await aiApi.listAgents();
    setAgents(list.agents);
  }

  function logout() {
    setToken(null);
    setUser(null);
    setAgents([]);
    setStatus('unauthenticated');
  }

  if (status === 'loading') {
    return <div className="p-8 text-center text-gray-500">טוען...</div>;
  }
  if (status === 'unauthenticated') {
    return <AuthPanel onSuccess={(token, user) => {
      setToken(token); setUser(user); setStatus('loading'); void bootstrap();
    }} initialError={error} />;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">מנוע סוכני AI</h2>
          <p className="text-sm text-gray-500">מחובר כ-{user?.email} ({user?.role})</p>
        </div>
        <button type="button" onClick={logout} className="px-3 py-1 text-sm border rounded">התנתק</button>
      </div>

      <ApiKeyManager />
      <CreateAgentForm onCreated={refresh} />
      <AgentList agents={agents} onChanged={refresh} />
    </div>
  );
}

function AuthPanel({ onSuccess, initialError }: {
  onSuccess: (token: string, user: AuthUser) => void;
  initialError: string | null;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const res = mode === 'login'
        ? await aiApi.login(email, password)
        : await aiApi.register(email, password, name);
      onSuccess(res.token, res.user);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div dir="rtl" className="max-w-md mx-auto mt-12 border rounded-lg p-6 bg-white">
      <h2 className="text-lg font-bold mb-4">{mode === 'login' ? 'התחברות' : 'הרשמה'} למנוע ה-AI</h2>
      <form onSubmit={submit} className="space-y-3">
        {mode === 'register' && (
          <input className="w-full border rounded px-3 py-2" placeholder="שם" value={name}
                 onChange={e => setName(e.target.value)} />
        )}
        <input className="w-full border rounded px-3 py-2" placeholder="אימייל" type="email" required
               value={email} onChange={e => setEmail(e.target.value)} />
        <input className="w-full border rounded px-3 py-2" placeholder="סיסמה (לפחות 6 תווים)" type="password" required
               value={password} onChange={e => setPassword(e.target.value)} />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" disabled={busy}
                className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-50">
          {busy ? '...' : (mode === 'login' ? 'התחבר' : 'הירשם')}
        </button>
      </form>
      <button type="button" className="mt-3 text-sm text-blue-600 underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'אין לי חשבון — הירשם' : 'יש לי חשבון — התחבר'}
      </button>
    </div>
  );
}

function ApiKeyManager() {
  const [keys, setKeys] = useState<{ id: string; provider: string; label: string | null }[]>([]);
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [key, setKey] = useState('');
  const [label, setLabel] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { void refresh(); }, []);
  async function refresh() {
    const res = await aiApi.listApiKeys();
    setKeys(res.keys);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await aiApi.createApiKey(provider, key, label || undefined);
      setKey(''); setLabel(''); setOpen(false);
      await refresh();
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('למחוק מפתח?')) return;
    await aiApi.deleteApiKey(id);
    await refresh();
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">מפתחות AI Provider</h3>
        <button type="button" className="text-sm text-blue-600 underline"
                onClick={() => setOpen(o => !o)}>
          {open ? 'בטל' : '+ הוסף מפתח'}
        </button>
      </div>
      {open && (
        <form onSubmit={add} className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <select className="border rounded px-2 py-1" value={provider}
                  onChange={e => setProvider(e.target.value as 'openai' | 'anthropic')}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
          </select>
          <input className="border rounded px-2 py-1" placeholder="תיוג (אופציונלי)"
                 value={label} onChange={e => setLabel(e.target.value)} />
          <input className="border rounded px-2 py-1 md:col-span-1" placeholder="API key"
                 type="password" value={key} onChange={e => setKey(e.target.value)} required />
          <button type="submit" disabled={busy} className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50">
            שמור
          </button>
        </form>
      )}
      {keys.length === 0 ? (
        <p className="text-sm text-gray-500">אין מפתחות — סוכנים יפעלו במצב mock.</p>
      ) : (
        <ul className="text-sm divide-y">
          {keys.map(k => (
            <li key={k.id} className="flex items-center justify-between py-1">
              <span>{k.provider} {k.label && <span className="text-gray-500">— {k.label}</span>}</span>
              <button type="button" onClick={() => remove(k.id)} className="text-red-600 text-xs">מחק</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CreateAgentForm({ onCreated }: { onCreated: () => Promise<void> | void }) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<'openai' | 'anthropic'>('openai');
  const [model, setModel] = useState('gpt-4o-mini');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await aiApi.createAgent({ name, provider, model, systemPrompt });
      setName(''); setSystemPrompt('');
      await onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="border rounded-lg p-4 bg-white space-y-2">
      <h3 className="font-semibold">צור סוכן חדש</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="border rounded px-2 py-1" placeholder="שם הסוכן" required
               value={name} onChange={e => setName(e.target.value)} />
        <select className="border rounded px-2 py-1" value={provider}
                onChange={e => {
                  const p = e.target.value as 'openai' | 'anthropic';
                  setProvider(p);
                  setModel(p === 'openai' ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001');
                }}>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input className="border rounded px-2 py-1" placeholder="מודל"
               value={model} onChange={e => setModel(e.target.value)} />
      </div>
      <textarea className="w-full border rounded px-2 py-1 min-h-[80px]"
                placeholder="System prompt — מה הסוכן עושה?"
                value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)} />
      {err && <p className="text-sm text-red-600">{err}</p>}
      <button type="submit" disabled={busy}
              className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
        {busy ? '...' : 'צור'}
      </button>
    </form>
  );
}

function AgentList({ agents, onChanged }: { agents: Agent[]; onChanged: () => Promise<void> | void }) {
  if (agents.length === 0) {
    return <p className="text-gray-500">אין סוכנים עדיין. צור את הראשון.</p>;
  }
  return (
    <div className="space-y-3">
      {agents.map(a => <AgentCard key={a.id} agent={a} onChanged={onChanged} />)}
    </div>
  );
}

function AgentCard({ agent, onChanged }: { agent: Agent; onChanged: () => Promise<void> | void }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<AgentRunResult | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!input.trim()) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const res = await aiApi.runAgent(agent.id, input);
      setResult(res);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!confirm(`למחוק את "${agent.name}"?`)) return;
    await aiApi.deleteAgent(agent.id);
    await onChanged();
  }

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h4 className="font-semibold">{agent.name}</h4>
          <p className="text-xs text-gray-500">{agent.provider} / {agent.model}</p>
          {agent.systemPrompt && <p className="text-xs text-gray-600 mt-1">{agent.systemPrompt}</p>}
        </div>
        <button type="button" onClick={remove} className="text-red-600 text-xs">מחק</button>
      </div>
      <div className="flex gap-2">
        <textarea className="flex-1 border rounded px-2 py-1 min-h-[60px]"
                  placeholder="קלט לסוכן"
                  value={input} onChange={e => setInput(e.target.value)} />
        <button type="button" onClick={run} disabled={busy}
                className="px-4 py-2 bg-blue-600 text-white rounded h-fit disabled:opacity-50">
          {busy ? '...' : 'הרץ'}
        </button>
      </div>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {result && (
        <div className="mt-3 p-3 bg-gray-50 rounded text-sm">
          <p className="whitespace-pre-wrap">{result.output}</p>
          <p className="text-xs text-gray-500 mt-2">
            {result.model} · {result.promptTokens + result.completionTokens} tokens · {result.durationMs}ms
          </p>
        </div>
      )}
    </div>
  );
}
