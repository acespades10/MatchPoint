import test from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { parseConnection, withConnection, getDefaultConnection } from '../../src/core/AIConnection.js'
import { BasePrompt } from '../../src/core/BasePrompt.js'
import { ResumeParserPrompt } from '../../src/prompts/factual/ResumeParserPrompt.js'
import { PROVIDERS, normalizeConnection } from '../../public/ai-providers.js'

class Prompt extends BasePrompt {
  buildSystemPrompt() { return 'Return JSON.' }
  buildUserPrompt() { return 'Sample résumé' }
  parseResponse(raw) { return JSON.parse(raw) }
}

async function fixture(t, handler) {
  const server = http.createServer(handler).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close() })
  return `http://127.0.0.1:${server.address().port}`
}

test('each provider keeps its model and format; custom providers require an explicit model', () => {
  for (const [provider, preset] of Object.entries(PROVIDERS)) {
    const result = normalizeConnection({ provider, url: preset.url || 'https://example.com/v1', apiKey: 'any-provider-key', model: 'my-model' })
    assert.equal(result.apiType, preset.apiType)
    assert.equal(result.model, 'my-model')
  }
  for (const overrides of [{ model: '' }, { model: 42 }, { apiType: 'unknown' }, { provider: 'unknown' }, { provider: 'anthropic', apiType: 'chat' }]) {
    assert.throws(() => parseConnection({ provider: 'custom', url: 'https://example.com', apiKey: 'test', model: 'model', ...overrides }), { code: 'INVALID_CONNECTION' })
  }
  assert.equal(parseConnection({ url: 'https://example.com/backend-api/codex', apiKey: 'legacy' }).model, 'gpt-6.1-sol')
})

test('native and compatible requests preserve provider-specific bodies, keys, and models concurrently', async t => {
  const requests = []
  const base = await fixture(t, async (req, res) => {
    let body = ''
    for await (const chunk of req) body += chunk
    requests.push({ path: req.url, headers: req.headers, body: JSON.parse(body) })
    res.setHeader('Content-Type', 'application/json')
    if (req.url.endsWith('/messages')) res.end(JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text: '{"provider":"anthropic"}' }] }))
    else if (req.url.includes(':generateContent')) res.end(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'internal' }, { text: '{"provider":"gemini"}' }] } }] }))
    else if (req.url.endsWith('/responses')) res.end(JSON.stringify({ status: 'completed', output_text: '{"provider":"responses"}' }))
    else res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"provider":"chat"}' } }] }))
  })
  const types = ['anthropic', 'gemini', 'chat', 'responses']
  const results = await Promise.all(types.map(apiType => withConnection(parseConnection({
    provider: 'custom', apiType, url: `${base}/${apiType}`, apiKey: `${apiType}-key`, model: `${apiType}-model`
  }), () => new Prompt().run())))
  assert.deepEqual(results, types.map(provider => ({ provider })))
  const anthropic = requests.find(r => r.path.endsWith('/messages'))
  assert.equal(anthropic.headers['x-api-key'], 'anthropic-key')
  assert.equal(anthropic.headers.authorization, undefined)
  assert.equal(anthropic.headers['anthropic-version'], '2023-06-01')
  assert.equal(anthropic.body.system, 'Return JSON.')
  assert.equal(anthropic.body.model, 'anthropic-model')
  const gemini = requests.find(r => r.path.includes(':generateContent'))
  assert.equal(gemini.path, '/gemini/models/gemini-model:generateContent')
  assert.equal(gemini.headers['x-goog-api-key'], 'gemini-key')
  assert.equal(gemini.headers.authorization, undefined)
  assert.equal(gemini.body.systemInstruction.parts[0].text, 'Return JSON.')
  assert.equal(gemini.body.generationConfig.responseMimeType, 'application/json')
  const chat = requests.find(r => r.path.endsWith('/chat/completions'))
  assert.equal(chat.headers.authorization, 'Bearer chat-key')
  assert.equal(chat.body.model, 'chat-model')
  assert.equal(chat.body.response_format, undefined)
  assert.equal(chat.body.temperature, undefined)
  const responses = requests.find(r => r.path.endsWith('/responses'))
  assert.equal(responses.headers.authorization, 'Bearer responses-key')
  assert.equal(responses.body.model, 'responses-model')
})

test('full endpoint URLs are not appended twice', async t => {
  const paths = []
  const base = await fixture(t, (req, res) => {
    req.resume(); paths.push(req.url)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ choices: [{ message: { content: '{}' } }] }))
  })
  await withConnection(parseConnection({ provider: 'custom', url: `${base}/v1/chat/completions`, apiKey: 'test', model: 'test' }), () => new Prompt().run())
  assert.deepEqual(paths, ['/v1/chat/completions'])
})

test('blocked, truncated, empty, and redirected responses fail without exposing provider data', async t => {
  let redirected = false
  const base = await fixture(t, (req, res) => {
    req.resume()
    if (req.url.startsWith('/redirect/')) { res.writeHead(307, { Location: '/leaked' }); return res.end() }
    if (req.url === '/leaked') redirected = true
    res.setHeader('Content-Type', 'application/json')
    if (req.url.startsWith('/anthropic/')) return res.end(JSON.stringify({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'sensitive-partial' }] }))
    if (req.url.startsWith('/gemini/')) return res.end(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }))
    if (req.url.startsWith('/empty/')) return res.end(JSON.stringify({ choices: [] }))
    res.writeHead(401)
    res.end(JSON.stringify({ error: { message: 'private-key sensitive-resume' } }))
  })
  for (const [path, apiType] of [['anthropic', 'anthropic'], ['gemini', 'gemini'], ['empty', 'chat'], ['error', 'anthropic'], ['error', 'gemini'], ['redirect', 'chat']]) {
    await assert.rejects(withConnection(parseConnection({ provider: 'custom', apiType, url: `${base}/${path}`, apiKey: 'private-key', model: 'test' }), () => new Prompt().run()), err => {
      assert.equal(err.code, 'API_ERROR')
      assert.doesNotMatch(JSON.stringify(err), /private-key|sensitive-/)
      return true
    })
  }
  assert.equal(redirected, false)
})

test('server environment supports non-OpenAI providers and legacy OpenAI settings', () => {
  const keys = ['AI_PROVIDER', 'AI_API_KEY', 'AI_MODEL', 'AI_BASE_URL', 'AI_API_TYPE', 'OPENAI_API_KEY']
  const original = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    keys.forEach(key => delete process.env[key])
    assert.equal(getDefaultConnection(), null)
    process.env.OPENAI_API_KEY = 'legacy-key'
    assert.equal(getDefaultConnection().provider, 'openai')
    process.env.AI_PROVIDER = 'gemini'
    assert.equal(getDefaultConnection(), null, 'Never send a legacy OpenAI key to a different provider')
    process.env.AI_API_KEY = 'google-key'
    process.env.AI_MODEL = 'google-model'
    assert.equal(getDefaultConnection().apiType, 'gemini')
    assert.equal(getDefaultConnection().apiKey, 'google-key')
    assert.equal(getDefaultConnection().model, 'google-model')
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})

test('resume parser accepts fenced JSON from providers and safely rejects non-object JSON', () => {
  const prompt = new ResumeParserPrompt()
  assert.equal(prompt.parseResponse('```json\n{"name":"Sample Student"}\n```').name, 'Sample Student')
  for (const raw of ['null', '[]', '42', 'bad json']) assert.equal(prompt.parseResponse(raw).profileCompleteness, 'LOW')
})
