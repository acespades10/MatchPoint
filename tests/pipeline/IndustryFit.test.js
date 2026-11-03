import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { assessIndustryFit, classifyIndustry, resolveProfileKey, resumeFields } from '../../constants/COURSE_MAP.js'
import { collectIndustrySources, attachIndustrySources } from '../../src/data/industrySources.js'
import { BilateralScorer } from '../../src/scorers/BilateralScorer.js'
import { Phase3_Relevance } from '../../src/pipeline/phases/Phase3_Relevance.js'
import { PipelineSession } from '../../src/pipeline/PipelineSession.js'
import { SessionStore } from '../../src/pipeline/SessionStore.js'
import { CompanyIndex } from '../../src/data/CompanyIndex.js'
import resultsRouter from '../../api/pipeline/results.js'

const cs = { course: 'BS Computer Science', skills: [{ skill: 'Python' }], preferences: {} }
const company = (id, industry, active = false) => ({ id, name: id, industry, hasActiveInterns: active, enriched: { techStack: [] } })

test('course mapping supports non-IT fields and never defaults an unknown course to IT', () => {
  for (const [course, industry] of [
    ['BS Accountancy', 'Accounting and Audit'], ['BS Civil Engineering', 'Construction'],
    ['BS Electrical Engineering', 'Electrical and Electronics'], ['BS Mechanical Engineering', 'Manufacturing'],
    ['BS Hospitality Management', 'Hotels'], ['Bachelor of Education', 'Schools'],
    ['BS Nursing', 'Healthcare'], ['BA Communication', 'Media']
  ]) assert.equal(classifyIndustry(industry, course), 'direct', course)
  assert.equal(classifyIndustry('Software', 'BS Nursing'), 'irrelevant')
  assert.equal(resolveProfileKey('Literature'), null)
  assert.equal(classifyIndustry('Software'), 'unknown')
  assert.equal(classifyIndustry('Medical Technology', cs.course), 'irrelevant')
})

test('skills and experience identify a field with two distinct signals; employer names do not', () => {
  const student = { skills: [{ skill: 'Python' }], experience: [{ description: 'Built a SQL database' }] }
  assert.equal(assessIndustryFit(student, company('s', 'Software')).tier, 'direct')
  assert.deepEqual(resumeFields(student)[0].evidence, ['python', 'sql'])
  assert.equal(assessIndustryFit({ skills: [{ skill: 'Python' }] }, company('s', 'Software')).tier, 'unknown')
  assert.equal(resumeFields({ experience: [{ organization: 'Python SQL Corporation' }] }).length, 0)
  assert.equal(resumeFields({ skills: [{ skill: 'JavaScript' }] }).length, 0, 'Java is not a substring match')
})

test('unrelated industries stay excluded despite active status and guessed IT enrichment', () => {
  const construction = { ...company('x', 'Construction', true), enriched: { confidence: 'LOW', techStack: ['Python'], internTasks: ['Software development'] } }
  assert.equal(assessIndustryFit(cs, construction).tier, 'irrelevant')
  assert.deepEqual(new BilateralScorer().scoreAll(cs, [construction]), [])
})

test('conflicting source suitability requires verification; equivalent labels retain fit', () => {
  const conflict = { ...company('x', 'Software & Computer Services'), industrySources: [{ industry: 'Construction (Electrical and Electronics)' }] }
  assert.equal(assessIndustryFit(cs, conflict).tier, 'unknown')
  assert.equal(assessIndustryFit(cs, conflict).conflict, true)
  assert.deepEqual(new BilateralScorer().scoreAll(cs, [conflict]), [])
  conflict.industrySources = [{ industry: 'Software and Computer Services' }]
  assert.equal(assessIndustryFit(cs, conflict).tier, 'direct')
  assert.equal(assessIndustryFit(cs, company('empty', null)).tier, 'unknown')
})

test('industry source reconciliation preserves existing enrichment and row provenance', () => {
  const records = [{ ...company('x', 'Software'), name: 'Example, Inc.' }]
  const before = structuredClone(records)
  const sources = collectIndustrySources([{ name: 'Active', rows: [[], [], [], [null, 'Example Inc', 'Construction']] }])
  attachIndustrySources(records, sources)
  assert.deepEqual(records[0].industrySources, [{ sheet: 'Active', row: 4, industry: 'Construction' }])
  const { industrySources, ...rest } = records[0]
  assert.deepEqual(rest, before[0])
})

test('Phase 3 reports unrecognized résumé fields without assuming Computer Science', async () => {
  CompanyIndex.getInstance().init([company('s', 'Software')])
  const session = new PipelineSession().setProfile({ course: 'Literature', skills: [] })
  session.setFilteredIds(['s'])
  const report = await new Phase3_Relevance().execute(session)
  assert.equal(report.totalOut, 0)
  assert.equal(report.dropped.unknown, 1)
  assert.match(report.noMatch.reason, /specific skills/)
})

test('direct industries rank before adjacent; active partners lead within each tier', () => {
  const records = [company('adjacent-active', 'Banking', true), company('direct-inactive', 'Software'), company('direct-active', 'Software', true)]
  assert.deepEqual(new BilateralScorer().scoreAll(cs, records).map(c => c.id), ['direct-active', 'direct-inactive', 'adjacent-active'])
})

test('re-ranking preserves the industry gate and explanations even for stale candidate IDs', async () => {
  const records = [company('unrelated', 'Construction', true), company('adjacent', 'Banking', true), company('direct', 'Software')]
  CompanyIndex.getInstance().init(records)
  const session = new PipelineSession().setProfile(cs)
  session.setFilteredIds(records.map(c => c.id))
  SessionStore.getInstance().save(session)
  const app = express()
  app.use(express.json())
  app.use(resultsRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/rerank/${session.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: { setup: 'remote' } }) })
    assert.equal(response.status, 200)
    const result = await response.json()
    assert.deepEqual(result.scores.map(c => c.id), ['direct', 'adjacent'])
    assert.match(result.scores[0].industryFit.reason, /Software & IT/)
    assert.equal(result.tokens, 0)
  } finally { await new Promise(resolve => server.close(resolve)) }
})
