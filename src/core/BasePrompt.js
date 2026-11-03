// ─── OJT Scout — BasePrompt (abstract) ───────────────────────────
// Abstraction pillar: contract for every provider-backed prompt handler.
// Concrete prompts (ResumeParserPrompt, BatchRelevancePrompt, …) extend this.
//
// Rules enforced here:
//   - All prompt STRINGS live in constants/prompts.js — subclasses only
//     reference them via buildSystemPrompt(); none are defined here.
//   - Every provider call goes through safeAPICall().
//   - Connection settings are resolved at request time so the server and
//     no-key demo can start without a provider credential.

import { safeAPICall } from '../utils/safeAPICall.js'
import { getConnection, getDefaultConnection, providerResponse, DEFAULT_MODEL } from './AIConnection.js'

export class BasePrompt {
  // Defaults — override per subclass.
  get temperature() {
    return 0
  }
  get model() {
    return DEFAULT_MODEL
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

  // Shared execution — protocol adapters return text for each prompt parser.
  async run(input, fallback = null) {
    return safeAPICall(async () => {
      const connection = getConnection() || getDefaultConnection()
      if (!connection) throw new Error('No AI connection configured.')
      const raw = await providerResponse(connection, this.buildSystemPrompt(), this.buildUserPrompt(input))
      return this.parseResponse(raw)
    }, fallback)
  }
}
