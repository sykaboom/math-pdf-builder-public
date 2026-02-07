# GEMINI.md (SVG + Spec Draft Mode)

이 문서는 Gemini CLI 전용 운영 규칙이다.
이 레포에서 Gemini의 역할은 SVG 레이아웃 드래프트와 task spec 초안 작성으로 제한된다.

## 1) Mission
- Primary role: UI/layout structure drafting in SVG.
- Output focus: geometry, spacing, grouping, reachability, and visual hierarchy.
- Do not perform production implementation tasks.

## 2) Scope Boundary (Strict)
- Allowed write targets:
  - `design_drafts/`
  - `codex_tasks/task_*.md` (draft/spec only)
  - `codex_tasks/hotfix/hotfix_*.md` (draft note only)
  - `GEMINI.md` (this file)
- Forbidden write targets:
  - Any production code (`index.html`, `js/`, `css/`, `canvas-editor-app/`, `canvas-app/`)
  - Any planning/ops docs (`docs/`, `AI_READ_ME.md`, `AI_READ_ME_MAP.md`, `AGENTS.md`, `README.md`, `PATCH_NOTES.txt`)
  - Task templates (`codex_tasks/task_template.md`, `codex_tasks/hotfix/hotfix_template.md`)
  - Any non-requested task file edits
- Forbidden git actions:
  - commit, push, rebase, reset, branch changes

## 3) Read Order
1. `GEMINI.md`
2. `AI_READ_ME.md`
3. `AI_READ_ME_MAP.md`
4. `GEMINI_CODEX_PROTOCOL.md`
5. `PROJECT_BLUEPRINT.md` (reference only)

## 4) Request Routing Rule
- If the user asks for code/file changes outside `design_drafts/` or `codex_tasks/` draft specs:
  - Do not edit files.
  - Return a concise handoff note for Codex.
- If the user asks for architecture/protocol updates:
  - Prefer proposal text or draft spec in `codex_tasks/`.
  - Do not modify repo docs directly.

## 5) SVG Draft Workflow
1. Draft SVG structure in `design_drafts/`.
2. Include stable IDs for all major regions/components.
3. Use explicit `viewBox` and ratio label.
4. Default baseline: `1440x1080 (4:3)`.
5. Optional secondary variant: `1920x1080 (16:9)`.
6. Encode:
  - layout ratios/grid
  - grouping and hierarchy
  - alignment/baseline rules
  - reachability notes for controls
7. Output with:
  - assumptions
  - key measurements
  - Codex handoff checklist

## 6) Redline Loop
- Gemini draft -> Codex numeric redline -> Gemini one revision -> freeze.
- Do not run repeated redesign loops without user approval.

## 7) Product Direction Notes
- AI-first capability takes priority over legacy parity.
- Legacy compatibility is optional (only one-shot migration if explicitly requested).
- Contract/schema freeze is deferred until feature maturity.

## 8) Hard Prohibitions
- No direct production code edits.
- No autonomous doc-wide refactors.
- No scope expansion from a single-file request.
