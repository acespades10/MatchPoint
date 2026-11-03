import { AsyncLocalStorage } from 'node:async_hooks'
import { OJTScoutError } from '../errors/OJTScoutError.js'
import { normalizeConnection } from '../../public/ai-providers.js'

const connections = new AsyncLocalStorage()
export const DEFAULT_MODEL = 'gpt-4o-mini'

function responseError(code, message) {
  return Object.assign(new Error(message), { code })
}

export function parseConnection(raw) {
  if (!raw) return null
  try {
    return normalizeConnection(typeof raw === 'string' ? JSON.parse(raw) : raw)
  } catch {
    throw new OJTScoutError('INVALID_CONNECTION', 'Check your provider, API format, HTTPS URL, API key, and model ID. Localhost HTTP is also supported.')
  }
}

export function getDefaultConnection() {
  const provider = process.env.AI_PROVIDER || 'openai'
  const apiKey = process.env.AI_API_KEY || (provider === 'openai' ? process.env.OPENAI_API_KEY : undefined)
  if (!apiKey) return null
  return parseConnection({
    provider, apiKey, url: process.env.AI_BASE_URL || undefined,
    apiType: process.env.AI_API_TYPE || undefined,
    model: process.env.AI_MODEL || (provider === 'openai' ? DEFAULT_MODEL : undefined)
  })
}

export function withConnection(connection, callback) {
  return connections.run(connection, callback)
}

export function getConnection() {
  return connections.getStore()
}

function endpoint(base, suffix) {
  return base.endsWith(suffix) ? base : `${base}${suffix}`
}

async function requestJSON(url, headers, body) {
  const response = await fetch(url, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
    headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body)
  })
  if (!response.ok) throw Object.assign(new Error('AI provider request failed.'), { status: response.status })
  return response.json()
}

export async function providerResponse(connection, system, user) {
  if (connection.apiType === 'responses') return codexResponse(connection, system, user)
  let text
  if (connection.apiType === 'anthropic') {
    const result = await requestJSON(endpoint(connection.url, '/messages'), {
      'x-api-key': connection.apiKey, 'anthropic-version': '2023-06-01'
    }, { model: connection.model, max_tokens: 8192, system, messages: [{ role: 'user', content: user }] })
    if (!['end_turn', 'stop_sequence'].includes(result.stop_reason)) throw responseError('AI_RESPONSE_INCOMPLETE', 'Incomplete provider response.')
    text = result.content?.filter(part => part.type === 'text').map(part => part.text).join('')
  } else if (connection.apiType === 'gemini') {
    const base = connection.url.replace(/\/models\/[^/]+:generateContent$/, '')
    const model = connection.model.replace(/^models\//, '')
    const result = await requestJSON(`${base}/models/${encodeURIComponent(model)}:generateContent`, {
      'x-goog-api-key': connection.apiKey
    }, {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 8192 }
    })
    const candidate = result.candidates?.[0]
    if (candidate?.finishReason !== 'STOP') throw responseError('AI_RESPONSE_INCOMPLETE', 'Incomplete provider response.')
    text = candidate.content?.parts?.filter(part => !part.thought && typeof part.text === 'string').map(part => part.text).join('')
  } else {
    const result = await requestJSON(endpoint(connection.url, '/chat/completions'), {
      Authorization: `Bearer ${connection.apiKey}`,
      ...(connection.provider === 'openai' && process.env.OPENAI_ORG_ID ? { 'OpenAI-Organization': process.env.OPENAI_ORG_ID } : {})
    }, {
      model: connection.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
      // JSON is requested in the prompt; don't require optional JSON-mode or
      // temperature parameters that some compatible models reject.
    })
    const choice = result.choices?.[0]
    if (choice?.finish_reason && choice.finish_reason !== 'stop') throw responseError('AI_RESPONSE_INCOMPLETE', 'Incomplete provider response.')
    text = choice?.message?.content
  }
  if (typeof text !== 'string' || !text.trim()) throw responseError('AI_EMPTY_RESPONSE', 'Empty provider response.')
  return text
}

// Codex gateways expose Responses rather than Chat Completions.
export async function codexResponse(connection, system, user) {
  const endpoint = connection.url.endsWith('/responses') ? connection.url : `${connection.url}/responses`
  const response = await fetch(endpoint, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(120000),
    headers: { Authorization: `Bearer ${connection.apiKey}`, 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      model: connection.model, instructions: system,
      input: [{ role: 'user', content: [{ type: 'input_text', text: user }] }],
      store: false, stream: true
    })
  })
  if (!response.ok) {
    const error = new Error(`AI provider returned HTTP ${response.status}. Check your connection settings.`)
    error.status = response.status
    throw error
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    return responseText(await response.json())
  }
  let pending = ''
  let completed = null
  const streamedText = new Map()
  const decoder = new TextDecoder()
  function processEvent(event) {
    const data = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n')
    if (!data || data === '[DONE]') return
    const payload = JSON.parse(data)
    if (['error', 'response.failed', 'response.incomplete'].includes(payload.type)) {
      const error = responseError(payload.type === 'response.incomplete' ? 'AI_RESPONSE_INCOMPLETE' : 'AI_RESPONSE_FAILED', 'AI provider could not complete the response.')
      const detail = payload.error || payload.response?.error || payload
      const knownCodes = ['rate_limit_exceeded', 'usage_limit_reached', 'insufficient_quota', 'server_error', 'invalid_api_key', 'model_not_found', 'invalid_request_error', 'context_length_exceeded']
      error.providerCode = knownCodes.includes(detail.code) ? detail.code : undefined
      throw error
    }
    const partKey = `${payload.output_index ?? 0}:${payload.content_index ?? 0}`
    if (payload.type === 'response.output_text.delta' && typeof payload.delta === 'string') {
      streamedText.set(partKey, (streamedText.get(partKey) || '') + payload.delta)
    }
    if (payload.type === 'response.output_text.done' && typeof payload.text === 'string') {
      streamedText.set(partKey, payload.text)
    }
    if (payload.type === 'response.completed') completed = payload.response
  }
  for await (const chunk of response.body) {
    pending += decoder.decode(chunk, { stream: true })
    pending = pending.replace(/\r\n/g, '\n')
    let boundary
    while ((boundary = pending.indexOf('\n\n')) !== -1) {
      processEvent(pending.slice(0, boundary))
      pending = pending.slice(boundary + 2)
    }
  }
  pending += decoder.decode()
  if (pending.trim()) processEvent(pending)
  if (!completed) throw responseError('AI_STREAM_DISCONNECTED', 'AI provider disconnected before completing the response. Please try again.')
  // Some gateways omit output from the final packet; use streamed text only
  // after an explicit successful completion, never after a dropped connection.
  const fallbackText = [...streamedText.entries()]
    .sort(([a], [b]) => {
      const [ao, ac] = a.split(':').map(Number)
      const [bo, bc] = b.split(':').map(Number)
      return ao - bo || ac - bc
    }).map(([, text]) => text).join('')
  return responseText(completed, fallbackText)
}

function responseText(response, fallbackText = '') {
  if (response.status && response.status !== 'completed') throw responseError('AI_RESPONSE_INCOMPLETE', 'AI provider did not complete the response.')
  const text = response.output_text || response.output?.flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text).join('') || fallbackText
  if (!text) throw responseError('AI_EMPTY_RESPONSE', 'AI provider returned no text. Check the selected model.')
  return text
}
