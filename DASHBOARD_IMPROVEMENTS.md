# Dashboard Improvement Briefing

Relevant files: `components/Dashboard.jsx`, `components/Dashboard.module.css`  
Database: Supabase — existing tables: `events`, `event_participants`, `wellness_responses`, `session_rpe`, `announcement_reads`, `tasks`, `profiles`

---

## #1 — "Next Up" Event Highlight

**Problem:** `events` are loaded for 7 days but only `todayEvents` (filtered to midnight) are rendered. The next upcoming event is not highlighted anywhere.

**What to build:** At the top of the Schedule card, add a prominent "Next Up" block showing the single next event that hasn't started yet (closest `start_time > now`). Show title, start time as a countdown ("in 2h 30m") and a color dot for the category. Below it, list the remaining today events as before.

**Scope:** `Dashboard.jsx` (derive `nextEvent` from existing `events` state), `Dashboard.module.css` (new `.nextUpBlock` style).

---

## #2 — Wellness Submission Progress Bar (Staff only)

**Problem:** The Health & Performance card only shows players with low scores (alerts). Coaching staff has no visibility into how many players have submitted wellness today vs. total.

**What to build:** Above the alert list in the Wellness card, add a small progress row: `8 / 12 submitted today` with a thin progress bar. Pull the count from `wellness_responses` where `response_date = today` (distinct `user_id`), compare against total player count from `profiles` where `role = 'Player'`. Only show for roles in `WELLNESS_ALERT_ROLES`.

**Scope:** `Dashboard.jsx` — add a `wellnessSubmittedCount` value to the existing `load()` Promise.all block. `Dashboard.module.css` — new `.wellnessProgress` style.

---

## #3 — Player Dashboard Mini-Summary Card

**Problem:** For the `Player` role, the dashboard shows only a wellness reminder banner. There is no personal data visible — the player has no reason to open the dashboard.

**What to build:** When `profile.role === 'Player'`, render an additional summary card with:
- Last RPE score + session name (from `session_rpe`, latest row for `user_id`)
- Wellness trend: average score of last 7 days across fatigue/sleep/appetite (from `wellness_responses`)
- Next personal event: first upcoming event from the existing `events` state

**Scope:** `Dashboard.jsx` — add two small queries inside `load()` for player role only. New `PlayerSummaryCard` sub-component at the top of the file.

---

## #4 — Announcement Dismissal via DB instead of localStorage

**Problem:** `dismissAnnouncement()` writes to `localStorage`. If the user switches device or browser, dismissed announcements reappear. The table `announcement_reads` already exists in the DB.

**What to build:** Replace the localStorage dismiss logic with an upsert to `announcement_reads (user_id, announcement_id)`. On load, fetch already-read IDs for `currentUserId` from `announcement_reads` and filter `visibleAnnouncements` against them — same result, but synced across devices.

**Note:** The existing `announcement_reads` table is already used by the `AppStats` component in `RoleManager.jsx` for read-tracking, so the schema is confirmed.

**Scope:** `Dashboard.jsx` only — replace `dismissedAnns` localStorage reads/writes with Supabase queries.

---

## #5 — Inline RSVP Buttons on Schedule Card

**Problem:** The Schedule card shows the current RSVP status badge but no way to change it. Users must navigate to the Calendar to RSVP.

**What to build:** For each event in the today list that has `_myStatus !== null` (i.e. user is a participant), replace the static RSVP badge with three small inline buttons: `In`, `Maybe`, `Out`. On click, upsert to `event_participants (profile_id, event_id, status)`. Optimistically update local state. Active status is highlighted.

**Scope:** `Dashboard.jsx` — add `handleRsvp(eventId, status)` function using `supabase.from('event_participants').upsert(...)`. `Dashboard.module.css` — new `.rsvpBtnGroup` / `.rsvpBtnInline` styles.

---

## #6 — Fix Task Matching: Initials → user_id

**Problem:** Tasks are currently queried with `.eq('assignee', currentUserInitials)`. This is fragile — duplicate initials or display name changes cause incorrect results.

**What to build:** Change the tasks query to match on `assigned_to` (UUID) if that column exists, or add it. Check the current `tasks` table schema first. If `assigned_to uuid` column already exists, switch the query to `.eq('assigned_to', currentUserId)`. If not, a migration is needed to add it.

**Scope:** `Dashboard.jsx` (query change), possibly a Supabase migration if the column doesn't exist yet.

---

## #7 — "This Week" Events Section

**Problem:** Events for the next 7 days are loaded into state but never rendered. Users must open the Calendar to see what's coming.

**What to build:** Below the today schedule list, add a collapsible "This week" section showing events from tomorrow through day+7, grouped by date. Each row: weekday label, event title, time, category dot. Collapsed by default on mobile, expanded on desktop.

**Scope:** `Dashboard.jsx` — derive `upcomingEvents` from existing `events` state (filter `start_time > todayEnd`). `Dashboard.module.css` — new `.weekSection` style.

---

## Implementation order (suggested)

1. **#6** — Fix task matching first (correctness bug, low effort)
2. **#4** — Announcement dismissal via DB (correctness bug, self-contained)
3. **#2** — Wellness progress bar (small addition, high value for coaching staff)
4. **#1** — Next Up highlight (medium effort, high visibility)
5. **#5** — Inline RSVP (medium effort, good UX win)
6. **#7** — This week section (medium effort, depends on #1 being done first)
7. **#3** — Player summary card (most effort, requires new queries)
