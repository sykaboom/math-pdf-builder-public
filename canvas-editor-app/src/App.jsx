import { useEffect, useRef, useState } from 'react'
import { initCanvasEditor } from './editor/initCanvasEditor'
import './App.css'

function App() {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const destroyRef = useRef(null)
  const [status, setStatus] = useState('Loading engine...')

  useEffect(() => {
    if (!containerRef.current) return undefined
    let active = true

    const start = async () => {
      try {
        const { instance, destroy } = await initCanvasEditor(containerRef.current, {
          editorOptions: {
            pageBorder: { disabled: false },
          },
        })
        editorRef.current = instance
        destroyRef.current = destroy
        if (active) {
          setStatus('Ready')
        }
      } catch (error) {
        if (active) {
          const message = error instanceof Error ? error.message : String(error)
          setStatus(`Init failed: ${message}`)
        }
      }
    }

    void start()

    return () => {
      active = false
      destroyRef.current?.()
      destroyRef.current = null
      editorRef.current = null
    }
  }, [])

  return (
    <div className="app-root">
      <div className="app-header">
        <div className="app-title">Canvas Editor PoC</div>
        <div className="app-status">{status}</div>
      </div>
      <div className="app-body">
        <div className="app-panel">
          <div className="panel-title">Controls</div>
          <div className="panel-body">
            UI hooks for toolbar, sidebar, and metadata will live here.
          </div>
        </div>
        <div className="editor-shell">
          <div className="editor-canvas" ref={containerRef} />
        </div>
      </div>
    </div>
  )
}

export default App
