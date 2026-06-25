import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BilateralScorer } from '../../src/scorers/BilateralScorer.js'

const student = {
  skills: [{ skill: 'JavaScript' }],
  preferences: { setup: 'hybrid', minAllowance: 500, homeLocation: 'Quezon City' }
}

// Build n companies; a fraction host active interns so scores vary (for sort).
function makeCompanies(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    name: `Company ${i}`,
    industry: 'Software & Computer Services',
    city: 'Quezon City',
    setup: 'hybrid',
    allowance: null,
    allowanceDisplay: null,
    hasActiveInterns: i % 2 === 0, // alternate to create score spread
    enriched: { techStack: [] }
  }))
}

test('Bilateral: returns at most 20 results', () => {
  const ranked = new BilateralScorer().scoreAll(student, makeCompanies(30))
  assert.ok(ranked.length <= 20, `expected <= 20, got ${ranked.length}`)
})

test('Bilateral: results sorted by bilateral score descending', () => {
  const ranked = new BilateralScorer().scoreAll(student, makeCompanies(30))
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(
      ranked[i - 1].bilateral >= ranked[i].bilateral,
      `not sorted at ${i}: ${ranked[i - 1].bilateral} < ${ranked[i].bilateral}`
    )
  }
})

test('Bilateral: tier + recommendation classified correctly (IDEAL)', () => {
  const ideal = {
    id: 'ideal',
    name: 'Ideal Co',
    industry: 'Software',
    city: 'Quezon City', // same city → 100
    setup: 'hybrid', // matches pref → 100
    allowance: 800, // >= floor → 100
    hasActiveInterns: true, // → 100
    enriched: { techStack: [] } // skills neutral 50, learnability 100
  }
  const [r] = new BilateralScorer().scoreAll(student, [ideal])
  assert.ok(r.bilateral >= 75, `expected IDEAL band, got ${r.bilateral}`)
  assert.equal(r.tier, 'IDEAL')
  assert.equal(r.recommendation, 'apply_now')
})

test('Bilateral: low-fit company classified LOW (skip)', () => {
  const low = {
    id: 'low',
    name: 'Low Co',
    industry: 'Software',
    city: 'Cebu', // not metro vs QC → 40
    setup: 'onsite', // mismatch vs hybrid → 25
    allowance: 100, // below 500 floor → 20
    hasActiveInterns: false, // → 40
    enriched: { techStack: ['AutoCAD', 'Photoshop'] } // blocking gaps
  }
  const scorer = new BilateralScorer()
  const r = scorer.scoreOne(student, low)
  assert.equal(r.tier, 'LOW')
  assert.equal(r.recommendation, 'skip')
})

test('Bilateral: never returns empty when companies exist (LOW fallback)', () => {
  // A single LOW company would be filtered out, but the <5 fallback keeps it.
  const low = {
    id: 'low',
    name: 'Low Co',
    industry: 'Software',
    city: 'Cebu',
    setup: 'onsite',
    allowance: 100,
    hasActiveInterns: false,
    enriched: { techStack: [] }
  }
  const ranked = new BilateralScorer().scoreAll(student, [low])
  assert.equal(ranked.length, 1)
})
