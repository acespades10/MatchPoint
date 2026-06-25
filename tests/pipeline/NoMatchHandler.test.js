import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NoMatchHandler } from '../../src/pipeline/NoMatchHandler.js'

test('NoMatchHandler.level1: identifies the relaxation that unlocks the most companies', () => {
  // All companies fail ONLY on slots (0). Relaxing SlotAvailabilityFilter
  // should unlock all 3; no other single relaxation helps.
  const companies = [
    { id: 'a', moaStatus: 'Active', availableSlots: 0, acceptedCourses: [] },
    { id: 'b', moaStatus: 'Active', availableSlots: 0, acceptedCourses: [] },
    { id: 'c', moaStatus: 'Active', availableSlots: 0, acceptedCourses: [] }
  ]
  const criteria = { yearLevel: '4th', course: 'BS Computer Science', preferences: {} }

  const result = new NoMatchHandler(companies, criteria).level1()
  assert.ok(Array.isArray(result))
  assert.equal(result[0].relaxation, 'SlotAvailabilityFilter')
  assert.equal(result[0].companiesUnlocked, 3)
})

test('NoMatchHandler.level1: returns sorted by impact, omits zero-impact relaxations', () => {
  const companies = [
    { id: 'a', moaStatus: 'Active', availableSlots: 0, acceptedCourses: [] }
  ]
  const criteria = { yearLevel: '4th', course: 'BS Computer Science', preferences: {} }
  const result = new NoMatchHandler(companies, criteria).level1()
  // descending order
  for (let i = 1; i < result.length; i++) {
    assert.ok(result[i - 1].companiesUnlocked >= result[i].companiesUnlocked)
  }
  // no entries with zero unlocked
  assert.ok(result.every(r => r.companiesUnlocked > 0))
})

test('NoMatchHandler.level2 / level3: stubs return empty arrays', () => {
  const h = new NoMatchHandler([], {})
  assert.deepEqual(h.level2(), [])
  assert.deepEqual(h.level3(), [])
})
