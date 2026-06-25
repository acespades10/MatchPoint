import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LearnabilityScorer } from '../../src/scorers/company-side/LearnabilityScorer.js'

const scorer = new LearnabilityScorer()

test('Learnability: no gaps returns 100', () => {
  const student = { skills: [{ skill: 'JavaScript' }, { skill: 'React' }] }
  const r = scorer.score(student, { enriched: { techStack: ['JavaScript', 'React'] } })
  assert.equal(r.score, 100)
  assert.deepEqual(r.classifiedGaps, [])
})

test('Learnability: empty techStack means no gaps → 100', () => {
  const r = scorer.score({ skills: [] }, { enriched: { techStack: [] } })
  assert.equal(r.score, 100)
})

test('Learnability: bridgeable gap scores higher than blocking gap', () => {
  const student = { skills: [{ skill: 'JavaScript' }] }
  // React is adjacent to JavaScript → BRIDGEABLE (penalty 5)
  const bridgeable = scorer.score(student, { enriched: { techStack: ['React'] } })
  // AutoCAD is unrelated → BLOCKING (penalty 35)
  const blocking = scorer.score(student, { enriched: { techStack: ['AutoCAD'] } })

  assert.equal(bridgeable.classifiedGaps[0].type, 'BRIDGEABLE')
  assert.equal(bridgeable.score, 95)
  assert.equal(blocking.classifiedGaps[0].type, 'BLOCKING')
  assert.equal(blocking.score, 65)
  assert.ok(bridgeable.score > blocking.score)
})

test('Learnability: transferable gap is MANAGEABLE (penalty 15)', () => {
  const student = { skills: [{ skill: 'JavaScript' }] }
  // Java is transferable from JavaScript → MANAGEABLE
  const r = scorer.score(student, { enriched: { techStack: ['Java'] } })
  assert.equal(r.classifiedGaps[0].type, 'MANAGEABLE')
  assert.equal(r.score, 85)
})
