# DEV_LOG.md — OJT Scout
> Running log of decisions, discoveries, and changes made during each session.
> **Update this before every /compact.** It is the memory that survives context resets.
> Newest entries at the top.

---

## How to Use This File

At the end of every session or before /compact, add an entry:

```
## [DATE TIME] — Session N Summary

**Phase worked on:** Phase X — Name
**Completed:**
  - List what was actually finished

**Decisions made:**
  - Decision and the reason it was made

**Issues discovered:**
  - Any problems found, their severity, and how they were handled

**Next session should:**
  - Exact first task for next session
```

---

## Pre-Build Decisions (Architecture Locked)

These decisions were made during the brainstorming phase and are not to be revisited without team discussion.

---

**[2026-06-25] — Architecture Decisions Log**

**Stack selected:**
- Next.js 14 for frontend + API routes (single repo, simpler deployment for demo)
- Tailwind CSS (utility-first, fast to build demo UI)
- Zustand for state (lighter than Redux, enough for this scope)
- Google Sheets as database (real FEU IALAP data already available — critical advantage)
- brain.js for ML (in-browser, no training infra, good enough for acceptance classifier)
- @xenova/transformers for local NER (jjzha/jobbert-skill-extraction, zero API cost)
- p-limit for concurrency control (prevents rate limit violations)

**OJT scope locked:**
- 4th year students only (FEU requirement — confirmed from hackathon document)
- YearLevelFilter added to Phase 2 to enforce this at pipeline level

**Database strategy:**
- Google Sheets = ground truth (FEU IALAP sheet with ~1000 companies + active intern status)
- Enrichment written back to additional columns in the same sheet
- Cache TTL = 30 days per company (balance between freshness and API cost)

**Token optimization decisions:**
- Phase 2 must cost 0 tokens — this is a hard rule, not a goal
- Phase 3 uses one batch call for all companies — never a loop
- Phase 4 uses pLimit(5) + parallel — never sequential
- Phase 5 re-ranking is pure math — zero tokens on weight changes
- Phase 6 generates all 5 docs in one call — never 5 separate calls

**Scoring architecture:**
- Bilateral matching: student-side (6 dimensions) + company-side (6 dimensions)
- Both sides weighted, combined 50/50 for bilateral score
- Tier system: IDEAL / GOOD / REACH / NEUTRAL / SKIP
- Anti-sycophancy enforced in prompt: top_concern always required, score cap rules

**Learnability scoring:**
- Uses SKILL_ADJACENCY constant — zero GPT calls
- Gap types: BRIDGEABLE (5pt penalty) / MANAGEABLE (15pt) / BLOCKING (35pt)
- Adjacency map expandable — add skills as needed per FEU partner tech stacks

**Prompt strategy:**
- All prompts in constants/prompts.js — single source of truth
- Factual prompts: temperature 0 (parsers, scorers, validators)
- Creative prompts: temperature 0.7 (documents, gate evaluation)
- Anti-hallucination: source URLs required in enrichment, null not fabricated data
- Anti-sycophancy: explicit rules in FIT_SCORER prompt

**Error handling:**
- All errors extend OJTScoutError with code, message, context
- safeAPICall() wraps every OpenAI call — handles 429 retry and 503 fallback
- No Match handler has 3 levels: relax filters → reach goals → alternative pathways
- Pipeline degrades gracefully — phase failure doesn't kill downstream phases

**ML layer:**
- SkillExtractor: pre-trained jjzha/jobbert-skill-extraction, runs locally
- VectorSearch: text-embedding-3-small, company vectors built once on startup
- AcceptanceClassifier: brain.js NeuralNetwork, trained on synthetic data
- All three are optional enhancements — pipeline works without them

