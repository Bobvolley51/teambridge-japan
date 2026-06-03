'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { computeEWMA } from '@/lib/acwr';
import { toJstDateStr } from '@/lib/date';
import styles from './PerformanceDashboard.module.css';
import VertDashboard from './VertDashboard';

const ZONES = [
  { id: 'low',      min: 0,   max: 0.8,  en: 'Low',       ja: '低負荷',    color: '#3b82f6', bg: '#eff6ff' },
  { id: 'optimal',  min: 0.8, max: 1.3,  en: 'Optimal',   ja: '最適',      color: '#10b981', bg: '#d1fae5' },
  { id: 'caution',  min: 1.3, max: 1.5,  en: 'Caution',   ja: '注意',      color: '#f59e0b', bg: '#fef3c7' },
  { id: 'highrisk', min: 1.5, max: 9999, en: 'High Risk', ja: 'リスク高',  color: '#ef4444', bg: '#fee2e2' },
];

const ZONE_RANGE = ['<0.8', '0.8–1.3', '1.3–1.5', '>1.5'];

function getZone(acwr) {
  return ZONES.find(z => acwr >= z.min && acwr < z.max) ?? ZONES[0];
}

function rpeColor(rpe) {
  if (rpe <= 3) return '#10b981';
  if (rpe <= 6) return '#f59e0b';
  return '#ef4444';
}

