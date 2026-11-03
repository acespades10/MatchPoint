// ─── OJT Scout — BilateralScorer ─────────────────────────────────
// Polymorphism pillar: instantiates the student-side and company-side scorers
// and combines them without knowing each subclass's internals — it only calls
// score()/explain() and reads a numeric value out of the result.
//
//   Pure math. Zero tokens. Re-ranking on a weight/preference change costs 0.
//
// Weighting:
//   STUDENT SIDE (60% of total)
//     skillsMatch 0.30 · allowanceFit 0.25 · locationFit 0.25 · setupFit 0.20
//   COMPANY SIDE (40% of total)
//     learnability 0.60 · activeIntern 0.40
//
// bilateral = studentSide*0.6 + companySide*0.4  → 0..100

import { SkillsMatchScorer } from './student-side/SkillsMatchScorer.js'
import { AllowanceFitScorer } from './student-side/AllowanceFitScorer.js'
import { LocationFitScorer } from './student-side/LocationFitScorer.js'
import { SetupFitScorer } from './student-side/SetupFitScorer.js'
import { LearnabilityScorer } from './company-side/LearnabilityScorer.js'
import { ActiveInternScorer } from './company-side/ActiveInternScorer.js'
import { companyContacts } from '../data/companyContacts.js'
import { assessIndustryFit, RELEVANT_TIERS, INDUSTRY_TIER_RANK } from '../../constants/COURSE_MAP.js'

const STUDENT_WEIGHT = 0.6
const COMPANY_WEIGHT = 0.4

const STUDENT_WEIGHTS = { skillsMatch: 0.30, allowanceFit: 0.25, locationFit: 0.25, setupFit: 0.20 }
const COMPANY_WEIGHTS = { learnability: 0.60, activeIntern: 0.40 }

const TIERS = [
  { min: 75, tier: 'IDEAL', recommendation: 'apply_now' },
  { min: 60, tier: 'GOOD', recommendation: 'apply_with_preparation' },
  { min: 45, tier: 'REACH', recommendation: 'stretch_goal' },
  { min: -Infinity, tier: 'LOW', recommendation: 'skip' }
]

// A scorer.score() may return a plain number or an object with a `.score`
// field. Normalize to a number for the weighted sum.
function valueOf(result) {
  return typeof result === 'number' ? result : (result?.score ?? 0)
}

export class BilateralScorer {
  #skills = new SkillsMatchScorer()
  #allowance = new AllowanceFitScorer()
  #location = new LocationFitScorer()
  #setup = new SetupFitScorer()
  #learnability = new LearnabilityScorer()
  #activeIntern = new ActiveInternScorer()

  // Score a single student↔company pair into a full breakdown.
  scoreOne(student, company) {
    const skillsMatch = this.#skills.score(student, company)
    const allowanceFit = this.#allowance.score(student, company)
    const locationFit = this.#location.score(student, company)
    const setupFit = this.#setup.score(student, company)
    const learnability = this.#learnability.score(student, company)
    const activeIntern = this.#activeIntern.score(student, company)

    const studentScore =
      valueOf(skillsMatch) * STUDENT_WEIGHTS.skillsMatch +
      valueOf(allowanceFit) * STUDENT_WEIGHTS.allowanceFit +
      valueOf(locationFit) * STUDENT_WEIGHTS.locationFit +
      valueOf(setupFit) * STUDENT_WEIGHTS.setupFit

    const companyScore =
      valueOf(learnability) * COMPANY_WEIGHTS.learnability +
      valueOf(activeIntern) * COMPANY_WEIGHTS.activeIntern

    const bilateral = Math.round(studentScore * STUDENT_WEIGHT + companyScore * COMPANY_WEIGHT)
    const { tier, recommendation } = TIERS.find(t => bilateral >= t.min)

    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      industryFit: assessIndustryFit(student, company),
      city: company.city,
      setup: company.setup,
      allowance: company.allowance,
      allowanceDisplay: company.allowanceDisplay,
      hasActiveInterns: Boolean(company.hasActiveInterns),
      contacts: companyContacts(company),
      bilateral,
      studentScore: Math.round(studentScore),
      companyScore: Math.round(companyScore),
      tier,
      recommendation,
      breakdown: {
        skillsMatch,
        allowanceFit: valueOf(allowanceFit),
        locationFit: valueOf(locationFit),
        setupFit: valueOf(setupFit),
        learnability,
        activeIntern: valueOf(activeIntern)
      }
    }
  }

  // Screen again so initial scoring and preference re-ranking share the gate.
  // Direct industries first, active partners first within each industry tier,
  // then bilateral score. Unrelated/unknown records cannot enter via fallback.
  // Drops tier === 'LOW' UNLESS fewer than 5 results would remain — we never
  // hand back an empty list when industry-relevant companies exist.
  scoreAll(student, companies) {
    const scored = (companies ?? [])
      .filter(Boolean)
      .map(c => this.scoreOne(student, c))
      .filter(c => RELEVANT_TIERS.includes(c.industryFit.tier))
      .sort((a, b) => INDUSTRY_TIER_RANK[a.industryFit.tier] - INDUSTRY_TIER_RANK[b.industryFit.tier]
        || Number(b.hasActiveInterns) - Number(a.hasActiveInterns)
        || b.bilateral - a.bilateral)

    const ranked = scored.filter(c => c.tier !== 'LOW')
    const result = ranked.length >= 5 ? ranked : scored

    return result.slice(0, 20)
  }
}
