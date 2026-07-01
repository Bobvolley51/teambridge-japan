# Name Structure Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One consistent name model across TeamBridge Japan — `display_name` (nickname) as the primary label everywhere, `first_name`/`last_name` as a mandatory, correctly-cased legal name, jersey numbers only where already agreed (RoleManager, Dashboard player-availability card), and no more duplicate player cards caused by grouping on raw name text instead of `id`.

**Architecture:** No schema changes. All fixes are (a) one-time data corrections in Supabase via SQL, (b) small priority-order / grouping-key fixes in existing React components, reusing the existing `playerLabel` helper (`lib/usePlayerProfiles.js`) and the existing `id`/`user_id`/`player_id` columns that are already present and fully populated.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (Postgres + supabase-js v2). No test framework — verification is `npm run lint`, `npm run build`, and manual diff review per task.

## Global Constraints

- `display_name` is the primary display label everywhere in the UI. `first_name`/`last_name` are the legal name, mandatory per account, used only as a fallback and in the Medical "legal name" lookup.
- Jersey number suffix (`#N Name`) is shown ONLY in: `RoleManager.jsx` (already implemented, do not touch), the Dashboard player-availability card, and the 5 dashboards already fixed in a prior pass (`PerformanceDashboard.jsx`, `WellnessDashboard.jsx`, `MedicalDashboard.jsx`, `NutritionDashboard.jsx`, `VertDashboard.jsx`). Do not add it anywhere else.
- No test suite exists. Every task's verification step is `npm run lint` (must exit 0) and, where noted, `npm run build` — run from `c:\Users\Bob\Dropbox\Bob\Privat\Claude\Teambridge Japan\teambridge-japan`.
- Supabase project id for all SQL: `vlzxpbndvvzktuccavfg`.

---

### Task 1: One-time data cleanup in `profiles`

**Files:**
- Create: `schema_name_cleanup.sql` (repo root, follows the existing `schema_*.sql` migration-history convention)
- No app code changes in this task.

**Interfaces:**
- Produces: corrected `display_name` casing (done in a prior session already — not part of this task), corrected `first_name`/`last_name` casing and order for existing rows.

- [ ] **Step 1: Write the migration SQL**

```sql
-- schema_name_cleanup.sql
-- One-time cleanup of first_name/last_name data quality issues found during the
-- name-structure-design review (2026-07-01). Casing fixes + two swapped-column
-- corrections + one non-Latin entry. Excludes the Grotte/Mascot test account.

-- Casing fixes (initcap = capitalize first letter of each word, lowercase rest)
update profiles
set first_name = initcap(first_name),
    last_name  = initcap(last_name)
where first_name <> initcap(first_name)
   or last_name  <> initcap(last_name)
and display_name not in ('Grotte'); -- exclude mascot account

-- Swapped first/last name (confirmed against the app's given-name-first
-- convention, matching display_name)
update profiles set first_name = 'Koji', last_name = 'Nanba'
where display_name = 'Koji' and first_name = 'Nanba' and last_name = 'Koji';

update profiles set first_name = 'Satoshi', last_name = 'Arai'
where display_name = 'Satoshi Arai' and first_name = 'Arai' and last_name = 'Satoshi';

-- Non-Latin entry, Latin spelling supplied by the team
update profiles set first_name = 'Junpei', last_name = 'Fujimori'
where display_name = 'Fujimori' and first_name = '藤森' and last_name = '淳平';
```

- [ ] **Step 2: Preview affected rows before running the update**

Run via the Supabase `execute_sql` tool against project `vlzxpbndvvzktuccavfg`:

```sql
select display_name, first_name, last_name from profiles
where (first_name <> initcap(first_name) or last_name <> initcap(last_name))
  and display_name <> 'Grotte';
```

Expected: the same 9 casing-garbled rows found during design (Hazuki, Hiroki,
Hiroyuki Furuta, Dai Yasuhara, Kanze Chiba, Shinjo, Shodai Abe, Shusuke Sakai,
Takashi Ogawa, Yusuke) plus no unexpected rows.

- [ ] **Step 3: Run the migration**

Execute the full contents of `schema_name_cleanup.sql` via the Supabase `execute_sql`
tool against project `vlzxpbndvvzktuccavfg`.

- [ ] **Step 4: Verify**

```sql
select display_name, first_name, last_name from profiles
where first_name is not null order by display_name;
```

