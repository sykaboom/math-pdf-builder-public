import {
  assertNormalizedContent,
  createEmptyNormalizedContent,
  isPlainObject,
} from '../../contracts/docxDraftContract'
import { docxDraftToNormalizedContent } from './docxExchangeAdapter'

const asString = (value, fallback = '') => (typeof value === 'string' ? value : fallback)

const normalizeToolBlock = (block, index) => {
  const id = asString(block?.id, `block-${index + 1}`)
  const kind = asString(block?.kind || block?.type)

  if (kind === 'paragraph' || kind === 'text') {
    return {
      id,
      kind: 'paragraph',
      runs: [{ text: asString(block?.text) }],
    }
  }

  if (kind === 'equation' || kind === 'math') {
    return {
      id,
      kind: 'equation',
      latex: asString(block?.latex || block?.text),
      display: block?.display !== false,
    }
  }

  if (kind === 'image') {
    return {
      id,
      kind: 'image',
      assetId: asString(block?.assetId || block?.imageId),
      widthPt: Number.isFinite(Number(block?.widthPt)) ? Number(block.widthPt) : null,
      heightPt: Number.isFinite(Number(block?.heightPt)) ? Number(block.heightPt) : null,
      altText: asString(block?.altText),
    }
  }

  if (kind === 'table') {
    return {
      id,
      kind: 'table',
      rows: Array.isArray(block?.rows) ? JSON.parse(JSON.stringify(block.rows)) : [],
    }
  }

  return {
    id,
    kind: 'paragraph',
    runs: [{ text: asString(block?.text) }],
    extension: {
      originalKind: kind || 'unknown',
    },
  }
}

const coerceMetadata = (value) => (isPlainObject(value) ? JSON.parse(JSON.stringify(value)) : {})

export const toolResultToNormalizedContent = (toolResult) => {
  if (!isPlainObject(toolResult)) {
    throw new Error('ToolResult must be an object.')
  }

  const payload = isPlainObject(toolResult.payload) ? toolResult.payload : toolResult

  if (isPlainObject(payload.normalizedContent)) {
    assertNormalizedContent(payload.normalizedContent)
    return payload.normalizedContent
  }

  if (isPlainObject(payload.docxDraft)) {
    return docxDraftToNormalizedContent(payload.docxDraft)
  }

  if (Array.isArray(payload.blocks)) {
    const normalized = createEmptyNormalizedContent({
      title: payload.metadata?.title,
      language: payload.metadata?.language,
    })
    normalized.metadata = {
      ...normalized.metadata,
      ...coerceMetadata(payload.metadata),
    }
    normalized.blocks = payload.blocks.map((block, index) => normalizeToolBlock(block, index))
    normalized.assets = {
      images: Array.isArray(payload.assets?.images) ? JSON.parse(JSON.stringify(payload.assets.images)) : [],
    }
    return normalized
  }

  throw new Error('ToolResult payload is missing normalizedContent/docxDraft/blocks.')
}

