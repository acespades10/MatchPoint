// ─── OJT Scout — SetupFitScorer (student-side) ───────────────────
// How well the company's work setup matches the student's preference.
// Pure math, zero tokens.
//
//   unknown company setup ...... 50  (neutral)
//   student wants 'any' ........ 100
//   exact match ................ 100
//   company is hybrid .......... 75  (flexible — partial fit for most prefs)
//   otherwise (mismatch) ....... 25

import { BaseScorer } from '../../core/BaseScorer.js'

export class SetupFitScorer extends BaseScorer {
  score(student, company) {
    const companySetup = company?.setup
    if (companySetup === null || companySetup === undefined) return 50 // neutral

    const studentSetup = student?.preferences?.setup ?? 'any'
    if (studentSetup === 'any') return 100
    if (studentSetup === companySetup) return 100
    if (companySetup === 'hybrid') return 75
    return 25
  }

  explain(score) {
    switch (score) {
      case 100: return 'Setup matches your preference.'
      case 75: return 'Hybrid setup — flexible fit.'
      case 50: return 'Setup not disclosed — scored neutral.'
      default: return 'Setup does not match your preference.'
    }
  }
}