Expected: no more all-caps/all-lowercase first_name or last_name values (except
proper nouns that are naturally short, e.g. "Bob"), Koji shows
`first_name=Koji, last_name=Nanba`, Satoshi Arai shows `first_name=Satoshi,
last_name=Arai`, Fujimori shows `first_name=Junpei, last_name=Fujimori`,
Grotte/Mascot unchanged.

- [ ] **Step 5: Commit the migration file**

```bash
git add schema_name_cleanup.sql
git commit -m "chore: fix casing and swapped first/last name data in profiles"
```

---

### Task 2: Normalize name casing on save in `ProfileSetup.jsx`

**Files:**
- Modify: `components/ProfileSetup.jsx:1-52`

**Interfaces:**
- Produces: `titleCase(str)` — local helper, `(string) => string`, capitalizes the
  first letter of each whitespace-separated word and lowercases the rest.

- [ ] **Step 1: Add the `titleCase` helper and apply it in `handleSave`**

Current code (`components/ProfileSetup.jsx:1-52`):

```jsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './ProfileSetup.module.css';

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Libero'];

export default function ProfileSetup({ userId, currentRole, lang, onComplete }) {
  const isJa     = lang === 'ja';
  const isPlayer = currentRole === 'Player';

  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [nickname,   setNickname]   = useState('');
  const [dob,        setDob]        = useState('');
  const [position,   setPosition]   = useState('');
  const [jersey,     setJersey]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const handleFirstNameChange = (val) => {
    setFirstName(val);
    // Auto-fill nickname from first name if user hasn't touched it yet
    if (!nickname || nickname === firstName) setNickname(val);
  };

  const canSubmit = firstName.trim() && lastName.trim() && dob && nickname.trim();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');

    const updates = {
      first_name:    firstName.trim(),
      last_name:     lastName.trim(),
      display_name:  nickname.trim() || firstName.trim(),
      date_of_birth: dob,
      ...(isPlayer && position  ? { position }                                 : {}),
      ...(isPlayer && jersey !== '' ? { jersey_number: Number(jersey) || null } : {}),
    };
```

New code:

```jsx
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './ProfileSetup.module.css';

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Libero'];

// Capitalizes the first letter of each word, lowercases the rest — keeps
// first_name/last_name/display_name consistently cased regardless of how
// the user typed them.
function titleCase(str) {
  return str.trim().replace(/\S+/g, word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

export default function ProfileSetup({ userId, currentRole, lang, onComplete }) {
  const isJa     = lang === 'ja';
  const isPlayer = currentRole === 'Player';

  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [nickname,   setNickname]   = useState('');
  const [dob,        setDob]        = useState('');
  const [position,   setPosition]   = useState('');
  const [jersey,     setJersey]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const handleFirstNameChange = (val) => {
    setFirstName(val);
    // Auto-fill nickname from first name if user hasn't touched it yet
    if (!nickname || nickname === firstName) setNickname(val);
  };

  const canSubmit = firstName.trim() && lastName.trim() && dob && nickname.trim();

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');

    const updates = {
      first_name:    titleCase(firstName),
      last_name:     titleCase(lastName),
      display_name:  titleCase(nickname || firstName),
      date_of_birth: dob,
      ...(isPlayer && position  ? { position }                                 : {}),
      ...(isPlayer && jersey !== '' ? { jersey_number: Number(jersey) || null } : {}),
    };
```

- [ ] **Step 2: Verify with lint**

Run: `npm run lint`
Expected: exit code 0, no new warnings for `ProfileSetup.jsx`.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, log in as a test account missing `first_name`/`last_name`
(or temporarily null them out for a throwaway profile via SQL), fill the form
with lowercase/uppercase input (e.g. "yamada", "TARO"), submit, then query
`select first_name, last_name, display_name from profiles where id = '<id>'`
— expect `Yamada`, `Taro`.

- [ ] **Step 4: Commit**

```bash
git add components/ProfileSetup.jsx
git commit -m "fix: normalize name casing on profile setup save"
```

---

### Task 3: Fix name-priority bug in `Chat.jsx` and birthday-check API

**Files:**
- Modify: `components/Chat.jsx:13-17`
- Modify: `app/api/birthday-check/route.js:16-19`

**Interfaces:**
- No new exports; both are local, single-file helper functions.

- [ ] **Step 1: Fix `profileFullName` in `Chat.jsx`**

