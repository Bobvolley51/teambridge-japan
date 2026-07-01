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

3. **Propagate the shared `playerLabel` helper (`lib/usePlayerProfiles.js`) to the
   remaining files** that still build name labels ad hoc instead of using it:
   `Calendar.jsx`, `Chat.jsx`, `Dashboard.jsx`, `Travel.jsx`, `Tasks.jsx`,
   `RoleManager.jsx`, `Tactics.jsx`, `UserMenu.jsx`, `GlobalSearch.jsx`,
   `app/page.jsx`, `app/api/birthday-check/route.js`, `app/api/invite/route.js`.
   Jersey-number suffix only applied in `RoleManager.jsx` and the Dashboard player
   list, per scope decision above; everywhere else keeps plain `display_name` (with
   existing email fallback where present).
   (Already done in an earlier pass: `PerformanceDashboard.jsx`, `WellnessDashboard.jsx`,
   `MedicalDashboard.jsx`, `NutritionDashboard.jsx`, `VertDashboard.jsx`.)

4. **Verification.** No test suite exists (`package.json` only has `dev`/`build`/
   `lint`). Run `npm run lint` and `npm run build` after the file changes, plus a
   manual diff review per file to confirm no behavior regressions (e.g. dropdown
   options, sort order, email fallbacks still work for non-player profiles).

## Out of scope (explicitly, per this conversation)
- Changing `wellness_responses` / `medical_records` / `player_bodyweight` schema —
  these already use `user_id`/`player_id` as the real FK; the redundant `user_name`/
  `player_name` text columns are a separate, pre-existing design and not touched here.
- MedicalDashboard's "Japanese nickname → Latin legal name" lookup feature
  (`nameByDisplay`, `infoByDisplayName`) — intentional existing feature, left as is.
- Jersey number anywhere outside RoleManager / Dashboard player list.
