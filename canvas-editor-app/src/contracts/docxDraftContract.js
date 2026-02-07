export const DOCX_DRAFT_KIND = 'docx-draft'
export const DOCX_DRAFT_VERSION = 1
export const NORMALIZED_CONTENT_KIND = 'normalized-content'
export const NORMALIZED_CONTENT_VERSION = 1
export const V10_DRAFT_KIND = 'v10-draft'
export const V10_DRAFT_VERSION = 1

const DEFAULT_PAGE = {
  size: 'A4',
  orientation: 'portrait',
  marginsPt: {
    top: 72,
    right: 72,
    bottom: 72,
    left: 72,
  },
}

const nowIso = () => new Date().toISOString()
const asString = (value, fallback = '') => (typeof value === 'string' ? value : fallback)

export const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const ensureArray = (value) => (Array.isArray(value) ? value : [])

export const createEmptyDocxDraft = (init = {}) => ({
  kind: DOCX_DRAFT_KIND,
  version: DOCX_DRAFT_VERSION,
  metadata: {
    title: asString(init.title),
    language: asString(init.language, 'ko-KR'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  sections: [
    {
      id: 'section-1',
      page: {
        size: DEFAULT_PAGE.size,
        orientation: DEFAULT_PAGE.orientation,
        marginsPt: {
          ...DEFAULT_PAGE.marginsPt,
        },
      },
      columns: {
        count: 1,
        gapPt: 18,
      },
      blocks: [],
    },
  ],
  assets: {
    images: [],
  },
  extensions: {
    edu: {},
  },
})

export const createEmptyNormalizedContent = (init = {}) => ({
  kind: NORMALIZED_CONTENT_KIND,
  version: NORMALIZED_CONTENT_VERSION,
  metadata: {
    title: asString(init.title),
    language: asString(init.language, 'ko-KR'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  blocks: [],
})

export const createEmptyV10Draft = (init = {}) => ({
  kind: V10_DRAFT_KIND,
  version: V10_DRAFT_VERSION,
  metadata: {
    title: asString(init.title),
    language: asString(init.language, 'ko-KR'),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
  blocks: [],
})

const assertVersion = (value, expected, label) => {
  if (!Number.isInteger(value) || value !== expected) {
    throw new Error(`${label} version must be ${expected}.`)
  }
}

const assertRequiredArray = (value, label) => {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array.`)
  }
}

export const assertDocxDraft = (value) => {
  if (!isPlainObject(value)) throw new Error('DOCX draft must be an object.')
  if (value.kind !== DOCX_DRAFT_KIND) {
    throw new Error(`DOCX draft kind must be "${DOCX_DRAFT_KIND}".`)
  }
  assertVersion(value.version, DOCX_DRAFT_VERSION, 'DOCX draft')
  assertRequiredArray(value.sections, 'DOCX draft sections')

  value.sections.forEach((section, index) => {
    if (!isPlainObject(section)) {
      throw new Error(`DOCX section at index ${index} must be an object.`)
    }
    assertRequiredArray(section.blocks, `DOCX section(${index}) blocks`)
  })
}

export const assertNormalizedContent = (value) => {
  if (!isPlainObject(value)) throw new Error('NormalizedContent must be an object.')
  if (value.kind !== NORMALIZED_CONTENT_KIND) {
    throw new Error(`NormalizedContent kind must be "${NORMALIZED_CONTENT_KIND}".`)
  }
  assertVersion(value.version, NORMALIZED_CONTENT_VERSION, 'NormalizedContent')
  assertRequiredArray(value.blocks, 'NormalizedContent blocks')
}

export const assertV10Draft = (value) => {
  if (!isPlainObject(value)) throw new Error('v10 draft must be an object.')
  if (value.kind !== V10_DRAFT_KIND) {
    throw new Error(`v10 draft kind must be "${V10_DRAFT_KIND}".`)
  }
  assertVersion(value.version, V10_DRAFT_VERSION, 'v10 draft')
  assertRequiredArray(value.blocks, 'v10 draft blocks')
}

export const cloneJson = (value) => JSON.parse(JSON.stringify(value))

export const ensureImageAssetList = (value) => {
  if (!isPlainObject(value)) return []
  return ensureArray(value.images)
}
