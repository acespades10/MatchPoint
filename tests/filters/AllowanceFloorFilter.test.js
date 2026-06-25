import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AllowanceFloorFilter } from '../../src/filters/AllowanceFloorFilter.js'

const f = new AllowanceFloorFilter()
const cs = { yearLevel: '4th', preferences: { minAllowance: 500 } }

test('AllowanceFloorFilter: happy path — allowance at/above floor passes', () => {
  assert.equal(f.passes({ allowance: 500 }, cs), true)
  assert.equal(f.passes({ allowance: 1000 }, cs), true)
})

test('AllowanceFloorFilter: edge — allowance below floor eliminated', () => {
  assert.equal(f.passes({ allowance: 300 }, cs), false)
})

test('AllowanceFloorFilter: CRITICAL — null allowance passes (unknown ≠ eliminated)', () => {
  assert.equal(f.passes({ allowance: null }, cs), true)
  assert.equal(f.passes({}, cs), true)
})

test('AllowanceFloorFilter: edge — no student floor set ⇒ everything passes', () => {
  assert.equal(f.passes({ allowance: 100 }, { yearLevel: '4th', preferences: {} }), true)
  assert.equal(f.passes({ allowance: 100 }, { yearLevel: '4th' }), true)
})
