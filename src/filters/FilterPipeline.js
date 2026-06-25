// ─── OJT Scout — FilterPipeline ──────────────────────────────────
// Polymorphism pillar: runs an ordered list of HardFilter instances via
// Array.reduce() without knowing which concrete filter each one is.
//
// Fixed order: Year → MOA → Slots → Course → Allowance → Setup.
// Earlier, cheaper, higher-elimination gates run first so later filters
// see fewer companies. Pure logic — zero tokens, no API calls.

import { YearLevelFilter } from './YearLevelFilter.js'
import { MOAStatusFilter } from './MOAStatusFilter.js'
import { SlotAvailabilityFilter } from './SlotAvailabilityFilter.js'
import { CourseExclusivityFilter } from './CourseExclusivityFilter.js'
import { AllowanceFloorFilter } from './AllowanceFloorFilter.js'
import { SetupPreferenceFilter } from './SetupPreferenceFilter.js'

export class FilterPipeline {
  #filters

  // Default = the canonical Phase 2 order. Override only for testing.
  constructor(filters) {
    this.#filters =
      filters ?? [
        new YearLevelFilter(),
        new MOAStatusFilter(),
        new SlotAvailabilityFilter(),
        new CourseExclusivityFilter(),
        new AllowanceFloorFilter(),
        new SetupPreferenceFilter()
      ]
  }

  // Names in execution order — useful for reporting/UI labels.
  get filterNames() {
    return this.#filters.map(f => f.name)
  }

  // Reduce the company list through every filter, recording the funnel.
  // Returns { survivors, steps }, where each step is one filter's
  // before/after/eliminated counts. `logger` (PipelineLogger) is optional.
  run(companies, criteria, logger = null) {
    const initial = Array.isArray(companies) ? companies : []
    const steps = []

    const survivors = this.#filters.reduce((current, filter) => {
      const before = current.length
      const next = filter.apply(current, criteria)
      const after = next.length

      const step = { filter: filter.name, before, after, eliminated: before - after }
      steps.push(step)
      logger?.log({ phase: 'Pre-Screen', ...step, tokens: 0 })

      return next
    }, initial)

    return { survivors, steps }
  }
}
