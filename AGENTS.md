# Agent Guidelines

When you make changes, always check whether `README.md` or `PATCH_NOTES.txt` needs updating.

Patch notes should be concise and only cover:
- Functional changes
- Critical bug fixes
- UI/UX changes

## Skill Scope (This Repo)

- `sy-slate-architecture-guardrails` is treated as **v10-specific guidance**.
- In this repository, do **not** auto-trigger `sy-slate-architecture-guardrails`.
- Use it only when the user explicitly requests it for comparison/review purposes.

## Guardrail Workflow (This Repo)

- This repo uses local guardrail scripts:
  - `bash scripts/scan_guardrails.sh` (report only)
  - `bash scripts/check_guardrails.sh` (must pass)
  - `bash scripts/guardrails.sh` (run both)
- Codex must run `bash scripts/check_guardrails.sh` before commit/push after code edits.
- Hard checks currently apply to `canvas-editor-app/src`.
- `js/` and `canvas-app/src` are legacy/reference zones and are scan-only for now.
