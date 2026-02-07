# AI_READ_ME (repo-local SSOT)

이 문서는 이 레포에서 AI 에이전트가 먼저 파악해야 하는 핵심 맥락을 요약합니다.

## Read order
1. `AGENTS.md`
2. `GEMINI_CODEX_PROTOCOL.md`
3. `PROJECT_BLUEPRINT.md`
4. `docs/repo-guardrails.md`
5. Relevant task spec in `codex_tasks/`
6. `AI_READ_ME_MAP.md` (구조 확인 필요 시)

## Project zones
- Legacy production: root `index.html`, `js/`, `css/`
- Active migration: `canvas-editor-app/`
- Reference PoC: `canvas-app/`
- Read-only vendor: `vendor/canvas-editor/canvas-editor-main/`

## Key invariants
- Legacy zones are reference sources unless a task explicitly requires migration import.
- Maintained area guardrails apply to `canvas-editor-app/src`.
- Exchange contract direction:
  - align toward `NormalizedContent` / `RenderPlan` / `ToolResult`
  - treat schema/version as provisional until implementation maturity
- Do not place provider-specific logic in core modules.

## Guardrail timing
- Task start / large refactor: `bash scripts/scan_guardrails.sh`
- During edit batches: `bash scripts/check_guardrails.sh`
- Before commit/push: `bash scripts/guardrails.sh`

## Doc freshness rules
- Structure changed (files/folders): regenerate `AI_READ_ME_MAP.md`
  - `bash scripts/gen_ai_read_me_map.sh`
- Workflow/rules changed: update this file (`AI_READ_ME.md`)
