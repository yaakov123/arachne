# Frontend UX Spec — Offensive Capabilities

This document details the user experience for introducing offensive features (Intruder/Fuzzer, Scanner, Templates/Replay, Findings, Sequences/Macros, Payload Library) into the existing Vue 3 + Vite app. It aligns with the backend and database roadmaps.

## Goals

- Provide a coherent, efficient workflow from passive capture → template → attack → findings → remediation.
- Keep the UI fast and approachable; progressive disclosure for power features.
- Real‑time feedback for long‑running jobs; everything is auditable and reproducible.

## Information Architecture

- Sidebar Navigation
  - Traffic (existing)
  - Editor (existing)
  - Findings (new)
  - Intruder (new)
  - Scanner (new)
  - Templates (new)
  - Payloads (new)
  - Settings (existing)

- Primary Routes
  - `/` → Traffic Logger
  - `/request-editor` → Request Editor
  - `/findings` → Findings List + Detail
  - `/intruder` → Intruder Jobs (list + job detail)
  - `/scanner` → Scanner (new scan wizard + running scans)
  - `/templates` → Request Templates (list + builder)
  - `/payloads` → Payload Library (list + editor/import)
  - `/settings?tab=...` → existing; expand with attack defaults later

## Global UX Patterns

- Job Status & Controls
  - Compact job row with status badge (queued/running/paused/completed/failed), rate, ETA, progress bar, actions (pause/resume/cancel/clone).
- Diff & Baseline
  - Consistent result detail layout showing baseline vs. selected result: status/time/size deltas, response snippet diff, header diffs.
- Evidence & Linkage
  - Every result/finding links back to the originating template and captured transaction(s).
- Reuse Existing Components
  - Use `TabContainer`, `MonacoEditor`, `RequestResponseViewer` patterns; add `DiffViewer`, `JobStatusBadge`, `ResultsTable`.
- Real‑Time Feedback
  - Subscribe to WS channels for jobs/intruder/scanner; optimistic UI with graceful fallbacks.

## Logger Enhancements (Traffic View)

- Transaction Quick Actions (RequestResponseViewer header)
  - Open in Editor (existing pattern) → routes to `/request-editor` with transaction preloaded.
  - Create Template → opens Template Builder prefilled from transaction.
  - Add To Intruder → opens Intruder Job Wizard with this request as baseline and parameter detection preselected.
  - Create Finding (manual) → opens modal to record observation (title, severity, tags) attached to this txn.
- Batch Selection
  - Checkbox select in `TrafficList` rows to build a sequence or multi‑target intruder job.

## Templates

- Templates List `/templates`
  - Columns: Name, Host, Method/Path, Updated, Tags, Default Auth (badge), Actions (Edit, Use in Intruder, Delete).
  - Filters: host, method, tags, text search.

- Template Builder `/templates/:id` or `Create`
  - Layout
    - Left: Parameter Map (tree of locations: path, query, headers, body). Each entry shows name, type, default value, and enable toggle.
    - Center: Request Preview (Monaco) with variable placeholders highlighted; toggles for raw/pretty.
    - Right: Variables & Auth — default variables, choose Auth Profile to apply; test send button.
  - Actions: Save, Save & Test (sends via backend; shows response preview bottom panel), Duplicate, Delete.
  - Smart Extraction: initial auto‑parameterization from transaction (numeric ids, GUIDs, tokens, repeated values in body/query/headers).

## Intruder (Fuzzer)

- Intruder Jobs List `/intruder`
  - Create Job button: opens wizard to pick Template(s).
  - Table columns: Name, Status, Progress, Requests Sent, Findings Hits, Updated, Actions.

- Create Job Wizard
  - Step 1: Select Template(s) or build from Transaction.
  - Step 2: Positions — choose parameter locations; inline preview; auto‑detect sensitive tokens (preselected with warning).
  - Step 3: Payloads — assign payload sets per position; choose strategy (Sniper, Battering Ram initially).
  - Step 4: Options — rate limit, concurrency, retry, stop on 429/5xx, safe‑mode hints, auth profile override.
  - Step 5: Review — summary and Start button.

- Job Detail `/intruder/:jobId`
  - Header: status controls, metrics (rps, avg time, errors, ETA), scope info.
  - Tabs
    - Results: virtualized table
      - Columns: Index, Payloads (per position), Status, Time, Length, Delta from baseline, Markers (reflections, keyword hits).
      - Row click → Result Detail.
    - Baseline: baseline response snapshot, set baseline from a specific run.
    - Positions/Payloads/Options: read‑only of job config (edit creates a new job version).
  - Result Detail Panel
    - Side‑by‑side diff (headers and body snippets) vs. baseline.
    - Markers: highlights for reflections, error signatures, timing anomalies.
    - Actions: Promote to Finding; Open in Editor; Save as Template.

## Scanner

- Scanner Home `/scanner`
  - Start Scan button → Scan Wizard.
  - Running Scans list: status, scope, ruleset, progress, findings count; actions (pause/resume/stop).

- Scan Wizard
  - Scope: host(s)/path(s)/methods; include/exclude patterns; depth; safe‑mode flags.
  - Rules: choose ruleset; enable/disable categories; thresholds (aggressiveness/timeouts).
  - Options: rate/concurrency; auth profile; retries; JS rendering (future toggle, off by default).
  - Review & Start.

- Scan Detail `/scanner/:scanId`
  - Summary: stats (requests sent, avg time), distribution of statuses, top endpoints.
  - Findings Tab: list (same component as `/findings` but filtered by scan).
  - Activity Tab: timeline and recent requests (compact table) with links to transactions.

