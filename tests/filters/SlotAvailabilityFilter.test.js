import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SlotAvailabilityFilter } from '../../src/filters/SlotAvailabilityFilter.js'

const f = new SlotAvailabilityFilter()
const criteria = { yearLevel: '4th' }

test('SlotAvailabilityFilter: happy path — slots > 0 passes', () => {
  assert.equal(f.passes({ availableSlots: 5 }, criteria), true)
  assert.equal(f.passes({ availableSlots: 1 }, criteria), true)
})

test('SlotAvailabilityFilter: edge — zero slots eliminated (not errored)', () => {
  assert.equal(f.passes({ availableSlots: 0 }, criteria), false)
})

test('SlotAvailabilityFilter: edge — null/missing/non-number slots blocked', () => {
  assert.equal(f.passes({ availableSlots: null }, criteria), false)
  assert.equal(f.passes({}, criteria), false)
  assert.equal(f.passes({ availableSlots: '5' }, criteria), false)
})
