// ─── OJT Scout — AllowanceFloorFilter ────────────────────────────
// Keep companies whose allowance meets the student's minimum.
//
// CRITICAL RULE: a null/unknown company allowance PASSES — unknown is not
// the same as "below floor". Most IALAP records have no allowance data, so
// eliminating them would gut the candidate pool on missing data alone.
// Only eliminate when the allowance is a real number AND it is strictly
// below the student's minimum.

import { HardFilter } from './HardFilter.js'

export class AllowanceFloorFilter extends HardFilter {
  get name() {
    return 'AllowanceFloorFilter'
  }

  passes(company, criteria) {
    const allowance = company?.allowance
    // Unknown allowance ⇒ not eliminated.
    if (typeof allowance !== 'number' || Number.isNaN(allowance)) return true

    const floor = criteria?.preferences?.minAllowance
    // No student floor set ⇒ nothing to fail against ⇒ pass.
    if (typeof floor !== 'number' || Number.isNaN(floor)) return true

    return allowance >= floor
  }
}
