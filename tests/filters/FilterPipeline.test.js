import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FilterPipeline } from '../../src/filters/FilterPipeline.js'

const profile = {
  yearLevel: '4th',
  course: 'BS Computer Science',
  preferences: { minAllowance: 500, setup: 'hybrid' }
}

// A company that should clear every filter.
const goodCompany = {
  id: 'good',
  moaStatus: 'Active',
  availableSlots: 5,
  acceptedCourses: [], // open to all
  allowance: null, // unknown ⇒ passes
  setup: null // unknown ⇒ passes
}

test('FilterPipeline: runs in fixed order Year → MOA → Slots → Course → Allowance → Setup', () => {
  const fp = new FilterPipeline()
  assert.deepEqual(fp.filterNames, [
    'YearLevelFilter',
    'MOAStatusFilter',
    'SlotAvailabilityFilter',
    'CourseExclusivityFilter',
    'AllowanceFloorFilter',
    'SetupPreferenceFilter'
  ])
})

test('FilterPipeline: happy path — good company survives', () => {
  const { survivors, steps } = new FilterPipeline().run([goodCompany], profile)
  assert.equal(survivors.length, 1)
  assert.equal(steps.length, 6)
  assert.equal(steps[0].before, 1)
})

test('FilterPipeline: mixed batch — only eligible companies survive', () => {
  const companies = [
    goodCompany,
    { id: 'noMoa', moaStatus: 'Expired', availableSlots: 5 },
    { id: 'noSlots', moaStatus: 'Active', availableSlots: 0 },
    { id: 'wrongCourse', moaStatus: 'Active', availableSlots: 2, acceptedCourses: ['BS Nursing'] },
    { id: 'lowPay', moaStatus: 'Active', availableSlots: 2, allowance: 100 },
    { id: 'wrongSetup', moaStatus: 'Active', availableSlots: 2, setup: 'onsite', acceptedCourses: [] }
  ]
  // student setup is 'hybrid' so 'onsite' company is eliminated
  const { survivors } = new FilterPipeline().run(companies, profile)
  assert.deepEqual(survivors.map(c => c.id), ['good'])
})

test('FilterPipeline: every step reports before/after/eliminated', () => {
  const { steps } = new FilterPipeline().run([goodCompany], profile)
  for (const s of steps) {
    assert.equal(typeof s.before, 'number')
    assert.equal(typeof s.after, 'number')
    assert.equal(s.eliminated, s.before - s.after)
  }
})

test('FilterPipeline: empty input ⇒ empty output, no throw', () => {
  const { survivors } = new FilterPipeline().run([], profile)
  assert.equal(survivors.length, 0)
})
