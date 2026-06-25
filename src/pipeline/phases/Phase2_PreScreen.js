// ─── OJT Scout — Phase 2: Pre-Screen Filter ──────────────────────
// Hard elimination of companies that cannot host this student. Pure
// logic over the in-memory CompanyIndex.
//
//   ZERO GPT calls. ZERO API calls. tokens = 0 — a hard rule, not a goal.
//   No import of openai anywhere in this phase or its dependencies.
//
// STEP 1  read the StudentProfile from the session
// STEP 2  pull all companies from the CompanyIndex
// STEP 3  run the FilterPipeline (Year → MOA → Slots → Course → Allowance → Setup)
// STEP 4  store surviving ids + the per-filter funnel report
// STEP 5  log tokens: 0
// STEP 6  if nothing survived, run NoMatchHandler.level1()

import { BasePhase } from '../BasePhase.js'
import { CompanyIndex } from '../../data/CompanyIndex.js'
import { FilterPipeline } from '../../filters/FilterPipeline.js'
import { NoMatchHandler } from '../NoMatchHandler.js'

export class Phase2_PreScreen extends BasePhase {
  #pipeline = new FilterPipeline()

  get name() {
    return 'Pre-Screen Filter'
  }

  async execute(session, logger) {
    logger?.startPhase(this.name)

    // STEP 1 — student profile (criteria)
    const profile = session.getProfile()

    // STEP 2 — full company list from the singleton index
    const companies = CompanyIndex.getInstance().getAll()
    const totalIn = companies.length

    // STEP 3 — run the ordered hard filters (pure math)
    const { survivors, steps } = this.#pipeline.run(companies, profile, logger)

    // STEP 4 — persist surviving ids + funnel report
    const survivingIds = survivors.map(c => c.id)
    session.setFilteredIds(survivingIds)

    const report = {
      totalIn,
      totalOut: survivingIds.length,
      steps,
      noMatch: null
    }

    // STEP 6 — no survivors ⇒ explain why + what to relax
    if (survivingIds.length === 0) {
      const relaxations = new NoMatchHandler(companies, profile).level1()
      report.noMatch = { level: 1, relaxations }
      session.log({ phase: this.name, result: 'NO_MATCHES', relaxations })
    }

    session.setPreScreen(report)

    // STEP 5 — tokens: 0, always.
    logger?.endPhase(this.name, { input: totalIn, output: survivingIds.length, tokens: 0 })
    session.log({ phase: this.name, in: totalIn, out: survivingIds.length, tokens: 0 })

    return report
  }
}
