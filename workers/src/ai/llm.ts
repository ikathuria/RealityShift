// Thin LLM wrapper around the Groq API (OpenAI-compatible).
// To swap to Claude: change BASE_URL to https://api.anthropic.com/v1 and
// set the Authorization header to `x-api-key: ${apiKey}` instead of Bearer.
// The model default below maps to Llama 4 Maverick on Groq.

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const DEFAULT_MODEL = 'meta-llama/llama-4-maverick-17b-128e-instruct';

export async function chat(
  messages: Message[],
  apiKey: string,
  options: ChatOptions = {}
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 2048,
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
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${error}`);
  }

  const data = await response.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error('LLM returned an empty response');
  return content;
}