## Findings

- Findings List `/findings`
  - Filters: severity, status, category, tag, source (passive/active), host; full‑text search.
  - Table: Title, Severity, Status, First Seen, Last Seen, Occurrences, Source, Actions.
  - Bulk actions: change status, tag, export.

- Finding Detail `/findings/:id`
  - Header: title, severity, status picker, tags, created/updated.
  - Evidence Tab: gallery of evidence blocks (response snippet, header snapshot, timing chart, OAST callback), each links to transaction/result.
  - Details Tab: description, remediation, references (CWE/OWASP), related jobs/transactions.
  - Actions: Confirm, Dismiss, Add Note, Export Report (Markdown/JSON).

## Sequences/Macros (Future Phase)

- Sequences List `/sequences`
  - Columns: Name, Steps, Variables, Updated, Tags.

- Sequence Builder `/sequences/:id`
  - Left: Steps (reorderable). Types: TemplateStep, RequestStep, ExtractorStep, Assert/Wait, Script.
  - Right: Step Editor (form) and Variables panel; extractors define named variables from responses.
  - Run controls: dry‑run, run; live output console.

## Payloads

- Payloads Library `/payloads`
  - Tabs: Built‑in, Custom, Encoders.
  - List: name, kind (wordlist/generated/combinator), preview count, last used.
  - Actions: import (file upload), create set, edit transforms (encode/url/base64/append/prepend), delete.

## Settings Additions

- Add Attacking Defaults section (under Settings)
  - Safe Mode switches, default rate/concurrency, blocked CIDRs, default auth profile per project.

## Real‑Time Feedback

- Subscriptions
  - `subscriptions.jobs` (new): progress updates per job/scan (status, metrics).
  - `subscriptions.findings` (new): pushes new/updated findings for toasts and list refresh.
- Toasts & Banners
  - Start/cancel feedback, failure reasons, safety warnings when scope is broad.

## State Management (Pinia)

- `useTemplatesStore`
  - `templates[]`, `selectedTemplate`, CRUD, `createFromTransaction(txId)`.
- `useIntruderStore`
  - `jobs[]`, `currentJob`, `createJob`, `start/pause/resume/cancel`, `results` (paginated/streamed), `subscribe(jobId)`.
- `useScannerStore`
  - `scans[]`, `currentScan`, `start/stop/pause/resume`, `subscribe(scanId)`.
- `useFindingsStore`
  - `findings[]`, filters, `get(id)`, `updateStatus`, `addEvidence`.
- `usePayloadsStore`
  - `sets[]`, CRUD, import/export, encoder chains.

Each store maps to tRPC routers proposed in backend docs and listens to WS for live updates.

## Component Inventory (New)

- `DiffViewer` (Monaco or unified diff): header/body comparisons, highlights.
- `ResultsTable` (virtualized): large datasets, sortable by status/length/time/delta.
- `JobStatusBadge`: color‑coded status with icon; used across jobs/scans.
- `ScopePicker`: hosts/paths/methods include/exclude.
- `PositionsPicker`: visualize and select fuzz positions within request (headers/query/body/path).
- `PayloadSelector`: choose sets per position; preview sample.
- `AuthProfilePicker`: reuse existing auth profiles in attacks.

## API Integration (tRPC)

- Templates
  - `templates.list`, `templates.get`, `templates.createFromTransaction`, `templates.update`, `templates.delete`.
- Intruder
  - `intruder.createJob`, `intruder.start`, `intruder.pause`, `intruder.resume`, `intruder.cancel`, `intruder.status`, `intruder.results`.
- Scanner
  - `scanner.start`, `scanner.status`, `scanner.stop`, `scanner.findings`.
- Findings
  - `findings.list`, `findings.get`, `findings.update`, `findings.addEvidence`.
- Payloads
  - `payloads.list`, `payloads.get`, `payloads.create`, `payloads.update`, `payloads.delete`, `payloads.import`.
- Subscriptions
  - `subscriptions.jobs`, `subscriptions.findings` (new channels).

## Empty/Error/Loading States

- Tables: friendly empty states with quick actions (Create Template, Start Scan, Import Payloads).
- Jobs: show queued/running placeholders; retry actions on network failures.
- Errors: scoped banners per panel; details in expandable area; link to logs.

## Accessibility & Theming

- Keyboard navigation for tables and wizards.
- High‑contrast status badges; color is not the only status indicator (icons/labels).
- Respect existing theme system; ensure Monaco themes adapt.

## Milestones (Frontend)

- Milestone 1 (Templates + Intruder v1)
  - Templates list/builder, transaction quick actions, intruder wizard & job detail, results table/diff, basic stores.
- Milestone 2 (Findings + Scanner v1)
  - Findings list/detail, scanner wizard & scan detail, WS progress, promote results to findings.
- Milestone 3 (Payloads + Sequences)
  - Payload library UI and import; sequence builder scaffold and simple runner UI hooks.

## Open Questions

- Baseline strategy: default to captured transaction vs. first run? Allow per‑result re‑baseline.
- Large responses: how to paginate/truncate in diff while remaining useful? (Use server diff pointers.)
- Encoders: how advanced to ship initially vs. custom scripts?
- Multi‑project views: keep per‑project isolation in UI or add a global dashboard?

References: see Backend (`vision-docs/backend-roadmap.md`) and Database (`vision-docs/database-model-roadmap.md`) docs for complementary designs.
