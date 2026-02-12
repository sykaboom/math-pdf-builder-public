import { useMemo, useState } from 'react'
import {
  docxDraftToNormalizedContent,
  invokeApiEndpoint,
  invokeMcpToolCall,
  normalizedContentToDocxDraft,
  normalizedContentToV10Draft,
  parseJsonInput,
  parseJsonObjectInput,
  toolResultToNormalizedContent,
} from '../../adapters/exchange'
import { SAMPLE_TOOL_RESULT } from './sampleToolResult'

const stableStringify = (value) => {
  const seen = new WeakSet()

  const sortValue = (input) => {
    if (Array.isArray(input)) return input.map(sortValue)
    if (input && typeof input === 'object') {
      if (seen.has(input)) return null
      seen.add(input)
      return Object.keys(input)
        .sort()
        .reduce((acc, key) => {
          acc[key] = sortValue(input[key])
          return acc
        }, {})
    }
    return input
  }

  return JSON.stringify(sortValue(value), null, 2)
}

const countMismatchLines = (left, right) => {
  const leftLines = String(left).split('\n')
  const rightLines = String(right).split('\n')
  const maxLength = Math.max(leftLines.length, rightLines.length)
  let mismatchCount = 0
  for (let index = 0; index < maxLength; index += 1) {
    if (leftLines[index] !== rightLines[index]) mismatchCount += 1
  }
  return mismatchCount
}

