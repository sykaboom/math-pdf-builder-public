import { useEffect, useRef } from 'react'
import { IDocClipboardService } from '@univerjs/docs-ui'
import { initUniver } from './univer/initUniver'
import { exportUniverSnapshot, loadMskPackage, saveMskPackage } from './msk/mskPackage'
import './App.css'

function App() {
  const containerRef = useRef(null)
  const univerRef = useRef(null)
  const imageStoreRef = useRef(null)
  const clipboardDisposableRef = useRef(null)
  const fileInputRef = useRef(null)
  const imageInputRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return undefined
    const { univer, imageStore, clipboardDisposable } = initUniver(containerRef.current)
    univerRef.current = univer
    imageStoreRef.current = imageStore
    clipboardDisposableRef.current = clipboardDisposable
    return () => {
      clipboardDisposableRef.current?.dispose?.()
      univer.dispose()
    }
  }, [])

  const getClipboardService = () => {
    const univer = univerRef.current
    if (!univer) return null
    try {
      return univer.__getInjector().get(IDocClipboardService)
    } catch (error) {
      return null
    }
  }

  const handleSave = async () => {
    const univer = univerRef.current
    const imageStore = imageStoreRef.current
    if (!univer || !imageStore) return

    const name = window.prompt('Save file name', 'document')
    if (name === null) return

    try {
      await saveMskPackage({ univer, imageStore, filename: name })
    } catch (error) {
      window.alert(`Save failed: ${error.message}`)
    }
  }

  const handleExportSnapshot = () => {
    const univer = univerRef.current
    if (!univer) return
    exportUniverSnapshot(univer)
  }

  const handleOpen = () => {
    fileInputRef.current?.click()
  }

  const handleInsertImage = () => {
    imageInputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    const univer = univerRef.current
    const imageStore = imageStoreRef.current
    if (!univer || !imageStore) return

    try {
      await loadMskPackage({ univer, imageStore, file })
    } catch (error) {
      window.alert(`Load failed: ${error.message}`)
    }
  }

  const handleImageChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''

    const clipboardService = getClipboardService()
    if (!clipboardService?.legacyPaste) {
      window.alert('Image insert is not available yet.')
      return
    }

    try {
      await clipboardService.legacyPaste({ files: [file] })
    } catch (error) {
      window.alert(`Image insert failed: ${error.message}`)
    }
  }

  return (
    <div className="app-root">
      <div className="msk-bar">
        <div className="msk-bar-actions">
          <button type="button" onClick={handleInsertImage}>
            Insert Image
          </button>
          <button type="button" onClick={handleSave}>
            Save MSK
          </button>
          <button type="button" onClick={handleOpen}>
            Load MSK/JSON
          </button>
          <button type="button" onClick={handleExportSnapshot}>
            Export Univer JSON
          </button>
        </div>
      </div>
      <div className="univer-root" ref={containerRef} />
      <input
        ref={fileInputRef}
        className="msk-file-input"
        type="file"
        accept=".msk,.json"
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        className="msk-file-input"
        type="file"
        accept="image/*"
        onChange={handleImageChange}
      />
    </div>
  )
}

export default App
