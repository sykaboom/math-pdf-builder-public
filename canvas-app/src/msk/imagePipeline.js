import { DrawingTypeEnum, ImageSourceType } from '@univerjs/core'
import { ImageUtils } from './imageStore'

const DOC_DPI = 96
const DEFAULT_EXPORT_DPI = 300
const DEFAULT_PREVIEW_LONG_EDGE = 1024
const DEFAULT_JPEG_QUALITY = 0.9

const resolveSizeValue = (value) => {
  const numberValue = Number(value)
  if (!Number.isFinite(numberValue)) return null
  return numberValue
}

const resolveDrawingSize = (drawing) => {
  const size =
    drawing?.docTransform?.size ||
    drawing?.transform?.size ||
    drawing?.transforms?.[0]?.size ||
    null

  if (!size) return null

  const width = resolveSizeValue(size.width ?? size.w)
  const height = resolveSizeValue(size.height ?? size.h)
  if (!width || !height) return null
  return { width, height }
}

const normalizeSourceType = (sourceType, source) => {
  if (sourceType) return sourceType
  if (typeof source !== 'string') return null
  if (source.startsWith('data:')) return ImageSourceType.BASE64
  if (source.startsWith('http') || source.startsWith('blob:')) return ImageSourceType.URL
  return ImageSourceType.UUID
}

const cloneSnapshot = (snapshot) => {
  if (typeof structuredClone === 'function') return structuredClone(snapshot)
  return JSON.parse(JSON.stringify(snapshot))
}

export const normalizeSnapshotImages = async (snapshot, imageStore, options = {}) => {
  const resolveUuidToUrl = options.resolveUuidToUrl === true
  const nextSnapshot = cloneSnapshot(snapshot)
  const drawings = nextSnapshot.drawings || {}

  for (const drawing of Object.values(drawings)) {
    if (!drawing) continue
    if (drawing.drawingType !== DrawingTypeEnum.DRAWING_IMAGE && !drawing.source) continue

    const source = drawing.source
    const sourceType = normalizeSourceType(drawing.imageSourceType, source)
    if (!source || !sourceType) continue

    if (sourceType !== ImageSourceType.UUID) {
      const entry = await imageStore.ingestSource(source, sourceType)
      if (!entry) continue

      drawing.imageSourceType = ImageSourceType.UUID
      drawing.source = entry.imageId
    } else {
      drawing.imageSourceType = ImageSourceType.UUID
    }

    if (resolveUuidToUrl) {
      const resolvedUrl = await imageStore.getImageUrl(drawing.source)
      if (resolvedUrl && resolvedUrl !== drawing.source) {
        drawing.imageSourceType = ImageSourceType.URL
        drawing.source = resolvedUrl
      }
    }
  }

  return nextSnapshot
}

export const collectImageUsage = (snapshot, imageStore) => {
  const usage = new Map()
  const drawings = snapshot.drawings || {}

  for (const drawing of Object.values(drawings)) {
    if (!drawing) continue
    if (drawing.drawingType !== DrawingTypeEnum.DRAWING_IMAGE && !drawing.source) continue

    const imageId = drawing.source
    if (!imageId) continue

    const size = resolveDrawingSize(drawing)
    const fallback = imageStore.getEntry(imageId)
    const width = size?.width || fallback?.width
    const height = size?.height || fallback?.height
    if (!width || !height) continue

    const current = usage.get(imageId) || { width: 0, height: 0 }
    usage.set(imageId, {
      width: Math.max(current.width, width),
      height: Math.max(current.height, height),
    })
  }

  return usage
}

const toBlob = (canvas, mime, quality) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mime, quality)
  })

const renderImage = async ({
  image,
  width,
  height,
  targetWidth,
  targetHeight,
  mime,
  quality,
  hasAlpha,
}) => {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context missing.')

  if (mime === 'image/jpeg' && hasAlpha) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetWidth, targetHeight)
  } else {
    ctx.clearRect(0, 0, targetWidth, targetHeight)
  }

  ctx.drawImage(image, 0, 0, targetWidth, targetHeight)
  const blob = await toBlob(canvas, mime, quality)
  if (!blob) throw new Error('Image encoding failed.')
  return blob
}

export const optimizeImageAssets = async (snapshot, imageStore, options = {}) => {
  const exportDpi = options.exportDpi || DEFAULT_EXPORT_DPI
  const previewLongEdge = options.previewLongEdge || DEFAULT_PREVIEW_LONG_EDGE
  const jpegQuality = options.jpegQuality || DEFAULT_JPEG_QUALITY

  const usage = collectImageUsage(snapshot, imageStore)
  const assets = []

  for (const entry of imageStore.getAllEntries()) {
    if (!usage.has(entry.imageId)) continue
    if (!entry.originalBlob) continue

    const useSize = usage.get(entry.imageId)
    const maxWidth = Math.round((useSize.width / DOC_DPI) * exportDpi)
    const maxHeight = Math.round((useSize.height / DOC_DPI) * exportDpi)

    const scale = Math.min(
      1,
      maxWidth / entry.width || 1,
      maxHeight / entry.height || 1
    )

    const targetWidth = Math.max(1, Math.round(entry.width * scale))
    const targetHeight = Math.max(1, Math.round(entry.height * scale))

    const targetMime = ImageUtils.normalizeMime(entry.mime)
    const originalType = entry.originalBlob.type || ''
    const originalMime = ImageUtils.normalizeMime(originalType)
    const needsReencode =
      targetWidth !== entry.width ||
      targetHeight !== entry.height ||
      targetMime !== originalMime ||
      !originalType

    let optimizedBlob = entry.originalBlob

    if (needsReencode) {
      const { image, width, height, type } = await ImageUtils.loadBitmap(entry.originalBlob)
      optimizedBlob = await renderImage({
        image,
        width,
        height,
        targetWidth,
        targetHeight,
        mime: targetMime,
        quality: jpegQuality,
        hasAlpha: entry.hasAlpha,
      })
      if (type === 'bitmap') image.close()
    }

    const previewScale = Math.min(1, previewLongEdge / Math.max(entry.width, entry.height))
    const previewWidth = Math.max(1, Math.round(entry.width * previewScale))
    const previewHeight = Math.max(1, Math.round(entry.height * previewScale))

    const { image: previewImage, type: previewType } = await ImageUtils.loadBitmap(entry.originalBlob)
    const previewBlob = await renderImage({
      image: previewImage,
      width: entry.width,
      height: entry.height,
      targetWidth: previewWidth,
      targetHeight: previewHeight,
      mime: 'image/jpeg',
      quality: jpegQuality,
      hasAlpha: entry.hasAlpha,
    })
    if (previewType === 'bitmap') previewImage.close()

    assets.push({
      imageId: entry.imageId,
      hash: entry.hash,
      mime: targetMime,
      width: targetWidth,
      height: targetHeight,
      hasAlpha: entry.hasAlpha,
      optimizedBlob,
      previewBlob,
    })
  }

  return assets
}

export const ImagePipelineDefaults = {
  DOC_DPI,
  DEFAULT_EXPORT_DPI,
  DEFAULT_PREVIEW_LONG_EDGE,
  DEFAULT_JPEG_QUALITY,
}
