# Arachne Offensive Suite Vision

This document aligns current capabilities with the target picture of a modern offensive web testing platform and enumerates the future features that drive backend and database work.

## Target Modules (Parity with Burp‑class Tools)

- Repeater: Craft requests, iterate quickly; already partially covered by `requests.send`.
- Intruder/Fuzzer: Param selection, payloads/wordlists, combinators, batching, diffing.
- Active Scanner: Rule‑based probes and response analyzers; prioritization.
- Spider/Crawler: Surface discovery (passive first, optional active).
- Sequencer/Macros: Stateful workflows (logins, CSRF token harvest, multi‑step actions).
- Collaborator/OAST: Out‑of‑band interactions and callback correlation (future).
- Findings: Evidence, severity, workflow (audit/dismiss/fix), CWE/OWASP mapping.
- Extensibility: Rules/payloads as code; safe‑mode and scoping controls.

## What We Already Have

- MITM proxy with a clean plugin model; CA lifecycle and cert store.
- Transaction pipeline: normalized capture, content sampling, basic format detection.
- Project scoping and hot configuration of proxy behavior.
- Heuristic extraction of credentials into reusable `AuthProfile`s.
- Request Editor API path (`requests.send`) usable as Repeater backend MVP.
- Host/Endpoint analytics to focus effort on high‑signal targets.

## What We Need (Backlog Themes)

- Attack Engine + Job Queue and WS progress streams.
- Request Templates from captured transactions + variable substitution.
- Intruder v1 (sniper + battering‑ram) with baseline/diff scoring.
- Scanner v1 with a core rule set and detection service.
- Findings & Evidence data model and CRUD/API.
- Payload Library (builtin + custom); encoders/transformers.
- Sequences/Macros runner with extractors.
- Safety controls (scope, rate, safe‑mode) and audit trail.
- Later: Spider, OAST/Collaborator, advanced encoder chains, distributed execution.

## Milestones (High Level)

1) Templates + Intruder MVP (weeks 1–3):
- Convert transactions to templates; apply `AuthProfile`s.
- Single‑position fuzzing, basic payload sets, live results, diff‑by‑code/body‑len/time.

2) Detection + Scanner (weeks 3–6):
- Rule engine, baseline/diff helpers; initial rule pack (XSS/SQLi/path traversal/redirect).
- Findings model + UI hooks + exports.

3) Sequences + Payload Library (weeks 6–9):
- Macro runner with extract/assign and variables.
- Builtin and custom payload libraries with transforms.

4) Spider + OAST (beyond):
- Passive + guided spider; OAST interactions for SSRF/RCE validation.

See `vision-docs/backend-roadmap.md` and `vision-docs/database-model-roadmap.md` for implementation details and data model proposals.
