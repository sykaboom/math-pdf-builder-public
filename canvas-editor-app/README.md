# Canvas Editor PoC (React + Vite)

This app is a React shell around Canvas-Editor. The editor instance is created inside
`src/editor/initCanvasEditor.js`, while UI panels live in React. The import path
`@hufe921/canvas-editor` is resolved by a Vite alias that points to the local source tree under
`vendor/canvas-editor/canvas-editor-main/src/editor/index.ts`.

## Local setup

```
cd canvas-editor-app
npm install
npm run dev
```

## Offline note

If the environment has no network access, place the Canvas-Editor source under
`vendor/canvas-editor/canvas-editor-main/` (zip extraction is fine). The Vite alias
will load the editor directly from source without installing the npm package.

Note: Canvas-Editor imports `nextTick` from `process`, so a small shim is provided at
`src/shims/process.js`.

## Next steps

- Confirm the correct constructor export from `@hufe921/canvas-editor`.
- Wire toolbar/sidebar actions through a thin adapter to keep UI and engine decoupled.
