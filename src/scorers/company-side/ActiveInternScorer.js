// ─── OJT Scout — ActiveInternScorer (company-side) ───────────────
// Simple, high-signal proxy for acceptance likelihood: companies that already
// host FEU interns are proven to accept FEU students. Zero tokens.
//
//   hasActiveInterns ⇒ 100
//   otherwise ........ 40  (not disqualifying — just unproven)

import { BaseScorer } from '../../core/BaseScorer.js'

export class ActiveInternScorer extends BaseScorer {
  score(student, company) {
    return company?.hasActiveInterns ? 100 : 40
  }

  explain(score) {
    return score === 100
      ? 'Currently hosts FEU interns — proven to accept FEU students.'
      : 'No active FEU interns on record — acceptance unproven.'
  }
}