const downloadJson = (filename, value) => {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

const parseOptionalJson = (rawInput, label) => {
  const text = String(rawInput ?? '').trim()
  if (!text) return undefined
  return parseJsonInput(text, label)
}

const runExchangeConversion = (toolResultCandidate) => {
  const normalized = toolResultToNormalizedContent(toolResultCandidate)
  const docxDraft = normalizedContentToDocxDraft(normalized)
  const v10Draft = normalizedContentToV10Draft(normalized)
  const normalizedRoundtrip = docxDraftToNormalizedContent(docxDraft)

  const normalizedText = stableStringify(normalized)
  const roundtripText = stableStringify(normalizedRoundtrip)
  const roundtripMismatchLines = countMismatchLines(normalizedText, roundtripText)

  return {
    normalized,
    docxDraft,
    v10Draft,
    normalizedRoundtrip,
    normalizedText,
    roundtripText,
    roundtripMismatchLines,
  }
}

export function ExchangePlayground() {
  const [rawInput, setRawInput] = useState(JSON.stringify(SAMPLE_TOOL_RESULT, null, 2))
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const [remoteMode, setRemoteMode] = useState('mcp')
  const [remoteEndpoint, setRemoteEndpoint] = useState('')
  const [remoteHeadersInput, setRemoteHeadersInput] = useState('{}')
  const [mcpToolName, setMcpToolName] = useState('generate_content')
  const [mcpToolArgsInput, setMcpToolArgsInput] = useState('{}')
  const [apiMethod, setApiMethod] = useState('POST')
  const [apiBodyInput, setApiBodyInput] = useState('')
  const [remoteStatus, setRemoteStatus] = useState('')
  const [remoteError, setRemoteError] = useState('')
  const [remoteLoading, setRemoteLoading] = useState(false)

  const summary = useMemo(() => {
    if (!result) return null
    return {
      blocks: Array.isArray(result.normalized.blocks) ? result.normalized.blocks.length : 0,
      images: Array.isArray(result.normalized.assets?.images) ? result.normalized.assets.images.length : 0,
      roundtripMismatchLines: result.roundtripMismatchLines,
    }
  }, [result])

  const handleUseSample = () => {
    setRawInput(JSON.stringify(SAMPLE_TOOL_RESULT, null, 2))
    setError('')
    setResult(null)
  }

  const handleRun = () => {
    try {
      const parsed = JSON.parse(rawInput)
      setResult(runExchangeConversion(parsed))
      setError('')
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError)
      setError(message)
      setResult(null)
    }
  }

  const handleInvokeRemote = async () => {
    try {
      setRemoteLoading(true)
      setRemoteError('')
      setRemoteStatus('')

      const headers = parseOptionalJson(remoteHeadersInput, 'Headers JSON')
      const normalizedHeaders = headers === undefined ? {} : parseJsonObjectInput(JSON.stringify(headers), 'Headers JSON')

      let invokeResult
      if (remoteMode === 'mcp') {
        const toolArgs = parseOptionalJson(mcpToolArgsInput, 'MCP tool args JSON')
        const normalizedArgs =
          toolArgs === undefined ? {} : parseJsonObjectInput(JSON.stringify(toolArgs), 'MCP tool args JSON')
        invokeResult = await invokeMcpToolCall({
          endpoint: remoteEndpoint,
          toolName: mcpToolName,
          toolArgs: normalizedArgs,
          headers: normalizedHeaders,
        })
      } else {
        const body = parseOptionalJson(apiBodyInput, 'API body JSON')
        invokeResult = await invokeApiEndpoint({
          endpoint: remoteEndpoint,
          method: apiMethod,
          body,
          headers: normalizedHeaders,
        })
      }

      setRawInput(JSON.stringify(invokeResult.toolResult, null, 2))
      setError('')
      setResult(null)
      setRemoteStatus(`Remote invoke OK (HTTP ${invokeResult.status}). Response loaded into ToolResult input.`)
    } catch (invokeError) {
      const message = invokeError instanceof Error ? invokeError.message : String(invokeError)
      setRemoteError(message)
    } finally {
      setRemoteLoading(false)
    }
  }

  return (
    <div className="exchange-panel">
      <div className="panel-title">Exchange + Remote Invoke (Task 010)</div>
      <div className="panel-body">
        {'MCP/API 호출 응답을 ToolResult 입력으로 로드한 뒤, 기존 Normalized/DOCX/v10 변환을 실행할 수 있습니다.'}
      </div>

      <div className="exchange-divider" />

      <div className="remote-grid">
        <label className="remote-field">
          <span>Invoke Mode</span>
          <select
            className="remote-input"
            value={remoteMode}
            onChange={(event) => setRemoteMode(event.target.value)}
          >
            <option value="mcp">MCP tools/call</option>
            <option value="api">Generic API</option>
          </select>
        </label>

        <label className="remote-field">
          <span>Endpoint URL</span>
          <input
            className="remote-input"
            type="text"
            value={remoteEndpoint}
            onChange={(event) => setRemoteEndpoint(event.target.value)}
            placeholder="http://localhost:8787/mcp"
          />
        </label>

        <label className="remote-field">
          <span>Headers JSON</span>
          <textarea
            className="remote-textarea"
            value={remoteHeadersInput}
            onChange={(event) => setRemoteHeadersInput(event.target.value)}
            spellCheck={false}
            placeholder='{"Authorization":"Bearer ..."}'
          />
        </label>

        {remoteMode === 'mcp' ? (
          <>
            <label className="remote-field">
              <span>MCP Tool Name</span>
              <input
                className="remote-input"
                type="text"
                value={mcpToolName}
                onChange={(event) => setMcpToolName(event.target.value)}
                placeholder="generate_content"
              />
            </label>
            <label className="remote-field">
              <span>MCP Tool Args JSON</span>
              <textarea
                className="remote-textarea"
                value={mcpToolArgsInput}
                onChange={(event) => setMcpToolArgsInput(event.target.value)}
                spellCheck={false}
                placeholder='{"topic":"algebra"}'
              />
            </label>
          </>
        ) : (
          <>
            <label className="remote-field">
              <span>API Method</span>
              <select
                className="remote-input"
                value={apiMethod}
                onChange={(event) => setApiMethod(event.target.value)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </select>
            </label>
            <label className="remote-field">
              <span>API Body JSON (optional)</span>
              <textarea
                className="remote-textarea"
                value={apiBodyInput}
                onChange={(event) => setApiBodyInput(event.target.value)}
                spellCheck={false}
                placeholder='{"prompt":"..."}'
              />
            </label>
          </>
        )}
      </div>

      <div className="exchange-actions">
        <button type="button" onClick={handleInvokeRemote} disabled={remoteLoading}>
          {remoteLoading ? 'Invoking...' : 'Invoke Remote'}
        </button>
      </div>

      {remoteStatus ? <div className="remote-status">{remoteStatus}</div> : null}
      {remoteError ? <div className="exchange-error">Remote Error: {remoteError}</div> : null}

      <div className="exchange-divider" />

      <div className="panel-title">ToolResult JSON</div>
      <textarea
        className="exchange-input"
        value={rawInput}
        onChange={(event) => setRawInput(event.target.value)}
        spellCheck={false}
      />
      <div className="exchange-actions">
        <button type="button" onClick={handleUseSample}>
          Use Sample
        </button>
        <button type="button" onClick={handleRun}>
          Run Convert
        </button>
      </div>
      {error ? <div className="exchange-error">Convert Error: {error}</div> : null}
      {summary ? (
        <div className="exchange-summary">
          <div>Blocks: {summary.blocks}</div>
          <div>Images: {summary.images}</div>
          <div>Roundtrip mismatches: {summary.roundtripMismatchLines}</div>
        </div>
      ) : null}
      {result ? (
        <div className="exchange-actions">
          <button type="button" onClick={() => downloadJson('normalized-content.json', result.normalized)}>
            Export Normalized
          </button>
          <button type="button" onClick={() => downloadJson('docx-draft.json', result.docxDraft)}>
            Export DOCX Draft
          </button>
          <button type="button" onClick={() => downloadJson('v10-draft.json', result.v10Draft)}>
            Export v10 Draft
          </button>
        </div>
      ) : null}
    </div>
  )
}
