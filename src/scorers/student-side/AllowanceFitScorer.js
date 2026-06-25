// ─── OJT Scout — AllowanceFitScorer (student-side) ───────────────
// How well the company's allowance meets the student's minimum.
// Pure math, zero tokens.
//
// CRITICAL RULE: unknown company allowance is NEUTRAL (50). No student floor
// set ⇒ mildly positive (75) — anything is acceptable, but we don't claim a
// perfect fit we can't verify.

import { BaseScorer } from '../../core/BaseScorer.js'

export class AllowanceFitScorer extends BaseScorer {
  score(student, company) {
    const allowance = company?.allowance
    // Unknown allowance ⇒ neutral.
    if (typeof allowance !== 'number' || Number.isNaN(allowance)) return 50

    const min = student?.preferences?.minAllowance
    // No floor set by the student ⇒ mildly positive.
    if (typeof min !== 'number' || Number.isNaN(min) || min <= 0) return 75

    if (allowance >= min) return 100
    // Below floor ⇒ proportional partial credit.
    return Math.max(0, Math.round((allowance / min) * 100))
  }

  explain(score) {
    if (score === 50) return 'Allowance not disclosed — scored neutral.'
    if (score === 100) return 'Meets or exceeds your allowance floor.'
    return `Below your allowance floor — partial fit (${score}).`
  }
}
