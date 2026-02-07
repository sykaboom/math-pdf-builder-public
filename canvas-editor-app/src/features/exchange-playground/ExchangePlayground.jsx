import { useMemo, useState } from 'react'
import {
  docxDraftToNormalizedContent,
  normalizedContentToDocxDraft,
  normalizedContentToV10Draft,
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

export function ExchangePlayground() {
  const [rawInput, setRawInput] = useState(JSON.stringify(SAMPLE_TOOL_RESULT, null, 2))
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

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
      const normalized = toolResultToNormalizedContent(parsed)
      const docxDraft = normalizedContentToDocxDraft(normalized)
      const v10Draft = normalizedContentToV10Draft(normalized)
      const normalizedRoundtrip = docxDraftToNormalizedContent(docxDraft)

      const normalizedText = stableStringify(normalized)
      const roundtripText = stableStringify(normalizedRoundtrip)
      const roundtripMismatchLines = countMismatchLines(normalizedText, roundtripText)

      setResult({
        normalized,
        docxDraft,
        v10Draft,
        normalizedRoundtrip,
        normalizedText,
        roundtripText,
        roundtripMismatchLines,
      })
      setError('')
    } catch (runError) {
      const message = runError instanceof Error ? runError.message : String(runError)
      setError(message)
      setResult(null)
    }
  }

  return (
    <div className="exchange-panel">
      <div className="panel-title">Exchange PoC (Task 002)</div>
      <div className="panel-body">
        {'ToolResult JSON을 입력해 "Normalized -> DOCX/v10 -> Roundtrip"을 검증합니다.'}
      </div>
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
      {error ? <div className="exchange-error">Error: {error}</div> : null}
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
