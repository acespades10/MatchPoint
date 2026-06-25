# ROADMAP.md — OJT Scout
> Living document. Update phase status at the end of every session.
> This is the first thing to read at the start of every session after CLAUDE.md.

---

## Current Status

```
ACTIVE PHASE:  Phase 3 — Smart Relevance Check (COMPLETE) +
               demo Scoring & Ranking (COMPLETE)
LAST UPDATED:  2026-06-25
LAST SESSION:  Phases 3 + 4(scoring) built together. Phase 3 = pure keyword
               relevance (1409 → 661, 0 tokens). Demo "Phase 4" = bilateral
               BilateralScorer (6 scorers) → top 20, 0 tokens. Instant
               zero-token re-rank endpoint + UI filter controls live.
               58/58 tests pass.
NEXT ACTION:   Phase 5 — Document Factory (gate + 5-doc generation). STOP for
               review first (per session instruction).

NOTE ON NUMBERING: the demo collapses the architecture's phases. The build
prompt's "Phase 4 — Scoring" == architecture ROADMAP "Phase 5 — Scoring &
Ranking". Architecture "Phase 4 — Data Enrichment" is SKIPPED for the demo
(no GPT/web enrichment); techStack stays empty, so SkillsMatch/Learnability
score neutral and ranking is driven by location/setup/allowance/active-intern
signals. See DEV_LOG 2026-06-25 Phase 3+4 entry.
```

---

## Phase Status

| Phase | Name | Status | Branch | Notes |
|---|---|---|---|---|
| 0 | Project Scaffold | ✅ COMPLETE | `phase-0-scaffold` | Express + JSON stack; health ok |
| 1 | Intake & Profile Build | 🔄 IN PROGRESS | `phase-1-intake` | Active |
| 2 | Pre-Screen Filter | ✅ COMPLETE | `phase-2-prescreen` | 6 filters, 0 tokens, 37 tests pass |
| 3 | Smart Relevance Check | ✅ COMPLETE | `phase-3-relevance` | Keyword relevance, 0 tokens, 1409→661 |
| 4 | Data Enrichment | 🔄 SCRIPT READY | `phase-4-enrichment` | enrichTopCompanies.js created, NOT yet run (spends tokens) |
| 5 | Scoring & Ranking | ✅ COMPLETE | `phase-5-scoring` | Bilateral, 0 tokens, top 20, live re-rank |
| 6 | Document Factory | ⏳ BLOCKED | `phase-6-documents` | Needs Phase 5 |
| 7 | Checklist & Tracking | ⏳ BLOCKED | `phase-7-tracking` | Needs Phase 6 |

**Status key:** 🔲 NOT STARTED · 🔄 IN PROGRESS · ✅ COMPLETE · ⏳ BLOCKED · ⏭️ SKIPPED · 🚨 BROKEN

---

## Phase 0 — Project Scaffold

**Goal:** Running Next.js app with all base classes, env configured, Sheets connected, company index loaded.

