import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SkillsMatchScorer } from '../../src/scorers/student-side/SkillsMatchScorer.js'

const student = {
  skills: [{ skill: 'Python' }, { skill: 'React' }]
}

test('SkillsMatch: empty techStack returns neutral 50', () => {
  const r = new SkillsMatchScorer().score(student, { enriched: { techStack: [] } })
  assert.equal(r.score, 50)
  assert.deepEqual(r.matched, [])
  assert.deepEqual(r.gaps, [])
})

test('SkillsMatch: missing enriched object handled gracefully (50)', () => {
  const r = new SkillsMatchScorer().score(student, {})
  assert.equal(r.score, 50)
})

test('SkillsMatch: matched + gaps computed correctly, case-insensitive', () => {
  const r = new SkillsMatchScorer().score(student, {
    enriched: { techStack: ['Python', 'React', 'Java'] }
  })
  assert.deepEqual(r.matched.sort(), ['python', 'react'])
  assert.deepEqual(r.gaps, ['java'])
  assert.equal(r.score, 67) // round(2/3 * 100)
})

test('SkillsMatch: full coverage scores 100', () => {
  const r = new SkillsMatchScorer().score(student, {
    enriched: { techStack: ['Python', 'React'] }
  })
  assert.equal(r.score, 100)
  assert.deepEqual(r.gaps, [])
})
