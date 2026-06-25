// ─── OJT Scout — YearLevelFilter ─────────────────────────────────
// OJT is a 4th-year requirement at FEU. Every student in the system is
// 4th year, but we keep the gate for correctness: a non-4th-year profile
// should pass zero companies (it isn't eligible to be placed at all).
//
// Note: this filter inspects the STUDENT, not the company — if the student
// is 4th year all companies pass, otherwise none do.

import { HardFilter } from './HardFilter.js'

export class YearLevelFilter extends HardFilter {
  get name() {
    return 'YearLevelFilter'
  }

  passes(company, criteria) {
    return criteria?.yearLevel === '4th'
  }
}
