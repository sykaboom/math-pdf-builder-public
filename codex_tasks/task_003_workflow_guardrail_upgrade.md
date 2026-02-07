# Task 003: Workflow Guardrail Upgrade (Repo-local)

Status: COMPLETED
Owner: Codex
Date: 2026-02-08

## Goal
- What to change:
  - Upgrade repo workflow governance docs to a stronger Codex-led protocol.
  - Port useful structure from SY-Math-Slate root docs, adapted to this repository paths and scripts.
  - Keep Codex/Gemini identity boundary explicit and non-overlapping.
- What must NOT change:
  - Do not import v10-specific path assumptions (`v10/`, `node scripts/gen_ai_read_me_map.mjs`).
  - Do not change product runtime code or editor behavior.

## Scope
Touched files/directories:
- `AGENTS.md`
- `GEMINI.md`
- `GEMINI_CODEX_PROTOCOL.md`
- `codex_tasks/task_template.md`
- `codex_tasks/task_003_workflow_guardrail_upgrade.md`
- `AI_READ_ME.md`

Out of scope:
- Any production code under `canvas-editor-app/src`, `canvas-app/src`, `js/`, `css/`
- CI or git hooks automation
- Dependency changes

## Dependencies / constraints
- New dependencies allowed? no
- Key guardrails:
  - no window globals in maintained area
  - no eval/new Function
  - sanitize external HTML inputs
  - JSON-safe persistence only
  - if legacy production files (`index.html`, `js/`, `css/`) are changed, update `PATCH_NOTES.txt`

## Acceptance criteria
- [x] `AGENTS.md` includes Codex-led execution loop, approval gate, and repo-local guardrail timing.
- [x] `GEMINI.md` remains independent and read-only oriented for Gemini role.
- [x] `GEMINI_CODEX_PROTOCOL.md` reflects asymmetric roles and SVG handoff model.
- [x] `codex_tasks/task_template.md` upgraded to stronger template with approval/design checks.
- [x] `AI_READ_ME.md` updated for workflow rule changes.

## Manual verification
- Step 1: Read each updated governance file and confirm no `v10/` path assumptions remain.
- Step 2: Confirm scripts in docs use this repo commands (`bash scripts/*.sh`).
- Step 3: Run `bash scripts/check_guardrails.sh`.

## Risks / rollback
- Risk: Overly strict governance may slow small fixes.
- Rollback: keep hotfix path explicit and scoped in docs.

---

## Implementation Log
Status: COMPLETED
Changed files:
- `AGENTS.md`
- `GEMINI.md`
- `GEMINI_CODEX_PROTOCOL.md`
- `codex_tasks/task_template.md`
- `AI_READ_ME.md`
- `AI_READ_ME_MAP.md`
- `codex_tasks/task_003_workflow_guardrail_upgrade.md`

Commands run:
- `bash scripts/scan_guardrails.sh`
- `bash scripts/gen_ai_read_me_map.sh`
- `bash scripts/check_guardrails.sh`
- `rg -n "v10/|gen_ai_read_me_map\\.mjs" AGENTS.md GEMINI.md GEMINI_CODEX_PROTOCOL.md codex_tasks/task_template.md AI_READ_ME.md codex_tasks/task_003_workflow_guardrail_upgrade.md`

Notes:
- This task is documentation-governance only.
