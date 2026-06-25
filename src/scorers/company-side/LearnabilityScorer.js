// ─── OJT Scout — LearnabilityScorer (company-side) ───────────────
// Can the student realistically close the gap between their skills and the
// company's tech stack? Uses SKILL_ADJACENCY — zero GPT calls, zero tokens.
//
// Each missing skill (gap) is classified relative to what the student already
// knows:
//   BRIDGEABLE → an adjacent skill they can pick up fast   (penalty 5)
//   MANAGEABLE → a transferable skill, some ramp-up needed  (penalty 15)
//   BLOCKING   → unrelated to anything they know            (penalty 35)
//
// score = max(0, 100 - sum(penalties)). No gaps ⇒ 100.
//
// CASE NOTE: SKILL_ADJACENCY keys are proper-cased ('Python', 'Node.js') while
// student skills are compared lowercased. We build a lowercased view of the map
// once at module load so matching is case-insensitive.

import { BaseScorer } from '../../core/BaseScorer.js'
import { SKILL_ADJACENCY } from '../../../constants/SKILL_ADJACENCY.js'

// Lowercased adjacency view: { skill → { adjacent:Set, transferable:Set } }.
const ADJACENCY_LC = Object.fromEntries(
  Object.entries(SKILL_ADJACENCY).map(([skill, rel]) => [
    skill.toLowerCase(),
    {
      adjacent: new Set((rel.adjacent ?? []).map(s => s.toLowerCase())),
      transferable: new Set((rel.transferable ?? []).map(s => s.toLowerCase()))
    }
  ])
)

const PENALTY = { BRIDGEABLE: 5, MANAGEABLE: 15, BLOCKING: 35 }

export class LearnabilityScorer extends BaseScorer {
  score(student, company) {
    const studentSkills = (student?.skills ?? []).map(s => String(s.skill).toLowerCase())
    const techStack = (company?.enriched?.techStack ?? []).map(s => String(s))

    const gaps = techStack.filter(s => !studentSkills.includes(s.toLowerCase()))
    if (gaps.length === 0) return { score: 100, classifiedGaps: [] }

    const classifiedGaps = gaps.map(gap => {
      const g = gap.toLowerCase()
      const isBridgeable = studentSkills.some(s => ADJACENCY_LC[s]?.adjacent.has(g))
      const isManageable = studentSkills.some(s => ADJACENCY_LC[s]?.transferable.has(g))

      const type = isBridgeable ? 'BRIDGEABLE' : isManageable ? 'MANAGEABLE' : 'BLOCKING'
      return { skill: gap, type, penalty: PENALTY[type] }
    })

    const totalPenalty = classifiedGaps.reduce((sum, g) => sum + g.penalty, 0)
    const score = Math.max(0, 100 - totalPenalty)

    return { score, classifiedGaps }
  }

  explain(result) {
    const gaps = result?.classifiedGaps ?? []
    if (gaps.length === 0) return 'No skill gaps — fully ready.'
    const blocking = gaps.filter(g => g.type === 'BLOCKING').length
    return `${gaps.length} gap(s), ${blocking} blocking — learnability ${result.score}.`
  }
}
