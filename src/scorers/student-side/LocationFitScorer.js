// ─── OJT Scout — LocationFitScorer (student-side) ────────────────
// Proximity between the student's home location and the company.
// Pure math, zero tokens.
//
//   same city ............ 100
//   remote (company) ..... 100  (location is irrelevant if remote)
//   both in Metro Manila .. 70
//   otherwise ............. 40
//   no home location set .. 50  (neutral — nothing to compare)

import { BaseScorer } from '../../core/BaseScorer.js'

const METRO_MANILA_CITIES = [
  'Makati', 'Taguig', 'Pasig', 'Quezon City', 'Mandaluyong', 'Pasay',
  'Manila', 'Paranaque', 'Muntinlupa', 'Marikina', 'Caloocan', 'Las Pinas',
  'San Juan', 'Valenzuela', 'Pateros', 'Alabang'
].map(c => c.toLowerCase())

export class LocationFitScorer extends BaseScorer {
  score(student, company) {
    const home = student?.preferences?.homeLocation
    if (!home) return 50 // neutral — nothing to compare against

    const studentCity = String(home).toLowerCase().trim()
    const companyCity = String(company?.city ?? '').toLowerCase().trim()
    const companySetup = String(company?.setup ?? '').toLowerCase().trim()

    // Remote work makes physical location irrelevant.
    if (companyCity === 'remote' || companySetup === 'remote') return 100

    if (companyCity && studentCity === companyCity) return 100

    const studentMetro = METRO_MANILA_CITIES.includes(studentCity)
    const companyMetro = METRO_MANILA_CITIES.includes(companyCity)
    if (studentMetro && companyMetro) return 70

    return 40
  }

  explain(score) {
    switch (score) {
      case 100: return 'Same city or remote — no commute concern.'
      case 70: return 'Both within Metro Manila — manageable commute.'
      case 50: return 'No home location set — scored neutral.'
      default: return 'Outside your area — longer commute likely.'
    }
  }
}
