// lib/acwr.js — ACWR EWMA calculation (Gabbett 2016)
//
// λ_acute   = 2/(7+1)  = 0.25
// λ_chronic = 2/(28+1) ≈ 0.069
//
// Every calendar day from windowStart through today is advanced; days without
// a submitted session contribute sRPE = 0. Both EWMAs are seeded at 0 on
// windowStart so the full window is used. System stabilises after ~28 days;
// load 90 days of history for reliable values.

/**
 * @param {Array<{event_date: string, load_au: number}>} sessions
 * @param {string|null} windowStart  ISO date (YYYY-MM-DD) to begin the EWMA.
 *   Every day from windowStart without a session counts as load = 0.
 *   Falls back to the first session date when omitted.
 * @returns {{ acute: number, chronic: number, acwr: number|null }}
 */
export function computeEWMA(sessions, windowStart = null) {
  // Aggregate load per calendar date (two sessions on the same day sum)
  const loadByDate = {};
  for (const s of sessions) {
    if (s.load_au > 0) {
      loadByDate[s.event_date] = (loadByDate[s.event_date] ?? 0) + s.load_au;
    }
  }
  const sortedDates = Object.keys(loadByDate).sort();

  const startDate = windowStart ?? sortedDates[0];
  if (!startDate) return { acute: 0, chronic: 0, acwr: null };

  // Seed at 0; every day without a registered practice counts as 0 load.
  const firstLoad = loadByDate[startDate] ?? 0;
  let acute   = firstLoad;
  let chronic = firstLoad;

  // Advance one calendar day at a time from day 2 through today
  const today = new Date().toISOString().slice(0, 10);
  const cur   = new Date(startDate);
  cur.setDate(cur.getDate() + 1);
  const end = new Date(today);

  while (cur <= end) {
    const d    = cur.toISOString().slice(0, 10);
    const load = loadByDate[d] ?? 0;
    acute   = load * 0.25  + acute   * 0.75;
    chronic = load * 0.069 + chronic * 0.931;
    cur.setDate(cur.getDate() + 1);
  }

  if (!sortedDates.length) return { acute: 0, chronic: 0, acwr: null };

  const acwr = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null;
  return { acute: Math.round(acute), chronic: Math.round(chronic), acwr };
}
