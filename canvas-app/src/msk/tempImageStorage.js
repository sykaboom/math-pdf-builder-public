const TEMP_DIR_NAME = 'msk-temp-images'

const isOpfsSupported = () =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'

const buildFileName = (imageId, extension) => {
  if (!extension) return imageId
  return `${imageId}.${extension}`
}

export class TempImageStorage {
  constructor() {
    this._dirHandle = null
    this._memoryBlobs = new Map()
    this._opfsChecked = false
  }

  async _getDirHandle() {
    if (this._dirHandle) return this._dirHandle
    if (this._opfsChecked) return null
    this._opfsChecked = true
    if (!isOpfsSupported()) return null

    try {
      const root = await navigator.storage.getDirectory()
      this._dirHandle = await root.getDirectoryHandle(TEMP_DIR_NAME, { create: true })
      return this._dirHandle
    } catch (error) {
      this._dirHandle = null
      return null
    }
  }

  async write(imageId, blob, extension) {
    if (!imageId || !blob) return null
    const dir = await this._getDirHandle()
    if (!dir) {
      this._memoryBlobs.set(imageId, blob)
      return { mode: 'memory' }
    }

    const filename = buildFileName(imageId, extension)
    try {
      const handle = await dir.getFileHandle(filename, { create: true })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return { mode: 'opfs', filename }
    } catch (error) {
      this._memoryBlobs.set(imageId, blob)
      return { mode: 'memory' }
    }
  }

  async read(imageId, extension) {
    if (!imageId) return null
    const dir = await this._getDirHandle()
    if (dir) {
      const filename = buildFileName(imageId, extension)
      try {
        const handle = await dir.getFileHandle(filename)
        return await handle.getFile()
      } catch (error) {
        // Fall through to memory cache.
      }
    }
    return this._memoryBlobs.get(imageId) || null
  }

  async remove(imageId, extension) {
    if (!imageId) return
    const dir = await this._getDirHandle()
    if (dir) {
      const filename = buildFileName(imageId, extension)
      try {
        await dir.removeEntry(filename)
      } catch (error) {
        // Ignore missing entries.
      }
    }
    this._memoryBlobs.delete(imageId)
  }

  async clear() {
    const dir = await this._getDirHandle()
    if (dir) {
      try {
        for await (const [name] of dir.entries()) {
          await dir.removeEntry(name)
        }
      } catch (error) {
        // Ignore OPFS cleanup failures.
      }
    }
    this._memoryBlobs.clear()
  }
}
