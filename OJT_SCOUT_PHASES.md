# OJT Scout — Pipeline Phases
> Detailed implementation reference for all 7 phases  
> Each phase is an independent module with defined inputs, outputs, token cost, and failure behavior

---

## Table of Contents

1. [Phase Overview](#phase-overview)
2. [Phase 1 — Intake & Profile Build](#phase-1--intake--profile-build)
3. [Phase 2 — Pre-Screen Filter](#phase-2--pre-screen-filter)
4. [Phase 3 — Smart Relevance Check](#phase-3--smart-relevance-check)
5. [Phase 4 — Data Enrichment](#phase-4--data-enrichment)
6. [Phase 5 — Scoring & Ranking](#phase-5--scoring--ranking)
7. [Phase 6 — Document Factory](#phase-6--document-factory)
8. [Phase 7 — Checklist, Tracking & Follow-up](#phase-7--checklist-tracking--follow-up)
9. [Inter-Phase Data Flow](#inter-phase-data-flow)
10. [Failure & Fallback Map](#failure--fallback-map)

---

## Phase Overview

```
INPUT                   PHASE                        OUTPUT             TOKENS    TIME
─────────────────────────────────────────────────────────────────────────────────────────
Resume file (PDF)  →  1. Intake & Profile Build  →  StudentProfile      ~2,000    ~4s
                   →  2. Pre-Screen Filter        →  ~150 companies          0    <1ms
                   →  3. Smart Relevance Check    →  ~40 companies       ~4,500    ~6s
                   →  4. Data Enrichment          →  Enriched profiles  ~57,000   ~33s
                   →  5. Scoring & Ranking        →  Ranked top 15      ~15,000    ~8s
Student picks  →      6. Document Factory         →  Full doc package   ~12,000   ~10s
               →      7. Checklist & Tracking     →  Living dashboard    ~1,000    ~2s
─────────────────────────────────────────────────────────────────────────────────────────
                                                     TOTAL FIRST RUN    ~91,500   ~63s
                                                     TOTAL CACHED RUN   ~15,000   ~15s
                                                     COST PER STUDENT     ~$0.28
```

---

## Phase 1 — Intake & Profile Build

### Purpose
Convert a raw resume file into a structured, verified student profile that all downstream phases can reliably consume.

### Tools Used
- `GPT-4o` — resume parsing and profile structuring
- `@xenova/transformers` (local NER) — initial skill extraction, zero API cost
- `File Search` — reads uploaded PDF or DOCX

### Input
```
resumeFile:    PDF or DOCX uploaded by student
rawPreferences: {
  minAllowance:  number | null
  setup:         'onsite' | 'hybrid' | 'remote' | 'any'
  maxDistanceKm: number | null
  homeLocation:  string | null
  targetIndustry: string[]
  learningGoal:  string
}
```

### Process

```
STEP 1 — Local NER Skill Extraction (free)
  → SkillExtractor reads raw resume text
  → Identifies skill tokens using pre-trained model
  → Output: candidate skills list with confidence scores
  → Cost: 0 tokens, <1 second

STEP 2 — GPT-4o Full Parse (PROMPTS.RESUME_PARSER)
  → Reads full resume via File Search
  → Extracts: name, course, year level, GPA,
    skills with evidence, experience, certifications
  → Validates NER results against full context
  → Flags missing critical sections
  → Cost: ~2,000 tokens

STEP 3 — Proficiency Honesty Check
  → For each extracted skill, agent asks:
    "Give me one specific example of when you used this."
  → If student cannot provide: skill downgraded to beginner
    or removed if no context at all
  → Prevents inflated profiles that collapse in interviews
  → Runs conversationally — not a separate API call

STEP 4 — Preference Completion
  → Agent asks 5 follow-up questions:
    1. Preferred industry?
    2. Work setup preference?
    3. Location constraint?
    4. Minimum allowance?
    5. What do you most want to learn?
  → Preference weights initialized to defaults
  → Student can adjust weights in Phase 5 UI

STEP 5 — Profile Completeness Scoring
  → HIGH:   all critical fields present, skills verified
  → MEDIUM: minor gaps, GPA missing, few skills
  → LOW:    significant gaps, will affect match quality
  → LOW triggers a warning UI before continuing
```

### Output
```javascript
StudentProfile = {
  id:            uuid,
  name:          string,
  course:        string,
  yearLevel:     '4th',       // OJT is 4th year only
  campus:        string,
  gpa:           number | null,
  skills: [{
    skill:       string,
    level:       'beginner' | 'intermediate' | 'advanced',
    evidence:    string,      // required by honesty check
    verified:    boolean
  }],
  experience: [{
    type:        'internship' | 'org' | 'project' | 'freelance',
    title:       string,
    organization:string,
    duration:    string | null,
    description: string
  }],
  certifications:  string[],
  preferences:     PreferenceProfile,
  profileCompleteness: 'HIGH' | 'MEDIUM' | 'LOW',
  missingCritical: string[],
  createdAt:       ISO string
}
```

### Token Cost
| Operation | Tokens |
|---|---|
| Local NER extraction | 0 |
| GPT-4o resume parse | ~2,000 |
| **Phase 1 Total** | **~2,000** |

### Failure Behavior
```
Resume unreadable     → Ask student to re-upload a text-based PDF
No skills detected    → Prompt student to add skills manually
Course not recognized → Ask student to confirm their course name
API unavailable       → Cache raw text, retry on reconnect
```

### Optimization Notes
- Local NER runs before GPT call — pre-populates the skills list
- GPT validates and enriches NER output rather than starting from scratch
- Profile JSON cached in session — never re-parsed on subsequent visits
- Resume file discarded after parsing — only structured profile retained

---

## Phase 2 — Pre-Screen Filter

### Purpose
Eliminate irrelevant companies using pure rule-based logic before spending a single token. This is the most impactful cost optimization in the system.

### Tools Used
- **None** — zero AI involvement
- Pre-built `CompanyIndex` (in-memory, built on startup)
- `FilterPipeline` — runs all filters in sequence

### Input
```
companies:  all ~1,000 companies from CompanyIndex
criteria:   student preferences + hard limits from Phase 1
```

### Filters Applied (in order)

```
FILTER 1 — Year Level
  Rule:    Student must be 4th year
  Action:  Eliminates non-4th-year OJT tracks
  Cost:    0 tokens

FILTER 2 — MOA Status
  Rule:    company.moaStatus must be 'Active'
  Action:  Eliminates expired or inactive partners
  Cost:    0 tokens

FILTER 3 — Slot Availability
  Rule:    company.availableSlots > 0
  Action:  Eliminates full companies
  Variant: companies with slots === 0 flagged as
           WAITLIST if student opts in
  Cost:    0 tokens

FILTER 4 — Course Exclusivity
  Rule:    IF company.acceptedCourses is non-empty,
           student.course MUST be in the list
  Action:  Eliminates nursing-only, psych-only,
           accounting-only companies for CS/IT students
  Cost:    0 tokens

FILTER 5 — Allowance Floor
  Rule:    IF student.minAllowance is set,
           company.allowance >= minAllowance
  Note:    Only applies if company allowance is
           known — unknown allowance passes filter
           (gets checked in enrichment)
  Cost:    0 tokens

FILTER 6 — Setup Preference
  Rule:    IF student.setup is 'remote',
           company.setup must be 'remote' or 'hybrid'
           IF student.setup is 'onsite',
           company.setup must be 'onsite' or 'hybrid'
           IF student.setup is 'any', all pass
  Cost:    0 tokens

FILTER 7 — Active Intern Presence
  Rule:    Prioritize companies with hasActiveInterns = true
  Action:  Not an elimination — applies +10 score bonus
           in Phase 5. Signals company actively accepts FEU.
  Cost:    0 tokens
```

### Output
```
Before: ~1,000 companies
After:  ~150 companies (estimated)
Tokens: 0
Time:   < 1 millisecond
```

### Filter Pipeline Implementation
```javascript
// Each filter is independent and composable
// Adding a new rule = adding a new class, nothing else changes

class FilterPipeline {
  #filters = [
    new YearLevelFilter(),
    new MOAStatusFilter(),
    new SlotAvailabilityFilter(),
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

### Logging Output (shown in PipelineLogger)
```
[Year Level]         1000 → 1000 (-0)    // already scoped to 4th yr
[MOA Status]         1000 →  920 (-80)   // inactive partners removed
[Slot Availability]   920 →  840 (-80)   // full companies removed
[Course Exclusivity]  840 →  600 (-240)  // nursing/psych/accounting removed
[Allowance Floor]     600 →  380 (-220)  // below student minimum removed
[Setup Preference]    380 →  150 (-230)  // onsite-only if student wants remote
─────────────────────────────────────────
PHASE 2 RESULT:  150 companies | 0 tokens | <1ms
```

### Failure Behavior
```
All companies eliminated → Trigger NoMatchHandler Level 1
                           (relax filters one at a time,
                            show student what opens up)
Index not built yet      → Build index synchronously,
                           log warning about cold start
```

### Optimization Notes
- `CompanyIndex` built once on app startup using `Set` data structures
- Filter checks are `Set.has()` operations — O(1) per company
- Filter order matters: cheapest checks first (MOA, slots)
  to eliminate maximum companies with minimum comparisons
- `CourseExclusivityFilter` alone eliminates ~30% of companies
  for CS/IT students (nursing, psych, accounting, allied health)

---

## Phase 3 — Smart Relevance Check

### Purpose
Use a single batch GPT call to classify course-company relevance for all remaining companies. Catches non-obvious matches and eliminations that rule-based logic can't handle.

### Tools Used
- `GPT-4o` — batch relevance classification
- `text-embedding-3-small` — vector similarity search
- `BatchRelevancePrompt` (temperature: 0)

### Input
```
companies:  ~150 companies from Phase 2
course:     student.course from Phase 1 profile
```

### Process

```
STEP 1 — Batch GPT Classification (1 call for all 150)
  → All companies sent in a single prompt as JSON array
  → GPT classifies each as:
    direct      core industry aligns with course
    adjacent    different industry, relevant department
    stretch     tenuous connection, needs specific reason
    irrelevant  no plausible connection

  CLASSIFICATION EXAMPLES (CS/IT student):
  direct:     software companies, tech startups,
              IT services, cybersecurity, game dev
  adjacent:   banks with IT dept, telecoms,
              BPOs with dev tracks, e-commerce
  stretch:    media (only if digital arm exists),
              manufacturing (only if IT systems)
  irrelevant: pure accounting, nursing/medical,
              psych practices, physical therapy

  → Cost: ~4,000 tokens (all 150 in one call)

STEP 2 — Vector Similarity Search
  → Student profile embedded: ~500 tokens
  → Compared against pre-computed company vectors
  → Pre-computation cost: ~$0.02 one-time (all 1000 companies)
  → Per-student cost: 1 embedding call only
  → Returns similarity score per company (0.0 - 1.0)
  → Combined with GPT classification for final shortlist

STEP 3 — Merge and Shortlist
  → Eliminate: irrelevant from GPT classification
  → Retain:    direct + adjacent (always)
  → Retain:    stretch ONLY if vector score > 0.6
  → Sort by:   vector similarity score
  → Output:    top ~40 companies
```

### Output
```
Before: ~150 companies
After:  ~40 companies
Per company:
  {
    id:        string,
    relevant:  boolean,
    matchType: 'direct' | 'adjacent' | 'stretch' | 'irrelevant',
    confidence:'HIGH' | 'MEDIUM' | 'LOW',
    reason:    string,       // specific, not generic
    vectorScore: number      // 0.0 - 1.0
  }
```

### Token Cost
| Operation | Tokens |
|---|---|
| Batch relevance classification | ~4,000 |
| Student profile embedding | ~500 |
| Company vector pre-computation (one-time) | ~$0.02 total |
| **Phase 3 Total per student** | **~4,500** |

### Failure Behavior
```
Batch call fails       → Fall back to vector-only ranking
                         Log warning: "Relevance check degraded"
All classified irrelevant → Trigger NoMatchHandler Level 1
Malformed JSON response → Retry once, then fall back to vectors
```

### Optimization Notes
- Single batch call replaces 150 individual calls
  → saves ~60,000 tokens vs naive approach
- Company vectors computed once and cached in memory
  → zero cost per additional student
- Stretch matches require vector score > 0.6 to avoid
  including companies with no real fit

---

## Phase 4 — Data Enrichment

### Purpose
Fill missing company data fields using GPT + web search for the shortlisted companies only. Self-enriching database: results cached to Google Sheets for 30 days.

### Tools Used
- `GPT-4o` with Web Search Tool — research each company online
- `EnrichmentPrompt` (temperature: 0)
- `CacheManager` — check before searching, write after
- `pLimit(5)` — parallel async with rate limiting

### Input
```
companies:  ~40 shortlisted companies from Phase 3
            with vectorScore for depth assignment
```

### Process

```
STEP 1 — Known Companies Fast Path
  → Check against KNOWN_COMPANIES constant
  → Top 20 most common FEU partners pre-enriched manually
  → If found: serve immediately, skip all API calls
  → Cost: 0 tokens per known company

STEP 2 — Cache Check
  → Query CacheManager for each remaining company
  → Cache hit (enriched within 30 days): serve from cache
  → Cache miss: proceed to enrichment
  → Cost: 0 tokens per cache hit

STEP 3 — Tiered Enrichment Depth Assignment
  → Based on vector similarity score from Phase 3:
    FULL     (score > 0.75): 3 searches per company
             allowance + reviews + tech stack + culture
    STANDARD (score > 0.50): 2 searches per company
             allowance + reviews only
    MINIMAL  (score > 0.30): 1 search per company
             basic company overview only
    SKIP     (score ≤ 0.30): no search
             display FEU sheet data only

STEP 4 — Parallel Async Enrichment
  → pLimit(5): max 5 concurrent API calls
  → Respects OpenAI rate limits
  → Each company gets search cascade:
    Priority 1: JobStreet Philippines
    Priority 2: Glassdoor Philippines
    Priority 3: Indeed Philippines
    Priority 4: LinkedIn company page
    Priority 5: Google search fallback
  → Stop cascade when HIGH confidence data found

STEP 5 — Confidence Scoring
  → HIGH:   data found on 2+ independent sources
  → MEDIUM: data found on 1 recent source
  → LOW:    data found on 1 old source or inferred
  → NONE:   not found — return null, never fabricate

STEP 6 — Wisdom Vault Layer
  → Check WisdomVault for past FEU intern reviews
  → Vault data overrides web data (higher trust)
  → Attached to company enriched profile

STEP 7 — Write Back to Cache
  → Enriched data written to Google Sheets
  → Timestamp stored for TTL checking
  → In-memory cache also updated
  → Next student querying same company gets cache hit
```

### Output
```javascript
// Per company
EnrichedCompanyData = {
  allowance: {
    value:      '₱700-900/day' | null,
    type:       'daily' | 'monthly' | null,
    source:     'URL' | null,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  },
  workSetup: {
    type:       'onsite' | 'hybrid' | 'remote' | null,
    details:    '3 days onsite, 2 WFH' | null,
    source:     'URL' | null,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  },
  internTasks: {
    summary:    string | null,
    tasks:      string[],
    source:     'URL' | null,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  },
  techStack: {
    tools:      string[],
    languages:  string[],
    source:     'URL' | null,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  },
  workCulture: {
    summary:    string | null,
    pace:       'fast-paced' | 'moderate' | 'relaxed' | null,
    supervision:'close' | 'moderate' | 'independent' | null,
    source:     'URL' | null,
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  },
  reviewSummary: {
    sentiment:   'positive' | 'mixed' | 'negative' | null,
    avgRating:   number | null,
    reviewCount: number | null,
    topPositives:string[],
    topConcerns: string[],
    source:      'URL' | null,
    confidence:  'HIGH' | 'MEDIUM' | 'LOW' | 'NONE'
  },
  wisdomVault: WisdomVaultEntry[],
  enrichedAt:  ISO string,
  enrichmentStatus: 'complete' | 'partial' | 'minimal' | 'cached'
}
```

### Token Cost
| Operation | Tokens | Note |
|---|---|---|
| Known companies (top 20) | 0 | Pre-loaded |
| Cache hits | 0 | Already enriched |
| FULL enrichment × 10 | ~30,000 | Top matches |
| STANDARD enrichment × 10 | ~15,000 | Mid matches |
| MINIMAL enrichment × 10 | ~8,000 | Lower matches |
| SKIP × 10 | 0 | FEU data only |
| **Phase 4 Total** | **~53,000** | |
| **Phase 4 Cached run** | **~5,000** | 2nd+ student |

### Failure Behavior
```
Search blocked/CAPTCHA  → Try next source in cascade
                          Log: 'Source blocked, falling back'
All sources fail        → Return null fields, NONE confidence
                          Flag: 'Limited data — FEU records only'
Rate limit hit          → Wait 2s, retry once, then skip
Cache write fails       → Log warning, continue without caching
                          Data served from memory for this session
```

### Optimization Notes
- Parallel execution cuts 40 sequential enrichments
  from ~2 minutes to ~30 seconds
- Tiered depth means top candidates get rich data,
  bottom candidates get minimal data — matches actual need
- 30-day cache means second student costs ~90% less
- Pre-enriched KNOWN_COMPANIES constant covers
  the most common FEU partners at zero runtime cost

---

## Phase 5 — Scoring & Ranking

### Purpose
Score all enriched companies using bilateral matching — both what the student wants and what the company expects. Produces a ranked list with honest explanations.

### Tools Used
- `BilateralScorer` — pure logic, no API calls
- `LearnabilityScorer` — uses SKILL_ADJACENCY constant
- `AcceptanceClassifier` — lightweight ML model
- `FitScorerPrompt` (temperature: 0) — generates explanations only

### Input
```
student:    StudentProfile from Phase 1
companies:  enriched company data from Phase 4
preferences:student weight settings
```

### Process

```
STEP 1 — Student-Side Scoring (what student wants)
  For each company, score 6 dimensions:

  Skills Match (default weight: 20%)
    → What % of company's typical skills student has
    → Weighted by skill criticality
    → Depth modifier: beginner=0.4, intermediate=0.75, advanced=1.0

  Allowance Fit (default weight: 15%)
    → Company allowance vs student minimum
    → 100 if above minimum, scales down proportionally
    → 0 if below hard minimum

  Location Fit (default weight: 15%)
    → Estimated commute based on city + setup type
    → Remote = 100 regardless of location
    → Hybrid = distance score × 0.6 (fewer days commuting)
    → Onsite = full distance penalty

  Learning Quality (default weight: 15%)
    → Richness of intern tasks from enrichment
    → Real project work vs admin/support tasks
    → Supervision quality from reviews
    → Confidence modifier applied if LOW data

  Brand Value (default weight: 10%)
    → Company recognition + resume impact
    → Industry standing + size signal

  Work-Life Balance (default weight: 10%)
    → Reported overtime culture
    → Flexibility signals from reviews
    → Confidence modifier if LOW data

STEP 2 — Company-Side Scoring (what company wants)
  Skills Readiness (weight: 25%)
    → Current skills vs company requirements
    → How ready is the student to contribute Day 1

  Learnability of Gaps (weight: 20%)
    → Missing skills classified via SKILL_ADJACENCY:
      BRIDGEABLE  → skill adjacent to known skill → low penalty (5pts)
      MANAGEABLE  → some transfer possible        → medium penalty (15pts)
      BLOCKING    → no connection, fundamental gap → high penalty (35pts)

  Academic Signal (weight: 15%)
    → GPA band scoring
    → Year level appropriateness
    → Relevant units completed
    → Portfolio / project evidence

  Profile Presentation (weight: 15%)
    → Resume completeness and clarity
    → Application package readiness
    → OJT Scout-generated docs improve this score

  Availability & Logistics (weight: 10%)
    → OJT period timing match
    → Duration alignment with company program
    → Full-time vs part-time compatibility

  Growth Trajectory (weight: 10%)
    → Rate of skill acquisition
    → Direction of learning vs company domain
    → Company risk tolerance (startup vs corp)
    → Cultural fit proxy via work style signals

STEP 3 — Bilateral Composite
  studentFit       = weighted average of student-side scores
  companyAttraction = weighted average of company-side scores
  bilateral        = (studentFit × 0.5) + (companyAttraction × 0.5)

  Tier classification:
  IDEAL   → studentFit ≥ 75 AND companyAttraction ≥ 75
  GOOD    → studentFit ≥ 75 AND companyAttraction ≥ 50
  REACH   → studentFit ≥ 50 AND companyAttraction ≥ 75
  NEUTRAL → both ≥ 50
  SKIP    → either < 50

STEP 4 — ML Acceptance Likelihood
  → AcceptanceClassifier predicts acceptance probability
  → Features: skills coverage, GPA band, competition level,
    application timing, profile completeness score
  → Output: probability (0-100%) + tier (HIGH/MEDIUM/LOW)

STEP 5 — Explanation Generation
  → GPT-4o generates human-readable headline per company
  → Only called for top 15 — not all 40
  → Anti-sycophancy rules enforced:
    always name top_concern, never inflate above 85
    unless all dimensions > 75

STEP 6 — Live Re-ranking (zero tokens)
  → When student adjusts weight sliders in UI:
    Re-compute weighted averages using cached dimension scores
    Re-sort ranked list
  → No API call needed — pure math on cached scores
  → Instant response in UI
```

### Output
```javascript
// Ranked array, top 15
RankedMatch = {
  companyId:     string,
  company:       CompanyRecord,

  studentSide: {
    skillsMatch:     { score, weighted, reason },
    allowanceFit:    { score, weighted, reason },
    locationFit:     { score, weighted, reason },
    learningQuality: { score, weighted, reason, confidence },
    brandValue:      { score, weighted, reason },
    workLifeBalance: { score, weighted, reason, confidence },
    subtotal:        number
  },

  companySide: {
    skillsReadiness:    { score, reason },
    learnability: {
      score,
      gaps: [{ skill, type, penalty, bridgePath }],
      reason
    },
    academicSignal:     { score, reason },
    profilePresentation:{ score, reason },
    availability:       { score, reason },
    growthTrajectory:   { score, reason },
    subtotal:           number
  },

  bilateral:      number,
  tier:           'IDEAL' | 'GOOD' | 'REACH' | 'NEUTRAL' | 'SKIP',
  recommendation: 'apply_now' | 'apply_with_preparation' |
                  'stretch_goal' | 'skip',
  headline:       string,       // one honest sentence
  topStrength:    string,
  topConcern:     string,       // always required
  acceptanceOdds: number | null // from ML classifier
}
```

### Token Cost
| Operation | Tokens |
|---|---|
| Bilateral scoring logic | 0 (pure math) |
| Explanation generation (top 15) | ~15,000 |
| **Phase 5 Total** | **~15,000** |
| **Re-ranking (weight sliders)** | **0** |

### Failure Behavior
```
ML classifier unavailable  → Skip acceptance odds,
                              show N/A in UI
GPT explanation fails      → Use template explanation
                              built from dimension scores
All companies score SKIP   → Trigger NoMatchHandler Level 2
                              (show reach goals with roadmap)
Weight sum ≠ 1.0           → Auto-normalize before scoring,
                              notify student of adjustment
```

### Optimization Notes
- Scoring logic is pure computation — no API calls
- GPT only called for explanations on top 15, not all 40
- Re-ranking on slider change costs zero tokens
- Dimension scores cached per student-company pair
- SKILL_ADJACENCY lookup is O(1) per gap check

---

## Phase 6 — Document Factory

### Purpose
Generate a complete, personalized application package for each company the student selects. Gated by the "Why This Company?" check to ensure authentic documents.

### Tools Used
- `GateEvaluatorPrompt` (temperature: 0.3) — evaluates student's reasons
- `DocumentFactoryPrompt` (temperature: 0.7) — generates all documents
- `DocumentValidatorPrompt` (temperature: 0) — validates uploads

### Input
```
student:      StudentProfile from Phase 1
selectedCompany: CompanyRecord + enriched data from Phase 4
scoreData:    BilateralScore from Phase 5
```

### Process

```
STEP 1 — "Why This Company?" Gate
  Student answers 3 required questions:
    Q1: Why this specific company and not others?
    Q2: What do you most want to learn or experience here?
    Q3: How does this internship connect to your career goal?

  GateEvaluatorPrompt evaluates each answer:
    PASS criteria (ALL must be true):
      → why mentions something specific about THIS company
      → what_to_learn names a concrete skill or experience
      → career_connection shows logical link to career goal

    FAIL criteria (ANY causes failure):
      → "good company" / "famous" without specifics
      → "to gain experience" without specifying what kind
      → career connection absent or circular
      → "it's near my house" as the only reason

  On FAIL → agent returns specific pushback question
             student answers again, gate re-evaluates
             documents NOT generated until PASS

  On PASS → gate answers become cover letter seeds

STEP 2 — Multi-Output Document Generation
  All 5 documents generated in ONE API call:

  Document 1 — Tailored Resume Highlights
    → Skills reordered by company industry relevance
    → skills_to_emphasize vs skills_to_downplay
    → Honest proficiency levels (no inflation)
    → Suggested objective statement for this company

  Document 2 — Cover Letter
    → 3-4 paragraphs, authentic Filipino student voice
    → Built from gate answer seeds
    → Specific company references from Intel Brief
    → Reads like the student wrote it, not ChatGPT

  Document 3 — Endorsement Letter Request
    → Formal FEU-standard format
    → Pre-filled: student name, course, company name,
      contact person, required hours, OJT period
    → Addressed to OJT Coordinator
    → Ready to print and sign

  Document 4 — Application Email
    → Professional, concise
    → Subject line included
    → Lists correct attachments
    → Clear call to action
    → Company-appropriate tone

  Document 5 — Skills Alignment Brief (internal)
    → Student's eyes only — not submitted
    → Maps student skills to company expectations
    → Gaps with talking points for interviews
    → Interview prep tips specific to this company

STEP 3 — Document Review & Approval
  → Student reviews all documents in UI
  → Can request specific edits (agent revises)
  → Approves each document individually
  → Approved documents locked into submission package

STEP 4 — Checklist Auto-Population
  → Generated documents marked ✅ in checklist
  → Remaining upload requirements listed
  → Dynamic checklist built based on:
    company-specific requirements
    FEU standard OJT requirements
    student's current document status
```

### Generated Checklist Per Company
```
OJT APPLICATION CHECKLIST — [Company Name]
═══════════════════════════════════════════
GENERATED BY OJT SCOUT ✅
  ✅ Resume (tailored to this company)
  ✅ Cover Letter
  ✅ Endorsement Letter Request
  ✅ Application Email (ready to send)

NEEDS YOUR UPLOAD 📎
  ⬜ Valid School ID
  ⬜ Copy of Registration Form
  ⬜ Grades / Transcript (latest)
  ⬜ Medical Certificate (within 6 months)
  ⬜ PSA Birth Certificate

PENDING (after company responds) ⏳
  ⬜ MOA / Memorandum of Agreement
  ⬜ Training Plan from Company
  ⬜ Parent / Guardian Consent Form
═══════════════════════════════════════════
NEXT: Upload your School ID → [Upload]
```

### Document Upload Validation
```
On each upload, DocumentValidatorPrompt checks:
  ✓ Correct document type (school ID vs birth cert)
  ✓ All required fields present and legible
  ✓ Within validity period (medical cert < 6 months)
  ✓ Correct form version
  ✓ Image quality sufficient (not blurry, not cut off)

On FAIL → specific issue named + exact fix instruction
On PASS → checklist item turns ✅
```

### Output
```javascript
DocumentPackage = {
  companyId: string,
  gateAnswers: {
    whyThisCompany:    string,
    whatToLearn:       string,
    careerConnection:  string,
    gateDecision:      'PASS',
    coverLetterSeeds:  string[]
  },
  documents: {
    resumeHighlights:     ResumeHighlights,
    coverLetter:          { fullText, wordCount, personalizationElements },
    endorsementRequest:   { fullText, addressedTo, subjectLine },
    applicationEmail:     { subject, body, attachmentsToMention },
    skillsAlignmentBrief: { strongMatches, gapsToAddress, interviewPrepTips }
  },
  checklist:      ChecklistItem[],
  generatedAt:    ISO string,
  approvedAt:     ISO string | null
}
```

### Token Cost
| Operation | Tokens |
|---|---|
| Gate evaluation | ~1,500 |
| Multi-output document generation | ~4,000 per company |
| Document validation (per upload) | ~500 |
| **Phase 6 Total (3 companies)** | **~16,000** |

### Failure Behavior
```
Gate never passes      → After 3 attempts, offer to help
                         student articulate their reasons
                         via guided interview
Document generation    → Retry once with simplified prompt
fails                    If fails again: generate one document
                         at a time as fallback
Validation gives false → Flag for human review
positive               → Add 'verify manually' tag to checklist
```

### Optimization Notes
- All 5 documents in one API call vs 5 separate calls
  → saves ~3 API round trips + system prompt repetition
- Gate uses temperature 0.3 — evaluative not creative
- Documents use temperature 0.7 — creative but grounded
- Gate answers are reused as cover letter raw material
  → no extra call needed for letter personalization

---

## Phase 7 — Checklist, Tracking & Follow-up

### Purpose
Maintain a living dashboard that tracks every step of the OJT process automatically. Background agents handle follow-ups without student action.

### Tools Used
- `Assistants API` — persistent tracking thread
- `GPT-4o` — drafting follow-up emails
- `SlotMonitor` — background watcher (cron job)
- `ApplicationTracker` — response monitoring

### Input
```
applications:  companies student applied to + timestamps
checklist:     items from Phase 6 per company
studentId:     for persistent state
```

### Process

```
STEP 1 — Checklist Dashboard Initialization
  → Master checklist built from all company checklists
  → Phase tracker initialized (Phases 1-7)
  → Status indicators:
    ✅ complete    — item done, validated
    🔄 in progress — student working on this
    ⏳ pending     — waiting on external action
    ⚠️  urgent     — deadline approaching
    ❌ action needed — student must do something now

STEP 2 — Slot Pulse Monitor (background cron)
  → Runs every 15 minutes against IALAP sheet
  → Detects slot count changes per company
  → On new slot opening:
    Check against all active student preference profiles
    Find students this matches (from cache)
    Send real-time alert to matched students
    Alert includes: company name, match score,
    deadline if known, one-click apply button

STEP 3 — Application Health Monitor (background)
  → Tracks time since each application submitted
  → Day 5 no response:
    Draft follow-up email using GPT-4o
    Notify student: "[Company] hasn't responded.
    Here's a follow-up email — send it?"
    Student approves → sent
  → Day 10 no response:
    Escalate: "Consider this application stalled.
    Apply to your backup companies."
  → Rejection detected (student marks manually):
    Log rejection reason if provided
    Adjust acceptance odds for similar companies
    Check if pattern emerging across rejections

STEP 4 — Progress Drift Detector (background)
  → Monitors checklist item timestamps
  → If item not advanced in 3 days during critical window:
    Day 1: gentle nudge notification
    Day 2: specific action suggestion
    Day 3: pre-drafted message to whoever is blocking
            (e.g. draft email to OJT coordinator
             asking for endorsement letter status)

STEP 5 — Deadline Countdown Agent
  → Tracks all OJT-related deadlines:
    FEU submission windows
    Company application deadlines
    Document validity expiries
    MOA signing windows
  → T-7 days: reminder with full requirements list
  → T-3 days: urgent alert with checklist status
  → T-1 day:  critical alert with exact steps

STEP 6 — One-Click Submission Package
  → When all checklist items green:
    Bundle all documents consistently renamed
    Generate submission email with all attachments
    Generate OJT coordinator notification
    Student reviews one final time
    One click: send application + notify coordinator
```

### Dashboard State Machine
```
PHASE STATUS TRANSITIONS:

PROFILE       → COMPLETE when StudentProfile.completeness ≥ MEDIUM
MATCHING      → COMPLETE when Phase 5 finishes, top matches shown
APPLICATIONS  → IN_PROGRESS when at least 1 company selected
              → SUBMITTED when application package sent
DOCUMENTS     → IN_PROGRESS when checklist < 100% complete
              → COMPLETE when all items ✅
SUBMISSION    → READY when all documents complete
              → SENT when one-click submission triggered
WAITING       → ACTIVE after submission, monitor for response
ACCEPTED      → TRIGGERED when student marks acceptance
OFFICIAL OJT  → TRIGGERED when all pre-OJT requirements met
```

### Background Agent Behaviors Summary
```
SlotMonitor          → every 15 min → alerts on new slots
ApplicationTracker   → daily check  → follow-up drafts
ProgressDrift        → daily check  → nudges on stalled items
DeadlineCountdown    → daily check  → reminders at T-7, T-3, T-1
```

### Output
```javascript
DashboardState = {
  studentId:    string,
  overallPhase: '1' | '2' | '3' | '4' | '5' | '6' | '7',
  phases: {
    profile:      PhaseStatus,
    matching:     PhaseStatus,
    applications: PhaseStatus,
    documents:    PhaseStatus,
    submission:   PhaseStatus,
    waiting:      PhaseStatus,
    accepted:     PhaseStatus,
    officialOJT:  PhaseStatus
  },
  companies: {
    [companyId]: {
      checklist:   ChecklistItem[],
      status:      ApplicationStatus,
      submittedAt: ISO string | null,
      respondedAt: ISO string | null,
      outcome:     'pending' | 'accepted' | 'rejected' | 'stalled'
    }
  },
  nextAction:   { label, action, urgency },
  alerts:       Alert[],
  updatedAt:    ISO string
}
```

### Token Cost
| Operation | Tokens |
|---|---|
| Checklist generation | ~1,000 |
| Follow-up email draft | ~800 per email |
| Progress nudge message | ~300 per nudge |
| **Phase 7 Initial** | **~1,000** |
| **Per follow-up event** | **~800** |

### Failure Behavior
```
Slot monitor fails      → Log error, retry in 15 min
                          Student sees last known slot counts
Follow-up draft fails   → Use template follow-up
                          Log: 'Using template fallback'
Dashboard state corrupt → Rebuild from checklist item timestamps
                          Log warning to admin
Notification fails      → Queue for retry, show in-app banner
```

### Optimization Notes
- Background agents use lightweight GPT calls
  (small prompts, no retrieval needed)
- Follow-up emails templated at 80%,
  only personalization tokens sent to GPT
- Slot monitoring reads Sheets diff only —
  not full re-read of 1000 rows each run
- Dashboard state stored client-side (Zustand)
  with server sync only on changes

---

## Inter-Phase Data Flow

```
Phase 1 Output:  StudentProfile
      ↓
      ├── to Phase 2: preferences (for hard filters)
      ├── to Phase 3: course (for relevance check)
      │              skills (for vector embedding)
      ├── to Phase 5: full profile (for scoring)
      └── to Phase 6: full profile (for documents)

Phase 2 Output:  filtered company IDs (~150)
      ↓
      └── to Phase 3: company list for classification

Phase 3 Output:  relevant companies + vector scores (~40)
      ↓
      ├── to Phase 4: shortlist for enrichment
      └── to Phase 5: vector scores for depth assignment

Phase 4 Output:  enriched company profiles
      ↓
      ├── to Phase 5: enriched data for scoring
      └── to Phase 6: intel brief for documents

Phase 5 Output:  ranked matches with bilateral scores
      ↓
      ├── to Phase 6: score data for document context
      └── to UI:      ranked list for student selection

Phase 6 Output:  document packages per company
      ↓
      └── to Phase 7: initial checklist state

Phase 7 Output:  living dashboard + background agents
      ↓
      └── to student: persistent tracking interface
```

---

## Failure & Fallback Map

| Phase | Failure | Fallback | Severity |
|---|---|---|---|
| 1 | Resume unreadable | Manual skill entry form | Medium |
| 1 | GPT parse fails | Re-upload prompt | Medium |
| 2 | All companies eliminated | NoMatchHandler Level 1 | High |
| 2 | Index not built | Synchronous rebuild | Low |
| 3 | Batch call fails | Vector-only ranking | Medium |
| 3 | All irrelevant | NoMatchHandler Level 2 | High |
| 4 | Search blocked | Next source in cascade | Low |
| 4 | All sources fail | FEU sheet data only + LOW confidence | Medium |
| 4 | Cache write fails | In-memory for session | Low |
| 5 | ML classifier unavailable | Hide acceptance odds | Low |
| 5 | All scores SKIP | NoMatchHandler Level 2 | High |
| 6 | Gate never passes | Guided interview mode | Medium |
| 6 | Doc generation fails | One-at-a-time fallback | Medium |
| 7 | Slot monitor fails | Retry in 15 min | Low |
| 7 | Dashboard state corrupt | Rebuild from timestamps | Medium |
| Any | OpenAI API down | Serve cached data, queue requests | High |

### NoMatchHandler Cascade
```
LEVEL 1 — Relax Hard Filters
  Try each filter relaxation individually:
  → Lower allowance floor by ₱100
  → Include hybrid (if remote-only set)
  → Expand location radius by 5km
  Show student what each relaxation unlocks

LEVEL 2 — Show Reach Goals
  Companies student could qualify for with prep:
  → Name specific missing skills
  → Attach free learning resources
  → Give realistic timeline to qualify

LEVEL 3 — Alternative Pathways
  → Cold application to non-partner companies
    (agent drafts outreach email)
  → MOA request for new company
    (agent drafts formal request to OJT office)
  → Freelance / remote OJT track options

LEVEL 4 — Profile Strengthening Plan
  → Honest gap analysis
  → 6-week skill building roadmap
  → Suggest re-scanning after completion
```

---

*OJT Scout — Pipeline Phases Reference*  
*Part of: OJT_SCOUT_ARCHITECTURE.md*  
*AI Campus Launch Hackathon 2026 | FEU*
