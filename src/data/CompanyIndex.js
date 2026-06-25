// ─── OJT Scout — CompanyIndex ────────────────────────────────────
// Encapsulation pillar: raw data and indexes are private (#).
// Built once on startup. All lookups are O(1) Set/Map operations —
// zero tokens, microsecond cost (Phase 2 depends on this).
//
// In this demo build the source is the local JSON file, not Google Sheets.

import { readFile } from 'node:fs/promises'

export class CompanyIndex {
  static #instance = null
  static getInstance() {
    if (!this.#instance) this.#instance = new CompanyIndex()
    return this.#instance
  }

  #raw = []
  #byId = new Map()
  #byCourse = {} // course → Set<id>  (key 'ALL' = open to all courses)
  #bySetup = {} // setup  → Set<id>
  #byCity = {} // city   → Set<id>
  #activeNow = new Set() // ids with hasActiveInterns === true
  #ready = false

  // Build all indexes from an array of company records.
  init(companies) {
    this.#raw = Array.isArray(companies) ? companies : []
    this.#byId.clear()
    this.#byCourse = {}
    this.#bySetup = {}
    this.#byCity = {}
    this.#activeNow.clear()

    for (const company of this.#raw) {
      this.#byId.set(company.id, company)
      if (company.hasActiveInterns) this.#activeNow.add(company.id)

      this.#addToIndex(this.#bySetup, company.setup, company.id)
      this.#addToIndex(this.#byCity, company.city, company.id)

      const courses =
        company.acceptedCourses && company.acceptedCourses.length
          ? company.acceptedCourses
          : ['ALL']
      for (const course of courses) {
        this.#addToIndex(this.#byCourse, course, company.id)
      }
    }

    this.#ready = true
    return this
  }

  // Convenience loader for the demo's local JSON source.
  async initFromFile(path) {
    const text = await readFile(path, 'utf-8')
    return this.init(JSON.parse(text))
  }

  // ─── Public read interface ─────────────────────────────────────
  isReady() {
    return this.#ready
  }
  getAll() {
    return [...this.#raw]
  }
  getById(id) {
    return this.#byId.get(id) ?? null
  }
  getActive() {
    return [...this.#activeNow]
  }
  // Sorted unique city names (for the results filter dropdown).
  getCities() {
    return Object.keys(this.#byCity).sort((a, b) => a.localeCompare(b))
  }
  getTotalCount() {
    return this.#raw.length
  }

  // Set intersection across course/setup/city — used by later phases.
  getForStudent(course, setup, city) {
    const allIds = new Set(this.#byId.keys())
    const byCourse = new Set([
      ...(this.#byCourse[course] ?? []),
      ...(this.#byCourse['ALL'] ?? [])
    ])
    const courseSet = byCourse.size ? byCourse : allIds
    const setupSet = this.#bySetup[setup] ?? allIds
    const citySet = this.#byCity[city] ?? allIds

    return [...courseSet]
      .filter(id => setupSet.has(id) && citySet.has(id))
      .map(id => this.#byId.get(id))
  }

  // ─── Private helpers ───────────────────────────────────────────
  #addToIndex(index, key, id) {
    if (!key) return
    if (!index[key]) index[key] = new Set()
    index[key].add(id)
  }
}
