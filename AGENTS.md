# AGENTS.md — Family Fund System

Operating manual for AI coding agents working in this repository.
Read this file fully before changing anything. If code and this file disagree, stop and ask the owner; do not guess.

**Work is split between five specialised agents (see §6).** Find out which agent you are, load its skills, and stay inside its area.

Status legend used below:
- **[Decided]** confirmed by the owner. Do not change without asking.
- **[Assumed]** reasonable default taken during planning. Keep, but flag if it blocks you.
- **[Open]** not decided yet. Ask the owner before building it.
- **[Planned]** does not exist yet. Create it as described.

---

## 1. Project overview

A web app for a **mutual family/village support fund**.

- Every registered member owes **Rs. 6,000 per calendar year**. Members may pay in installments or all at once. [Decided]
- When a covered person dies, the fund pays the family **Rs. 70,000** after the Admin verifies the death. [Decided]
- The Admin enters everything. Family members **do not log in**; they open a read-only page protected by one shared **family PIN**. [Decided]
- Core value is **transparency and accountability** for other people's money. Correctness and auditability beat features and polish.

Owner: Muhammad Danish (full-stack developer, Pakistan). Users are non-technical, mostly on phones. UI must work in **English and Urdu (RTL)**.

### Current state
- A fully working **interactive prototype** exists at `prototype/family-fund-prototype.html` (single file, data in localStorage). It is the **behavior reference** for all business rules, screens, wording and Urdu translations. It is **not production code**: its PIN/password checks are fake and its data is browser-only. Never ship it.
- The production app (React + Supabase) is **[Planned]**. Nothing below `frontend/` or `supabase/` is guaranteed to exist yet. Check the file system before assuming.

---

## 2. Technology stack [Decided]

| Area | Choice |
|---|---|
| Frontend | React (functional components + hooks), Vite, JavaScript, React Router, Tailwind CSS |
| Backend | Supabase: PostgreSQL, Supabase Auth, Row Level Security, Edge Functions (Deno) |
| Tests | Vitest (frontend logic), pgTAP via `supabase test db` (database rules), Playwright (optional, end-to-end) |
| State | React state + Context + small custom hooks. **No Redux** unless the owner approves |
| Hosting | **[Open]** (not chosen). Ask before configuring deployment |

Keep dependencies minimal. Before adding any library, check whether the platform or an existing dependency already does the job, and ask the owner.

