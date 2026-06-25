// ─── OJT Scout — ResumeParserPrompt ──────────────────────────────
// Factual prompt (temperature 0). Reads its system string from the
// registry — never defines prompt text here. Turns raw resume text into
// a StudentProfile-shaped object.

import { BasePrompt } from '../../core/BasePrompt.js'
import { PROMPTS } from '../../../constants/prompts.js'

export class ResumeParserPrompt extends BasePrompt {
  get temperature() {
    return PROMPTS.RESUME_PARSER.temperature // 0 — factual
  }

  buildSystemPrompt() {
    return PROMPTS.RESUME_PARSER.system
  }

  buildUserPrompt(input) {
    // input: { resumeText }
    const text = typeof input === 'string' ? input : input?.resumeText ?? ''
    return `Parse the following resume text into the required JSON schema.\n\nRESUME TEXT:\n"""\n${text}\n"""`
  }

  parseResponse(raw) {
    let parsed
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      // Anti-crash: never throw on malformed JSON — return a minimal LOW profile.
      return {
        name: null,
        course: null,
        yearLevel: '4th',
        campus: null,
        gpa: null,
        skills: [],
        experience: [],
        certifications: [],
        profileCompleteness: 'LOW',
        missingCritical: ['skills', 'experience'],
        parserNotes: 'Parser returned malformed JSON; using empty fallback profile.'
      }
    }

    // Normalize shape so downstream phases get predictable fields.
    return {
      name: parsed.name ?? null,
      course: parsed.course ?? null,
      yearLevel: '4th', // enforced here too; Phase 1 re-enforces as well
      campus: parsed.campus ?? null,
      gpa: typeof parsed.gpa === 'number' ? parsed.gpa : null,
      skills: Array.isArray(parsed.skills) ? parsed.skills : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
      profileCompleteness: parsed.profileCompleteness ?? 'LOW',
      missingCritical: Array.isArray(parsed.missingCritical) ? parsed.missingCritical : [],
      parserNotes: parsed.parserNotes ?? null
    }
  }
}
