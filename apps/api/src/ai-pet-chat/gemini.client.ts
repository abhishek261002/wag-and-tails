import { Logger } from '@nestjs/common';

export interface GeminiTurn {
  role: 'user' | 'model';
  text: string;
}

export interface PetChatModelOutput {
  onTopic: boolean;
  answer: string;
  suggestions: string[];
}

export class GeminiError extends Error {
  constructor(message: string, readonly status?: number, readonly kind: 'quota' | 'blocked' | 'config' | 'upstream' = 'upstream') {
    super(message);
  }
}

const logger = new Logger('GeminiClient');

const SAFETY_CATEGORIES = [
  'HARM_CATEGORY_HARASSMENT',
  'HARM_CATEGORY_HATE_SPEECH',
  'HARM_CATEGORY_SEXUALLY_EXPLICIT',
  'HARM_CATEGORY_DANGEROUS_CONTENT',
];

// Structured output: the model has to classify scope itself instead of us guessing
// with keyword lists, and its answer comes back as data rather than free text.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    on_topic: { type: 'BOOLEAN' },
    answer: { type: 'STRING' },
    suggestions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['on_topic', 'answer', 'suggestions'],
};

function mergeTurns(turns: GeminiTurn[]): GeminiTurn[] {
  const merged: GeminiTurn[] = [];
  for (const t of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.text += `\n${t.text}`;
    else merged.push({ ...t });
  }
  while (merged.length && merged[0]!.role !== 'user') merged.shift();
  return merged;
}

export async function generatePetChatReply(opts: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  history: GeminiTurn[];
  timeoutMs?: number;
}): Promise<PetChatModelOutput> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 25_000);

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': opts.apiKey },
    signal: controller.signal as any,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      contents: mergeTurns(opts.history).map((t) => ({ role: t.role, parts: [{ text: t.text }] })),
      generationConfig: {
        temperature: 0.6,
        topP: 0.9,
        maxOutputTokens: 2048,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
      safetySettings: SAFETY_CATEGORIES.map((category) => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' })),
    }),
  })
    .catch((e: Error) => {
      throw new GeminiError(e.name === 'AbortError' ? 'Gemini timed out' : `Gemini unreachable: ${e.message}`, undefined, 'upstream');
    })
    .finally(() => clearTimeout(timer));

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.warn(`Gemini ${res.status}: ${body.slice(0, 300)}`);
    if (res.status === 429) throw new GeminiError('Gemini quota exceeded', 429, 'quota');
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) {
      throw new GeminiError(`Gemini rejected the request (${res.status}) — check GEMINI_API_KEY / GEMINI_MODEL`, res.status, 'config');
    }
    throw new GeminiError(`Gemini error ${res.status}`, res.status, 'upstream');
  }

  const data: any = await res.json();
  if (data?.promptFeedback?.blockReason) throw new GeminiError('Prompt blocked by Gemini safety filters', 200, 'blocked');

  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === 'SAFETY') throw new GeminiError('Reply blocked by Gemini safety filters', 200, 'blocked');

  const raw = (candidate?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('').trim();
  if (!raw) throw new GeminiError('Gemini returned an empty reply', 200, 'upstream');

  try {
    const parsed = JSON.parse(raw);
    return {
      onTopic: parsed.on_topic !== false,
      answer: String(parsed.answer ?? '').trim(),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 3) : [],
    };
  } catch {
    // Truncated / non-JSON output: treat it as a plain on-topic answer rather than failing the turn.
    return { onTopic: true, answer: raw.slice(0, 1500), suggestions: [] };
  }
}