Environment variables:
- Frontend (`frontend/.env.example`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` only.
- Edge Function secrets (set with `supabase secrets set`, never committed): `FAMILY_TOKEN_SECRET`. The service-role key is injected into Edge Functions by Supabase and must **never** appear in frontend code, `.env` files in `frontend/`, logs, or commits.

---

## 3. Repository structure [Planned]

```text
family-fund/
├── AGENTS.md
├── README.md
├── prototype/
│   └── family-fund-prototype.html     # behavior reference, do not ship
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── .env.example
│   └── src/
│       ├── main.jsx  App.jsx
│       ├── routes/            # route table + guards
│       ├── pages/
│       │   ├── family/        # PIN gate, fund summary, member list
│       │   └── admin/         # login, dashboard, members, payments, death-support, settings
│       ├── components/
│       │   ├── common/        # Button, Dialog, MoneyDisplay, DateDisplay, EmptyState, ...
│       │   ├── members/  payments/  death/  layout/
│       ├── services/          # ALL Supabase calls live here (see §8)
│       ├── lib/               # money.js, dates.js, format.js (pure functions)
│       ├── i18n/              # en.js, ur.js
│       ├── hooks/
│       └── tests/
└── supabase/
    ├── config.toml
    ├── migrations/            # ordered SQL, never edited after applied
    ├── functions/family-view/ # PIN-protected read API (Edge Function)
    ├── seed.sql               # fictional demo data only
    └── tests/                 # pgTAP tests
```

Routes: `/` (start), `/family`, `/admin/login`, `/admin/dashboard`, `/admin/members`, `/admin/payments`, `/admin/death-support`, `/admin/settings`.
Executive routes are **not** in v1 (see §12).

---

## 4. Business rules (the source of truth)

Rule IDs are referenced by tests (`BR-n`). Money is **integer PKR** everywhere. Never use floats for money. Format with `Intl.NumberFormat('en-PK')` and always show as `Rs. 6,000`.

### 4.1 Fund settings
- **BR-1** `annual_contribution = 6000`, `death_support = 70000`. Stored in one `settings` row, read by every calculation. Never hard-code these numbers elsewhere. [Decided]
- **BR-2** The year is **January to December** for everyone. [Decided]

### 4.2 Dues and schedule
- **BR-3** `years_due = current_year − join_year + 1`.
  `total_due = years_due × annual_contribution + opening_balance`.
  A member who joins mid-year owes the **full** yearly amount for that year. [Decided]
- **BR-4** `paid` = sum of all that member's payment rows (reversals are negative rows and are included).
  `remaining = max(0, total_due − paid)`. `advance = max(0, paid − total_due)`.
- **BR-5** Fully paid ⇔ `remaining = 0`. Otherwise Partial. [Decided]
- **BR-6 Behind schedule** [Decided]. Monthly guide:
  - joined in an earlier year: `annual / 12` (Rs. 500) per month.
  - joined in the current year at month `jm`: `annual / (13 − jm)` per month (July joiner → Rs. 1,000).
  `expected_so_far = opening_balance + base`, where
  - earlier-year joiner: `base = (current_year − join_year) × annual + round(annual/12 × current_month)`
  - current-year joiner: `base = min(annual, round(annual/(13 − jm) × (current_month − jm + 1)))`
  `behind_by = max(0, expected_so_far − paid)`. Only **active** members can be behind.

  Worked examples (current date = October):
  | Member | Due | Paid | Remaining | Expected so far | Behind |
  |---|---|---|---|---|---|
  | Joined March last year, paid 4,000 | 12,000 | 4,000 | 8,000 | 6,000 + 5,000 = 11,000 | 7,000 |
  | Joined July this year, paid 4,000 | 6,000 | 4,000 | 2,000 | 4 × 1,000 = 4,000 | 0 |
  | Joined in October, paid 0 | 6,000 | 0 | 6,000 | 1 × 2,000 = 2,000 | 2,000 |

- **BR-7 Year view.** Payments are applied to the **oldest year first**. Leftover is "advance for next year". The opening balance (carried dues) is the oldest bucket.

### 4.3 Payments
- **BR-8** Payments are **immutable**. No update, no delete, not even for the Admin. [Decided]
- **BR-9** A payment amount is a whole number **> 0**. Negative, zero, decimal and empty are rejected in the UI **and** in the database. [Decided]
- **BR-10** Maximum a member can add now: `max(0, total_due + annual − paid)`. In words: the member may be at most **one year ahead**. [Assumed]
- **BR-11** Payment date: not in the future (Asia/Karachi) and **not before the member's join date**. [Assumed]
- **BR-12 Reversal** is the only correction. It inserts a new row with `type='reversal'`, `amount = −original`, `reverses = original id`, a **required reason**, and the same collector. A payment can be reversed **once**. A reversal cannot be reversed. The original row is never modified (the UI derives "Reversed" by looking for a reversal that points to it). [Decided]
- **BR-13** Every payment records who received it: Admin directly or an **executive** (a name in the `executives` table). Executives are names only in v1; they do not log in. An executive's collected total is the net sum (reversals included). [Decided]
- **BR-14** Every saved payment produces a **receipt text** (English or Urdu) with a Copy button and a WhatsApp link: `https://wa.me/<number>?text=<url-encoded>`. Convert `03xx…` to `92 3xx…` (drop the leading 0, prefix 92). [Decided]

### 4.4 Members
- **BR-15** Fields: name, father name, mobile (required); CNIC, address (optional, **Admin-only**, never sent to the family page); join date; status.
- **BR-16 Duplicate mobile is a warning, not a block** [Decided]. Show the existing member and let the Admin continue. Therefore the database must **not** have a UNIQUE constraint on mobile. Use a normal index and a server function that returns matches. The override must be recorded in the audit log. CNIC may become unique later **[Open]**.
- **BR-17** Status: `active`, `inactive` (archived), `deceased`. Only `active` members count in totals, stats, pickers and "behind". Members are never deleted. [Decided]
- **BR-18 Coverage** is optional and informational: counts for sons, daughters, wife, father, mother, brothers, sisters, other dependents. Integers 0–20, default 0. Display only non-zero items ("2 Sons · 1 Daughter · 1 Wife"). Coverage rows are **not** separate members. The registered member is always covered himself. [Decided]
- **BR-19 Continue family.** After a member is `deceased`, the Admin may create a **new member record** linked with `continues_from` / `continued_by`. Unpaid dues of the deceased are either **carried over** (stored as the new member's `opening_balance`) or **waived**; the choice and amount go to the audit log. Only once per deceased member. [Decided]

### 4.5 Death support
- **BR-20** Workflow: `registered → verified → paid`. Only **paid** cases reduce the fund. [Decided]
- **BR-21** The payout is the full `death_support` amount **even if the member has unpaid dues**. The release dialog must show what the member still owes, as information only. [Decided]
- **BR-22** A second case for the same member + relation + deceased name (case-insensitive) is rejected. [Decided]
- **BR-23** If the relation is `self`, releasing the case sets the member to `deceased`. [Assumed]
- **BR-24 Fund formulas** [Decided]:
  `collected = sum(all payment rows)`, `paid_out = sum(paid cases)`, `balance = collected − paid_out`.
  Totals that include payments of archived/deceased members are correct; "still to collect" only counts active members.

### 4.6 Negative balance (Option C) [Decided]
- **BR-25** A release that would leave `balance_after < 0` requires a written **reason**. The reason is stored on the case and in the audit log.
- **BR-26** A release is **blocked** if `balance_after < −max_deficit`. `max_deficit` lives in `settings`, default = `death_support` (Rs. 70,000).
  Example: balance 46,000 → release 70,000 → −24,000 (allowed with reason). Another release → −94,000 (blocked).
- **BR-27** When `balance < 0`, the Admin dashboard **and the family page** show a clear shortfall banner with `ceil(shortfall / active_members)` as "about Rs. X per member".
- **BR-28** When `balance < death_support`, show a low-balance warning (Admin and family).

### 4.7 Family access (no login) [Decided]
- **BR-29** Family page access is by one shared PIN. The Admin can change it any time. Production PIN length: **6–8 digits [Assumed]** (the prototype allows 4–8; 4 digits is too easy to brute-force).
- **BR-30** The family page shows: fund totals, shortfall/low-balance banners, member list (name, father name, mobile, paid, remaining, status, behind), per-member payment history (date, amount, received by, reference), year view, coverage, "Read only" badge.
- **BR-31** The family page **never** shows CNIC, address, audit log, executive totals or admin controls. Whether it should list death cases is **[Open]**; v1 shows totals only.

### 4.8 Admin
- **BR-32** Admin signs in with Supabase Auth (email + password). Admin can change their password: require the current password (re-authenticate), then min 8 characters with a letter and a number, new ≠ current. [Decided]
- **BR-33** Every important action writes an audit entry: payment saved, payment reversed, member added/edited/archived/restored, family continued, coverage changed, case registered/verified/released, PIN changed, password changed, executive added/archived, backup restored. Audit rows are append-only. [Decided]

### 4.9 Formatting
- Money: `Rs. 6,000` (wrap in `dir="ltr"` inside RTL text). Dates: `10 Oct 2026`. Store dates as SQL `date`, timestamps as `timestamptz`. The business timezone is **Asia/Karachi**; compute "today" with `(now() at time zone 'Asia/Karachi')::date` in the database.
- Languages: English and Urdu. All user-visible strings come from `src/i18n/*.js`, never inline. Urdu = `dir="rtl"`, font Noto Naskh Arabic. Reuse the Urdu wording already in the prototype.

---

## 5. Architecture

```text
Admin browser ──(Supabase Auth JWT)──► Postgres tables (RLS: admin read only)
                                       └─ RPC functions (SECURITY DEFINER) = the ONLY way to write money data

Family browser ──(PIN)──► Edge Function `family-view` ──(service role, server-side)──► Postgres
                          returns only the allowed fields + a short-lived signed token
```

### 5.1 Database [Planned]
Tables (names are the contract; columns may be refined in migrations):

| Table | Purpose / key constraints |
|---|---|
| `settings` | single row: `annual_contribution`, `death_support`, `max_deficit`. CHECK > 0 |
| `admins` | `user_id` → `auth.users`. The only source of admin rights |
| `family_access` | single row: `pin_hash` (bcrypt via pgcrypto), `pin_version`. Not readable by anon/authenticated |
| `pin_attempts` | throttling log for the Edge Function |
| `executives` | `name`, `active` |
| `members` | name, father_name, mobile, cnic, address, join_date, status CHECK in (active, inactive, deceased), `opening_balance` ≥ 0, `continues_from`, `continued_by`. Index on mobile (NOT unique), name |
| `member_coverage` | one row per member; each count NOT NULL DEFAULT 0 CHECK between 0 and 20 |
| `payments` | member_id, amount (integer, CHECK ≠ 0), `type` in (payment, reversal), `reverses` (UNIQUE, nullable), payment_date (date), `executive_id` (null = Admin), note, created_by, created_at. Indexes on member_id, payment_date |
| `death_cases` | member_id, ref (unique, `DS-001`), deceased_name, relation, death_date, status, amount, verified_at/by, paid_at/by, deficit_reason, notes. Partial unique index for BR-22 |
| `audit_log` | append-only: actor, action, detail, created_at |

Views/RPCs compute the authoritative numbers (BR-3 to BR-7, BR-24): `member_summary` (due, paid, remaining, advance, expected, behind, status) and `fund_summary` (collected, paid_out, balance, counts, shortfall). **The database is the source of truth for money.**

### 5.2 Write path (RPC functions) [Planned]
All writes to `payments`, `death_cases`, `members` status/opening balance, and `audit_log` go through `SECURITY DEFINER` functions that:
1. start with `set search_path = ''` and fully-qualified names,
2. call `public.is_admin()` first and raise if false,
3. validate every rule in §4 (never trust the client),
4. perform the change **and** write the audit row in the **same transaction**.

Expected functions: `add_member`, `edit_member`, `set_member_status`, `continue_family`, `save_coverage`, `add_payment`, `reverse_payment`, `register_case`, `verify_case`, `release_case`, `add_executive`, `set_executive_active`, `change_family_pin`, `find_duplicate_mobile`.
Revoke `INSERT/UPDATE/DELETE` on money tables from `authenticated` and `anon`. Admin gets `SELECT` through RLS.

### 5.3 RLS [Planned]
- RLS **enabled on every table**. No policy uses `using (true)`.
- `anon` has **no** access to any table or RPC.
- `authenticated` + `is_admin()` may `SELECT`. Nothing else is writable directly.
- Admin identity comes from the `admins` table. **Never** use `user_metadata` for roles (users can edit it).
- Public signups must be **disabled** in Supabase Auth. Admin users are created manually.

### 5.4 Family page API (Edge Function `family-view`) [Planned]
- Actions: `login` (PIN → token + summary), `members` (token, search, page), `member` (token, id).
- Verifies the PIN against `family_access` (bcrypt). Throttle: after 5 wrong tries lock for 30 seconds, growing on repeated failures; track by hashed IP plus a global counter.
- Returns a **signed, short-lived token** (HMAC with `FAMILY_TOKEN_SECRET`, about 8 hours, includes `pin_version`). Changing the PIN invalidates all tokens.
- Uses the service role **inside the function only**, selects an explicit column list (never `select *`), and never returns CNIC/address.
- Server-side search and pagination (about 25 per page). The browser must never download all members and payments.

---

## 6. Agent team

Five specialised agents work on this project. Each one is a **separate session/role**, started with a prompt such as:
`Act as the <Name> Agent defined in AGENTS.md §6. Task: <task>.`

If your tool cannot load the named skill, follow the checklist written under that agent instead. The skills are guidance; the checklists are mandatory.

### 6.1 Overview

| Agent | Builds / checks | Skills to load first | May edit | Must not edit |
|---|---|---|---|---|
| **Frontend Agent** | React UI, routes, services, i18n, `money.js` | `frontend-design` (design quality), `professional-ui-ux-review` (self-check of usability, responsiveness, accessibility) | `frontend/src/**` (except test files), `frontend/package.json`, Tailwind/Vite config | `supabase/**`, any test file, `AGENTS.md` |
| **Supabase Agent** | Schema, constraints, RLS, RPC functions, Edge Function, seed | `supabase-production`, `full-stack-architecture` (when designing or changing the schema) | `supabase/migrations/**`, `supabase/functions/**`, `supabase/seed.sql`, `supabase/config.toml` | `frontend/**`, any test file, already-applied migrations |
| **Test Agent** | Automated tests for every `BR-n` rule | none specific. Follow §10 | `frontend/src/**/*.test.js(x)`, `frontend/src/tests/**`, `supabase/tests/**`, test config, Playwright specs | production code. A failing test is **reported to the owning agent, not fixed here** |
| **Code Review Agent** | Reviews diffs for correctness, rules, maintainability | `security-code-quality-review` (code-quality and maintainability part) | nothing (read-only) | everything |
| **Security Agent** | Audits access control, secrets, PIN, data exposure | `security-code-quality-review` (security part) | nothing (read-only) | everything |

Read-only agents may **run** commands (tests, linters, `supabase test db`) but must not change files. They deliver a written report.

### 6.2 Frontend Agent
**Mission:** build the screens and behavior of the prototype in React, in English and Urdu (RTL).
- Load `frontend-design` for layout, type and visual quality, then **apply it inside this project's look**: calm, plain, high-contrast, no animation, the colors/radius/spacing of the prototype. Do not invent a different visual identity.
- Use `professional-ui-ux-review` as a self-check before handing off: usability, responsiveness, accessibility.
- Follow §4.9 (formatting, i18n) and §8 (conventions). Components never call Supabase directly; use `services/`.
- Never re-implement authoritative money logic. Use `lib/money.js` for previews and validation only; the database is the truth.
- **Done when:** every screen in scope matches the prototype's behavior; loading/empty/error states exist; works at 375 px and desktop; works in Urdu RTL; no console errors; no hard-coded strings; no raw errors shown to users.

### 6.3 Supabase Agent
**Mission:** make the database enforce every business rule so the frontend cannot break them.
- Load `supabase-production` before writing migrations. Use `full-stack-architecture` when the change affects the data model or boundaries.
- Implement §5 exactly: tables, constraints, indexes, RLS, `SECURITY DEFINER` RPCs (with `set search_path = ''`, `is_admin()` check, validation, audit row in the same transaction), the `family-view` Edge Function, and fictional seed data.
- One migration per logical change. Never edit an applied migration.
- Provide the generated or documented RPC signatures to the Frontend Agent (in the hand-off, §6.8).
- **Done when:** `supabase db reset` runs cleanly from scratch; every rule BR-8 to BR-33 that belongs to the database is enforced; no table is readable by `anon`; no direct write path exists to money tables.

### 6.4 Test Agent
**Mission:** prove that each rule works and keeps working.
- Turn every `BR-n` into at least one automated test. Name tests with the rule ID, for example `BR-10 rejects payment above one-year-ahead cap`.
- Layers: Vitest for `lib/money.js` and small UI logic; pgTAP (`supabase/tests/`) for constraints, RPCs and RLS; Playwright (optional) for the core flows: add member, add payment, reverse, register-verify-release a case, family PIN login.
- Use the numeric fixtures in §4.2, §4.6 and the cases listed in §10. Use fictional data only.
- Test behavior, not implementation. Keep tests fast and independent.
- If a test fails because of a production bug, **stop and report it** to the Supabase or Frontend Agent with: rule ID, steps, expected, actual. Do not edit production code to make a test pass.
- **Done when:** all tests pass on a clean checkout, and a short coverage list maps each `BR-n` to its test(s) or marks it "not yet covered".

### 6.5 Code Review Agent
**Mission:** act as a strict senior reviewer. Never review your own work.
- Review the diff against this file, in this order: (1) business rules and money correctness, (2) database integrity and migrations, (3) architecture boundaries (services, RPC-only writes), (4) error handling, loading/empty states, (5) i18n and RTL, (6) accessibility and responsiveness, (7) readability, duplication, over-engineering, unneeded dependencies, (8) tests present for changed rules.
- Check that nothing from "Do not" (§11) was done and that audit entries exist for every important action.
- Report findings as a table: **severity** (Blocker, High, Medium, Low), `file:line`, problem, suggested fix, rule ID if any. Also list what looks good.
- Do not edit files. Do not approve a change with an open Blocker or High finding.

### 6.6 Security Agent
**Mission:** try to break access control and find leaks before real money is handled.
Checklist (run it on every release candidate and after any change to auth, RLS, RPCs or the Edge Function):
1. **RLS:** every table has RLS enabled; no `using (true)`; `anon` cannot `SELECT` or call any RPC; a normal authenticated non-admin cannot read or write anything.
2. **RPCs:** each starts with `is_admin()`, uses `set search_path = ''`, uses parameters (no string-built SQL), and validates all inputs. No money table can be written directly.
3. **Family API:** PIN is hashed; wrong-PIN throttling works; token is signed, expires and dies when the PIN changes; the response never contains CNIC, address, audit data or executive totals; no `select *`.
4. **Secrets:** service-role key and token secret are absent from `frontend/`, git history, logs and error messages. Only `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are exposed.
5. **Auth:** public signups are disabled; roles come from `admins`, never from `user_metadata`; password-change flow re-authenticates.
6. **Frontend:** no `dangerouslySetInnerHTML`; user text is escaped; CSV export neutralizes `= + - @`; no sensitive data in URLs, local storage (other than the short-lived family token in session storage) or console logs.
7. **Data:** audit log is append-only; payments and cases cannot be updated or deleted.
8. **Dependencies:** run `npm audit` and flag high/critical issues.
- Report each finding with severity, how to reproduce, impact and fix. Do not edit files. Do not sign off while any Blocker or High finding is open.

### 6.7 Working order for every feature

1. **Supabase Agent**: migration, RPC, RLS, seed.
2. **Test Agent**: database and logic tests from the `BR-n` rules (write them first when possible).
3. **Frontend Agent**: UI that calls the services/RPCs.
4. **Test Agent**: UI and end-to-end tests for the feature.
5. **Code Review Agent**: review report. Owning agents fix Blocker/High findings.
6. **Security Agent**: audit report. Owning agents fix Blocker/High findings.
7. **Owner sign-off.**

Gate: a feature is not "done" until steps 5 and 6 report **no open Blocker or High** findings and step 4 is green.
Small pure-UI changes may skip step 1, but any change that touches money, access or the schema must go through all steps.

### 6.8 Rules for all agents

- Stay inside your area (§6.1). If you need a change elsewhere, **ask for it in your hand-off**; do not do it yourself.
- No agent approves its own work.
- Do not make major architecture or business decisions silently (§13 lists open ones). Ask the owner.
- End every task with this hand-off:
  1. **Summary** of what was done (2 to 5 lines)
  2. **Files changed**
  3. **Rules touched** (`BR-n`)
  4. **Checks run and results** (exact commands, pass/fail)
  5. **Open issues, assumptions, and what the next agent must do**
- Never put real names, phone numbers, CNICs or secrets in code, tests, seeds, reports or commit messages.

---

## 7. Development workflow

0. **Know your agent role** (§6) and stay inside it.
1. **Understand.** Read the relevant rule IDs in §4 and the matching behavior in the prototype.
2. **Plan small.** One logical feature per change. State the plan before large changes.
3. **Database first** for anything involving money: migration → RPC/view → pgTAP test → then UI.
4. **Implement** using existing patterns. Reuse components and services.
5. **Verify** (§10). Report what you ran and the result.
6. **Review the diff** for secrets, unrelated edits, missing audit entries and missing translations, then hand off to the next agent (§6.7).

Recommended build order:
1. Scaffold (`frontend/`, `supabase/`), CI-free local setup, `README.md`.
2. Schema, constraints, indexes, RLS, `settings`, seed data.
3. Calculation views + `frontend/src/lib/money.js` with tests against the fixtures in §4.2.
4. Admin auth + protected routes + admin dashboard.
5. Members (add, edit, search, archive, coverage).
6. Payments (RPC, validation, reversal, executives, receipt).
7. Death support (workflow, deficit rule, continue family).
8. Family page (Edge Function, PIN, token, read-only UI).
9. Settings (PIN, password), export (CSV/JSON), restore **[Open: confirm restore is wanted in production]**.
10. Urdu/RTL pass, mobile pass, accessibility pass, security review.

### Commands
Commands become valid only after the scaffold exists. **Define these scripts in `frontend/package.json` when scaffolding and keep this table in sync.**

| Purpose | Command | Status |
|---|---|---|
| Install frontend deps | `cd frontend && npm install` | after scaffold |
| Dev server | `npm run dev` | planned script |
| Production build | `npm run build` | planned script |
| Unit tests | `npm test` (Vitest) | planned script |
| Lint | `npm run lint` | planned script |
| Start local Supabase | `supabase start` | Supabase CLI |
| New migration | `supabase migration new <name>` | Supabase CLI |
| Reset local DB (migrations + seed) | `supabase db reset` | Supabase CLI |
| Database tests | `supabase test db` | Supabase CLI |
| Serve Edge Functions locally | `supabase functions serve` | Supabase CLI |

Anything not listed here (CI, deployment commands, hosting) is **unknown**. Do not invent it.

---

## 8. Coding conventions

- Functional React components and hooks. One component per file, `PascalCase.jsx`. Hooks `useThing.js`. Services `thingService.js`.
- **Components never call Supabase directly.** They call `src/services/*` or hooks. Services map errors to friendly, translated messages.
- **Financial formulas live only in** `src/lib/money.js` (for previews/validation) and the database (authoritative). Never re-implement a formula inside a component. Functions to provide: `calculateDue`, `calculatePaid`, `calculateRemaining`, `calculateExpectedSoFar`, `calculateBehind`, `calculateYearBreakdown`, `calculateMaxPayment`, `calculateFundBalance`, `calculateShortfallPerMember`.
- Validate on the client **and** in the database. Client validation is for UX only.
- Loading, empty and error states for every async view. Disable submit buttons while saving. Confirm dialogs before: saving a payment, reversing, verifying, releasing, archiving, restoring a backup.
- Never show raw technical errors to users. Log details to the console in development only.
- Search inputs: debounce, server-side filtering, pagination. Pickers show name + father name + mobile + paid/remaining. Never render a 100+ item dropdown.
- Accessibility: labels on all inputs, keyboard-reachable controls, visible focus, status shown with **text as well as color**, accessible dialogs (focus handling, Esc closes).
- Responsive: tables scroll inside their own container; no sideways page scroll at 375 px.
- Tailwind utility classes; keep tokens (colors, radius) consistent. Keep the calm, plain look of the prototype. Avoid animations.
- Fictional data only in seeds and tests. Never commit real names, phone numbers or CNICs.

---

## 9. Security constraints

- Never put the service-role key, JWT secrets or PIN hashes in frontend code, logs, error messages or git. Frontend env contains only the public URL and anon key.
- Never rely on frontend checks for authorization or financial rules.
- Never log CNIC, address, PINs or passwords.
- Never build SQL by string concatenation in functions; use parameters.
- Sanitize and escape all user-entered text when rendering (React escaping is the default; do not use `dangerouslySetInnerHTML`). CSV export must neutralize cells starting with `= + - @` (the prototype does this).
- The family page is only as private as the PIN. Treat the PIN as a convenience lock, keep throttling on, and make PIN change easy.

---

## 10. Testing and verification

A task is **done** only when all of these hold:

1. Unit tests pass for `money.js`, including the fixtures in §4.2 and these cases:
   amount 6000 ok · 0, −1, 1.5 rejected · 14,000 paid on 12,000 due → max additional 4,000 · reversal nets to zero · July joiner guide = 1,000 · carried-over dues counted as behind immediately.
2. pgTAP tests pass for: negative/zero amounts rejected · over-max rejected · payment before join date rejected · second reversal rejected · payment update/delete denied · duplicate death case rejected · release without reason when balance < 0 rejected · release below `−max_deficit` rejected · `anon` cannot read any table or call any RPC · non-admin authenticated user cannot call write RPCs.
3. The Edge Function: wrong PIN rejected, throttling works, response never contains `cnic` or `address`, token stops working after PIN change.
4. Manual/UI check on desktop and a 375 px viewport, in English and Urdu (RTL): no console errors, no sideways page scroll, loading/empty/error states present.
5. The behavior matches the prototype for the same scenario (compare numbers, not styling).
6. No secrets in the diff. `git diff` contains only intended files.
7. The Code Review Agent and the Security Agent have each reported **no open Blocker or High** findings (§6.5, §6.6).

Report in your final message: what changed, which checks you ran, results, and anything you could not verify.

---

## 11. Do not

- Do not edit or delete an applied migration. Add a new one.
- Do not add UPDATE/DELETE paths for payments, death cases or audit logs.
- Do not store a paid/remaining total in a column; always derive from payment rows.
- Do not add a UNIQUE constraint on mobile (BR-16).
- Do not send CNIC or address to the family page.
- Do not hard-code 6000, 70000 or 70000 for the deficit limit outside `settings`.
- Do not trust a role or ID sent by the client.
- Do not use `user_metadata` for authorization.
- Do not use `using (true)` policies or disable RLS to "make it work".
- Do not use floats for money.
- Do not ship or import code from `prototype/`.
- Do not add executives' login, SMS/WhatsApp automation, online payments or multi-fund support without an explicit owner request.
- Do not edit files outside your agent's area (§6.1), and do not let an agent review or approve its own work.
- Do not make major architecture or business decisions silently. Explain and ask first.

---

## 12. Out of scope for v1 / future

- **Executive portal**: separate page per executive with their own link and PIN to add members. Deferred by the owner. Keep `payments.executive_id` and `executives` so it can be added later.
- Family-umbrella eligibility logic (married earning son, dependent parents, etc.): not in v1; coverage is informational only.
- Notifications (WhatsApp/SMS reminders), online payment gateways, multi-year configurable fees per member, multi-fund / multi-village support.

---

## 13. Open decisions (ask the owner before building)

1. **Hosting/deployment target** and domain.
2. **Production PIN length** (recommended 6–8 digits).
3. Should the family page also list **death cases** (names and amounts), or only totals?
4. Is **backup restore** wanted in production, or export only?
5. Should CNIC become **unique** later (mobile stays non-unique)?
6. Should reference notes on payments be visible to the family, or Admin-only?
7. Exact **max deficit** (default Rs. 70,000, one death) and whether the Admin may raise it.

---

## 14. Working agreement with the owner

- Communicate in simple English (Roman Urdu is fine in chat). Give direct recommendations and short step-by-step instructions.
- Build the simplest correct MVP first. Add complexity only with a clear reason.
- When several options exist, explain the important differences and recommend one.
- A feature is not complete until it is implemented, tested, reviewed, checked for security and responsive behavior, and confirmed to work with the rest of the project.