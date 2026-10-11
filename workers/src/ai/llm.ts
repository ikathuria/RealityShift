// Thin LLM wrapper around the Groq API (OpenAI-compatible).
// To swap to Claude: change BASE_URL to https://api.anthropic.com/v1 and
// set the Authorization header to `x-api-key: ${apiKey}` instead of Bearer.
//
// DEFAULT_MODEL is Llama 3.3 70B — an open-weights model served on Groq's free
// tier. Groq retires model IDs without notice (the previous default,
// meta-llama/llama-4-maverick-17b-128e-instruct, now 404s with model_not_found),
// so if agent calls start failing with a 404, list the currently-available IDs:
//   curl -H "Authorization: Bearer $GROQ_API_KEY" \
//        https://api.groq.com/openai/v1/models
// Any OpenAI-compatible host works by changing BASE_URL + DEFAULT_MODEL alone.

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /**
   * Ask for a JSON object via OpenAI-style `response_format: { type: 'json_object' }`.
   * Groq supports this for llama-3.3-70b-versatile (the prompt must mention
   * "JSON", which ours do). Callers still validate the parsed output.
   */
  jsonMode?: boolean;
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export async function chat(
  messages: Message[],
  apiKey: string,
  options: ChatOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 2048,
    jsonMode = false,
  } = options;

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    // Logged server-side only; callers map this to a generic client error.
    const error = (await response.text()).slice(0, 500);
    throw new Error(`LLM request failed (${response.status}): ${error}`);
  }

  const data = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM returned an empty response');
  return content;
}
