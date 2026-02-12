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

## Core Principle (non-negotiable)
Codex owns the full execution loop:
- spec writing
- spec review
- implementation
- verification
- closeout

Gemini may assist only through SVG layout drafts. No other agent owns final decisions.

## Task Bootstrap Rule (mandatory)
When a request arrives:
- Codex must first determine if it is a task.
- If task (any change to code/behavior/structure/contracts/workflow):
  - Create or update a task spec before implementation:
    - `codex_tasks/task_###_<short_name>.md`
  - Use:
    - `codex_tasks/task_template.md` for normal work
    - `codex_tasks/hotfix/hotfix_template.md` for urgent fixes
  - Task status starts at `PENDING`.
- If discussion-only:
  - Explicitly state: "No task spec required for this request."

## Codex 3-Stage Execution Loop
### Stage 1: Spec Write
- Define exact goal, non-goals, scope, acceptance criteria, manual verification, and rollback notes.
- Keep scope minimal and explicit.

### Stage 2: Spec Self-Review
- Re-open spec and verify:
  - no hidden scope creep
  - acceptance criteria are testable
  - rollback is realistic
  - no speculative "just in case" branches
- If ambiguity remains:
  - revise spec
  - request user confirmation (manual mode)
  - continue only inside approved delegated window (delegated mode)

### Stage 3: Implementation
- Touch only approved scope files.
- No opportunistic refactors or speculative features.
- Preserve behavior outside scope.
- Run required checks when relevant:
  - `cd canvas-editor-app && npm run lint`
  - `cd canvas-editor-app && npm run build`
- If failures occur, classify:
  - pre-existing vs newly introduced
  - blocking vs non-blocking

### Closeout (mandatory)
- Update the same task file:
  - status to `COMPLETED`
  - changed files
  - commands run
  - verification notes

## One-click Delegated Execution Mode (Codex-orchestrated)
Activation:
- User gives one delegated instruction for a scoped chain (example: "승인. task_004~009 위임 실행.").
- Delegation stays valid until chain completion, explicit user stop, or escalation.

Required 6-role set:
- Spec-Writer
- Spec-Reviewer
- Implementer-A
- Implementer-B
- Implementer-C
- Reviewer+Verifier

Execution rules:
- No per-task repeated approval prompts inside the delegated chain.
- Codex keeps final authority for spec lock, merge decision, and completion status.
- Reviewer+Verifier runs one pass only (no infinite loop).
- One file can be owned by only one implementer at a time (file ownership lock).
- If ownership conflict appears, switch affected branches to sequential execution.

Parallel planning rules (DAG + waves):
- Split tasks by explicit dependency edges.
- Run independent nodes in parallel waves.
- Respect runtime sub-agent concurrency limit (baseline: 6).
- Reuse role types across waves instead of keeping idle agents pinned.

Escalation conditions (must request user confirmation):
- Breaking change
- New dependency
- Security or cost policy impact
- Data migration requirement
- Layout task requiring Gemini SVG draft request

Fallback:
- If sub-agent runtime is unavailable or disabled, continue in single-Codex mode with identical spec gates.

## Gemini Interaction Rule (SVG-only)
Gemini is a specialized layout assistant, not a peer executor.

Codex may:
- request SVG drafts under `design_drafts/`
- use SVG as structural input

Codex must:
- verify SVG file existence before layout implementation
- write numeric redlines in task spec
- request one revision pass only
- freeze structure before coding

Codex must not:
- delegate spec ownership to Gemini
- delegate validation/approval decisions
- allow layout changes without the SVG gate

## SVG Layout Gate (hard stop)
Any task involving:
- layout
- panel/drawer/overlay structure
- canvas or writing-surface geometry

Must satisfy:
- SVG exists under `design_drafts/`
- SVG includes explicit `viewBox` and ratio label
- numeric redlines are resolved in task spec

If unresolved layout conflict remains, stop implementation.

## Tablet Ink UX Governance (layout tasks)
Required viewports:
- 768 x 1024
- 820 x 1180
- 1024 x 768
- 1180 x 820

Rules:
- Writing continuity > visual polish
- No overlay may unexpectedly block pointer paths
- Close/recover actions must be immediately reachable
- Coordinate conflicts block implementation

Recommended implementation order:
1. app shell
2. panel/drawer
3. footer controls
4. overlays

## Hotfix Exception
- Allowed only when user explicitly approves a hotfix path.
- Must still create post-fix log:
  - `codex_tasks/hotfix/hotfix_###_<short_name>.md`

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

## Forward Compatibility Invariants
- Contracts are backward-compatible by default.
- Breaking contract change requires:
  - version bump
  - migration path
- Provider/model/service-specific logic stays in adapter layers.
- Core/contract layer remains generic.
- Refactors must be:
  - small-batch
  - behavior-preserving
  - layer-safe

## AI Readme Freshness
- If files/folders were added/moved/removed:
  - `bash scripts/gen_ai_read_me_map.sh`
- If workflow/rules changed:
  - update `AI_READ_ME.md`

## Binding Summary
- Codex is the single execution authority.
- Specs are contracts, not suggestions.
- Gemini is SVG-only in this repo.
- Speed comes from clear gates, not uncontrolled parallelism.
