// ─── OJT Scout — BaseScorer (abstract) ───────────────────────────
// Abstraction pillar: contract for every bilateral scorer.
// Student-side and company-side scorers extend this.
// Scoring is pure math — re-ranking on weight change costs zero tokens.

export class BaseScorer {
  // Subclasses MUST implement — returns a score result (0-100 based).
  score(student, company, preferences) {
    throw new Error('Subclass must implement score(student, company, preferences)')
  }

  // Subclasses MUST implement — human-readable reason for the score.
  explain(scoreResult) {
    throw new Error('Subclass must implement explain(scoreResult)')
  }

  // Shared utility — clamp a raw value into a 0-100 range.
  normalize(value, min, max) {
    if (max === min) return 0
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  }

  // Shared utility — apply a 0-1 weight to a score.
  applyWeight(score, weight) {
    return score * Math.min(1, Math.max(0, weight))
  }
}
