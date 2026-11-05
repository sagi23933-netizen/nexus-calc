import Anthropic from '@anthropic-ai/sdk';
import { one, run } from '../db.js';
import { nowIso } from '../lib/utils.js';
import { config } from '../config.js';
import { getSection } from './settings.js';
import { DESIGN_JSON_SCHEMA, builtinDesign, sanitizeDesign } from './designer.js';

/** Claude models offered in the admin "AI models" screen. */
export const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5 — איכות עיצוב מרבית (ברירת מחדל)' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 — מהיר ואיכותי' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 — המהיר והחסכוני ביותר' },
  { id: 'claude-fable-5-1', label: 'Claude Fable 5.1 — המודל החזק ביותר' },
];
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

// Models that accept the server-side refusal fallback (`fallbacks: "default"`) on the Claude API.
const SERVER_FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);

export const DEFAULT_SYSTEM_PROMPT = `אתה מעצב גרפי בכיר של "בולדיל" — אתר ישראלי של דילים מהירים מעסקים מקומיים.
המשימה: לעצב כרטיס פרסום לדיל, לפי נתוני הדיל, הקטגוריה של העסק והעיר.

כללים:
- כל הטקסטים בעברית תקנית, קצרים, שיווקיים ומושכים. אין להמציא מחירים, אחוזים או הבטחות שלא הופיעו בנתונים.
- הכותרת (headline) עד 26 תווים; tagline עד 60 תווים; badge עד 14 תווים; ctaText עד 16 תווים.
- בחר פלטת צבעים שמתאימה לאופי הקטגוריה (למשל אוכל = חם ומעורר תיאבון, יופי = עדין, טכנולוגיה = כהה וניאוני) וגם לרמת ההנחה.
- הקפד על ניגודיות גבוהה: text חייב להיות קריא מעל מעבר הצבעים bg1→bg2, ו-priceText קריא מעל priceBg.
- הלוגו של העסק, המחיר המקורי המחוק, אחוז ההנחה, המחיר הסופי ופרטי ההתקשרות יוצגו אוטומטית — אל תכתוב אותם בטקסטים.
- emoji אחד בלבד שמתאים לעסק.
- גוון ויצירתיות: כל כרטיס צריך להרגיש ייחודי.`;

function userPrompt({ deal, business, category, city, creativity }) {
  const lines = [
    `שם העסק: ${business.name}`,
    `קטגוריה: ${category?.name || 'כללי'}${category?.ai_hint ? ` (סגנון מומלץ: ${category.ai_hint})` : ''}`,
    `עיר: ${city?.name || '—'}`,
    `כותרת הדיל: ${deal.title}`,
    deal.description ? `תיאור: ${deal.description}` : null,
    `מחיר מקורי: ₪${deal.original_price}`,
    `אחוז הנחה: ${deal.discount_percent}%`,
    `מחיר אחרי הנחה: ₪${deal.final_price}`,
    `משך הדיל: ${deal.duration_hours} שעות`,
    `רמת יצירתיות מבוקשת: ${creativity === 'bold' ? 'נועזת ומפתיעה' : creativity === 'calm' ? 'נקייה ומאופקת' : 'מאוזנת'}`,
  ].filter(Boolean);
  return `עצב כרטיס לדיל הבא:\n${lines.join('\n')}\n\nהחזר את מפרט העיצוב בלבד.`;
}

function maskKey(key) {
  if (!key) return '';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export function publicModel(m) {
  if (!m) return null;
  return {
    id: m.id,
    name: m.name,
    provider: m.provider,
    model_id: m.model_id,
    effort: m.effort,
    max_tokens: m.max_tokens,
    system_prompt: m.system_prompt,
    creativity: m.creativity,
    is_active: !!m.is_active,
    has_key: !!m.api_key || (m.provider === 'anthropic' && !!config.anthropicKey),
    key_source: m.api_key ? 'db' : m.provider === 'anthropic' && config.anthropicKey ? 'env' : 'none',
    api_key_masked: maskKey(m.api_key),
    last_test_at: m.last_test_at,
    last_test_ok: m.last_test_ok == null ? null : !!m.last_test_ok,
    last_test_message: m.last_test_message,
    created_at: m.created_at,
    updated_at: m.updated_at,
  };
}

export const activeModel = () => one('SELECT * FROM ai_models WHERE is_active = 1 ORDER BY id LIMIT 1');

function logCall(entry) {
  run(
    `INSERT INTO ai_logs(ai_model_id, provider, model_id, purpose, business_id, deal_id, success, latency_ms, input_tokens, output_tokens, error, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    entry.aiModelId ?? null, entry.provider, entry.modelId || '', entry.purpose, entry.businessId ?? null, entry.dealId ?? null,
    entry.success ? 1 : 0, entry.latencyMs || 0, entry.inputTokens || 0, entry.outputTokens || 0, (entry.error || '').slice(0, 500), nowIso(),
  );
}

function describeError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'מפתח API לא תקין';
  if (err instanceof Anthropic.PermissionDeniedError) return 'אין הרשאה למודל הזה עם המפתח הנוכחי';
  if (err instanceof Anthropic.NotFoundError) return 'המודל לא נמצא — בדוק את מזהה המודל';
  if (err instanceof Anthropic.RateLimitError) return 'חריגה ממגבלת הקריאות — נסה שוב בעוד רגע';
  if (err instanceof Anthropic.BadRequestError) return `בקשה לא תקינה: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionTimeoutError) return 'תם הזמן לקבלת תשובה מהמודל';
  if (err instanceof Anthropic.APIConnectionError) return 'אין חיבור לשרת ה-AI';
  if (err instanceof Anthropic.APIError) return `שגיאת API ${err.status ?? ''}: ${err.message}`;
  return err?.message || 'שגיאה לא ידועה';
}

/** Call Claude and return the parsed JSON design (unsanitized) + usage. */
async function callClaude(model, prompt) {
  const apiKey = model.api_key || config.anthropicKey;
  if (!apiKey) throw new Error('לא הוגדר מפתח API עבור המודל');
  const client = new Anthropic({ apiKey, timeout: getSection('ai').timeoutMs, maxRetries: 1 });
  const modelId = model.model_id || 'claude-opus-5-5';
  const effort = EFFORTS.includes(model.effort) ? model.effort : 'low';
  const params = {
    model: modelId,
    max_tokens: Math.min(Math.max(Number(model.max_tokens) || 16000, 2000), 32000),
    system: model.system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort, format: { type: 'json_schema', schema: DESIGN_JSON_SCHEMA } },
  };
  let response;
  if (SERVER_FALLBACK_MODELS.has(modelId)) {
    // On a safety-classifier decline the API re-runs the request on Anthropic's recommended fallback model.
    response = await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' });
  } else {
    response = await client.messages.create(params);
  }
  if (response.stop_reason === 'refusal') throw new Error('המודל סירב לעצב את הכרטיס');
  if (response.stop_reason === 'max_tokens') throw new Error('תשובת המודל נקטעה (max_tokens)');
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('המודל החזיר JSON לא תקין');
  }
  return { parsed, usage: response.usage || {}, servedBy: response.model || modelId };
}

