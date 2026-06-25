// ─── OJT Scout — PipelineSession ─────────────────────────────────
// Encapsulation pillar: all pipeline state is private (#). Consumers
// mutate it only through controlled setters and read it through getters.
// One session = one student's run through the 7 phases.

import { randomUUID } from 'node:crypto'

export class PipelineSession {
  #id
  #input = {}
  #profile = null
  #filteredIds = []
  #preScreen = null
  #relevance = null
  #enrichedMap = {}
  #scores = []
  #documents = {}
  #log = []
  #createdAt

  constructor(id = randomUUID()) {
    this.#id = id
    this.#createdAt = new Date().toISOString()
  }

  get id() {
    return this.#id
  }

  // ─── Raw inputs (resume buffer, raw preferences) ───────────────
  setInput(input) {
    this.#input = { ...this.#input, ...input }
    return this
  }
  getInput() {
    return { ...this.#input }
  }

  // ─── Profile ───────────────────────────────────────────────────
  setProfile(profile) {
    this.#profile = profile
    return this
  }
  getProfile() {
    // Return a shallow copy so callers can't mutate internal state.
    return this.#profile ? { ...this.#profile } : null
  }

  // ─── Filtered company IDs (Phase 2 / 3) ────────────────────────
  setFilteredIds(ids) {
    this.#filteredIds = [...ids]
    return this
  }
  getFilteredIds() {
    return [...this.#filteredIds]
  }

  // ─── Pre-screen report (Phase 2) — per-filter funnel + no-match info ─
  setPreScreen(report) {
    this.#preScreen = report
    return this
  }
  getPreScreen() {
    return this.#preScreen ? { ...this.#preScreen } : null
  }

  // ─── Relevance report (Phase 3) — tier counts + kept/dropped ───
  setRelevance(report) {
    this.#relevance = report
    return this
  }
  getRelevance() {
    return this.#relevance ? { ...this.#relevance } : null
  }

  // ─── Enriched company data (Phase 4) ───────────────────────────
  setEnriched(companyId, data) {
    this.#enrichedMap[companyId] = data
    return this
  }
  getEnriched(companyId) {
    return companyId ? this.#enrichedMap[companyId] ?? null : { ...this.#enrichedMap }
  }

  // ─── Scores (Phase 5) ──────────────────────────────────────────
  setScores(scores) {
    this.#scores = [...scores]
    return this
  }
  getScores() {
    return [...this.#scores]
  }

  // ─── Documents (Phase 6) ───────────────────────────────────────
  setDocuments(companyId, docs) {
    this.#documents[companyId] = docs
    return this
  }
  getDocuments(companyId) {
    return companyId ? this.#documents[companyId] ?? null : { ...this.#documents }
  }

  // ─── Run log ───────────────────────────────────────────────────
  log(entry) {
    this.#log.push({ ts: new Date().toISOString(), ...entry })
    return this
  }
  getLog() {
    return [...this.#log]
  }

  getSummary() {
    return {
      id: this.#id,
      createdAt: this.#createdAt,
      profile: this.getProfile(),
      filteredCount: this.#filteredIds.length,
      scores: this.getScores(),
      log: this.getLog()
    }
  }
}
