// ─── OJT Scout — NoMatchHandler ──────────────────────────────────
// The system never returns a bare "no results". When Phase 2 eliminates
// everything, this explains WHY and what to do about it.
//
//   level1() — relax each hard filter one at a time and report which
//              single relaxation unlocks the most companies. Pure logic,
//              zero tokens (it just re-runs the filter pipeline minus one
//              filter against the same company list).
//   level2() — reach-goal pathways (Phase 3 territory). Stub for now.
//   level3() — alternative pathways. Stub for now.

import { FilterPipeline } from '../filters/FilterPipeline.js'
import { YearLevelFilter } from '../filters/YearLevelFilter.js'
import { MOAStatusFilter } from '../filters/MOAStatusFilter.js'
import { SlotAvailabilityFilter } from '../filters/SlotAvailabilityFilter.js'
import { CourseExclusivityFilter } from '../filters/CourseExclusivityFilter.js'
import { AllowanceFloorFilter } from '../filters/AllowanceFloorFilter.js'
import { SetupPreferenceFilter } from '../filters/SetupPreferenceFilter.js'

export class NoMatchHandler {
  #companies
  #criteria

  constructor(companies, criteria) {
    this.#companies = Array.isArray(companies) ? companies : []
    this.#criteria = criteria ?? {}
  }

  // Try removing each filter individually; measure how many companies
  // survive without it. Returns the list sorted by impact (most unlocked
  // first): [{ relaxation, companiesUnlocked }].
  level1() {
    const filterClasses = [
      ['YearLevelFilter', YearLevelFilter],
      ['MOAStatusFilter', MOAStatusFilter],
      ['SlotAvailabilityFilter', SlotAvailabilityFilter],
      ['CourseExclusivityFilter', CourseExclusivityFilter],
      ['AllowanceFloorFilter', AllowanceFloorFilter],
      ['SetupPreferenceFilter', SetupPreferenceFilter]
    ]

    const results = filterClasses.map(([name, Cls]) => {
      // Build the pipeline with every filter EXCEPT this one.
      const remaining = filterClasses
        .filter(([n]) => n !== name)
        .map(([, C]) => new C())

      const { survivors } = new FilterPipeline(remaining).run(
        this.#companies,
        this.#criteria
      )

      return { relaxation: name, companiesUnlocked: survivors.length }
    })

    return results
      .filter(r => r.companiesUnlocked > 0)
      .sort((a, b) => b.companiesUnlocked - a.companiesUnlocked)
  }

  // Reach-goal pathways — implemented alongside Phase 3.
  level2() {
    return []
  }

  // Alternative pathways — implemented later.
  level3() {
    return []
  }
}
