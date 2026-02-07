# Repository Refactor Plan (Session-Aligned)

Date: 2026-02-07  
Scope: `math-pdf-builder-public-codex`

## Session Alignment (What changed from old draft)
- This repo remains the editor implementation workspace.
- Platform-level integration (MCP gateway, community hub, API orchestration) is planned in the Next.js hub side (v10 ecosystem), not by rewriting this repo first.
- Cross-app interoperability is direction-first for now:
  - align with `NormalizedContent`/`RenderPlan`/`ToolResult` style
  - keep schemas draft-level until both apps have more real features
  - freeze versions later with migration notes
- Legacy compatibility is not a mandatory product requirement.
- Long-term compatibility target includes external classroom document formats:
  - `.hwpx`
  - `.docx` (preferred over legacy binary `.doc`)
  - optional `.doc` via conversion bridge
- Long-term ingestion target includes scanned/digital PDF:
  - `PDF -> Multimodal LLM -> NormalizedContent -> editor model`
  - human-review and confidence gates are required before commit/save

## Current Runtime Zones
- Production legacy zone: root `index.html`, `js/`, `css/`
- Legacy canvas PoC zone (reference only): `canvas-app/`
- Active migration zone: `canvas-editor-app/`
- Vendor zone (read-only): `vendor/canvas-editor/canvas-editor-main/`

## Hard Constraints
- No direct `window` globals in maintained code.
- No `eval` / `new Function`.
- No unsafe HTML sinks in maintained code.
- Persist JSON-safe payloads only.
- Do not modify vendor source in this repo; extend via wrappers/adapters.

See also: `docs/repo-guardrails.md`

## Architecture Direction

### 1) Core and adapter separation
- Core-like modules own document model, schema validation, conversion, and command model.
- UI owns view state and interaction widgets only.
- Engine-specific logic stays in adapters.

### 2) Contract-first interoperability
- Internal editor format and legacy format are not exchange contracts.
- Current phase policy:
  - keep exchange model draft and lightweight
  - avoid hard schema freeze too early
  - co-evolve with v10 while preserving clear naming and boundaries
- Later freeze target (after core features land):
  - `NormalizedContent`
  - `RenderPlan` (optional)
  - `TTSScript` (when audio script exists)
  - `ToolResult`

### 3) MCP-ready tool flow
- No ad-hoc direct parsing from LLM output into editor document.
- Tool output path:
  - Tool/MCP -> `ToolResult` -> `NormalizedContent` -> editor adapter
- Keep model/provider-specific logic outside core.

### 4) External format bridge boundary
- External file compatibility is a bridge concern, not core editor concern.
- Keep format-specific parsing/writing in adapters or isolated services.
- Recommended long-term bridge route:
  - `.hwpx/.docx` <-> normalized draft payload <-> editor model
  - use AI assist for semantic recovery (labels, problem structure), not for raw binary parsing.
- Avoid coupling UI flows directly to format internals.

### 5) PDF multimodal ingestion boundary
- PDF ingestion should not bypass normalized contracts.
- Required flow:
  - PDF input -> multimodal extraction result (`ToolResult`)
  - normalize to `NormalizedContent`
  - validation + confidence scoring
  - user review/approval
  - commit to editor document
- Keep model/provider-specific prompts outside core modules.
- Cost policy:
  - core editing and DOCX exchange path must run without premium LLM calls
  - premium/API LLM is fallback for low-confidence fragments only

## Proposed Incremental Layout
```
packages/
  contracts/          # Draft exchange types and schema candidates (not frozen yet)
  core/               # Pure logic (parse/normalize/serialize/commands), no DOM
  adapters/
    canvas-editor/    # canvas-editor bridge
    migration-tools/  # optional one-shot import tools
canvas-editor-app/
  src/
    app/              # wiring
    ui/               # visual components
    editor/           # engine bootstrap wrappers
docs/
  refactor-plan.md
  canvas-editor-legacy-plan.md
  repo-guardrails.md
```

## Migration Phases

### P0. Guardrail baseline (done)
- Repo-specific guardrail scripts and timing rules added.
- `scan` at task start, `check` during batches, full `guardrails` before commit/push.

### P1. Contract mirror in this repo
- Add draft contract definitions for exchange payloads.
- Mark as provisional and revise with real feature feedback from both apps.
- Do not freeze major version until both sides validate real scenarios.

### P2. Adapter-first data bridge
- Implement conversion functions:
  - AI/tool output -> normalized draft payload -> canvas-editor doc input
  - optional one-shot legacy json/msk import -> normalized draft payload
- Legacy compatibility path is optional migration tooling, not a long-term runtime requirement.

### P3. Canvas editor feature migration
- Move legacy features by domain (not by screen):
  - text/math blocks
  - blanks/concept blanks
  - image/table
  - page/header/footer/columns
- Each domain ships with adapter tests and backward-load checks.

### P4. MCP integration point
- Define a stable boundary for tool ingestion:
  - input: `ToolResult`
  - output: `NormalizedContent`
- Keep network/provider policy outside editor core.

### P5. Legacy coexistence and cutover
- Legacy root app is reference-only unless explicitly needed.
- Retire legacy paths when AI-first feature gates are met.

### P6. External format interoperability (long-term)
- Define minimal import/export scenarios first (text/math/image/table).
- Prioritize `.hwpx/.docx` compatibility.
- Treat legacy `.doc` as optional bridge path through pre-conversion tooling.
- Add regression fixtures for round-trip checks at adapter boundary.

### P7. PDF -> multimodal -> editor pipeline (long-term)
- Start with import-only (no guaranteed round-trip).
- Scope v1 to classroom-critical blocks:
  - paragraph/run
  - equation tokens
  - image/table anchors
- Include quality gates:
  - block-level confidence threshold
  - unresolved fragment queue for manual fix
  - audit trace from source PDF span to normalized block

## Acceptance Criteria
- `canvas-editor-app` remains guarded by repo rules (`scripts/check_guardrails.sh` passes).
- Tool ingestion path is normalized and provider-agnostic (no parser-by-provider sprawl).
- Exchange contract remains clearly documented as draft/provisional until freeze decision.
- Migration plan does not require editing vendored engine source.

## Risks and Mitigations
- Risk: contract drift between repos.
  - Mitigation: shared naming conventions now, version freeze later.
- Risk: mixed old/new paths causing spaghetti.
  - Mitigation: adapter boundary and phased domain migration.
- Risk: freezing schema too early can block product iteration.
  - Mitigation: keep draft contract stage until implementation maturity.
- Risk: vendor engine limits.
  - Mitigation: wrapper strategy and fallback behavior per domain.
- Risk: multimodal extraction hallucination or math layout loss from PDF.
  - Mitigation: confidence gating, manual review queue, and source-span traceability.
