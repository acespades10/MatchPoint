import test from 'node:test'
import assert from 'node:assert/strict'
import { companyContacts } from '../../src/data/companyContacts.js'
import { BilateralScorer } from '../../src/scorers/BilateralScorer.js'

test('contacts preserve partial records and distinguish a source phone from a name', () => {
  const contacts = companyContacts({ poc1Name: ' Hiring Team ', poc1Email: ' jobs@example.com ', poc2Name: '(+63) 919 322 0652', poc2Position: 'HR/Admin Manager' })
  assert.deepEqual(contacts, [
    { name: 'Hiring Team', position: null, email: 'jobs@example.com', phone: null },
    { name: null, position: 'HR/Admin Manager', email: null, phone: '(+63) 919 322 0652' }
  ])
  assert.deepEqual(companyContacts({ poc1Name: ' ', poc2Email: null }), [])
})

test('ranked and reranked results retain each company’s own contacts', () => {
  const companies = [
    { id: 'one', name: 'One', poc1Name: 'First contact', poc1Email: 'one@example.com' },
    { id: 'two', name: 'Two', poc2Name: 'Second contact', poc2Email: 'two@example.com' }
  ]
  const scorer = new BilateralScorer()
  for (const setup of ['hybrid', 'remote']) {
    const results = scorer.scoreAll({ course: 'BS Computer Science', skills: [], preferences: { setup } }, companies.map(c => ({ ...c, industry: 'Software' })))
    assert.equal(results.find(item => item.id === 'one').contacts[0].email, 'one@example.com')
    assert.equal(results.find(item => item.id === 'two').contacts[0].email, 'two@example.com')
  }
})