/**
 * Design a deal card. Uses the active AI model; falls back to the built-in designer if AI is
 * disabled, not configured or failing (when fallback is enabled in settings).
 */
export async function designDeal({ deal, business, category, city, purpose = 'deal_design', seed }) {
  const fallback = builtinDesign({ deal, categorySlug: category?.slug, seed: seed ?? deal.id ?? Date.now() });
  const aiSettings = getSection('ai');
  const model = activeModel();
  if (!aiSettings.enabled || !model || model.provider === 'builtin') {
    return { design: fallback, source: 'builtin', model: 'builtin' };
  }
  const started = Date.now();
  try {
    const { parsed, usage, servedBy } = await callClaude(model, userPrompt({ deal, business, category, city, creativity: model.creativity }));
    logCall({
      aiModelId: model.id, provider: model.provider, modelId: servedBy, purpose, businessId: business?.id, dealId: deal.id,
      success: true, latencyMs: Date.now() - started, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens,
    });
    return { design: sanitizeDesign(parsed, fallback), source: 'ai', model: servedBy };
  } catch (err) {
    const message = describeError(err);
    logCall({ aiModelId: model.id, provider: model.provider, modelId: model.model_id, purpose, businessId: business?.id, dealId: deal.id, success: false, latencyMs: Date.now() - started, error: message });
    if (!aiSettings.fallbackToBuiltin) throw new Error(`עיצוב ה-AI נכשל: ${message}`);
    return { design: fallback, source: 'builtin', model: 'builtin', warning: message };
  }
}

/** Admin "test connection" for a configured model. */
export async function testModel(model) {
  const started = Date.now();
  if (model.provider === 'builtin') {
    run('UPDATE ai_models SET last_test_at = ?, last_test_ok = 1, last_test_message = ? WHERE id = ?', nowIso(), 'המעצב המובנה פעיל', model.id);
    return { ok: true, message: 'המעצב המובנה פעיל ואינו דורש חיבור', latencyMs: 0 };
  }
  const sample = {
    deal: { id: 0, title: 'פיצה משפחתית + שתייה', description: 'רק היום, באיסוף עצמי', original_price: 89, discount_percent: 40, final_price: 53.4, duration_hours: 6 },
    business: { id: null, name: 'פיצה בזק' },
    category: { name: 'מסעדות ואוכל', slug: 'food' },
    city: { name: 'תל אביב-יפו' },
  };
  try {
    const { parsed, usage, servedBy } = await callClaude(model, userPrompt({ ...sample, creativity: model.creativity }));
    const design = sanitizeDesign(parsed, builtinDesign({ deal: sample.deal, categorySlug: 'food', seed: 7 }));
    const latencyMs = Date.now() - started;
    const message = `החיבור תקין (${servedBy}, ${latencyMs}ms)`;
    run('UPDATE ai_models SET last_test_at = ?, last_test_ok = 1, last_test_message = ? WHERE id = ?', nowIso(), message, model.id);
    logCall({ aiModelId: model.id, provider: model.provider, modelId: servedBy, purpose: 'test', success: true, latencyMs, inputTokens: usage.input_tokens, outputTokens: usage.output_tokens });
    return { ok: true, message, latencyMs, design, sample: sample.deal };
  } catch (err) {
    const message = describeError(err);
    run('UPDATE ai_models SET last_test_at = ?, last_test_ok = 0, last_test_message = ? WHERE id = ?', nowIso(), message, model.id);
    logCall({ aiModelId: model.id, provider: model.provider, modelId: model.model_id, purpose: 'test', success: false, latencyMs: Date.now() - started, error: message });
    return { ok: false, message, latencyMs: Date.now() - started };
  }
}
