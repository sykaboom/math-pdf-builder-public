# Repo Guardrails (math-pdf-builder-public-codex)

## Goal
Prevent spaghetti code while `legacy js` and `new canvas-editor-app` coexist.

## Scope
- Maintained area (hard checks): `canvas-editor-app/src`
- Legacy/reference areas (scan only): `js`, `canvas-app/src`
- Vendor area (read-only): `vendor/canvas-editor/canvas-editor-main`

## Commands
- Full report + gate: `bash scripts/guardrails.sh`
- Report only: `bash scripts/scan_guardrails.sh`
- Gate only: `bash scripts/check_guardrails.sh`

## Timing (Simple)
1. Start of a big refactor: run `scan_guardrails.sh`
2. Before commit/push: run `check_guardrails.sh` (mandatory)
3. If check fails: fix or explicitly scope why it is deferred

## Current hard rules
1. No `eval` / `new Function` in maintained area
2. No `window` global assignment in maintained area
3. No `innerHTML` / `dangerouslySetInnerHTML` in maintained area
4. `canvas-editor-app/src` files must stay under 900 lines
5. Vendored Canvas-Editor source is read-only in this repo
