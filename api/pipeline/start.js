// ─── OJT Scout — POST /api/pipeline/start ────────────────────────
// Accepts multipart/form-data with a PDF resume, runs the pipeline, and
// returns the StudentProfile JSON + pre-screen results. Any OJTScoutError
// (e.g. ProfileIncompleteError) is mapped to a structured response —
// never a raw 500.
//
// ?mock=true → skips the PDF parse + GPT call entirely and seeds a
// hardcoded StudentProfile. Lets the full pipeline UI be tested without
// an OpenAI API key.

import { Router } from 'express'
import multer from 'multer'

import { Pipeline } from '../../src/pipeline/Pipeline.js'
import { SessionStore } from '../../src/pipeline/SessionStore.js'
import { OJTScoutError } from '../../src/errors/OJTScoutError.js'
import { MOCK_STUDENT_PROFILE } from '../../constants/mockProfile.js'
import { parseConnection, withConnection, getDefaultConnection } from '../../src/core/AIConnection.js'

const router = Router()

// In-memory upload — we only need the buffer, file is discarded after parse.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') return cb(null, true)
    cb(new OJTScoutError('INVALID_FILE_TYPE', 'Please upload a PDF resume.', {
      suggestion: 'Export your resume as a text-based PDF and try again.'
    }))
  }
})

// Shape the pipeline result into the API response. Shared by both paths so
// the mock and real flows return identical structures to the UI.
function buildResponse(session, logSummary) {
  return {
    success: true,
    sessionId: session.id,
    mock: Boolean(session.getInput().mock),
    profile: session.getProfile(),
    preScreen: session.getPreScreen(),
    relevance: session.getRelevance(),
    scores: session.getScores(),
    tokenUsage: logSummary.tokenUsage,
    estimatedCost: logSummary.estimatedCost
  }
}

router.post('/start', (req, res, next) => {
  const isMock = String(req.query.mock).toLowerCase() === 'true'

  // ─── Mock path — no upload, no PDF parse, no GPT call ───────────
  if (isMock) {
    runMock(req, res).catch(next)
    return
  }

  // ─── Real path — multipart PDF upload ──────────────────────────
  upload.single('resume')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) throw uploadErr

      if (!req.file || !req.file.buffer?.length) {
        throw new OJTScoutError('MISSING_RESUME', 'Please upload your resume to continue.', {
          suggestion: 'Attach a PDF resume and submit again.'
        })
      }

      // Parse optional preferences (sent as a JSON string field, if any).
      let rawPreferences = {}
      if (req.body?.preferences) {
        try {
          rawPreferences = JSON.parse(req.body.preferences)
        } catch {
          rawPreferences = {}
        }
      }

      const connection = parseConnection(req.body?.connection) || getDefaultConnection()
      if (!connection) {
        throw new OJTScoutError('MISSING_CONNECTION', 'Choose your AI provider and enter its API key and model before matching.')
      }
      const pipeline = new Pipeline()
      const { session, logSummary } = await withConnection(connection, () => pipeline.run({
        resumeBuffer: req.file.buffer,
        rawPreferences,
        activeOnly: req.body?.activeOnly === 'true'
      }))
      SessionStore.getInstance().save(session)

      return res.status(200).json(buildResponse(session, logSummary))
    } catch (err) {
      if (err instanceof OJTScoutError) {
        return res.status(400).json(err.toResponse())
      }
      console.error('[API /pipeline/start] Unhandled error:', err)
      return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong parsing your resume.' })
    }
  })
})

// Run the pipeline against a pre-built profile. Phase 1 is skipped via the
// `mockProfile` input; Phase 2+ run normally so the UI exercises the real
// pre-screen path.
async function runMock(req, res) {
  try {
    // Fresh copy each request — never hand out the shared constant.
    const profile = structuredClone(MOCK_STUDENT_PROFILE)
    const preferences = req.body?.preferences
    if (preferences && typeof preferences === 'object' && !Array.isArray(preferences)) {
      profile.preferences = { ...profile.preferences, ...preferences }
    }

    const pipeline = new Pipeline()
    const { session, logSummary } = await pipeline.run({ mock: true, mockProfile: profile, activeOnly: req.body?.activeOnly === true })
    SessionStore.getInstance().save(session)

    return res.status(200).json(buildResponse(session, logSummary))
  } catch (err) {
    if (err instanceof OJTScoutError) {
      return res.status(400).json(err.toResponse())
    }
    console.error('[API /pipeline/start?mock=true] Unhandled error:', err)
    return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong running the demo profile.' })
  }
}

export default router
