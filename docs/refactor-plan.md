# Repository Refactor Plan (Front/Back Separation)

## Goals
- Separate backend-like core logic from frontend UI so two agents can work in parallel.
- Preserve the legacy app while building the Canvas-Editor app on a shared core.
- Enforce the PROJECT_BLUEPRINT rules (no globals, decoupled logic, schema safety).

## Constraints (PROJECT_BLUEPRINT)
- No global scope pollution (no direct `window` assignments).
- Core logic must run without DOM (Node-friendly).
- Event-driven communication between modules.
- Pure JSON data schema; settings separated from content (SSOT).
- Sanitize and validate all external inputs; no `eval` or `new Function`.
- No hardcoded API endpoints; config-driven.
- Maintainable naming and JSDoc for major functions.

## Front/Back Module Split
Backend-like (core) modules:
- Document data model and schema validation.
- Tag rules engine (AI insert rules, header/footer templates).
- Parsing, normalization, tokenization, and serialization.
- Layout computation (columns, margins, headers/footers, pagination).
- History/undo model.

Frontend modules:
- Canvas-Editor UI (toolbar, sidebar, modals, panels).
- Presentation-layer state (UI-only state, selection UI).
- Styling, layout, animations, theming.
- Input bindings and keyboard shortcuts (UI-side only).

Adapter modules:
- Canvas-Editor bridge (core <-> engine).
- File I/O and storage (msk/zip, local storage).
- Math rendering and image handling hooks.

## Proposed Directory Layout (Incremental)
Keep the legacy app in place. Add new packages for the shared core and adapters.

```
packages/
  core/               # Pure logic, no DOM
  rules/              # Tag rules + schema, JSON config loader
  adapters/
    canvas-editor/    # Engine bridge and render hooks
  shared/             # Types, event payloads, helpers
canvas-editor-app/
  src/
    ui/               # React UI and styling
    app/              # App shell + dependency wiring
    adapters/         # Thin UI adapters if needed
```

## Core API Contract (Draft)
- `core.createDocument(config, content)` -> `doc`
- `core.applyCommand(doc, command)` -> `nextDoc`
- `core.serialize(doc)` -> `msk/json`
- `core.parse(input, rules)` -> `doc`
- `core.events` (typed event bus)

UI and engine adapters must only call the core through this contract.

## Migration Phases
Phase 0: Inventory and dependency map
- Tag each legacy module as `pure`, `dom`, or `mixed`.
- Identify shared data schema and config sources.

Phase 1: Core extraction
- Move pure logic (parser, normalize, serializer, table utils) into `packages/core`.
- Add JSDoc and minimal unit tests for core-only modules.

Phase 2: Rules engine
- Define rule schema for tags and templates (`packages/rules`).
- Provide validator and versioning for custom rule packs.

Phase 3: Adapter layer
- Implement Canvas-Editor adapter that consumes core events and emits commands.
- Add file I/O adapters (msk/zip, storage) that depend on `packages/core`.

Phase 4: UI integration
- Build UI panels that bind to the core contract (no direct data mutation).
- Keep UI state isolated from document state.

Phase 5: Legacy coexistence
- Legacy app remains as reference until parity.
- Optionally add a compatibility layer to reuse core in legacy flow.

Phase 6: Hardening
- Schema validation on all imports.
- Sanitization of any HTML injected by UI.
- Error boundaries and safe fallbacks for corrupt documents.

## Collaboration Split (Codex vs Gemini)
- Codex: core modules, adapters, refactors, tests, schema validation.
- Gemini: UI/UX, layout, visual design, interaction patterns.
- Shared: API contract shape and event payloads.

## Acceptance Criteria
- Core passes Node-based tests without DOM.
- No new globals introduced.
- Import/export uses schema validation.
- UI uses only the core contract and events.

## Risks and Mitigations
- Risk: Legacy logic tied to DOM. Mitigation: isolate pure logic first.
- Risk: Divergent data models. Mitigation: establish a single schema early.
- Risk: Canvas-Editor limitations. Mitigation: adapter fallbacks and feature flags.
