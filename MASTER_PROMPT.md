# MASTER PROMPT — OJT Scout
> **First session only.** Paste this entire file as your first message to Claude Code or GPT.
> After session 1, use CLAUDE.md + ROADMAP.md instead. This file is never needed again.

---

You are the lead engineer on **OJT Scout**, an AI-powered OJT matching and application platform for 4th-year FEU students built for the AI Campus Launch Hackathon 2026.

This is a time-constrained build. We have approximately 18 hours of development time split across two sessions. You will build one phase per session block. Do not build ahead. Do not refactor finished phases unless a later phase reveals a breaking issue.

---

## Project Overview

OJT Scout is a **7-phase agentic pipeline** — not a chatbot. It takes a student's resume and moves them from zero to a submitted OJT application with full document generation, company matching, and automated tracking.

**The core loop:**
```
Resume upload → Profile build → Filter 1000 companies to ~40 relevant ones
→ Enrich company data via web search → Score bilaterally → Generate documents
→ Track applications with background agents
```

**Stack:**
- Frontend: Next.js 14, Tailwind CSS, Zustand
- Backend: Next.js API routes (Node.js)
- AI: OpenAI API (GPT-4o, text-embedding-3-small, Assistants API)
- Database: Google Sheets (FEU IALAP partner list — real data already available)
- ML: brain.js (in-browser), @xenova/transformers (local NER)
- Concurrency: p-limit

---

## OOP Architecture

All code follows four OOP pillars strictly. These are not suggestions.

### Abstract Base Classes (build these first in `/src/core/`)

```javascript
// BaseFilter.js
export class BaseFilter {
  get name() { throw new Error('Subclass must define name') }
  apply(companies, criteria) { throw new Error('implement apply()') }
  logElimination(before, after) {
    console.log(`[${this.name}] ${before} → ${after} (-${before - after})`)
  }
}

// BaseScorer.js
export class BaseScorer {
  score(student, company, preferences) { throw new Error('implement score()') }
  explain(result) { throw new Error('implement explain()') }
  normalize(value, min, max) {
    return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
  }
  applyWeight(score, weight) {
    return score * Math.min(1, Math.max(0, weight))
  }
}

// BasePrompt.js
export class BasePrompt {
  get temperature() { return 0 }
  get model() { return 'gpt-4o' }
  buildSystemPrompt() { throw new Error('implement buildSystemPrompt()') }
  buildUserPrompt(input) { throw new Error('implement buildUserPrompt()') }
  parseResponse(raw) { throw new Error('implement parseResponse()') }
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

// BaseCache.js
export class BaseCache {
  async get(key) { throw new Error('implement get()') }
  async set(key, value, ttlDays) { throw new Error('implement set()') }
  async invalidate(key) { throw new Error('implement invalidate()') }
  isExpired(timestamp, ttlDays) {
    return Date.now() - new Date(timestamp).getTime() > ttlDays * 86400000
  }
}
```

---

## Phase Definitions

Build exactly one phase per session block. Mark complete in ROADMAP.md when exit criteria are met.

### Phase 0 — Project Scaffold
**Goal:** Running Next.js app, all base classes exist, env configured, Google Sheets connected, company index built from real IALAP data.

**Exit criteria:**
- [ ] `npm run dev` starts without errors
- [ ] All 4 base classes exist in `/src/core/`
- [ ] `CompanyIndex.init()` loads from Google Sheets and builds indexes
- [ ] `GET /api/health` returns `{ status: 'ok', companies: N }` where N > 0
- [ ] `.env.example` documents all required keys
- [ ] ROADMAP.md updated to Phase 1

---

### Phase 1 — Intake & Profile Build
**Goal:** Student uploads resume → structured profile returned.

**Exit criteria:**
- [ ] `POST /api/pipeline/start` accepts PDF, returns `StudentProfile` JSON
- [ ] Local NER (`SkillExtractor`) runs before GPT call
- [ ] GPT parse uses `PROMPTS.RESUME_PARSER` from `constants/prompts.js`
- [ ] Proficiency honesty check implemented (evidence required per skill)
- [ ] Profile cached in session — re-upload triggers overwrite not duplicate
- [ ] `ProfileIncompleteError` thrown and handled when critical fields missing
- [ ] ROADMAP.md updated to Phase 2

---

### Phase 2 — Pre-Screen Filter
**Goal:** 1,000 companies → ~150 using zero tokens.

**Exit criteria:**
- [ ] `FilterPipeline` runs all 6 filters in sequence
- [ ] Each filter is its own class extending `BaseFilter`
- [ ] `YearLevelFilter` eliminates non-4th-year tracks
- [ ] `CourseExclusivityFilter` correctly passes empty `acceptedCourses` arrays
- [ ] `AllowanceFloorFilter` passes companies with unknown allowance
- [ ] Phase logs elimination count per filter to `PipelineLogger`
- [ ] Token cost for this phase: **0** (verified in logger output)
- [ ] ROADMAP.md updated to Phase 3

---

### Phase 3 — Smart Relevance Check
**Goal:** ~150 companies → ~40 using one batch GPT call + vector search.

**Exit criteria:**
- [ ] `BatchRelevancePrompt` sends all companies in one call — never loops
- [ ] `VectorSearch.buildCompanyVectors()` runs once on startup, cached
- [ ] `VectorSearch.findTopMatches()` uses cosine similarity math (no GPT)
- [ ] Stretch matches only retained if vector score > 0.6
- [ ] Token cost: one batch call (~4,000 tokens) + one embedding (~500 tokens)
- [ ] ROADMAP.md updated to Phase 4

