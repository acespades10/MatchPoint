import { test } from 'node:test'
import assert from 'node:assert/strict'
import { YearLevelFilter } from '../../src/filters/YearLevelFilter.js'

const company = { id: 'c1' }
const f = new YearLevelFilter()

test('YearLevelFilter: happy path — 4th year student passes', () => {
  assert.equal(f.passes(company, { yearLevel: '4th' }), true)
})

test('YearLevelFilter: edge — non-4th year student blocked', () => {
  assert.equal(f.passes(company, { yearLevel: '3rd' }), false)
})

test('YearLevelFilter: edge — missing/null criteria blocked, no throw', () => {
  assert.equal(f.passes(company, null), false)
  assert.equal(f.passes(company, {}), false)
})

test('YearLevelFilter: apply eliminates all companies for non-4th year', () => {
  const out = f.apply([{ id: 'a' }, { id: 'b' }], { yearLevel: '2nd' })
  assert.equal(out.length, 0)
})
