# ReSlot - Agent Guidelines and Domain Rules

## Project Overview
**ReSlot** is the timetable rescheduling and notification platform for the Department of Computer Engineering, JSPM's Rajarshi Shahu College of Engineering (RSCOE), Tathawade, Pune.

## Non-Negotiable Domain Rules
1. **Master Timetable is READ-ONLY once ACTIVE**: No edit may modify an active master version. All changes must go through date-specific schedule overrides (`schedule_overrides`).
2. **Only Sessions Hit by Disruption May Change**: The solver minimizes blast radius. Unaffected sessions remain undisturbed.
3. **Pre-Existing Baseline Clashes are Preserved**: Pre-existing clashes in the master timetable are an accepted baseline and never hidden or treated as solver bugs.
4. **Zero New Clashes Guarantee**: No plan introducing new room, faculty, or group collisions may be approved or published.
5. **Coordinator Full Rights + Validator Guarantee**: The Timetable Coordinator has full autonomous rights to configure disruptions, run the solver, approve, and publish plans without requiring HOD approval. The PlanValidator guarantees zero new clashes before publication.
6. **LLM is Propose-Only**: The AI assistant answers queries and proposes suggestions; it has read-only access and never writes directly to timetable tables.

## System Architecture
- **Backend**: Spring Boot 3.4.x, Java 21, PostgreSQL 16, Spring Security + JWT, Flyway, Apache POI, PDFBox, Micrometer.
- **Frontend**: Vite + React 19, TypeScript, Tailwind CSS v3, Radix UI, TanStack Query, Lucide Icons, Recharts.
- **Color Palette (RSCOE Brand)**:
  - Primary: `#9B1C2E` (Crimson)
  - Primary Hover: `#6F1423`
  - Header Deep: `#3F0B15`
  - Background Canvas: `#F6F4F3`
  - Surface: `#FFFFFF`
  - Ink: `#1B1F24`
  - Muted: `#5B6470`

## Roles
- `COORDINATOR`: Uploads master timetable, configures disruptions, triggers solver runs, verifies and directly publishes date-specific schedule overrides.
- `ADMIN`: Manages users, system settings, security, and integrations.
