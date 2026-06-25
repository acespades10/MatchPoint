import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SetupPreferenceFilter } from '../../src/filters/SetupPreferenceFilter.js'

const f = new SetupPreferenceFilter()
const pref = setup => ({ yearLevel: '4th', preferences: { setup } })

test('SetupPreferenceFilter: happy path — exact setup match passes', () => {
  assert.equal(f.passes({ setup: 'remote' }, pref('remote')), true)
  assert.equal(f.passes({ setup: 'onsite' }, pref('onsite')), true)
})

test("SetupPreferenceFilter: 'any' student preference ⇒ all pass", () => {
  assert.equal(f.passes({ setup: 'onsite' }, pref('any')), true)
  assert.equal(f.passes({ setup: 'remote' }, pref('any')), true)
})

test('SetupPreferenceFilter: unset student preference ⇒ all pass', () => {
  assert.equal(f.passes({ setup: 'onsite' }, { yearLevel: '4th', preferences: {} }), true)
})

test('SetupPreferenceFilter: company hybrid satisfies both remote and onsite', () => {
  assert.equal(f.passes({ setup: 'hybrid' }, pref('remote')), true)
  assert.equal(f.passes({ setup: 'hybrid' }, pref('onsite')), true)
})

test('SetupPreferenceFilter: null company setup passes (unknown ≠ eliminated)', () => {
  assert.equal(f.passes({ setup: null }, pref('remote')), true)
  assert.equal(f.passes({}, pref('onsite')), true)
})

test('SetupPreferenceFilter: edge — mismatched concrete setups blocked', () => {
  assert.equal(f.passes({ setup: 'onsite' }, pref('remote')), false)
  assert.equal(f.passes({ setup: 'remote' }, pref('onsite')), false)
})
