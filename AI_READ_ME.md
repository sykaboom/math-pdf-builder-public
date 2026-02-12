# AI_READ_ME (repo-local SSOT summary)

이 문서는 이 레포에서 AI 에이전트가 먼저 파악해야 하는 운영 기준을 요약합니다.
실무 시작점은 `AGENTS.md`로 두되, 권한 충돌 시 최종 판단은 아래 SSOT 순서를 따릅니다.

## Decision authority (SSOT)
1. `PROJECT_BLUEPRINT.md`
2. `AI_READ_ME.md`
3. Approved task spec in `codex_tasks/`
4. `GEMINI_CODEX_PROTOCOL.md`
5. `AGENTS.md`
6. Ad-hoc chat instructions

## Read order (practical)
1. `AGENTS.md`
2. `GEMINI_CODEX_PROTOCOL.md`
3. `PROJECT_BLUEPRINT.md`
4. Relevant task spec in `codex_tasks/`
5. `docs/repo-guardrails.md`
6. `AI_READ_ME_MAP.md` (structure lookup only)

## Project zones
- Legacy production: root `index.html`, `js/`, `css/`
- Active migration: `canvas-editor-app/`
- Reference PoC: `canvas-app/`
- Read-only vendor: `vendor/canvas-editor/canvas-editor-main/`
- Design drafts only: `design_drafts/`
- Task/playbook area:
  - `codex_tasks/`
  - `codex_tasks/_PLAYBOOK_subagent_oneclick.md` (supplemental; not authority override)
- Task SSOT:
  - approved task spec in `codex_tasks/`

## Execution model
### spec-gated default
- Task request:
  - write/update spec in `codex_tasks/` (`PENDING`)
  - self-review scope/acceptance/rollback/speculative defense
  - user approval gate
  - implement approved scope only
  - close out same spec as `COMPLETED`
- Discussion-only request:
  - explicitly state that no task spec is required

### delegated mode (one-click)
- User can approve a bounded task chain once.
- Baseline role set:
  - Spec-Writer
  - Spec-Reviewer
  - Implementer-A/B/C
  - Reviewer+Verifier
- Codex retains final ownership:
  - spec lock
  - merge decision
  - completion status
- File ownership lock is required for parallel branches.

### Escalation and fallback
- User confirmation required for:
  - breaking change
  - new dependency
  - security/cost policy impact
  - data migration
  - layout task needing Gemini SVG draft
- If sub-agent runtime is unavailable:
  - fallback to single-Codex mode with same spec gates.

## Layout and Gemini boundary
- Gemini is SVG/layout specialized only.
- Layout/structure tasks require:
  - SVG in `design_drafts/`
  - explicit `viewBox` and ratio label
  - numeric redline in task spec
  - structure freeze before implementation
- Required tablet viewports for ink UX checks:
  - 768x1024
  - 820x1180
  - 1024x768
  - 1180x820

## Key invariants
- No vendor edits.
- No `eval` / `new Function`.
- No new `window` globals in maintained area.
- No unsafe HTML sinks in maintained area.
- Persist JSON-safe payloads only.
- Provider/model-specific logic stays in adapter boundaries.
- Legacy patch rule:
  - if `index.html`, `js/`, or `css/` changes, update `PATCH_NOTES.txt`.

## Guardrail timing
- Task start / large refactor:
  - `bash scripts/scan_guardrails.sh`
- During edit batches:
  - `bash scripts/check_guardrails.sh`
- Before commit/push:
  - `bash scripts/guardrails.sh`

## Task templates and logs
- Standard task template:
  - `codex_tasks/task_template.md`
- Hotfix template:
  - `codex_tasks/hotfix/hotfix_template.md`
- Every task/hotfix must log:
  - changed files
  - commands run
  - verification notes
  - failure classification when applicable

## Doc freshness rules
- Structure changed (files/folders):
  - run `bash scripts/gen_ai_read_me_map.sh`
  - verify `AI_READ_ME_MAP.md`
- Workflow/rules/semantics changed:
  - update this file (`AI_READ_ME.md`)
