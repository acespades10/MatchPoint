# OJT Scout — Master Architecture Document
> AI-Powered OJT Matching, Application & Tracking Platform  
> AI Campus Launch Hackathon 2026 | FEU  
> Stack: Next.js · Node.js · OpenAI API · Google Sheets API

---

## Table of Contents

1. [System Philosophy](#1-system-philosophy)
2. [OOP Design Principles](#2-oop-design-principles)
3. [Project Structure](#3-project-structure)
4. [Data Models](#4-data-models)
5. [Pipeline Architecture](#5-pipeline-architecture)
6. [Scoring System](#6-scoring-system)
7. [Prompt Registry](#7-prompt-registry)
8. [Optimization Techniques](#8-optimization-techniques)
9. [Error Handling Strategy](#9-error-handling-strategy)
10. [API Layer](#10-api-layer)
11. [Frontend Architecture](#11-frontend-architecture)
12. [ML Layer](#12-ml-layer)
13. [Environment & Configuration](#13-environment--configuration)

---

## 1. System Philosophy

OJT Scout is not a chatbot. It is a **continuously operating agentic pipeline** that moves a 4th-year FEU student from zero to officially deployed — without them needing to manage the process manually.

### Core Principles

```
PRINCIPLE 1 — Filter First, Enrich Later
  Never spend tokens on irrelevant data.
  Eliminate before enriching, always.

PRINCIPLE 2 — Degrade Gracefully
  Every failure state has a next action.
  The system never returns a dead end.

PRINCIPLE 3 — Honest Over Optimistic
  Scores reflect reality. Documents reflect
  the student's actual words. Gaps are named,
  not hidden.

PRINCIPLE 4 — Cache Aggressively
  Expensive work runs once and is reused.
  Per-student cost decreases with every
  student who uses the system.

PRINCIPLE 5 — Agent, Not Assistant
  The system acts without being prompted.
  Follow-ups draft themselves. Alerts fire
  automatically. The student reviews and approves.
```

### User Scope
- **Target user:** 4th-year FEU students (all campuses)
- **OJT requirement:** ~486 hours
- **Partner database:** FEU IALAP sheet (~1,000 companies)
- **Active companies:** subset with current FEU interns

---

## 2. OOP Design Principles

The entire codebase is organized around four OOP pillars. Each class has one job.

### 2.1 Abstraction — Base Classes Define Contracts

```javascript
// Every scorer extends this — enforces consistent interface
export abstract class BaseScorer {
  abstract score(student, company, preferences)  // must implement
  abstract explain(scoreResult)                   // must implement

  // Shared utility — available to all scorers
  normalize(value, min, max) {
    return Math.min(100, Math.max(0,
      ((value - min) / (max - min)) * 100
    ))
  }

  applyWeight(score, weight) {
    return score * Math.min(1, Math.max(0, weight))
  }
}

// Every prompt handler extends this
export abstract class BasePrompt {
  abstract buildSystemPrompt()    // must implement
  abstract buildUserPrompt(input) // must implement
  abstract parseResponse(raw)     // must implement

  temperature = 0  // default — override per subclass
  model = 'gpt-4o' // default

  async run(input) {
    const response = await openai.chat.completions.create({
      model: this.model,
      temperature: this.temperature,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.buildSystemPrompt() },
        { role: 'user',   content: this.buildUserPrompt(input) }
      ]
    })
    return this.parseResponse(response.choices[0].message.content)
  }
}

// Every filter extends this
export abstract class BaseFilter {
  abstract name: string
  abstract apply(companies, criteria)  // must implement

  // Shared logging
  logElimination(before, after, reason) {
    console.log(`[${this.name}] ${before} → ${after} (-${before - after}) | ${reason}`)
  }
}

// Every cache layer extends this
export abstract class BaseCache {
  abstract get(key)
  abstract set(key, value, ttlDays)
  abstract invalidate(key)

  isExpired(timestamp, ttlDays) {
    const now = Date.now()
    const age = now - new Date(timestamp).getTime()
    return age > ttlDays * 24 * 60 * 60 * 1000
  }
}
```

---

### 2.2 Encapsulation — Implementation Hidden Behind Clean Interfaces

```javascript
// ✅ Consumer only sees clean methods
// ✅ Internal implementation details hidden

export class CompanyIndex {
  #raw = []           // private — consumers never touch raw data
  #byCourse = {}      // private — internal index
  #bySetup = {}       // private
  #byLocation = {}    // private
  #activeNow = new Set() // private

  constructor(sheetData) {
    this.#buildIndex(sheetData)  // private build on construct
  }

  // Public interface — clean and intentional
  getForStudent(course, setup, location) {
    return this.#intersect(
      this.#byCourse[course] ?? [],
      this.#bySetup[setup]   ?? [],
      this.#byLocation[location] ?? []
    )
  }

  getActive()              { return [...this.#activeNow] }
  getById(id)              { return this.#raw.find(c => c.id === id) }
  getTotalCount()          { return this.#raw.length }

  // Private — not exposed
  #buildIndex(data) { /* index construction logic */ }
  #intersect(...sets) { /* set intersection logic */ }
}

// ✅ Pipeline state fully encapsulated
export class PipelineSession {
  #studentId
  #profile = null
  #filteredIds = []
  #enrichedMap = {}
  #scores = []
  #documents = {}
  #checklist = {}
  #log = []

  constructor(studentId) { this.#studentId = studentId }

  // Controlled state mutations — no direct property access
  setProfile(profile)              { this.#profile = profile }
  setFilteredIds(ids)              { this.#filteredIds = ids }
  setEnriched(companyId, data)     { this.#enrichedMap[companyId] = data }
  setScores(scores)                { this.#scores = scores }
  setDocuments(companyId, docs)    { this.#documents[companyId] = docs }

  // Read-only views
  getProfile()         { return { ...this.#profile } }
  getTopScores(n = 15) { return this.#scores.slice(0, n) }
  getLog()             { return [...this.#log] }

  log(entry) {
    this.#log.push({ ts: new Date().toISOString(), ...entry })
  }
}
```

---

### 2.3 Inheritance — Shared Logic Once, Specialized Per Type

```javascript
// ─── FILTER HIERARCHY ────────────────────────────────────────

class BaseFilter {
  apply(companies, criteria) { throw new Error('implement apply()') }
}

class HardFilter extends BaseFilter {
  // Hard filters eliminate — return subset
  apply(companies, criteria) {
    const before = companies.length
    const result = companies.filter(c => this.passes(c, criteria))
    this.logElimination(before, result.length, this.name)
    return result
  }
  passes(company, criteria) { throw new Error('implement passes()') }
}

// Each rule is one clean class
class MOAStatusFilter extends HardFilter {
  name = 'MOA Status'
  passes(c) { return c.moaStatus === 'Active' }
}

class SlotAvailabilityFilter extends HardFilter {
  name = 'Slot Availability'
  passes(c) { return c.availableSlots > 0 }
}

class AllowanceFloorFilter extends HardFilter {
  name = 'Allowance Floor'
  passes(c, { minAllowance }) {
    if (!minAllowance || !c.allowance) return true
    return c.allowance >= minAllowance
  }
}

class SetupPreferenceFilter extends HardFilter {
  name = 'Setup Preference'
  passes(c, { setup }) {
    if (!setup || setup === 'any') return true
    return c.setup === setup || c.setup === 'hybrid'
  }
}

class CourseExclusivityFilter extends HardFilter {
  name = 'Course Exclusivity'
  passes(c, { course }) {
    if (!c.acceptedCourses?.length) return true
    return c.acceptedCourses.includes(course)
  }
}

class YearLevelFilter extends HardFilter {
  name = 'Year Level'
  // OJT is 4th year only
  passes(c, { yearLevel }) { return yearLevel === '4th' }
}

// ─── SCORER HIERARCHY ─────────────────────────────────────────

class BaseScorer { /* as above */ }

// Student → Company side
class SkillsMatchScorer extends BaseScorer {
  score(student, company) { /* skills coverage logic */ }
  explain(result) { /* human-readable explanation */ }
}

class AllowanceFitScorer extends BaseScorer {
  score(student, company, prefs) { /* allowance comparison */ }
  explain(result) { /* explanation */ }
}

class LocationFitScorer extends BaseScorer {
  score(student, company, prefs) { /* distance + setup logic */ }
  explain(result) { /* explanation */ }
}

// Company → Student side (bilateral)
class SkillsReadinessScorer extends BaseScorer {
  score(student, company) { /* readiness from company POV */ }
  explain(result) { /* explanation */ }
}

class LearnabilityScorer extends BaseScorer {
  #adjacencyMap = SKILL_ADJACENCY  // imported constant

  score(student, company) {
    const gaps = this.#findGaps(student.skills, company.requiredSkills)
    return gaps.map(gap => ({
      skill: gap,
      learnability: this.#classifyGap(gap, student.skills),
      penalty: this.#computePenalty(gap)
    }))
  }

  #classifyGap(missingSkill, studentSkills) {
    const hasAdjacent = studentSkills.some(s =>
      this.#adjacencyMap[s]?.adjacent.includes(missingSkill)
    )
    const hasTransferable = studentSkills.some(s =>
      this.#adjacencyMap[s]?.transferable.includes(missingSkill)
    )
    if (hasAdjacent)     return 'BRIDGEABLE'
    if (hasTransferable) return 'MANAGEABLE'
    return 'BLOCKING'
  }

  #findGaps(studentSkills, required) {
    return required.filter(r =>
      !studentSkills.some(s => s.skill === r)
    )
  }

  #computePenalty(gap) {
    const map = { BRIDGEABLE: 5, MANAGEABLE: 15, BLOCKING: 35 }
    return map[gap] ?? 20
  }

  explain(result) { /* explanation */ }
}

// ─── PROMPT HIERARCHY ─────────────────────────────────────────

class BasePrompt { /* as above */ }

// Factual prompts — temperature 0, strict schema
class FactualPrompt extends BasePrompt {
  temperature = 0
  // Factual prompts enforce strict JSON output
  async run(input) {
    return super.run(input)  // inherits base run
  }
}

// Creative prompts — temperature 0.7
class CreativePrompt extends BasePrompt {
  temperature = 0.7
}

// Concrete implementations
class ResumeParserPrompt extends FactualPrompt {
  buildSystemPrompt() { return PROMPTS.RESUME_PARSER.system }
  buildUserPrompt(input) { return JSON.stringify(input) }
  parseResponse(raw) { return JSON.parse(raw) }
}

class BatchRelevancePrompt extends FactualPrompt {
  buildSystemPrompt() { return PROMPTS.BATCH_RELEVANCE.system }
  buildUserPrompt({ course, companies }) {
    return JSON.stringify({ course, companies })
  }
  parseResponse(raw) { return JSON.parse(raw).classifications }
}

class DocumentFactoryPrompt extends CreativePrompt {
  buildSystemPrompt() { return PROMPTS.DOCUMENT_FACTORY.system }
  buildUserPrompt(input) { return JSON.stringify(input) }
  parseResponse(raw) { return JSON.parse(raw) }
}
```

---

### 2.4 Polymorphism — Same Interface, Different Behaviors

```javascript
// One pipeline calls score() on any scorer
// Doesn't need to know which one
class BilateralScorer {
  #studentScorers = [
    new SkillsMatchScorer(),
    new AllowanceFitScorer(),
    new LocationFitScorer(),
    new LearningQualityScorer(),
    new BrandValueScorer(),
    new WorkLifeBalanceScorer(),
  ]

  #companyScorers = [
    new SkillsReadinessScorer(),
    new LearnabilityScorer(),
    new AcademicSignalScorer(),
    new ProfilePresentationScorer(),
    new AvailabilityScorer(),
    new GrowthTrajectoryScorer(),
  ]

  scoreAll(student, company, preferences) {
    // Polymorphic — each scorer implements score() differently
    // but is called identically
    const studentSide = this.#studentScorers.map(scorer => ({
      dimension: scorer.constructor.name,
      ...scorer.score(student, company, preferences),
      explanation: scorer.explain(
        scorer.score(student, company, preferences)
      )
    }))

    const companySide = this.#companyScorers.map(scorer => ({
      dimension: scorer.constructor.name,
      ...scorer.score(student, company, preferences),
      explanation: scorer.explain(
        scorer.score(student, company, preferences)
      )
    }))

    return this.#computeBilateral(studentSide, companySide)
  }

  #computeBilateral(studentSide, companySide) {
    const studentScore = this.#weightedAverage(studentSide)
    const companyScore = this.#weightedAverage(companySide)
    return {
      studentFit:        studentScore,
      companyAttraction: companyScore,
      bilateral:         (studentScore * 0.5) + (companyScore * 0.5),
      tier:              this.#getTier(studentScore, companyScore),
      recommendation:    this.#getRecommendation(studentScore, companyScore)
    }
  }

  #getTier(s, c) {
    if (s >= 75 && c >= 75) return 'IDEAL'
    if (s >= 75 && c >= 50) return 'GOOD'
    if (s >= 50 && c >= 75) return 'REACH'
    if (s >= 50 && c >= 50) return 'NEUTRAL'
    return 'SKIP'
  }

  #getRecommendation(s, c) {
    const tier = this.#getTier(s, c)
    return {
      IDEAL:   'apply_now',
      GOOD:    'apply_with_preparation',
      REACH:   'stretch_goal',
      NEUTRAL: 'consider_alternatives',
      SKIP:    'skip'
    }[tier]
  }

  #weightedAverage(scores) {
    const total = scores.reduce((sum, s) => sum + s.weighted, 0)
    return Math.round(total / scores.length)
  }
}

// One filter runner handles all filter types polymorphically
class FilterPipeline {
  #filters = [
    new MOAStatusFilter(),
    new SlotAvailabilityFilter(),
    new YearLevelFilter(),          // 4th year only
    new CourseExclusivityFilter(),
    new AllowanceFloorFilter(),
    new SetupPreferenceFilter(),
  ]

  run(companies, criteria) {
    return this.#filters.reduce(
      (remaining, filter) => filter.apply(remaining, criteria),
      companies
    )
  }
}
```

---

## 3. Project Structure

```
ojt-scout/
├── src/
│   ├── core/                    # Abstract base classes
│   │   ├── BaseFilter.js
│   │   ├── BaseScorer.js
│   │   ├── BasePrompt.js
│   │   └── BaseCache.js
│   │
│   ├── pipeline/                # 7-phase pipeline
│   │   ├── Pipeline.js          # Orchestrator
│   │   ├── PipelineSession.js   # Encapsulated state
│   │   ├── phases/
│   │   │   ├── Phase1_Intake.js
│   │   │   ├── Phase2_PreScreen.js
│   │   │   ├── Phase3_Relevance.js
│   │   │   ├── Phase4_Enrichment.js
│   │   │   ├── Phase5_Scoring.js
│   │   │   ├── Phase6_Documents.js
│   │   │   └── Phase7_Tracking.js
│   │   └── index.js
│   │
│   ├── filters/                 # Hard elimination filters
│   │   ├── HardFilter.js        # Base
│   │   ├── MOAStatusFilter.js
│   │   ├── SlotAvailabilityFilter.js
│   │   ├── YearLevelFilter.js
│   │   ├── CourseExclusivityFilter.js
│   │   ├── AllowanceFloorFilter.js
│   │   ├── SetupPreferenceFilter.js
│   │   └── FilterPipeline.js    # Runs all filters in sequence
│   │
│   ├── scorers/                 # Bilateral scoring
│   │   ├── student-side/        # What student wants
│   │   │   ├── SkillsMatchScorer.js
│   │   │   ├── AllowanceFitScorer.js
│   │   │   ├── LocationFitScorer.js
│   │   │   ├── LearningQualityScorer.js
│   │   │   ├── BrandValueScorer.js
│   │   │   └── WorkLifeBalanceScorer.js
│   │   ├── company-side/        # What company wants
│   │   │   ├── SkillsReadinessScorer.js
│   │   │   ├── LearnabilityScorer.js
│   │   │   ├── AcademicSignalScorer.js
│   │   │   ├── ProfilePresentationScorer.js
│   │   │   ├── AvailabilityScorer.js
│   │   │   └── GrowthTrajectoryScorer.js
│   │   └── BilateralScorer.js   # Combines both sides
│   │
│   ├── prompts/                 # All GPT prompts
│   │   ├── registry.js          # Central prompt registry
│   │   ├── factual/             # temperature: 0
│   │   │   ├── ResumeParserPrompt.js
│   │   │   ├── BatchRelevancePrompt.js
│   │   │   ├── EnrichmentPrompt.js
│   │   │   ├── FitScorerPrompt.js
│   │   │   └── DocumentValidatorPrompt.js
│   │   └── creative/            # temperature: 0.7
│   │       ├── DocumentFactoryPrompt.js
│   │       └── GateEvaluatorPrompt.js
│   │
│   ├── cache/                   # Tiered caching
│   │   ├── MemoryCache.js       # Tier 1 — in-memory
│   │   ├── SheetsCache.js       # Tier 2 — Google Sheets
│   │   ├── SessionCache.js      # Tier 3 — per student session
│   │   └── CacheManager.js      # Unified cache interface
│   │
│   ├── data/
│   │   ├── CompanyIndex.js      # Pre-built index on startup
│   │   ├── SheetsConnector.js   # Google Sheets API
│   │   ├── WisdomVault.js       # Past student intel
│   │   └── constants/
│   │       ├── SKILL_ADJACENCY.js   # Skills graph
│   │       ├── KNOWN_COMPANIES.js   # Pre-enriched top 20
│   │       └── COURSE_MAP.js        # Course → industry map
│   │
│   ├── ml/                      # ML layer
│   │   ├── SkillExtractor.js    # Local NER model
│   │   ├── AcceptanceClassifier.js
│   │   └── VectorSearch.js      # Embedding + cosine similarity
│   │
│   ├── monitoring/
│   │   ├── PipelineLogger.js    # Run logs with token counts
│   │   ├── SlotMonitor.js       # Background slot watcher
│   │   └── ApplicationTracker.js # Follow-up automation
│   │
│   └── api/                     # Next.js API routes
│       ├── pipeline/
│       │   ├── start.js         # POST /api/pipeline/start
│       │   ├── score.js         # POST /api/pipeline/score
│       │   └── documents.js     # POST /api/pipeline/documents
│       ├── checklist/
│       │   ├── status.js        # GET  /api/checklist/:studentId
│       │   └── upload.js        # POST /api/checklist/upload
│       └── companies/
│           └── search.js        # GET  /api/companies/search
│
├── constants/
│   └── prompts.js               # All prompt strings in one file
│
├── tests/                       # Unit tests
│   ├── filters/
│   ├── scorers/
│   └── pipeline/
│
├── .env.example
├── README.md
└── package.json
```

---

## 4. Data Models

```javascript
// ─── STUDENT PROFILE ──────────────────────────────────────────
const StudentProfile = {
  id:          'string',
  name:        'string',
  course:      'string',   // e.g. "BS Computer Science"
  yearLevel:   '4th',      // always 4th — OJT requirement
  campus:      'string',   // FEU Tech / Alabang / Diliman
  gpa:         'number|null',

  skills: [{
    skill:      'string',
    level:      'beginner|intermediate|advanced',
    evidence:   'string',  // required by honesty check
    verified:   'boolean'  // passed honesty gate?
  }],

  experience: [{
    type:         'internship|org|project|freelance',
    title:        'string',
    organization: 'string',
    duration:     'string|null',
    description:  'string'
  }],

  preferences: {
    minAllowance:    'number|null',   // ₱/day
    setup:           'onsite|hybrid|remote|any',
    maxDistanceKm:   'number|null',
    homeLocation:    'string|null',
    targetIndustry:  ['string'],
    learningGoal:    'string',

    weights: {         // student-adjustable, sums to 1.0
      skillsMatch:    0.20,
      allowanceFit:   0.15,
      locationFit:    0.15,
      learningQuality:0.15,
      brandValue:     0.10,
      workLifeBalance:0.10,
      setupPreference:0.10,
      slotAvailability:0.05
    }
  },

  profileCompleteness: 'HIGH|MEDIUM|LOW',
  createdAt:  'ISO string',
  updatedAt:  'ISO string'
}

// ─── COMPANY RECORD ───────────────────────────────────────────
const CompanyRecord = {
  id:              'string',
  name:            'string',
  industry:        'string',
  location:        'string',
  city:            'string',
  setup:           'onsite|hybrid|remote|null',
  availableSlots:  'number',
  moaStatus:       'Active|Expired|Inactive',
  acceptedCourses: ['string'] ,  // empty = all courses
  hasActiveInterns:'boolean',    // from IALAP sheet

  // Enriched fields (GPT + web search)
  enriched: {
    allowance:     'string|null',
    allowanceType: 'daily|monthly|null',
    internTasks:   ['string'],
    techStack:     ['string'],
    workCulture:   'string|null',
    reviewSummary: 'string|null',
    avgRating:     'number|null',
    topPositives:  ['string'],
    topConcerns:   ['string'],
    sources:       ['string'],
    enrichedAt:    'ISO string',
    confidence:    'HIGH|MEDIUM|LOW|NONE'
  },

  // Wisdom Vault (past FEU interns)
  wisdomVault: [{
    batch:        'string',     // e.g. "2025 S1"
    rating:       'number',     // 1-5
    summary:      'string',
    tasksSummary: 'string',
    wouldReturn:  'boolean'
  }]
}

// ─── BILATERAL SCORE ──────────────────────────────────────────
const BilateralScore = {
  companyId:   'string',

  studentSide: {
    skillsMatch:     { score: 0, weight: 0, weighted: 0, reason: '' },
    allowanceFit:    { score: 0, weight: 0, weighted: 0, reason: '' },
    locationFit:     { score: 0, weight: 0, weighted: 0, reason: '' },
    learningQuality: { score: 0, weight: 0, weighted: 0, reason: '' },
    brandValue:      { score: 0, weight: 0, weighted: 0, reason: '' },
    workLifeBalance: { score: 0, weight: 0, weighted: 0, reason: '' },
    subtotal:        0
  },

  companySide: {
    skillsReadiness:    { score: 0, reason: '' },
    learnability:       { score: 0, gaps: [], reason: '' },
    academicSignal:     { score: 0, reason: '' },
    profilePresentation:{ score: 0, reason: '' },
    availability:       { score: 0, reason: '' },
    growthTrajectory:   { score: 0, reason: '' },
    subtotal:           0
  },

  bilateral:      0,
  tier:           'IDEAL|GOOD|REACH|NEUTRAL|SKIP',
  recommendation: 'apply_now|apply_with_preparation|stretch_goal|skip',
  headline:       'string',
  topStrength:    'string',
  topConcern:     'string',
  acceptanceOdds: 'number|null'   // from ML classifier
}

// ─── CHECKLIST ────────────────────────────────────────────────
const ChecklistItem = {
  id:          'string',
  label:       'string',
  type:        'generated|upload|action|pending',
  status:      'complete|pending|failed|waiting',
  companyId:   'string|null',
  phase:       '1|2|3|4|5|6|7',
  required:    'boolean',
  dueDate:     'ISO string|null',
  completedAt: 'ISO string|null',
  notes:       'string|null'
}
```

---

## 5. Pipeline Architecture

```javascript
// ─── ORCHESTRATOR ─────────────────────────────────────────────
// Pipeline.js — coordinates all 7 phases

export class Pipeline {
  #phases = [
    new Phase1_Intake(),
    new Phase2_PreScreen(),
    new Phase3_Relevance(),
    new Phase4_Enrichment(),
    new Phase5_Scoring(),
    new Phase6_Documents(),
    new Phase7_Tracking()
  ]

  async run(resumeFile, rawPreferences) {
    const session = new PipelineSession(uuid())
    const logger  = new PipelineLogger(session.id)

    for (const phase of this.#phases) {
      try {
        logger.startPhase(phase.name)
        await phase.execute(session, logger)
        logger.endPhase(phase.name, session.getLog())
      } catch (err) {
        // Phase failure doesn't kill the pipeline
        // Degrades gracefully to next available phase
        logger.error(phase.name, err)
        await phase.handleFailure(session, err)
      }
    }

    return session.getSummary()
  }
}

// ─── PHASE BASE ───────────────────────────────────────────────
export abstract class BasePhase {
  abstract name: string
  abstract execute(session, logger): Promise<void>

  // Default failure behavior — override per phase if needed
  async handleFailure(session, err) {
    session.log({ phase: this.name, error: err.message, action: 'degraded' })
  }
}

// ─── PHASE 2: PRE-SCREEN (zero tokens) ───────────────────────
class Phase2_PreScreen extends BasePhase {
  name = 'Pre-Screen Filter'

  #pipeline = new FilterPipeline()  // all filters registered here

  async execute(session, logger) {
    const all       = CompanyIndex.getInstance().getAll()
    const criteria  = session.getProfile().preferences
    const filtered  = this.#pipeline.run(all, criteria)

    session.setFilteredIds(filtered.map(c => c.id))
    logger.log({
      input:  all.length,
      output: filtered.length,
      tokens: 0   // zero — pure logic
    })
  }
}

// ─── PHASE 3: RELEVANCE (one batch GPT call) ─────────────────
class Phase3_Relevance extends BasePhase {
  name = 'Smart Relevance Check'

  #prompt = new BatchRelevancePrompt()

  async execute(session, logger) {
    const ids      = session.getFilteredIds()
    const course   = session.getProfile().course
    const companies = ids.map(id => CompanyIndex.getInstance().getById(id))

    // One batch call — all companies in single prompt
    const results = await this.#prompt.run({ course, companies })

    const relevant = results
      .filter(r => r.relevant)
      .map(r => r.id)

    session.setFilteredIds(relevant)
    logger.log({ input: ids.length, output: relevant.length })
  }
}

// ─── PHASE 4: ENRICHMENT (parallel async) ────────────────────
class Phase4_Enrichment extends BasePhase {
  name = 'Data Enrichment'

  #prompt  = new EnrichmentPrompt()
  #cache   = CacheManager.getInstance()
  #limiter = pLimit(5)   // max 5 concurrent API calls

  async execute(session, logger) {
    const ids = session.getFilteredIds()

    await Promise.all(ids.map(id =>
      this.#limiter(async () => {
        // Check known companies first (pre-enriched, free)
        if (KNOWN_COMPANIES[id]) {
          session.setEnriched(id, KNOWN_COMPANIES[id])
          return
        }

        // Check cache — skip if enriched within 30 days
        const cached = await this.#cache.get(`enriched:${id}`)
        if (cached) {
          session.setEnriched(id, cached)
          return
        }

        // Tiered enrichment depth based on vector score
        const depth = this.#getDepth(session.getVectorScore(id))
        const data  = await this.#prompt.run({ id, depth })

        session.setEnriched(id, data)
        await this.#cache.set(`enriched:${id}`, data, 30) // 30-day TTL
      })
    ))
  }

  #getDepth(vectorScore) {
    if (vectorScore > 75) return 'FULL'     // 4 searches
    if (vectorScore > 50) return 'STANDARD' // 2 searches
    if (vectorScore > 30) return 'MINIMAL'  // 1 search
    return 'SKIP'                            // no search
  }
}
```

---

## 6. Scoring System

### 6.1 Skill Adjacency Map

```javascript
// constants/SKILL_ADJACENCY.js
// Zero token cost — pure lookup table

export const SKILL_ADJACENCY = {
  'Python': {
    adjacent:     ['SQL', 'Pandas', 'NumPy', 'R', 'Jupyter'],
    transferable: ['JavaScript', 'Java', 'C#'],
    unrelated:    ['Photoshop', 'AutoCAD', 'Figma']
  },
  'JavaScript': {
    adjacent:     ['TypeScript', 'React', 'Vue', 'Node.js', 'HTML/CSS'],
    transferable: ['Python', 'Java', 'Swift'],
    unrelated:    ['SQL', 'AutoCAD']
  },
  'React': {
    adjacent:     ['Vue', 'Angular', 'Next.js', 'TypeScript'],
    transferable: ['HTML/CSS', 'JavaScript'],
    unrelated:    ['Python', 'SQL', 'Java']
  },
  'Java': {
    adjacent:     ['Kotlin', 'Spring Boot', 'C#', 'C++'],
    transferable: ['Python', 'JavaScript', 'PHP'],
    unrelated:    ['CSS', 'Figma', 'AutoCAD']
  },
  'SQL': {
    adjacent:     ['PostgreSQL', 'MySQL', 'NoSQL', 'MongoDB'],
    transferable: ['Python', 'Excel', 'Tableau'],
    unrelated:    ['CSS', 'Figma', 'Swift']
  },
  'Figma': {
    adjacent:     ['Adobe XD', 'Sketch', 'UI/UX Design'],
    transferable: ['Photoshop', 'Illustrator', 'CSS'],
    unrelated:    ['Python', 'Java', 'SQL']
  }
  // expandable — add per FEU partner tech stacks
}
```

### 6.2 No-Match Fallback Cascade

```javascript
// Graceful degradation — never returns a dead end
export class NoMatchHandler {
  async handle(session) {
    const profile = session.getProfile()
    const prefs   = profile.preferences

    // LEVEL 1 — relax hard filters one at a time
    const relaxed = await this.#tryRelaxFilters(profile, prefs)
    if (relaxed.length > 0) return {
      type:        'RELAXED_FILTERS',
      companies:   relaxed,
      suggestions: this.#explainRelaxation(prefs, relaxed)
    }

    // LEVEL 2 — show reach goals with roadmap
    const reachGoals = await this.#findReachGoals(profile)
    if (reachGoals.length > 0) return {
      type:      'REACH_GOALS',
      companies: reachGoals,
      roadmap:   await this.#buildRoadmap(profile, reachGoals)
    }

    // LEVEL 3 — alternative pathways
    return {
      type:         'ALTERNATIVE_PATHWAYS',
      options: [
        this.#buildColdApplicationOption(profile),
        this.#buildMOARequestOption(profile),
        this.#buildSkillBuildingPlan(profile)
      ]
    }
  }

  #tryRelaxFilters(profile, prefs) {
    const relaxations = [
      { field: 'minAllowance', delta: -100, label: `Lower allowance floor by ₱100` },
      { field: 'setup',        to: 'any',   label: 'Include hybrid setups'         },
      { field: 'maxDistance',  delta: 5,    label: 'Expand radius by 5km'          }
    ]
    // try each relaxation, return first that yields results
  }
}
```

---

## 7. Prompt Registry

All prompts live in one place. No prompt strings scattered across files.

```javascript
// constants/prompts.js

export const PROMPTS = {

  RESUME_PARSER: {
    temperature: 0,
    system: `
You are a resume parsing specialist for Filipino 4th-year university students
applying for OJT. Extract structured data accurately and conservatively.
Never infer skills not explicitly mentioned. If a field is absent, return null.

ANTI-INFLATION RULES:
- Only set level "advanced" if resume shows 2+ years or significant projects
- Skills mentioned once in passing = beginner
- Skills with multiple project examples = intermediate
- Never guess proficiency — default to beginner when uncertain

OUTPUT: Valid JSON only. No preamble. No markdown fences.
SCHEMA: { name, course, yearLevel, gpa, skills[], experience[], 
          certifications[], profileCompleteness, missingCritical[], parserNotes }
    `
  },

  BATCH_RELEVANCE: {
    temperature: 0,
    system: `
You are an OJT placement advisor for Filipino universities.
Classify course-company relevance for all companies in one batch.

CLASSIFICATION RULES:
direct     → core industry matches student course
adjacent   → different industry but has department where skills apply
stretch    → tenuous connection — must name specific reason or mark irrelevant
irrelevant → no plausible connection

FOR CS/IT STUDENTS:
direct:     software companies, tech startups, IT services, cybersecurity
adjacent:   banks with IT dept, telecoms, BPOs with dev tracks, e-commerce
stretch:    media (only if digital arm), manufacturing (only if IT systems)
irrelevant: pure accounting, nursing/medical, psych, physical therapy

REASON RULES:
BAD:  "This company is relevant to CS students"
GOOD: "Metrobank has an in-house IT division where CS interns work on
       internal banking system maintenance and development"

OUTPUT: JSON array — one object per input company, same order.
SCHEMA per item: { id, relevant, matchType, confidence, reason }
    `
  },

  ENRICHMENT: {
    temperature: 0,
    system: `
You are a research assistant gathering factual company data for OJT matching.
Search in this priority order: JobStreet PH → Glassdoor PH → Indeed PH → LinkedIn → Google.

ANTI-HALLUCINATION RULES:
- Never fabricate data. If not found, return null — not an estimate.
- Always attach source URL to every data point.
- If two sources conflict, use the more recent one and note conflict.
- Search specifically for Philippines operations, not global HQ data.
- Distinguish company advertising from actual intern reports — prefer reports.

CONFIDENCE ASSIGNMENT:
HIGH   → found on 2+ independent sources
MEDIUM → found on 1 recent source
LOW    → found on 1 old source or inferred
NONE   → not found — return null, display as unverified

OUTPUT: Valid JSON only.
SCHEMA: { allowance{}, workSetup{}, internTasks{}, techStack{},
          workCulture{}, reviewSummary{}, enrichmentStatus, enrichmentNotes }
    `
  },

  FIT_SCORER: {
    temperature: 0,
    system: `
You are an honest OJT placement advisor. Score matches accurately.
Do not inflate scores to make students feel better — they deserve truth.

ANTI-SYCOPHANCY RULES:
- Never score overall above 85 unless ALL dimensions score above 75
- Always identify at least one genuine concern — even for strong matches
- Skills gaps must be named specifically, not softened
- "top_concern" is required — never return null for it

SCORE CALIBRATION:
90-100: Exceptional — rare, requires near-perfect fit
75-89:  Strong — apply immediately
60-74:  Good — apply with minor preparation
45-59:  Moderate — apply with preparation and realistic expectations
30-44:  Weak — stretch goal territory
0-29:   Poor — not recommended

OUTPUT: Valid JSON only.
    `
  },

  GATE_EVALUATOR: {
    temperature: 0.3,
    system: `
You are a career counselor evaluating whether a student has genuinely thought
through their internship choice before documents are generated.

PASS requires ALL of:
- why_this_company mentions something specific about THIS company (not generic)
- what_to_learn names a concrete skill or experience, not just "gain experience"
- career_connection shows logical link between internship and career direction

FAIL if ANY of:
- "good company" / "famous" / "big name" without specifics
- "to gain experience" without specifying what kind
- "it's near my house" as the only reason
- Career connection absent or circular

PUSHBACK RULES:
- Reference company by name in pushback message
- Suggest what better looks like without writing it for them
- Warm tone — encouraging, not harsh

OUTPUT: Valid JSON only.
SCHEMA: { gateDecision, overallQuality, dimensionFeedback{},
          pushbackMessage, coverLetterSeeds[] }
    `
  },

  DOCUMENT_FACTORY: {
    temperature: 0.7,
    system: `
You are a professional career writing assistant for Filipino 4th-year students.
Write in an authentic student voice — professional but not corporate-stiff.

PERSONALIZATION RULES:
- Every document must be obviously specific to the named company
- Cover letter must reference specific company details from intel brief
- Use student's own gate answers as the emotional core — their words, elevated
- A cover letter that could apply to any company is a failure

PHILIPPINE CONTEXT:
- Use Filipino professional email conventions
- Reference FEU and the student's specific course naturally
- Allowance acknowledgment is appropriate and normal in PH context
- "OJT" not "internship" in formal documents

DOCUMENT QUALITY STANDARDS:
Resume highlights:  skills reordered by company relevance, honest levels
Cover letter:       3-4 paragraphs, specific company refs, genuine tone
Endorsement req:    formal FEU-standard, pre-filled all fields
Application email:  concise, professional, clear CTA, correct attachments

OUTPUT: Valid JSON only — all 5 documents in one response.
    `
  },

  DOCUMENT_VALIDATOR: {
    temperature: 0,
    system: `
You are a document verification assistant for FEU OJT applications.
Verify uploaded documents are correct, complete, readable, and valid.

VALIDATION CHECKS:
1. Document type matches expected type
2. All required fields are present and legible
3. Document is within validity period (if applicable)
4. Correct form version (not outdated)
5. Quality sufficient (not blurry, not cut off)

FEEDBACK RULES:
- Be specific — "Document incomplete" is not acceptable feedback
- Name exactly what is wrong and exactly what to fix
- One issue per object in issues array

OUTPUT: Valid JSON only.
SCHEMA: { isValid, documentTypeConfirmed, issues[], validityCheck{}, checklistAction }
    `
  }
}
```

---

## 8. Optimization Techniques

### 8.1 Pre-Built Index (Zero Token, Zero Time)

```javascript
// CompanyIndex.js
// Built once on startup from Google Sheets data
// All lookups are O(1) set operations

export class CompanyIndex {
  static #instance = null
  static getInstance() {
    if (!this.#instance) this.#instance = new CompanyIndex()
    return this.#instance
  }

  #byCourse    = {}       // course  → Set of IDs
  #bySetup     = {}       // setup   → Set of IDs
  #byCity      = {}       // city    → Set of IDs
  #activeNow   = new Set()
  #byId        = new Map()

  async init(sheetData) {
    for (const company of sheetData) {
      this.#byId.set(company.id, company)
      if (company.hasActiveInterns) this.#activeNow.add(company.id)
      this.#addToIndex(this.#bySetup,   company.setup,   company.id)
      this.#addToIndex(this.#byCity,    company.city,    company.id)
      for (const course of (company.acceptedCourses ?? ['ALL'])) {
        this.#addToIndex(this.#byCourse, course, company.id)
      }
    }
  }

  // Set intersection — microseconds, zero tokens
  getForStudent(course, setup, city) {
    const byCourse = this.#byCourse[course]  ?? this.#byCourse['ALL'] ?? new Set()
    const bySetup  = this.#bySetup[setup]    ?? new Set([...this.#byId.keys()])
    const byCity   = this.#byCity[city]      ?? new Set([...this.#byId.keys()])

    return [...byCourse]
      .filter(id => bySetup.has(id) && byCity.has(id))
      .map(id => this.#byId.get(id))
  }

  #addToIndex(index, key, id) {
    if (!key) return
    if (!index[key]) index[key] = new Set()
    index[key].add(id)
  }
}
```

### 8.2 Vector Similarity Search

```javascript
// VectorSearch.js — replaces GPT scoring for initial ranking
// Embedding cost: ~$0.02 for all 1000 companies (one time)

import { openai } from '../config/openai.js'
import { cosineSimilarity } from '../utils/math.js'

export class VectorSearch {
  #companyVectors = new Map()   // cached company embeddings

  // Run once, cache forever
  async buildCompanyVectors(companies) {
    const texts = companies.map(c =>
      `${c.name} ${c.industry} ${c.internTasks} ${c.techStack?.join(' ')}`
    )

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',  // cheapest, fastest
      input: texts
    })

    response.data.forEach((embedding, i) => {
      this.#companyVectors.set(companies[i].id, embedding.embedding)
    })
  }

  // One embedding per student query, then math (free)
  async findTopMatches(studentProfile, topN = 30) {
    const studentText = `
      ${studentProfile.course}
      ${studentProfile.skills.map(s => s.skill).join(' ')}
      ${studentProfile.preferences.targetIndustry.join(' ')}
      ${studentProfile.preferences.learningGoal}
    `

    const studentEmbedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: studentText
    })

    const studentVector = studentEmbedding.data[0].embedding

    const similarities = [...this.#companyVectors.entries()]
      .map(([id, vector]) => ({
        id,
        similarity: cosineSimilarity(studentVector, vector)
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topN)

    return similarities
  }
}

// utils/math.js
export function cosineSimilarity(vecA, vecB) {
  const dot    = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
  const magA   = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
  const magB   = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
  return dot / (magA * magB)
}
```

### 8.3 Tiered Cache Manager

```javascript
// CacheManager.js — unified interface over all cache tiers

export class CacheManager {
  static #instance = null
  static getInstance() {
    if (!this.#instance) this.#instance = new CacheManager()
    return this.#instance
  }

  #memory  = new MemoryCache()   // Tier 1: RAM
  #sheets  = new SheetsCache()   // Tier 2: Google Sheets
  #session = new SessionCache()  // Tier 3: Per-student

  // Read: memory → sheets → miss
  async get(key) {
    return (
      await this.#memory.get(key)  ??
      await this.#sheets.get(key)  ??
      null
    )
  }

  // Write: always to sheets, promote to memory
  async set(key, value, ttlDays = 30) {
    await this.#sheets.set(key, value, ttlDays)
    await this.#memory.set(key, value, ttlDays)
  }

  async invalidate(key) {
    await Promise.all([
      this.#memory.invalidate(key),
      this.#sheets.invalidate(key)
    ])
  }
}
```

### 8.4 Pipeline Logger

```javascript
// PipelineLogger.js — observability for every run
// Used as the "43 tests equivalent" — shows engineering rigor

export class PipelineLogger {
  #runId
  #phases = {}
  #tokenUsage = { total: 0, byPhase: {} }
  #startTime

  constructor(runId) {
    this.#runId = runId
    this.#startTime = Date.now()
  }

  startPhase(name) {
    this.#phases[name] = { startTime: Date.now() }
  }

  endPhase(name, { input, output, tokens = 0 }) {
    const duration = Date.now() - this.#phases[name].startTime
    this.#phases[name] = { input, output, tokens, duration }
    this.#tokenUsage.total += tokens
    this.#tokenUsage.byPhase[name] = tokens
  }

  getSummary() {
    return {
      runId:       this.#runId,
      totalTime:   Date.now() - this.#startTime,
      tokenUsage:  this.#tokenUsage,
      phases:      this.#phases,
      estimatedCost: (this.#tokenUsage.total / 1000000 * 5).toFixed(4) // $5/1M
    }
  }
}
```

---

## 9. Error Handling Strategy

```javascript
// errors/OJTScoutError.js — typed errors, not raw throws

export class OJTScoutError extends Error {
  constructor(code, message, context = {}) {
    super(message)
    this.code    = code
    this.context = context
  }
}

export class ProfileIncompleteError extends OJTScoutError {
  constructor(missingFields) {
    super('PROFILE_INCOMPLETE',
      'Resume could not be fully parsed.',
      { missingFields, suggestion: 'Add a skills section and work experience.' }
    )
  }
}

export class NoMatchesError extends OJTScoutError {
  constructor(filterStats) {
    super('NO_MATCHES',
      'No companies matched your current filters.',
      { filterStats, suggestion: 'Try relaxing your allowance floor or location.' }
    )
  }
}

export class EnrichmentFailedError extends OJTScoutError {
  constructor(companyId) {
    super('ENRICHMENT_FAILED',
      'Company data could not be retrieved.',
      { companyId, fallback: 'Using FEU records only. Confidence: LOW.' }
    )
  }
}

// Wrap every API call — never let raw OpenAI errors reach the UI
export async function safeAPICall(fn, fallback = null) {
  try {
    return await fn()
  } catch (err) {
    if (err.status === 429) {
      await sleep(2000)       // rate limit — wait and retry once
      return await fn()
    }
    if (err.status === 503) return fallback   // API down — use fallback
    throw new OJTScoutError('API_ERROR', err.message, { raw: err })
  }
}
```

---

## 10. API Layer

```javascript
// All routes follow the same pattern:
// validate → run → respond → log errors

// POST /api/pipeline/start
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { resumeFile, preferences } = req.body
    if (!resumeFile) return res.status(400).json({
      error: 'MISSING_RESUME',
      message: 'Please upload your resume to continue.'
    })

    const pipeline = Pipeline.getInstance()
    const result   = await pipeline.run(resumeFile, preferences)

    return res.status(200).json({ success: true, ...result })

  } catch (err) {
    if (err instanceof OJTScoutError) {
      return res.status(400).json({
        error:      err.code,
        message:    err.message,
        suggestion: err.context.suggestion ?? null
      })
    }
    console.error('[API] Unhandled error:', err)
    return res.status(500).json({
      error:   'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.'
    })
  }
}
```

---

## 11. Frontend Architecture

```
PAGES:
  /                → Landing + resume upload
  /profile         → Student profile review + preferences
  /matches         → Ranked company list + filter sliders
  /company/:id     → Company detail + Intel Brief
  /apply/:id       → Why gate + document factory
  /dashboard       → Master checklist + phase tracker
  /documents/:id   → Generated documents viewer

COMPONENTS:
  <ResumeUploader />         Phase 1 entry point
  <ProfileCard />            Extracted profile display
  <PreferenceSliders />      Weight adjustment — triggers live rerank
  <CompanyRankList />        Ranked results with bilateral scores
  <CompanyScoreCard />       Detailed bilateral breakdown
  <GateModal />              Why This Company? gate
  <DocumentPackage />        All 4 documents per company
  <ChecklistDashboard />     Master phase tracker
  <ChecklistItem />          Individual item with upload/action
  <PipelineLog />            Token usage + timing (dev mode)

STATE:
  Zustand store — one store, modular slices
  studentSlice    → profile, preferences, session
  companiesSlice  → index, scores, enriched data
  checklistSlice  → items, statuses, uploads
  uiSlice         → loading states, active phase
```

---

## 12. ML Layer

### 12.1 Local Skill Extractor (Zero API Cost)

```javascript
// SkillExtractor.js
// Pre-trained HuggingFace model — runs locally, zero tokens

import { pipeline } from '@xenova/transformers'

export class SkillExtractor {
  static #instance = null
  #extractor = null

  static async getInstance() {
    if (!this.#instance) {
      this.#instance = new SkillExtractor()
      await this.#instance.#load()
    }
    return this.#instance
  }

  async #load() {
    // Pre-trained on job postings and resumes
    this.#extractor = await pipeline(
      'token-classification',
      'jjzha/jobbert-skill-extraction'
    )
  }

  async extract(resumeText) {
    const raw = await this.#extractor(resumeText)
    return this.#normalize(raw)
  }

  #normalize(raw) {
    // Group tokens into skill phrases, deduplicate
    return raw
      .filter(t => t.score > 0.7)
      .map(t => ({ skill: t.word, confidence: t.score }))
  }
}
```

### 12.2 Acceptance Likelihood Classifier

```javascript
// AcceptanceClassifier.js
// Simple logistic regression — trained on synthetic FEU OJT data

export class AcceptanceClassifier {
  #model = null

  async train(trainingData) {
    // Features: skills coverage, gpa band, competition level,
    //           application timing, profile completeness
    // Label:    accepted (1) / rejected (0)
    // Use: brain.js for lightweight in-browser ML
    const brain = await import('brain.js')
    this.#model = new brain.NeuralNetwork()
    this.#model.train(trainingData)
  }

  predict(features) {
    const result = this.#model.run(features)
    return {
      probability: Math.round(result[0] * 100),
      tier: result[0] > 0.7 ? 'HIGH' :
            result[0] > 0.4 ? 'MEDIUM' : 'LOW'
    }
  }
}
```

---

## 13. Environment & Configuration

```bash
# .env.example — all required keys

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_ORG_ID=org-...

# Google Sheets (FEU IALAP database)
GOOGLE_SHEETS_ID=your_sheet_id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your_service_account@project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"

# App config
NEXT_PUBLIC_APP_URL=http://localhost:3000
ENRICHMENT_CACHE_TTL_DAYS=30
MAX_CONCURRENT_ENRICHMENTS=5
VECTOR_TOP_N=30

# Rate limiting
OPENAI_REQUESTS_PER_MINUTE=60
```

---

## Token Budget Reference

| Phase | Operation | Tokens | Time |
|---|---|---|---|
| 1 | Resume parse (GPT-4o) | ~2,000 | 3s |
| 1 | Skill extraction (local NER) | 0 | <1s |
| 2 | Pre-screen filter (pure logic) | 0 | <1ms |
| 3 | Batch relevance (1 call, 150 companies) | ~4,000 | 5s |
| 3 | Vector similarity (embedding) | ~500 | 1s |
| 4 | Enrichment — full (top 10 × 3 searches) | ~45,000 | 25s |
| 4 | Enrichment — standard (next 10 × 1 search) | ~12,000 | 8s |
| 5 | Bilateral scoring (top 15) | ~15,000 | 8s |
| 6 | Document factory (3 companies) | ~12,000 | 10s |
| 7 | Checklist generation | ~1,000 | 2s |
| | **TOTAL (first run)** | **~91,500** | **~63s** |
| | **TOTAL (cached run)** | **~15,000** | **~15s** |
| | **Estimated cost per student** | **~$0.28** | |

---

*OJT Scout — AI Campus Launch Hackathon 2026*  
*Built with: Next.js · OpenAI API · Google Sheets · brain.js · @xenova/transformers*
