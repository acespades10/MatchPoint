// ─── OJT Scout — Top Companies Enrichment (Phase 4) ──────────────
// Enriches active-intern companies that have never been enriched, using the
// OpenAI Responses API with the built-in web_search_preview tool.
//
// Usage:  node scripts/enrichTopCompanies.js [--limit 30]
//
// Behavior:
//   - Targets companies where hasActiveInterns === true AND
//     enriched.confidence === 'NONE' (never enriched yet).
//   - Skips non-IT industries (keeps only direct/adjacent per COURSE_MAP).
//   - Concurrency capped at pLimit(3) — respects OpenAI rate limits.
//   - Every OpenAI call wrapped in safeAPICall() (never let raw errors escape).
//   - Saves data/companies.json every 10 enriched companies (crash-safe).
//   - Logs progress per company.
//
// DO NOT RUN blindly — this spends tokens. Review --limit first.

import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import pLimit from 'p-limit'
import { safeAPICall } from '../src/utils/safeAPICall.js'
import { PROMPTS } from '../constants/prompts.js'
import { classifyIndustry, RELEVANT_TIERS } from '../constants/COURSE_MAP.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_PATH = path.resolve(__dirname, '../data/companies.json')

const DEFAULT_LIMIT = 30
const CONCURRENCY = 3
const SAVE_EVERY = 10

// ─── Args ────────────────────────────────────────────────────────
function parseLimit() {
  const args = process.argv.slice(2)
  const i = args.indexOf('--limit')
  if (i !== -1 && args[i + 1]) {
    const n = Number(args[i + 1])
    if (Number.isFinite(n) && n > 0) return n
  }
  return DEFAULT_LIMIT
}

// ─── OpenAI client (lazy, same pattern as BasePrompt) ────────────
let _client = null
async function getClient() {
  if (_client) return _client
  const { default: OpenAI } = await import('openai')
  _client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID || undefined
  })
  return _client
}

// Pull the JSON object out of a Responses API result. Tolerant of fences /
// stray prose — returns null on anything unparseable (never throws).
function parseEnrichment(text) {
  if (!text) return null
  const cleaned = String(text).replace(/```json|```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

// Enrich one company via web search. Returns an enriched object or null.
async function enrichCompany(company) {
  const userPrompt =
    `Company: ${company.name}\n` +
    `Industry: ${company.industry ?? 'unknown'}\n` +
    `City: ${company.city ?? 'Philippines'}\n\n` +
    `Research this specific Philippine company and return the JSON schema.`

  return safeAPICall(async () => {
    const client = await getClient()
    const response = await client.responses.create({
      model: 'gpt-4o',
      temperature: PROMPTS.ENRICHMENT.temperature,
      tools: [{ type: 'web_search_preview' }],
      input: [
        { role: 'system', content: PROMPTS.ENRICHMENT.system },
        { role: 'user', content: userPrompt }
      ]
    })
    return parseEnrichment(response.output_text)
  }, null)
}

async function main() {
  const limit = parseLimit()
  const companies = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))

  // Target: active-intern, never-enriched, IT-relevant companies.
  const targets = companies.filter(c => {
    if (!c.hasActiveInterns) return false
    if (c.enriched?.confidence !== 'NONE') return false
    const tier = classifyIndustry(c.industry)
    return RELEVANT_TIERS.includes(tier)
  })

  const queue = targets.slice(0, limit)
  console.log(
    `${targets.length} eligible companies (active + unenriched + IT). ` +
    `Enriching ${queue.length} (limit ${limit}), concurrency ${CONCURRENCY}.`
  )
  if (!queue.length) {
    console.log('Nothing to enrich. Exiting.')
    return
  }

  const save = () => {
    writeFileSync(DATA_PATH, JSON.stringify(companies, null, 2) + '\n', 'utf-8')
  }

  const run = pLimit(CONCURRENCY)
  let done = 0
  let enrichedOk = 0

  await Promise.all(queue.map(company => run(async () => {
    const result = await enrichCompany(company)
    done++

    if (result) {
      // Preserve schema shape; only overwrite with what we found.
      company.enriched = {
        internTasks: result.internTasks ?? [],
        techStack: result.techStack ?? [],
        workCulture: result.workCulture ?? null,
        reviewSummary: result.reviewSummary ?? null,
        avgRating: result.avgRating ?? null,
        topPositives: result.topPositives ?? [],
        topConcerns: result.topConcerns ?? [],
        confidence: result.confidence ?? 'NONE'
      }
      enrichedOk++
      console.log(
        `[${done}/${queue.length}] ${company.name} — ` +
        `confidence ${company.enriched.confidence}, ` +
        `${company.enriched.techStack.length} tech, ` +
        `${company.enriched.internTasks.length} tasks`
      )
    } else {
      console.log(`[${done}/${queue.length}] ${company.name} — no data (kept NONE)`)
    }

    // Crash-safe checkpoint every N companies.
    if (done % SAVE_EVERY === 0) {
      save()
      console.log(`  …saved checkpoint at ${done} companies`)
    }
  })))

  save()
  console.log(`Done. ${enrichedOk}/${queue.length} enriched with data. Saved ${DATA_PATH}.`)
}

main().catch(err => {
  console.error('Enrichment failed:', err?.message ?? err)
  process.exit(1)
})
