const pickConstructor = (module) => {
  if (!module) return null
  if (typeof module.default === 'function') return module.default
  if (module.default && typeof module.default === 'object') {
    if (typeof module.default.Editor === 'function') return module.default.Editor
    if (typeof module.default.CanvasEditor === 'function') return module.default.CanvasEditor
  }
  if (typeof module.Editor === 'function') return module.Editor
  if (typeof module.CanvasEditor === 'function') return module.CanvasEditor
  return null
}

export const initCanvasEditor = async (container, options = {}) => {
  if (!container) {
    throw new Error('Editor container is missing.')
  }

  const module = await import('@hufe921/canvas-editor')
  const EditorCtor = pickConstructor(module)
  if (!EditorCtor) {
    throw new Error('Canvas-Editor constructor not found. Check package exports.')
  }

  const data = options?.data || { main: [{ value: 'Canvas Editor Ready' }] }
  const editorOptions = options?.editorOptions || {}
  const instance = new EditorCtor(container, data, editorOptions)
  const destroy = () => {
    if (typeof instance?.destroy === 'function') instance.destroy()
    if (typeof instance?.dispose === 'function') instance.dispose()
  }

  return { instance, destroy }
}
