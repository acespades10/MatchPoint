// ─── OJT Scout — SessionStore (in-memory) ────────────────────────
// Holds completed PipelineSession objects so later requests (results view,
// instant re-rank on a filter change) can retrieve a run by id without
// re-running the pipeline — and crucially without spending any tokens.
//
// Demo-grade: a process-local Map with a soft cap so a long-running demo
// doesn't leak memory. Not for production / multi-instance use.

export class SessionStore {
  static #instance = null
  static getInstance() {
    if (!this.#instance) this.#instance = new SessionStore()
    return this.#instance
  }

  #sessions = new Map()
  #maxSize = 200

  save(session) {
    // Evict oldest insertion if we hit the cap (Map preserves insertion order).
    if (this.#sessions.size >= this.#maxSize) {
      const oldest = this.#sessions.keys().next().value
      this.#sessions.delete(oldest)
    }
    this.#sessions.set(session.id, session)
    return session
  }

  get(id) {
    return this.#sessions.get(id) ?? null
  }

  has(id) {
    return this.#sessions.has(id)
  }
}
