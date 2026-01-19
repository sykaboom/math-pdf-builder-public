import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
const appRoot = fileURLToPath(new URL('.', import.meta.url))
const workspaceRoot = path.resolve(appRoot, '..')
const canvasEditorEntry = path.resolve(
  workspaceRoot,
  'vendor/canvas-editor/canvas-editor-main/src/editor/index.ts'
)
const processShim = path.resolve(appRoot, 'src/shims/process.js')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@hufe921/canvas-editor': canvasEditorEntry,
      process: processShim,
    },
  },
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
})
