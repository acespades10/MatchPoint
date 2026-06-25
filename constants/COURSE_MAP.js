// ─── OJT Scout — Course → Industry Relevance Map ─────────────────
// Zero token cost — pure keyword lookup for Phase 3 (Smart Relevance Check).
//
// Phase 3 decides which companies are worth scoring for a given course by
// classifying each company's free-text `industry` string into one of four
// relevance tiers. We KEEP direct + adjacent; we DROP stretch + irrelevant
// (stretch can be re-added by NoMatchHandler level 2 if the pool is thin).
//
//   direct     → core field for the course (highest signal)
//   adjacent   → related field that routinely hires the course's skills
//   stretch    → only relevant if the company has a tech/IT arm (dropped by
//                default, recoverable)
//   irrelevant → no realistic fit for the course (dropped)
//
// Matching is KEYWORD/substring based, not exact — IALAP `industry` strings
// are messy and inconsistent ("Software & Computer Services", "Software and
// Computer Services", "IT Company", "IT Solution", …). We lowercase + pad
// with spaces so a keyword like " it " behaves like a word-boundary match
// ("IT Services" hits, "Credit" / "Audit" do not).
//
// Extensible: add a new entry to COURSE_RELEVANCE_PROFILES keyed by a course
// family, then map the course name to that family in resolveProfileKey().

export const COURSE_RELEVANCE_PROFILES = {
  // Computer Science / Information Technology and adjacent tech courses.
  'cs-it': {
    direct: [
      'software',
      'computer',
      'information technology',
      ' it ', // word-boundary IT (padded string) → "IT Services", "IT Company"
      'it services',
      'it solution',
      'it company',
      'it consult',
      'it support',
      'infotech',
      'technolog', // Technology / Technologies / Technological
      'cyber',
      'game',
      'telecom',
      'e-commerce',
      'ecommerce',
      'fintech',
      'saas',
      'web develop',
      'app develop',
      'application develop',
      'systems develop',
      'systems integrat',
      'programming',
      'data science',
      'data analytics'
    ],
    adjacent: [
      'bank',
      'financ', // Finance / Financial
      'media', // Media (with digital arm) — also matches multimedia/social media
      'bpo',
      'business process',
      'outsourc',
      'consult', // Engineering / business consultancy — usually has IT systems
      'publish' // Educational publishing (with tech)
    ],
    stretch: [
      'manufactur', // only relevant if they run IT systems
      'retail', // only relevant if e-commerce/tech
      'electronic',
      'electrical',
      'automobile',
      'industrial'
    ]
    // Everything that matches none of the above → 'irrelevant'.
  }
}

// Map a free-text course name to a relevance profile key. For this demo every
// course resolves to the CS/IT profile (the only audience), but new course
// families (e.g. 'business', 'engineering') can be added here without touching
// Phase 3.
export function resolveProfileKey(course = '') {
  const c = String(course).toLowerCase()
  if (
    c.includes('computer') ||
    c.includes('information technology') ||
    c.includes('infotech') ||
    c.includes('software') ||
    c.includes('bsit') ||
    c.includes('bscs') ||
    c.includes('it')
  ) {
    return 'cs-it'
  }
  // Default for the demo audience.
  return 'cs-it'
}

// Classify one company industry string into a relevance tier for a course.
// Pure function, zero tokens. Order matters: direct beats adjacent beats
// stretch; anything else is irrelevant.
export function classifyIndustry(industry, course = 'BS Computer Science') {
  const profile = COURSE_RELEVANCE_PROFILES[resolveProfileKey(course)]
  // Pad so leading/trailing keywords (and " it ") match like word boundaries.
  const norm = ` ${String(industry ?? '').toLowerCase()} `

  if (profile.direct.some(k => norm.includes(k))) return 'direct'
  if (profile.adjacent.some(k => norm.includes(k))) return 'adjacent'
  if (profile.stretch.some(k => norm.includes(k))) return 'stretch'
  return 'irrelevant'
}

// Tiers Phase 3 keeps by default. Exposed so callers (and tests) share one
// source of truth.
export const RELEVANT_TIERS = ['direct', 'adjacent']