**Exit Criteria:**
- [ ] `npm run dev` starts without errors
- [ ] `/src/core/BaseFilter.js` exists with abstract `apply()` and `logElimination()`
- [ ] `/src/core/BaseScorer.js` exists with abstract `score()`, `explain()`, `normalize()`, `applyWeight()`
- [ ] `/src/core/BasePrompt.js` exists with abstract `buildSystemPrompt()`, `buildUserPrompt()`, `parseResponse()`, shared `run()`
- [ ] `/src/core/BaseCache.js` exists with abstract `get()`, `set()`, `invalidate()`, shared `isExpired()`
- [ ] `/src/errors/OJTScoutError.js` exists with base class + typed subclasses
- [ ] `/src/utils/safeAPICall.js` wraps OpenAI calls with 429 retry and 503 fallback
- [ ] `/constants/prompts.js` exists (can be mostly empty stubs at this stage)
- [ ] `/constants/SKILL_ADJACENCY.js` populated with at least 10 common tech skills
- [ ] `/constants/KNOWN_COMPANIES.js` populated with top 5 FEU partners minimum
- [ ] `CompanyIndex` loads from Google Sheets and builds `#byCourse`, `#bySetup`, `#byCity` sets
- [ ] `GET /api/health` returns `{ status: 'ok', companies: N }` with real N from Sheets
- [ ] `.env.example` documents: `OPENAI_API_KEY`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`
- [ ] `PipelineLogger` class exists and logs phase name, input count, output count, token count, duration

**Notes:**
```
[2026-06-25] Phase 0 complete. Stack changed from Next.js/Sheets to
Express + plain HTML/JS + local data/companies.json (per hackathon demo
constraints). All 16 scaffold files built. /api/health → { status: 'ok',
companies: 5, activeInterns: 4 }. KNOWN_COMPANIES.js deferred (not in build
order); 5 enriched companies live in data/companies.json instead.
```

---

## Phase 1 — Intake & Profile Build

**Goal:** Resume upload → structured StudentProfile.

**Exit Criteria:**
- [ ] `SkillExtractor` using `@xenova/transformers` runs locally before GPT
- [ ] `ResumeParserPrompt` extends `BasePrompt`, reads system from `PROMPTS.RESUME_PARSER`
- [ ] `POST /api/pipeline/start` accepts `multipart/form-data` with PDF
- [ ] Returns valid `StudentProfile` JSON matching data model in ARCHITECTURE.md
- [ ] `yearLevel` always set to `'4th'` — no exceptions
- [ ] Proficiency honesty check: evidence field required per skill, defaults to `beginner` if absent
- [ ] Profile cached in `SessionCache` — identified by student session ID
- [ ] `ProfileIncompleteError` thrown when `profileCompleteness === 'LOW'` and no skills detected
- [ ] API returns structured error `{ error: 'PROFILE_INCOMPLETE', message, suggestion }` — not 500
- [ ] Token count logged: ~2,000 expected

**Notes:**
```
[Fill in during/after session]
```

---

## Phase 2 — Pre-Screen Filter

**Goal:** ~1,000 → ~150 companies, zero tokens.

**Exit Criteria:**
- [x] `YearLevelFilter` class extends `HardFilter` extends `BaseFilter`
- [x] `MOAStatusFilter` class created and tested
- [x] `SlotAvailabilityFilter` class created — 0 slots = eliminated, not errored
- [x] `CourseExclusivityFilter` — empty `acceptedCourses` array means all courses pass
- [x] `AllowanceFloorFilter` — null company allowance passes (unknown = not eliminated)
- [x] `SetupPreferenceFilter` — 'any' student preference = all companies pass
- [x] `FilterPipeline` runs all filters via `reduce()` — order: Year → MOA → Slots → Course → Allowance → Setup
- [x] Each filter logs elimination count via inherited `logElimination()`
- [x] `PipelineLogger` records: input 1409, output (per data), tokens 0, time ~6ms
- [x] `NoMatchHandler.level1()` triggered if output is 0

**Notes:**
```
DONE 2026-06-25. 37 unit tests pass (node --test). Phase 2 = 0 tokens, verified
in logger + HTTP smoke test. No openai import anywhere in filters/Phase 2.

DATA REALITY: with current IALAP data, 1409 → 1409 (0 eliminated). This is
CORRECT, not a bug. All companies have moaStatus=Active, slots=5, empty
acceptedCourses, null allowance, null setup — and our critical rules say
unknown ≠ eliminated. The ~150 narrowing happens in Phase 3 (relevance), not
Phase 2. Phase 2 only cuts when data has real disqualifiers (expired MOA, 0
slots, restrictive course list, allowance below floor, or a setup mismatch).

Count note: 1409 companies in companies.json (not the ~1278 from old notes).
UI reads the live count from the API; nothing hardcodes it.

