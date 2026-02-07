# GEMINI_CODEX_PROTOCOL.md (repo-local)

## Purpose
This file defines the collaboration workflow for this repository.
Priority order for decisions:
1. `AGENTS.md`
2. `PROJECT_BLUEPRINT.md`
3. `AI_READ_ME.md`
4. Approved task spec in `codex_tasks/`
5. Ad-hoc chat instructions

## Repo reality
- Legacy production app: root `index.html` + `js/` + `css/`
- Active migration app: `canvas-editor-app/`
- Reference PoC app: `canvas-app/`
- Vendor source (read-only): `vendor/canvas-editor/canvas-editor-main/`

## Role split (default)
- Codex: implementation, refactor, migration, verification
- Gemini: optional architecture review and visual/interaction guidance

## Spec workflow (recommended default)
1. Create/choose a task spec in `codex_tasks/` for medium or large changes.
2. Get user confirmation on scope when requirements are ambiguous.
3. Implement only within spec scope.
4. Run guardrails during work and before commit:
   - `bash scripts/check_guardrails.sh`
   - `bash scripts/guardrails.sh` before commit/push
5. Update the same task file with implementation log and status.

## Hotfix exception
- Urgent, small-scope fixes may skip pre-spec only when user explicitly approves.
- After fix, add a short log under `codex_tasks/hotfix/`.

## Guardrails reminder
- No new `window` globals in maintained area.
- No `eval` / `new Function`.
- No unsafe HTML sinks in maintained area.
- Keep vendor source read-only in this repo.
- Keep exchange contract compatible (`NormalizedContent` first).
- If legacy production files (`index.html`, `js/`, `css/`) are patched, include a concise `PATCH_NOTES.txt` update.
