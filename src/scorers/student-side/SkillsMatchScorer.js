// ─── OJT Scout — SkillsMatchScorer (student-side) ────────────────
// How much of the company's tech stack the student already covers.
// Pure math, zero tokens.
//
// CRITICAL RULE: an unknown/empty company tech stack is NEUTRAL (50), never a
// penalty. Most IALAP records have no enrichment yet (techStack = []), so
// scoring them 0 would unfairly bury every un-enriched company.

import { BaseScorer } from '../../core/BaseScorer.js'

export class SkillsMatchScorer extends BaseScorer {
  score(student, company) {
    const studentSkills = (student?.skills ?? []).map(s => String(s.skill).toLowerCase())
    const companySkills = (company?.enriched?.techStack ?? []).map(s => String(s).toLowerCase())

    // Unknown tech stack ⇒ neutral, not penalized.
    if (companySkills.length === 0) {
      return { score: 50, matched: [], gaps: [], neutral: true }
    }

    const matched = companySkills.filter(s => studentSkills.includes(s))
    const gaps = companySkills.filter(s => !studentSkills.includes(s))
    const score = Math.round((matched.length / companySkills.length) * 100)

    return { score, matched, gaps, neutral: false }
  }

  explain(result) {
    if (result?.neutral) return 'Tech stack unknown — scored neutral (50).'
    const { matched = [], gaps = [] } = result ?? {}
    return `Matches ${matched.length} of ${matched.length + gaps.length} required skills.`
  }
}
