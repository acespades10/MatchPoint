// ─── OJT Scout — CourseExclusivityFilter ─────────────────────────
// Keep companies that accept the student's course.
//
// CRITICAL RULE: an empty (or null) acceptedCourses list means the
// company is open to ALL courses — it must PASS. Never eliminate a
// company just because acceptedCourses is empty/missing. Only eliminate
// when the company lists specific courses AND the student's course is
// not among them.

import { HardFilter } from './HardFilter.js'

export class CourseExclusivityFilter extends HardFilter {
  get name() {
    return 'CourseExclusivityFilter'
  }

  passes(company, criteria) {
    const accepted = company?.acceptedCourses
    // Empty / null / not-an-array ⇒ open to all courses ⇒ pass.
    if (!Array.isArray(accepted) || accepted.length === 0) return true

    const studentCourse = this.#normalize(criteria?.course)
    // Student course unknown but company is restrictive ⇒ can't confirm a
    // match, so eliminate. (A 4th-year FEU profile always has a course.)
    if (!studentCourse) return false

    return accepted.some(c => this.#normalize(c) === studentCourse)
  }

  #normalize(course) {
    return String(course ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
  }
}
