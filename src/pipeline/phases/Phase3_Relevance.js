// ─── OJT Scout — Phase 3: Smart Relevance Check ──────────────────
// Narrows the pre-screened pool down to companies whose industry is actually
// relevant to the student's course. Pure keyword classification over the
// in-memory CompanyIndex.
//
//   ZERO GPT calls. ZERO API calls. tokens = 0 — a hard rule, not a goal.
//   No import of openai anywhere in this phase or its dependencies.
//
// (Demo build note: the architecture's full Phase 3 uses one batch GPT call +
//  vector similarity. For the demo we use deterministic keyword matching —
//  faster, free, and more reliable to present. See DEV_LOG.)
//
// STEP 1  classify each surviving company's industry → relevance tier
// STEP 2  keep direct + adjacent; drop stretch + irrelevant
// STEP 3  sort: direct before adjacent, active-intern companies first in tier
// STEP 4  store surviving ids + a relevance report; log tokens: 0

import { BasePhase } from '../BasePhase.js'
import { CompanyIndex } from '../../data/CompanyIndex.js'
import { NoMatchHandler } from '../NoMatchHandler.js'
import { classifyIndustry, RELEVANT_TIERS } from '../../../constants/COURSE_MAP.js'

// Tier ordering for the active-intern-aware sort (lower = higher priority).
const TIER_RANK = { direct: 0, adjacent: 1, stretch: 2, irrelevant: 3 }

export class Phase3_Relevance extends BasePhase {
  get name() {
    return 'Smart Relevance Check'
  }

  async execute(session, logger) {
    logger?.startPhase(this.name)

    const profile = session.getProfile()
    const course = profile?.course || 'BS Computer Science'

    const index = CompanyIndex.getInstance()
    const inputIds = session.getFilteredIds()
    const companies = inputIds.map(id => index.getById(id)).filter(Boolean)
    const totalIn = companies.length

    // STEP 1 — classify into relevance tiers (pure keyword matching)
    const tierCounts = { direct: 0, adjacent: 0, stretch: 0, irrelevant: 0 }
    const classified = companies.map(company => {
      const tier = classifyIndustry(company.industry, course)
      tierCounts[tier] += 1
      return { company, tier }
    })

    // STEP 2 — keep only relevant tiers (direct + adjacent)
    const relevant = classified.filter(c => RELEVANT_TIERS.includes(c.tier))

    // STEP 3 — sort: relevance tier first, then active interns first in tier
    relevant.sort((a, b) => {
      if (TIER_RANK[a.tier] !== TIER_RANK[b.tier]) {
        return TIER_RANK[a.tier] - TIER_RANK[b.tier]
      }
      const aActive = a.company.hasActiveInterns ? 0 : 1
      const bActive = b.company.hasActiveInterns ? 0 : 1
      return aActive - bActive
    })

    const relevantIds = relevant.map(c => c.company.id)

    // STEP 4 — persist + report
    session.setFilteredIds(relevantIds)

    const report = {
      totalIn,
      totalOut: relevantIds.length,
      tierCounts,
      kept: { direct: tierCounts.direct, adjacent: tierCounts.adjacent },
      dropped: { stretch: tierCounts.stretch, irrelevant: tierCounts.irrelevant },
      noMatch: null
    }

    // No relevant companies ⇒ surface stretch tier as a relaxation option.
    if (relevantIds.length === 0) {
      const stretchIds = classified
        .filter(c => c.tier === 'stretch')
        .map(c => c.company.id)
      report.noMatch = {
        level: 2,
        reason: 'No directly relevant companies for this course.',
        stretchAvailable: stretchIds.length,
        relaxations: new NoMatchHandler(companies, profile).level1?.() ?? []
      }
      session.log({ phase: this.name, result: 'NO_RELEVANT', stretch: stretchIds.length })
    }

    session.setRelevance(report)

    logger?.endPhase(this.name, { input: totalIn, output: relevantIds.length, tokens: 0 })
    session.log({ phase: this.name, in: totalIn, out: relevantIds.length, tokens: 0 })

    return report
  }
}
