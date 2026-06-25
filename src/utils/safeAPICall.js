// ─── OJT Scout — safeAPICall ─────────────────────────────────────
// Non-negotiable rule: every OpenAI call is wrapped in safeAPICall().
// Never let a raw provider error reach the UI.
//
//   - 429 (rate limit) → wait 2s, retry once
//   - 503 (service down) → return the provided fallback
//   - anything else → wrap in a typed APIError

import { APIError } from '../errors/OJTScoutError.js'

export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function safeAPICall(fn, fallback = null) {
  try {
    return await fn()
  } catch (err) {
    const status = err?.status ?? err?.response?.status

    if (status === 429) {
      await sleep(2000) // rate limited — back off and retry once
      try {
        return await fn()
      } catch (retryErr) {
        throw new APIError(retryErr?.message ?? 'Rate limit retry failed', retryErr)
      }
    }

    if (status === 503) {
      return fallback // service unavailable — degrade gracefully
    }

    throw new APIError(err?.message ?? 'Unknown API error', err)
  }
}
