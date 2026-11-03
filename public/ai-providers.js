// Shared by the browser form and server validation. Keys are never inferred.
export const PROVIDERS = {
  openai: { label: 'OpenAI', url: 'https://api.openai.com/v1', apiType: 'chat', placeholder: 'Your OpenAI model ID' },
  anthropic: { label: 'Anthropic (Claude)', url: 'https://api.anthropic.com/v1', apiType: 'anthropic', placeholder: 'Your Claude model ID' },
  gemini: { label: 'Google Gemini', url: 'https://generativelanguage.googleapis.com/v1beta', apiType: 'gemini', placeholder: 'Your Gemini model ID' },
  openrouter: { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1', apiType: 'chat', placeholder: 'provider/model-name' },
  groq: { label: 'Groq', url: 'https://api.groq.com/openai/v1', apiType: 'chat', placeholder: 'Your Groq model ID' },
  deepseek: { label: 'DeepSeek', url: 'https://api.deepseek.com/v1', apiType: 'chat', placeholder: 'Your DeepSeek model ID' },
  mistral: { label: 'Mistral', url: 'https://api.mistral.ai/v1', apiType: 'chat', placeholder: 'Your Mistral model ID' },
  xai: { label: 'xAI (Grok)', url: 'https://api.x.ai/v1', apiType: 'chat', placeholder: 'Your Grok model ID' },
  codex: { label: 'Codex-compatible gateway', url: '', apiType: 'responses', placeholder: 'Your gateway model ID' },
  custom: { label: 'Other provider / custom endpoint', url: '', apiType: 'chat', placeholder: 'Exact model ID from your provider' }
}

export function inferProvider(url) {
  const parsed = new URL(url)
  if (/\/backend-api\/codex(?:\/responses)?\/?$/.test(parsed.pathname)) return 'codex'
  return Object.keys(PROVIDERS).find(key => PROVIDERS[key].url && new URL(PROVIDERS[key].url).hostname === parsed.hostname) || 'custom'
}

export function normalizeConnection(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter your provider settings.')
  const provider = value.provider ?? inferProvider(value.url)
  if (!Object.hasOwn(PROVIDERS, provider)) throw new Error('Choose a supported provider or a custom endpoint.')
  const preset = PROVIDERS[provider]
  const url = new URL(value.url?.trim() || preset.url)
  if (url.username || url.password || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('Enter a valid HTTPS API URL. Localhost HTTP is also supported.')
  }
  if (typeof value.apiKey !== 'string' || !value.apiKey.trim() || /[\r\n]/.test(value.apiKey)) throw new Error('Enter the API key issued by your selected provider.')
  const apiType = value.apiType ?? preset.apiType
  if (!['chat', 'responses', 'anthropic', 'gemini'].includes(apiType)) throw new Error('Choose a supported API format.')
  if (provider !== 'custom' && apiType !== preset.apiType) throw new Error('The API format does not match this provider. Use a custom endpoint to override it.')
  // Preserve saved, pre-provider-selector Codex connections.
  if (value.model != null && typeof value.model !== 'string') throw new Error('Enter a valid model ID.')
  const legacyModel = !value.provider && provider === 'codex' ? 'gpt-6.1-sol' : ''
  const model = typeof value.model === 'string' ? value.model.trim() : legacyModel
  if (!model || model.length > 200 || /[\r\n]/.test(model)) throw new Error('Enter a model ID available from your provider.')
  return { provider, apiType, url: url.href.replace(/\/+$/, ''), apiKey: value.apiKey.trim(), model }
}