Current code (`components/Chat.jsx:13-17`):

```jsx
function profileFullName(p) {
  if (!p) return '';
  if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
  return p.display_name || p.email || '';
}
```

New code:

```jsx
function profileFullName(p) {
  if (!p) return '';
  return p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || '';
}
```

This function only feeds avatar initials (`profileInitials`) and the member
search matcher (`[profileFullName(p), p.display_name, p.email].some(...)`) —
it never renders as a visible name label directly, so this change only fixes
initials (e.g. "Bob Ranner" no longer shows "BR" instead of "Bo") and keeps
legal name searchable as a bonus match term.

- [ ] **Step 2: Fix `fullName` in `birthday-check/route.js`**

Current code (`app/api/birthday-check/route.js:16-19`):

```js
function fullName(p) {
  if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
  return p.display_name || p.email || 'Someone';
}
```

New code:

```js
function fullName(p) {
  return p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone';
}
```

This changes birthday calendar event titles and announcement text from
"🎂 Thomas Ranner" to "🎂 Bob" — consistent with the nickname being the
team-facing name everywhere else.

- [ ] **Step 3: Verify with lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open Chat, confirm member list / mention list still show
the same names as before (display_name-first was already used for the visible
label; this task only changes the internal helper). Confirm search for a
player's legal last name (e.g. "Ranner") still finds "Bob" in the member list.

- [ ] **Step 5: Commit**

```bash
git add components/Chat.jsx app/api/birthday-check/route.js
git commit -m "fix: prioritize display_name over legal name in Chat search and birthday events"
```

---

### Task 4: Add jersey number + id-based deep link to the Dashboard player-availability card

**Files:**
- Modify: `components/Dashboard.jsx:494` (query), `components/Dashboard.jsx:645-647` (merge), `components/Dashboard.jsx:1131-1134` (render + navigate)
- Modify: `app/page.jsx:105-108` (navigate handler)

**Interfaces:**
- Consumes: `playerLabel(profile, fallbackName)` from `lib/usePlayerProfiles.js` — `(profile: {display_name, first_name, last_name, jersey_number} | null, fallbackName?: string) => string`.
- Produces: `mergedAv` items now carry `jersey_number`; `onNavigate('medical', { playerId })` replaces `{ playerName }`.

- [ ] **Step 1: Select `jersey_number` in the player-profiles query**

Current code (`components/Dashboard.jsx:494`):

```jsx
        ? supabase.from('profiles').select('id, display_name').eq('role', 'Player').order('display_name')
```

New code:

```jsx
        ? supabase.from('profiles').select('id, display_name, jersey_number').eq('role', 'Player').order('display_name')
```

- [ ] **Step 2: Carry `jersey_number` into the merged availability list**

Current code (`components/Dashboard.jsx:644-648`):

```jsx
    const avMap = Object.fromEntries((avData ?? []).map(a => [a.player_id, a]));
    const mergedAv = (playerProfiles ?? []).map(p => avMap[p.id] ?? {
      player_id: p.id, player_name: p.display_name, status: 'full', reason: null, updated_at: null,
    });
    setAvailability(mergedAv);
```

New code:

```jsx
    const avMap = Object.fromEntries((avData ?? []).map(a => [a.player_id, a]));
    const mergedAv = (playerProfiles ?? []).map(p => ({
      ...(avMap[p.id] ?? { player_id: p.id, player_name: p.display_name, status: 'full', reason: null, updated_at: null }),
      jersey_number: p.jersey_number ?? null,
    }));
    setAvailability(mergedAv);
```

- [ ] **Step 3: Import `playerLabel` and use it in the alert row, passing `playerId` instead of `playerName`**

Add to the top of `components/Dashboard.jsx` (with the other imports):

```jsx
import { playerLabel } from '@/lib/usePlayerProfiles';
```

Current code (`components/Dashboard.jsx:1131-1134`):

```jsx
                          <div key={p.player_id} className={styles.alertItem} onClick={() => onNavigate('medical', { playerName: p.player_name })} style={{ cursor: 'pointer' }}>
                            <span className={styles.alertDot} style={{ background: color }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className={styles.alertText}>{p.player_name}</div>
```

New code:

```jsx
                          <div key={p.player_id} className={styles.alertItem} onClick={() => onNavigate('medical', { playerId: p.player_id })} style={{ cursor: 'pointer' }}>
                            <span className={styles.alertDot} style={{ background: color }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className={styles.alertText}>{playerLabel({ display_name: p.player_name, jersey_number: p.jersey_number })}</div>
```

