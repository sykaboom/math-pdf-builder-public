import {
  BuildTextUtils,
  DEFAULT_EMPTY_DOCUMENT_VALUE,
  DocumentFlavor,
  IUniverInstanceService,
  PageOrientType,
  PAGE_SIZE,
  PaperType,
  UniverInstanceType,
} from '@univerjs/core'
import { ZipUtils } from './zip'
import { ImageUtils } from './imageStore'
import { normalizeSnapshotImages, optimizeImageAssets } from './imagePipeline'

const TEXT_ENCODER = new TextEncoder()
const TEXT_DECODER = new TextDecoder()

const PACKAGE_EXTENSION = '.msk'
const ASSET_ROOT = 'assets'
const IMAGE_ROOT = `${ASSET_ROOT}/images`
const PREVIEW_ROOT = `${ASSET_ROOT}/previews`
const IMAGE_INDEX_PATH = `${IMAGE_ROOT}/index.json`

const encodeJson = (value) => TEXT_ENCODER.encode(JSON.stringify(value, null, 2))
const decodeJson = (bytes) => JSON.parse(TEXT_DECODER.decode(bytes))

const buildDocumentStyle = () => ({
  documentFlavor: DocumentFlavor.TRADITIONAL,
  pageOrient: PageOrientType.PORTRAIT,
  pageSize: PAGE_SIZE[PaperType.A4],
  marginTop: 72,
  marginBottom: 72,
  marginLeft: 72,
  marginRight: 72,
})

const normalizeBody = (body) => ({
  dataStream: body?.dataStream || DEFAULT_EMPTY_DOCUMENT_VALUE,
  customBlocks: body?.customBlocks || [],
  customRanges: body?.customRanges || [],
  paragraphs: body?.paragraphs || [{ startIndex: 0 }],
  textRuns: body?.textRuns || [],
  tables: body?.tables || [],
  sectionBreaks: body?.sectionBreaks || [],
})

const buildDocSnapshot = (body) => ({
  id: 'doc-1',
  documentStyle: buildDocumentStyle(),
  body: normalizeBody(body),
  drawings: {},
  drawingsOrder: [],
})

const buildLegacyContentStub = () => ({
  data: {
    meta: { title: '', subtitle: '', footerText: '' },
    blocks: [],
    toc: {},
    pagePlan: [],
    chapterCovers: [],
    headerFooter: { header: {}, footer: {} },
  },
  settings: {},
})

const buildLegacySourceStub = () => ({
  schemaVersion: 1,
  meta: { header: {}, footer: '' },
  blocks: [],
})

const stripHtml = (value) => {
  if (!value) return ''
  const container = document.createElement('div')
  container.innerHTML = value
  return container.textContent || ''
}

const extractLegacyText = (content) => {
  if (!content) return ''
  if (typeof content === 'string') return content

  const blocks = content?.data?.blocks || content?.blocks
  if (Array.isArray(blocks)) {
    return blocks
      .map((block) => stripHtml(block?.content || block?.bodyRaw || block?.raw || ''))
      .filter((text) => text.trim())
      .join('\n\n')
  }

  return JSON.stringify(content, null, 2)
}

const buildSnapshotFromLegacy = (legacyData) => {
  const text = extractLegacyText(legacyData)
  if (!text) return buildDocSnapshot(null)
  const body = BuildTextUtils.transform.fromPlainText(text)
  return buildDocSnapshot(body)
}

const getCurrentDocSnapshot = (univer) => {
  const instanceService = univer.__getInjector().get(IUniverInstanceService)
  const doc = instanceService.getCurrentUnitOfType(UniverInstanceType.UNIVER_DOC)
  if (!doc) throw new Error('No active document.')
  return doc.getSnapshot()
}

const applySnapshotToUniver = (univer, snapshot) => {
  const instanceService = univer.__getInjector().get(IUniverInstanceService)
  const doc = instanceService.getCurrentUnitOfType(UniverInstanceType.UNIVER_DOC)
  if (!doc) {
    univer.createUnit(UniverInstanceType.UNIVER_DOC, snapshot)
    return
  }
  const unitId = doc.getUnitId()
  const nextSnapshot = { ...snapshot, id: unitId }
  doc.reset(nextSnapshot)
}

const buildManifest = () => ({
  schemaVersion: 2,
  packageType: 'msk',
  createdBy: 'math-pdf-builder',
  createdAt: new Date().toISOString(),
  entry: {
    univer: 'univer.json',
    content: 'content.json',
    source: 'source.json',
  },
  assetRoot: ASSET_ROOT,
  imageRoot: IMAGE_ROOT,
  previewRoot: PREVIEW_ROOT,
  imageIndex: IMAGE_INDEX_PATH,
  contentSchemaVersion: 1,
  sourceSchemaVersion: 1,
})

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export const exportUniverSnapshot = (univer, filename = 'univer.json') => {
  const snapshot = getCurrentDocSnapshot(univer)
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' })
  downloadBlob(blob, filename)
}

