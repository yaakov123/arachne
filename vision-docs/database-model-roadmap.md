# Database — Data Model Roadmap for Offensive Capabilities

This document proposes new entities and adjustments to support active scanning, fuzzing/intruder campaigns, sequences/macros, findings, and evidence — while leveraging current `Transaction`, `Host`, `Endpoint`, and `AuthProfile` models.

## Design Goals

- Preserve `Transaction` as the source of truth for observed traffic and baselines.
- Model offensive actions as explicit, auditable entities (jobs, steps, results).
- Keep large blobs out of hot paths: store samples/slices and references to transactions.
- Enable reproducibility: templates + variables + payload provenance.

## New Core Entities

- RequestTemplate
  - id, projectId, name, description
  - baseTransactionId (reference to `Transaction`) or manual composition
  - parameterMap: JSON of extractable fields with placeholders (positions in headers, path, query, body)
  - defaultVariables: JSON for parameter defaults
  - appliedAuthProfileId? (optional default)
  - createdAt/updatedAt, tags[]

- AttackJob (abstract)
  - id, projectId, type: 'intruder' | 'scanner' | 'sequence' | 'spider'
  - state: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled'
  - scope: hosts[], paths[], methods[] (effective scope)
  - rateLimit, concurrency, safeMode flags; createdBy
  - progress: total/planned, completed, errorCount, startedAt, finishedAt
  - config: JSON (type‑specific)

- IntruderJob extends AttackJob
  - templateId (RequestTemplate)
  - positions: array of parameter locations (header/query/path/body/fragment) with selection meta
  - payloadPlan: { sources: [PayloadSetRef], strategy: 'sniper' | 'battering-ram' | 'pitchfork' | 'cluster-bomb' }

- ScanJob extends AttackJob
  - ruleSetId (RuleSet) and ruleConfigs
  - targetSelection: by endpoints, tags, heuristics (e.g., only 2xx targets)

- Sequence (Macro)
  - id, projectId, name, description, steps: [SequenceStep]
  - variables: definitions with sources and extractors; tags[]
  - Step: one of { TemplateStep(templateId); RequestStep(raw); ExtractorStep(jsonPath/headerRegex); Wait/AssertStep; ScriptStep }

- Findings
  - id, projectId, typeId (FindingType), severity, status: 'open'|'confirmed'|'wontfix'|'fixed'|'dismissed'
  - title, description, remediation, references (CWE/OWASP/links)
  - evidence: [Evidence]
  - firstSeenAt, lastSeenAt, occurrences, tags[]
  - source: 'passive' | 'active'
  - relatedTransactions: [id], relatedJobId?

- Evidence
  - id, findingId, kind: 'response-snippet'|'header'|'diff'|'timing'|'oast'|'screenshot'|'note'
  - transactionId?, responseOffset?, responseLength?, headerName?, note?
  - sampleEncoding: 'utf8'|'base64', sample

- PayloadSet
  - id, projectId?, name, description, kind: 'wordlist'|'generated'|'combinator'
  - values: stored as blobs or external file refs; transform pipeline (encode/url/base64/custom)
  - builtin flag for shipped sets

- RuleSet / Rule
  - id, name, version; enabled rules; configs
  - Rule metadata: category, severity mapping, detector signature

- Interaction (OAST; future)
  - id, token, channel, receivedAt, details JSON; links to finding/job

## Adjustments to Existing Models

- Transaction
  - Keep as is; optionally add small fields for replay provenance (e.g., `metadataType` already present). Avoid mixing active job runtime blobs here.
- AuthProfile
  - No schema change initially; ensure JSON shape supports placements/derivations (already modeled).
- Project
  - Settings may extend with safety defaults: `safeMode`, `defaultRate`, `defaultConcurrency`, `spiderDepth`.

## Relationships (High Level)

- Project 1—N RequestTemplate
- Project 1—N AttackJob (polymorphic)
- AttackJob 1—N AttackResult (implicit via job result records; see below)
- AttackJob N—N Transaction (via produced transactions)
- AttackJob 1—N Finding (optional; scanner/intruder produce findings)
- Finding 1—N Evidence; Finding N—N Transaction
- RequestTemplate N—N AuthProfile (applied during replay)
- Project 1—N PayloadSet; AttackJob references PayloadSet

## Result Recording (Compact)

- AttackResult
  - id, jobId, templateId?, transactionId?, sentAt, status, responseSummary (code, size, time)
  - diffPointers: JSON of structural diffs (headers/body excerpts hashed + offsets)
  - detectorHits: [ruleId, score]
  - error?: message/stack

Persist raw bodies only through `TransactionBody.sample`. Store excerpts/diff‑pointers in results; link back to the transaction for full context.

## Indexing Strategy

- Common filters: by project, job, template, finding severity/status, timestamp.
- Add indexes:
  - `AttackJob`: projectId, type, state, createdAt.
  - `AttackResult`: jobId, transactionId, sentAt.
  - `Finding`: projectId, severity, status, lastSeenAt.
  - `RequestTemplate`: projectId, updatedAt.

## Migration Plan (Phased)

1) Templates & Jobs (intruder v1)
- Add: `RequestTemplate`, `AttackJob` (type = intruder), `AttackResult`, `PayloadSet`.

2) Findings
- Add: `Finding`, `Evidence`, `FindingType` (lookup) and cross‑links to transactions and jobs.

3) Sequences
- Add: `Sequence`, `SequenceStep` (JSON), and execution provenance in `AttackJob` config.

4) Scanner & Rules
- Add: `RuleSet`, `Rule` (or manage rules as code with `RuleSet` as metadata); extend `AttackJob` types.

5) OAST (future)
- Add: `Interaction`, supporting webhooks/listeners in backend.

## Fit with Current Vision

- Transactions remain the authoritative ledger of HTTP I/O.
- Templates bridge passive capture and active replay/mutation.
- Jobs/Results/Findings provide the “offensive” spine with auditability.
- AuthProfiles continue to centralize credential application across engines.

