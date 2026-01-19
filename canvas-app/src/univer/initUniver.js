import {
  DEFAULT_EMPTY_DOCUMENT_VALUE,
  DocumentFlavor,
  IImageIoService,
  LocaleType,
  mergeLocales,
  PageOrientType,
  PAGE_SIZE,
  PaperType,
  Univer,
  UniverInstanceType,
} from '@univerjs/core'
import { UniverDocsPlugin } from '@univerjs/docs'
import { UniverDocsDrawingPlugin } from '@univerjs/docs-drawing'
import { UniverDocsUIPlugin, IDocClipboardService } from '@univerjs/docs-ui'
import { UniverDrawingPlugin, ImageSourceType } from '@univerjs/drawing'
import { UniverFormulaEnginePlugin } from '@univerjs/engine-formula'
import { UniverRenderEnginePlugin } from '@univerjs/engine-render'
import { UniverUIPlugin } from '@univerjs/ui'
import koKRDocs from '@univerjs/docs-ui/locale/ko-KR'
import koKRUI from '@univerjs/ui/locale/ko-KR'
import { MskImageStore } from '../msk/imageStore'
import { MskImageIoService } from '../msk/imageIoService'

const LOCALE = LocaleType.KO_KR
const LOCALES = {
  [LOCALE]: mergeLocales(koKRUI, koKRDocs),
}

const buildEmptyDocSnapshot = () => ({
  id: 'doc-1',
  documentStyle: {
    documentFlavor: DocumentFlavor.TRADITIONAL,
    pageOrient: PageOrientType.PORTRAIT,
    pageSize: PAGE_SIZE[PaperType.A4],
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
  },
  body: {
    dataStream: DEFAULT_EMPTY_DOCUMENT_VALUE,
    customBlocks: [],
    customRanges: [],
    paragraphs: [{ startIndex: 0 }],
    textRuns: [],
    tables: [],
    sectionBreaks: [],
  },
  drawings: {},
  drawingsOrder: [],
})

const registerClipboardHook = (univer, imageStore) => {
  let clipboardService = null
  try {
    clipboardService = univer.__getInjector().get(IDocClipboardService)
  } catch (error) {
    return null
  }

  return clipboardService.addClipboardHook({
    onBeforePasteImage: async (file) => {
      try {
        const entry = await imageStore.ingestBlob(file, { mime: file.type })
        if (!entry) return null
        const url = await imageStore.getImageUrl(entry.imageId)
        if (!url) return null
        return { source: url, imageSourceType: ImageSourceType.URL }
      } catch (error) {
        return null
      }
    },
  })
}

export const initUniver = (container) => {
  const imageStore = new MskImageStore()
  const imageIoService = new MskImageIoService(imageStore)
  const univer = new Univer({
    locale: LOCALE,
    locales: LOCALES,
    override: [[IImageIoService, { useValue: imageIoService }]],
  })

  univer.registerPlugin(UniverRenderEnginePlugin)
  univer.registerPlugin(UniverFormulaEnginePlugin)
  univer.registerPlugin(UniverDrawingPlugin, {
    override: [[IImageIoService, { useValue: imageIoService }]],
  })
  univer.registerPlugin(UniverUIPlugin, {
    container,
    header: true,
    toolbar: true,
    footer: true,
  })
  univer.registerPlugin(UniverDocsPlugin)
  univer.registerPlugin(UniverDocsDrawingPlugin)
  univer.registerPlugin(UniverDocsUIPlugin, {
    container,
    layout: {
      docContainerConfig: {
        header: true,
        footer: true,
        toolbar: true,
      },
    },
  })

  univer.createUnit(UniverInstanceType.UNIVER_DOC, buildEmptyDocSnapshot())

  const clipboardDisposable = registerClipboardHook(univer, imageStore)

  return { univer, imageStore, clipboardDisposable }
}
