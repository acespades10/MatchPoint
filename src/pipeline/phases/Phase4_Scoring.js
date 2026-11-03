// ─── OJT Scout — Phase 4: Scoring & Ranking ──────────────────────
// Bilateral scoring over the relevant companies from Phase 3.
//
//   ZERO GPT calls. ZERO API calls. tokens = 0 — pure math.
//   No import of openai anywhere in this phase or its dependencies.
//
// (Demo build note: the architecture's full Phase 5 also calls GPT for the top
//  15 explanations + a brain.js acceptance classifier. For the demo we keep it
//  to deterministic math so re-ranking on a filter change is instant + free.)
//
// STEP 1  read student profile + relevant company ids (from Phase 3)
// STEP 2  hydrate full company records from the CompanyIndex
// STEP 3  BilateralScorer.scoreAll → top 20 ranked, LOW tier dropped
// STEP 4  store ranked scores on the session; log tokens: 0

import { BasePhase } from '../BasePhase.js'
import { CompanyIndex } from '../../data/CompanyIndex.js'
import { BilateralScorer } from '../../scorers/BilateralScorer.js'

export class Phase4_Scoring extends BasePhase {
  #scorer = new BilateralScorer()

  get name() {
    return 'Scoring & Ranking'
  }

  async execute(session, logger) {
    logger?.startPhase(this.name)

    const profile = session.getProfile()
    const index = CompanyIndex.getInstance()
    const ids = session.getFilteredIds()
    let companies = ids.map(id => index.getById(id)).filter(Boolean)
    if (session.getInput().activeOnly) companies = companies.filter(company => company.hasActiveInterns)
    const totalIn = companies.length

    const ranked = this.#scorer.scoreAll(profile, companies)
    session.setScores(ranked)

    logger?.endPhase(this.name, { input: totalIn, output: ranked.length, tokens: 0 })
    session.log({ phase: this.name, in: totalIn, out: ranked.length, tokens: 0 })

    return ranked
  }
}
