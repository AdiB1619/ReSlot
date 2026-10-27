# ReSlot — Read-Only Audit Report and Remediation Plan

*Audit date: 25 October 2026 · Repository: `ReSlot.zip` (Spring Boot backend, React/Vite frontend) · Mode: read-only. No source file, schema, dependency or deployment was modified.*

## How to read this report

**Evidence labels used throughout**

- **Confirmed** — reproduced by execution (PostgreSQL 16.15 running the project's own migrations V1–V7; Node 22 / npm toolchain) or unambiguous from the source text (a deterministic code path).
- **High-Confidence** — follows from the source plus well-defined framework behaviour, or from the simulation below; not executed in the real JVM.
- **Potential / Not Verified** — plausible risk or area that could not be checked here.

**Environment limits (stated up front)**

- Maven Central was unreachable from the sandbox and Maven was not installed, so the backend was **never compiled, tested or started here**. The shipped `backend/target/` shows an earlier successful compile (class files are newer than the newest source file) but that is not a verification I performed.
- Solver behaviour was exercised through a line-by-line **Python port of `RescheduleService`** run against the real seeded PostgreSQL data, with the project's own SQL `effective_conflicts()` plus extra checks as an independent oracle. It is labelled *simulation* wherever used, and assumes repository results are returned in id order.
- Requirement sources: `AGENTS.md`, `ReSlot_Final_Draft_v2.1.pdf` (read in full), and the task table of `ReSlot_Prompt_Pack.md` / Implementation Plan (task IDs and stack table only — not read in depth).
- Line numbers refer to the files as delivered; where I did not capture one I name the class or method instead.

## 1. Executive summary

**Verdict: ReSlot is not safe to demonstrate as a working, validated rescheduler, and must not be used for real institutional timetables in its current state.**

What exists is a carefully designed database (master-lock trigger, one-active-version index, date-scoped effective-timetable function, baseline-aware conflict function) and a polished coordinator-facing prototype wrapped around a **placeholder engine**. The product's central promises are, respectively:

| Promise | Reality in the repository |
| --- | --- |
| CP-SAT solver | Greedy heuristic; no OR-Tools dependency; fixed metadata (`solveMs=185`, "Generated 3 conflict-free candidate plans") |
| Independent zero-new-clash validator | Does not exist in the workflow; the SQL function that could do it is never called |
| HOD-gated approval | No state machine; coordinator can approve and publish; rejected plans can be published |
| Safe publication | Re-running or resetting a date physically deletes APPROVED/PUBLISHED overrides and their notification jobs |
| WhatsApp delivery | Simulated: every job is marked `SENT` with a fabricated `wamid_<uuid>` |
| Role-based access | Disabled: every request is authenticated as coordinator **and** granted COORDINATOR+HOD+ADMIN |

Despite this, the UI, the department bulletin text, the analytics endpoint and the AI fallback assert "zero new clashes guaranteed" unconditionally. The simulation shows that claim is false: a faculty-absence run introduces 3 new clashes, and a stress run puts three SY-A lectures in the same hour.

**Counts:** 50 findings — **8 Critical, 23 High, 14 Medium, 5 Low/Informational.** 47 REST endpoints; 18 page files of which only 8 are routed; 5,400 backend Java lines and 6,600 frontend TypeScript lines were read in full.

**Eight critical blockers**

1. RS-AUD-001 — authentication and authorization are effectively switched off.
2. RS-AUD-002 — no plan state machine, no re-validation, no separation of duties.
3. RS-AUD-003 — fabricated safety assurances and plan metrics presented as facts.
4. RS-AUD-004 — the solver is not the specified CP-SAT engine; no infeasibility reporting, ranked plans, pins or move cap.
5. RS-AUD-005 — the heuristic can introduce new room, faculty and group clashes.
6. RS-AUD-006 — no validator is wired in; the SQL one is blind to disruptions, room type, duration, fixed sessions and blast radius.
7. RS-AUD-007 — destructive deletion of approved/published overrides, notification jobs and runs, with no audit or confirmation.
8. RS-AUD-008 — notification delivery is simulated and reports false success.

**What does work (verified)**

- Master immutability against direct edits: UPDATE/DELETE/INSERT on an ACTIVE version and illegal status transitions are rejected by triggers (Confirmed, tests T1–T5).
- Date scoping of overrides in SQL: a PUBLISHED override applies to its date only; PROPOSED/APPROVED/REJECTED are not applied; the next week falls back to master (Confirmed, R7-1/R7-2).
- Baseline-aware conflict function: correctly flags a new room clash and a new division-vs-batch group clash, and keeps unchanged baseline clashes marked pre-existing (Confirmed, V1/V2/V7).
- Seed data: 312 sessions; **22 room and 19 faculty clash pairs, 0 group clashes — exactly matching the Final Draft**; unknown faculty (60 sessions) and rooms (73) are left NULL with `raw_*` preserved and 62 sessions flagged `needs_review` (R8 honoured *in the seed*).
- Frontend: `npm ci`, `tsc` and `vite build` all pass; every one of the 32 adapter calls maps to a real backend route and HTTP method; design tokens match the documented palette.
- AI service has no write path (read-only repositories) — R6 holds structurally. No key-shaped secrets are committed.

**Fastest credible path.** For a *demonstration*, fix RS-AUD-001/002/003/007/008/009/011 and either wire the SQL validator in or remove every "guaranteed" claim (≈2–3 weeks). For *institutional use*, the solver (RS-AUD-004–006, 010–014), import (021–025), identity model (016–019) and notification integration (008, 029) must be built as specified (≈10–14 weeks; see §25).

## 2. Actual architecture and technology inventory

| Layer | Declared / documented | Actual (verified) |
| --- | --- | --- |
| Backend runtime | Java 21; Spring Boot 3.4.x (`AGENTS.md`) | Java 21; **Spring Boot 3.3.5** in `pom.xml`; both 3.3 and 3.4 are past OSS support (RS-AUD-030) |
| Persistence | PostgreSQL, JPA, JDBC, Flyway | PostgreSQL 16 + Flyway V1–V7 + JPA. **No JDBC/native-query use at all** — none of the DB functions (`effective_*`, `blast_radius`, `classroom_capacity_check`, `groups_overlap`) is called from Java |
| Optimization | OR-Tools CP-SAT in-process | **No solver dependency in `pom.xml`**; greedy loop inside `RescheduleService` |
| Validator | Independent Java + SQL | Not present in Java; SQL `effective_conflicts` exists, unused |
| Auth | JWT (JJWT 0.12.x), refresh rotation | Implemented, but bypassed by `SecurityConfig` + `JwtAuthenticationFilter` |
| Async / SSE | Bounded executor, SSE with polling fallback | Not found: no `@Async`, `@Scheduled` job, `SseEmitter`; `@EnableScheduling` present with nothing scheduled |
| Messaging | WhatsApp Cloud API, outbox with SKIP LOCKED, webhooks, consent | Not found. `spring-boot-starter-mail` declared, never used; `app.whatsapp.*` config never read |
| AI | Gemini behind an interface, propose-only | Direct `HttpClient` calls to Gemini; model IDs in `application.yml` are valid per the repo's captured `scratch/models.json` |
| Frontend | React 19, TS, Vite, Tailwind 3, Radix, Router, TanStack Query, RHF, Zod, Axios, Recharts, Lucide | Installed versions: React 19.3.1, Vite 8.3.4, TS 6.0.3 (`strict:false`), Router 7.18.4, Axios 1.20.0, Recharts 3.10.1. **Radix, TanStack Query, React Hook Form, Zod, date-fns are declared but never imported**; no `QueryClientProvider` |
| Exports | PDF, Excel, ICS | Not found (UI shows `alert()` placeholders) |
| CI/CD, containers, backups | Planned (A-25/A-26) | Not found |

Other facts: root `schema.sql` is byte-identical to migration V1; root `seed.sql` equals V2+V7 (session data identical; V2 contained room A-207 which V7 removes). `backend/target/` and `frontend/dist/` are shipped in the archive (no root `.gitignore`); the shipped `dist/` asset hashes equal a fresh build, so it corresponds to the current source.

## 3. Repository and module inventory

| Module | Main files | Endpoints | Entities / tables | Frontend consumer | Tests | Status |
| --- | --- | --- | --- | --- | --- | --- |
| identity | `AuthController`, `AuthService`, `JwtService`, `JwtAuthenticationFilter`, `UserService` | 4 (\`/auth/login | refresh | logout` ,  `/me\`) | `users`, `refresh_tokens` | **none** |
| masterdata | `ReferenceDataController`, entities | 11 | rooms, faculty, groups, subjects, aliases | Resources, Viewer, Disruptions | none | Implemented, pending verification; PII exposed |
| timetable | `TimetableController`, `TimetableSession`, `TimetableVersion` | 2 (`/master`, `/versions`) | versions, sessions, join tables | Master viewer, Header | none | Implemented, pending verification; **no effective-timetable endpoint** |
| importer | `ImportController`, `ImportService`, `TimetableImportParserService` | 3 | versions, sessions | Master viewer (upload only) | none | Broken / partial (RS-AUD-021–025) |
| availability | `DisruptionController`, `Disruption` | 6 | `disruptions` | Disruptions page | none | Partial, defects (RS-AUD-007, 012, 014, 015) |
| rules | `RoomRuleController`, `RoomPolicyOverride` | 3 | `room_policy_overrides` | `RoomRulesPage` (**orphan**) | none | Broken persistence; never consumed (RS-AUD-013, 027) |
| conflict | `ConflictService`, `ConflictController` | 1 (`/baseline`) | views only | Dashboard | none | Partial: master-only, room+faculty, no groups, no plan validation |
| reschedule | `RescheduleService`, `PlanController`, `RescheduleController` | 9 | runs, overrides | Plan builder | none | Mock / placeholder heuristic |
| notification | `NotificationService`, `NotificationController` | 4 | `notification_jobs` | Broadcasts; `NotificationsPage` (orphan) | none | Mock (RS-AUD-008, 029) |
| audit | `AuditService`, `AuditController` | 1 | `audit_log` | `AuditLogPage` (orphan) | none | Partial |
| analytics | `AnalyticsController` | 1 | none | Analytics, Dashboard | none | Mock — hardcoded numbers |
| ai | `AiAssistantController`, `GeminiAiService` | 1 | none | AI assistant | none | Partial; propose-only; fabricated fallbacks |
| web / config / shared | health, CORS, security, error handler, time utils | 1 (`/ping`) | — | Header | `TimeRangeTest` | Implemented; see RS-AUD-040/044 |
| **Not found** | solver package, validator package, exports, webhooks, consent, user-admin API, SSE/async runs, CI/CD, container files | — | — | — | — | Missing |

Backlog mapping (Prompt Pack task IDs): A-01–A-05 partly done; A-06–A-08 partly (no review/activation workflow); A-09–A-11 done in part; **A-12–A-19 (solver, plans, validator, approval, outbox, WhatsApp, consent) not done as specified**; A-20 partial; A-21 partial; A-22 fake/missing; A-23–A-28 not started.

## 4. Requirements versus implementation

| Req. | Requirement | DB layer | Java / API layer | Frontend | Verdict |
| --- | --- | --- | --- | --- | --- |
| R1 | Active master immutable | Direct edits blocked; **bypass by re-parenting rows**, TRUNCATE (RS-AUD-026) | No edit path exists (immutable by absence) | No edit controls | Partial |
| R2 | Minimal blast radius, prefer room change | `blast_radius()` exists, unused | Only directly-hit sessions are touched (good) but faculty absence, EXTRA\_ROOM, Sunday and group checks wrong | — | Partial / failing |
| R3 | Preserve baseline clashes | Works in SQL (22/19/0) | Java `ConflictService` reports baseline only; no plan comparison | Hardcoded "2" on plan screen | Partial |
| R4 | Zero-new-clash, independent validator | Function works, blind spots | **Not called anywhere**; metrics hardcoded | Hardcoded guarantee | **Fail** |
| R5 | Human approval before publication | CHECK needs `approved_by` non-null only | No state checks; coordinator may approve+publish | One-click approve+publish | **Fail** |
| R6 | AI propose-only | — | No write path | Suggestions displayed as text | Pass (structural) |
| R7 | Date-specific overrides | Correct | No effective-timetable API; deletes published overrides | Orphan page uses mock data | Partial |
| R8 | Unknown stays unknown | Seed honours it | **Importer invents or drops data** | Unknown shown via flags | Fail (importer) |
| R9 | Lab blocks / period grid / Mon–Sat IST | Tables present; no DB check aligning sessions | Solver ignores duration; Sunday→Monday; slots hardcoded | UTC "today" | Partial / fail |
| R10 | No silent publish/notify | Dedupe key unique | Fake SENT; unapproved drafts; global dispatch | `wa.me` links from unapproved drafts | **Fail** |

## 5. Feature completeness matrix

| Feature | Frontend | Backend | DB / external | Tests | Verified status |
| --- | --- | --- | --- | --- | --- |
| Authentication | No login page, no token handling | Implemented but bypassed | Tables OK | 1 unit test | **Broken** |
| Role-based access | Single hardcoded coordinator nav | `@PreAuthorize` present, moot | — | none | **Broken** |
| Master timetable import | Upload button only | Heuristic parser; NPE on null subject names | — | none | **Broken** |
| Import review and activation | Wizard is a static mock, orphan | No review code; auto-activate default | `imports`/`import_rows` tables unused | none | **Not found / Mock** |
| Master timetable viewing | Implemented | `/timetable/master` | OK | none | Implemented, pending verification |
| Reference data management | Read-only lists | POST/PATCH exist, no UI | OK | none | Partial |
| Disruption management | Implemented | Defects (time-parse swallow, destructive delete) | OK | none | Partial |
| Room rules | Orphan page | Persistence fails; solver ignores | Type mismatch | none | **Broken** |
| Conflict detection | Dashboard count | Master-only room+faculty | SQL good, unused | none | Partial |
| Rescheduling solver | Plan builder | Greedy heuristic | — | none | **Mock / Broken** |
| Independent validator | Hardcoded text | Absent | SQL unused | none | **Not found** |
| Alternative plans | Plans B/C shown | **Fabricated** aliases of Plan A | — | none | **Mock** |
| Blast-radius analysis | Orphan detail page | Absent | `blast_radius()` unused | none | Not found |
| Approval and rejection | Reject not reachable in routed UI | No state checks | CHECK weak | none | **Broken** |
| Publication | One-click | No gates; deletes on re-run | — | none | **Broken** |
| Effective timetable | Orphan page with hardcoded schedule | No endpoint | Function correct | none | Backend missing |
| Notifications | Drafts page; orphan centre | Simulated dispatch | outbox table only | none | **Mock** |
| WhatsApp integration | — | Not found | no phones in seed | none | **Not found** |
| Delivery tracking | — | No webhook, no DELIVERED/READ | enum exists | none | Not found |
| Audit log | Orphan page | List endpoint; partial coverage | table mutable | none | Partial |
| Analytics | Charts | Hardcoded numbers, `zeroNewClashRate=100` | — | none | **Mock** |
| AI assistant | Chat panel | Gemini + canned fallbacks | — | none | Partial |
| PDF/Excel/ICS exports | `alert()` stubs | Not found | — | none | **Not found** |
| Faculty portal | Orphan, hardcoded | No per-user endpoints, no user↔faculty link | no mapping column | none | **Not found** |
| Student portal | Orphan, hardcoded | same | same | none | **Not found** |
| Administration and settings | Orphan; Save only flips a flag | `UserService` has no controller | — | none | **Mock** |

## 6. Critical and high-severity findings (index)

Full evidence, fixes, tests and acceptance criteria are in §23. **Critical:** 001 auth bypass · 002 plan lifecycle · 003 fabricated assurances · 004 solver not as specified · 005 new clashes introduced · 006 validator absent/blind · 007 destructive deletes · 008 simulated notifications. **High:** 009 faculty absence → room change · 010 duration/lab-block integrity · 011 Sunday→Monday · 012 EXTRA\_ROOM inverted · 013 fixed/rules/capacity ignored, batches merged · 014 free-text-driven logic · 015 malformed times widen scope · 016 default credentials · 017 lockout/refresh/logout defects · 018 no user↔faculty/group model · 019 latent method-level auth gaps · 020 frontend has no login and 10 unreachable pages · 021 import invents/drops data · 022 auto-activation, no review gate · 023 parser NPE · 024 activation transaction hazards · 025 canonical-JSON import broken · 026 master-lock bypasses · 027 room-rule persistence mismatch · 028 fabricated analytics · 029 broadcast drafts from unapproved plans · 030 EOL Spring Boot · 031 backend unverified, trivial tests.

## 7. Detailed frontend audit

**Method.** Every route, page and handler was read; each adapter function was traced to its callers (routed vs orphan pages) and to a backend route. `mockData.ts` is **not imported anywhere** (dead code), so production behaviour does not silently fall back to fictitious timetable data — but several pages swallow errors and show empty or zero states instead (RS-AUD-038).

| Route / feature | UI | Handlers | API connected | Backend op exists | Backend behaviour verified | Persistence | Authz | Loading / error | Final status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/` Dashboard | Yes | n/a | analytics, baseline clashes, disruptions | Yes | Analytics fake; clash count real | n/a | None | Errors → `[]`/`null` silently | Partial (fake stats) |
| `/timetable` Master viewer | Yes | Upload, filters, modal | master, rooms, faculty, upload | Yes | Upload crashes on seeded DB (RS-AUD-023) | n/a | None | Upload error shown | Viewer OK; **upload broken**; PDF/ICS buttons are `alert()` |
| `/resources` | Yes | Search | rooms, faculty, groups | Yes | Reads only | n/a | None | Basic | Implemented (read-only) |
| `/disruptions` | Yes | Bulk create, delete, reset, JSON modal | bulk, delete, reset-day | Yes | Delete/reset destroy published data | Yes | None | `alert()` on error; JSON modal ignores `response.ok` | **Partial / unsafe** |
| `/plans` Plan builder | Yes | Run, approve+publish | runs, plans, approve, publish | Yes | No state checks; metrics hardcoded | Yes | None | Errors only in console; failure shows "No Candidate Plans" | **Unsafe** |
| `/broadcasts` | Yes | `wa.me` links, "clear" | drafts, reset-day | Yes | Drafts include unapproved overrides | n/a | None | Basic | **Unsafe** |
| `/analytics` | Yes | none | overview | Yes | Hardcoded numbers | n/a | None | Basic | **Mock** |
| `/ai-assistant` | Yes | Send, prompts | `/ai/suggest` (API key in body) | Yes | Gemini or canned fallback | n/a | None | Fallback text | Partial |

**Orphan pages (never routed, never imported) — 10 of 18 page files:** `ApprovalQueuePage`, `PlanDetailPage`, `AuditLogPage`, `NotificationsPage`, `RoomRulesPage` (all API-connected but unreachable); `AdminSettingsPage` (hardcoded user list; Save only flips a success flag); `MasterUploadWizard` (no API calls; default file name `Master_Timetable_Odd_2026.xlsx`); `PublishedTimetablePage` and `MobilePortalPage` (hardcoded fictitious schedules, e.g. "Prof. NAW (Proxy for Prof. SW)" — proxy substitution contradicts "faculty never changed automatically"); `DesignGalleryPage`. Consequently **the approval queue, audit log, admin, faculty/student portals, published timetable, room rules and upload wizard cannot be reached by any user.**

**Cross-cutting frontend defects**

- No `/login` route, no token storage, no `Authorization` header, no refresh handling; the sidebar is one hardcoded "Coordinator Workspace" with a fake identity badge. Role-specific navigation (HOD, faculty, student, admin) does not exist (RS-AUD-020).
- `PlanBuilderPage` shows literal strings "Zero New Clashes Guaranteed", "New Clashes: 0 (Safe)", "0 Minutes", "2 (Preserved)", "100% All Classes Safe" and solver stats `185 ms / 1240 explored` / `142 ms / 1560 explored` that are constants. One button performs **approve then publish** with a hardcoded remark "Approved by Prof. Pooja Thakre (Timetable Coordinator)"; no confirmation dialog.
- Plans B and C each carry an "Approve & Publish" button that publishes Plan A's overrides again (RS-AUD-002).
- The UI's SE/TE lab-cancel rule selects the first three lab rooms by id (KRC, A-209, A-210) and relies on free-text reason matching in the backend (RS-AUD-014).
- `today` is `new Date().toISOString().split('T')[0]` — a **UTC** date, computed once at module load; between 00:00 and 05:30 IST it is yesterday (RS-AUD-037).
- Destructive actions (delete disruption, reset day, clear broadcasts) have **no confirmation**, yet they delete published overrides (RS-AUD-007).
- `tsconfig` has `strict:false`; Radix, TanStack Query, React Hook Form, Zod and date-fns are unused dependencies (RS-AUD-047).

## 8. Detailed backend and API audit

**Route agreement is good:** all 32 frontend adapter calls resolve to existing backend routes with matching HTTP methods. The problems are behind the routes.

| Endpoint group | Authorization as coded | Frontend consumer | Notes |
| --- | --- | --- | --- |
| \`POST /auth/login | refresh | logout` ,  `GET /me\` | public |
| `GET /rooms`, `/rooms/{id}`, `/faculty`, `/student-groups`, `/subjects`, `/periods`, `/lab-blocks` | **none** | Resources, Viewer, Disruptions | `/faculty` returns `whatsappE164` and `email` to any caller |
| `POST/PATCH /rooms`, `/faculty` | COORDINATOR/ADMIN | **none** | Invalid enum → 500; no audit |
| `GET /timetable/master`, `/versions` | **none** | Viewer, Header | Any caller can pass any `facultyId`/`groupId`; no effective-timetable route |
| `POST /imports/timetable-file`, `/canonical-json`, `/versions/{id}/activate` | class: COORDINATOR/HOD/ADMIN | upload only; canonical via raw `fetch`; activate adapter **never called** | RS-AUD-021–025 |
| `GET/POST/DELETE /disruptions`, `/bulk`, `/reset-day`, `/all` | class: COORDINATOR/HOD/ADMIN | Disruptions, Broadcasts, Dashboard | Delete/reset remove published overrides; not audited |
| `GET/POST /room-rules`, `/precheck` | class: COORDINATOR/HOD/ADMIN | orphan page only | Persistence fails (RS-AUD-027) |
| `GET /conflicts/baseline` | **none** | Dashboard | Master-only room+faculty |
| `POST /reschedule/runs` | COORDINATOR/HOD/ADMIN | Plan builder | Synchronous, unlocked |
| `GET /reschedule/runs`, `/runs/{id}/plans`, `/runs/{id}/overrides` | **none** | `getPlans` via `/plans`; others never called | Plans B/C fabricated |
| `GET /plans`, `/plans/{id}/overrides` | **none** | Plan builder; orphans | Readable by any role |
| \`POST /plans/{id}/approve | reject | publish\` | COORDINATOR/HOD/ADMIN |
| `GET/DELETE /notifications...`, `POST /dispatch` | only `/dispatch` annotated | Broadcasts; orphan centre | `DELETE /broadcasts` unannotated and destructive |
| `GET /audit-logs` | class: COORDINATOR/HOD/ADMIN | orphan | Top-100 only |
| `GET /analytics/overview` | **none** | Analytics, Dashboard | Hardcoded values |
| `POST /ai/suggest` | **none** | AI assistant | Open; can use the server's key |

**Backend defects not tied to one module:** business logic lives in controllers (`DisruptionController` triggers re-runs and deletes plans; `NotificationController` deletes overrides); no idempotency keys on run/approve/publish; no `@Version` or row locks on runs or overrides; `GlobalExceptionHandler` maps most client errors to 500 (RS-AUD-040); OpenAPI, Swagger and Prometheus are public (RS-AUD-044); the `local` profile's datasource URL lacks `stringtype=unspecified` (RS-AUD-033). A formal contract freeze (task M-01) has not happened — springdoc generates a spec, but no contract tests exist.

## 9. Timetable import and master versioning audit

**Pipeline as implemented.** `POST /imports/timetable-file` → `TimetableImportParserService.parseAndImport` (CSV/Excel/PDF token heuristics) → new DRAFT version → sessions saved → `activateVersion` in the **same transaction** when `activateImmediately` is true (default **true**). The `imports`, `import_rows` and `review_decisions` tables created by V3 are never referenced by any Java class.

| Check | Result | Evidence |
| --- | --- | --- |
| Unmatched student group | **Silently assigned `allGroups.get(0)` (SY-A)**; fuzzy `contains` match; group names containing `/` (e.g. `SY-A/SA1`) are split on `/` | Parser: group resolution block (RS-AUD-021) |
| Unknown day / missing time | Day → Monday; time → 09:00; subject → `"SUB"`; PDF rows hardcode group `SY-A` | Parser defaults (RS-AUD-021) |
| Unknown room / faculty | Dropped from relations, raw text kept, `needsReview=false` | R8 violation |
| Subject lookup | `s.getName().equalsIgnoreCase(..)` unguarded; **30 of 32 seeded subjects have NULL names** → NPE on essentially any row | RS-AUD-023 |
| Fixed sessions, joint classes, electives, merged cells | Not modelled (`isFixed` always false) | Parser |
| Time validation vs periods / lab blocks / 2-hour labs | None; `end<=start` hits a DB CHECK → 500 | Parser |
| Review and correction workflow | Not found | grep: no use of import/review tables |
| Duplicate file / retry | `source_sha256` never set; same file creates another version | `UNIQUE` column unused |
| Auto-activation | Default true; no review gate; `activateVersion` has no status or review check | RS-AUD-022 |
| Activation mechanics | See below | RS-AUD-024 |
| Large files | 25 MB multipart cap; PDFBox loads whole file; no page/row caps | Potential |
| Canonical JSON | `Disruption` built without `createdAt` (NOT NULL) → import with any disruption fails; unknown rooms/faculty skipped silently; `scope.division` ignored (rule becomes department-wide); `lab_blocks`, `classrooms` ignored; UI treats failure as success | RS-AUD-025 |

**Activation hazards (DB-run, with framework reasoning).** Test T10: setting a draft ACTIVE *before* archiving the current ACTIVE raises `duplicate key ... one_active_version`; archiving first succeeds (T10b). `ImportService.activateVersion` loads the target first, then the active version, then saves both; with Hibernate's default flush order (no `order_updates`) the target's UPDATE precedes the archive → expected constraint violation whenever another version is ACTIVE (High-Confidence). Test T11: inserting `session_groups` rows after the version is ACTIVE is rejected by the lock trigger; Hibernate performs join-table inserts after entity updates, so import-with-activation in one transaction is expected to fail at commit (High-Confidence). Neither path was run in the real JVM.

**R1 at the DB level (Confirmed, tests T1–T9).** Direct UPDATE/DELETE/INSERT on an ACTIVE version are rejected (good). **Bypasses:** `UPDATE timetable_sessions SET version_id = <draft>` removed a session from the active master (312 → 311) because the trigger checks only `NEW.version_id`; re-pointing `session_groups.session_id` to a draft session stripped an active session's groups; `TRUNCATE timetable_sessions CASCADE` emptied sessions, overrides and notification jobs; `audit_log` accepts UPDATE and DELETE.

## 10. Solver and constraint correctness audit

**What the engine is.** `RescheduleService.triggerRun` (one `@Transactional` method): collect disruptions for the date; mark a session *collided* if its room matches any disruption, its faculty matches, or a lab-cancel phrase appears in the free-text reason; try a same-time room (`findConflictFreeRoom`); otherwise try three hardcoded slots (14:00–16:00, 11:15–13:15, 16:00–17:00); otherwise CANCEL. Persist overrides as PROPOSED; return fixed `solveMs=185`, `plansCount=3`. **No OR-Tools, no model, no objective, no timeout, no INFEASIBLE status.**

**Hard-constraint checklist**

| # | Constraint | Status | Note |
| --- | --- | --- | --- |
| 1 | Room availability | Partial | Overlap test is correct (strict inequalities; adjacent slots do not overlap); `EXTRA_ROOM` treated as unavailability |
| 2 | Faculty availability | **Fail** | Absence handled as room change (RS-AUD-009) |
| 3 | Student-group availability | **Fail** | Exact group-id match only; ignores division/batch overlap and overrides already generated |
| 4 | Room occupancy | Partial | Checks unaffected master + generated overrides |
| 5 | Faculty double-booking | Partial | Only against unaffected sessions |
| 6 | Group double-booking | **Fail** | As #3 |
| 7 | Room type | Partial | Only LAB and LECTURE restricted; TUTORIAL/OTHER (37 seeded sessions) unrestricted; explicit lab-cancel path puts labs in classrooms without a room rule |
| 8 | Capacity | Ineffective | `capacity`/`strength` are NULL for all seeded rows; defaults 60/25 invented |
| 9 | Lab 2-hour block integrity | **Fail** for moves | Alternate slots ignore session duration (RS-AUD-010) |
| 10 | Fixed sessions | **Fail** | `is_fixed` never read |
| 11 | Disruption windows | Pass | Whole-day when times null |
| 12 | Temporary rooms/labs | **Fail** | RS-AUD-012 |
| 13 | Room policy overrides | **Fail** | Never read by the solver |
| 14 | Joint classes | Not modelled |  |
| 15 | Co-teaching | Partial | Set membership in busy check only |
| 16 | Elective cohorts / partitions | Not modelled |  |
| 17 | Cross-division / cross-year | **Fail** | Faculty crossing works by id; group crossing does not |
| 18 | Cancellation | Weak | Silent default fallback; no human-flag state |
| 19 | Valid start/end | **Fail** | Not validated against periods or lab blocks |
| 20 | Validity of final assignment | **Fail** | No post-check |

**Objectives.** The Final Draft's order — same time/other room, then nearest free period on the same day, then cancel or flag for a human — is approximated by the code order, but "nearest free period" is replaced by three fixed slots; nothing minimizes moved sessions; there are no weights, so no weighted objective can override a hard constraint (there are also no hard constraints enforced after the fact). **Determinism:** the explicit lab-cancel path uses `groups.stream().findFirst()` on a `HashSet` of entities without `equals/hashCode` — iteration order depends on identity hashes (RS-AUD-014). **State leakage:** none across runs, but each run deletes all prior overrides for the date (RS-AUD-007).

**Simulation results** (Python port of the Java, real seeded data, SQL validator as oracle; `PROPOSED` overrides inserted then rolled back).

| Scenario | Affected | Outcome | Oracle findings |
| --- | --- | --- | --- |
| G1 Final Draft example: A-212 closed Thu 09–11 | 3 | 3× ROOM\_CHANGE to KRC, A1-113, B-108 | 0 new clashes; a computer-lab practical is sent to KRC (RS-AUD-036) |
| G2 A-210 closed Mon 09:00–13:15 | 2 of 3 sessions in window | 2× ROOM\_CHANGE (both to KRC) | 0 new clashes |
| G3 Faculty SW absent all Tue | 3 | 2× ROOM\_CHANGE, 1× MOVE | **Absent faculty still scheduled 3×; 3 new clashes** (1 faculty, 2 group) |
| G4 A-212 closed on **Sunday** 25 Oct | 1 | Override for a *Monday* lab dated Sunday | Oracle blind: master has no Sunday sessions |
| G5 all labs closed Mon all day | 24 | 23 CANCEL + 1 ROOM\_CHANGE, run status SOLVED | No infeasibility, no explanation, partial plan publishable |
| G6 EXTRA\_ROOM on A-216 | 5 | 5 sessions **moved out** of the "extra" room | Semantics inverted |
| G7 A-216 projector Wed 09–11 | 2 | 2× ROOM\_CHANGE | Pass |
| G8 B-108 + A-211 closed Wed 09–11 | 2 | 2× ROOM\_CHANGE (one to KRC) | Pass |
| G9 all classrooms closed Mon 09:00–13:15 | 15 | 6× MOVE (all to 16–17) + 9 CANCEL | **4 new group clashes** (three SY-A lectures in the same hour) |
| L1 UI "Cancel lab sessions for SE" Wed | 5 | SY **and** TY labs in A-209/A-210 → 5 classroom ROOM\_CHANGEs | Labs placed in non-lab rooms; not SE-specific |
| L2 UI "Cancel ALL labs" Wed | 24 | 24 CANCEL | No human decision point |
| Sweep: every weekday × period with all classrooms closed (36) | — | **19 of 36** produced a 1h↔2h duration change and/or new clashes | Worst case 9 new clashes (Wed 09–10) |

The sweep is a deliberate stress condition, not a typical day; it shows the *classes* of defect (no group-overlap check, no generated-override awareness, no duration handling) rather than expected frequency. Because the Java was not executed, these are High-Confidence rather than Confirmed.

**Existing solver tests:** none. The scratch PowerShell scripts (`test_lecture_disruption.ps1`, `test_multi_lab_disruption.ps1`, `test_solver_fix.ps1`, `check_rooms.ps1`) call the API without credentials, approve and publish immediately, and assert nothing about clashes; they are demonstration scripts, not tests.

## 11. Independent validator audit

**There is no validator in the approval or publication path.** `ConflictService` reports baseline room and faculty clashes for the master only (no student groups, no overrides). `approvePlan` and `publishPlan` never call anything that evaluates the effective timetable. The plan DTO hardcodes `newClashes=0`, `baselineClashes=2` (the data has 41 pairs), `shortfallMinutes=0`.

The SQL functions `effective_conflicts`, `blast_radius` and `classroom_capacity_check` exist and are **never invoked** (no JDBC or native query anywhere). Run directly, `effective_conflicts` is genuinely baseline-aware and cross-division-aware (V1: new room clash flagged; V2: new division-vs-batch group clash flagged; V7: moving one session of a baseline pair resolves it while the untouched pair stays `pre_existing`). Its **blind spots** (Confirmed): a move into a room with a ROOM\_UNAVAILABLE disruption → 0 new clashes (V3); a LAB moved into a classroom and shrunk to 1 hour at 16:00 → 0 (V4); fixed sessions, lab-block alignment, blast radius and room policy are not evaluated. Validation results are not persisted, so nothing ties a validation to the plan version later approved, and a modified plan cannot be detected as "stale".

**Common-mode risk:** none today because the two components share no code — the validator is simply unused. Once wired in, it must be extended (disruptions, type, duration, fixed, blast radius) and the Java solver must not reuse its helpers, or both will inherit the same blind spots.

## 12. Conflict detection and baseline clash audit

- **Seed truth:** 22 room pairs, 19 faculty pairs, 0 group pairs on the active master — matches the Final Draft exactly. The Dashboard shows the live count from `/conflicts/baseline` (expected 41 from the same logic; Java not run), while the plan screen hardcodes "2 (Preserved)", the plan DTO hardcodes 2, and the AI prompt states "2 pre-existing clashes": three inconsistent claims.
- **Identity and matching:** the SQL function derives `pre_existing` from the override *action* (a session with MOVE/ROOM\_CHANGE is treated as changed) rather than comparing against a stored baseline set. This is sound for the defined action model and cannot be fooled by renumbering because overrides reference master session ids, but it means a baseline pair is judged by what the plan did, not by explicit baseline identity. Acceptable; document it.
- **Java conflict service:** quadratic over all sessions, room and faculty only, ignores student groups. Joint classes and merged groups are not represented.
- **Gap:** no component compares a *proposed* effective timetable against the baseline in Java, so "unchanged pre-existing clash does not invalidate a plan" is untestable at the API level (it holds only in raw SQL).

## 13. Database and migration audit

**Applied and verified.** Migrations V1–V7 were applied in order with `psql ON_ERROR_STOP` on PostgreSQL 16.15 (not through the Flyway tool itself) and completed cleanly. V7's `UPDATE timetable_sessions` is a no-op on the seed (no session references room 17), so the lock trigger is never tripped. `schema.sql` is identical to V1; `seed.sql` equals V2+V7; session data is identical between V2 and the root seed.

**Strengths.** Master-lock triggers on sessions, session\_groups and session\_faculty; version lifecycle trigger; partial unique index `one_active_version`; `dedupe_key UNIQUE` on notification jobs; check constraints tying `MERGE_BATCHES` to `confirmed_by` and APPROVED/PUBLISHED to `approved_by`; correct `effective_timetable()`.

**Defects and gaps**

- **Dead DDL in V3 (Confirmed).** `CREATE TABLE IF NOT EXISTS room_policy_overrides` emitted `NOTICE: relation already exists, skipping`; the V3 column set (`scope_level`, `scope_div_id`, `deleted` …) never exists. The entity maps to V1 columns, but its `allowRoomTypes` is a `String` while the column is `room_type[]`: inserting `'CLASSROOM'` or `'CLASSROOM,LAB'` fails with `malformed array literal` (J1), and a valid row reads back as `{CLASSROOM}` (RS-AUD-027).
- **Enum binding fragility (Confirmed).** A varchar-typed bind into a native enum column fails (`column "status" is of type override_status but expression is of type character varying`, J4). The default datasource URL carries `stringtype=unspecified`; the `local` profile URL does not. V6 converted `disruptions.kind` to varchar to dodge the same problem, which shows the issue was hit and patched piecemeal (RS-AUD-033).
- **Override uniqueness couples the model to destruction.** `uq_active_override` is unique on `(session_id, on_date)` for every status except REJECTED, so a second plan for the same session/date cannot coexist with the first. That is why the code deletes prior overrides on every run (RS-AUD-007) and why alternative plans cannot be real rows (RS-AUD-002/004). There is no `plans` table, no plan hash, no validation record, no master-version reference on a plan.
- **Approval integrity is weak (Confirmed, S1–S4).** Publishing a never-approved override is blocked only by the CHECK (a 500, not a business error); approve → reject → publish succeeds; `approved_by` accepts any string.
- **Master replacement orphans published overrides (Confirmed, R7-4).** After activating a newer version, a PUBLISHED override for an earlier date remains in the table but no longer appears in `effective_timetable()`; no warning, no migration policy (RS-AUD-034).
- **R1 bypasses and mutable audit log** — see §9 (RS-AUD-026).
- **No `users` ↔ `faculty` / `student_groups` link**, so personal timetables and ownership checks cannot be expressed (RS-AUD-018).
- **Seed governance.** V2 activates the master with 62 sessions still `needs_review`; nothing in the schema prevents activation with unresolved flags. `build_seed.py` reads `master_timetable.txt` and a hardcoded `/mnt/user-data/uploads/Updated_TT__1_.pdf`, neither shipped, and its `conflicts_report.md` output is absent — the seed cannot be regenerated or re-checked against its source (RS-AUD-035).
- **R9 data points.** Lab blocks LB1–LB3 match the brief; the seed adds **LB4 15:00–17:00** used by one Friday lab, and contains **26 non-LAB sessions of two hours** (9 lectures, 17 "other"). Treat as requirement clarifications (RS-AUD-049), but note the solver assumes neither.
- **Query patterns.** Lazy `@ManyToMany` groups/faculty per session and `open-in-view: true` imply N+1 loading on every master read and a quadratic baseline scan (Potential; needs profiling — RS-AUD-045).

**Does the database itself protect the critical invariants?** R1: mostly, with the bypasses above. R4 and R5: no. R7: correct but unused by the API.

## 14. Authentication and authorization audit

**The decisive finding (Confirmed, code).** `SecurityConfig` ends with `requestMatchers("/api/**").permitAll()` and `anyRequest().permitAll()`. `JwtAuthenticationFilter` then authenticates **every** request: with no token or an invalid token it loads `coordinator@rscoe.edu.in` (and falls back to a bare token if the lookup fails), and it **adds ROLE\_COORDINATOR, ROLE\_HOD and ROLE\_ADMIN to all requests, including valid tokens issued to other users**. A student's token is therefore an admin token. `@PreAuthorize` is satisfied for everyone; audit actor names are always the coordinator (RS-AUD-001, 042).

| Control | Finding |
| --- | --- |
| Password hashing | BCrypt, strength 12 — adequate |
| JWT | HS256 signature and expiry validated; no issuer/audience claims; no revocation on role change or disable; key defaults to a dev string in `application.yml` with no startup guard |
| Seeded accounts | Admin, coordinator and HOD created at startup; coordinator and HOD use the hardcoded password `ChangeMe123!` with `mustChangePassword=false`; no change-password endpoint exists (RS-AUD-016) |
| Lockout | Failed-attempt increment and lock are written, then `ApiException` (a RuntimeException) is thrown inside a class-level `jakarta.transaction.Transactional` → the transaction rolls back and the counter is lost; brute-force protection is ineffective (RS-AUD-017, High-Confidence) |
| Refresh rotation | Reuse detection calls `revokeFamily` then throws → revocation rolled back; no disabled-user check on refresh; `refresh` with a missing cookie hits `sha256(null)` → 500 |
| Logout | Refresh cookie path is `/api/v1/auth/refresh`; the browser does not send it to `/auth/logout`, so server-side revocation never occurs; cookie `Secure` flag is not set |
| Enumeration | `ACCOUNT_LOCKED` response and bcrypt-only-for-existing-users timing reveal valid emails (Low) |
| CORS / CSRF | Explicit origin list with credentials; CSRF disabled (acceptable for bearer APIs; the cookie endpoint relies on SameSite) |
| Public surface | `/actuator/**` (incl. Prometheus), Swagger/OpenAPI, and referenced-but-nonexistent `/webhooks/**`, `/share/**`, `/consent/**` are all permitted |

**Role matrix — what remains wrong after RS-AUD-001 is fixed (Confirmed, code)**

| Operation | Coded as | Required |
| --- | --- | --- |
| Approve / reject / publish plan | COORDINATOR, HOD, ADMIN | HOD only (AGENTS.md and Final Draft §11; the Final Draft pipeline diagram says "HOD / coordinator" — clarify) |
| Read plans, runs, overrides | any authenticated | coordinator/HOD/admin |
| Read notifications (incl. phone numbers), delete broadcasts (**deletes published overrides**) | any authenticated | coordinator/HOD |
| Read `/faculty` (phone, email), `/timetable/master?facultyId=` | any authenticated | public master grid without PII; personal views by ownership |
| `/ai/suggest` | any caller | authenticated, rate-limited |
| Faculty/student personal timetable | no endpoint; no user↔faculty/group mapping | derived from JWT subject |
| User management | `UserService` exists with **no controller** | ADMIN-only API |

BOLA/IDOR cannot even be defined until RS-AUD-018 adds the ownership model.

## 15. Approval, publication and effective-timetable audit

**Implemented lifecycle (`RescheduleService`)**

| Action | Preconditions checked | Effect | Audit | Side effects |
| --- | --- | --- | --- | --- |
| Create run | none (date not validated; Sunday maps to Monday) | Deletes **all** prior overrides on the date (any status) and their jobs; inserts PROPOSED overrides | run record only | none |
| Approve | **none** | Sets APPROVED + `approved_by` for every override of the run | Yes | none |
| Reject | **none** | Sets REJECTED | Yes | none |
| Publish | **none** | Sets PUBLISHED; queues jobs; calls `dispatchPendingJobs()` for **all** pending jobs, in the same transaction | Yes | fake SENT |

**Illegal transitions and replays**

- Reject → publish: **succeeds** (DB-run S2: final status PUBLISHED, `approved_by` retained).
- Publish a PROPOSED plan: fails only through the CHECK constraint (500) — accidental protection, S1.
- Double approve / double publish: no guard; publish re-queues and re-dispatches.
- Plan B / C: `planId ≥ 10000` is reduced with `% 10000` to the run id, so approving or publishing "Plan B" acts on Plan A's overrides. For runs with id ≥ 10000 the arithmetic breaks.
- Plan status: a run with zero overrides is reported as PUBLISHED.
- Stale approval, plan edited after validation, master version changed after approval, concurrent approve/publish: no `@Version`, no row lock, no re-validation, no master-version check.
- Failure after publication but before notification: dispatch runs inside the publish transaction, so a dispatch exception would roll back publication, while a successful fake dispatch cannot fail — the real behaviour under a real provider is undefined.
- Destruction: `DELETE /disruptions/{id}`, `/disruptions/reset-day`, `/disruptions/all` and `DELETE /notifications/broadcasts` delete overrides of **any** status, their notification jobs, and (for disruptions) the runs; none writes an audit event; none asks for confirmation (RS-AUD-007). `DisruptionController.delete` also swallows `Throwable` from the re-run, leaving a rollback-only transaction that fails at commit.

**Required state machine (recommended)**

| From | Action | Role | Preconditions | To | Audit | Notifications |
| --- | --- | --- | --- | --- | --- | --- |
| PROPOSED | system validation | system | solver output hashed | VALIDATED (or INVALID) | validation record tied to plan hash | none |
| VALIDATED | approve | HOD | hash unchanged; master version unchanged; zero new clashes | APPROVED | who/when/hash | none |
| PROPOSED / VALIDATED | reject | HOD | reason required | REJECTED (terminal) | yes | none |
| APPROVED | publish | HOD | re-validate now; no newer approved plan for the date | PUBLISHED | yes | outbox rows written in the same transaction |
| PUBLISHED | (none) | — | corrections create a new plan | — | — | — |

**Effective timetable.** The SQL function is correct for date scoping (R7-1 to R7-3). The application has no endpoint for it; the only "published timetable" screens are orphan pages with hardcoded data. The Java solver's "today" and date handling can diverge from it (Sunday). A published override cannot currently alter the master (no write path) — the destructive paths above are the real R7 risk.

## 16. Notification and WhatsApp integration audit

- **No provider integration (Confirmed).** `dispatchPendingJobs` loads every PENDING job, sets `SENT`, stamps `sent_at`, and stores `wamid_<uuid>` as the provider message id. No HTTP call, no template, no sandbox flag, no retry or backoff, no webhook receiver, no DELIVERED/READ transitions, no signature verification. `app.whatsapp.*` is never read.
- **Recipients have no contact data.** The seed has **0 faculty phone numbers and 0 emails**; student groups have no contacts at all; there is no consent model. Every job is nevertheless marked SENT — "sent" currently means "a row was updated" (RS-AUD-008).
- **Content.** Faculty messages turn "Dr." into "Prof."; every message is signed with a hardcoded coordinator name; cancellations always say "No vacant lab/classroom available" regardless of cause; the department bulletin hardcodes **"Zero new clashes verified."** (RS-AUD-029, 050).
- **Before publication.** `getBroadcastDrafts` builds text from overrides of **any** status, and the Broadcasts page offers `wa.me` deep links, so unapproved plan content can be sent manually (R10).
- **Duplicates and concurrency.** Job creation is idempotent per override id, but every re-run creates new override ids and deletes old jobs, defeating the dedupe key; dispatch is global (not per plan) and has no `FOR UPDATE SKIP LOCKED`, so concurrent workers would double-send once a real provider exists.
- **Exposure.** `GET /notifications` returns phone numbers and message text to any authenticated caller; `DELETE /notifications/broadcasts` is unannotated.
- **Not verifiable:** behaviour under provider failure, rate limits, partial recipient failure — there is no provider to fail.

## 17. AI assistant audit

| Aspect | Finding |
| --- | --- |
| Transport / model | `GeminiAiService` calls Gemini over `HttpClient`; model IDs (`gemini-3.8-flash`, `gemini-3.5-flash`, `gemini-3.1-flash-lite`) appear in the repo's captured `scratch/models.json`, so they are valid; the `@Value` default (`gemini-1.5-flash`) is stale |
| **R6 propose-only** | **Holds structurally**: the service holds read repositories only and returns text plus suggested-action strings; nothing is written or published (Confirmed, code). Note: no validation exists for it to bypass, and the actions are just labels |
| API key handling | The request body carries `apiKey` from the browser; if absent the service reads `GEMINI_API_KEY` from the environment **or scans `.env`, `../.env`, `backend/.env`**; the endpoint is open, so any caller can spend the server's quota; the configured monthly token budget is never read |
| Context | Rooms, 20 faculty and a disruption count — **no sessions**, so it cannot ground a swap proposal; the system prompt asserts facts that are false ("2 baseline clashes", room A-207, "CP-SAT solver preserves…") |
| Failure behaviour | With no key or on API failure it returns **canned confident answers** ("The CP-SAT solver… guarantees ZERO new clashes", "verified rule-engine advice") labelled `FALLBACK_HEURISTIC` — it should fail clearly (RS-AUD-032) |
| Output validation | JSON parse only; no schema; unknown resource IDs are not checked |
| Prompt injection | No tool use, so impact is limited to misleading text; user text is concatenated into the prompt unfiltered |
| Reliability | Up to four models × two attempts with `Thread.sleep` on the request thread |

## 18. Dependency and configuration audit

| Item | Finding | Status |
| --- | --- | --- |
| Spring Boot | `pom.xml`: parent **3.3.5**; `AGENTS.md`: 3.4.x. Per the Spring team's announcement, 3.3.13 was the **last open-source 3.3.x release (June 2025)**; 3.4 OSS support ended 31 Dec 2025 and the whole 3.x line left OSS support on 30 Jun 2026 (current OSS lines: 4.0, ending 31 Dec 2026, and 4.1, ending 31 Jul 2027). The pinned 3.3.5 is also eight patch releases behind its own branch's final release | Confirmed (support status); CVE exposure of the pinned BOM **Not Verified** (no scanner, Maven Central blocked) |
| Java 21 | Supported by Boot 3.3 (17–23) | OK |
| Declared libraries | JJWT 0.12.6, springdoc 2.6.0, POI 5.3.0, PDFBox 3.0.3, Flyway (+postgresql module), Micrometer Prometheus, Lombok | Resolution not verified |
| Solver | **No OR-Tools / CP-SAT dependency**; nothing to package or check for native support | Missing |
| Test stack | `spring-boot-starter-test`, `spring-security-test`; **no Testcontainers, no H2**, yet `application-test` points at H2 → that profile cannot start | Broken profile |
| Unused | `spring-boot-starter-jdbc` (no JDBC code), `spring-boot-starter-mail` (under a comment reading "Spring SSE via webflux"), `@EnableScheduling` with no schedule | Cleanup |
| Config | `application-local` adds Flyway location `classpath:db/demo`, which does not exist (warning only); `allow-circular-references: true`; `open-in-view: true`; `app.whatsapp.*`, `app.pii.encryption-key`, token budget are dead keys | Medium/Low |
| Secrets | Defaults for JWT key, admin password and CORS origins live in `application.yml` with no production guard; no key-shaped secrets found in the repo | Medium |
| Ports / URLs | Vite proxy `/api` → backend; frontend uses relative `/api/v1`; no environment template (`.env.example`) | OK / gap |
| Frontend | `npm ci` resolves 317 packages; Vite 8.3.4, TS 6.0.3, React 19.3.1; `npm audit`: 3 moderate (PostCSS selector-parser chain via Tailwind 3.x, build-time only) | Low |

Spring Boot support dates as of 26 Oct 2026, from the [endoflife.date Spring Boot data](https://endoflife.date/api/spring-boot.json) (page opened): 3.3 ended 30 Jun 2025 (final release 3.3.13); 3.4 ended 31 Dec 2025; 3.5 ended 30 Jun 2026; 4.0 ends 31 Dec 2026; 4.1 ends 31 Jul 2027 (latest 4.1.2, released 22 Oct 2026). Corroborated by the Spring team's [3.3.13 announcement](https://spring.io/blog/2025/06/19/spring-boot-3-3-13-available-now/) and a [HeroDevs EOL summary](https://www.herodevs.com/blog-posts/spring-boot-versions-eol-dates-and-latest-releases-april-2026), both seen in search results only. CVE exposure of the pinned 3.3.5 dependency set was not assessed.

## 19. Testing and verification results

**Commands and activities actually executed**

| Activity | Status | Detail |
| --- | --- | --- |
| `npm ci` (frontend, from lockfile) | PASSED | 317 packages |
| `npx tsc` | PASSED | `strict:false`, so this is a weak check |
| `npm run build` (`tsc && vite build`) | PASSED | Vite 8.3.4, 2,736 modules, 2.6–5.1 s over two runs; JS ≈160 kB app + 360 kB Recharts + 364 kB vendor (gzip 41/104/114 kB) |
| `npm audit` | FAILED | 3 moderate: PostCSS selector-parser chain via Tailwind 3.x (advisory GHSA-rj75-hqrm-r3gf), build-time only |
| Frontend lint / unit / component / e2e | NOT APPLICABLE | No lint script, no test files, no Playwright or MSW |
| Migrations V1–V7 on PostgreSQL 16.15 | PASSED | Applied with `psql ON_ERROR_STOP`; V3 NOTICE confirms the skipped table |
| SQL invariant batteries (below) | RUN | Each test in a rolled-back transaction |
| Solver simulation (Python port) | RUN | 11 named scenarios + 36-case sweep; simulation, not the Java |
| `mvn compile` / `mvn test` | **BLOCKED** | Maven Central unreachable; Maven not installed; JRE only |
| Application start, Actuator, live API calls | **NOT RUN** | Blocked by the above |
| Backend unit tests (`JwtServiceTest`, `TimeRangeTest`) | NOT RUN | Content reviewed: two trivial tests |
| Spring Security / integration / contract / solver / backend e2e | NOT APPLICABLE | None exist |
| Backend dependency vulnerability scan | BLOCKED | No scanner, no Maven Central |
| 360 px layout, keyboard and screen-reader checks | NOT RUN | No browser; static signals only (§20) |

**Database test ledger (PostgreSQL 16.15)**

| Test | Expected | Observed |
| --- | --- | --- |
| T1–T5 UPDATE/DELETE/INSERT on ACTIVE session; ACTIVE→DRAFT; delete ACTIVE version | Rejected | **Rejected** (trigger messages) |
| T6 re-parent ACTIVE session to a DRAFT version | Rejected | **Allowed** — master 312 → 311 |
| T7 re-point `session_groups` of an ACTIVE session to a draft session | Rejected | **Allowed** — groups stripped |
| T8 `TRUNCATE timetable_sessions CASCADE` | Rejected | **Allowed** — also emptied overrides and jobs |
| T9 UPDATE/DELETE `audit_log` | Rejected | **Allowed** |
| T10 activate draft before archiving current | — | `duplicate key … one_active_version` |
| T10b archive first, then activate | OK | OK |
| T11 insert join rows after version ACTIVE | — | Rejected by lock trigger |
| S1 publish never-approved override | Rejected | Rejected by CHECK only |
| S2 approve → reject → publish | Rejected | **Allowed** — PUBLISHED |
| S4 PUBLISHED with arbitrary `approved_by` | Rejected | **Allowed** |
| R7-1/R7-2/R7-3 date scoping, unpublished ignored, Sunday | Correct | **Correct** |
| R7-4 newer master vs published override | Warn | Silently orphaned |
| V1 ROOM\_CHANGE into occupied room | New clash flagged | Flagged |
| V2 MOVE lecture onto division's lab slot | New group clash flagged | Flagged (room + group) |
| V3 move into room with ROOM\_UNAVAILABLE | New violation | **0 reported** |
| V4 lab → classroom, 2 h → 1 h | New violation | **0 reported** |
| V5 move a fixed session | Violation | Not executed (no fixed Monday session with a room); function body has no `is_fixed` reference |
| V7 baseline pair resolved by one move | Resolved; other pairs stay pre-existing | As expected |
| V8 two PROPOSED rows, same session/date | — | `uq_active_override` violation |
| J1 room rule `'CLASSROOM'` into `room_type[]` | OK | **malformed array literal** |
| J3 disruption with NULL `created_at` | OK | NOT NULL violation (what the canonical import builds) |
| J4 varchar bind into enum column | OK | **type error** without `stringtype=unspecified` |

**Golden scenarios (Final Draft §13 and the brief): 6 pass, 4 partial, 10 fail, 2 not modelled, 2 not verifiable**

| # | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Room unavailable → affected sessions identified | PASS | G1, G2, G7, G8 |
| 2 | Faculty absent → conflicts addressed | FAIL | G3: room change for an absent teacher; 3 new clashes |
| 3 | Lab disruption keeps 2-hour block | PARTIAL | Same-time room change keeps it; any time move ignores duration |
| 4 | Temporary room used only in its window | FAIL | No creation path; EXTRA\_ROOM inverted (G6) |
| 5 | Room change keeps original time | PASS | G1, G2, G7, G8 |
| 6 | Impossible disruption reported infeasible, nothing published | FAIL | G5: 23 cancellations, status SOLVED |
| 7 | Unchanged baseline clash does not invalidate | PARTIAL | SQL passes; no Java validation path |
| 8 | New clash blocks approval and publication | FAIL | Nothing checks |
| 9 | Unaffected session unchanged | PASS | Overrides are created only for collided sessions |
| 10 | Fixed session cannot be moved | FAIL | `is_fixed` ignored |
| 11 | Joint classes consistent | NOT MODELLED |  |
| 12 | Co-teaching respected | PARTIAL | Busy-check set membership only |
| 13 | Elective partitions | NOT MODELLED |  |
| 14 | Cross-division / cross-year conflicts | PARTIAL | SQL passes; solver fails (G3, G9) |
| 15 | Rejected plan cannot be published | FAIL | S2 |
| 16 | Modified plan cannot reuse stale validation | NOT VERIFIABLE | No validation is persisted |
| 17 | Student cannot read another group's data | FAIL | No auth, no mapping |
| 18 | Faculty cannot read another's timetable | FAIL | Same |
| 19 | AI suggestion cannot bypass validation/approval | PASS | No write path (structural) |
| 20 | Failed notification does not corrupt timetable | NOT VERIFIABLE | No real provider; coupled in one transaction |
| 21 | Repeated requests do not duplicate publication/notification | FAIL | Publish repeatable; re-runs change override ids |
| 22 | Published override affects only its date | PASS | R7-1 |
| 23 | Next date falls back to master | PASS | R7-1 |
| 24 | Invalid import cannot activate without review | FAIL | Auto-activation default |

The existing tests do **not** establish any of the 24 scenarios. A passing build must not be read as scheduling correctness.

## 20. Accessibility and responsive design audit

Only static analysis was possible; no browser was available.

- **Palette:** CSS tokens convert to the documented hex values within ±1 per channel (HSL rounding) — conforms.
- **Contrast (computed):** crimson on white 8.08:1, white on crimson 8.08:1, ink on canvas 15.10:1, muted on canvas 5.47:1 — pass. **Emerald-600 on white or canvas is 3.77:1 / 3.44:1 and white on an emerald-600 button is 3.77:1 — fail AA for the 12 px text it is used on** (e.g. "0 (Safe)", success banners).
- **Semantics:** `lang` and viewport meta present. Only 2 `aria-` attributes, 0 `role=`, 0 `aria-live`, 0 `tabIndex`, 0 `htmlFor` (21 `<label>` elements; association unverified), 26 `<th>` with no `scope`.
- **Dialogs:** the two modals are plain `div`s — no `role="dialog"`, no focus trap or restore, no Escape handling. Radix is installed but unused.
- **Text size:** 147 occurrences of 10–11 px text, harming readability of dense grids.
- **Status communication:** colour plus text is used in most places; there is no separate "validated" state because none exists; pre-existing vs new clash indicators appear only on the unreachable plan-detail page.
- **Responsive:** the sidebar is a fixed-width column with a collapse toggle but no off-canvas mobile pattern; behaviour at 360 px is a Potential problem, **not verified**. The mobile portal page is unreachable and hardcoded.
- **Unknown data:** the master viewer surfaces `needsReview` flags and raw values — a positive for R8.

## 21. Performance and scalability assessment

No defect is claimed without measurement; the items below are code-level observations.

| Observation | Status |
| --- | --- |
| Solver runs synchronously in the HTTP request, in one transaction; no timeout, cancel, queue or SSE | Confirmed (code); latency not measured |
| Lazy `groups`/`faculty` collections per session + `open-in-view: true` → N+1 on master read, baseline scan and every run | High-Confidence pattern; magnitude needs profiling |
| Baseline detection quadratic in session count (312 sessions ≈ 48k pair checks) | Fine at this size |
| `dispatchPendingJobs` loads all PENDING jobs; audit search and notification list unbounded | Potential at scale |
| Frontend JS ≈ 884 kB raw / ≈ 259 kB gzip, chunked (Recharts, vendor, Lucide) | Acceptable |
| Hikari default pool with open-in-view holding connections across rendering | Potential |
| No caching, no async executor, no concurrency control | Gap |

## 22. Deployment and production readiness

Not ready. Not found: Dockerfile, compose file, CI/CD, database backup/restore or rollback runbook, `.env.example`, production profile guards. Present: Actuator health/Prometheus (public), a `/api/v1/ping`, Flyway migrations. Additional concerns: defaults for secrets and admin password in `application.yml`; the application DB role is the table owner (so `TRUNCATE` is available); correlation IDs are generated but absent from the log pattern; `target/` and `dist/` are shipped without a root `.gitignore`, and a `.env` at the root would not be ignored.

## 23. Complete findings register

Status values: Confirmed / High-Confidence / Potential / Not Verified. Efforts are engineering estimates for one developer. Cards for Critical and High findings are below; Medium, Low and Informational findings follow in a table.

### Critical

**RS-AUD-001 — Authentication and authorization are disabled** · Security · **Critical** · Confirmed

- *Where:* `config/SecurityConfig` (`requestMatchers("/api/**").permitAll()`, `anyRequest().permitAll()`); `identity/JwtAuthenticationFilter` (default-coordinator branch; three roles added unconditionally).
- *Evidence / root cause:* source text; a code comment says requests are "auto-authenticated as coordinator"; the scratch scripts call the API without credentials; the frontend has no login. A development shortcut sits in the production path.
- *Impact:* anyone on the network can run, approve and publish plans, delete published overrides, read PII and audit logs and spend AI quota; every audit actor is the coordinator; R5/R6/R10 controls are void.
- *Fix:* permit only `/auth/login`, `/auth/refresh` and health; delete the fallback and take authorities from the user's real role; add method or URL rules to every endpoint; build the login UI and token interceptor; make any dev bypass a non-prod profile that refuses to start alongside `prod`.
- *Tests / effort / prerequisites:* Spring Security tests for every endpoint × role (401, 403, 200); STUDENT token cannot approve. 3–5 days backend + 2–3 days frontend. None — do first.
- *Acceptance:* anonymous requests return 401 except login/refresh/health; role matrix green; audit actor equals token subject.

**RS-AUD-002 — Plan lifecycle has no state machine** · Workflow · **Critical** · Confirmed (DB-run S1, S2)

- *Where:* `RescheduleService.approvePlan/rejectPlan/publishPlan` and the `% 10000` plan-id arithmetic; `PlanController` role lists; `PlanBuilderPage` one-click approve+publish.
- *Evidence / root cause:* no status is read before any transition; reject → publish succeeds; Plans B/C alias Plan A; the coordinator may approve and publish her own run. Lifecycle is three bulk UPDATEs with no plan entity, version, hash or lock.
- *Impact:* rejected, stale, duplicate or self-approved publication (R5).
- *Fix:* add a `plans` table (state, plan hash, master version, validation reference, approver/publisher, `@Version`); a single transition service implementing the table in §15; HOD-only approve/reject/publish (confirm the rule with stakeholders); re-validate at approval and at publish; idempotency key; separate Approve and Publish actions with a confirmation dialog.
- *Tests / effort / prerequisites:* every illegal edge returns 409 with no DB change; concurrent double-publish; stale-hash approval. 5–8 days. 001, and 006 for the validation hook.
- *Acceptance:* illegal transitions are rejected with no side effect; one publish produces exactly one set of notification rows under concurrency.

**RS-AUD-003 — Fabricated safety assurances and plan metrics** · Integrity · **Critical** · Confirmed

- *Where:* `RescheduleService.getPlansForRun/triggerRun` (`newClashes(0)`, `baselineClashes(2)`, `shortfallMinutes(0)`, `solveMs(185)`, "Generated 3 conflict-free candidate plans", Plan B/C text naming a non-existent "Seminar Hall / Multipurpose Lab B-101"); `NotificationService.getBroadcastDrafts` ("Zero new clashes verified."); `AnalyticsController` (`zeroNewClashRate=100.0`); `PlanBuilderPage`, `DashboardPage`, `PlanDetailPage`, `AnalyticsPage` literals; AI fallback text. Shipped bytecode contains the same strings.
- *Root cause / impact:* prototype constants never replaced by computed values; the HOD approves on false assurances and recipients are told clashes were verified; screens disagree (2 vs 41 baseline pairs).
- *Fix:* derive every number from persisted validation results; show "not validated" until one exists; delete Plans B/C until real; add a CI grep gate for "guarantee"-style literals.
- *Tests / effort / prerequisites:* UI tests that no assurance renders without a validation record; DTO contract test. 2–3 days. 006.
- *Acceptance:* no hardcoded assurance string; every metric traces to a stored row.

**RS-AUD-004 — The solver is not the specified engine** · Core feature · **Critical** · Confirmed

- *Where:* `RescheduleService.triggerRun`; `pom.xml` (no OR-Tools).
- *Evidence / root cause:* greedy loop only. Missing: CP-SAT model, objective (minimize moves, prefer room change), ranked alternatives, pins and forbid-and-resolve, move-count confirmation threshold, infeasibility explanation, timeout, async runs. Final Draft and tasks A-12/A-13 require them.
- *Impact:* the core product is absent; impossible inputs return "SOLVED" (G5).
- *Fix:* implement A-12/A-13: CP-SAT model over (room × slot) options for affected and ripple sessions; lexicographic objective; the hard constraints in §10; top-k plans; infeasibility explanation; asynchronous execution with timeout and status/SSE; persisted plans.
- *Tests / effort / prerequisites:* the 14 Final Draft golden scenarios; property-based fuzz against the independent oracle. 4–6 weeks. 002, 006, capacity/strength data.
- *Acceptance:* golden scenarios pass; fuzz yields zero oracle-invalid plans; infeasible input returns INFEASIBLE with a reason and no publishable plan.

**RS-AUD-005 — The heuristic can introduce new clashes** · Correctness · **Critical** · High-Confidence (simulation)

- *Where:* `RescheduleService` faculty/group busy checks against unaffected sessions only with exact-id `contains`; `findConflictFreeRoom`.
- *Evidence / root cause:* G3 (3 new clashes), G9 (4 new group clashes), sweep up to 9. Occupancy ignores overrides already generated, collided-but-held sessions and division/batch overlap.
- *Impact:* R4 breach that reaches approval.
- *Fix (interim, until RS-AUD-004):* pass every candidate through the validator and refuse any new clash; use `groups_overlap` semantics; include generated overrides in occupancy.
- *Tests / effort:* G3, G9 and the sweep as regression and randomized tests. 3–4 days.
- *Acceptance:* the sweep yields zero new clashes or INFEASIBLE.

**RS-AUD-006 — No independent validator in the workflow; SQL validator unwired and blind** · Validation · **Critical** · Confirmed

- *Where:* `conflict/ConflictService` (master only); `effective_conflicts`, `blast_radius`, `classroom_capacity_check` never called.
- *Evidence:* grep shows no JDBC or native query; DB-run V3/V4 blind spots; no validation stored.
- *Fix:* a plain-Java validator over the effective timetable (master + candidate overrides) covering room, faculty and group (with overlap semantics), disruptions, temporary-room windows, room type and policy, duration and lab blocks, fixed sessions and blast radius versus the affected set; differential-test against `effective_conflicts`; persist the result with the plan hash; gate approve and publish on it.
- *Tests / effort / prerequisites:* mutation tests injecting each violation class; Java-vs-SQL differential test. 1–2 weeks. 002.
- *Acceptance:* every V3/V4/fixed-move case is rejected; approve and publish are impossible without a matching passing validation.

**RS-AUD-007 — Destructive deletion of approved and published overrides** · Data integrity · **Critical** · Confirmed

- *Where:* `RescheduleService.triggerRun` (prior-override clear); `DisruptionController` (`delete`, `resetDay`, `deleteAll`, `normalizeDay`); `NotificationService.clearAllForDate` / `DELETE /notifications/broadcasts`; `uq_active_override`.
- *Root cause / impact:* the unique index forces replacement and the helper deletes by date regardless of status. Published changes are silently reverted, notification history and runs are erased, nothing is audited (R5, R7, R10).
- *Fix:* never delete APPROVED/PUBLISHED rows (enforce with a trigger); model supersession through plan states; soft-delete only draft/proposed rows; audit every disruption mutation; require role and confirmation; deleting a disruption must not auto-run the solver.
- *Tests / effort / prerequisites:* re-run, reset and delete after publish leave rows and jobs intact. 3–4 days. 002.
- *Acceptance:* no code path or SQL statement can delete or overwrite a published override.

**RS-AUD-008 — Notification delivery is simulated and reports false success** · Integration · **Critical** · Confirmed

- *Where:* `NotificationService.dispatchPendingJobs`; `app.whatsapp.*` unused.
- *Evidence / impact:* every PENDING job becomes SENT with a fabricated `wamid_<uuid>`; the seed has no phone numbers; there is no consent, webhook or retry. Operators would believe recipients were told.
- *Fix:* outbox worker (`SKIP LOCKED`, backoff, rate limits); WhatsApp Cloud API client (sandbox first); signed, replay-safe webhooks → DELIVERED/READ/FAILED; contacts and consent tables; E.164 validation; SENT only on provider acceptance; any simulation behind an explicit `sandbox` flag with a visible `SIMULATED` status.
- *Tests / effort / prerequisites:* provider stub for success, failure, 429 and partial failure; webhook signature and replay; concurrent workers produce no duplicates. 3–4 weeks. 018, 002.
- *Acceptance:* no job reaches SENT without a provider message id issued by the provider; zero duplicate sends in the concurrency test.

### High

**RS-AUD-009 — Faculty absence is handled as a room change** · Solver · **High** · High-Confidence (simulation G3)

- *Where:* `RescheduleService.triggerRun` — a faculty match marks the session collided, then `findConflictFreeRoom` merely excludes the original room.
- *Evidence / impact:* absent teacher still scheduled in 3 of 3 sessions, plus 3 new clashes; the spec says faculty are never changed automatically and a faculty-only absence is flagged for cancellation or manual handling.
- *Fix:* faculty-unavailability becomes a hard constraint on every move (including ripple sessions); the outcome for a hit session is CANCEL or FLAG\_FOR\_HUMAN, never a silent room change; any proxy is a separate HOD-confirmed proposal.
- *Tests / effort:* G3 plus half-day absence. 2 days interim, then part of RS-AUD-004. *Acceptance:* no override leaves an absent faculty member scheduled.

**RS-AUD-010 — Duration and lab-block integrity ignored on time moves** · Solver · **High** · High-Confidence (sweep)

- *Where:* hardcoded alternates 14:00–16:00, 11:15–13:15, 16:00–17:00; the new start/end are the slot whatever the session length.
- *Evidence:* the sweep produced 1 h → 2 h and 2 h → 1 h changes (e.g. Mon 10–11, Tue 14–15, Thu 14–16 closures).
- *Fix:* generate candidates from `periods` and `lab_blocks` by the session's duration (labs on LB1–LB3, plus LB4 only if confirmed; one period for 1 h; contiguous periods for documented 2 h non-lab sessions, never across recess or lunch); validator enforces the same.
- *Tests / effort:* boundary tests at 11:00/11:15 and 13:15/14:00; adjacency. 3 days with RS-AUD-004. *Acceptance:* every MOVE preserves duration and aligns with the grid.

**RS-AUD-011 — Sunday is mapped to Monday** · Correctness · **High** · Confirmed (code, G4)

- *Where:* `triggerRun` (`rawDay > 6 ? 1 : rawDay`). A Sunday run creates overrides for Monday sessions dated Sunday; notifications would announce them; the SQL validator cannot see them.
- *Fix:* reject dates outside Mon–Sat with 400 in API and date picker; use the Asia/Kolkata clock. *Tests / effort:* Sunday → 400, Saturday works. 0.5 day.

**RS-AUD-012 — EXTRA\_ROOM is inverted; no temporary-room path** · Solver/Disruptions · **High** · Confirmed (G6)

- *Where:* disruption loops ignore `kind`; `findConflictFreeRoom` excludes any room with any disruption; `DisruptionsPage` offers EXTRA\_ROOM on *existing* rooms; temporary rooms can only arrive through the failing canonical import.
- *Fix:* only ROOM\_UNAVAILABLE excludes; EXTRA\_ROOM adds an eligible room for its window; add temporary room + availability window to API and UI. *Tests / effort:* temp room used only inside its window; G6 regression. 3–4 days; prerequisite RS-AUD-025.

**RS-AUD-013 — Fixed sessions, room rules and capacity ignored; practicals moved into classrooms; batches merged** · Solver · **High** · Confirmed (code, L1)

- *Where:* `isFixed` never read; `RoomPolicyOverride` never read; the explicit lab-cancel path (`findConflictFreeClassroomForAdjustedTheory`) places labs in classrooms and merges same-division batches into one room.
- *Evidence / impact:* the spec says practicals use labs unless a room rule exists and merging needs a named confirmation (enforced by a DB CHECK); the lab-to-theory behaviour appears in **none** of the three requirement documents. Capacity and strength are NULL everywhere, so defaults (60/25) are invented.
- *Fix:* remove the undocumented path or have it specified; implement pins, rule scope and precedence, confirmed merges, and a capacity check on real data. *Tests / effort:* fixed never moved; scope tests; merge requires confirmation. 1–2 weeks with RS-AUD-004.

**RS-AUD-014 — Business logic driven by free text; division-name mismatch; non-determinism** · Solver/UI · **High** · Confirmed / High-Confidence

- *Where:* substring list ("cancel lab", "adjust to theory", …) on the reason; division keys `se-a … te … be` versus group names `SY-`/`TY-`/`BE-`; `"se"` matches "sessions"; `findFirst` on a `HashSet` of entities; the UI "SE"/"TE" rule picks the first three labs by id.
- *Evidence:* L1 — the "SE" rule hit SY **and** TY labs in A-209/A-210.
- *Fix:* structured fields (`scope.levels`, `scope.divisions`, `policy`) instead of text parsing; deterministic ordering. *Tests / effort:* scope tests; repeated runs identical. 2–3 days.

**RS-AUD-015 — Malformed times silently widen scope; invalid ids silently skipped** · Validation · **High** · Confirmed

- *Where:* `DisruptionController` (`catch (Exception ignored)` makes a bad time null = whole day; end ≤ start becomes start + 1 h; unknown room/faculty ids skipped in bulk and canonical import).
- *Fix:* Bean Validation with 400 responses; reject unknown ids and `start >= end`; surface errors in the UI. *Tests / effort:* "9am" → 400; unknown id → 400. 1 day.

**RS-AUD-016 — Default credentials and secret defaults** · Security · **High** · Confirmed

- *Where:* `UserService` startup seeding (`ChangeMe123!` for coordinator and HOD, `mustChangePassword=false`; admin from a property default); `application.yml` defaults for the JWT key, admin password and PII key; no change-password endpoint.
- *Fix:* fail fast in `prod` when defaults are present; one-time generated passwords with a forced-change flow; keys from a secret store. *Tests / effort:* startup refuses default secrets under `prod`. 2 days.

**RS-AUD-017 — Lockout, refresh-reuse and logout defects** · Security · **High** · High-Confidence

- *Where:* `AuthService.login/refresh` (class-level `jakarta.transaction.Transactional`; `ApiException` rolls back the counter and `revokeFamily`); `AuthController` cookie path versus `/auth/logout`; `refresh` with no cookie → `sha256(null)`; no enabled-check on refresh.
- *Fix:* commit security state independently (`REQUIRES_NEW` or `noRollbackFor`); cookie path `/api/v1/auth`; null guards; check the user is enabled; audit authentication events. *Tests / effort:* 5 failures lock; replayed refresh revokes the family; logout revokes. 2 days.

**RS-AUD-018 — No user↔faculty/group model, no user-admin API, no personal-timetable endpoints** · Design · **High** · Confirmed

- *Where:* `users` has no `faculty_id`/`group_id`; `UserService` has no controller; timetable endpoints accept arbitrary ids.
- *Fix:* link users to faculty or group, add contacts and consent, ADMIN user API, `/me/timetable` derived from the token, ownership checks, a PII-free public master grid. *Tests / effort:* BOLA tests (faculty A cannot read B; student cannot read another group). 1–2 weeks; prerequisite RS-AUD-001.

**RS-AUD-019 — Method-level authorization gaps that survive RS-AUD-001** · Security · **High** · Confirmed

- *Where:* `NotificationController` (list, `DELETE /broadcasts`), `ReferenceDataController` GETs (phone, email), `PlanController`/`RescheduleController` GETs, `ConflictController`, `AnalyticsController`, `AiAssistantController`, `TimetableController`.
- *Fix:* deny-by-default filter chain with an explicit role per route; non-admin DTOs without PII. *Tests / effort:* the role-matrix test. 2–3 days with RS-AUD-001.

**RS-AUD-020 — Frontend has no login, token handling or roles; 10 of 18 pages unreachable** · Frontend · **High** · Confirmed

- *Where:* `App.tsx` (8 routes), `Sidebar.tsx` (fake identity badge), `api.ts` (no interceptor), orphan pages.
- *Fix:* login, token refresh interceptor, route guards (UX only), role-specific navigation; route approval queue, audit log, room rules, notification centre, published timetable and portals, wiring each to real endpoints; delete pages that stay mocks. *Tests / effort:* Playwright per role; a lint gate against orphan pages. 2–3 weeks.

**RS-AUD-021 — Import invents or drops data (R8)** · Import · **High** · Confirmed

- *Where:* `TimetableImportParserService` — unmatched group → `allGroups.get(0)`; fuzzy `contains`; group names split on `/`; day → Monday; time → 09:00; subject → `SUB`; unknown room/faculty dropped with `needsReview=false`; PDF rows hardcode `SY-A`; fixed/joint/elective/merged cells not modelled.
- *Fix:* parse into the existing `imports`/`import_rows` staging tables preserving raw values; every unresolved field becomes a review flag; never default; grid-aware PDF/Excel parsing; validate times against periods and lab blocks. *Tests / effort:* fixtures from the real master PDF; unknowns stay unknown. 3–4 weeks.

**RS-AUD-022 — Auto-activation, no review gate, no hash dedupe** · Import · **High** · Confirmed

- *Where:* `ImportController`/`ImportService.activateVersion`; `activateImmediately` defaults true; `source_sha256` unused; review tables unused; no status or flag check on activation; the frontend never calls activate.
- *Fix:* default DRAFT; review API (resolve flags, remembered aliases); activation requires zero open flags and an acknowledged baseline report; identical hash reuses the version. *Tests / effort:* flagged import cannot activate; duplicate upload returns the existing version. 1–2 weeks.

**RS-AUD-023 — Parser throws NPE on null subject names** · Import · **High** · Confirmed (code + seed)

- *Where:* subject lookup `s.getName().equalsIgnoreCase(..)`; 30 of 32 seeded subjects have NULL names, so essentially any row not matched by code first fails.
- *Fix:* null-safe matching, code first. *Tests / effort:* import against the seeded DB. 0.5 day.

**RS-AUD-024 — Activation transaction hazards** · Import/DB · **High** · High-Confidence (DB side Confirmed T10/T11)

- *Where:* `ImportService.activateVersion` saves the target ACTIVE before archiving the current one; import-with-activation flushes join rows after the status UPDATE in one transaction.
- *Fix:* archive, `saveAndFlush`, then activate; run activation in its own transaction after the import commits; lock the versions row. *Tests / effort:* Testcontainers Postgres integration tests for first activation, replacement, concurrent activation. 1–2 days.

**RS-AUD-025 — Canonical JSON import broken and misreported** · Import · **High** · Confirmed (code + J3)

- *Where:* `ImportService.importCanonicalJson` builds `Disruption` without `createdAt` (NOT NULL); unknown rooms/faculty skipped; only `scope.level` honoured (`scope.division` dropped, so a BE-A rule becomes department-wide); `classrooms`, `labs`, `lab_blocks`, `other_rooms` ignored; `DisruptionsPage` uses raw `fetch` and ignores `response.ok`.
- *Fix:* creation timestamps via `@PrePersist`; validate and reject unknown ids; honour division/batch scope; use the adapter and show errors. *Tests / effort:* round-trip `input_example.json`. 2–3 days.

**RS-AUD-026 — Master-lock bypasses, TRUNCATE, mutable audit log** · Database · **High** · Confirmed (T6–T9)

- *Where:* `trg_lock_master` examines `NEW` only on UPDATE; no TRUNCATE protection; the app role owns the tables; `audit_log` unguarded.
- *Fix:* check both `OLD` and `NEW` version ids; `BEFORE TRUNCATE` triggers and separate owner/app roles; append-only audit via revoked UPDATE/DELETE plus trigger. *Tests / effort:* T6–T9 become rejections. 1–2 days.

**RS-AUD-027 — Room-rule persistence mismatch and dead V3 DDL** · DB/JPA · **High** · Confirmed (J1)

- *Where:* `RoomPolicyOverride.allowRoomTypes` is a `String` against `room_type[]`; V3's `IF NOT EXISTS` table is skipped; `confirmedBy` is free text from the client.
- *Fix:* map the array properly, take the confirmer from the authenticated user, remove the dead DDL with a corrective migration. *Tests / effort:* create/read round trip; merge without confirmer rejected. 1–2 days.

**RS-AUD-028 — Analytics are fabricated** · Backend/Frontend · **High** · Confirmed

- *Where:* `AnalyticsController` (hardcoded utilization, day distribution, `zeroNewClashRate=100.0`).
- *Fix:* compute from the database and validation results, or remove and label. *Tests / effort:* values change when data changes. 2–3 days.

**RS-AUD-029 — Broadcast drafts from unapproved plans; hardcoded assurance; dedupe defeated; global dispatch** · Notification · **High** · Confirmed

- *Where:* `NotificationService.getBroadcastDrafts` (any status), `BroadcastsPage` `wa.me` links, `dispatchPendingJobs`, `queueNotificationsForOverride`.
- *Fix:* drafts only for PUBLISHED plans; remove hardcoded sentences; dedupe on (plan, recipient, change hash); dispatch per plan with locking. *Tests / effort:* unpublished plan yields no drafts; re-run does not duplicate. 2–3 days; prerequisite RS-AUD-002.

**RS-AUD-030 — Spring Boot 3.3.5 is end-of-life; the documented 3.4.x also is** · Dependency · **High** · Confirmed (support status); Not Verified (CVE exposure)

- *Where:* `pom.xml` parent 3.3.5; `AGENTS.md` 3.4.x. Both lines are past open-source support (§18).
- *Fix:* target Spring Boot 4.1 (open-source support to 31 Jul 2027; 4.0 ends 31 Dec 2026 and every 3.x line has already ended), align `AGENTS.md`, upgrade BOM-managed libraries (including springdoc), and run a dependency scanner when the network allows. *Tests / effort:* full suite on the new baseline. 1–2 weeks to 4.1 for a codebase this size (estimate; migration notes not reviewed).

**RS-AUD-031 — Backend unverified; test suite trivial; test profile broken** · Quality · **High** · Confirmed (gap)

- *Where:* `backend/src/test` (two tests); `application-test` uses H2 with no H2 dependency.
- *Fix:* Testcontainers Postgres + Flyway integration tests, Spring Security tests, solver/validator golden and property tests, a CI gate; compile and run in an environment with Maven Central access. *Tests / effort:* the 24 golden scenarios as the acceptance suite. 2–3 weeks, ongoing.

### Medium, Low and Informational

| ID | Title | Sev. | Status | Where | Evidence and impact | Fix · tests · effort · acceptance |
| --- | --- | --- | --- | --- | --- | --- |
| RS-AUD-032 | AI assistant: canned fabricated claims, `.env` scanning, client-supplied key, open endpoint | Medium | Confirmed | `GeminiAiService` (fallback, key discovery), `AiAssistantController`, `AiQueryRequest.apiKey` | R6 write-isolation holds, but with no key or on API error it returns confident invented statements ("CP-SAT guarantees ZERO new clashes"); anyone can spend the server key; budget config unused | Fail clearly (503) with no canned claims; server-side key only; auth, rate limit and budget; schema-validated output with known-id checks; include sessions in context; feature flag. Tests: no key → 503, unknown ids rejected, injection cases. 3–4 days. Acceptance: no fabricated answer path |
| RS-AUD-033 | Enum binding depends on `stringtype=unspecified` | Medium | Confirmed (J4); Java path High-Confidence | `application-local` datasource URL; `@Enumerated` fields on native PG enums | Any datasource URL without the parameter breaks writes to override, notification and session tables | Map with `@JdbcTypeCode(SqlTypes.NAMED_ENUM)` or convert to varchar + CHECK; keep the parameter in all profiles. Tests: Testcontainers with the default URL. 1 day |
| RS-AUD-034 | Master replacement silently orphans published overrides | Medium | Confirmed (R7-4) | `effective_timetable`, `activateVersion` | A published override for an earlier or future date stops applying with no warning | Block or warn on activation when PUBLISHED overrides exist; define carry-forward by stable session key. Tests: activation report. 2–3 days |
| RS-AUD-035 | Seed governance and provenance | Medium | Confirmed | `V2__seed.sql`, `build_seed.py`, `seed.sql` | Master activated with 62 unresolved flags; generator inputs (`master_timetable.txt`, source PDF) and `conflicts_report.md` not shipped; hardcoded `/mnt/user-data/...` path | Ship inputs and hashes, document the seed, keep a pre-activation check. 1–2 days |
| RS-AUD-036 | KRC reclassified as LAB by V7 | Medium | Potential (domain decision) | `V7__remove_intel_lab_update_krc_coordinator.sql`, root `seed.sql` | Docs list "6 classrooms, KRC, 10 labs" and treat KRC as tutorial space with unconfirmed location; V7 makes it a LAB, so G1/G2/G8 send computer-lab practicals to the library (R8: unconfirmed becomes definite) | Confirm with the HOD; model KRC as its own type; add a lab-suitability (equipment) flag. 0.5 day + decision |
| RS-AUD-037 | Timezone handling | Medium | Confirmed (code) | Frontend `AppLayout` (`toISOString`, computed once); backend `LocalDate.now()` in importer, notification controller, AI service | UTC "today" is wrong 00:00–05:30 IST; some backend dates ignore the Asia/Kolkata `Clock` bean | One IST `Clock`; frontend `Intl` with `Asia/Kolkata`, recomputed at midnight. Tests at 18:30 UTC. 1 day |
| RS-AUD-038 | Frontend error handling and stubs | Medium | Confirmed | Dashboard, PlanBuilder, Broadcasts (swallowed errors); Disruptions (`alert`); master viewer exports; `AdminSettingsPage` | Backend failure renders "No Candidate Plans" or zeros; exports are `alert()`; Save reports success without persisting; destructive actions unconfirmed | Shared error and toast components, confirmation dialog, wire or remove stubs. 3–4 days |
| RS-AUD-039 | Accessibility | Medium | Confirmed (static) | See §20 | Failing contrast for emerald text/buttons, no dialog semantics, unlabelled tables, tiny text | Use Radix Dialog, fix contrast tokens, `htmlFor`, `scope`, live regions, ≥ 12 px text; verify at 360 px with a browser. 1–2 weeks |
| RS-AUD-040 | Error mapping and exception swallowing | Medium | Confirmed | `GlobalExceptionHandler`; `DisruptionController.delete` | Malformed JSON, bad enum values, integrity violations and 405/415 become 500; `catch (Throwable)` leaves a rollback-only transaction that fails at commit | Specific handlers (400/404/405/409/415/422), correlation id in ProblemDetail, never catch `Throwable`. 2 days |
| RS-AUD-041 | No concurrency control on runs, approval or publish | Medium | High-Confidence | `triggerRun`, plan endpoints | No `@Version`, no row locks; concurrent runs interleave delete/insert; concurrent publishes double-queue | `SELECT … FOR UPDATE` on date/run and plan, optimistic version, idempotency keys. Tests: parallel run/publish. 2–3 days |
| RS-AUD-042 | Audit coverage and attribution | Medium | Confirmed | `AuditService` call sites; `AuditController` | Actor is always the default coordinator (RS-AUD-001); disruption changes, reference-data edits, room rules, AI queries, authentication events are not audited; list capped at 100 without paging; table mutable | Audit every state-changing endpoint (aspect), paginate, append-only. 2–3 days |
| RS-AUD-043 | PDF / Excel / ICS exports missing | Medium | Confirmed | No export code; UI `alert()` | Required deliverable (task A-22) absent | Implement exports of the effective timetable per group/faculty, ICS feeds; tests on content. 1–2 weeks |
| RS-AUD-044 | Operational gaps | Medium | Confirmed | `application.yml`, `SecurityConfig`, repo root | No async executor/SSE/scheduler; public Prometheus and Swagger; correlation id not in log pattern; `open-in-view: true`; `allow-circular-references: true`; no container, CI, backup or runbook | Tasks A-21, A-25, A-26; secure actuator; disable open-in-view; log pattern with `%X{correlationId}`. 2–3 weeks |
| RS-AUD-045 | N+1 loading and quadratic scans | Medium | Potential | Lazy collections on `TimetableSession`; `ConflictService` | Likely hundreds of queries per master read; not measured | Entity graphs or DTO projections; use SQL functions; profile with realistic load. 2–3 days + profiling |
| RS-AUD-046 | Repository hygiene | Low | Confirmed | Repo root | `backend/target/`, `frontend/dist/`, `_extract_*.txt`, UTF-16 scratch files shipped; no root `.gitignore` (a root `.env` would not be ignored) | Add `.gitignore`, remove artifacts, normalize encodings. 0.5 day |
| RS-AUD-047 | Unused dependencies and dead config | Low | Confirmed | `package.json`, `pom.xml`, `application.yml`, `SecurityConfig` | Radix, TanStack Query, React Hook Form, Zod, date-fns, `starter-jdbc`, `starter-mail`, `@EnableScheduling`, `app.whatsapp.*`, `app.pii.*`, token budget, permitted but nonexistent `/webhooks`, `/share`, `/consent`, dead `mockData.ts` | Remove, or implement as planned. 0.5 day |
| RS-AUD-048 | `npm audit`: 3 moderate (build-time) | Low | Confirmed | Tailwind 3.x → `postcss-nested` → `postcss-selector-parser` (GHSA-rj75-hqrm-r3gf) | Dev-tool CPU-exhaustion advisory; no runtime exposure expected | Resolve with a planned Tailwind 4 migration. Low priority |
| RS-AUD-049 | Documentation and requirement conflicts needing decisions | Info | Confirmed | `AGENTS.md`, Final Draft, Prompt Pack | (a) approver: HOD per §11 vs "HOD / coordinator" in the diagram; (b) Next.js in the draft vs Vite/React; (c) rooms: "17 listed", A-207 removed by V7, worked example now differs; (d) LB4 (15:00–17:00) and 26 non-lab two-hour sessions vs R9; (e) Boot 3.3.5 vs 3.4.x; (f) lab-to-theory behaviour undocumented; (g) mock pages assign proxy faculty | Record decisions in `AGENTS.md`; update the Final Draft |
| RS-AUD-050 | Message content issues | Low | Confirmed | `NotificationService` templates | "Dr." rendered as "Prof."; hardcoded coordinator signature; fixed cancellation reason | Parameterize templates; use approved WhatsApp templates. 1 day |

## 24. Root-cause and cross-module dependency analysis

Fifty findings reduce to seven root causes. Fixing these first removes most symptoms.

| Root cause | Description | Findings |
| --- | --- | --- |
| RC1 — Prototype shortcuts left in the production path | Auth bypass, constant metrics, simulated delivery, mock pages, canned AI answers | 001, 003, 008, 020, 028, 029, 032, 038 |
| RC2 — No plan domain model | No plan entity, hash, validation record, master-version link or state machine; `uq_active_override` forces replacement by deletion | 002, 003, 006, 007, 034, 041 |
| RC3 — The engine was not built as specified and nothing verifies it | Greedy heuristic, no model or objective, no independent check | 004, 005, 009–014 |
| RC4 — Import is heuristic and unreviewed | Staging and review tables unused; defaults invent data | 021–025, 035 |
| RC5 — Incomplete identity and contact model | No user↔faculty/group, ownership, contacts or consent | 018, 019, 008 |
| RC6 — JPA/schema contract drift | Array, enum, NOT NULL and flush-order mismatches | 024, 025, 027, 033 |
| RC7 — Verification gap | Two trivial tests, no CI, backend not buildable in this audit, EOL platform | 030, 031, 044 |

**Dependency chains**

- 001 → 019 → 018 → 008 (cannot define ownership or deliver messages before identity and contacts exist).
- 002 → {003, 006, 007, 029, 041}; 006 → 005 → 004 (the validator must exist before the solver can be trusted or its output approved).
- 021 → 022 → 024 (review gate before activation; fix activation mechanics at the same time).
- 012 depends on 025 (temporary-room creation); 013 depends on 027 (rule persistence); 010 and 013 are folded into 004.
- 020 depends on 001 (login) and on endpoints from 002, 018 and 043.
- 031 and 030 are continuous: add tests with every fix; do the platform upgrade before the test suite grows.

## 25. Prioritized remediation roadmap

No rewrite is recommended. The database design is sound and most defects are localized to `RescheduleService`, the import package and the security configuration, plus missing components (plan model, validator, solver, outbox).

**P0 — Stop the harm (≈ 2–3 weeks)**

| Item | Detail |
| --- | --- |
| Findings | 001, 019, 016, 017, 026, 002, 007, 003, 011, 015, 023; interim 008 (label delivery `SIMULATED`, stop writing `SENT`) and 029 (drafts only for published plans) |
| Required changes | Security baseline and minimal login UI; plan table with state machine and HOD-only transitions; never delete approved/published rows; trigger hardening; remove every unconditional "zero clash" claim; reject Sunday and malformed times; null-safe subject lookup |
| Files | `SecurityConfig`, `JwtAuthenticationFilter`, `AuthService`, `AuthController`, `UserService`, `RescheduleService`, `PlanController`, `DisruptionController`, `NotificationService`, `NotificationController`, `TimetableImportParserService`, `application.yml`, new migrations, `api.ts`, `App.tsx`, `PlanBuilderPage`, `DashboardPage`, `AnalyticsPage` |
| Order | 001/019/016/017 → 026 → 002 + 007 → 003 → quick fixes |
| Tests | Role matrix; transition matrix; T6–T9 as regressions; delete-after-publish; Sunday and bad-time cases |
| Acceptance | Anonymous → 401; illegal transitions → 409; published rows undeletable; no assurance text without a validation record |
| Regression risk | Frontend must send tokens at the same time; existing scratch scripts stop working (replace with authenticated tests) |

**P1 — Make it correct (≈ 8–12 weeks)**

| Item | Detail |
| --- | --- |
| Findings | 006, 005, 004 (with 009–014), 021–025, 027, 018, 008 (full), 029 (full), 020, 028, 030, 031 |
| Required changes | Java validator with persisted results; interim validator gate on the heuristic; CP-SAT engine with ranked plans, pins, infeasibility reasons and async runs; staged import with review and gated activation; identity links, contacts and consent; outbox worker and WhatsApp sandbox integration; routed role-based frontend; computed analytics; platform upgrade; real test suite |
| Order | 006 → 005 (interim) → 004 in parallel with 021–025/027 → 018 → 008 → 020 → 028; 030/031 continuous |
| Tests | The 24 golden scenarios; fuzz with independent oracle; Testcontainers integration; webhook signature/replay; BOLA |
| Acceptance | All 24 golden scenarios pass in CI; zero oracle-invalid plans in fuzz; no `SENT` without a provider id; import cannot activate with open flags |
| Regression risk | Solver swap changes outputs — keep G1–G9 as snapshots; platform upgrade touches Hibernate and Jackson behaviour |

**P2 — Supporting functionality (≈ 3–4 weeks):** 032–045 — AI hardening, enum mapping, master-replacement policy, seed provenance, timezone, error handling, concurrency control, audit coverage, exports, operational gaps, performance profiling, accessibility.

**P3 — Local quality (≈ 1 week):** 046–050.

**P4 — Optional, justified by the plan:** Tailwind 4 migration (clears 048), generated API client with contract tests (tasks M-01/M-02), MSW handlers and Playwright visual snapshots (M-06, Q-01), design-gallery cleanup.

## 26. Detailed fix specifications (by shared root cause)

These specifications are proposals for review. No code has been changed.

**FS-1 — Security baseline** (RS-AUD-001, 016, 017, 019; login part of 020)

- `SecurityConfig`: permit only `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/ping`, `/actuator/health`; `authenticated()` for everything else; an explicit role per route following the §14 matrix; delete the default-coordinator branch and the unconditional role grants in `JwtAuthenticationFilter`; authorities come from `User.role`.
- `AuthService`: commit failed-attempt and revocation state independently (`REQUIRES_NEW` or `noRollbackFor = ApiException.class`); cookie path `/api/v1/auth`; guard null cookies; refuse disabled users on refresh; audit authentication events.
- Secrets: configuration properties validated at startup — under `prod`, refuse the default JWT key (and any key shorter than 32 bytes) and default passwords; stop seeding fixed passwords; add `POST /auth/change-password` and enforce `mustChangePassword`.
- Frontend: `/login`, in-memory access token with the refresh cookie, an Axios interceptor with single-flight refresh, route guards (UX only), role-based navigation; remove the fake identity badge.
- *Acceptance:* the role-matrix suite passes; a STUDENT token receives 403 on approve/publish; audit actor equals the token subject.

**FS-2 — Plan domain model and lifecycle** (RS-AUD-002, 007, 034, 041; part of 026)

- Migration: `plans` (run, label, state, plan hash, master version, objective summary, `version`), `plan_id` on `schedule_overrides`, `plan_validations` (plan, hash, result, findings, time). Replace `uq_active_override` with a uniqueness rule scoped to APPROVED/PUBLISHED plans so alternatives can coexist as PROPOSED. Add a trigger that forbids UPDATE or DELETE of overrides belonging to a PUBLISHED plan, and a CHECK that the approver has the HOD role.
- `PlanLifecycleService` implements the §15 table: row lock on the plan, hash and master-version equality at approval and publish, re-validation at both, outbox rows written in the publish transaction, `Idempotency-Key` support.
- Disruption deletion and reset affect only PROPOSED plans for that date, require confirmation, and are audited.
- *Acceptance:* T6–T9 and S2 become rejections; concurrent double-publish yields one set of effects; deleting a disruption after publication changes nothing published.

**FS-3 — Independent validator and computed metrics** (RS-AUD-006, 003)

- A pure-Java `PlanValidator` with no solver imports evaluates master + candidate overrides + disruptions + rules + resources: room/faculty/group clashes with division/batch overlap semantics, disruption windows, temporary-room windows, room type and policy, duration and lab-block alignment, fixed sessions, blast radius against the affected set. It reports new versus baseline clashes using a baseline computed independently of the solver.
- Differential-test it against `effective_conflicts`; persist each report with the plan hash.
- Plan DTO and UI show "Not validated / Valid / Invalid" from the stored report; delete all literal assurances; add a CI grep gate.

**FS-4 — Solver** (RS-AUD-004, 005, 009–014)

- Add OR-Tools (verify native packaging for the deployment OS in CI). Options per affected or ripple session: keep, room change at the same time, same-duration grid-aligned time move within the day, cancel or flag. Hard constraints per the §10 checklist are never weighted. Lexicographic objective (fewest cancel/flag, then fewest changed sessions, then room change over time change, then least displacement) with scaled integer weights chosen so a lower tier can never outweigh a higher one. Faculty and batch composition are never changed automatically.
- Pins and forbid-and-resolve; top-k alternatives by no-good cuts; solver status mapped explicitly (OPTIMAL / FEASIBLE / INFEASIBLE / UNKNOWN) with an infeasibility explanation; timeout returns the best feasible plan marked as such — never unvalidated.
- Structured disruption input replaces free-text parsing; deterministic ordering and a single-worker, fixed-seed mode for tests; runs execute on a bounded executor with a status endpoint, SSE with polling fallback, and cancellation.
- *Acceptance:* the 24 golden scenarios pass; G1–G9 retained as snapshots; fuzz finds zero oracle-invalid plans.

**FS-5 — Import, review and activation** (RS-AUD-021–025, 035)

- Flow: upload → hash → `imports` row → `import_rows` staging with raw cells, parsed candidates and flags → review API (resolve room, faculty, group, time; remember aliases) → build DRAFT version from resolved rows → activation.
- Activation preconditions: zero open flags, baseline report acknowledged, permitted role, identical-hash reuse; executed in its own transaction (archive, flush, activate) under a lock on the versions row.
- Parser: grid-aware extraction (or a required canonical Excel template), no defaults, time validation against periods and lab blocks, duplicate-row detection. Canonical JSON: timestamps set, `scope.division` honoured, unknown ids rejected.
- *Acceptance:* a file with unresolved flags cannot be activated; the seed can be regenerated from shipped inputs.

**FS-6 — Identity, contacts and notifications** (RS-AUD-018, 008, 029, 050)

- Migration: `users.faculty_id` / `users.group_id`, `contacts`, `consents`; ADMIN user API; `/me/timetable` derived from the token; ownership checks.
- Outbox with `dedupe_key = plan | recipient | change hash`; worker claims with `FOR UPDATE SKIP LOCKED`, backoff and rate limiting; WhatsApp Cloud API client behind an interface with a sandbox mode; webhook controller verifying `X-Hub-Signature-256` with a replay window; statuses QUEUED → ACCEPTED → SENT → DELIVERED → READ or FAILED; approved templates only.
- *Acceptance:* no `SENT` without a provider id; duplicate sends zero under concurrent workers.

**FS-7 — Persistence contract, hardening and test infrastructure** (RS-AUD-024, 026, 027, 030, 031, 033)

- Testcontainers PostgreSQL 16 running the real migrations; round-trip tests for arrays, enums and JSON; port T1–T11 and the V/J batteries as integration tests; Spring Security slice tests; golden and property-based tests; a CI pipeline running backend build and tests, `npm ci`, `tsc`, `vite build` and dependency scans.
- Hardening migration: lock trigger checks both `OLD` and `NEW` version ids; `BEFORE TRUNCATE` guards; separate owner and application roles; append-only `audit_log`.
- Do the platform upgrade (RS-AUD-030) before the suite grows, then keep it green.

## 27. Unverified areas and required follow-up checks

| Area | Why unverified | Follow-up |
| --- | --- | --- |
| Backend compile, start-up and the two existing tests | Maven Central unreachable; no Maven | Run `mvn -B verify` in CI or a networked machine |
| Hibernate flush-order effects (RS-AUD-024) and enum binding at runtime (RS-AUD-033) | Needs the real JVM | Testcontainers integration tests |
| Java solver behaviour | Only a Python port was run | Re-run G1–G9 and the sweep against the real service |
| Spring Security runtime behaviour, lockout and refresh rollback (RS-AUD-017) | Not executed | Security slice tests |
| Import against the real master PDF/Excel | Source files not shipped; parser not executed | Obtain `Updated_TT.pdf` and the Excel master; run fixtures |
| AI behaviour with a live key | No key | Test with a sandbox key and injection cases |
| Backend dependency CVEs | No scanner, no Maven Central | OWASP dependency-check / `mvn versions` when networked |
| Frontend at 360 px, keyboard and screen-reader use | No browser | Manual pass and automated axe checks |
| Query counts and latency | Not measured | Hibernate statistics, load test with realistic data |
| Concurrency races | Not executed | Parallel run/approve/publish tests |
| Real WhatsApp provider behaviour | No integration exists | Sandbox account tests |
| OpenAPI-versus-frontend comparison | Spec not generated | Generate and diff once the backend runs |
| Implementation Plan and Prompt Pack | Only the task table and stack row were read | Reconcile acceptance criteria per task before planning sprints |

## 28. Final engineering verdict

| Question | Answer | Evidence and limits |
| --- | --- | --- |
| Does the frontend connect to the correct backend operations? | **Partly.** All 32 adapter calls match real routes and methods, but 10 of 18 pages are unreachable, activation and rejection are not wired in the routed UI, and there is no authentication | §7, §8 |
| Are important features only visual or mocked? | **Yes**: analytics, Plans B/C, safety metrics, WhatsApp dispatch, exports, admin settings, upload wizard, portals, published timetable | RS-AUD-003, 008, 028, 043 |
| Can the project compile and build? | **Frontend: yes** (PASSED). **Backend: not verified** (BLOCKED); shipped `target/` indicates an earlier compile | §19 |
| Can it start with the available configuration? | **Not verified** (NOT RUN). By inspection it would start with default secrets; the `test` profile cannot start | §18 |
| Is the import workflow complete? | **No**: no review, auto-activation, invented defaults, NPE on seeded data | RS-AUD-021–025 |
| Is the solver implemented and operational? | It runs as a **heuristic**; the specified CP-SAT engine does not exist | RS-AUD-004 |
| Does it preserve all mandatory constraints? | **No**: new clashes, absent faculty scheduled, durations changed, fixed sessions and room rules ignored | G3, G9, sweep (simulation) |
| Is the independent validator sufficiently independent? | **There is none in the workflow**; the SQL function is independent but unused and incomplete | RS-AUD-006 |
| Can a new clash be introduced without being detected? | **Yes** | Solver can create them; nothing checks |
| Can an unauthorized or unapproved plan be published? | **Yes** — anonymous callers, the coordinator alone, rejected plans, unvalidated plans | RS-AUD-001, 002; S2 |
| Can a published plan alter the master timetable? | **No code path found** (no master write path; triggers block direct edits), but the triggers have bypasses and published overrides can be deleted | T6–T9, RS-AUD-007, 026 |
| Are overrides limited to their intended dates? | **In SQL, yes**; in the application, Sunday is treated as Monday and reruns delete published overrides; no effective-timetable API exists | R7-1, G4 |
| Are notifications sent only for valid published changes? | **No**: drafts from unapproved plans, simulated sending, dedupe defeated by reruns | RS-AUD-008, 029 |
| Can authentication or authorization be bypassed? | **Yes, by design of the filter** | RS-AUD-001 |
| Are dependencies compatible? | Frontend builds cleanly; backend versions are consistent on paper (Java 21, Boot 3.3.x) but unresolved here, **end-of-life**, and lack a solver dependency | RS-AUD-030 |
| Are migrations and seed data consistent? | **Yes** — V1–V7 apply; `schema.sql` = V1; `seed.sql` = V2+V7; 22/19/0 baseline matches the spec — with dead V3 DDL, the V7 domain change and missing seed inputs | §13 |
| Which features remain incomplete? | Solver, validator, alternatives, blast-radius view, review/activation, effective-timetable API, notifications/WhatsApp/delivery tracking, exports, faculty/student portals, admin, role-based UI | §5 |
| What must be fixed before a reliable demonstration? | P0, plus an interim validator gate on the heuristic (RS-AUD-005/006), fixes for RS-AUD-009 and 012, and honest labelling of simulated delivery — ≈ 3–5 weeks | §25 |
| What must be fixed before real institutional use? | All of P0 and P1, the key P2 items (exports, audit, operations), UAT with the HOD and coordinator, CI/CD, backups and a security review — ≈ 3–4 months | §25 |
| Which issues remain unverified? | See §27 — above all the backend build and runtime, the real-JVM solver behaviour, the real master import, and responsive/keyboard behaviour | §27 |

**Bottom line.** The data layer and the product design are strong and worth building on. The application layer currently simulates the product's most important guarantees. Until authentication is real, the plan lifecycle is enforced, a validator gates approval, and delivery status reflects reality, ReSlot should not be shown as, or relied on as, a safe rescheduler.

*No source code, schema, dependency or configuration was changed during this audit. Implementation should begin only on explicit authorization, starting with P0 (§25).*
