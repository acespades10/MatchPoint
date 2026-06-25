// ─── OJT Scout — Phase 1: Intake & Profile Build ─────────────────
// Resume file → structured, honesty-checked StudentProfile.
//
// STEP 1  extract text from the PDF (pdf-parse, zero tokens)
// STEP 2  parse with ResumeParserPrompt (GPT-4o, ~2,000 tokens)
// STEP 3  force yearLevel = '4th' always (OJT requirement)
// STEP 4  proficiency honesty defaults — no evidence ⇒ beginner
// STEP 5  store profile in the session
// STEP 6  log token count to PipelineLogger
//
// Throws ProfileIncompleteError when profileCompleteness === 'LOW'
// AND no skills were detected.

import { randomUUID } from 'node:crypto'
// pdf-parse ships debug code in its index; import the lib entry directly.
import pdf from 'pdf-parse/lib/pdf-parse.js'

import { BasePhase } from '../BasePhase.js'
import { ResumeParserPrompt } from '../../prompts/factual/ResumeParserPrompt.js'
import { ProfileIncompleteError } from '../../errors/OJTScoutError.js'

export class Phase1_Intake extends BasePhase {
  #prompt = new ResumeParserPrompt()

  get name() {
    return 'Intake & Profile Build'
  }

  async execute(session, logger) {
    logger?.startPhase(this.name)

    const { resumeBuffer, rawPreferences = {}, mockProfile } = session.getInput()

    // Demo/test path — a pre-built profile is supplied, so skip the PDF
    // parse and the GPT call entirely. Zero tokens, no API key required.
    if (mockProfile) {
      mockProfile.yearLevel = '4th' // enforce the OJT rule even for mocks
      session.setProfile(mockProfile)
      logger?.endPhase(this.name, { input: 1, output: 1, tokens: 0 })
      session.log({ phase: this.name, mock: true, skills: (mockProfile.skills ?? []).length })
      return mockProfile
    }

    // STEP 1 — Extract text from the PDF (0 tokens)
    const resumeText = await this.#extractText(resumeBuffer)

    // STEP 2 — GPT parse into a structured profile
    const parsed = await this.#prompt.run({ resumeText })

    // STEP 3 — Enforce OJT year-level rule, no exceptions
    parsed.yearLevel = '4th'

    // STEP 4 — Proficiency honesty defaults
    const skills = this.#applyHonestyDefaults(parsed.skills)

    // Assemble final StudentProfile
    const now = new Date().toISOString()
    const profile = {
      id: randomUUID(),
      name: parsed.name ?? null,
      course: parsed.course ?? null,
      yearLevel: '4th',
      campus: parsed.campus ?? null,
      gpa: parsed.gpa ?? null,
      skills,
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      preferences: this.#buildPreferences(rawPreferences),
      profileCompleteness: parsed.profileCompleteness ?? 'LOW',
      missingCritical: Array.isArray(parsed.missingCritical) ? parsed.missingCritical : [],
      parserNotes: parsed.parserNotes ?? null,
      createdAt: now,
      updatedAt: now
    }

    // Honesty gate — LOW completeness with no skills is unusable downstream.
    if (profile.profileCompleteness === 'LOW' && profile.skills.length === 0) {
      logger?.endPhase(this.name, {
        input: 1,
        output: 0,
        tokens: this.#estimateTokens(resumeText, parsed)
      })
      throw new ProfileIncompleteError(
        profile.missingCritical.length ? profile.missingCritical : ['skills', 'experience']
      )
    }

    // STEP 5 — Store profile (re-upload overwrites, never duplicates)
    session.setProfile(profile)

    // STEP 6 — Log token count
    const tokens = this.#estimateTokens(resumeText, parsed)
    logger?.endPhase(this.name, { input: 1, output: 1, tokens })
    session.log({ phase: this.name, completeness: profile.profileCompleteness, skills: profile.skills.length })

    return profile
  }

  // ─── Helpers ───────────────────────────────────────────────────

  async #extractText(buffer) {
    if (!buffer || !buffer.length) {
      throw new ProfileIncompleteError(['resume'])
    }
    const data = await pdf(buffer)
    const text = (data.text ?? '').trim()
    if (!text) {
      // Image-only / unreadable PDF — surface as an incomplete profile.
      throw new ProfileIncompleteError(['readable-resume-text'])
    }
    return text
  }

  // No evidence ⇒ beginner. Never trust an inflated level without backing.
  #applyHonestyDefaults(rawSkills) {
    if (!Array.isArray(rawSkills)) return []
    return rawSkills
      .filter(s => s && s.skill)
      .map(s => {
        const hasEvidence = Boolean(s.evidence && String(s.evidence).trim())
        const level = hasEvidence ? s.level ?? 'beginner' : 'beginner'
        return {
          skill: s.skill,
          level: ['beginner', 'intermediate', 'advanced'].includes(level)
            ? level
            : 'beginner',
          evidence: hasEvidence ? s.evidence : null,
          verified: hasEvidence
        }
      })
  }

  #buildPreferences(raw) {
    return {
      minAllowance: raw.minAllowance ?? null,
      setup: raw.setup ?? 'any',
      maxDistanceKm: raw.maxDistanceKm ?? null,
      homeLocation: raw.homeLocation ?? null,
      targetIndustry: Array.isArray(raw.targetIndustry) ? raw.targetIndustry : [],
      learningGoal: raw.learningGoal ?? null,
      weights: {
        skillsMatch: 0.2,
        allowanceFit: 0.15,
        locationFit: 0.15,
        learningQuality: 0.15,
        brandValue: 0.1,
        workLifeBalance: 0.1,
        setupPreference: 0.1,
        slotAvailability: 0.05
      }
    }
  }

  // Approximate token usage (~4 chars/token) — BasePrompt.run() doesn't
  // surface provider usage, so we estimate for the logger. Documented as
  // an estimate, not a billed figure.
  #estimateTokens(resumeText, parsed) {
    const systemAndUser = (this.#prompt.buildSystemPrompt() ?? '').length + (resumeText ?? '').length
    const output = JSON.stringify(parsed ?? {}).length
    return Math.ceil((systemAndUser + output) / 4)
  }
}
