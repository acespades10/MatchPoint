import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import startRouter from '../../api/pipeline/start.js'
import { CompanyIndex } from '../../src/data/CompanyIndex.js'

test('initial matching applies chosen preferences and active-only before returning scores', async () => {
  const base = { industry: 'Software & Computer Services', moaStatus: 'Active', availableSlots: 5, acceptedCourses: [], city: 'Makati' }
  CompanyIndex.getInstance().init([
    { ...base, id: 'keep', name: 'Remote active', setup: 'remote', allowance: 800, hasActiveInterns: true },
    { ...base, id: 'inactive', name: 'Remote inactive', setup: 'remote', allowance: 800, hasActiveInterns: false },
    { ...base, id: 'onsite', name: 'Onsite active', setup: 'onsite', allowance: 800, hasActiveInterns: true },
    { ...base, id: 'low', name: 'Low allowance', setup: 'remote', allowance: 100, hasActiveInterns: true }
  ])
  const app = express()
  app.use(express.json())
  app.use('/api/pipeline', startRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  try {
    const preferences = { setup: 'remote', minAllowance: 700, homeLocation: 'Makati' }
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pipeline/start?mock=true`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preferences, activeOnly: true })
    })
    assert.equal(response.status, 200)
    const result = await response.json()
    for (const [key, value] of Object.entries(preferences)) assert.equal(result.profile.preferences[key], value)
    assert.equal(result.preScreen.totalOut, 2)
    assert.deepEqual(result.scores.map(company => company.id), ['keep'])
    assert.equal(result.tokenUsage.total, 0)
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
