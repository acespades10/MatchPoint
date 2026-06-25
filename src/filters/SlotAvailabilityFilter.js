// ─── OJT Scout — SlotAvailabilityFilter ──────────────────────────
// Keep only companies with at least one open slot. Zero (or missing)
// slots = eliminated, never an error — a full company is simply not a
// candidate this cycle.

import { HardFilter } from './HardFilter.js'

export class SlotAvailabilityFilter extends HardFilter {
  get name() {
    return 'SlotAvailabilityFilter'
  }

  passes(company) {
    return typeof company?.availableSlots === 'number' && company.availableSlots > 0
  }
}
