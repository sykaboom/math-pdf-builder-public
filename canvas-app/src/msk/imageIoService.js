import { ImageSourceType } from '@univerjs/core'
import { Subject } from 'rxjs'

export class MskImageIoService {
  constructor(imageStore) {
    this._imageStore = imageStore
    this._waitCount = 0
    this._change$ = new Subject()
    this.change$ = this._change$.asObservable()
    this._imageSourceCache = new Map()
  }

  setWaitCount(count) {
    this._waitCount = count
    this._change$.next(count)
  }

  getImageSourceCache(source, imageSourceType) {
    if (imageSourceType === ImageSourceType.BASE64) {
      const image = new Image()
      image.src = source
      return image
    }
    return this._imageSourceCache.get(source)
  }

  addImageSourceCache(source, imageSourceType, imageSource) {
    if (imageSourceType === ImageSourceType.BASE64 || !imageSource) return
    this._imageSourceCache.set(source, imageSource)
  }

  async getImage(imageId) {
    if (!imageId) return ''
    const url = await this._imageStore.getImageUrl(imageId)
    return url || ''
  }

  async saveImage(imageFile) {
    const result = await this._imageStore.saveFile(imageFile)
    this._waitCount = Math.max(0, this._waitCount - 1)
    this._change$.next(this._waitCount)
    return result
  }
}
