// ─── OJT Scout — Pipeline (orchestrator) ─────────────────────────
// Runs the registered phases in sequence against a shared session.
// Polymorphism: it calls execute() without knowing which phase it is.
// A phase failure degrades gracefully — it does NOT kill later phases,
// EXCEPT typed errors meant to halt the run (e.g. ProfileIncompleteError)
// which are re-thrown so the API layer can return a structured response.

import { PipelineSession } from './PipelineSession.js'
import { PipelineLogger } from '../monitoring/PipelineLogger.js'
import { OJTScoutError } from '../errors/OJTScoutError.js'
import { Phase1_Intake } from './phases/Phase1_Intake.js'
import { Phase2_PreScreen } from './phases/Phase2_PreScreen.js'
import { Phase3_Relevance } from './phases/Phase3_Relevance.js'
import { Phase4_Scoring } from './phases/Phase4_Scoring.js'

export class Pipeline {
  #phases

  constructor(
    phases = [
      new Phase1_Intake(),
      new Phase2_PreScreen(),
      new Phase3_Relevance(),
      new Phase4_Scoring()
    ]
  ) {
    // Phases 5-7 are appended here as they are built.
    this.#phases = phases
  }

  // Run all phases. `input` is seeded onto the session (resume buffer, prefs).
  async run(input = {}, session = new PipelineSession()) {
    const logger = new PipelineLogger(session.id)
    session.setInput(input)

    for (const phase of this.#phases) {
      try {
        await phase.execute(session, logger)
      } catch (err) {
        logger.error(phase.name, err)
        // Typed, halting errors bubble up so the route can map them.
        if (err instanceof OJTScoutError) {
          throw err
        }
        // Unexpected errors: degrade and continue to the next phase.
        await phase.handleFailure(session, err, logger)
      }
    }

    return { session, logger, summary: session.getSummary(), logSummary: logger.getSummary() }
  }
}
