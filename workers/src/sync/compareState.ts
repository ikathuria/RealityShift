// Compares a country's simulated state to real-world news headlines.
// Calls the LLM to identify divergences and generate a self-correction.
//
// Design principles:
// - Conservative: only flag divergences when news clearly contradicts the sim.
// - Self-corrections are gentle nudges (small deltas), not wholesale replacements.
// - Low temperature (0.3) for more grounded, factual responses.

import { chat } from '../ai/llm.js';
import type { Message } from '../ai/llm.js';
import type { CountryStateRow } from '../agents/prompt.js';

export interface DivergenceResult {
  diverged: boolean;
  delta: Record<string, number>;         // indicator → magnitude of divergence
  explanation: string;                   // human-readable narrative
  self_correction: Record<string, number>; // gentle deltas to apply to indicators
}

function buildCompareMessages(
  countryName: string,
  state: CountryStateRow,
  newsBlock: string
): Message[] {
  const indLines = Object.entries(state.indicators)
    .map(([k, v]) => `  ${k}: ${typeof v === 'number' ? v.toFixed(2) : v}`)
    .join('\n');

  const system: Message = {
    role: 'system',
    content: `You are an objective analyst comparing a simulated country state to real-world news.
Your job is to identify where the simulation has drifted from reality.

Rules:
- Only flag a divergence if real news CLEARLY contradicts the simulated indicators.
- Self-corrections must be small monthly adjustments (not snapping to reality in one step).
- If news is ambiguous or the simulation is plausible, set diverged=false.
- Output ONLY valid JSON — no prose, no markdown fences.

OUTPUT FORMAT:
{
  "diverged": <boolean>,
  "delta": {
    "<indicator_key>": <number — positive means sim is above reality, negative means below>
  },
  "explanation": "<1-3 sentences describing the divergence or confirming alignment>",
  "self_correction": {
    "<indicator_key>": <small delta to apply — typically ±0.5 to ±5% of current value>
  }
}

If diverged=false, delta and self_correction should be empty objects {}.`,
  };

  const user: Message = {
    role: 'user',
    content: `COUNTRY: ${countryName}
SIMULATED YEAR: ${state.year}

SIMULATED INDICATORS:
${indLines}

REAL-WORLD NEWS HEADLINES (last 30 days):
${newsBlock}

Does the simulated state diverge from what the news suggests about reality?
Respond with the JSON object only.`,
  };

  return [system, user];
}

export async function compareState(
  countryName: string,
  state: CountryStateRow,
  newsBlock: string,
  apiKey: string
): Promise<DivergenceResult> {
  // If there's no real news to compare against, return no divergence
  if (newsBlock === 'No recent news available.') {
    return { diverged: false, delta: {}, explanation: 'No news data available for comparison.', self_correction: {} };
  }

  const messages = buildCompareMessages(countryName, state, newsBlock);
  const raw = await chat(messages, apiKey, { temperature: 0.3, maxTokens: 512 });
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  try {
    return JSON.parse(cleaned) as DivergenceResult;
  } catch {
    // If the LLM returns unparseable output, treat as no divergence
    return {
      diverged: false,
      delta: {},
      explanation: 'Could not parse comparison result.',
      self_correction: {},
    };
  }
}
