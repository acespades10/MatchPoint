// ─── OJT Scout — HardFilter (abstract) ───────────────────────────
// Inheritance pillar: sits between BaseFilter and the concrete filters.
// It implements the shared apply() once — iterate companies, keep the
// ones passes() approves, log the elimination count — so every concrete
// filter only implements passes() + get name().
//
// Phase 2 rule: this is pure logic. Zero tokens, no API calls, ever.

import { BaseFilter } from '../core/BaseFilter.js'

export class HardFilter extends BaseFilter {
  // Subclasses MUST implement — true keeps the company, false eliminates it.
  // `criteria` is the StudentProfile (skills, preferences, …).
  passes(company, criteria) {
    throw new Error('Subclass must implement passes(company, criteria)')
  }

  // Shared elimination loop — polymorphic over passes(). Returns the
  // surviving subset and logs before → after counts.
  apply(companies, criteria) {
    const input = Array.isArray(companies) ? companies : []
    const survivors = input.filter(company => company && this.passes(company, criteria))
    this.logElimination(input.length, survivors.length)
    return survivors
  }
}
