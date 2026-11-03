import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { parseConnection, withConnection, getConnection, codexResponse } from '../../src/core/AIConnection.js'
import { BasePrompt } from '../../src/core/BasePrompt.js'

class Prompt extends BasePrompt {
  buildSystemPrompt() { return 'Return JSON.' }
  buildUserPrompt(input) { return input }
  parseResponse(raw) { return JSON.parse(raw) }
}

test('Codex stream text survives an empty completion packet without duplication', async (t) => {
  const server = http.createServer((req, res) => {
    req.resume()
    res.setHeader('Content-Type', 'text/event-stream')
    const events = [
      { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: '{"ok":' },
      { type: 'response.output_text.delta', output_index: 0, content_index: 0, delta: 'true}' },
      { type: 'response.output_text.done', output_index: 0, content_index: 0, text: '{"ok":true}' },
      { type: 'response.completed', response: { status: 'completed', output: [] } }
    ]
    res.end(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join(''))
  }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const result = await codexResponse({ url: `http://127.0.0.1:${server.address().port}`, apiKey: 'test', model: 'test' }, 'Return JSON', 'Test')
  assert.deepEqual(JSON.parse(result), { ok: true })
})

test('connection validation rejects unsafe URLs and incomplete settings', () => {
  for (const url of ['http://example.com', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com?key=secret', 'https://example.com/#secret']) {
    assert.throws(() => parseConnection({ url, apiKey: 'test', model: 'test-model' }), { code: 'INVALID_CONNECTION' })
  }
  assert.throws(() => parseConnection('{'), { code: 'INVALID_CONNECTION' })
  assert.throws(() => parseConnection({ url: 'https://example.com', apiKey: '', model: '' }), { code: 'INVALID_CONNECTION' })
  assert.equal(parseConnection({ url: 'https://example.com/v1/', apiKey: ' test ', model: ' test-model ' }).url, 'https://example.com/v1')
  assert.equal(parseConnection(null), null)
})

test('request-scoped credentials route chat and streamed Codex calls without cross-talk', async (t) => {
  const requests = []
  const server = http.createServer(async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ path: req.url, key: req.headers.authorization, body: JSON.parse(body) })
    if (req.url === '/v1/chat/completions') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ choices: [{ message: { content: '{"route":"chat"}' } }] }))
    } else {
      res.setHeader('Content-Type', 'text/event-stream')
      const event = `data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', output: [{ content: [{ type: 'output_text', text: '{"route":"codex"}' }] }] } })}\n\n`
      res.write(event.slice(0, 30))
      setTimeout(() => res.end(event.slice(30)), 10)
    }
  }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const base = `http://127.0.0.1:${server.address().port}`
  const chat = parseConnection({ url: `${base}/v1`, apiKey: 'chat-test-key', model: 'chat-model' })
  const codex = parseConnection({ url: `${base}/backend-api/codex`, apiKey: 'codex-test-key' })
  const results = await Promise.all([
    withConnection(chat, () => new Prompt().run('chat input')),
    withConnection(codex, () => new Prompt().run('codex input'))
  ])
  assert.deepEqual(results, [{ route: 'chat' }, { route: 'codex' }])
  const chatRequest = requests.find(req => req.path === '/v1/chat/completions')
  const codexRequest = requests.find(req => req.path === '/backend-api/codex/responses')
  assert.equal(chatRequest.key, 'Bearer chat-test-key')
  assert.equal(chatRequest.body.model, 'chat-model')
  assert.equal(codexRequest.key, 'Bearer codex-test-key')
  assert.equal(codexRequest.body.model, 'gpt-6.1-sol')
  assert.equal(codexRequest.body.store, false)
  assert.equal(codexRequest.body.stream, true)
  assert.equal(getConnection(), undefined)
})

test('provider errors and incomplete streams fail without leaking response bodies', async (t) => {
  const server = http.createServer((req, res) => {
    req.resume()
    if (req.url.startsWith('/incomplete')) {
      res.setHeader('Content-Type', 'text/event-stream')
      res.end('data: {"type":"response.output_text.delta","delta":"partial"}\n\n')
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'secret-test-key resume text' } }))
    }
  }).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  const base = `http://127.0.0.1:${server.address().port}`
  for (const path of ['/v1', '/backend-api/codex', '/incomplete/backend-api/codex']) {
    await assert.rejects(withConnection(parseConnection({ url: base + path, apiKey: 'secret-test-key', model: 'test-model' }), () => new Prompt().run('resume text')), err => {
      assert.equal(err.code, 'API_ERROR')
      assert.doesNotMatch(JSON.stringify(err), /secret-test-key|resume text/)
      return true
    })
  }
})
