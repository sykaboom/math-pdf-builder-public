import {
  assertNormalizedContent,
  assertV10Draft,
  createEmptyNormalizedContent,
  createEmptyV10Draft,
} from '../../contracts/docxDraftContract'

const asString = (value, fallback = '') => (typeof value === 'string' ? value : fallback)

const blockToV10 = (block, index) => {
  const id = asString(block?.id, `block-${index + 1}`)

  if (block?.kind === 'paragraph') {
    const text = Array.isArray(block.runs)
      ? block.runs.map((run) => asString(run?.text)).join('')
      : asString(block?.text)
    return { id, kind: 'rich-text', text }
  }

  if (block?.kind === 'equation') {
    return {
      id,
      kind: 'math',
      latex: asString(block?.latex),
      display: block?.display !== false,
    }
  }

  if (block?.kind === 'image') {
    return {
      id,
      kind: 'image',
      assetId: asString(block?.assetId),
      widthPt: Number.isFinite(Number(block?.widthPt)) ? Number(block.widthPt) : null,
      heightPt: Number.isFinite(Number(block?.heightPt)) ? Number(block.heightPt) : null,
      altText: asString(block?.altText),
    }
  }

  if (block?.kind === 'table') {
    return {
      id,
      kind: 'table',
      rows: Array.isArray(block?.rows) ? JSON.parse(JSON.stringify(block.rows)) : [],
    }
  }

  return {
    id,
    kind: 'rich-text',
    text: asString(block?.text),
    extension: {
      originalKind: asString(block?.kind, 'unknown'),
    },
  }
}

const blockFromV10 = (block, index) => {
  const id = asString(block?.id, `block-${index + 1}`)

  if (block?.kind === 'rich-text') {
    return {
      id,
      kind: 'paragraph',
      runs: [{ text: asString(block?.text) }],
    }
  }

  if (block?.kind === 'math') {
    return {
      id,
      kind: 'equation',
      latex: asString(block?.latex),
      display: block?.display !== false,
    }
  }

  if (block?.kind === 'image') {
    return {
      id,
      kind: 'image',
      assetId: asString(block?.assetId),
      widthPt: Number.isFinite(Number(block?.widthPt)) ? Number(block.widthPt) : null,
      heightPt: Number.isFinite(Number(block?.heightPt)) ? Number(block.heightPt) : null,
      altText: asString(block?.altText),
    }
  }

  if (block?.kind === 'table') {
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
  }
}

export const normalizedContentToV10Draft = (normalizedContent) => {
  assertNormalizedContent(normalizedContent)

  const v10Draft = createEmptyV10Draft({
    title: normalizedContent.metadata?.title,
    language: normalizedContent.metadata?.language,
  })

  v10Draft.metadata = {
    ...v10Draft.metadata,
    ...JSON.parse(JSON.stringify(normalizedContent.metadata || {})),
  }

  v10Draft.blocks = normalizedContent.blocks.map((block, index) => blockToV10(block, index))
  v10Draft.assets = {
    images: Array.isArray(normalizedContent.assets?.images)
      ? JSON.parse(JSON.stringify(normalizedContent.assets.images))
      : [],
  }

  return v10Draft
}

export const v10DraftToNormalizedContent = (v10Draft) => {
  assertV10Draft(v10Draft)

  const normalized = createEmptyNormalizedContent({
    title: v10Draft.metadata?.title,
    language: v10Draft.metadata?.language,
  })

  normalized.metadata = {
    ...normalized.metadata,
    ...JSON.parse(JSON.stringify(v10Draft.metadata || {})),
  }

  normalized.blocks = v10Draft.blocks.map((block, index) => blockFromV10(block, index))
  normalized.assets = {
    images: Array.isArray(v10Draft.assets?.images) ? JSON.parse(JSON.stringify(v10Draft.assets.images)) : [],
  }

  return normalized
}

