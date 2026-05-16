'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/date';
import { useTranslated } from '@/lib/translate';
import { SkeletonCardBlock, SkeletonList } from './Skeleton';
import styles from './Dashboard.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(lang) {
  const h = new Date().getHours();
  if (lang === 'ja') {
    if (h < 12) return 'おはようございます';
    if (h < 18) return 'こんにちは';
    return 'こんばんは';
  }
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate(lang) {
  return new Date().toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

function pad(n) { return String(n).padStart(2, '0'); }

function fmtEventTime(ev, lang) {
  if (ev.all_day) return lang === 'ja' ? '終日' : 'All day';
  const d = new Date(ev.start_time);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Mirrors Calendar.jsx — expands recurring events into occurrences within [fromISO, toISO]
function expandRecurring(rawEvents, fromISO, toISO) {
  const fromDate = new Date(fromISO);
  const toDate   = new Date(toISO);
  const result   = [];
  for (const ev of rawEvents) {
    const baseStart = new Date(ev.start_time);
    const duration  = new Date(ev.end_time) - baseStart;
    if (!ev.recurrence) {
      if (baseStart >= fromDate && baseStart <= toDate)
        result.push({ ...ev, _key: ev.id });
      continue;
    }
    const recEnd       = ev.recurrence_end ? new Date(ev.recurrence_end) : toDate;
    const effectiveEnd = recEnd < toDate ? recEnd : toDate;
    if (ev.recurrence.startsWith('weekly:')) {
      const selectedDays = ev.recurrence.split(':')[1].split(',').map(Number);
      const h = baseStart.getHours(), m = baseStart.getMinutes();
      const startDay = new Date(baseStart > fromDate ? baseStart : fromDate);
      startDay.setHours(0, 0, 0, 0);
      let d = new Date(startDay);
      while (d <= effectiveEnd) {
        const dow = (d.getDay() + 6) % 7;
        if (selectedDays.includes(dow)) {
          const occStart = new Date(d); occStart.setHours(h, m, 0, 0);
          if (occStart >= fromDate) {
            result.push({ ...ev, start_time: occStart.toISOString(), end_time: new Date(occStart.getTime() + duration).toISOString(), _key: `${ev.id}_${occStart.toISOString()}` });
          }
        }
        d = new Date(d); d.setDate(d.getDate() + 1);
      }
      continue;
    }
    let curr = new Date(baseStart), safety = 0;
    while (curr <= effectiveEnd && safety < 500) {
      safety++;
      if (curr >= fromDate)
        result.push({ ...ev, start_time: curr.toISOString(), end_time: new Date(curr.getTime() + duration).toISOString(), _key: `${ev.id}_${curr.toISOString()}` });
      const next = new Date(curr);
      if      (ev.recurrence === 'daily')   next.setDate(next.getDate() + 1);
      else if (ev.recurrence === 'weekly')  next.setDate(next.getDate() + 7);
      else if (ev.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (ev.recurrence === 'yearly')  next.setFullYear(next.getFullYear() + 1);
      else break;
      if (next.getTime() === curr.getTime()) break;
      curr = next;
    }
  }
  return result.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

function countdown(startTime, lang) {
  const diff = Math.round((new Date(startTime) - Date.now()) / 60000);
  if (diff <= 0) return lang === 'ja' ? '進行中' : 'Now';
  if (diff < 60) return lang === 'ja' ? `${diff}分後` : `in ${diff}m`;
  const h = Math.floor(diff / 60), m = diff % 60;
  if (m === 0) return lang === 'ja' ? `${h}時間後` : `in ${h}h`;
  return lang === 'ja' ? `${h}時間${m}分後` : `in ${h}h ${m}m`;
}

const WELLNESS_ALERT_ROLES      = ['GM', 'Headcoach', 'Coaching Staff', 'Athletic Trainer', 'Therapist'];
const AVAILABILITY_VIEWER_ROLES = ['GM', 'Headcoach', 'Athletic Trainer', 'Therapist', 'Coaching Staff', 'Organisation Staff'];

const QUESTION_LABELS = {
  fatigue:     { en: 'Fatigue',     ja: '疲労' },
  sleep:       { en: 'Sleep',       ja: '睡眠' },
  appetite:    { en: 'Appetite',    ja: '食欲' },
  temperature: { en: 'Temperature', ja: '体温' },
  pain:        { en: 'Body Pain',   ja: '痛み' },
};

const CAT_COLOR = {
  'Ball-Practice': '#2563eb', Weightlifting: '#d97706', Game: '#dc2626',
  Meeting: '#059669', Travel: '#7c3aed', Other: '#6b7280',
};

const PRI = {
  high:   { dot: '#ef4444', bg: '#fef2f2', border: '#fecaca', en: 'Priority', ja: '重要'    },
  medium: { dot: '#f59e0b', bg: '#fffbeb', border: '#fde68a', en: 'Info',     ja: 'お知らせ' },
  low:    { dot: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0', en: 'Reminder', ja: 'その他'  },
};

const TASK_PRI_COLOR = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };

// ── #3 Player Summary Card ────────────────────────────────────────────────────

function PlayerSummaryCard({ lang, lastRpe, wellnessAvg, nextEvent, onNavigate }) {
  return (
    <div className={styles.card} style={{ marginBottom: 0 }}>
      <div className={styles.cardHead}>
        <span className={styles.cardTitle}>📊 {lang === 'ja' ? 'マイデータ' : 'My Stats'}</span>
      </div>
      <div className={styles.cardBody} style={{ display: 'flex', gap: 0, flexDirection: 'column' }}>
        {/* Last RPE */}
        <div className={styles.alertSection}>
          <div className={styles.playerStatRow}>
            <span className={styles.playerStatLabel}>
              {lang === 'ja' ? '最新RPE' : 'Last RPE'}
            </span>
            {lastRpe ? (
              <div className={styles.playerStatVal}>
                <strong>{lastRpe.rpe}</strong>
                <span className={styles.playerStatSub}> · {lastRpe.event_title ?? lastRpe.event_date}</span>
              </div>
            ) : (
              <span className={styles.playerStatEmpty}>—</span>
            )}
          </div>
        </div>
        {/* Wellness trend */}
        <div className={styles.alertSection}>
          <div className={styles.playerStatRow}>
            <span className={styles.playerStatLabel}>
              {lang === 'ja' ? 'ウェルネス (7日平均)' : 'Wellness (7d avg)'}
            </span>
            {wellnessAvg != null ? (
              <div className={styles.playerStatVal}>
                <strong style={{ color: wellnessAvg >= 7 ? '#16a34a' : wellnessAvg >= 5 ? '#d97706' : '#dc2626' }}>
                  {wellnessAvg.toFixed(1)}
                </strong>
                <span className={styles.playerStatSub}> / 10</span>
              </div>
            ) : (
              <span className={styles.playerStatEmpty}>—</span>
            )}
          </div>
        </div>
        {/* Next event */}
        <div className={styles.alertSection}>
          <div className={styles.playerStatRow}>
            <span className={styles.playerStatLabel}>
              {lang === 'ja' ? '次の予定' : 'Next event'}
            </span>
            {nextEvent ? (
              <div className={styles.playerStatVal} style={{ cursor: 'pointer' }} onClick={() => onNavigate('calendar')}>
                <span className={styles.alertDot} style={{ background: CAT_COLOR[nextEvent.category] ?? '#6b7280', display: 'inline-block', marginRight: 5, verticalAlign: 'middle' }} />
                <strong>{nextEvent.title}</strong>
                <span className={styles.playerStatSub}> · {fmtEventTime(nextEvent, lang)}</span>
              </div>
            ) : (
              <span className={styles.playerStatEmpty}>—</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <div className={styles.sectionLabel}>{children}</div>;
}

function EmptyState({ children }) {
  return <div className={styles.empty}>{children}</div>;
}

function TaskItem({ task, lang, priColor, onNavigate, onDismiss }) {
  const title = useTranslated(task.title, lang);
  return (
    <div className={styles.alertItem}>
      <span className={styles.alertDot} style={{ background: priColor }} />
      <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => onNavigate('tasks')}>
        <div className={styles.alertText}>{title}</div>
        <div className={styles.alertSub}>
          {task.status === 'todo' ? (lang === 'ja' ? '未着手' : 'To do') : (lang === 'ja' ? '進行中' : 'In progress')}
          {task.priority === 'medium' ? ` · ${lang === 'ja' ? '中' : 'Medium'}` : ''}
          {task.due_date ? ` · ${lang === 'ja' ? '期限: ' : 'Due: '}${task.due_date}` : ''}
        </div>
      </div>
      <button className={styles.noticedBtn} onClick={() => onDismiss(task.id)}>
        ✓ {lang === 'ja' ? '確認' : 'Noticed'}
      </button>
    </div>
  );
}

function AnnItem({ ann, lang, onNavigate, onDismiss }) {
  const title   = useTranslated(ann.title,   lang);
  const content = useTranslated(ann.content, lang);
  const pri = PRI[ann.priority] ?? PRI.medium;
  return (
    <div className={styles.annItem}>
      <div className={styles.annItemTop}>
        <span className={styles.annPriBadge}
          style={{ background: pri.bg, border: `1px solid ${pri.border}`, color: pri.dot }}>
          <span className={styles.annPriDot} style={{ background: pri.dot }} />
          {pri[lang]}
        </span>
        <button className={styles.noticedBtn} onClick={() => onDismiss(ann.id)}>
          ✓ {lang === 'ja' ? '確認済み' : 'Noticed'}
        </button>
      </div>
      <div className={styles.annTitle} onClick={() => onNavigate('feed')} style={{ cursor: 'pointer' }}>{title}</div>
      <div className={styles.annContent}>{content}</div>
      <div className={styles.annMeta}>{ann.author_name} · {timeAgo(ann.created_at, lang)}</div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Dashboard({
  lang = 'en',
  profile,
  currentUserId,
  currentUserInitials,
  currentUserName,
  onNavigate,
  onOpenWellness,
}) {
  const [events,            setEvents]            = useState([]);
  const [messages,          setMessages]          = useState([]);
  const [announcements,     setAnnouncements]     = useState([]);
  const [readAnnIds,        setReadAnnIds]        = useState(new Set());
  const [tasks,             setTasks]             = useState([]);
  const [wellnessAlerts,    setWellnessAlerts]    = useState([]);
  const [wellnessProgress,  setWellnessProgress]  = useState(null); // { submitted, total }
  const [nutritionProgress, setNutritionProgress] = useState(null); // { submitted, total }
  const [acwrAlerts,        setAcwrAlerts]        = useState([]);
  const [overlapAlerts,     setOverlapAlerts]     = useState([]);
  const [calChanges,        setCalChanges]        = useState([]);
  const [availability,      setAvailability]      = useState([]);
  const [playerRpe,         setPlayerRpe]         = useState(null);
  const [playerWellnessAvg, setPlayerWellnessAvg] = useState(null);
  const [playerUploadCounts, setPlayerUploadCounts] = useState(null); // { wellness, rpe, nutrition }
  const [weekOpen,          setWeekOpen]          = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [loading,           setLoading]           = useState(true);

  useEffect(() => { load(); }, [currentUserId, profile?.role]);

  async function load() {
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const todayDateStr    = todayStart.toISOString().slice(0, 10);
    const yesterday       = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toISOString().slice(0, 10);
    const week7Ago        = new Date(todayStart);
    week7Ago.setDate(week7Ago.getDate() - 7);
    const week7AgoStr     = week7Ago.toISOString().slice(0, 10);

    const isPlayer         = profile?.role === 'Player';
    const canSeeWellness   = WELLNESS_ALERT_ROLES.includes(profile?.role);
    const canSeeAvail      = AVAILABILITY_VIEWER_ROLES.includes(profile?.role);
    const isAdminSchedule  = ['GM', 'Headcoach', 'Coaching Staff'].includes(profile?.role);

    const [
      { data: myPartsData },
      { data: allEventsData },
      { data: msgData },
      { data: annData },
      { data: annReadsData },
      { data: taskData },
      { data: wellData },
      { data: wellSubmittedData },
      { data: playerCountData },
      { data: rpeData },
      { data: calChangeData },
      { data: avData },
      { data: playerProfiles },
      { data: myLastRpeData },
      { data: myWellnessData },
      { data: myRpeCountData },
      { data: myNutritionCountData },
      { data: nutriSubmittedData },
    ] = await Promise.all([
      // My participation events — no date filter so recurring base events are included
      currentUserId
        ? supabase.from('event_participants')
            .select('status, events(id, title, start_time, end_time, all_day, category, location, recurrence, recurrence_end)')
            .eq('profile_id', currentUserId)
        : Promise.resolve({ data: [] }),
      // All team events (admin roles) — only upper bound so old recurring events are included
      isAdminSchedule
        ? supabase.from('events')
            .select('id, title, start_time, end_time, all_day, category, location, recurrence, recurrence_end')
            .lte('start_time', weekEnd.toISOString())
            .order('start_time')
        : Promise.resolve({ data: [] }),
      // Messages
      supabase.from('messages')
        .select('id, channel, user_name, content, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      // Announcements
      supabase.from('announcements')
        .select('id, title, content, priority, author_name, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      // #4: Read announcements from DB
      currentUserId
        ? supabase.from('announcement_reads')
            .select('announcement_id')
            .eq('user_id', currentUserId)
        : Promise.resolve({ data: [] }),
      // #6: Tasks by UUID
      currentUserId
        ? supabase.from('tasks')
            .select('id, title, status, priority, due_date, created_at')
            .eq('assigned_to', currentUserId)
            .neq('status', 'done')
            .limit(50)
        : Promise.resolve({ data: [] }),
      // Wellness low-score alerts
      canSeeWellness
        ? supabase.from('wellness_responses')
            .select('user_name, question_key, score, response_date')
            .gte('response_date', yesterdayDateStr)
            .lt('score', 5)
            .order('response_date', { ascending: false })
            .order('user_name')
        : Promise.resolve({ data: [] }),
      // #2: Wellness submission count today
      canSeeWellness
        ? supabase.from('wellness_responses')
            .select('user_id')
            .eq('response_date', todayDateStr)
        : Promise.resolve({ data: [] }),
      // #2: Total player count
      canSeeWellness
        ? supabase.from('profiles').select('id').eq('role', 'Player')
        : Promise.resolve({ data: [] }),
      // ACWR RPE data
      canSeeWellness
        ? supabase.from('session_rpe')
            .select('user_id, user_name, event_date, load_au')
            .gte('event_date', (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10); })())
        : Promise.resolve({ data: [] }),
      // Calendar change notifications
      currentUserId
        ? supabase.from('notifications')
            .select('id, title, body, created_at, ref_id')
            .eq('user_id', currentUserId)
            .eq('type', 'calendar_change')
            .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      // Availability
      canSeeAvail
        ? supabase.from('player_availability').select('*').order('player_name')
        : Promise.resolve({ data: [] }),
      canSeeAvail
        ? supabase.from('profiles').select('id, display_name').eq('role', 'Player').order('display_name')
        : Promise.resolve({ data: [] }),
      // #3: Player's last RPE session
      isPlayer && currentUserId
        ? supabase.from('session_rpe')
            .select('rpe, event_title, event_date')
            .eq('user_id', currentUserId)
            .order('event_date', { ascending: false })
            .limit(1)
        : Promise.resolve({ data: [] }),
      // #3: Player's wellness last 7 days
      isPlayer && currentUserId
        ? supabase.from('wellness_responses')
            .select('score, question_key')
            .eq('user_id', currentUserId)
            .gte('response_date', week7AgoStr)
            .in('question_key', ['fatigue', 'sleep', 'appetite'])
        : Promise.resolve({ data: [] }),
      // Player RPE sessions last 7 days
      isPlayer && currentUserId
        ? supabase.from('session_rpe').select('event_date').eq('user_id', currentUserId).gte('event_date', week7AgoStr)
        : Promise.resolve({ data: [] }),
      // Player nutrition entries last 7 days
      isPlayer && currentUserId
        ? supabase.from('nutrition_entries').select('meal_date').eq('user_id', currentUserId).gte('meal_date', week7AgoStr)
        : Promise.resolve({ data: [] }),
      // Nutrition submission count today (staff view)
      canSeeWellness
        ? supabase.from('nutrition_entries').select('user_id').eq('meal_date', todayDateStr)
        : Promise.resolve({ data: [] }),
    ]);

    // ── Events merge (recurring-aware) ──
    const rangeFrom = todayStart.toISOString();
    const rangeTo   = weekEnd.toISOString();

    // Build status map by base event id (participation is per event, not per occurrence)
    const statusByEventId = {};
    for (const p of (myPartsData ?? [])) {
      if (p.events?.id) statusByEventId[p.events.id] = p.status ?? 'in';
    }

    // Expand my participated events into occurrences within the window
    const myBaseEvents = (myPartsData ?? [])
      .filter(p => p.events?.id)
      .map(p => p.events);
    const myExpanded = expandRecurring(myBaseEvents, rangeFrom, rangeTo)
      .map(ev => ({ ...ev, _myStatus: statusByEventId[ev.id] ?? 'in' }));

    // Expand all team events (admin) — then merge, preferring participation entries
    const adminExpanded = isAdminSchedule
      ? expandRecurring(allEventsData ?? [], rangeFrom, rangeTo)
      : [];

    const partMap = {};
    for (const ev of myExpanded)    partMap[ev._key] = ev;
    for (const ev of adminExpanded) { if (!partMap[ev._key]) partMap[ev._key] = { ...ev, _myStatus: null }; }

    const myEventsRaw = Object.values(partMap);
    myEventsRaw.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    setEvents(myEventsRaw);

    // Overlap detection — today's participation events only
    const now = new Date();
    const todayEndMs = todayStart.getTime() + 86399999; // 23:59:59.999 local
    const futureEvs = myExpanded
      .filter(ev => !ev.all_day && new Date(ev.start_time).getTime() <= todayEndMs && new Date(ev.end_time) > now);
    const overlaps = [];
    for (let i = 0; i < futureEvs.length; i++) {
      for (let j = i + 1; j < futureEvs.length; j++) {
        const a = futureEvs[i], b = futureEvs[j];
        if (new Date(a.start_time) < new Date(b.end_time) && new Date(a.end_time) > new Date(b.start_time)) {
          overlaps.push([a, b]);
        }
      }
    }
    setOverlapAlerts(overlaps);

    setMessages(msgData ?? []);
    setAnnouncements(annData ?? []);
    // #4: DB-backed read IDs
    setReadAnnIds(new Set((annReadsData ?? []).map(r => r.announcement_id)));
    setTasks(taskData ?? []);
    setCalChanges(calChangeData ?? []);

    // Wellness alerts
    const warnMap = {};
    for (const r of (wellData ?? [])) {
      const mapKey = `${r.response_date}::${r.user_name}`;
      if (!warnMap[mapKey]) warnMap[mapKey] = { name: r.user_name, date: r.response_date, scores: [] };
      warnMap[mapKey].scores.push({ key: r.question_key, score: r.score });
    }
    setWellnessAlerts(Object.values(warnMap));

    // #2: Wellness progress
    if (canSeeWellness) {
      const uniqueSubmitted = new Set((wellSubmittedData ?? []).map(r => r.user_id)).size;
      setWellnessProgress({ submitted: uniqueSubmitted, total: (playerCountData ?? []).length });
      const nutriUnique = new Set((nutriSubmittedData ?? []).map(r => r.user_id)).size;
      setNutritionProgress({ submitted: nutriUnique, total: (playerCountData ?? []).length });
    }

    // ACWR
    const rpeRows = rpeData ?? [];
    if (rpeRows.length > 0) {
      const day7  = new Date(); day7.setDate(day7.getDate() - 7);
      const day28 = new Date(); day28.setDate(day28.getDate() - 28);
      const pMap = {};
      for (const r of rpeRows) {
        if (!pMap[r.user_id]) pMap[r.user_id] = { name: r.user_name, all: [] };
        pMap[r.user_id].all.push(r);
      }
      const alerts = [];
      for (const p of Object.values(pMap)) {
        const acute   = p.all.filter(s => new Date(s.event_date) >= day7).reduce((a, s) => a + s.load_au, 0);
        const chronic = p.all.filter(s => new Date(s.event_date) >= day28).reduce((a, s) => a + s.load_au, 0) / 4;
        if (chronic <= 0) continue;
        const acwr = Math.round((acute / chronic) * 100) / 100;
        if (acwr > 1.3) alerts.push({ name: p.name, acwr, zone: acwr > 1.5 ? 'highrisk' : 'caution' });
      }
      alerts.sort((a, b) => b.acwr - a.acwr);
      setAcwrAlerts(alerts);
    }

    // Availability merge
    const avMap = Object.fromEntries((avData ?? []).map(a => [a.player_id, a]));
    const mergedAv = (playerProfiles ?? []).map(p => avMap[p.id] ?? {
      player_id: p.id, player_name: p.display_name, status: 'full', reason: null, updated_at: null,
    });
    setAvailability(mergedAv);

    // #3: Player personal data
    if (isPlayer) {
      setPlayerRpe((myLastRpeData ?? [])[0] ?? null);
      const wScores = (myWellnessData ?? []).map(r => r.score);
      setPlayerWellnessAvg(wScores.length > 0 ? wScores.reduce((a, b) => a + b, 0) / wScores.length : null);
      setPlayerUploadCounts({
        wellness:   new Set((myWellnessData ?? []).map(r => r.response_date)).size,
        rpe:        (myRpeCountData ?? []).length,
        nutrition:  (myNutritionCountData ?? []).length,
      });
    }

    setLoading(false);
  }

  // ── #4: DB-backed dismiss ────────────────────────────────────────────────────
  const dismissAnnouncement = async (id) => {
    setReadAnnIds(prev => new Set([...prev, id]));
    if (currentUserId) {
      await supabase.from('announcement_reads')
        .upsert({ user_id: currentUserId, announcement_id: id }, { onConflict: 'user_id,announcement_id' });
    }
  };

  const dismissTask = (id) => {
    const key = `task_dismissed_${currentUserId}`;
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    localStorage.setItem(key, JSON.stringify([...prev, id]));
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  // ── #5: Inline RSVP ──────────────────────────────────────────────────────────
  const handleRsvp = async (eventId, newStatus) => {
    setEvents(prev => prev.map(ev =>
      ev.id === eventId ? { ...ev, _myStatus: newStatus } : ev
    ));
    await supabase.from('event_participants')
      .upsert({ profile_id: currentUserId, event_id: eventId, status: newStatus },
               { onConflict: 'profile_id,event_id' });
  };

  // ── Derived data ─────────────────────────────────────────────────────────────

  const now            = new Date();
  const todayEnd       = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayDateStr   = now.toISOString().slice(0, 10);
  const yest           = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterdayDateStr = yest.toISOString().slice(0, 10);

  const todayEvents     = events.filter(ev => new Date(ev.start_time) <= todayEnd);
  const upcomingEvents  = events.filter(ev => new Date(ev.start_time) > todayEnd);
  const nextEvent       = todayEvents.find(ev => !ev.all_day && new Date(ev.start_time) > now)
                       ?? upcomingEvents[0]
                       ?? null;

  const wellnessDoneToday = typeof window !== 'undefined'
    ? !!localStorage.getItem(`wellness_done_${currentUserId}_${todayDateStr}`)
    : true;

  const RSVP_LABEL = {
    in:    { en: 'In',    ja: '参加',  cls: 'rsvpIn' },
    maybe: { en: 'Maybe', ja: '未定',  cls: 'rsvpMaybe' },
    out:   { en: 'Out',   ja: '欠席',  cls: 'rsvpOut' },
  };

  const dismissedTaskIds = typeof window !== 'undefined'
    ? new Set(JSON.parse(localStorage.getItem(`task_dismissed_${currentUserId}`) || '[]'))
    : new Set();
  const TASK_PRI_ORDER = { high: 0, medium: 1, low: 2 };
  const visibleDashTasks = tasks
    .filter(t => !dismissedTaskIds.has(t.id))
    .sort((a, b) => {
      const pa = TASK_PRI_ORDER[a.priority] ?? 1;
      const pb = TASK_PRI_ORDER[b.priority] ?? 1;
      if (pa !== pb) return pa - pb;
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date < b.due_date ? -1 : 1;
    });
  const canSeeWellness     = WELLNESS_ALERT_ROLES.includes(profile?.role);
  const canSeeAvailability = AVAILABILITY_VIEWER_ROLES.includes(profile?.role);
  const avIssues           = availability.filter(p => p.status !== 'full');
  const avFull             = availability.filter(p => p.status === 'full').length;
  const isPlayer           = profile?.role === 'Player';

  const wellnessToday     = wellnessAlerts.filter(w => w.date === todayDateStr);
  const wellnessYesterday = wellnessAlerts.filter(w => w.date === yesterdayDateStr);

  // Messages: only newer than last Chat visit
  const lastChatVisit = typeof window !== 'undefined'
    ? localStorage.getItem(`chat_last_visited_${currentUserId}`) || ''
    : '';

  // Announcements: < 72h old, not dismissed in DB
  const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const visibleAnnouncements = announcements.filter(
    a => a.created_at >= cutoff72h && !readAnnIds.has(a.id)
  );

  const dismissedCalChanges = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem(`cal_changes_dismissed_${currentUserId}`) || '[]')
    : [];
  const visibleCalChanges = calChanges.filter(n => !dismissedCalChanges.includes(n.id));
  const dismissCalChange = (id) => {
    const updated = [...dismissedCalChanges, id];
    localStorage.setItem(`cal_changes_dismissed_${currentUserId}`, JSON.stringify(updated));
    setCalChanges(prev => prev.filter(n => n.id !== id));
  };

  const channels = {};
  for (const msg of messages) {
    if (msg.channel?.startsWith('dm:')) continue;
    if (lastChatVisit && msg.created_at <= lastChatVisit) continue;
    if (!channels[msg.channel]) channels[msg.channel] = [];
    if (channels[msg.channel].length < 4) channels[msg.channel].push(msg);
  }
  const channelNames = Object.keys(channels);

  const profileLine = (() => {
    if (!profile) return '';
    if (profile.role === 'Player') {
      const parts = [];
      if (profile.jersey_number != null) parts.push(`#${profile.jersey_number}`);
      if (profile.position) parts.push(profile.position);
      parts.push(lang === 'ja' ? '選手' : 'Player');
      return parts.join(' · ');
    }
    return profile.role ?? '';
  })();

  // #7: Group upcoming events by date
  const upcomingByDate = {};
  for (const ev of upcomingEvents) {
    const ds = new Date(ev.start_time).toLocaleDateString(
      lang === 'ja' ? 'ja-JP' : 'en-GB',
      { weekday: 'short', month: 'short', day: 'numeric' }
    );
    if (!upcomingByDate[ds]) upcomingByDate[ds] = [];
    upcomingByDate[ds].push(ev);
  }

  const glanceStats = loading ? [] : [
    { icon: '📅', value: todayEvents.length,  label: lang === 'ja' ? '今日の予定' : 'today' },
    { icon: '✅', value: tasks.length,        label: lang === 'ja' ? '未完了タスク' : 'open tasks' },
    ...(canSeeWellness
      ? [{ icon: '⚠️', value: wellnessAlerts.length + acwrAlerts.length, label: lang === 'ja' ? 'アラート' : 'alerts' }]
      : []),
  ];

  return (
    <div className={styles.wrapper}>

      {/* Welcome banner */}
      <div className={styles.welcome}>
        <div>
          <div className={styles.greeting}>{greeting(lang)}, {currentUserName?.split(' ')[0] ?? currentUserName} 👋</div>
          <div className={styles.dateStr}>{fmtDate(lang)}</div>
          {!loading && glanceStats.length > 0 && (
            <div className={styles.glanceBar}>
              {glanceStats.map((s, i) => (
                <span key={i} className={`${styles.glanceStat} ${s.value > 0 && s.icon === '⚠️' ? styles.glanceAlert : ''}`}>
                  {s.icon} <strong>{s.value}</strong> {s.label}
                </span>
              ))}
            </div>
          )}
        </div>
        {profile && (
          <div className={styles.profileChip}>
            <span className={styles.profileInitials}>{(currentUserName ?? 'U').slice(0, 2).toUpperCase()}</span>
            <div>
              <div className={styles.profileChipName}>{currentUserName}</div>
              {profileLine && <div className={styles.profileChipSub}>{profileLine}</div>}
            </div>
          </div>
        )}
      </div>

      {/* Schedule change banners */}
      {visibleCalChanges.map(n => (
        <div key={n.id} className={styles.calChangeBanner} onClick={() => onNavigate('calendar')}>
          <span className={styles.calChangeBannerIcon}>⚠️</span>
          <div className={styles.calChangeBannerBody}>
            <div className={styles.calChangeBannerTitle}>
              {lang === 'ja' ? '⚡ チームスケジュールが変更されました' : '⚡ Team schedule has been changed'}
            </div>
            <div className={styles.calChangeBannerSub}>{n.title.replace(/^Event updated: /, '').replace(/^予定変更: /, '')} · {n.body}</div>
          </div>
          <button className={styles.calChangeDismiss} onClick={e => { e.stopPropagation(); dismissCalChange(n.id); }}>✕</button>
        </div>
      ))}

      {/* Missed wellness reminder */}
      {isPlayer && !wellnessDoneToday && onOpenWellness && (
        <div className={styles.wellnessBanner}>
          <span className={styles.wellnessBannerIcon}>💪</span>
          <div className={styles.wellnessBannerBody}>
            <div className={styles.wellnessBannerTitle}>
              {lang === 'ja' ? '今日のチェックインがまだです' : "You haven't completed today's check-in"}
            </div>
          </div>
          <button className={styles.wellnessBannerBtn} onClick={onOpenWellness}>
            {lang === 'ja' ? 'チェックイン →' : 'Check in →'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SkeletonCardBlock lines={4} />
            <SkeletonCardBlock lines={4} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SkeletonCardBlock lines={3} />
            <SkeletonCardBlock lines={3} />
          </div>
        </div>
      ) : (
        <>
          {/* #3: Player summary card */}
          {isPlayer && (
            <div style={{ padding: '16px 24px 0' }}>
              <PlayerSummaryCard
                lang={lang}
                lastRpe={playerRpe}
                wellnessAvg={playerWellnessAvg}
                nextEvent={todayEvents[0] ?? null}
                onNavigate={onNavigate}
              />
            </div>
          )}

          {/* Top row: Schedule | Availability | Health+Performance */}
          <div className={`${styles.topRow} ${canSeeAvailability && canSeeWellness ? styles.topRowThree : !canSeeWellness && !canSeeAvailability ? styles.topRowFull : styles.topRowTwo}`}>

            {/* Today's Schedule */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>
                  📅 {lang === 'ja' ? '今日のスケジュール' : "Today's Schedule"}
                  {todayEvents.length > 0 && <span className={styles.countBadgeBlue}>{todayEvents.length}</span>}
                </span>
                {overlapAlerts.length > 0 && (
                  <span className={styles.overlapChip}>
                    ⚠️ {lang === 'ja' ? '重複あり' : 'Conflict'}
                    <span className={styles.overlapChipDetail}>
                      {overlapAlerts.map(([a, b], i) => (
                        <span key={i}>"{a.title}" &amp; "{b.title}"</span>
                      ))}
                    </span>
                  </span>
                )}
              </div>
              <div className={styles.cardBody}>
                {/* #1: Next Up block */}
                {nextEvent && !nextEvent.all_day && new Date(nextEvent.start_time) > now && (
                  <div className={styles.nextUpBlock} onClick={() => onNavigate('calendar')}>
                    <span className={styles.nextUpDot} style={{ background: CAT_COLOR[nextEvent.category] ?? '#6b7280' }} />
                    <div className={styles.nextUpInfo}>
                      <div className={styles.nextUpTitle}>{nextEvent.title}</div>
                      <div className={styles.nextUpTime}>{fmtEventTime(nextEvent, lang)}{nextEvent.location ? ` · ${nextEvent.location}` : ''}</div>
                    </div>
                    <span className={styles.nextUpCountdown}>{countdown(nextEvent.start_time, lang)}</span>
                  </div>
                )}

                {todayEvents.length === 0 ? (
                  <EmptyState>{lang === 'ja' ? '今日の予定はありません。' : 'Nothing scheduled today.'}</EmptyState>
                ) : (
                  <div className={styles.alertSection}>
                    {todayEvents.map(ev => {
                      const status = ev._myStatus;
                      return (
                        <div key={ev.id} className={styles.alertItem}>
                          <span className={styles.alertDot} style={{ background: CAT_COLOR[ev.category] ?? '#6b7280', cursor: 'pointer' }} onClick={() => onNavigate('calendar')} />
                          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onNavigate('calendar')}>
                            <div className={styles.alertText}>{ev.title}</div>
                            <div className={styles.alertSub}>
                              {fmtEventTime(ev, lang)}{ev.location ? ` · ${ev.location}` : ''}
                            </div>
                          </div>
                          {/* #5: Inline RSVP buttons — only for events where user is a participant */}
                          {status !== null && (
                            <div className={styles.rsvpBtnGroup}>
                              {['in', 'maybe', 'out'].map(s => (
                                <button key={s}
                                  className={`${styles.rsvpBtnInline} ${status === s ? styles[`rsvpBtnActive_${s}`] : ''}`}
                                  onClick={() => handleRsvp(ev.id, s)}>
                                  {RSVP_LABEL[s]?.[lang] ?? s}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

              </div>
              <div className={styles.cardFoot}>
                <button className={styles.footBtn} onClick={() => onNavigate('calendar')}>
                  {lang === 'ja' ? 'カレンダーを開く →' : 'Open Calendar →'}
                </button>
              </div>
            </div>

            {/* Player Availability */}
            {canSeeAvailability && (
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    🩺 {lang === 'ja' ? '選手の状態' : 'Player Availability'}
                    {avIssues.length > 0 && <span className={styles.countBadge}>{avIssues.length}</span>}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.avCountRow}>
                    {[
                      { status: 'full',    count: avFull,                                              color: '#16a34a', bg: '#dcfce7', en: 'Full',    ja: '全体練習可' },
                      { status: 'limited', count: avIssues.filter(p => p.status === 'limited').length, color: '#d97706', bg: '#fef3c7', en: 'Limited', ja: '制限あり'  },
                      { status: 'out',     count: avIssues.filter(p => p.status === 'out').length,     color: '#dc2626', bg: '#fee2e2', en: 'Out',     ja: '練習不可'  },
                    ].map(s => (
                      <div key={s.status} className={styles.avCountBox} style={{ background: s.bg }}>
                        <span className={styles.avCountNum} style={{ color: s.color }}>{s.count}</span>
                        <span className={styles.avCountLabel} style={{ color: s.color }}>{lang === 'ja' ? s.ja : s.en}</span>
                      </div>
                    ))}
                  </div>
                  {avIssues.length === 0 ? (
                    <EmptyState>✓ {lang === 'ja' ? '全員が練習可' : 'All players available'}</EmptyState>
                  ) : (
                    <div className={styles.alertSection}>
                      <SectionLabel>⚠️ {lang === 'ja' ? '要注意' : 'Alerts'}</SectionLabel>
                      {avIssues.map(p => {
                        const isOut = p.status === 'out';
                        const color = isOut ? '#dc2626' : '#d97706';
                        const bg    = isOut ? '#fee2e2' : '#fef3c7';
                        const label = isOut ? (lang === 'ja' ? '練習不可' : 'Out') : (lang === 'ja' ? '制限あり' : 'Limited');
                        return (
                          <div key={p.player_id} className={styles.alertItem} onClick={() => onNavigate('medical')} style={{ cursor: 'pointer' }}>
                            <span className={styles.alertDot} style={{ background: color }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div className={styles.alertText}>{p.player_name}</div>
                              {p.reason && <div className={styles.alertSub}>{p.reason}</div>}
                            </div>
                            <span className={styles.avStatusPill} style={{ color, background: bg }}>{label}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className={styles.cardFoot}>
                  <button className={styles.footBtn} onClick={() => onNavigate('medical')}>
                    {lang === 'ja' ? 'メディカルを開く →' : 'Open Medical →'}
                  </button>
                </div>
              </div>
            )}

            {/* Health & Performance */}
            {canSeeWellness && (
              <div className={styles.card}>
                <div className={styles.cardHead}>
                  <span className={styles.cardTitle}>
                    ⚠️ {lang === 'ja' ? '健康・パフォーマンスアラート' : 'Health & Performance'}
                    {(wellnessAlerts.length + acwrAlerts.length) > 0 && (
                      <span className={styles.countBadge}>{wellnessAlerts.length + acwrAlerts.length}</span>
                    )}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  {/* #2: Wellness progress bar */}
                  {wellnessProgress && (
                    <div className={styles.wellnessProgressWrap}>
                      <div className={styles.wellnessProgressLabel}>
                        <span>{lang === 'ja' ? 'ウェルネス提出' : 'Wellness submitted'}</span>
                        <strong>{wellnessProgress.submitted} / {wellnessProgress.total}</strong>
                      </div>
                      <div className={styles.wellnessProgressBar}>
                        <div className={styles.wellnessProgressFill}
                          style={{ width: wellnessProgress.total > 0 ? `${Math.round(wellnessProgress.submitted / wellnessProgress.total * 100)}%` : '0%' }} />
                      </div>
                    </div>
                  )}
                  {/* Nutrition submission counter */}
                  {nutritionProgress && (
                    <div className={styles.wellnessProgressWrap}>
                      <div className={styles.wellnessProgressLabel}>
                        <span>{lang === 'ja' ? '栄養提出' : 'Nutrition submitted'}</span>
                        <strong>{nutritionProgress.submitted} / {nutritionProgress.total}</strong>
                      </div>
                      <div className={styles.wellnessProgressBar}>
                        <div className={styles.wellnessProgressFill}
                          style={{ width: nutritionProgress.total > 0 ? `${Math.round(nutritionProgress.submitted / nutritionProgress.total * 100)}%` : '0%', background: '#d97706' }} />
                      </div>
                    </div>
                  )}

                  {wellnessAlerts.length === 0 && acwrAlerts.length === 0 ? (
                    <EmptyState>{lang === 'ja' ? '✓ アラートはありません。' : '✓ No alerts.'}</EmptyState>
                  ) : (
                    <>
                      {acwrAlerts.length > 0 && (
                        <div className={styles.alertSection}>
                          <SectionLabel>📊 {lang === 'ja' ? 'ACWR 負荷アラート' : 'ACWR Load Alert'}</SectionLabel>
                          {acwrAlerts.map(a => (
                            <div key={a.name} className={styles.alertItem} onClick={() => onNavigate('performance')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot} style={{ background: a.zone === 'highrisk' ? '#ef4444' : '#f59e0b' }} />
                              <div>
                                <div className={styles.alertText}>{a.name}</div>
                                <div className={styles.alertSub}>
                                  ACWR {a.acwr.toFixed(2)} — {a.zone === 'highrisk'
                                    ? (lang === 'ja' ? '🔴 リスク高 (>1.5)' : '🔴 High Risk (>1.5)')
                                    : (lang === 'ja' ? '🟡 注意 (1.3–1.5)' : '🟡 Caution (1.3–1.5)')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {wellnessToday.length > 0 && (
                        <div className={styles.alertSection}>
                          <SectionLabel>💪 {lang === 'ja' ? 'ウェルネス — 今日' : 'Wellness — Today'}</SectionLabel>
                          {wellnessToday.map(w => (
                            <div key={`${w.date}::${w.name}`} className={styles.alertItem} onClick={() => onNavigate('wellness')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot} style={{ background: '#ef4444' }} />
                              <div>
                                <div className={styles.alertText}>{w.name}</div>
                                <div className={styles.alertSub}>
                                  {w.scores.map(s => `${QUESTION_LABELS[s.key]?.[lang] ?? s.key}: ${s.score}`).join(' · ')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {wellnessYesterday.length > 0 && (
                        <div className={styles.alertSection}>
                          <SectionLabel>💪 {lang === 'ja' ? 'ウェルネス — 昨日' : 'Wellness — Yesterday'}</SectionLabel>
                          {wellnessYesterday.map(w => (
                            <div key={`${w.date}::${w.name}`} className={styles.alertItem} onClick={() => onNavigate('wellness')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot} style={{ background: '#f97316' }} />
                              <div>
                                <div className={styles.alertText}>{w.name}</div>
                                <div className={styles.alertSub}>
                                  {w.scores.map(s => `${QUESTION_LABELS[s.key]?.[lang] ?? s.key}: ${s.score}`).join(' · ')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className={styles.cardFoot}>
                  <button className={styles.footBtn} onClick={() => onNavigate('wellness')}>
                    {lang === 'ja' ? 'ウェルネスを開く →' : 'Wellness →'}
                  </button>
                  <button className={styles.footBtn} onClick={() => onNavigate('performance')}>
                    {lang === 'ja' ? 'パフォーマンス →' : 'Performance →'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom cards: Tasks | Messages | Announcements */}
          <div className={styles.cards}>

            {/* Tasks */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>
                  ✅ {lang === 'ja' ? 'マイタスク' : 'My Tasks'}
                  {visibleDashTasks.length > 0 && <span className={styles.countBadge}>{visibleDashTasks.length}</span>}
                </span>
              </div>
              <div className={styles.cardBody}>
                {isPlayer && playerUploadCounts && (
                  <div className={styles.uploadCounts}>
                    <span className={styles.uploadChip} title={lang === 'ja' ? '直近7日間の提出' : 'Submissions last 7 days'}>
                      🩺 {playerUploadCounts.wellness}/7
                    </span>
                    <span className={styles.uploadChip}>
                      🏋️ {playerUploadCounts.rpe} RPE
                    </span>
                    <span className={styles.uploadChip}>
                      🥗 {playerUploadCounts.nutrition} {lang === 'ja' ? '栄養' : 'Nutrition'}
                    </span>
                  </div>
                )}
                {visibleDashTasks.length === 0 ? (
                  <EmptyState>{lang === 'ja' ? '✓ 未完了のタスクはありません。' : '✓ No open tasks.'}</EmptyState>
                ) : (
                  <div className={styles.alertSection}>
                    {visibleDashTasks.map(t => (
                      <TaskItem key={t.id} task={t} lang={lang} priColor={TASK_PRI_COLOR[t.priority] ?? '#6b7280'} onNavigate={onNavigate} onDismiss={dismissTask} />
                    ))}
                  </div>
                )}
              </div>
              <div className={styles.cardFoot}>
                <button className={styles.footBtn} onClick={() => onNavigate('tasks')}>
                  {lang === 'ja' ? 'タスクを開く →' : 'Open Tasks →'}
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>
                  ✉️ {lang === 'ja' ? 'メッセージ' : 'Messages'}
                  {channelNames.length > 0 && <span className={styles.countBadgeBlue}>{channelNames.length}</span>}
                </span>
              </div>
              <div className={styles.cardBody}>
                {channelNames.length === 0 ? (
                  <EmptyState>{lang === 'ja' ? 'メッセージはまだありません。' : 'No messages yet.'}</EmptyState>
                ) : (
                  channelNames.map(ch => (
                    <div key={ch} className={styles.channelGroup}>
                      <div className={styles.channelName}>
                        <span className={styles.channelHash}>#</span>
                        {ch}
                      </div>
                      {channels[ch].map(msg => (
                        <div key={msg.id} className={styles.msgItem}>
                          <span className={styles.msgName}>{msg.user_name}:</span>
                          <span className={styles.msgContent}>{msg.content}</span>
                          <span className={styles.msgTime}>{timeAgo(msg.created_at, lang)}</span>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
              <div className={styles.cardFoot}>
                <button className={styles.footBtn} onClick={() => onNavigate('chat')}>
                  {lang === 'ja' ? 'チャットを開く →' : 'Open Chat →'}
                </button>
              </div>
            </div>

            {/* Announcements */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>
                  📢 {lang === 'ja' ? 'お知らせ' : 'Announcements'}
                  {visibleAnnouncements.length > 0 && <span className={styles.countBadgeGreen}>{visibleAnnouncements.length}</span>}
                </span>
              </div>
              <div className={styles.cardBody}>
                {visibleAnnouncements.length === 0 ? (
                  <EmptyState>{lang === 'ja' ? '新しいお知らせはありません。' : 'No new announcements.'}</EmptyState>
                ) : (
                  visibleAnnouncements.map(a => (
                    <AnnItem key={a.id} ann={a} lang={lang} onNavigate={onNavigate} onDismiss={dismissAnnouncement} />
                  ))
                )}
              </div>
              <div className={styles.cardFoot}>
                <button className={styles.footBtn} onClick={() => onNavigate('feed')}>
                  {lang === 'ja' ? 'すべて見る →' : 'View all →'}
                </button>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
