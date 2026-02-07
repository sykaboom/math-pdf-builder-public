import {
  assertDocxDraft,
  assertNormalizedContent,
  cloneJson,
  createEmptyDocxDraft,
  createEmptyNormalizedContent,
  ensureImageAssetList,
  isPlainObject,
} from '../../contracts/docxDraftContract'

const asString = (value, fallback = '') => (typeof value === 'string' ? value : fallback)
const asNumber = (value, fallback = null) => {
  const nextValue = Number(value)
  return Number.isFinite(nextValue) ? nextValue : fallback
}

const collectParagraphText = (runs) =>
  runs
    .map((run) => asString(run?.text))
    .join('')
    .trim()

const normalizeRuns = (runs) =>
  runs.map((run) => ({
    text: asString(run?.text),
    bold: run?.bold === true ? true : undefined,
    italic: run?.italic === true ? true : undefined,
    underline: run?.underline === true ? true : undefined,
    fontSizePt: asNumber(run?.fontSizePt),
  }))

const mapDocxBlockToNormalized = (block, sectionId, blockIndex) => {
  const kind = asString(block?.kind)
  const id = asString(block?.id, `${sectionId}-block-${blockIndex + 1}`)

  if (kind === 'paragraph') {
    const runs = Array.isArray(block.runs) ? normalizeRuns(block.runs) : [{ text: asString(block.text) }]
    return {
      id,
      kind: 'paragraph',
      runs,
      sectionId,
    }
  }

  if (kind === 'equation') {
    return {
      id,
      kind: 'equation',
      latex: asString(block.latex),
      display: block.display !== false,
      sectionId,
    }
  }

  if (kind === 'image') {
    return {
      id,
      kind: 'image',
      assetId: asString(block.assetId),
      widthPt: asNumber(block.widthPt),
      heightPt: asNumber(block.heightPt),
      altText: asString(block.altText),
      sectionId,
    }
  }

  if (kind === 'table') {
    return {
      id,
      kind: 'table',
      rows: Array.isArray(block.rows) ? cloneJson(block.rows) : [],
      sectionId,
    }
  }

  return {
    id,
    kind: 'paragraph',
    runs: [{ text: asString(block?.text) }],
    sectionId,
    extension: {
      originalKind: kind || 'unknown',
    },
  }
}

const mapNormalizedBlockToDocx = (block, blockIndex) => {
  const kind = asString(block?.kind)
  const id = asString(block?.id, `block-${blockIndex + 1}`)

  if (kind === 'paragraph') {
    const runs = Array.isArray(block.runs) ? normalizeRuns(block.runs) : [{ text: asString(block.text) }]
    return {
      id,
      kind: 'paragraph',
      runs,
    }
  }

  if (kind === 'equation') {
    return {
      id,
      kind: 'equation',
      latex: asString(block.latex),
      display: block.display !== false,
    }
  }

  if (kind === 'image') {
    return {
      id,
      kind: 'image',
      assetId: asString(block.assetId),
      widthPt: asNumber(block.widthPt),
      heightPt: asNumber(block.heightPt),
      altText: asString(block.altText),
    }
  }

  if (kind === 'table') {
    return {
      id,
      kind: 'table',
      rows: Array.isArray(block.rows) ? cloneJson(block.rows) : [],
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

export const docxDraftToNormalizedContent = (docxDraft) => {
  assertDocxDraft(docxDraft)

  const normalized = createEmptyNormalizedContent({
    title: docxDraft.metadata?.title,
    language: docxDraft.metadata?.language,
  })

  normalized.metadata = {
    ...normalized.metadata,
    ...cloneJson(docxDraft.metadata || {}),
  }

  const blocks = []

  docxDraft.sections.forEach((section, sectionIndex) => {
    const sectionId = asString(section?.id, `section-${sectionIndex + 1}`)
    const sectionBlocks = Array.isArray(section?.blocks) ? section.blocks : []
    sectionBlocks.forEach((block, blockIndex) => {
      blocks.push(mapDocxBlockToNormalized(block, sectionId, blockIndex))
    })
  })

  normalized.blocks = blocks
  normalized.assets = {
    images: ensureImageAssetList(docxDraft.assets),
  }
  normalized.extension = {
    docxPage: docxDraft.sections.map((section, sectionIndex) => ({
      id: asString(section?.id, `section-${sectionIndex + 1}`),
      page: cloneJson(section?.page || {}),
      columns: cloneJson(section?.columns || {}),
    })),
    edu: cloneJson(docxDraft.extensions?.edu || {}),
  }

  return normalized
}

export const normalizedContentToDocxDraft = (normalizedContent, options = {}) => {
  assertNormalizedContent(normalizedContent)

  const docxDraft = createEmptyDocxDraft({
    title: normalizedContent.metadata?.title,
    language: normalizedContent.metadata?.language,
  })

  docxDraft.metadata = {
    ...docxDraft.metadata,
    ...cloneJson(normalizedContent.metadata || {}),
  }

  const sectionId = asString(options.sectionId, 'section-1')
  docxDraft.sections = [
    {
      id: sectionId,
      page: cloneJson(normalizedContent.extension?.docxPage?.[0]?.page || docxDraft.sections[0].page),
      columns: cloneJson(
        normalizedContent.extension?.docxPage?.[0]?.columns || docxDraft.sections[0].columns
      ),
      blocks: normalizedContent.blocks.map((block, blockIndex) =>
        mapNormalizedBlockToDocx(block, blockIndex)
      ),
    },
  ]

  docxDraft.assets = {
    images: ensureImageAssetList(normalizedContent.assets),
  }

  if (isPlainObject(normalizedContent.extension?.edu)) {
    docxDraft.extensions.edu = cloneJson(normalizedContent.extension.edu)
  }

  return docxDraft
}

export const normalizedContentToPlainText = (normalizedContent) => {
  assertNormalizedContent(normalizedContent)
  return normalizedContent.blocks
    .map((block) => {
      if (block.kind === 'paragraph') {
        return collectParagraphText(Array.isArray(block.runs) ? block.runs : [])
      }
      if (block.kind === 'equation') return `$${asString(block.latex)}$`
      if (block.kind === 'image') return '[image]'
      if (block.kind === 'table') return '[table]'
      return asString(block.text)
    })
    .filter((value) => value.length > 0)
    .join('\n')
}