function energyColor(v) {
  if (v == null) return '#9ca3af';
  if (v >= 70) return '#10b981';
  if (v >= 40) return '#f59e0b';
  return '#ef4444';
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// computeEWMA imported from lib/acwr.js

export default function PerformanceDashboard({ lang, profile }) {
  const [tab,              setTab]              = useState('acwr');
  const [records,          setRecords]          = useState([]);
  const [vertRecords,      setVertRecords]      = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [showLegend,       setShowLegend]       = useState(false);
  const [expandedSession,  setExpandedSession]  = useState(null);
  const [expandedAcwr,     setExpandedAcwr]     = useState(null);
  const [playerProfiles,   setPlayerProfiles]   = useState({});  // user_id → profile
  const [positionFilter,   setPositionFilter]   = useState('');
  const [rpeCounter,       setRpeCounter]       = useState([]); // [{event, expected, submitted}]

  const POSITIONS = ['Setter', 'Outside Hitter', 'Opposite', 'Middle Blocker', 'Libero'];

  // Load player profiles once so all tabs can show proper names + jersey numbers
  useEffect(() => {
    supabase.from('profiles')
      .select('id, first_name, last_name, display_name, jersey_number, position')
      .eq('role', 'Player')
      .then(({ data }) => {
        const map = {};
        for (const p of (data ?? [])) map[p.id] = p;
        setPlayerProfiles(map);
      });
  }, []);

  // Full Latin name + jersey from profile; falls back to stored user_name
  function playerLabel(userId, fallbackName) {
    const p = playerProfiles[userId];
    if (!p) return fallbackName ?? '—';
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name || fallbackName;
    return p.jersey_number != null ? `#${p.jersey_number} ${name}` : name;
  }

  function playerPosition(userId) {
    return playerProfiles[userId]?.position ?? null;
  }

  const load = useCallback(async () => {
    setLoading(true);
    // 90 days: EWMA stabilises after ~28 days, extra history ensures accuracy
    const since = daysAgo(90).toISOString().slice(0, 10);
    const sessionsWindow = daysAgo(28).toISOString().slice(0, 10);
    const [rpeRes, vertRes] = await Promise.all([
      supabase.from('session_rpe').select('*').gte('event_date', since).in('event_category', ['Ball-Practice', 'Game']).order('event_date', { ascending: true }),
      supabase.from('vert_sessions').select('*').gte('session_date', sessionsWindow).order('session_date', { ascending: false }),
    ]);
    setRecords(rpeRes.data ?? []);
    setVertRecords(vertRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // RPE submission counter — today's Ball-Practice + Game events
  useEffect(() => {
    const fetchRpeCounter = async () => {
      const todayJst = toJstDateStr(new Date());
      // Today's events in JST: start_time between midnight JST (=prev-day 15:00 UTC) and next midnight JST
      const dayStartUtc = new Date(todayJst + 'T00:00:00Z').getTime() - 9 * 3600 * 1000;
      const dayEndUtc   = dayStartUtc + 24 * 3600 * 1000;

      const { data: events } = await supabase
        .from('events')
        .select('id, title, start_time, category')
        .in('category', ['Ball-Practice', 'Game'])
        .gte('start_time', new Date(dayStartUtc).toISOString())
        .lt('start_time',  new Date(dayEndUtc).toISOString())
        .order('start_time');

      if (!events?.length) { setRpeCounter([]); return; }

      const eventIds = events.map(e => e.id);

      // Expected: confirmed attendees (status='in' or null)
      const { data: participants } = await supabase
        .from('event_participants')
        .select('event_id, profile_id')
        .in('event_id', eventIds)
        .or('status.eq.in,status.is.null');

      // Submitted: RPE records for today's events
      const { data: submitted } = await supabase
        .from('session_rpe')
        .select('event_id, user_id, attended')
        .in('event_id', eventIds);

      const participantsByEvent = {};
      for (const p of (participants ?? [])) {
        participantsByEvent[p.event_id] = (participantsByEvent[p.event_id] ?? 0) + 1;
      }
      const submittedByEvent = {};
      for (const s of (submitted ?? [])) {
        // Only count actual submissions (attended=true or null means they rated it)
        if (s.attended !== false) {
          submittedByEvent[s.event_id] = (submittedByEvent[s.event_id] ?? 0) + 1;
        }
      }

      setRpeCounter(events.map(e => ({
        id:        e.id,
        title:     e.title,
        category:  e.category,
        startTime: e.start_time,
        expected:  participantsByEvent[e.id] ?? 0,
        submitted: submittedByEvent[e.id]    ?? 0,
      })));
    };
    fetchRpeCounter();
  }, []);

  // Build player map from all 90 days of data
  const playerMap = {};
  for (const r of records) {
    if (!playerMap[r.user_id]) playerMap[r.user_id] = { name: r.user_name, all: [] };
    playerMap[r.user_id].all.push(r);
  }

  const acwrRows = Object.entries(playerMap).map(([uid, p]) => {
    // EWMA uses all 90 days loaded
    const { acute, chronic, acwr } = computeEWMA(p.all);

    // Recent 7 sessions for the dot display (last 28 days window)
    const sessionsWindow = daysAgo(28).toISOString().slice(0, 10);
    const recent = [...p.all]
      .filter(s => s.event_date >= sessionsWindow)
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(-7);

    // Ball-practice extras (28-day window for relevance)
    const ballPract    = p.all.filter(s => s.event_date >= sessionsWindow && s.energy_level != null);
    const withFocus    = ballPract.filter(s => s.focus_level != null);
    const avgEnergy    = ballPract.length ? Math.round(ballPract.reduce((sum, s) => sum + s.energy_level, 0) / ballPract.length) : null;
    const avgFocus     = withFocus.length ? Math.round(withFocus.reduce((sum, s) => sum + s.focus_level,  0) / withFocus.length)  : null;
    const mindfulYes   = ballPract.filter(s => s.mindfulness === true).length;
    const mindfulTotal = ballPract.filter(s => s.mindfulness != null).length;
    const goalYes      = ballPract.filter(s => s.practice_goal_reached === true).length;
    const goalTotal    = ballPract.filter(s => s.practice_goal_reached != null).length;

    return { uid, name: p.name, acute, chronic, acwr, recent, avgEnergy, avgFocus, mindfulYes, mindfulTotal, goalYes, goalTotal };
  });

  acwrRows.sort((a, b) => (b.acwr ?? -1) - (a.acwr ?? -1));
  const filteredAcwrRows = positionFilter ? acwrRows.filter(row => playerPosition(row.uid) === positionFilter) : acwrRows;
  const hasExtraData = acwrRows.some(r => r.avgEnergy != null || r.avgFocus != null);

  return (
    <div className={styles.wrapper}>

      <div className={styles.topBar}>
        <div className={styles.heading}>
          {lang === 'ja' ? 'パフォーマンス / ACWR' : 'Performance / ACWR'}
        </div>
        <div className={styles.tabs}>
          {[
            { id: 'acwr',       en: 'ACWR Overview', ja: 'ACWR 概要'      },
            { id: 'vert',       en: 'VERT Jumps',    ja: 'VERT ジャンプ'  },
            { id: 'sessions',   en: 'Sessions',      ja: 'セッション'     },
          ].map(t => (
            <button key={t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
              onClick={() => setTab(t.id)}>
              {lang === 'ja' ? t.ja : t.en}
            </button>
          ))}
        </div>
        <button className={styles.refreshBtn} onClick={load} title="Refresh">↻</button>
      </div>

      {/* Position filter — shown on ACWR and Sessions tabs */}
      {(tab === 'acwr' || tab === 'sessions') && (
        <div className={styles.filterBar}>
          <span className={styles.filterLabel}>{lang === 'ja' ? 'ポジション' : 'Position'}</span>
          <div className={styles.filterBtns}>
            <button className={`${styles.filterBtn} ${!positionFilter ? styles.filterBtnActive : ''}`}
              onClick={() => setPositionFilter('')}>
              {lang === 'ja' ? '全員' : 'All'}
            </button>
            {POSITIONS.map(pos => (
              <button key={pos}
                className={`${styles.filterBtn} ${positionFilter === pos ? styles.filterBtnActive : ''}`}
                onClick={() => setPositionFilter(p => p === pos ? '' : pos)}>
                {pos}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RPE Submission Counter — today's events */}
      {rpeCounter.length > 0 && (
        <div className={styles.rpeCounterCard}>
          <div className={styles.rpeCounterTitle}>
            📋 {lang === 'ja' ? '本日の RPE 提出状況' : "Today's RPE Submissions"}
          </div>
          <div className={styles.rpeCounterRow}>
            {rpeCounter.map(ev => {
              const pct      = ev.expected > 0 ? ev.submitted / ev.expected : 0;
              const complete  = ev.submitted >= ev.expected && ev.expected > 0;
              const missing   = Math.max(0, ev.expected - ev.submitted);
              const timeStr   = new Date(ev.startTime).toLocaleTimeString(
                lang === 'ja' ? 'ja-JP' : 'en-GB',
                { hour: '2-digit', minute: '2-digit' }
              );
              return (
                <div key={ev.id} className={`${styles.rpeEventChip} ${complete ? styles.rpeEventChipDone : missing > 0 ? styles.rpeEventChipMissing : styles.rpeEventChipPending}`}>
                  <div className={styles.rpeEventName}>
                    {ev.category === 'Game' ? '🏐' : '🏋️'} {ev.title}
                    <span className={styles.rpeEventTime}>{timeStr}</span>
                  </div>
                  <div className={styles.rpeEventCount}>
                    <span className={styles.rpeSubmitted}>{ev.submitted}</span>
                    <span className={styles.rpeSlash}>/</span>
                    <span className={styles.rpeExpected}>{ev.expected}</span>
                    {missing > 0 && (
                      <span className={styles.rpeMissing}>
                        {lang === 'ja' ? `残${missing}名` : `${missing} missing`}
                      </span>
                    )}
                    {complete && <span className={styles.rpeDone}>✓</span>}
                  </div>
                  {ev.expected > 0 && (
                    <div className={styles.rpeBar}>
                      <div className={styles.rpeBarFill} style={{ width: `${Math.min(pct * 100, 100)}%`, background: complete ? '#10b981' : '#f59e0b' }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ACWR alert banner — shown whenever at-risk players exist */}
      {!loading && (() => {
        const highRisk = acwrRows.filter(r => r.acwr != null && r.acwr > 1.5);
        const caution  = acwrRows.filter(r => r.acwr != null && r.acwr > 1.3 && r.acwr <= 1.5);
        const lowLoad  = acwrRows.filter(r => r.acwr != null && r.acwr < 0.8 && r.acwr > 0);
        if (highRisk.length === 0 && caution.length === 0) return null;
        return (
          <div className={styles.alarmBanner}>
            <div className={styles.alarmTitle}>
              ⚠️ {lang === 'ja' ? 'ACWR アラート' : 'ACWR Alert'}
            </div>
            {highRisk.length > 0 && (
              <div className={styles.alarmGroup}>
                <span className={styles.alarmZone} style={{ color: '#ef4444' }}>
                  🔴 {lang === 'ja' ? 'リスク高 (>1.5)' : 'High Risk (>1.5)'}
                </span>
                {highRisk.map(r => (
                  <span key={r.uid} className={styles.alarmPlayer}>
                    {playerLabel(r.uid, r.name)} — ACWR {r.acwr?.toFixed(2)}
                  </span>
                ))}
              </div>
            )}
            {caution.length > 0 && (
              <div className={styles.alarmGroup}>
                <span className={styles.alarmZone} style={{ color: '#f59e0b' }}>
                  🟡 {lang === 'ja' ? '注意 (1.3–1.5)' : 'Caution (1.3–1.5)'}
                </span>
                {caution.map(r => (
                  <span key={r.uid} className={styles.alarmPlayer}>
                    {playerLabel(r.uid, r.name)} — ACWR {r.acwr?.toFixed(2)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {tab !== 'vert' && tab !== 'sessions' && <div className={styles.content}>
        {loading ? (
          <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>

        ) : tab === 'acwr' ? (
          acwrRows.length === 0 ? (
            <div className={styles.empty}>
              {lang === 'ja' ? 'まだセッションデータがありません' : 'No session data yet — players submit RPE after Ball Practice / Game events'}
            </div>
          ) : (
            <>
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                      <th className={styles.th}>{lang === 'ja' ? '急性負荷\n(EWMA 7d)' : 'Acute\n(EWMA)'}</th>
                      <th className={styles.th}>{lang === 'ja' ? '慢性負荷\n(EWMA 28d)' : 'Chronic\n(EWMA)'}</th>
                      <th className={styles.th}>ACWR</th>
                      <th className={styles.th}>{lang === 'ja' ? 'ステータス' : 'Status'}</th>
                      <th className={styles.th}>{lang === 'ja' ? '直近RPE' : 'Recent RPE'}</th>
                      {hasExtraData && <th className={styles.th}>{lang === 'ja' ? 'Energy\n(直近)' : 'Energy\n(recent)'}</th>}
                      {hasExtraData && <th className={styles.th}>{lang === 'ja' ? 'Focus\n(直近)' : 'Focus\n(recent)'}</th>}
                      {hasExtraData && <th className={styles.th}>{lang === 'ja' ? '集中\n(直近)' : 'Mindful\n(recent)'}</th>}
                      {hasExtraData && <th className={styles.th}>{lang === 'ja' ? '目標\n(直近)' : 'Goal\n(recent)'}</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAcwrRows.map(row => {
                      const zone    = row.acwr != null ? getZone(row.acwr) : null;
                      const open    = expandedAcwr === row.uid;
                      const allSess = [...(playerMap[row.uid]?.all ?? [])]
                        .sort((a, b) => b.event_date.localeCompare(a.event_date));
                      return (
                        <>
                          <tr key={row.uid}
                            className={`${styles.tr} ${styles.trClickable}`}
                            onClick={() => setExpandedAcwr(open ? null : row.uid)}>
                            <td className={styles.tdName}>
                              <span className={styles.acwrCaret}>{open ? '▾' : '▸'}</span>
                              {playerLabel(row.uid, row.name)}
                            </td>
                            <td className={styles.td}>{row.acute}</td>
                            <td className={styles.td}>{row.chronic}</td>
                            <td className={styles.td}>
                              {row.acwr != null
                                ? <span className={styles.acwrVal} style={{ color: zone?.color }}>
                                    {row.acwr.toFixed(2)}
                                  </span>
                                : <span className={styles.noData}>—</span>}
                            </td>
                            <td className={styles.td}>
                              {zone
                                ? <span className={styles.zoneBadge}
                                    style={{ color: zone.color, background: zone.bg, borderColor: zone.color }}>
                                    {zone[lang]}
                                  </span>
                                : <span className={styles.noData}>—</span>}
                            </td>
                            <td className={styles.td}>
                              {/* RPE dots — colored */}
                              <div className={styles.dotRow}>
                                {row.recent.map((s, i) => (
                                  <span key={i} className={styles.rpeDot}
                                    style={{ background: rpeColor(s.rpe) }}
                                    title={`${s.event_title} — RPE ${s.rpe} (${s.load_au} AU)`} />
                                ))}
                              </div>
                            </td>
                            {hasExtraData && (
                              <td className={styles.td}>
                                {row.recent.some(s => s.energy_level != null) ? (
                                  <div className={styles.dotRow}>
                                    {row.recent.map((s, i) => (
                                      s.energy_level != null
                                        ? <span key={i} className={styles.rpeDot}
                                            style={{ background: energyColor(s.energy_level) }}
                                            title={`Energy ${s.energy_level}`} />
                                        : <span key={i} className={styles.rpeDotEmpty} />
                                    ))}
                                  </div>
                                ) : <span className={styles.noData}>—</span>}
                              </td>
                            )}
                            {hasExtraData && (
                              <td className={styles.td}>
                                {row.recent.some(s => s.focus_level != null) ? (
                                  <div className={styles.dotRow}>
                                    {row.recent.map((s, i) => (
                                      s.focus_level != null
                                        ? <span key={i} className={styles.rpeDot}
                                            style={{ background: energyColor(s.focus_level) }}
                                            title={`Focus ${s.focus_level}`} />
                                        : <span key={i} className={styles.rpeDotEmpty} />
                                    ))}
                                  </div>
                                ) : <span className={styles.noData}>—</span>}
                              </td>
                            )}
                            {hasExtraData && (
                              <td className={styles.td}>
                                {row.recent.some(s => s.mindfulness != null) ? (
                                  <div className={styles.dotRow}>
                                    {row.recent.map((s, i) => (
                                      s.mindfulness != null
                                        ? <span key={i} className={styles.boolMark}
                                            style={{ color: s.mindfulness ? '#10b981' : '#ef4444' }}>
                                            {s.mindfulness ? '✓' : '✗'}
                                          </span>
                                        : <span key={i} className={styles.rpeDotEmpty} />
                                    ))}
                                  </div>
                                ) : <span className={styles.noData}>—</span>}
                              </td>
                            )}
                            {hasExtraData && (
                              <td className={styles.td}>
                                {row.recent.some(s => s.practice_goal_reached != null) ? (
                                  <div className={styles.dotRow}>
                                    {row.recent.map((s, i) => (
                                      s.practice_goal_reached != null
                                        ? <span key={i} className={styles.boolMark}
                                            style={{ color: s.practice_goal_reached ? '#10b981' : '#ef4444' }}>
                                            {s.practice_goal_reached ? '✓' : '✗'}
                                          </span>
                                        : <span key={i} className={styles.rpeDotEmpty} />
                                    ))}
                                  </div>
                                ) : <span className={styles.noData}>—</span>}
                              </td>
                            )}
                          </tr>
                          {open && (
                            <tr key={`${row.uid}-detail`} className={styles.trDetail}>
                              <td colSpan={6 + (hasExtraData ? 4 : 0)} className={styles.tdDetail}>
                                <table className={styles.detailTable}>
                                  <thead>
                                    <tr>
                                      <th className={styles.detailTh}>{lang === 'ja' ? '日付' : 'Date'}</th>
                                      <th className={styles.detailTh}>{lang === 'ja' ? 'セッション' : 'Session'}</th>
                                      <th className={styles.detailTh}>RPE</th>
                                      <th className={styles.detailTh}>{lang === 'ja' ? '時間' : 'Min'}</th>
                                      <th className={styles.detailTh}>{lang === 'ja' ? '負荷 AU' : 'Load AU'}</th>
                                      {hasExtraData && <th className={styles.detailTh}>Energy</th>}
                                      {hasExtraData && <th className={styles.detailTh}>Focus</th>}
                                      {hasExtraData && <th className={styles.detailTh}>{lang === 'ja' ? '集中' : 'Mindful'}</th>}
                                      {hasExtraData && <th className={styles.detailTh}>{lang === 'ja' ? '目標' : 'Goal'}</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {allSess.map((s, i) => (
                                      <tr key={i} className={styles.detailTr}>
                                        <td className={styles.detailTd}>{s.event_date}</td>
                                        <td className={styles.detailTd}>{s.event_title ?? '—'}</td>
                                        <td className={styles.detailTdC}>
                                          <span className={styles.rpeBadge} style={{ background: rpeColor(s.rpe), color: '#fff' }}>{s.rpe}</span>
                                        </td>
                                        <td className={styles.detailTdC}>{s.duration_min ?? <span className={styles.noData}>—</span>}</td>
                                        <td className={styles.detailTdC}><span className={styles.loadNum}>{s.load_au}</span></td>
                                        {hasExtraData && (
                                          <td className={styles.detailTdC}>
                                            {s.energy_level != null
                                              ? <span className={styles.extraStatVal} style={{ color: energyColor(s.energy_level) }}>{s.energy_level}</span>
                                              : <span className={styles.noData}>—</span>}
                                          </td>
                                        )}
                                        {hasExtraData && (
                                          <td className={styles.detailTdC}>
                                            {s.focus_level != null
                                              ? <span className={styles.extraStatVal} style={{ color: energyColor(s.focus_level) }}>{s.focus_level}</span>
                                              : <span className={styles.noData}>—</span>}
                                          </td>
                                        )}
                                        {hasExtraData && (
                                          <td className={styles.detailTdC}>
                                            {s.mindfulness === true  ? <span className={styles.checkYes}>✓</span>
                                           : s.mindfulness === false ? <span className={styles.checkNo}>✗</span>
                                           : <span className={styles.noData}>—</span>}
                                          </td>
                                        )}
                                        {hasExtraData && (
                                          <td className={styles.detailTdC}>
                                            {s.practice_goal_reached === true  ? <span className={styles.checkYes}>✓</span>
                                           : s.practice_goal_reached === false ? <span className={styles.checkNo}>✗</span>
                                           : <span className={styles.noData}>—</span>}
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className={styles.legendRow}>
                <div className={styles.legendChips}>
                  {ZONES.map((z, i) => (
                    <span key={z.id} className={styles.legendChip}
                      style={{ color: z.color, background: z.bg, borderColor: z.color }}>
                      {z[lang]} {ZONE_RANGE[i]}
                    </span>
                  ))}
                </div>
                <button className={styles.legendToggle} onClick={() => setShowLegend(v => !v)}>
                  {showLegend ? (lang === 'ja' ? '閉じる ▲' : 'Hide legend ▲') : (lang === 'ja' ? '凡例を表示 ▼' : 'Show legend ▼')}
                </button>
              </div>

              {showLegend && (
                <div className={styles.legendPanel}>
                  <div className={styles.legendPanelTitle}>
                    {lang === 'ja' ? 'ACWR（急性慢性負荷比）とは？' : 'What is ACWR (Acute:Chronic Workload Ratio)?'}
                  </div>
                  <p className={styles.legendPanelDesc}>
                    {lang === 'ja'
                      ? 'EWMA方式：急性負荷 = 毎日 sRPE×0.25 + 前日×0.75（7日減衰）。慢性負荷 = 毎日 sRPE×0.069 + 前日×0.931（28日減衰）。休養日は sRPE=0 として計算。ACWR = 急性 ÷ 慢性。負荷AU = RPE × 練習時間（分）。'
                      : 'EWMA method (Gabbett 2016): Acute = sRPE×0.25 + prev×0.75 (7-day decay). Chronic = sRPE×0.069 + prev×0.931 (28-day decay). Rest days count as sRPE=0. ACWR = Acute ÷ Chronic. Load (AU) = RPE × duration (min).'}
                  </p>
                  <table className={styles.legendTable}>
                    <thead>
                      <tr>
                        <th>{lang === 'ja' ? 'ゾーン' : 'Zone'}</th>
                        <th>ACWR</th>
                        <th>{lang === 'ja' ? '意味' : 'Meaning'}</th>
                        <th>{lang === 'ja' ? '対応' : 'Action'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { zone: ZONES[0], meaning: lang === 'ja' ? '負荷不足 — パフォーマンス低下リスク' : 'Under-trained — risk of deconditioning', action: lang === 'ja' ? '負荷を増やす' : 'Increase load gradually' },
                        { zone: ZONES[1], meaning: lang === 'ja' ? '最適ゾーン — 負傷リスク最小' : 'Sweet spot — lowest injury risk',        action: lang === 'ja' ? '維持する'   : 'Maintain current load' },
                        { zone: ZONES[2], meaning: lang === 'ja' ? '注意 — 負傷リスク上昇'         : 'Caution — elevated injury risk',         action: lang === 'ja' ? '負荷を調整' : 'Monitor & reduce if needed' },
                        { zone: ZONES[3], meaning: lang === 'ja' ? '危険 — 負傷リスク大幅上昇'     : 'Danger — significantly elevated injury risk', action: lang === 'ja' ? '負荷を下げる' : 'Reduce load immediately' },
                      ].map(({ zone, meaning, action }) => (
                        <tr key={zone.id}>
                          <td><span className={styles.legendChip} style={{ color: zone.color, background: zone.bg, borderColor: zone.color }}>{zone[lang]}</span></td>
                          <td className={styles.legendRange}>{ZONE_RANGE[ZONES.indexOf(zone)]}</td>
                          <td>{meaning}</td>
                          <td className={styles.legendAction}>{action}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className={styles.legendRpeDots}>
                    <span className={styles.legendRpeTitle}>{lang === 'ja' ? '直近RPEドット:' : 'Recent RPE dots:'}</span>
                    {[['#10b981', lang === 'ja' ? '低 (1–3)' : 'Low (1–3)'], ['#f59e0b', lang === 'ja' ? '中 (4–6)' : 'Moderate (4–6)'], ['#ef4444', lang === 'ja' ? '高 (7–10)' : 'High (7–10)']].map(([color, label]) => (
                      <span key={color} className={styles.legendRpeItem}>
                        <span className={styles.rpeDotSample} style={{ background: color }} />
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )

        ) : null}
      </div>}

      {tab === 'sessions' && (loading ? (
        <div className={styles.sessionList}>
          <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>
        </div>
      ) : (() => {
          // VERT lookup: user_id|date → vert record
          const vertByKey = {};
          for (const v of vertRecords) {
            vertByKey[`${v.user_id}|${v.session_date}`] = v;
          }

          // Group RPE records by date + event title; attach VERT per player
          const sessionMap = {};
          for (const r of records) {
            const key = `${r.event_date}|${r.event_title ?? ''}`;
            if (!sessionMap[key]) sessionMap[key] = { date: r.event_date, title: r.event_title ?? '—', players: [] };
            sessionMap[key].players.push({
              ...r,
              vert: vertByKey[`${r.user_id}|${r.event_date}`] ?? null,
            });
          }
          const sessions = Object.values(sessionMap).sort((a, b) => b.date.localeCompare(a.date));
          const hasVert = sessions.some(s => s.players.some(p => p.vert));

          return sessions.length === 0 ? (
            <div className={styles.empty}>
              {lang === 'ja' ? 'まだセッションデータがありません' : 'No session data yet — players submit RPE after Ball Practice / Game events'}
            </div>
          ) : (
            <div className={styles.sessionList}>
              {sessions.map(s => {
                const key  = `${s.date}|${s.title}`;
                const open = expandedSession === key;
                const rpes = s.players.map(p => p.rpe);
                const avgRpe  = (rpes.reduce((a, b) => a + b, 0) / rpes.length);
                const minRpe  = Math.min(...rpes);
                const maxRpe  = Math.max(...rpes);
                const avgLoad = Math.round(s.players.reduce((sum, p) => sum + (p.load_au ?? 0), 0) / s.players.length);
                const filteredPlayers = positionFilter ? s.players.filter(p => playerPosition(p.user_id) === positionFilter) : s.players;
                const sorted  = [...filteredPlayers].sort((a, b) => b.rpe - a.rpe);
                const hasExtraSess = s.players.some(p => p.energy_level != null || p.focus_level != null);
                const playersWithEnergy = s.players.filter(p => p.energy_level != null);
                const playersWithFocus  = s.players.filter(p => p.focus_level  != null);
                const avgEnergy = playersWithEnergy.length ? Math.round(playersWithEnergy.reduce((sum, p) => sum + p.energy_level, 0) / playersWithEnergy.length) : null;
                const avgFocus  = playersWithFocus.length  ? Math.round(playersWithFocus.reduce((sum, p) => sum + p.focus_level,  0) / playersWithFocus.length)  : null;
                const mindfulYes = s.players.filter(p => p.mindfulness === true).length;
                const goalYes    = s.players.filter(p => p.practice_goal_reached === true).length;
                const mindfulTotal = s.players.filter(p => p.mindfulness != null).length;
                const goalTotal    = s.players.filter(p => p.practice_goal_reached != null).length;

                return (
                  <div key={key} className={styles.sessionCard}>
                    <button
                      className={`${styles.sessionHeader} ${open ? styles.sessionHeaderOpen : ''}`}
                      onClick={() => setExpandedSession(open ? null : key)}>
                      {/* Row 1: title + caret */}
                      <div className={styles.sessTopRow}>
                        <span className={styles.sessDate}>{s.date}</span>
                        <span className={styles.sessTitle}>{s.title}</span>
                        <span className={styles.sessCount}>{s.players.length} {lang === 'ja' ? '名' : 'players'}</span>
                        <span className={styles.sessCaret}>{open ? '▲' : '▼'}</span>
                      </div>
                      {/* Row 2: stat pills */}
                      <div className={styles.sessStats}>
                        <div className={styles.sessStat}>
                          <span className={styles.sessStatLabel}>{lang === 'ja' ? '平均 RPE' : 'Avg RPE'}</span>
                          <span className={styles.sessStatVal} style={{ color: rpeColor(avgRpe) }}>{avgRpe.toFixed(1)}</span>
                        </div>
                        <div className={styles.sessStat}>
                          <span className={styles.sessStatLabel}>{lang === 'ja' ? 'RPE 範囲' : 'RPE Range'}</span>
                          <span className={styles.sessStatVal}>
                            <span style={{ color: rpeColor(minRpe) }}>{minRpe}</span>
                            <span className={styles.sessRange}>–</span>
                            <span style={{ color: rpeColor(maxRpe) }}>{maxRpe}</span>
                          </span>
                        </div>
                        <div className={styles.sessStat}>
                          <span className={styles.sessStatLabel}>{lang === 'ja' ? '平均負荷' : 'Avg Load'}</span>
                          <span className={styles.sessStatVal}>{avgLoad}<span className={styles.sessAu}> AU</span></span>
                        </div>
                        {hasExtraSess && avgEnergy != null && (
                          <div className={styles.sessStat}>
                            <span className={styles.sessStatLabel}>{lang === 'ja' ? 'エネルギー' : 'Energy'}</span>
                            <span className={styles.sessStatVal} style={{ color: energyColor(avgEnergy) }}>{avgEnergy}</span>
                          </div>
                        )}
                        {hasExtraSess && avgFocus != null && (
                          <div className={styles.sessStat}>
                            <span className={styles.sessStatLabel}>{lang === 'ja' ? 'フォーカス' : 'Focus'}</span>
                            <span className={styles.sessStatVal} style={{ color: energyColor(avgFocus) }}>{avgFocus}</span>
                          </div>
                        )}
                        {hasExtraSess && goalTotal > 0 && (
                          <div className={styles.sessStat}>
                            <span className={styles.sessStatLabel}>{lang === 'ja' ? '目標達成' : 'Goal ✓'}</span>
                            <span className={styles.sessStatVal} style={{ color: '#10b981' }}>{goalYes}/{goalTotal}</span>
                          </div>
                        )}
                      </div>
                    </button>

                    {open && (
                      <div className={styles.sessDetail}>
                        <table className={styles.sessTable}>
                          <thead>
                            <tr>
                              <th className={styles.sessThName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                              <th className={styles.sessTh}>RPE</th>
                              <th className={styles.sessTh}>{lang === 'ja' ? '時間' : 'Min'}</th>
                              <th className={styles.sessTh}>{lang === 'ja' ? '負荷 AU' : 'Load AU'}</th>
                              {hasExtraSess && <th className={styles.sessThDiv} />}
                              {hasExtraSess && <th className={styles.sessTh}>{lang === 'ja' ? 'Energy' : 'Energy'}</th>}
                              {hasExtraSess && <th className={styles.sessTh}>{lang === 'ja' ? 'Focus' : 'Focus'}</th>}
                              {hasExtraSess && <th className={styles.sessTh}>{lang === 'ja' ? '集中' : 'Mindful'}</th>}
                              {hasExtraSess && <th className={styles.sessTh}>{lang === 'ja' ? '目標' : 'Goal'}</th>}
                              {hasVert && <th className={styles.sessThDiv} />}
                              {hasVert && <th className={styles.sessTh}>{lang === 'ja' ? 'ジャンプ' : 'Jumps'}</th>}
                              {hasVert && <th className={styles.sessTh}>{lang === 'ja' ? '最高跳躍' : 'Hi Jump'}</th>}
                              {hasVert && <th className={styles.sessTh}>{lang === 'ja' ? '着地%' : 'Elev%'}</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((p, i) => {
                              const v = p.vert;
                              const elevPct = v?.elevated_pct;
                              const elevClass = elevPct == null ? '' : elevPct >= 20 ? styles.cellRed : elevPct >= 10 ? styles.cellAmber : styles.cellGreen;
                              return (
                                <tr key={i} className={styles.sessTr}>
                                  <td className={styles.sessTdName}>{playerLabel(p.user_id, p.user_name)}</td>
                                  <td className={styles.sessTd}>
                                    <span className={styles.rpeBadge} style={{ background: rpeColor(p.rpe), color: '#fff' }}>{p.rpe}</span>
                                  </td>
                                  <td className={styles.sessTd}>{p.duration_min ?? <span className={styles.noData}>—</span>}</td>
                                  <td className={styles.sessTd}><span className={styles.loadNum}>{p.load_au}</span></td>
                                  {hasExtraSess && <td className={styles.sessTdDiv} />}
                                  {hasExtraSess && (
                                    <td className={styles.sessTd}>
                                      {p.energy_level != null
                                        ? <span className={styles.extraStatVal} style={{ color: energyColor(p.energy_level) }}>{p.energy_level}</span>
                                        : <span className={styles.noData}>—</span>}
                                    </td>
                                  )}
                                  {hasExtraSess && (
                                    <td className={styles.sessTd}>
                                      {p.focus_level != null
                                        ? <span className={styles.extraStatVal} style={{ color: energyColor(p.focus_level) }}>{p.focus_level}</span>
                                        : <span className={styles.noData}>—</span>}
                                    </td>
                                  )}
                                  {hasExtraSess && (
                                    <td className={styles.sessTd}>
                                      {p.mindfulness === true  ? <span className={styles.checkYes}>✓</span>
                                     : p.mindfulness === false ? <span className={styles.checkNo}>✗</span>
                                     : <span className={styles.noData}>—</span>}
                                    </td>
                                  )}
                                  {hasExtraSess && (
                                    <td className={styles.sessTd}>
                                      {p.practice_goal_reached === true  ? <span className={styles.checkYes}>✓</span>
                                     : p.practice_goal_reached === false ? <span className={styles.checkNo}>✗</span>
                                     : <span className={styles.noData}>—</span>}
                                    </td>
                                  )}
                                  {hasVert && <td className={styles.sessTdDiv} />}
                                  {hasVert && <td className={styles.sessTd}>{v?.jumps ?? <span className={styles.noData}>—</span>}</td>}
                                  {hasVert && <td className={styles.sessTd}>{v?.avg_hi_jump_cm != null ? `${v.avg_hi_jump_cm} cm` : <span className={styles.noData}>—</span>}</td>}
                                  {hasVert && <td className={`${styles.sessTd} ${elevClass}`}>{elevPct != null ? `${elevPct}%` : <span className={styles.noData}>—</span>}</td>}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })())}

      {tab === 'vert' && (
        <VertDashboard lang={lang} profile={profile} />
      )}



    </div>
  );
}