---

### Phase 4 — Data Enrichment
**Goal:** ~40 companies enriched via GPT + web search, results cached to Sheets.

**Exit criteria:**
- [ ] `KNOWN_COMPANIES` fast path checked before any API call
- [ ] `CacheManager.get()` checked before enrichment — cache hit skips search
- [ ] Enrichment depth assigned by vector score (FULL/STANDARD/MINIMAL/SKIP)
- [ ] `pLimit(5)` enforced — never more than 5 concurrent calls
- [ ] Search cascade: JobStreet → Glassdoor → Indeed → LinkedIn → Google
- [ ] Confidence score attached to every data field
- [ ] Results written back to Google Sheets with timestamp
- [ ] `EnrichmentFailedError` handled — returns null fields, not crash
- [ ] ROADMAP.md updated to Phase 5

---

### Phase 5 — Scoring & Ranking
**Goal:** Enriched companies ranked by bilateral match score.

**Exit criteria:**
- [ ] `BilateralScorer` runs all student-side and company-side scorers
- [ ] `LearnabilityScorer` uses `SKILL_ADJACENCY` constant — no GPT call
- [ ] `AcceptanceClassifier` (brain.js) produces acceptance odds
- [ ] GPT explanation generated for top 15 only — not all 40
- [ ] Weight slider re-ranking costs **0 tokens** (verified in logger)
- [ ] Anti-sycophancy: `top_concern` always present in output
- [ ] `NoMatchHandler` triggered when all scores below threshold
- [ ] ROADMAP.md updated to Phase 6

---

### Phase 6 — Document Factory
**Goal:** Per selected company — full document package generated after gate passes.

**Exit criteria:**
- [ ] `GateEvaluatorPrompt` blocks document generation on vague answers
- [ ] Gate pushback references company by name
- [ ] All 5 documents generated in **one API call** — not 5 separate calls
- [ ] `DocumentValidatorPrompt` validates each student upload
- [ ] Checklist auto-populated after generation
- [ ] Documents stored per company in session state
- [ ] `DocumentFactoryPrompt` uses temperature 0.7
- [ ] ROADMAP.md updated to Phase 7

---

### Phase 7 — Checklist, Tracking & Follow-up
**Goal:** Living dashboard + background agents running.

**Exit criteria:**
- [ ] Master checklist renders with correct phase statuses
- [ ] `SlotMonitor` cron detects slot changes and triggers alerts
- [ ] `ApplicationTracker` drafts follow-up at day 5 no response
- [ ] `ProgressDriftDetector` nudges at 3-day stall
- [ ] One-click submission packages all documents
- [ ] `DeadlineCountdownAgent` sends T-7, T-3, T-1 alerts
- [ ] Dashboard state rebuilds correctly from checklist timestamps
- [ ] ROADMAP.md updated to COMPLETE

---

## Token Cost Rules (enforce in every phase)

```
Phase 2 pre-screen:   MUST be 0 tokens
Phase 3 batch call:   MUST be 1 GPT call (not N calls)
Phase 4 enrichment:   MUST check cache before calling
Phase 5 re-ranking:   MUST be 0 tokens (pure math)
Phase 6 documents:    MUST be 1 GPT call per company (not 5)
```

If any of these rules are violated, fix before marking phase complete.

---

## Error Handling Rules

```javascript
// All typed errors live in /src/errors/OJTScoutError.js
// Never throw raw Error('string') — always use typed subclasses

// Every OpenAI call uses this wrapper:
export async function safeAPICall(fn, fallback = null) {
  try {
    return await fn()
  } catch (err) {
    if (err.status === 429) { await sleep(2000); return await fn() }
    if (err.status === 503) return fallback
    throw new OJTScoutError('API_ERROR', err.message)
  }
}

// Every API route uses this pattern:
try {
  // ... logic
} catch (err) {
  if (err instanceof OJTScoutError) {
    return res.status(400).json({ error: err.code, message: err.message })
  }
  return res.status(500).json({ error: 'INTERNAL_ERROR' })
}
```

---

## Prompt Rules

```
ALL prompt strings live in constants/prompts.js only.
No prompt string may appear anywhere else in the codebase.

Factual prompts (parsers, scorers, validators): temperature: 0
Creative prompts (documents, gate): temperature: 0.7
All prompts: response_format: { type: 'json_object' }
All prompts include: anti-hallucination rules + output schema
```

---

## Session Management Instructions

### Starting a session
1. Read CLAUDE.md (auto-loaded)
2. Read ROADMAP.md — identify active phase and exit criteria
3. Read DEV_LOG.md — know what was decided before
4. Build only the active phase

### During a session
- Commit working code to the active phase branch: `phase-N-name`
- Do not merge to main until all exit criteria are met
- If you discover a design issue with a prior phase, log it in DEV_LOG.md and flag it — do not silently fix it

### Before /compact or ending a session
Say: *"Summarize what we completed and update DEV_LOG.md before compacting."*
This preserves decisions across context resets.

### Correcting wrong assumptions
If Claude Code's summary of the project state is wrong at session start, correct it immediately before any code is written. A wrong mental model compounds into every line of code that follows.

---

## First Session Task

Build **Phase 0 — Project Scaffold** only.

When Phase 0 exit criteria are all met:
1. Update ROADMAP.md: mark Phase 0 complete, set Phase 1 as active
2. Update DEV_LOG.md with scaffold decisions
3. Stop — do not begin Phase 1 in the same session unless time explicitly permits

Future sessions start from CLAUDE.md + ROADMAP.md only. This file is not needed again.
