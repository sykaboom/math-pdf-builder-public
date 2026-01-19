import { generateRandomId, ImageSourceType, ImageUploadStatusType } from '@univerjs/core'
import { TempImageStorage } from './tempImageStorage'

const MAX_ALPHA_SAMPLE_EDGE = 256

const toHex = (buffer) =>
  Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

const digestSha256 = async (buffer) => {
  const hash = await crypto.subtle.digest('SHA-256', buffer)
  return `sha256:${toHex(hash)}`
}

const loadImageElement = (blob) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = (event) => {
      URL.revokeObjectURL(url)
      reject(event)
    }
    image.src = url
  })

const loadBitmap = async (blob) => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob)
    return { image: bitmap, width: bitmap.width, height: bitmap.height, type: 'bitmap' }
  }

  const image = await loadImageElement(blob)
  return { image, width: image.naturalWidth, height: image.naturalHeight, type: 'image' }
}

const detectAlpha = async (image, width, height) => {
  if (!width || !height) return false
  const sampleWidth = Math.min(width, MAX_ALPHA_SAMPLE_EDGE)
  const sampleHeight = Math.min(height, MAX_ALPHA_SAMPLE_EDGE)
  const canvas = document.createElement('canvas')
  canvas.width = sampleWidth
  canvas.height = sampleHeight
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false

  ctx.clearRect(0, 0, sampleWidth, sampleHeight)
  ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight)
  const data = ctx.getImageData(0, 0, sampleWidth, sampleHeight).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true
  }
  return false
}

const isJpeg = (mime) => /image\/jpe?g/i.test(mime || '')
const isPng = (mime) => /image\/png/i.test(mime || '')

const pickMime = (mime, hasAlpha) => {
  if (isJpeg(mime) || isPng(mime)) return mime
  return hasAlpha ? 'image/png' : 'image/jpeg'
}

const normalizeMime = (mime) => {
  if (!mime) return 'image/png'
  if (mime === 'image/jpg') return 'image/jpeg'
  return mime
}

const extensionForMime = (mime) => {
  if (isJpeg(mime)) return 'jpg'
  if (isPng(mime)) return 'png'
  return 'png'
}

const blobFromDataUrl = async (dataUrl) => {
  const response = await fetch(dataUrl)
  return await response.blob()
}

export class MskImageStore {
  constructor() {
    this._entriesById = new Map()
    this._entriesByHash = new Map()
    this._objectUrls = new Map()
    this._entriesByUrl = new Map()
    this._tempStorage = new TempImageStorage()
  }

  clear() {
    this._entriesById.clear()
    this._entriesByHash.clear()
    this._objectUrls.forEach((url) => URL.revokeObjectURL(url))
    this._objectUrls.clear()
    this._entriesByUrl.clear()
    void this._tempStorage.clear()
  }

  getEntry(imageId) {
    return this._entriesById.get(imageId) || null
  }

  getAllEntries() {
    return Array.from(this._entriesById.values())
  }

  async getImageUrl(imageId) {
    const entry = this._entriesById.get(imageId)
    if (!entry) return null
    if (this._objectUrls.has(imageId)) return this._objectUrls.get(imageId)
    const blob = await this.getOriginalBlob(imageId)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    this._objectUrls.set(imageId, url)
    this._entriesByUrl.set(url, imageId)
    return url
  }

  async getOriginalBlob(imageId) {
    const entry = this._entriesById.get(imageId)
    if (!entry) return null
    if (entry.originalBlob) return entry.originalBlob
    const blob = await this._tempStorage.read(imageId, entry.extension)
    if (blob) entry.originalBlob = blob
    return blob
  }

  registerObjectUrl(imageId, url) {
    if (!imageId || !url) return null
    const previous = this._objectUrls.get(imageId)
    if (previous && previous !== url) {
      URL.revokeObjectURL(previous)
      this._entriesByUrl.delete(previous)
    }
    this._objectUrls.set(imageId, url)
    this._entriesByUrl.set(url, imageId)
    return url
  }

  getEntryByUrl(url) {
    if (!url) return null
    const imageId = this._entriesByUrl.get(url)
    if (!imageId) return null
    return this._entriesById.get(imageId) || null
  }

  registerEntry(entry) {
    if (!entry || !entry.imageId) return null
    const normalizedMime = normalizeMime(entry.mime)
    const normalizedEntry = {
      ...entry,
      mime: normalizedMime,
      extension: extensionForMime(normalizedMime),
    }
    this._entriesById.set(normalizedEntry.imageId, normalizedEntry)
    if (normalizedEntry.hash) {
      this._entriesByHash.set(normalizedEntry.hash, normalizedEntry.imageId)
    }
    if (normalizedEntry.originalBlob) {
      const url = URL.createObjectURL(normalizedEntry.originalBlob)
      this._objectUrls.set(normalizedEntry.imageId, url)
      this._entriesByUrl.set(url, normalizedEntry.imageId)
      void this._tempStorage
        .write(normalizedEntry.imageId, normalizedEntry.originalBlob, normalizedEntry.extension)
        .catch(() => {})
    }
    return normalizedEntry
  }

  async ingestBlob(blob, options = {}) {
    const buffer = await blob.arrayBuffer()
    const hash = await digestSha256(buffer)
    const existingId = this._entriesByHash.get(hash)
    if (existingId) {
      return this._entriesById.get(existingId)
    }

    const imageId = options.imageId || `img_${generateRandomId(8)}`
    const mime = normalizeMime(options.mime || blob.type || 'image/png')
    const { image, width, height, type } = await loadBitmap(blob)
    const hasAlpha = isJpeg(mime) ? false : await detectAlpha(image, width, height)
    if (type === 'bitmap') image.close()

    return this.registerEntry({
      imageId,
      hash,
      mime: pickMime(mime, hasAlpha),
      width,
      height,
      hasAlpha,
      originalBlob: blob,
      previewBlob: options.previewBlob || null,
    })
  }

  async saveFile(file) {
    const entry = await this.ingestBlob(file, { mime: file.type })
    if (!entry) return null

    return {
      imageId: entry.imageId,
      imageSourceType: ImageSourceType.UUID,
      source: entry.imageId,
      base64Cache: '',
      status: ImageUploadStatusType.SUCCUSS,
    }
  }

  async ingestSource(source, sourceType) {
    if (!source) return null
    if (sourceType === ImageSourceType.BASE64 || source.startsWith('data:')) {
      const blob = await blobFromDataUrl(source)
      return this.ingestBlob(blob, { mime: blob.type })
    }
    if (sourceType === ImageSourceType.URL || source.startsWith('http')) {
      const existing = this.getEntryByUrl(source)
      if (existing) return existing
      const response = await fetch(source)
      const blob = await response.blob()
      return this.ingestBlob(blob, { mime: blob.type })
    }
    return null
  }
}

export const ImageUtils = {
  digestSha256,
  loadBitmap,
  detectAlpha,
  extensionForMime,
  normalizeMime,
  pickMime,
}
