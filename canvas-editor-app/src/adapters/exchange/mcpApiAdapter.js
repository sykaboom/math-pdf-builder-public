import { isPlainObject } from '../../contracts/docxDraftContract'

const asString = (value) => (typeof value === 'string' ? value : '')

const ensureEndpoint = (endpoint) => {
  const url = asString(endpoint).trim()
  if (!url) {
    throw new Error('Endpoint URL is required.')
  }
  return url
}

export const parseJsonInput = (rawText, label) => {
  const text = asString(rawText).trim()
  if (!text) {
    throw new Error(`${label} is required.`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${label} must be valid JSON. (${message})`)
  }
}

export const parseJsonObjectInput = (rawText, label) => {
  const parsed = parseJsonInput(rawText, label)
  if (!isPlainObject(parsed)) {
    throw new Error(`${label} must be a JSON object.`)
  }
  return parsed
}

const normalizeHeaders = (headers) => {
  if (!isPlainObject(headers)) {
    throw new Error('Headers JSON must be an object.')
  }

  return Object.entries(headers).reduce((acc, [rawKey, rawValue]) => {
    const key = asString(rawKey).trim()
    if (!key) return acc
    if (rawValue === undefined || rawValue === null) return acc
    acc[key] = String(rawValue)
    return acc
  }, {})
}

const parseResponseJson = async (response, label) => {
  const text = await response.text()
  if (!text.trim()) return {}
  try {
    return JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${label} must return JSON. (${message})`)
  }
}

const parseEmbeddedToolResult = (responseJson) => {
  const contentList = responseJson?.result?.content
  if (!Array.isArray(contentList)) return null

  for (const content of contentList) {
    const text = asString(content?.text).trim()
    if (!text) continue
    try {
      const parsed = JSON.parse(text)
      if (isPlainObject(parsed)) return parsed
    } catch {
      // Ignore non-JSON text chunks.
    }
  }
  return null
}

export const extractToolResultCandidate = (responseJson) => {
  const embedded = parseEmbeddedToolResult(responseJson)
  const candidates = [
    responseJson?.result?.toolResult,
    responseJson?.toolResult,
    responseJson?.payload?.toolResult,
    responseJson?.payload,
    responseJson?.result?.payload,
    embedded,
    responseJson?.result,
    responseJson,
  ]

  for (const candidate of candidates) {
    if (isPlainObject(candidate)) return candidate
  }

  throw new Error('Response did not include a JSON object candidate for ToolResult.')
}

const resolveErrorMessage = (responseJson, fallbackMessage) => {
  const messageCandidates = [
    responseJson?.error?.message,
    responseJson?.message,
    responseJson?.result?.message,
  ]
  for (const candidate of messageCandidates) {
    const text = asString(candidate).trim()
    if (text) return text
  }
  return fallbackMessage
}

export const invokeMcpToolCall = async ({ endpoint, toolName, toolArgs = {}, headers = {} }) => {
  const url = ensureEndpoint(endpoint)
  const name = asString(toolName).trim()
  if (!name) {
    throw new Error('MCP tool name is required.')
  }
  if (!isPlainObject(toolArgs)) {
    throw new Error('MCP tool args must be a JSON object.')
  }

  const normalizedHeaders = normalizeHeaders(headers)
  const requestBody = {
    jsonrpc: '2.0',
    id: `mcp-${Date.now()}`,
    method: 'tools/call',
    params: {
      name,
      arguments: toolArgs,
    },
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...normalizedHeaders,
    },
    body: JSON.stringify(requestBody),
  })

  const responseJson = await parseResponseJson(response, 'MCP endpoint')
  if (!response.ok) {
    const reason = resolveErrorMessage(responseJson, `HTTP ${response.status}`)
    throw new Error(`MCP request failed: ${reason}`)
  }

  return {
    status: response.status,
    requestBody,
    responseJson,
    toolResult: extractToolResultCandidate(responseJson),
  }
}

export const invokeApiEndpoint = async ({
  endpoint,
  method = 'POST',
  body,
  headers = {},
}) => {
  const url = ensureEndpoint(endpoint)
  const httpMethod = asString(method).trim().toUpperCase() || 'POST'
  const normalizedHeaders = normalizeHeaders(headers)
  const canHaveBody = httpMethod !== 'GET' && httpMethod !== 'HEAD'
  const hasBody = canHaveBody && body !== undefined

  const response = await fetch(url, {
    method: httpMethod,
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...normalizedHeaders,
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  })

  const responseJson = await parseResponseJson(response, 'API endpoint')
  if (!response.ok) {
    const reason = resolveErrorMessage(responseJson, `HTTP ${response.status}`)
    throw new Error(`API request failed: ${reason}`)
  }

  return {
    status: response.status,
    responseJson,
    toolResult: extractToolResultCandidate(responseJson),
  }
}
