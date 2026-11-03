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
    // Log only bounded diagnostic metadata, never provider bodies or inputs.
    const safeCode = value => typeof value === 'string' && /^[A-Z_0-9]{1,60}$/i.test(value) ? value : undefined
    console.error('[AI request failed]', JSON.stringify({
      status: Number.isInteger(status) ? status : undefined,
      type: safeCode(err?.name), code: safeCode(err?.code), cause: safeCode(err?.cause?.code), providerCode: safeCode(err?.providerCode)
    }))

    if (status === 429) {
      await sleep(2000) // rate limited — back off and retry once
      try {
        return await fn()
      } catch (retryErr) {
        throw new APIError('AI provider request failed after retry. Check your connection settings and try again.')
      }
    }

    if (status === 503) {
      if (fallback !== null) return fallback
      throw new APIError('AI provider is temporarily unavailable. Please try again later.')
    }

    // Provider bodies can echo credentials or resume text. Never expose them.
    const streamMessages = {
      AI_STREAM_DISCONNECTED: 'The AI provider closed the connection before finishing your résumé. Please try again.',
      AI_RESPONSE_FAILED: 'The AI provider reported a failure while processing your résumé. Please try again.',
      AI_RESPONSE_INCOMPLETE: 'The AI provider stopped before completing your résumé analysis. Please try again.',
      AI_EMPTY_RESPONSE: 'The AI provider completed the request without returning résumé data. Please try again.'
    }
    const message = err?.name === 'TimeoutError' || err?.code === 'ETIMEDOUT'
      ? 'The AI provider took too long to respond. Please try again.'
      : streamMessages[err?.code] || (status === 401 || status === 403
      ? 'AI provider rejected the API key. Check your key and access permissions.'
      : status === 404 ? 'AI endpoint or model was not found. Check the URL and model.'
      : 'AI provider request failed. Check your URL, API key, and model, then try again.')
    throw new APIError(message)
  }
}
