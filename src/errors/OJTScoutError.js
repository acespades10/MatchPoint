// ─── OJT Scout — Typed Errors ────────────────────────────────────
// Non-negotiable rule: never throw raw Error('string').
// Every error in the codebase extends OJTScoutError so the API layer
// can map { code, message, context } into a structured response.

export class OJTScoutError extends Error {
  constructor(code, message, context = {}) {
    super(message)
    this.name = 'OJTScoutError'
    this.code = code
    this.context = context
  }

  // Shape used by the API layer to respond to the client
  toResponse() {
    return {
      error: this.code,
      message: this.message,
      suggestion: this.context.suggestion ?? null
    }
  }
}

// ─── Phase 1 — Intake ────────────────────────────────────────────
export class ProfileIncompleteError extends OJTScoutError {
  constructor(missingFields = []) {
    super(
      'PROFILE_INCOMPLETE',
      'Resume could not be fully parsed.',
      {
        missingFields,
        suggestion: 'Add a skills section and work experience, then re-upload.'
      }
    )
    this.name = 'ProfileIncompleteError'
  }
}

// ─── Phase 2 / 3 / 5 — No Matches ────────────────────────────────
export class NoMatchesError extends OJTScoutError {
  constructor(filterStats = {}) {
    super(
      'NO_MATCHES',
      'No companies matched your current filters.',
      {
        filterStats,
        suggestion: 'Try relaxing your allowance floor, setup, or location.'
      }
    )
    this.name = 'NoMatchesError'
  }
}

// ─── Phase 4 — Enrichment ────────────────────────────────────────
export class EnrichmentFailedError extends OJTScoutError {
  constructor(companyId) {
    super(
      'ENRICHMENT_FAILED',
      'Company data could not be retrieved.',
      {
        companyId,
        fallback: 'Using FEU records only. Confidence: LOW.'
      }
    )
    this.name = 'EnrichmentFailedError'
  }
}

// ─── Generic API wrapper failure ─────────────────────────────────
export class APIError extends OJTScoutError {
  constructor(message, raw = null) {
    super('API_ERROR', message, { raw })
    this.name = 'APIError'
  }
}
