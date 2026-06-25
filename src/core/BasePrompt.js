// ─── OJT Scout — BasePrompt (abstract) ───────────────────────────
// Abstraction pillar: contract for every GPT prompt handler.
// Concrete prompts (ResumeParserPrompt, BatchRelevancePrompt, …) extend this.
//
// Rules enforced here:
//   - All prompt STRINGS live in constants/prompts.js — subclasses only
//     reference them via buildSystemPrompt(); none are defined here.
//   - Every OpenAI call goes through safeAPICall().
//   - The OpenAI client is created lazily so the server (and /api/health)
//     can start without an API key present.

import { safeAPICall } from '../utils/safeAPICall.js'

let _client = null
async function getClient() {
  if (_client) return _client
  const { default: OpenAI } = await import('openai')
  _client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID || undefined
  })
  return _client
}

export class BasePrompt {
  // Defaults — override per subclass.
  get temperature() {
    return 0
  }
  get model() {
    return 'gpt-4o'
  }

  // Subclasses MUST implement.
  buildSystemPrompt() {
    throw new Error('Subclass must implement buildSystemPrompt()')
  }
  buildUserPrompt(input) {
    throw new Error('Subclass must implement buildUserPrompt(input)')
  }
  parseResponse(raw) {
    throw new Error('Subclass must implement parseResponse(raw)')
  }

  // Shared execution — one place that talks to OpenAI for all prompts.
  async run(input, fallback = null) {
    return safeAPICall(async () => {
      const client = await getClient()
      const response = await client.chat.completions.create({
        model: this.model,
        temperature: this.temperature,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: this.buildSystemPrompt() },
          { role: 'user', content: this.buildUserPrompt(input) }
        ]
      })
      return this.parseResponse(response.choices[0].message.content)
    }, fallback)
  }
}
