// ─── OJT Scout — MOAStatusFilter ─────────────────────────────────
// A company can host FEU interns only when its Memorandum of Agreement
// is active. Anything other than an exact 'Active' status is eliminated.

import { HardFilter } from './HardFilter.js'

export class MOAStatusFilter extends HardFilter {
  get name() {
    return 'MOAStatusFilter'
  }

  passes(company) {
    return company?.moaStatus === 'Active'
  }
}
