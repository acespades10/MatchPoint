// ─── OJT Scout — BaseFilter (abstract) ───────────────────────────
// Abstraction pillar: defines the contract every hard filter implements.
// Concrete filters (YearLevelFilter, MOAStatusFilter, …) extend this.
// Phase 2 rule: filter logic is pure — zero tokens, no API calls.

export class BaseFilter {
  // Subclasses MUST override — used in logging and the pipeline.
  get name() {
    throw new Error('Subclass must define get name()')
  }

  // Subclasses MUST implement — returns the surviving subset of companies.
  apply(companies, criteria) {
    throw new Error('Subclass must implement apply(companies, criteria)')
  }

  // Shared logging — consistent elimination output across all filters.
  logElimination(before, after, reason = this.name) {
    console.log(
      `[${this.name}] ${before} → ${after} (-${before - after}) | ${reason}`
    )
  }
}
