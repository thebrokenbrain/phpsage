# AGENTS.md — PHPSage

Execution guide to build PHPSage incrementally, with clean architecture, continuous validation, and end-to-end focus.

## 1) Project objective

PHPSage should provide a modern experience to run PHP static analysis, visualize results in real time, and evolve toward AI/RAG capabilities with security guardrails.

## 2) Operating principles

- Short iterations with verifiable outcomes.
- Maximum WIP: one active iteration.
- Priority: correct observable behavior before refinement.
- Simplicity by default: avoid accidental complexity.
- Every change must be documented within the same iteration.

## 3) Mandatory architecture

Clean Architecture is mandatory in every iteration:

- `domain`: pure business rules, no framework dependencies.
- `application`: use cases and ports.
- `infrastructure`: concrete adapters (fs, http, ws, processes, AI providers, vector store).
- `interfaces`: input/output (CLI, HTTP, UI), without domain logic.

Dependency rule: always point inward.

## 4) Functional scope by phases

### Phase A — Base

- CLI `phpsage phpstan analyse <path>`
- real PHPStan execution with log streaming
- run persistence
- run lifecycle API
- minimal live UI
- base Docker Compose

### Phase B — Non-AI parity

- watch / auto-run
- full navigation (`Dashboard`, `Insights`, `Issue`)
- file explorer + code viewer

### Phase C — AI/RAG

- AI health
- ingest and job status
- explain and suggest-fix (without applying patches automatically)
- robust LLM provider fallback
- patch validation (including `php -l`)

## 5) Implementation rules

- Strong typing in contracts, DTOs, and use cases.
- Side effects encapsulated in infrastructure.
- Maintain observable compatibility during refactors.
- Avoid mass-copy shortcuts without understanding.
- Code generated during assisted development should include English comments when they improve maintainability clarity.

## 6) Documentation rules

Always keep the real project state updated in:

- `README.md` (mandatory, incremental, and never obsolete)
- `docs/API.md`
- `docs/openapi.yaml`
- `docs/UX.md`

Notes:

- `SCHEDULER.md` is out of scope for the current project documentation.
- `INSTRUCTIONS.md` is not required in this phase.
- `docs/API.md` is a living contract and must be updated in every iteration that changes the API.

`README.md` must include, clearly and precisely:

1. Project overview.
2. Technology stack used.
3. Installation and execution.
4. Project structure.
5. Main functionalities.

## 7) Reproducibility

- End-to-end executable flow with Docker Compose.
- Avoid mandatory host dependencies outside containers to operate the product.
- Keep smoke scripts operational when environment/provider wiring changes.

## 8) Definition of Done (summary)

- Phase A: functional end-to-end analysis, correct persistence, operational minimal UI.
- Phase B: stable watch, advanced UX, and complete navigation.
- Phase C: observable AI/RAG, robust fallback, and active guardrails.