Mock mode added: POST /api/pipeline/start?mock=true skips Phase 1 PDF+GPT and
seeds constants/mockProfile.js, then runs Phase 2 for real. Demo button wired
in public/index.html.
```

---

## Phase 3 — Smart Relevance Check

**Goal:** ~150 → ~40 companies, one batch call + vector math.

**Exit Criteria:**
- [ ] `BatchRelevancePrompt` sends ALL companies in one API call — verified by checking API call count in logger
- [ ] `VectorSearch.buildCompanyVectors()` called on app startup, result stored in singleton
- [ ] Company vectors stored in `Map<id, number[]>` — never recomputed per student
- [ ] `cosineSimilarity()` utility in `/src/utils/math.js` — pure math, no imports
- [ ] `VectorSearch.findTopMatches()` returns top 30 by similarity score
- [ ] Stretch matches from GPT batch filtered out if vector score ≤ 0.6
- [ ] Final output: array of `{ id, relevant, matchType, confidence, reason, vectorScore }`
- [ ] Token cost: batch call ~4,000 + embedding ~500 = ~4,500 total (logged)
- [ ] Cache: company vectors cached in `MemoryCache` on startup — not recomputed

**DEMO BUILD — exit criteria actually met (keyword version):**
- [x] `Phase3_Relevance` extends `BasePhase`, runs over `session.getFilteredIds()`
- [x] `constants/COURSE_MAP.js` exports `classifyIndustry()` + `INDUSTRY` tiers
- [x] Keyword classification → direct / adjacent / stretch / irrelevant
- [x] Keeps direct + adjacent; drops stretch + irrelevant
- [x] Active-intern companies sorted first within a relevance tier
- [x] `session.setRelevance(report)` with tier counts; `setFilteredIds(relevant)`
- [x] tokens: 0 — no GPT call, no embedding (verified in logger + tests)
- [x] Result on real data: 1409 → 661 (direct 486, adjacent 175)

**Notes:**
```
[2026-06-25] Built the DEMO version (keyword matching), not the batch-GPT +
vector version above. Faster, free, deterministic for the 4-hr demo. The
batch-GPT/vector exit criteria remain the "full version" target and are
intentionally not met. Output (661) exceeds the ~200-400 target because FEU's
IALAP partner list is genuinely IT-heavy — correct, not a bug. Phase 4 returns
top 20 regardless.
```

---

## Phase 4 — Data Enrichment

**Goal:** ~40 companies enriched, results cached 30 days.

**Exit Criteria:**
- [ ] `KNOWN_COMPANIES` check runs first — zero API calls for known companies
- [ ] `CacheManager.get('enriched:${id}')` checked before enrichment
- [ ] Enrichment depth computed from vector score: FULL/STANDARD/MINIMAL/SKIP
- [ ] `Promise.all` + `pLimit(5)` used — sequential loop is a build failure
- [ ] Search cascade implemented: JobStreet → Glassdoor → Indeed → LinkedIn → Google
- [ ] Every data field has `{ value, source, confidence }` structure
- [ ] `confidence: 'NONE'` returned (not fabricated data) when nothing found
- [ ] Enriched data written to Google Sheets column with ISO timestamp
- [ ] Next student querying same company within 30 days gets cache hit (tested)
- [ ] `EnrichmentFailedError` caught, handled gracefully, pipeline continues
- [ ] Wisdom Vault entries attached if available for that company

**Notes:**
```
[2026-06-25] Phase 3 + 4 (build-prompt scoring) COMPLETE. Enrichment script
`scripts/enrichTopCompanies.js` CREATED but NOT YET RUN — it spends OpenAI
tokens (Responses API + web_search_preview tool). Targets hasActiveInterns +
enriched.confidence==='NONE' + IT-relevant industries, pLimit(3), --limit
default 30, saves every 10. Run it manually to populate techStack and activate
skill-based scoring. ENRICHMENT prompt added to constants/prompts.js.
```

---

## Phase 5 — Scoring & Ranking

**Goal:** Bilateral ranked list, top 15 with explanations.

**Exit Criteria:**
- [ ] `BilateralScorer` instantiates all 6 student-side + 6 company-side scorers
- [ ] All scorers extend `BaseScorer`, implement `score()` and `explain()`
- [ ] `LearnabilityScorer` uses `SKILL_ADJACENCY` constant — confirmed no GPT call
- [ ] Gap classified as BRIDGEABLE/MANAGEABLE/BLOCKING per adjacency map
- [ ] `AcceptanceClassifier` (brain.js) trained on synthetic data, returns probability
- [ ] GPT explanation called for top 15 only — confirmed by API call count in logger
- [ ] `top_concern` field always present — anti-sycophancy rule enforced in prompt
- [ ] `overall_score` never exceeds 85 unless all dimensions > 75 — verified with test
- [ ] Weight re-ranking: change a weight → list re-sorts → API call count unchanged (0 new calls)
- [ ] `NoMatchHandler.level2()` triggered if all companies score SKIP

**DEMO BUILD — exit criteria actually met (pure-math version):**
- [x] `BilateralScorer` instantiates 4 student-side + 2 company-side scorers
- [x] All scorers extend `BaseScorer`, implement `score()` + `explain()`
- [x] `LearnabilityScorer` uses `SKILL_ADJACENCY` — confirmed no GPT call
- [x] Gap classified BRIDGEABLE/MANAGEABLE/BLOCKING per adjacency map
- [x] Weighting: student 60% (skills .30/allow .25/loc .25/setup .20),
      company 40% (learnability .60/activeIntern .40)
- [x] Tiers IDEAL≥75 / GOOD≥60 / REACH≥45 / LOW; LOW dropped unless <5 remain
- [x] Returns top 20 sorted by bilateral score desc
- [x] Weight/preference re-rank: `POST /rerank/:id` → re-sorts, 0 new tokens
- [x] `Phase4_Scoring` stores top 20 via `session.setScores()`
- [x] `GET /results/:id` returns ranked companies + full breakdowns
- [x] UI: ranked cards (match %, tier, matched/gap tags, allowance, active badge,
      recommendation) + live filter controls (setup/allowance/city/active-only)

**Deferred to full version:** brain.js `AcceptanceClassifier`, GPT top-15
explanations, `top_concern` field, score-cap-at-85 rule, `NoMatchHandler.level2()`.

**Notes:**
```
[2026-06-25] Built as the build-prompt's "Phase 4". Pure math, 0 tokens.
Because Phase 4 enrichment is skipped, every company's enriched.techStack is
empty → SkillsMatch returns 50 (neutral) and Learnability returns 100 (no
gaps). So the demo ranking is driven by location / setup / allowance /
active-intern signals. Top 5 (mock CS profile, QC home): IBM Philippines,
Nomis Asia, Teratomo, Techcore, Nephila Web — all IDEAL 78%, QC, active
interns. To activate skill-based scoring later, populate techStack (Phase 4
enrichment or KNOWN_COMPANIES seed). 58/58 tests pass.
```

---

## Phase 6 — Document Factory

**Goal:** Full 5-document package per company after gate passes.

**Exit Criteria:**
- [ ] `GateEvaluatorPrompt` returns `FAIL` for generic answers (tested with "good company")
- [ ] `GateEvaluatorPrompt` returns `PASS` for specific answers (tested with real example)
- [ ] Pushback message references company name — verified in prompt output
- [ ] `DocumentFactoryPrompt` generates all 5 documents in ONE API call
- [ ] `DocumentFactoryPrompt.temperature === 0.7` — not 0
- [ ] `DocumentValidatorPrompt.temperature === 0` — factual check
- [ ] Checklist auto-populated with generated docs marked ✅ and uploads listed ⬜
- [ ] `DocumentValidatorPrompt` rejects blurry/wrong document with specific reason
- [ ] All documents stored in `sessionSlice` under `companyId` key
- [ ] API call count for 3 companies: gate (3) + factory (3) = 6 calls max

**Notes:**
```
[Fill in during/after session]
```

---

## Phase 7 — Checklist, Tracking & Follow-up

**Goal:** Living dashboard + all background agents running.

**Exit Criteria:**
- [ ] Master checklist renders phase statuses correctly
- [ ] Phase status transitions follow state machine in PHASES.md
- [ ] `SlotMonitor` cron runs every 15 min (or simulated for demo)
- [ ] Slot change detected → matched students identified → alert triggered
- [ ] `ApplicationTracker` detects day 5 no response → drafts follow-up email
- [ ] `ProgressDriftDetector` detects 3-day stall → drafts appropriate message
- [ ] `DeadlineCountdownAgent` sends alerts at T-7, T-3, T-1
- [ ] One-click submission bundles all documents, generates submission email
- [ ] Dashboard state rebuilds correctly when loaded from scratch (session recovery)
- [ ] All background agents log activity to `PipelineLogger`

**Notes:**
```
[Fill in during/after session]
```

---

## Known Issues & Blockers

```
[Fill in as discovered during build]

FORMAT:
Phase N | Issue description | Severity: HIGH/MED/LOW | Status: OPEN/RESOLVED
```

---

## Demo Readiness Checklist

For Day 2 presentation (must pass before 2:00 PM):

**Core Demo (must work):**
- [ ] Resume upload → profile card appears in < 5 seconds
- [ ] Company ranking appears with real FEU partner names
- [ ] Weight slider change → ranking reshuffles instantly (zero tokens)
- [ ] Company selected → gate fires with company name in question
- [ ] Vague gate answer → pushback returned (not approved)
- [ ] Specific gate answer → documents generated
- [ ] All 4 documents visible and readable
- [ ] Checklist populates with generated ✅ and pending ⬜ items
- [ ] Pipeline log shows token counts per phase

**Showstopper Moments:**
- [ ] Live slot alert fires (simulate or real)
- [ ] Follow-up email appears after day 5 simulation
- [ ] Bilateral score breakdown visible (student side + company side)
- [ ] "No match" scenario handled gracefully (relaxed filters shown)

**Polish:**
- [ ] No console errors during demo flow
- [ ] Loading states on all async operations
- [ ] Error messages are student-friendly (not raw API errors)
- [ ] Mobile-readable layout (in case judges check on phone)
