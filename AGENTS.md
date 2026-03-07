# AGENTS.md - PHPSage

Execution guide for incremental development with clean architecture, continuous validation, and end-to-end reproducibility.

## 1) Project Objective

PHPSage provides a modern PHP static-analysis experience:

- run and inspect PHPStan analyses
- stream logs and persist run history
- navigate results in a live UI
- provide AI/RAG assistance with safety guardrails

## 2) Current Implementation Snapshot (March 2026)

Implemented today:

- Infrastructure:
  - Pulumi project under `infra/`
  - Hetzner server, firewall and SSH key registration
  - Cloudflare DNS and optional Zero Trust
- CLI:
  - `phpsage app`
  - `phpsage phpstan analyse <path>` (+ watch, timeout, json summary)
  - `phpsage rag ingest` (+ list/wait/filter)
- Server API:
  - runs lifecycle + source/files endpoints
  - AI health + ingest jobs + explain + suggest-fix
- Web UI:
  - Dashboard/Insights/Issue navigation
  - run controls, live updates, file/code navigation
  - AI Assist with explain/suggest-fix and debug toggle
  - Insights KPIs + charts
- AI:
  - OpenAI and Ollama support
  - RAG context retrieval (filesystem/qdrant modes)
  - suggest-fix guardrails (`diff checks`, heuristics, `php -l`)

## 3) Operating Principles

- Short iterations with verifiable outcomes.
- Maximum WIP: one active iteration.
- Observable behavior correctness first, refinements second.
- Keep implementation simple; avoid accidental complexity.
- Document every functional/API/UX change in the same iteration.

## 4) Mandatory Architecture

Clean Architecture is mandatory:

- `domain`: business rules only
- `application`: use cases and ports
- `infrastructure`: adapters (fs/http/ws/process/AI/vector)
- `interfaces`: CLI/HTTP/UI orchestration without domain logic

Dependency rule: always point inward.

## 5) Documentation Rules

Keep these always aligned with real behavior:

- `README.md`
- `docs/API.md`
- `docs/openapi.yaml`
- `docs/UX.md`

Mandatory README sections:

1. Project overview
2. Technology stack
3. Installation and execution
4. Project structure
5. Main functionalities

## 6) Reproducibility Rules

- End-to-end operation via Docker Compose.
- Do not require host-only dependencies for normal product operation.
- Keep smoke scripts operational when changing provider/environment wiring.
- Keep infrastructure automation isolated under `infra/` and reproducible with its documented `docker-only` workflow.

## 7) Definition of Done (Phase Summary)

- Phase A: end-to-end analysis, persistence, basic live UI
- Phase B: stable watch + full non-AI navigation UX
- Phase C: observable AI/RAG with fallback + active guardrails

## 8) Immediate Direction

Prioritize:

- UX hardening and consistency for production-like workflows
- API contract consistency across `docs/API.md` and `docs/openapi.yaml`
- regression-safe improvements (tests + smokes for changed behavior)