**OOP structure:**
- BaseFilter / BaseScorer / BasePrompt / BaseCache are contracts, not implementations
- Private fields (#) for all internal state — no direct property mutation
- Polymorphism: FilterPipeline and BilateralScorer call interfaces, not implementations
- One class = one job — enforced during code review

**No-match philosophy:**
- System never returns "no results" — always returns "here's why and what to do"
- 3-level cascade: relax filters → reach goals → alternative pathways
- Level 4 (profile strengthening plan) for genuinely unplaceable students

**Demo strategy:**
- Phase 2 demonstrates token efficiency (show 0 in logger)
- Phase 5 demonstrates live re-ranking (show 0 new API calls on slider change)
- Phase 6 gate demonstrates Maieutic pattern (show pushback on vague answer)
- Slot alert demonstrates Rippletide pattern (background agent, no student trigger)
- Pipeline logger shown in demo — token counts, phase timings, cost estimate

---

## Session Entries

```
[Add new entries below this line, newest first]
```

## [2026-06-25] — Session: Phases 3 + 4 (Relevance + Scoring), built together

**Phase worked on:** Phase 3 — Smart Relevance Check + demo Scoring & Ranking
(the build prompt's "Phase 4"). Built together because scoring is pure math with
no API calls and consumes Phase 3 output directly.

**Completed:**
  - `constants/COURSE_MAP.js` — `classifyIndustry()` + `COURSE_RELEVANCE_PROFILES`
    (direct/adjacent/stretch/irrelevant), keyword/substring matching, extensible
    per course family.
  - `src/pipeline/phases/Phase3_Relevance.js` — keeps direct+adjacent, drops
    stretch+irrelevant, active-intern-first sort within tier, writes
    `session.setRelevance()`. 1409 → 661, 0 tokens.
  - `PipelineSession` — added `setRelevance()` / `getRelevance()`.
  - Student-side scorers: `SkillsMatchScorer`, `AllowanceFitScorer`,
    `LocationFitScorer`, `SetupFitScorer`.
  - Company-side scorers: `LearnabilityScorer` (SKILL_ADJACENCY, case-insensitive),
    `ActiveInternScorer`.
  - `src/scorers/BilateralScorer.js` — combines all 6, weights student 60% /
    company 40%, tiers IDEAL/GOOD/REACH/LOW, top 20, LOW dropped unless <5.
  - `src/pipeline/phases/Phase4_Scoring.js` — hydrates from CompanyIndex, runs
    BilateralScorer, `session.setScores()`. 661 → 20, 0 tokens.
  - `src/pipeline/SessionStore.js` — in-memory session store (cap 200) so
    results/re-rank can retrieve a run without re-running the pipeline.
  - `api/pipeline/results.js` — `GET /results/:id`, `POST /rerank/:id`
    (zero-token re-score), `GET /cities`. Wired into `server.js`.
  - `Pipeline.js` — now runs Phase1→2→3→4.
  - `public/index.html` — ranked company cards (match %, tier badge, matched
    green tags, gap BRIDGEABLE/MANAGEABLE/BLOCKING tags, allowance, active-intern
    badge, recommendation) + filter controls (setup/allowance/city/active-only)
    that re-rank instantly via the re-rank endpoint.
  - Tests: SkillsMatch, Allowance, Learnability, Bilateral, Phase3 (+ existing).
    **58/58 pass** (was 37).

**Decisions made:**
  - DEMO version of Phase 3 = pure keyword matching, NOT batch-GPT + vectors.
    Reason: faster, zero tokens, deterministic, more reliable to demo in 4 hrs.
    The full GPT/vector version stays the documented target in ROADMAP.
  - Architecture "Phase 4 — Data Enrichment" is SKIPPED for the demo. The build
    prompt's "Phase 4 — Scoring" maps to architecture "Phase 5 — Scoring".
    Numbering reconciliation documented in ROADMAP Current Status.
  - Scorers gracefully treat unknown data as NEUTRAL, never a penalty: empty
    techStack → SkillsMatch 50 / Learnability 100; null allowance → 50; null
    setup → 50; no homeLocation → 50. Consistent with the Phase 2 null rule
    ("unknown ≠ eliminated").
  - Re-rank is a lightweight HTTP endpoint (allowed by the build prompt). It
    spends 0 OpenAI tokens — the "no new API call" requirement is about token
    cost, satisfied since scoring is pure math.
  - Filter controls map to scoring inputs (setup/allowance/homeLocation → soft
    re-score) except "Active interns only" which is a hard post-filter.
  - SKILL_ADJACENCY keys are proper-cased but student skills are lowercased; the
    build prompt's pseudocode would never match. Fixed with a lowercased
    adjacency view built once at module load in LearnabilityScorer.

**Issues discovered:**
  - Phase 3 output (661) exceeds the ~200-400 target. NOT a bug — FEU's IALAP
    list is genuinely IT-heavy (486 direct + 175 adjacent). Phase 4 caps at 20.
  - Demo ranking is currently driven by location/setup/allowance/active-intern,
    not skills — because enrichment (techStack) is skipped, skill scorers are
    neutral for all companies. Severity LOW. To activate skill matching, seed
    techStack (Phase 4 enrichment or KNOWN_COMPANIES). Documented.

**Next session should:**
  - STOP for review (per session instruction) before starting Phase 5 —
    Document Factory (gate evaluator + 5-doc generation, GPT, temp 0.7).

---

## [2026-06-25] — Session: Phase 2 (Pre-Screen Filter) decisions

**Phase worked on:** Phase 2 — Pre-Screen Filter (hard elimination, 0 tokens)

**Completed:**
  - 6 hard filters extending `HardFilter` extends `BaseFilter`: YearLevel, MOA,
    Slots, Course, Allowance, Setup.
  - `FilterPipeline` runs them in fixed order via reduce; each logs before→after.
  - `Phase2_PreScreen` writes surviving ids + a per-filter funnel report;
    triggers `NoMatchHandler.level1()` when 0 survive.
  - Mock path: `POST /api/pipeline/start?mock=true` seeds `mockProfile`, skips
    PDF+GPT, runs Phase 2 for real. 37 tests pass.

**Decisions made:**
  - Phase 2 is a HARD 0-token rule, not a goal — no openai import anywhere in the
    filter path.
  - "Unknown ≠ eliminated" is the governing principle: null allowance passes,
    null setup passes, empty acceptedCourses = open to all, missing data never
    disqualifies. Only real disqualifiers cut (expired MOA, 0 slots, restrictive
    course list, allowance below floor, explicit setup mismatch).
  - With current IALAP data this means 1409 → 1409 (0 cut) — CORRECT, because the
    data has no real disqualifiers yet. The real narrowing happens in Phase 3
    (relevance), confirmed this session (1409 → 661).
  - Filter order locked: Year → MOA → Slots → Course → Allowance → Setup.
  - UI funnel reads the live count from the API; no hardcoded company count.

## [2026-06-25] — IALAP Extractor Fix — Misaligned HR Email Column

**Phase worked on:** Extractor (`scripts/extractIALAP.js`) — supports Phase 0 data layer

**Issue discovered:**
  - Sheet 1 (ACTIVE INDUSTRY PARTNERS) has a "generic HR email" column at col[4],
    but it is shifted +1 row in the source file: each row's col[4] holds the
    *next* company's address fragment, not that company's HR email.
  - Naively reading col[4] into an email field would attach the wrong company's
    data to a record — a correctness/data-integrity bug, not just a cosmetic one.
  - Severity: HIGH (silently corrupts contact data for active-partner records).

**Decision made (HR email popup question):**
  - **Drop it.** For all Sheet-1-only records, `poc2Email` (and poc2Name/poc2Position)
    is set to `null`. We do NOT read the misaligned col[4].
  - Reason: an unknown/empty email is safe; a *wrong* email is not. Sending an
    application to the wrong company is far worse than having no secondary contact.
    The named POC at cols 5/6/7 IS correctly aligned, so it is kept as poc1.
  - This is the conservative/safest option — "unknown ≠ fabricated" principle,
    consistent with the Phase 2 null-handling rules (null allowance/setup pass,
    never invent data).

**Resolution:**
  - `extractIALAP.js` Sheet 1 branch reads only the aligned POC (cols 5/6/7) into
    poc1*, and explicitly sets poc2Name/poc2Position/poc2Email = null.
  - Verified output: `data/companies.json` regenerated, 1409 companies total
    (243 flagged hasActiveInterns). No Sheet-1-only record carries a guessed email.

**Note on count:** companies.json currently holds **1409** companies, not the
  ~1278 referenced in earlier notes (count grew after Sheet-1-only records were
  added as full records). Downstream code/UI should read the live count, not
  hardcode a number.

**Next session should:** Build Phase 2 Pre-Screen (zero tokens).

---

*OJT Scout — DEV_LOG*  
*Update before every /compact. Never delete entries — only append.*
