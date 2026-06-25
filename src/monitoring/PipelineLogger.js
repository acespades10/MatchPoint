// ─── OJT Scout — PipelineLogger ──────────────────────────────────
// Observability for every pipeline run. Records per-phase input/output
// counts, token usage, and duration. The visible proof of token
// efficiency (Phase 2 = 0 tokens, Phase 5 re-rank = 0 tokens).

export class PipelineLogger {
  #runId
  #phases = {}
  #tokenUsage = { total: 0, byPhase: {} }
  #errors = []
  #startTime

  constructor(runId = `run-${Date.now()}`) {
    this.#runId = runId
    this.#startTime = Date.now()
  }

  startPhase(name) {
    this.#phases[name] = { startTime: Date.now(), input: 0, output: 0, tokens: 0 }
    return this
  }

  endPhase(name, { input = 0, output = 0, tokens = 0 } = {}) {
    const phase = this.#phases[name] ?? { startTime: Date.now() }
    const duration = Date.now() - phase.startTime
    this.#phases[name] = { input, output, tokens, duration }
    this.#tokenUsage.total += tokens
    this.#tokenUsage.byPhase[name] = tokens
    console.log(
      `[PHASE] ${name}: ${input} → ${output} | ${tokens} tokens | ${duration}ms`
    )
    return this
  }

  log(entry) {
    console.log(`[LOG] ${this.#runId}`, entry)
    return this
  }

  error(phaseName, err) {
    const record = {
      phase: phaseName,
      message: err?.message ?? String(err),
      code: err?.code ?? null,
      ts: new Date().toISOString()
    }
    this.#errors.push(record)
    console.error(`[ERROR] ${phaseName}:`, record.message)
    return this
  }

  getSummary() {
    return {
      runId: this.#runId,
      totalTime: Date.now() - this.#startTime,
      tokenUsage: this.#tokenUsage,
      phases: this.#phases,
      errors: this.#errors,
      estimatedCost: ((this.#tokenUsage.total / 1_000_000) * 5).toFixed(4) // ~$5/1M
    }
  }
}
