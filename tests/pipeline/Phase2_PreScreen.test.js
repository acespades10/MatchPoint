import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Phase2_PreScreen } from '../../src/pipeline/phases/Phase2_PreScreen.js'
import { PipelineSession } from '../../src/pipeline/PipelineSession.js'
import { PipelineLogger } from '../../src/monitoring/PipelineLogger.js'
import { CompanyIndex } from '../../src/data/CompanyIndex.js'

const profile = {
  yearLevel: '4th',
  course: 'BS Computer Science',
  preferences: { minAllowance: 500, setup: 'hybrid' }
}

function seedIndex(companies) {
  CompanyIndex.getInstance().init(companies)
}

test('Phase2: HARD RULE — tokens = 0 for the phase', async () => {
  seedIndex([
    { id: 'a', moaStatus: 'Active', availableSlots: 5, acceptedCourses: [], allowance: null, setup: null }
  ])
  const session = new PipelineSession().setProfile(profile)
  const logger = new PipelineLogger('test-run')

  await new Phase2_PreScreen().execute(session, logger)

  const summary = logger.getSummary()
  assert.equal(summary.tokenUsage.total, 0)
  assert.equal(summary.tokenUsage.byPhase['Pre-Screen Filter'], 0)
  assert.equal(summary.estimatedCost, '0.0000')
})

test('Phase2: happy path — eligible company survives, ids stored on session', async () => {
  seedIndex([
    { id: 'keep', moaStatus: 'Active', availableSlots: 5, acceptedCourses: [], allowance: null, setup: null },
    { id: 'drop', moaStatus: 'Expired', availableSlots: 5, acceptedCourses: [] }
  ])
  const session = new PipelineSession().setProfile(profile)
  const report = await new Phase2_PreScreen().execute(session, null)

  assert.deepEqual(session.getFilteredIds(), ['keep'])
  assert.equal(report.totalIn, 2)
  assert.equal(report.totalOut, 1)
  assert.equal(report.steps.length, 6)
  assert.equal(report.noMatch, null)
})

test('Phase2: no survivors ⇒ NoMatchHandler.level1() populates report', async () => {
  seedIndex([
    { id: 'x', moaStatus: 'Active', availableSlots: 0, acceptedCourses: [] }
  ])
  const session = new PipelineSession().setProfile(profile)
  const report = await new Phase2_PreScreen().execute(session, null)

  assert.equal(report.totalOut, 0)
  assert.equal(session.getFilteredIds().length, 0)
  assert.ok(report.noMatch)
  assert.equal(report.noMatch.level, 1)
  assert.ok(Array.isArray(report.noMatch.relaxations))
  assert.equal(report.noMatch.relaxations[0].relaxation, 'SlotAvailabilityFilter')
})
