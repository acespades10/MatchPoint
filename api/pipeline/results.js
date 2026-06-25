// ─── OJT Scout — Results & Instant Re-Rank routes ────────────────
//   GET  /api/pipeline/results/:sessionId   → ranked companies + breakdowns
//   POST /api/pipeline/rerank/:sessionId    → re-score with new preferences
//
// Both are ZERO-TOKEN. The re-rank re-runs the pure-math BilateralScorer over
// the companies Phase 3 already deemed relevant — no GPT call, no embedding,
// no new spend. This is the "move a slider, list reshuffles instantly" demo.

import { Router } from 'express'

import { SessionStore } from '../../src/pipeline/SessionStore.js'
import { CompanyIndex } from '../../src/data/CompanyIndex.js'
import { BilateralScorer } from '../../src/scorers/BilateralScorer.js'
import { OJTScoutError } from '../../src/errors/OJTScoutError.js'

const router = Router()
const scorer = new BilateralScorer()

function loadSession(sessionId) {
  const session = SessionStore.getInstance().get(sessionId)
  if (!session) {
    throw new OJTScoutError('SESSION_NOT_FOUND', 'This session has expired or does not exist.', {
      suggestion: 'Run the pipeline again from the start.'
    })
  }
  return session
}

// ─── GET /cities — unique cities for the filter dropdown ───────────
router.get('/cities', (req, res) => {
  res.json({ cities: CompanyIndex.getInstance().getCities() })
})

// ─── GET /results/:sessionId — return the stored ranking ───────────
router.get('/results/:sessionId', (req, res) => {
  try {
    const session = loadSession(req.params.sessionId)
    return res.status(200).json({
      success: true,
      sessionId: session.id,
      profile: session.getProfile(),
      relevance: session.getRelevance(),
      scores: session.getScores()
    })
  } catch (err) {
    if (err instanceof OJTScoutError) return res.status(404).json(err.toResponse())
    console.error('[API /pipeline/results] Unhandled error:', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Could not load results.' })
  }
})

// ─── POST /rerank/:sessionId — instant, zero-token re-score ─────────
// Body: { preferences?: { setup, minAllowance, homeLocation }, activeOnly?: bool }
router.post('/rerank/:sessionId', (req, res) => {
  try {
    const session = loadSession(req.params.sessionId)
    const profile = session.getProfile()
    if (!profile) {
      throw new OJTScoutError('NO_PROFILE', 'No profile on this session to score against.')
    }

    const { preferences = {}, activeOnly = false } = req.body ?? {}

    // Merge the new preference values onto a copy of the profile. Only the
    // fields the filter controls touch are overridden.
    const updated = {
      ...profile,
      preferences: {
        ...profile.preferences,
        ...('setup' in preferences ? { setup: preferences.setup } : {}),
        ...('minAllowance' in preferences ? { minAllowance: preferences.minAllowance } : {}),
        ...('homeLocation' in preferences ? { homeLocation: preferences.homeLocation } : {})
      }
    }

    // Re-hydrate the Phase-3 relevant pool and re-score (pure math).
    const index = CompanyIndex.getInstance()
    let companies = session.getFilteredIds().map(id => index.getById(id)).filter(Boolean)

    if (activeOnly) {
      companies = companies.filter(c => c.hasActiveInterns)
    }

    const ranked = scorer.scoreAll(updated, companies)
    session.setScores(ranked) // keep the session in sync with what's shown

    return res.status(200).json({
      success: true,
      sessionId: session.id,
      tokens: 0,
      appliedPreferences: updated.preferences,
      activeOnly: Boolean(activeOnly),
      scores: ranked
    })
  } catch (err) {
    if (err instanceof OJTScoutError) {
      const status = err.code === 'SESSION_NOT_FOUND' ? 404 : 400
      return res.status(status).json(err.toResponse())
    }
    console.error('[API /pipeline/rerank] Unhandled error:', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Could not re-rank results.' })
  }
})

export default router
