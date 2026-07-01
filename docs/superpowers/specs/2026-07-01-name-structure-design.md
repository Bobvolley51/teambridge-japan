# Name structure cleanup — design

## Goal
One clear, consistent name model across the whole app:
- `first_name` + `last_name` = real legal name. Mandatory for every account.
- `display_name` = nickname, optional intent but currently required by the existing
  onboarding gate; used as the primary label everywhere in the UI (chat, calendar,
  dashboards, jersey lists).
- Players additionally show jersey number, but only in RoleManager (user admin list)
  and the Dashboard player list — not in Chat, Calendar, Travel, Tasks, GlobalSearch,
  Tactics.

## Already in place (no new code needed)
`app/page.jsx:481` blocks login with the `ProfileSetup` modal whenever
`first_name`, `last_name`, `display_name`, or `date_of_birth` is missing. This already
satisfies "unumgängliche Aufforderung für unvollständige Profile" for any account
missing data going forward.

## Work items

1. **Normalize input in `ProfileSetup.jsx`.** Currently stores raw trimmed text.
   Add the same `initcap`-style normalization used for `display_name` so new
   submissions (first_name, last_name, nickname) stay consistently cased.

2. **One-time data cleanup in `profiles` (Supabase, project `vlzxpbndvvzktuccavfg`).**
   - Casing fix via SQL `initcap()` for existing garbled entries (HAZUKI/KISHIKAWA,
     dai/yasuhara, kanze/chiba, shinjo/akahoshi, shodai/abe, shusuke/sakai,
     takashi/ogawa, YUSUKE/HOSHINA, HIROYUKI/FURUTA).
   - Swap first/last for two rows where the values are in the wrong column
     (confirmed against the app's given-name-first convention, matching how their
     `display_name` already reads): Koji (`first=Nanba,last=Koji` → `first=Koji,last=Nanba`),
     Satoshi Arai (`first=Arai,last=Satoshi` → `first=Satoshi,last=Arai`).
   - Fujimori: `first_name`/`last_name` are non-Latin (藤森/淳平). Set
     `first_name=Junpei`, `last_name=Fujimori`.
   - Grotte/Mascot account: explicitly excluded, test/mascot account, left untouched.

3. **Fix Pain & Medical tab grouping in `MedicalDashboard.jsx:940-1029`.** The
   `tab === 'pain'` view currently groups `painData`, `records`, and `availability`
   by raw name text (`normName(r.user_name)` / `normName(r.player_name)` / `a.player_name`
   as the `avMap` key), so the same real player shows as multiple separate cards
   whenever a historical row's stored name text differs from the current
   `display_name` (old casing, katakana vs. Latin spelling, etc. — confirmed live in
   the app: e.g. "HAZUKI KISHIKAWA", "hazuki", "HAZUKI" and "翔大 安部" / "SHOTA
   FUJIWARA" each showing as separate player cards). `user_id`/`player_id` is
   already selected in the `load()` query and populated for every row (0 NULLs
   confirmed in both `medical_records` and `player_availability`) — `wellness_body_pain.user_id`
   is `not null` by schema. Regroup all three by id instead of name text, and
   render the label via `playerLabel` from the id → profile map (`players` state,
   already keyed by nothing — build `Object.fromEntries(players.map(p => [p.id, p]))`).
   Goal: exactly one Pain & Medical card per player, consolidating all their
   records regardless of historical name spelling.

4. **Propagate the shared `playerLabel` helper (`lib/usePlayerProfiles.js`) to the
   remaining files** that still build name labels ad hoc instead of using it:
   `Calendar.jsx`, `Chat.jsx`, `Dashboard.jsx`, `Travel.jsx`, `Tasks.jsx`,
   `RoleManager.jsx`, `Tactics.jsx`, `UserMenu.jsx`, `GlobalSearch.jsx`,
   `app/page.jsx`, `app/api/birthday-check/route.js`, `app/api/invite/route.js`.
   Jersey-number suffix only applied in `RoleManager.jsx` and the Dashboard player
   list, per scope decision above; everywhere else keeps plain `display_name` (with
   existing email fallback where present).
   (Already done in an earlier pass: `PerformanceDashboard.jsx`, `WellnessDashboard.jsx`,
   `MedicalDashboard.jsx` display labels, `NutritionDashboard.jsx`, `VertDashboard.jsx`.)

5. **Verification.** No test suite exists (`package.json` only has `dev`/`build`/
   `lint`). Run `npm run lint` and `npm run build` after the file changes, plus a
   manual diff review per file to confirm no behavior regressions (e.g. dropdown
   options, sort order, email fallbacks still work for non-player profiles).

## Out of scope (explicitly, per this conversation)
- Changing `wellness_responses` / `medical_records` / `player_bodyweight` schema —
  these already use `user_id`/`player_id` as the real FK; the redundant `user_name`/
  `player_name` text columns are a separate, pre-existing design and not touched here
  (only how the UI groups by them, per item 3 above).
- `AlertPanel`/`buildAlerts` (`MedicalDashboard.jsx:565-620`) — lists individual
  48h-old alerts one row per record, not grouped, so the name-drift issue doesn't
  cause duplicate rows there the way it does in the grouped Pain & Medical list.
  Left as is.
- Jersey number anywhere outside RoleManager / Dashboard player list.