- [ ] **Step 4: Update the navigate handler to thread `playerId` instead of `playerName`**

Current code (`app/page.jsx:104-108`):

```jsx
  const [medicalDeepLinkPlayer, setMedicalDeepLinkPlayer] = useState(null);
  const navigate = (id, payload) => {
    setNav(id); navRef.current = id; localStorage.setItem('tb_nav', id);
    setMedicalDeepLinkPlayer(id === 'medical' && payload?.playerName ? payload.playerName : null);
  };
```

New code:

```jsx
  const [medicalDeepLinkPlayer, setMedicalDeepLinkPlayer] = useState(null);
  const navigate = (id, payload) => {
    setNav(id); navRef.current = id; localStorage.setItem('tb_nav', id);
    setMedicalDeepLinkPlayer(id === 'medical' && payload?.playerId ? payload.playerId : null);
  };
```

The `deepLinkPlayer` prop passed to `MedicalDashboard` (`app/page.jsx:743`) is
unchanged — it now carries a player `id` instead of a name string, which
lines up with Task 5's id-keyed `PlayerPainCard` map.

- [ ] **Step 5: Verify with lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 6: Manual check (do this together with Task 5 — the deep link only works end to end once both are done)**

Run: `npm run dev`, open Dashboard as a staff role that can see Player
Availability, confirm players with Limited/Out status show `#N Name`. Clicking
one navigates to Medical → Pain & Medical tab with that player's card open
(verify after Task 5 is also done).

- [ ] **Step 7: Commit**

```bash
git add components/Dashboard.jsx app/page.jsx
git commit -m "feat: show jersey number and use player id for deep link in Dashboard availability card"
```

---

### Task 5: Regroup MedicalDashboard's Pain & Medical tab by player id

**Files:**
- Modify: `components/MedicalDashboard.jsx:940-1032`

**Interfaces:**
- Consumes: `playerLabel(profile, fallbackName)` from `lib/usePlayerProfiles.js` (already imported in this file per Task done in a prior pass).
- Consumes: `players` state (array of profile rows, each `{id, first_name, last_name, display_name, jersey_number, position, ...}`, loaded at `MedicalDashboard.jsx:714-723`).
- Produces: exactly one `PlayerPainCard` per player `id`, regardless of historical `player_name`/`user_name` text spelling. `deepLinkPlayer` prop (now an id, per Task 4) matches the `key`/`cardId` used here.

- [ ] **Step 1: Replace the name-keyed grouping with id-keyed grouping**

Current code (`components/MedicalDashboard.jsx:940-1032`):

