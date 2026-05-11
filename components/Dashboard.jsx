'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/date';
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

const WELLNESS_ALERT_ROLES      = ['GM', 'Headcoach', 'Staff/Orga', 'Athletic', 'Therapist'];
const AVAILABILITY_VIEWER_ROLES = ['GM', 'Headcoach', 'Athletic', 'Therapist', 'Staff/Orga'];

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

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return <div className={styles.sectionLabel}>{children}</div>;
}

function EmptyState({ children }) {
  return <div className={styles.empty}>{children}</div>;
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
  const [events,          setEvents]          = useState([]);
  const [messages,        setMessages]        = useState([]);
  const [announcements,   setAnnouncements]   = useState([]);
  const [tasks,           setTasks]           = useState([]);
  const [wellnessAlerts,  setWellnessAlerts]  = useState([]);
  const [acwrAlerts,      setAcwrAlerts]      = useState([]); // { name, acwr, zone }
  const [overlapAlerts,   setOverlapAlerts]   = useState([]);
  const [calChanges,      setCalChanges]      = useState([]);
  const [availability,    setAvailability]    = useState([]);
  const [loading,         setLoading]         = useState(true);

  useEffect(() => { load(); }, [currentUserInitials, currentUserId, profile?.role]);

  async function load() {
    setLoading(true);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const todayDateStr = todayStart.toISOString().slice(0, 10);
    const yesterday = new Date(todayStart);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDateStr = yesterday.toISOString().slice(0, 10);

    const canSeeWellness      = WELLNESS_ALERT_ROLES.includes(profile?.role);
    const canSeeAvailability  = AVAILABILITY_VIEWER_ROLES.includes(profile?.role);

    const [
      { data: myPartsData },
      { data: msgData },
      { data: annData },
      { data: taskData },
      { data: wellData },
      { data: rpeData },
      { data: calChangeData },
      { data: avData },
    ] = await Promise.all([
      currentUserId
        ? supabase.from('event_participants')
            .select('status, events(id, title, start_time, end_time, all_day, category, location)')
            .eq('profile_id', currentUserId)
            .neq('status', 'out')
        : Promise.resolve({ data: [] }),
      supabase.from('messages')
        .select('id, channel, user_name, content, created_at')
        .order('created_at', { ascending: false })
        .limit(40),
      supabase.from('announcements')
        .select('id, title, content, priority, author_name, created_at')
        .order('created_at', { ascending: false })
        .limit(8),
      currentUserInitials
        ? supabase.from('tasks')
            .select('id, title, status, priority, created_at')
            .eq('assignee', currentUserInitials)
            .neq('status', 'done')
            .order('priority', { ascending: true })
            .order('created_at', { ascending: false })
            .limit(20)
        : Promise.resolve({ data: [] }),
      canSeeWellness
        ? supabase.from('wellness_responses')
            .select('user_name, question_key, score, response_date')
            .gte('response_date', yesterdayDateStr)
            .lt('score', 5)
            .order('response_date', { ascending: false })
            .order('user_name')
        : Promise.resolve({ data: [] }),
      canSeeWellness
        ? supabase.from('session_rpe')
            .select('user_id, user_name, event_date, load_au')
            .gte('event_date', (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0, 10); })())
        : Promise.resolve({ data: [] }),
      currentUserId
        ? supabase.from('notifications')
            .select('id, title, body, created_at, ref_id')
            .eq('user_id', currentUserId)
            .eq('type', 'calendar_change')
            .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] }),
      canSeeAvailability
        ? supabase.from('player_availability').select('*').order('player_name')
        : Promise.resolve({ data: [] }),
    ]);

    // Filter to events in the 7-day window
    const myEventsRaw = (myPartsData ?? [])
      .map(p => ({ ...p.events, _myStatus: p.status ?? 'in' }))
      .filter(ev => ev && new Date(ev.start_time) >= todayStart && new Date(ev.start_time) <= weekEnd);
    myEventsRaw.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    setEvents(myEventsRaw);

    // Overlap detection: find checked-in events that haven't ended yet and overlap
    const now = new Date();
    const futureEvs = (myPartsData ?? [])
      .map(p => p.events)
      .filter(ev => ev && !ev.all_day && new Date(ev.end_time) > now);
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
    setTasks(taskData ?? []);
    setCalChanges(calChangeData ?? []);

    // Group low-score responses by date + player name
    const warnMap = {};
    for (const r of (wellData ?? [])) {
      const mapKey = `${r.response_date}::${r.user_name}`;
      if (!warnMap[mapKey]) warnMap[mapKey] = { name: r.user_name, date: r.response_date, scores: [] };
      warnMap[mapKey].scores.push({ key: r.question_key, score: r.score });
    }
    setWellnessAlerts(Object.values(warnMap));

    // Compute ACWR per player from session_rpe data
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

    setAvailability(avData ?? []);
    setLoading(false);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const todayEnd  = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  const yesterdayDateStr = yest.toISOString().slice(0, 10);

  const todayEvents  = events.filter(ev => new Date(ev.start_time) <= todayEnd);
  const soonEvents   = events.filter(ev => new Date(ev.start_time) > todayEnd);

  const wellnessDoneToday = typeof window !== 'undefined'
    ? !!localStorage.getItem(`wellness_done_${currentUserId}_${todayDateStr}`)
    : true;

  const RSVP_LABEL = {
    in:    { en: '✓ In',    ja: '✓ 参加',  cls: 'rsvpIn' },
    maybe: { en: '? Maybe', ja: '? 未定',  cls: 'rsvpMaybe' },
    out:   { en: '✗ Out',   ja: '✗ 欠席',  cls: 'rsvpOut' },
  };
  const urgentTasks  = tasks.filter(t => t.priority === 'high');
  const weekTasks    = tasks.filter(t => t.priority !== 'high');
  const canSeeWellness      = WELLNESS_ALERT_ROLES.includes(profile?.role);
  const canSeeAvailability  = AVAILABILITY_VIEWER_ROLES.includes(profile?.role);
  const avIssues            = availability.filter(p => p.status !== 'full');
  const avFull              = availability.filter(p => p.status === 'full').length;

  const wellnessToday     = wellnessAlerts.filter(w => w.date === todayDateStr);
  const wellnessYesterday = wellnessAlerts.filter(w => w.date === yesterdayDateStr);

  // Messages: only show those newer than the last time user visited Chat
  const lastChatVisit = typeof window !== 'undefined'
    ? localStorage.getItem(`chat_last_visited_${currentUserId}`) || ''
    : '';

  // Announcements: only show those < 72h old and not dismissed
  const dismissedAnns = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem(`ann_dismissed_${currentUserId}`) || '[]')
    : [];
  const cutoff72h = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
  const visibleAnnouncements = announcements.filter(
    a => a.created_at >= cutoff72h && !dismissedAnns.includes(a.id)
  );

  const dismissAnnouncement = (id) => {
    const updated = [...dismissedAnns, id];
    localStorage.setItem(`ann_dismissed_${currentUserId}`, JSON.stringify(updated));
    setAnnouncements(prev => prev.filter(a => a.id !== id));
  };

  const dismissedCalChanges = typeof window !== 'undefined'
    ? JSON.parse(localStorage.getItem(`cal_changes_dismissed_${currentUserId}`) || '[]')
    : [];
  const visibleCalChanges = calChanges.filter(n => !dismissedCalChanges.includes(n.id));
  const dismissCalChange = (id) => {
    const updated = [...dismissedCalChanges, id];
    localStorage.setItem(`cal_changes_dismissed_${currentUserId}`, JSON.stringify(updated));
    setCalChanges(prev => prev.filter(n => n.id !== id));
  };

  // Group messages by channel, take 4 most recent per channel (exclude DMs, show only new)
  const channels = {};
  for (const msg of messages) {
    if (msg.channel?.startsWith('dm:')) continue;
    if (lastChatVisit && msg.created_at <= lastChatVisit) continue;
    if (!channels[msg.channel]) channels[msg.channel] = [];
    if (channels[msg.channel].length < 4) channels[msg.channel].push(msg);
  }
  const channelNames = Object.keys(channels);

  // Profile summary line
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

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* ── Schedule change banners ── */}
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

      {/* ── Missed wellness reminder ── */}
      {profile?.role === 'Player' && !wellnessDoneToday && onOpenWellness && (
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
          {/* ── Top row: Schedule | Availability | Health+Performance ── */}
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
                {todayEvents.length === 0 && soonEvents.length === 0 ? (
                  <EmptyState>{lang === 'ja' ? '今日の予定はありません。' : 'Nothing scheduled today.'}</EmptyState>
                ) : (
                  <>
                    {todayEvents.length > 0 && (
                      <div className={styles.alertSection}>
                        <SectionLabel>{lang === 'ja' ? '本日' : 'Today'}</SectionLabel>
                        {todayEvents.map(ev => {
                          const rsvp = RSVP_LABEL[ev._myStatus] ?? RSVP_LABEL.in;
                          return (
                            <div key={ev.id} className={styles.alertItem} onClick={() => onNavigate('calendar')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot} style={{ background: CAT_COLOR[ev.category] ?? '#6b7280' }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div className={styles.alertText}>{ev.title}</div>
                                <div className={styles.alertSub}>
                                  {fmtEventTime(ev, lang)}{ev.location ? ` · ${ev.location}` : ''}
                                </div>
                              </div>
                              <span className={`${styles.rsvpBadge} ${styles[rsvp.cls]}`}>
                                {lang === 'ja' ? rsvp.ja : rsvp.en}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {soonEvents.length > 0 && profile?.role !== 'Player' && (
                      <div className={styles.alertSection}>
                        <SectionLabel>{lang === 'ja' ? '今週' : 'This week'}</SectionLabel>
                        {soonEvents.slice(0, 6).map(ev => {
                          const d = new Date(ev.start_time);
                          return (
                            <div key={ev.id} className={styles.alertItem} onClick={() => onNavigate('calendar')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot} style={{ background: CAT_COLOR[ev.category] ?? '#6b7280' }} />
                              <div>
                                <div className={styles.alertText}>{ev.title}</div>
                                <div className={styles.alertSub}>
                                  {d.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  {!ev.all_day && ` · ${pad(d.getHours())}:${pad(d.getMinutes())}`}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
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
                  {/* Count row */}
                  <div className={styles.avCountRow}>
                    {[
                      { status: 'full',    count: avFull,                                            color: '#16a34a', bg: '#dcfce7', en: 'Full',    ja: '全体練習可' },
                      { status: 'limited', count: avIssues.filter(p => p.status === 'limited').length, color: '#d97706', bg: '#fef3c7', en: 'Limited', ja: '制限あり'  },
                      { status: 'out',     count: avIssues.filter(p => p.status === 'out').length,     color: '#dc2626', bg: '#fee2e2', en: 'Out',     ja: '練習不可'  },
                    ].map(s => (
                      <div key={s.status} className={styles.avCountBox} style={{ background: s.bg }}>
                        <span className={styles.avCountNum} style={{ color: s.color }}>{s.count}</span>
                        <span className={styles.avCountLabel} style={{ color: s.color }}>{lang === 'ja' ? s.ja : s.en}</span>
                      </div>
                    ))}
                  </div>
                  {/* Alert list */}
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

            {/* Wellness & Performance Alerts (role-gated) */}
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
                  {wellnessAlerts.length === 0 && acwrAlerts.length === 0 ? (
                    <EmptyState>{lang === 'ja' ? '✓ アラートはありません。' : '✓ No alerts.'}</EmptyState>
                  ) : (
                    <>
                      {/* ACWR alerts */}
                      {acwrAlerts.length > 0 && (
                        <div className={styles.alertSection}>
                          <SectionLabel>📊 {lang === 'ja' ? 'ACWR 負荷アラート' : 'ACWR Load Alert'}</SectionLabel>
                          {acwrAlerts.map(a => (
                            <div key={a.name} className={styles.alertItem}
                              onClick={() => onNavigate('performance')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot}
                                style={{ background: a.zone === 'highrisk' ? '#ef4444' : '#f59e0b' }} />
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
                      {/* Wellness alerts — today */}
                      {wellnessToday.length > 0 && (
                        <div className={styles.alertSection}>
                          <SectionLabel>💪 {lang === 'ja' ? 'ウェルネス — 今日' : 'Wellness — Today'}</SectionLabel>
                          {wellnessToday.map(w => (
                            <div key={`${w.date}::${w.name}`} className={styles.alertItem}
                              onClick={() => onNavigate('wellness')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot} style={{ background: '#ef4444' }} />
                              <div>
                                <div className={styles.alertText}>{w.name}</div>
                                <div className={styles.alertSub}>
                                  {w.scores.map(s =>
                                    `${QUESTION_LABELS[s.key]?.[lang] ?? s.key}: ${s.score}`
                                  ).join(' · ')}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {/* Wellness alerts — yesterday */}
                      {wellnessYesterday.length > 0 && (
                        <div className={styles.alertSection}>
                          <SectionLabel>💪 {lang === 'ja' ? 'ウェルネス — 昨日' : 'Wellness — Yesterday'}</SectionLabel>
                          {wellnessYesterday.map(w => (
                            <div key={`${w.date}::${w.name}`} className={styles.alertItem}
                              onClick={() => onNavigate('wellness')} style={{ cursor: 'pointer' }}>
                              <span className={styles.alertDot} style={{ background: '#f97316' }} />
                              <div>
                                <div className={styles.alertText}>{w.name}</div>
                                <div className={styles.alertSub}>
                                  {w.scores.map(s =>
                                    `${QUESTION_LABELS[s.key]?.[lang] ?? s.key}: ${s.score}`
                                  ).join(' · ')}
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

          {/* ── Bottom cards: Tasks | Messages | Announcements ── */}
          <div className={styles.cards}>

            {/* Tasks */}
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>
                  ✅ {lang === 'ja' ? 'マイタスク' : 'My Tasks'}
                  {tasks.length > 0 && <span className={styles.countBadge}>{tasks.length}</span>}
                </span>
              </div>
              <div className={styles.cardBody}>
                {tasks.length === 0 ? (
                  <EmptyState>{lang === 'ja' ? '✓ 未完了のタスクはありません。' : '✓ No open tasks.'}</EmptyState>
                ) : (
                  <>
                    {urgentTasks.length > 0 && (
                      <div className={styles.alertSection}>
                        <SectionLabel>{lang === 'ja' ? '🔴 今日の緊急タスク' : '🔴 Urgent today'}</SectionLabel>
                        {urgentTasks.map(t => (
                          <div key={t.id} className={styles.alertItem} onClick={() => onNavigate('tasks')} style={{ cursor: 'pointer' }}>
                            <span className={styles.alertDot} style={{ background: TASK_PRI_COLOR[t.priority] ?? '#6b7280' }} />
                            <div>
                              <div className={styles.alertText}>{t.title}</div>
                              <div className={styles.alertSub}>
                                {t.status === 'todo'
                                  ? (lang === 'ja' ? '未着手' : 'To do')
                                  : (lang === 'ja' ? '進行中' : 'In progress')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {weekTasks.length > 0 && (
                      <div className={styles.alertSection}>
                        <SectionLabel>{lang === 'ja' ? '📋 今週のタスク' : '📋 This week'}</SectionLabel>
                        {weekTasks.map(t => (
                          <div key={t.id} className={styles.alertItem} onClick={() => onNavigate('tasks')} style={{ cursor: 'pointer' }}>
                            <span className={styles.alertDot} style={{ background: TASK_PRI_COLOR[t.priority] ?? '#6b7280' }} />
                            <div>
                              <div className={styles.alertText}>{t.title}</div>
                              <div className={styles.alertSub}>
                                {t.status === 'todo'
                                  ? (lang === 'ja' ? '未着手' : 'To do')
                                  : (lang === 'ja' ? '進行中' : 'In progress')}
                                {t.priority === 'medium' ? ` · ${lang === 'ja' ? '中' : 'Medium'}` : ''}
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
                  visibleAnnouncements.map(a => {
                    const pri = PRI[a.priority] ?? PRI.medium;
                    return (
                      <div key={a.id} className={styles.annItem}>
                        <div className={styles.annItemTop}>
                          <span className={styles.annPriBadge}
                            style={{ background: pri.bg, border: `1px solid ${pri.border}`, color: pri.dot }}>
                            <span className={styles.annPriDot} style={{ background: pri.dot }} />
                            {pri[lang]}
                          </span>
                          <button className={styles.noticedBtn} onClick={() => dismissAnnouncement(a.id)}>
                            ✓ {lang === 'ja' ? '確認済み' : 'Noticed'}
                          </button>
                        </div>
                        <div className={styles.annTitle} onClick={() => onNavigate('feed')} style={{ cursor: 'pointer' }}>{a.title}</div>
                        <div className={styles.annContent}>{a.content}</div>
                        <div className={styles.annMeta}>{a.author_name} · {timeAgo(a.created_at, lang)}</div>
                      </div>
                    );
                  })
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
