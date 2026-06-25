import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOAStatusFilter } from '../../src/filters/MOAStatusFilter.js'

const f = new MOAStatusFilter()
const criteria = { yearLevel: '4th' }

test('MOAStatusFilter: happy path — Active MOA passes', () => {
  assert.equal(f.passes({ moaStatus: 'Active' }, criteria), true)
})

test('MOAStatusFilter: edge — Expired/other status blocked', () => {
  assert.equal(f.passes({ moaStatus: 'Expired' }, criteria), false)
  assert.equal(f.passes({ moaStatus: 'Pending' }, criteria), false)
})

test('MOAStatusFilter: edge — null/missing status blocked, no throw', () => {
  assert.equal(f.passes({ moaStatus: null }, criteria), false)
  assert.equal(f.passes({}, criteria), false)
  assert.equal(f.passes(null, criteria), false)
})
