import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CourseExclusivityFilter } from '../../src/filters/CourseExclusivityFilter.js'

const f = new CourseExclusivityFilter()
const cs = { yearLevel: '4th', course: 'BS Computer Science' }

test('CourseExclusivityFilter: happy path — listed course passes', () => {
  assert.equal(f.passes({ acceptedCourses: ['BS Computer Science', 'BS IT'] }, cs), true)
})

test('CourseExclusivityFilter: happy path — case/space-insensitive match', () => {
  assert.equal(f.passes({ acceptedCourses: ['bs computer  science'] }, cs), true)
})

test('CourseExclusivityFilter: CRITICAL — empty acceptedCourses passes (open to all)', () => {
  assert.equal(f.passes({ acceptedCourses: [] }, cs), true)
})

test('CourseExclusivityFilter: CRITICAL — null/missing acceptedCourses passes', () => {
  assert.equal(f.passes({ acceptedCourses: null }, cs), true)
  assert.equal(f.passes({}, cs), true)
})

test('CourseExclusivityFilter: edge — restrictive list excluding course blocked', () => {
  assert.equal(f.passes({ acceptedCourses: ['BS Nursing'] }, cs), false)
})

test('CourseExclusivityFilter: edge — restrictive list + unknown student course blocked', () => {
  assert.equal(f.passes({ acceptedCourses: ['BS Nursing'] }, { yearLevel: '4th' }), false)
})
