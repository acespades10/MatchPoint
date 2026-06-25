// ─── OJT Scout — BasePhase (abstract) ────────────────────────────
// Abstraction pillar: contract every pipeline phase implements.
// The Pipeline orchestrator calls execute() polymorphically and uses
// handleFailure() to degrade gracefully without killing later phases.

export class BasePhase {
  // Subclasses MUST override.
  get name() {
    throw new Error('Subclass must define get name()')
  }

  // Subclasses MUST implement — performs the phase against shared session state.
  async execute(session, logger) {
    throw new Error('Subclass must implement execute(session, logger)')
  }

  // Default failure behavior — record and continue. Override per phase if a
  // phase needs a specific fallback.
  async handleFailure(session, err, logger) {
    session.log({ phase: this.name, error: err.message, action: 'degraded' })
    logger?.error(this.name, err)
  }
}