export const saveMskPackage = async ({ univer, imageStore, filename }) => {
  const rawSnapshot = getCurrentDocSnapshot(univer)
  const normalizedSnapshot = await normalizeSnapshotImages(rawSnapshot, imageStore)
  const assets = await optimizeImageAssets(normalizedSnapshot, imageStore)

  const imageIndex = {
    schemaVersion: 1,
    images: {},
  }

  const assetEntries = []

  for (const asset of assets) {
    const ext = ImageUtils.extensionForMime(asset.mime)
    const imagePath = `${IMAGE_ROOT}/${asset.imageId}.${ext}`
    const previewPath = `${PREVIEW_ROOT}/${asset.imageId}.jpg`

    imageIndex.images[asset.imageId] = {
      hash: asset.hash,
      path: imagePath,
      mime: asset.mime,
      width: asset.width,
      height: asset.height,
      hasAlpha: asset.hasAlpha,
      previewPath,
    }

    assetEntries.push({
      path: imagePath,
      data: new Uint8Array(await asset.optimizedBlob.arrayBuffer()),
    })

    assetEntries.push({
      path: previewPath,
      data: new Uint8Array(await asset.previewBlob.arrayBuffer()),
    })
  }

  const manifest = buildManifest()
  const content = buildLegacyContentStub()
  const source = buildLegacySourceStub()

  const entries = [
    { path: 'manifest.json', data: encodeJson(manifest) },
    { path: 'univer.json', data: encodeJson(normalizedSnapshot) },
    { path: 'content.json', data: encodeJson(content) },
    { path: 'source.json', data: encodeJson(source) },
    { path: IMAGE_INDEX_PATH, data: encodeJson(imageIndex) },
    ...assetEntries,
  ]

  const zipBytes = ZipUtils.buildZip(entries)
  const blob = new Blob([zipBytes], { type: 'application/zip' })

  const finalName = filename?.endsWith(PACKAGE_EXTENSION)
    ? filename
    : `${filename || 'document'}${PACKAGE_EXTENSION}`

  downloadBlob(blob, finalName)
}

export const loadMskPackage = async ({ univer, imageStore, file }) => {
  const name = file?.name || ''

  if (name.toLowerCase().endsWith('.json')) {
    const content = JSON.parse(await file.text())
    const snapshot = buildSnapshotFromLegacy(content)
    imageStore.clear()
    applySnapshotToUniver(univer, snapshot)
    return { type: 'legacy-json' }
  }

  const buffer = await file.arrayBuffer()
  const zipEntries = ZipUtils.readZip(buffer)
  const manifestBytes = zipEntries.get('manifest.json')
  if (!manifestBytes) throw new Error('manifest.json missing.')
  const manifest = decodeJson(manifestBytes)
  if (manifest.packageType && manifest.packageType !== 'msk') {
    throw new Error('Unsupported package type.')
  }

  const schemaVersion = manifest.schemaVersion || 1

  if (schemaVersion < 2) {
    const contentPath = manifest?.entry?.content || 'content.json'
    const contentBytes = zipEntries.get(contentPath)
    if (!contentBytes) throw new Error('content.json missing.')
    const legacyContent = decodeJson(contentBytes)
    const snapshot = buildSnapshotFromLegacy(legacyContent)
    imageStore.clear()
    applySnapshotToUniver(univer, snapshot)
    return { type: 'legacy-msk' }
  }

  const univerPath = manifest?.entry?.univer || 'univer.json'
  const univerBytes = zipEntries.get(univerPath)
  if (!univerBytes) throw new Error('univer.json missing.')
  let snapshot = decodeJson(univerBytes)

  imageStore.clear()

  const indexPath = manifest?.imageIndex || IMAGE_INDEX_PATH
  const indexBytes = zipEntries.get(indexPath)
  if (indexBytes) {
    const index = decodeJson(indexBytes)
    const images = index?.images || {}
    const imageIds = Object.keys(images)

    for (const imageId of imageIds) {
      const entry = images[imageId]
      const imageBytes = zipEntries.get(entry.path)
      if (!imageBytes) continue
      const blob = new Blob([imageBytes], { type: entry.mime })
      let previewBlob = null
      if (entry.previewPath) {
        const previewBytes = zipEntries.get(entry.previewPath)
        if (previewBytes) {
          previewBlob = new Blob([previewBytes], { type: 'image/jpeg' })
        }
      }
      imageStore.registerEntry({
        imageId,
        hash: entry.hash,
        mime: entry.mime,
        width: entry.width,
        height: entry.height,
        hasAlpha: entry.hasAlpha,
        originalBlob: blob,
        previewBlob,
      })
    }
  }

  snapshot = await normalizeSnapshotImages(snapshot, imageStore, {
    resolveUuidToUrl: true,
  })
  applySnapshotToUniver(univer, snapshot)

  return { type: 'msk-v2' }
}
