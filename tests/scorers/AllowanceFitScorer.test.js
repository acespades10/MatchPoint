import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AllowanceFitScorer } from '../../src/scorers/student-side/AllowanceFitScorer.js'

const scorer = new AllowanceFitScorer()

test('AllowanceFit: null allowance returns neutral 50', () => {
  const student = { preferences: { minAllowance: 500 } }
  assert.equal(scorer.score(student, { allowance: null }), 50)
})

test('AllowanceFit: no student floor returns mildly positive 75', () => {
  const student = { preferences: {} }
  assert.equal(scorer.score(student, { allowance: 500 }), 75)
})

test('AllowanceFit: meets or exceeds minimum returns 100', () => {
  const student = { preferences: { minAllowance: 500 } }
  assert.equal(scorer.score(student, { allowance: 600 }), 100)
  assert.equal(scorer.score(student, { allowance: 500 }), 100)
})

test('AllowanceFit: below minimum returns proportional partial score', () => {
  const student = { preferences: { minAllowance: 500 } }
  assert.equal(scorer.score(student, { allowance: 200 }), 40) // 200/500 * 100
})
