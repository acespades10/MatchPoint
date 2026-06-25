// ─── OJT Scout — SetupPreferenceFilter ───────────────────────────
// Match work-setup preference (remote / onsite / hybrid / any).
//
// RULES:
//  - student preference 'any' (or unset) ⇒ all companies pass
//  - company setup 'hybrid' satisfies BOTH remote and onsite students
//  - company setup null/unknown ⇒ passes (unknown is not eliminated)
//  - otherwise pass only on an exact setup match

import { HardFilter } from './HardFilter.js'

export class SetupPreferenceFilter extends HardFilter {
  get name() {
    return 'SetupPreferenceFilter'
  }

  passes(company, criteria) {
    const pref = this.#normalize(criteria?.preferences?.setup) || 'any'
    // 'any' / unset preference ⇒ everything passes.
    if (pref === 'any') return true

    const setup = this.#normalize(company?.setup)
    // Unknown company setup ⇒ not eliminated.
    if (!setup) return true

    // Hybrid companies accommodate both remote and onsite students.
    if (setup === 'hybrid') return true

    return setup === pref
  }

  #normalize(value) {
    return String(value ?? '').toLowerCase().trim()
  }
}
