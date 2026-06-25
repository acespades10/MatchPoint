// ─── OJT Scout — Express Server ──────────────────────────────────
// Phase 0: minimal server + /api/health only.
// Loads the local company JSON into the CompanyIndex on startup.

import 'dotenv/config'
import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { CompanyIndex } from './src/data/CompanyIndex.js'
import { OJTScoutError } from './src/errors/OJTScoutError.js'
import pipelineStartRouter from './api/pipeline/start.js'
import pipelineResultsRouter from './api/pipeline/results.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const COMPANIES_PATH = path.resolve(
  __dirname,
  process.env.COMPANIES_DATA_PATH || './data/companies.json'
)

const app = express()
app.use(express.json())
app.use(express.static(path.join(__dirname, 'public')))

// ─── Health check ────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const index = CompanyIndex.getInstance()
  res.json({
    status: index.isReady() ? 'ok' : 'degraded',
    companies: index.getTotalCount(),
    activeInterns: index.getActive().length
  })
})

// ─── Pipeline routes ─────────────────────────────────────────────
app.use('/api/pipeline', pipelineStartRouter)
app.use('/api/pipeline', pipelineResultsRouter)

// ─── Centralized error handler ───────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof OJTScoutError) {
    return res.status(400).json(err.toResponse())
  }
  console.error('[API] Unhandled error:', err)
  return res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Something went wrong.' })
})

// ─── Startup ─────────────────────────────────────────────────────
async function start() {
  try {
    await CompanyIndex.getInstance().initFromFile(COMPANIES_PATH)
    console.log(
      `[INIT] CompanyIndex loaded ${CompanyIndex.getInstance().getTotalCount()} companies from ${COMPANIES_PATH}`
    )
  } catch (err) {
    console.error('[INIT] Failed to load companies — starting with empty index:', err.message)
  }

  app.listen(PORT, () => {
    console.log(`[SERVER] OJT Scout running at http://localhost:${PORT}`)
    console.log(`[SERVER] Health: http://localhost:${PORT}/api/health`)
  })
}

start()
