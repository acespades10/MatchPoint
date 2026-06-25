import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Phase3_Relevance } from '../../src/pipeline/phases/Phase3_Relevance.js'
import { PipelineSession } from '../../src/pipeline/PipelineSession.js'
import { PipelineLogger } from '../../src/monitoring/PipelineLogger.js'
import { CompanyIndex } from '../../src/data/CompanyIndex.js'
import { classifyIndustry } from '../../constants/COURSE_MAP.js'

const profile = { course: 'BS Computer Science', skills: [] }

test('classifyIndustry: keyword tiers for CS/IT', () => {
  assert.equal(classifyIndustry('Software & Computer Services'), 'direct')
  assert.equal(classifyIndustry('IT Company'), 'direct')
  assert.equal(classifyIndustry('Banks/Financial Services'), 'adjacent')
  assert.equal(classifyIndustry('Manufacturing'), 'stretch')
  assert.equal(classifyIndustry('Construction and Materials'), 'irrelevant')
  assert.equal(classifyIndustry('Physical Therapy'), 'irrelevant')
})

test('classifyIndustry: " it " behaves like a word boundary', () => {
  assert.equal(classifyIndustry('IT Services'), 'direct')
  assert.equal(classifyIndustry('Credit Cooperative'), 'irrelevant') // not "IT"
})

test('Phase3: keeps direct + adjacent, drops stretch + irrelevant, 0 tokens', async () => {
  CompanyIndex.getInstance().init([
    { id: 'd', industry: 'Software Development', hasActiveInterns: false },
    { id: 'a', industry: 'BPO', hasActiveInterns: false },
    { id: 's', industry: 'Manufacturing', hasActiveInterns: false },
    { id: 'x', industry: 'Construction', hasActiveInterns: false }
  ])
  const session = new PipelineSession().setProfile(profile)
  session.setFilteredIds(['d', 'a', 's', 'x'])
  const logger = new PipelineLogger('t3')

  const report = await new Phase3_Relevance().execute(session, logger)

  assert.deepEqual(session.getFilteredIds().sort(), ['a', 'd'])
  assert.equal(report.totalOut, 2)
  assert.equal(logger.getSummary().tokenUsage.total, 0)
})

test('Phase3: active-intern companies sort first within a tier', async () => {
  CompanyIndex.getInstance().init([
    { id: 'cold', industry: 'Software', hasActiveInterns: false },
    { id: 'hot', industry: 'Software', hasActiveInterns: true }
  ])
  const session = new PipelineSession().setProfile(profile)
  session.setFilteredIds(['cold', 'hot'])

  await new Phase3_Relevance().execute(session, null)
  assert.deepEqual(session.getFilteredIds(), ['hot', 'cold'])
})