```jsx
          ) : tab === 'pain' ? (() => {
            // Build per-player data
            const avMap = Object.fromEntries(availability.map(a => [a.player_name, a]));

            const normName = (raw) => infoByDisplayName[raw]?.latin ?? raw;
            const infoByDisplay = infoByDisplayName;

            const painByPlayer = {};
            for (const r of painData) {
              const key = normName(r.user_name);
              if (!painByPlayer[key]) painByPlayer[key] = [];
              painByPlayer[key].push(r);
            }
            const recsByPlayer = {};
            for (const r of records) {
              const key = normName(r.player_name);
              if (!recsByPlayer[key]) recsByPlayer[key] = [];
              recsByPlayer[key].push(r);
            }

            // All unique player names across availability, pain data, records
            const allNames = [...new Set([
              ...availability.map(a => a.player_name),
              ...Object.keys(painByPlayer),
              ...Object.keys(recsByPlayer),
            ])].sort();

            const AV_RANK = { out: 0, limited: 1, full: 2 };
            // Sort: Out first, then Limited, then Full; within each: active records > monitoring > pain > alphabetical
            const sorted = allNames.sort((a, b) => {
              const aAv = AV_RANK[avMap[a]?.status ?? 'full'] ?? 2;
              const bAv = AV_RANK[avMap[b]?.status ?? 'full'] ?? 2;
              if (aAv !== bAv) return aAv - bAv;
              const aActive = (recsByPlayer[a] ?? []).some(r => r.status === 'active');
              const bActive = (recsByPlayer[b] ?? []).some(r => r.status === 'active');
              if (aActive !== bActive) return aActive ? -1 : 1;
              const aMon = (recsByPlayer[a] ?? []).some(r => r.status === 'monitoring');
              const bMon = (recsByPlayer[b] ?? []).some(r => r.status === 'monitoring');
              if (aMon !== bMon) return aMon ? -1 : 1;
              const aPain = (painByPlayer[a] ?? []).length;
              const bPain = (painByPlayer[b] ?? []).length;
              return bPain - aPain || (a ?? '').localeCompare(b ?? '');
            });

            const concerned = sorted.filter(name =>
              (recsByPlayer[name] ?? []).some(r => r.status === 'active' || r.status === 'monitoring') ||
              (painByPlayer[name] ?? []).length > 0
            );

            return (
              <div>
                <AlertPanel
                  records={records}
                  painData={painData}
                  availability={availability}
                  players={players}
                  noticedIds={noticedIds}
                  onNotice={markNoticed}
                  lang={lang}
                />
                {isTherapist && (
                  <div className={styles.addBar}>
                    <button className={styles.btnAdd} onClick={() => setRecForm('new')}>
                      + {lang === 'ja' ? '新規記録' : 'New record'}
                    </button>
                  </div>
                )}
                {concerned.length === 0 ? (
                  <div className={styles.empty}>
                    {lang === 'ja' ? '現在、痛みや医療記録はありません。' : 'No pain reports or medical records currently.'}
                  </div>
                ) : (
                  <div className={styles.painList}>
                    {concerned.map(name => {
                      const jersey = avMap[name]?.jersey_number ?? infoByDisplay[name]?.jersey;
                      const label  = jersey != null ? `#${jersey} ${name}` : name;
                      return (
                        <PlayerPainCard
                          key={name}
                          player={{ player_name: label, jersey_number: jersey }}
                          painRows={painByPlayer[name] ?? []}
                          medRecords={recsByPlayer[name] ?? []}
                          availability={avMap[name]}
                          lang={lang}
                          isTherapist={isTherapist}
                          onEditRecord={setRecForm}
                          onPushRecord={pushRecordToCoaches}
                          cardId={`paincard-${encodeURIComponent(name)}`}
                          autoOpen={name === deepLinkPlayer}
                        />
```

New code:

```jsx
          ) : tab === 'pain' ? (() => {
            // Build per-player data, keyed by id so historical name-text drift
            // (old casing, katakana vs. Latin spelling, etc.) never splits one
            // real player into multiple cards.
            const profileById = Object.fromEntries(players.map(p => [p.id, p]));
            const avMap = Object.fromEntries(availability.map(a => [a.player_id, a]));

            const painByPlayer = {};
            for (const r of painData) {
              const key = r.user_id;
              if (!painByPlayer[key]) painByPlayer[key] = [];
              painByPlayer[key].push(r);
            }
            const recsByPlayer = {};
            for (const r of records) {
              const key = r.player_id;
              if (!recsByPlayer[key]) recsByPlayer[key] = [];
              recsByPlayer[key].push(r);
            }

            // All unique player ids across availability, pain data, records
            const allIds = [...new Set([
              ...availability.map(a => a.player_id),
              ...Object.keys(painByPlayer),
              ...Object.keys(recsByPlayer),
            ])];

            const labelFor = (id) => playerLabel(profileById[id], avMap[id]?.player_name ?? id);

            const AV_RANK = { out: 0, limited: 1, full: 2 };
            // Sort: Out first, then Limited, then Full; within each: active records > monitoring > pain > alphabetical
            const sorted = allIds.sort((a, b) => {
              const aAv = AV_RANK[avMap[a]?.status ?? 'full'] ?? 2;
              const bAv = AV_RANK[avMap[b]?.status ?? 'full'] ?? 2;
              if (aAv !== bAv) return aAv - bAv;
              const aActive = (recsByPlayer[a] ?? []).some(r => r.status === 'active');
              const bActive = (recsByPlayer[b] ?? []).some(r => r.status === 'active');
              if (aActive !== bActive) return aActive ? -1 : 1;
              const aMon = (recsByPlayer[a] ?? []).some(r => r.status === 'monitoring');
              const bMon = (recsByPlayer[b] ?? []).some(r => r.status === 'monitoring');
              if (aMon !== bMon) return aMon ? -1 : 1;
              const aPain = (painByPlayer[a] ?? []).length;
              const bPain = (painByPlayer[b] ?? []).length;
              return bPain - aPain || labelFor(a).localeCompare(labelFor(b));
            });

            const concerned = sorted.filter(id =>
              (recsByPlayer[id] ?? []).some(r => r.status === 'active' || r.status === 'monitoring') ||
              (painByPlayer[id] ?? []).length > 0
            );

            return (
              <div>
                <AlertPanel
                  records={records}
                  painData={painData}
                  availability={availability}
                  players={players}
                  noticedIds={noticedIds}
                  onNotice={markNoticed}
                  lang={lang}
                />
                {isTherapist && (
                  <div className={styles.addBar}>
                    <button className={styles.btnAdd} onClick={() => setRecForm('new')}>
                      + {lang === 'ja' ? '新規記録' : 'New record'}
                    </button>
                  </div>
                )}
                {concerned.length === 0 ? (
                  <div className={styles.empty}>
                    {lang === 'ja' ? '現在、痛みや医療記録はありません。' : 'No pain reports or medical records currently.'}
                  </div>
                ) : (
                  <div className={styles.painList}>
                    {concerned.map(id => {
                      const label  = labelFor(id);
                      const jersey = profileById[id]?.jersey_number ?? null;
                      return (
                        <PlayerPainCard
                          key={id}
                          player={{ player_name: label, jersey_number: jersey }}
                          painRows={painByPlayer[id] ?? []}
                          medRecords={recsByPlayer[id] ?? []}
                          availability={avMap[id]}
                          lang={lang}
                          isTherapist={isTherapist}
                          onEditRecord={setRecForm}
                          onPushRecord={pushRecordToCoaches}
                          cardId={`paincard-${id}`}
                          autoOpen={id === deepLinkPlayer}
                        />
```

Note: the closing `);` / `})}` / etc. after this block are unchanged — only the
body of the `tab === 'pain'` IIFE and the `.map(name => ...)` → `.map(id => ...)`
callback signature change. `infoByDisplayName` and `normName` are no longer
used by this block; leave them in place since `buildAlerts`/`AlertPanel`
(lines 565-635, out of scope per the spec) still uses `infoByDisplayName`.

- [ ] **Step 2: Update the deep-link scroll effect to use plain ids (no URI encoding needed for uuids)**

Current code (`components/MedicalDashboard.jsx:759-763`):

```jsx
  useEffect(() => {
    if (!deepLinkPlayer || tab !== 'pain' || loading) return;
    const el = document.getElementById(`paincard-${encodeURIComponent(deepLinkPlayer)}`);
```

New code:

```jsx
  useEffect(() => {
    if (!deepLinkPlayer || tab !== 'pain' || loading) return;
    const el = document.getElementById(`paincard-${deepLinkPlayer}`);
```

(uuids don't need URI-encoding; this keeps the id used to build the DOM id in
Step 1 consistent with the id used to look it up here.)

- [ ] **Step 3: Verify with lint**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, log in as Therapist or another `canViewShared` role, open
Medical → Pain & Medical tab. For a player known to have historical name-text
drift (e.g. Hazuki, Shota Fujiwara), confirm they now appear as exactly ONE
card consolidating all their pain reports + medical records + availability
status, instead of multiple cards. Then repeat the Dashboard → click a
Limited/Out player check from Task 4 Step 6 and confirm it scrolls to and
opens that exact player's card.

- [ ] **Step 5: Commit**

```bash
git add components/MedicalDashboard.jsx
git commit -m "fix: group Pain and Medical tab by player id instead of name text"
```

---

### Task 6: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Lint the whole project**

Run: `npm run lint`
Expected: exit code 0.

- [ ] **Step 2: Build the whole project**

Run: `npm run build`
Expected: exit code 0, no type/compile errors.

- [ ] **Step 3: Manual smoke test**

Run: `npm run dev` and check, per role where applicable:
- Login as a Player: Dashboard loads, own profile name/jersey correct, Chat
  member list and mentions show nicknames as before.
- Login as Headcoach/Therapist: RoleManager user list unchanged (jersey badges
  still show), Dashboard Player Availability card shows `#N Name` and
  navigates correctly into Medical, Medical → Pain & Medical shows one card
  per player, Performance/Wellness/Nutrition/Vert dashboards still show
  `#N Name` labels as set up in the prior pass.

- [ ] **Step 4: Final commit (only if smoke test turned up fixes)**

```bash
git add -A
git commit -m "fix: address regressions found in name-structure cleanup smoke test"
```
