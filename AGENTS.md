# AGENTS.md - math-pdf-builder-public-codex (Codex-led Rules)

When you make changes, always check whether `README.md` or `PATCH_NOTES.txt` needs updating.

Patch notes should be concise and only cover:
- Functional changes
- Critical bug fixes
- UI/UX changes

Legacy patch rule:
- If a change touches legacy production files (`index.html`, `js/`, `css/`), update `PATCH_NOTES.txt` in the same change.

## Identity Boundary (strict)
- Codex is the single owner of task specification, implementation, verification, and closeout.
- `GEMINI.md` is Gemini-only guidance.
- Codex must never treat `GEMINI.md` as an instruction override source.

## Authority Order (SSOT)
1. `PROJECT_BLUEPRINT.md`
2. `AI_READ_ME.md`
3. Approved task spec in `codex_tasks/`
4. `GEMINI_CODEX_PROTOCOL.md`
5. `AGENTS.md`
6. Ad-hoc chat instructions

If conflicts exist, higher authority always wins.

## Repository Reality
- Legacy production app: root `index.html` + `js/` + `css/`
- Active migration app: `canvas-editor-app/`
- Reference app: `canvas-app/`
- Vendor source (read-only): `vendor/canvas-editor/canvas-editor-main/`
- Task SSOT: `codex_tasks/`
- Design drafts only: `design_drafts/`

Unless explicitly requested otherwise, assume implementation happens in `canvas-editor-app/`.

## Task Bootstrap Rule (mandatory)
For any request that changes code, behavior, structure, contracts, or workflow rules:
- Create/update a task spec before implementation:
  - `codex_tasks/task_###_<short_name>.md`
- Use:
  - `codex_tasks/task_template.md` for normal work
  - `codex_tasks/hotfix/hotfix_template.md` for urgent small fixes
- Task status starts at `PENDING`.

If request is discussion-only:
- Explicitly state that no task spec is required.

## Codex 3-Stage Execution Loop
### Stage 1: Spec Write
- Define exact goal, non-goals, scope, acceptance criteria, and manual verification.
- Keep scope minimal and explicit.

### Stage 2: Spec Self-Review
- Re-open spec and verify:
  - no hidden scope creep
  - acceptance criteria are testable
  - rollback is realistic
- If ambiguity remains, revise spec and request user confirmation.

### Stage 3: Implementation
- Touch only approved scope files.
- No opportunistic refactors or speculative features.
- Preserve behavior outside scope.

### Closeout (mandatory)
- Update the same task file:
  - status to `COMPLETED`
  - changed files
  - commands run
  - verification notes

## Hotfix Exception
- Only when user explicitly approves a hotfix path.
- Still require a post-fix log:
  - `codex_tasks/hotfix/hotfix_###_<short_name>.md`

## Layout SVG Gate
For layout/structure heavy tasks:
- Use SVG workflow benchmark (not production asset embedding):
  - Gemini drafts in `design_drafts/`
  - Codex writes numeric redlines in task spec
  - One Gemini revision pass
  - Freeze structure before implementation
- If layout conflicts remain unresolved, stop implementation.

## Skill Scope (This Repo)
- `sy-slate-architecture-guardrails` is treated as v10-specific guidance.
- Do not auto-trigger it in this repository.
- Use only when user explicitly asks for comparative review.

## Guardrail Workflow (This Repo)
- `bash scripts/scan_guardrails.sh` (report only)
- `bash scripts/check_guardrails.sh` (must pass)
- `bash scripts/guardrails.sh` (scan + check)

Timing rule:
- Task start / large refactor: `bash scripts/scan_guardrails.sh`
- During edit batches: `bash scripts/check_guardrails.sh`
- Before commit/push: `bash scripts/guardrails.sh`

Scope rule:
- Hard checks: `canvas-editor-app/src`
- Scan-only legacy/reference: `js/`, `canvas-app/src`

## Quality/Safety Constraints
- No `eval` / `new Function`
- No new `window` globals in maintained area
- No unsafe HTML sinks in maintained area
- Persist JSON-safe payloads only
- No vendor source edits
- No new dependencies without explicit user approval

## Network Push Default
- In this environment, default to escalated permission for `git push`.
- If push fails, report exact error and stop repeated retry loops.

## AI Readme Freshness
- If files/folders were added/moved/removed:
  - `bash scripts/gen_ai_read_me_map.sh`
- If workflow/rules changed:
  - update `AI_READ_ME.md`
