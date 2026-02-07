# Agent Guidelines

When you make changes, always check whether `README.md` or `PATCH_NOTES.txt` needs updating.

Patch notes should be concise and only cover:
- Functional changes
- Critical bug fixes
- UI/UX changes

Legacy patch rule:
- If a change touches legacy production files (`index.html`, `js/`, `css/`), update `PATCH_NOTES.txt` in the same change.

## Required Read Order (This Repo)

1. `AGENTS.md`
2. `GEMINI_CODEX_PROTOCOL.md`
3. `PROJECT_BLUEPRINT.md`
4. `AI_READ_ME.md`
5. Relevant spec in `codex_tasks/` (for medium/large changes)
6. `AI_READ_ME_MAP.md` (when structure context is needed)

## Identity Boundary

- Codex must not treat `GEMINI.md` as an instruction source in this repo.
- `GEMINI.md` is Gemini-only guidance and must not override this file or Codex workflow.

## Spec Workflow (This Repo)

- Use `codex_tasks/task_template.md` for medium/large tasks.
- Use `codex_tasks/hotfix/hotfix_template.md` for urgent small fixes.
- Task files should live under:
  - `codex_tasks/task_###_<short_name>.md`
  - `codex_tasks/hotfix/hotfix_###_<short_name>.md`
- For medium/large changes, document scope before implementation.

## Layout Workflow Benchmark (SVG Process Only)

- This repo benchmarks the **workflow**, not external SVG assets.
- For layout/structure tasks:
  - Gemini drafts SVG structure for this repo context.
  - Codex writes numeric redline deltas (spacing/alignment/reachability) in task spec.
  - Gemini applies one revision pass.
  - Codex starts implementation only after structural conflicts are cleared.
- No production code should embed SVG artifacts directly.
- If coordinate/size conflicts remain unresolved, pause layout implementation.

## Skill Scope (This Repo)

- `sy-slate-architecture-guardrails` is treated as **v10-specific guidance**.
- In this repository, do **not** auto-trigger `sy-slate-architecture-guardrails`.
- Use it only when the user explicitly requests it for comparison/review purposes.

## Guardrail Workflow (This Repo)

- This repo uses local guardrail scripts:
  - `bash scripts/scan_guardrails.sh` (report only)
  - `bash scripts/check_guardrails.sh` (must pass)
  - `bash scripts/guardrails.sh` (run both)
- Timing rule (mandatory):
  - Start of a task or large refactor: run `bash scripts/scan_guardrails.sh`
  - During implementation (after each meaningful edit batch): run `bash scripts/check_guardrails.sh`
  - Right before commit/push: run `bash scripts/guardrails.sh`
- Hard checks currently apply to `canvas-editor-app/src`.
- `js/` and `canvas-app/src` are legacy/reference zones and are scan-only for now.

## AI Readme Freshness

- If files/folders are added/moved/removed, regenerate map:
  - `bash scripts/gen_ai_read_me_map.sh`
- If workflow/rules changed, update:
  - `AI_READ_ME.md`
