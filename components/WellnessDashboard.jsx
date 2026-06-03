'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toJstDateStr, toJstDateStart, dateToYmd } from '@/lib/date';
import AvatarPhoto from './AvatarPhoto';
import styles from './WellnessDashboard.module.css';

const POSITIONS = ['Setter', 'Outside Hitter', 'Opposite', 'Middle Blocker', 'Libero'];

// ── Constants ─────────────────────────────────────────────────

const QUESTIONS = [
  { key: 'physical_readiness', en: 'Physical',  ja: '身体' },
  { key: 'mental_readiness',   en: 'Mental',    ja: 'メンタル' },
  { key: 'sleep_quality',      en: 'Sleep Q.',  ja: '睡眠質' },
];

const MAIN_KEYS = new Set(QUESTIONS.map(q => q.key));

const FEVER_THRESHOLD = 37.0;

const BODY_PARTS = [
  { key: 'shoulder_l',  en: 'Left Shoulder',   ja: '左肩' },
  { key: 'shoulder_r',  en: 'Right Shoulder',  ja: '右肩' },
  { key: 'lower_back',  en: 'Lower Back',      ja: '腰' },
  { key: 'knee_l',      en: 'Left Knee',       ja: '左膝' },
  { key: 'knee_r',      en: 'Right Knee',      ja: '右膝' },
  { key: 'ankle_l',     en: 'Left Ankle',      ja: '左足首' },
  { key: 'ankle_r',     en: 'Right Ankle',     ja: '右足首' },
  { key: 'quad_l',      en: 'Left Quad',       ja: '左大腿四頭筋' },
  { key: 'quad_r',      en: 'Right Quad',      ja: '右大腿四頭筋' },
  { key: 'hamstring_l', en: 'Left Hamstring',  ja: '左ハムストリングス' },
  { key: 'hamstring_r', en: 'Right Hamstring', ja: '右ハムストリングス' },
];

const ILLNESS_SYMPTOMS = [
  { key: 'illness_headache',   en: 'Headache',          ja: '頭痛' },
  { key: 'illness_fever',      en: 'Fever',             ja: '発熱' },
  { key: 'illness_sorethroat', en: 'Sore throat',       ja: '喉の痛み' },
  { key: 'illness_cough',      en: 'Cough',             ja: '咳' },
  { key: 'illness_runnynose',  en: 'Runny nose',        ja: '鼻水' },
  { key: 'illness_nausea',     en: 'Nausea',            ja: '吐き気' },
  { key: 'illness_malaise',    en: 'Fatigue / Malaise', ja: '倦怠感' },
  { key: 'illness_other',      en: 'Other',             ja: 'その他' },
];

const DAY_LABELS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ja: ['月', '火', '水', '木', '金', '土', '日'],
};

// ── Helpers ───────────────────────────────────────────────────

function toDateStr(d) {
  return dateToYmd(d);
}

function getPeriodStart(days, offset = 0) {
  const d = toJstDateStart(new Date());
  d.setDate(d.getDate() - (days - 1) + offset * 7);
  return d;
}

function colorOf(score) {
  if (score == null) return '#d1d5db';
  if (score < 40)    return '#ef4444';
  if (score < 60)    return '#f59e0b';
  return '#10b981';
}

function tempColor(val) {
  if (val == null || val <= FEVER_THRESHOLD) return null;
  return val >= 38.0 ? '#ef4444' : '#f59e0b';
}

function avg(arr) {
  const v = arr.filter(x => x != null && !isNaN(x));
  return v.length ? parseFloat((v.reduce((s, x) => s + x, 0) / v.length).toFixed(1)) : null;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return toDateStr(d);
}

function prevWeekStartOf(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 7);
  return getWeekStart(toDateStr(d));
}

function sleepHourColor(h) {
  if (h == null) return '#d1d5db';
  if (h >= 7)    return '#10b981';
  if (h === 6)   return '#f59e0b';
  return '#ef4444';
}

function availColor(v) {
  if (v == null) return '#d1d5db';
  if (v >= 100)  return '#10b981';
  if (v >= 50)   return '#f59e0b';
  return '#ef4444';
}

function availLabel(v, lang) {
  if (v == null) return '—';
  if (v >= 100)  return lang === 'ja' ? '全力' : 'Full';
  if (v >= 50)   return lang === 'ja' ? '制限' : 'Ltd';
  return lang === 'ja' ? '不可' : 'Out';
}

// ── Player Heatmap ────────────────────────────────────────────

function PlayerHeatmap({ players, dates, playerDayMap, weekRows, lang }) {
  return (
    <div className={styles.hmWrap}>
      <table className={styles.hmTable}>
        <thead>
          <tr>
            <th className={styles.hmNameHead}>{lang === 'ja' ? '選手' : 'Player'}</th>
            {dates.map(ds => {
              const d   = new Date(ds + 'T00:00:00');
              const dow = (d.getDay() + 6) % 7;
              return (
                <th key={ds} className={styles.hmDateHead}>
                  <div className={styles.hmDow}>{DAY_LABELS[lang][dow]}</div>
                  <div className={styles.hmDd}>{`${d.getMonth()+1}/${d.getDate()}`}</div>
                </th>
              );
            })}
            <th className={styles.hmAvgHead}>{lang === 'ja' ? '平均' : 'Avg'}</th>
          </tr>
        </thead>
        <tbody>
          {players.map(name => {
            const dayScores = dates.map(ds => {
              const scores = playerDayMap[name]?.[ds] ?? [];
              return scores.length ? avg(scores) : null;
            });
            const playerAvg = avg(dayScores.filter(s => s != null));
            return (
              <tr key={name} className={styles.hmRow}>
                <td className={styles.hmNameCell}>{name}</td>
                {dayScores.map((score, i) => (
                  <td key={dates[i]} className={styles.hmCell}
                    style={{ background: score != null ? colorOf(score) : '#f3f4f6', color: score != null ? '#fff' : '#d1d5db' }}>
                    {score != null ? score : '·'}
                  </td>
                ))}
                <td className={styles.hmAvgCell} style={{ color: playerAvg != null ? colorOf(playerAvg) : '#9ca3af' }}>
                  <strong>{playerAvg ?? '—'}</strong>
                </td>
              </tr>
            );
          })}
          <tr className={styles.hmTeamRow}>
            <td className={styles.hmNameCell}><em>{lang === 'ja' ? 'チーム' : 'Team'}</em></td>
            {dates.map(ds => {
              const dayRows = weekRows.filter(r => MAIN_KEYS.has(r.question_key) && r.response_date === ds);
              const score   = dayRows.length ? avg(dayRows.map(r => r.score)) : null;
              return (
                <td key={ds} className={styles.hmCell}
                  style={{ background: score != null ? colorOf(score) : '#f3f4f6', color: score != null ? '#fff' : '#d1d5db' }}>
                  {score != null ? score : '·'}
                </td>
              );
            })}
            <td className={styles.hmAvgCell} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Score Badge ───────────────────────────────────────────────

function ScoreBadge({ score, alarm }) {
  if (score == null) return <span className={styles.noData}>—</span>;
  return (
    <span className={styles.badge} style={{ background: colorOf(score) }}>
      {alarm && <span className={styles.alarmPip}>!</span>}
      {score}
    </span>
  );
}

function TempBadge({ val }) {
  const tc = tempColor(val);
  if (tc == null) return <span className={styles.noData}>—</span>;
  return (
    <span className={styles.badge} style={{ background: tc, fontSize: '11px' }}>
      🌡 {val?.toFixed(1)}°C
    </span>
  );
}

function SleepBadge({ hours }) {
  if (hours == null) return <span className={styles.noData}>—</span>;
  const c = sleepHourColor(hours);
  return (
    <span className={styles.badge} style={{ background: c }}>
      {hours}h
    </span>
  );
}

function AvailBadge({ value, lang }) {
  if (value == null) return <span className={styles.noData}>—</span>;
  const c = availColor(value);
  return (
    <span className={styles.badge} style={{ background: c, fontSize: '11px' }}>
      {availLabel(value, lang)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function WellnessDashboard({ lang }) {
  const todayStr = toJstDateStr(new Date());

  const [tab,        setTab]        = useState('today');
  const [date,       setDate]       = useState(todayStr);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDays,   setWeekDays]   = useState(7);
  const [viewMode,   setViewMode]   = useState('heatmap');
  const [rows,       setRows]       = useState([]);
  const [weekRows,   setWeekRows]   = useState([]);
  const [todayPain,  setTodayPain]  = useState([]);
  const [weekPain,   setWeekPain]   = useState([]);
  const [bwRows,     setBwRows]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [profiles,      setProfiles]      = useState([]);
  const [positionFilter, setPositionFilter] = useState('');

  const loadToday = useCallback(async () => {
    setLoading(true);
    const curWeek  = getWeekStart(date);
    const prevWeek = prevWeekStartOf(date);
    const [{ data }, { data: pain }, { data: bw }] = await Promise.all([
      supabase.from('wellness_responses').select('*').eq('response_date', date).order('user_name'),
      supabase.from('wellness_body_pain').select('user_name, body_part, pain_level').eq('response_date', date),
      supabase.from('player_bodyweight').select('user_name, weight_kg, week_start').in('week_start', [curWeek, prevWeek]),
    ]);
    setRows(data ?? []);
    setTodayPain(pain ?? []);
    setBwRows(bw ?? []);
    setLoading(false);
  }, [date]);

  const loadWeek = useCallback(async () => {
    setLoading(true);
    const ws = getPeriodStart(weekDays, weekOffset);
    const dates = Array.from({ length: weekDays }, (_, i) => {
      const d = new Date(ws); d.setDate(d.getDate() + i); return toDateStr(d);
    });
    const curWeek  = getWeekStart(dates[0]);
    const prevWeek = prevWeekStartOf(dates[0]);
    const [{ data }, { data: pain }, { data: bw }] = await Promise.all([
      supabase.from('wellness_responses').select('*').in('response_date', dates).order('user_name'),
      supabase.from('wellness_body_pain').select('user_name, body_part, pain_level, response_date').in('response_date', dates),
      supabase.from('player_bodyweight').select('user_name, weight_kg, week_start').in('week_start', [curWeek, prevWeek]),
    ]);
    setWeekRows(data ?? []);
    setWeekPain(pain ?? []);
    setBwRows(bw ?? []);
    setLoading(false);
  }, [weekOffset, weekDays]);

  useEffect(() => {
    if (tab === 'today') loadToday(); else loadWeek();
  }, [tab, loadToday, loadWeek]);

  useEffect(() => {
    supabase.from('profiles').select('id, first_name, last_name, display_name, email, avatar_url, jersey_number, position')
      .eq('role', 'Player').then(({ data }) => setProfiles(data ?? []));
  }, []);

  // display_name → profile map for quick lookup
  const profileByNickname = useMemo(() => {
    const m = {};
    for (const p of profiles) {
      const n = p.display_name || p.email;
      if (n) m[n] = p;
    }
    return m;
  }, [profiles]);

  // display_name → avatar_url map for quick lookup
  const avatarByName = useMemo(() => {
    const m = {};
    for (const p of profiles) {
      const n = p.display_name || p.email;
      if (n) m[n] = p.avatar_url ?? null;
    }
    return m;
  }, [profiles]);

  // Returns "#jersey FirstName LastName" for a display_name (nickname) key
  function nameLabel(nickname) {
    const p = profileByNickname[nickname];
    if (!p) return nickname ?? '—';
    const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name || nickname;
    return p.jersey_number != null ? `#${p.jersey_number} ${name}` : name;
  }

  const bwMap = {};
  for (const r of bwRows) {
    if (!bwMap[r.user_name]) bwMap[r.user_name] = {};
    bwMap[r.user_name][r.week_start] = parseFloat(r.weight_kg);
  }
  const todayCurWeek  = getWeekStart(date);
  const todayPrevWeek = prevWeekStartOf(date);

  const ws          = getPeriodStart(weekDays, weekOffset);
  const weekDates0  = toDateStr(ws);
  const weekCurWeek  = getWeekStart(weekDates0);
  const weekPrevWeek = prevWeekStartOf(weekDates0);

  // ── Today ──────────────────────────────────────────────────
  const todayPlayers = {};
  for (const r of rows) {
    if (!todayPlayers[r.user_name]) todayPlayers[r.user_name] = {};
    todayPlayers[r.user_name][r.question_key] = r.score;
  }
  const todayListAll = Object.entries(todayPlayers);
  const todayList    = positionFilter
    ? todayListAll.filter(([name]) => profileByNickname[name]?.position === positionFilter)
    : todayListAll;
  const alarmedToday = [...new Set(rows.filter(r => MAIN_KEYS.has(r.question_key) && r.score < 40).map(r => r.user_name))];

  // ── Week ───────────────────────────────────────────────────
  const weekDates = Array.from({ length: weekDays }, (_, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i); return toDateStr(d);
  });

  const playerDayMap = {};
  for (const r of weekRows) {
    if (!MAIN_KEYS.has(r.question_key)) continue;
    if (!playerDayMap[r.user_name]) playerDayMap[r.user_name] = {};
    if (!playerDayMap[r.user_name][r.response_date]) playerDayMap[r.user_name][r.response_date] = [];
    playerDayMap[r.user_name][r.response_date].push(r.score);
  }
  const heatmapPlayers = Object.keys(playerDayMap).sort((a, b) => {
    const aAvg = avg(Object.values(playerDayMap[a]).flat()) ?? 100;
    const bAvg = avg(Object.values(playerDayMap[b]).flat()) ?? 100;
    return aAvg - bAvg;
  });

  const weekPlayers = {};
  for (const r of weekRows) {
    if (!weekPlayers[r.user_name]) weekPlayers[r.user_name] = {};
    if (!weekPlayers[r.user_name][r.question_key]) weekPlayers[r.user_name][r.question_key] = [];
    weekPlayers[r.user_name][r.question_key].push(r.score);
  }
  const weekPlayerListAll = Object.entries(weekPlayers).map(([name, qs]) => ({
    name,
    avgs:       Object.fromEntries(QUESTIONS.map(q => [q.key, avg(qs[q.key] ?? [])])),
    sleepHours: avg(qs['sleep_hours'] ?? []),
    avail:      avg(qs['availability'] ?? []),
  }));
  const weekPlayerList = positionFilter
    ? weekPlayerListAll.filter(p => profileByNickname[p.name]?.position === positionFilter)
    : weekPlayerListAll;

  const alarmedWeek = [...new Set(weekRows.filter(r => MAIN_KEYS.has(r.question_key) && r.score < 40).map(r => r.user_name))];
  const weekLabel   = `${weekDates[0]} – ${weekDates[weekDates.length - 1]}`;

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>

      <div className={styles.topBar}>
        <div className={styles.heading}>
          💪 {lang === 'ja' ? 'ウェルネス チェックイン' : 'Wellness Check-in'}
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'today' ? styles.tabActive : ''}`} onClick={() => setTab('today')}>
            {lang === 'ja' ? '今日' : 'Today'}
          </button>
          <button className={`${styles.tab} ${tab === 'week' ? styles.tabActive : ''}`} onClick={() => setTab('week')}>
            {lang === 'ja' ? '直近7日' : 'Last 7 Days'}
          </button>
        </div>
      </div>

      {/* ════ TODAY ════ */}
      {tab === 'today' && (
        <div className={styles.content}>
          <div className={styles.controls}>
            <input type="date" className={styles.datePicker} value={date} onChange={e => setDate(e.target.value)} />
          </div>

          {/* Alerts block — low scores + pain together at the top */}
          {(alarmedToday.length > 0 || todayPain.length > 0) && (
            <div className={styles.alertsBlock}>
              {alarmedToday.length > 0 && (
                <div className={styles.alarm}>
                  ⚠️&nbsp;{lang === 'ja' ? `低スコア検出 — ${alarmedToday.map(n => nameLabel(n)).join('、')}` : `Low score alert — ${alarmedToday.map(n => nameLabel(n)).join(', ')}`}
                </div>
              )}
              {todayPain.length > 0 && (
                <div className={styles.painSection}>
                  <div className={styles.painTitle}>
                    🩹 {lang === 'ja' ? '報告された痛み・張り' : 'Reported Pain / Tightness'}
                  </div>
                  {Object.entries(
                    todayPain.reduce((acc, r) => {
                      if (!acc[r.user_name]) acc[r.user_name] = [];
                      acc[r.user_name].push(r);
                      return acc;
                    }, {})
                  ).map(([name, entries]) => (
                    <div key={name} className={styles.painRow}>
                      <span className={styles.painName}>{nameLabel(name)}</span>
                      <div className={styles.painParts}>
                        {entries.map(r => {
                          const label     = BODY_PARTS.find(b => b.key === r.body_part);
                          const chipLabel = label ? (lang === 'ja' ? label.ja : label.en) : r.body_part;
                          const isIllness = r.body_part?.startsWith('illness_');
                          const sym = ILLNESS_SYMPTOMS.find(s => s.key === r.body_part);
                          const illnessLabel = sym ? (lang === 'ja' ? sym.ja : sym.en) : r.body_part;
                          const displayLabel = isIllness ? `🤒 ${illnessLabel}` : chipLabel;
                          const lvl = r.pain_level;
                          const chipColor = isIllness ? '#f97316'
                            : lvl == null ? '#9ca3af'
                            : lvl >= 60 ? '#ef4444'
                            : lvl >= 30 ? '#f59e0b'
                            : '#10b981';
                          return (
                            <span key={r.body_part} className={styles.painChip}
                              style={{ background: chipColor + '20', color: chipColor, borderColor: chipColor }}>
                              {displayLabel}{lvl != null && !isIllness ? ` ${lvl}/100` : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.filterBar}>
            <span className={styles.filterLabel}>{lang === 'ja' ? 'ポジション' : 'Position'}</span>
            <div className={styles.filterBtns}>
              <button className={`${styles.filterBtn} ${!positionFilter ? styles.filterBtnActive : ''}`} onClick={() => setPositionFilter('')}>
                {lang === 'ja' ? '全員' : 'All'}
              </button>
              {POSITIONS.map(pos => (
                <button key={pos} className={`${styles.filterBtn} ${positionFilter === pos ? styles.filterBtnActive : ''}`} onClick={() => setPositionFilter(p => p === pos ? '' : pos)}>
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {loading
            ? <p className={styles.hint}>{lang === 'ja' ? '読込中…' : 'Loading…'}</p>
            : todayList.length === 0
              ? <p className={styles.hint}>{lang === 'ja' ? 'この日のデータはありません。' : 'No check-ins for this date.'}</p>
              : (() => {
                  const hasAnyFever = todayList.some(([, qs]) => tempColor(qs['temperature']) != null);
                  return (
                    <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                          {QUESTIONS.map(q => <th key={q.key} className={styles.th}>{lang === 'ja' ? q.ja : q.en}</th>)}
                          <th className={styles.th}>{lang === 'ja' ? '睡眠時間' : 'Sleep'}</th>
                          <th className={styles.th}>{lang === 'ja' ? '参加' : 'Avail'}</th>
                          {hasAnyFever && <th className={styles.th}>🌡</th>}
                          <th className={styles.th}>{lang === 'ja' ? '体重' : 'Weight'}</th>
                          <th className={styles.th}>{lang === 'ja' ? '平均' : 'Avg'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {todayList.map(([name, qs]) => {
                          const mainScores = QUESTIONS.map(q => qs[q.key]);
                          const a          = avg(mainScores);
                          const curBw      = bwMap[name]?.[todayCurWeek];
                          const prevBw     = bwMap[name]?.[todayPrevWeek];
                          const pct        = curBw && prevBw ? ((curBw - prevBw) / prevBw * 100).toFixed(1) : null;
                          return (
                            <tr key={name} className={styles.tr}>
                              <td className={styles.tdName}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <AvatarPhoto
                                    url={avatarByName[name]}
                                    initials={name.slice(0, 2)}
                                    name={name}
                                    size={28}
                                  />
                                  <span>{nameLabel(name)}</span>
                                </div>
                              </td>
                              {QUESTIONS.map(q => (
                                <td key={q.key} className={`${styles.td} ${qs[q.key] != null && qs[q.key] < 40 ? styles.lowCell : ''}`}>
                                  <ScoreBadge score={qs[q.key]} alarm={qs[q.key] != null && qs[q.key] < 40} />
                                </td>
                              ))}
                              <td className={styles.td}>
                                <SleepBadge hours={qs['sleep_hours']} />
                              </td>
                              <td className={styles.td}>
                                <AvailBadge value={qs['availability']} lang={lang} />
                              </td>
                              {hasAnyFever && (
                                <td className={`${styles.td} ${tempColor(qs['temperature']) === '#ef4444' ? styles.lowCell : ''}`}>
                                  <TempBadge val={qs['temperature']} />
                                </td>
                              )}
                              <td className={styles.td}>
                                {curBw != null
                                  ? <div className={styles.bwCell}>
                                      <span className={styles.bwValue}>{curBw} kg</span>
                                      {pct !== null && (
                                        <span className={styles.bwChange}>
                                          {parseFloat(pct) > 0 ? '↑' : parseFloat(pct) < 0 ? '↓' : '→'} {Math.abs(pct)}%
                                        </span>
                                      )}
                                    </div>
                                  : <span className={styles.noData}>—</span>
                                }
                              </td>
                              <td className={styles.td}>
                                <span className={styles.avgText} style={{ color: colorOf(a) }}>{a ?? '—'}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className={styles.footRow}>
                          <td className={styles.tdName}><strong>{lang === 'ja' ? 'チーム平均' : 'Team avg'}</strong></td>
                          {QUESTIONS.map(q => {
                            const a = avg(rows.filter(r => r.question_key === q.key).map(r => r.score));
                            return (
                              <td key={q.key} className={styles.td}>
                                <span className={styles.avgText} style={{ color: colorOf(a) }}>{a ?? '—'}</span>
                              </td>
                            );
                          })}
                          <td className={styles.td} />
                          <td className={styles.td} />
                          {hasAnyFever && <td className={styles.td} />}
                          <td className={styles.td} />
                          <td className={styles.td} />
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                  );
                })()
          }

          {todayList.length > 0 && (
            <div className={styles.chartLegend} style={{ marginTop: 8 }}>
              <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#10b981' }} />{lang === 'ja' ? '良好 60–100' : 'Good 60–100'}</span>
              <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#f59e0b' }} />{lang === 'ja' ? '注意 40–59' : 'Moderate 40–59'}</span>
              <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#ef4444' }} />{lang === 'ja' ? '警告 <40 ⚠️' : 'Alert <40 ⚠️'}</span>
              <span className={styles.legendScale}>{lang === 'ja' ? 'スケール：0（低）→ 100（高）' : 'Scale: 0 (low) → 100 (high)'}</span>
            </div>
          )}

        </div>
      )}

      {/* ════ THIS WEEK ════ */}
      {tab === 'week' && (
        <div className={styles.content}>
          <div className={styles.controls}>
            <button className={styles.navBtn} onClick={() => setWeekOffset(w => w - 1)}>‹</button>
            <span className={styles.weekLabel}>{weekLabel}</span>
            <button className={styles.navBtn} onClick={() => setWeekOffset(w => w + 1)} disabled={weekOffset >= 0}>›</button>
            {weekOffset < 0 && (
              <button className={styles.currentWeekBtn} onClick={() => setWeekOffset(0)}>
                {lang === 'ja' ? '最新' : 'Latest'}
              </button>
            )}
            <div className={styles.dayRangeBtns}>
              {[7, 14].map(d => (
                <button key={d}
                  className={`${styles.dayRangeBtn} ${weekDays === d ? styles.dayRangeBtnActive : ''}`}
                  onClick={() => { setWeekDays(d); setWeekOffset(0); }}>
                  {d}{lang === 'ja' ? '日' : 'd'}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.viewToggleTabs}>
            <button className={`${styles.viewToggleTab} ${viewMode === 'heatmap' ? styles.viewToggleTabActive : ''}`}
              onClick={() => setViewMode('heatmap')}>
              🗓 {lang === 'ja' ? 'ヒートマップ' : 'Heatmap'}
            </button>
            <button className={`${styles.viewToggleTab} ${viewMode === 'values' ? styles.viewToggleTabActive : ''}`}
              onClick={() => setViewMode('values')}>
              📋 {lang === 'ja' ? '詳細数値' : 'Detailed Values'}
            </button>
          </div>

          <div className={styles.filterBar}>
            <span className={styles.filterLabel}>{lang === 'ja' ? 'ポジション' : 'Position'}</span>
            <div className={styles.filterBtns}>
              <button className={`${styles.filterBtn} ${!positionFilter ? styles.filterBtnActive : ''}`} onClick={() => setPositionFilter('')}>
                {lang === 'ja' ? '全員' : 'All'}
              </button>
              {POSITIONS.map(pos => (
                <button key={pos} className={`${styles.filterBtn} ${positionFilter === pos ? styles.filterBtnActive : ''}`} onClick={() => setPositionFilter(p => p === pos ? '' : pos)}>
                  {pos}
                </button>
              ))}
            </div>
          </div>

          {alarmedWeek.length > 0 && (
            <div className={styles.alarm}>
              ⚠️&nbsp;{lang === 'ja' ? `今週の低スコア — ${alarmedWeek.map(n => nameLabel(n)).join('、')}` : `Low scores (last 7 days) — ${alarmedWeek.map(n => nameLabel(n)).join(', ')}`}
            </div>
          )}

          {loading
            ? <p className={styles.hint}>{lang === 'ja' ? '読込中…' : 'Loading…'}</p>
            : weekRows.length === 0
              ? <p className={styles.hint}>{lang === 'ja' ? 'この週のデータはありません。' : 'No check-ins for this week.'}</p>
              : (
                <div className={styles.weekContent}>

                  {viewMode === 'heatmap' && (
                    <div className={styles.chartCard}>
                      <div className={styles.chartTitle}>
                        {lang === 'ja' ? '選手別 ウェルネス ヒートマップ' : 'Player Wellness Heatmap'}
                        <span className={styles.hmSubtitle}>
                          {lang === 'ja' ? '（身体・メンタル・睡眠質の平均）' : '(avg of physical, mental & sleep quality)'}
                        </span>
                      </div>
                      <PlayerHeatmap
                        players={heatmapPlayers}
                        dates={weekDates}
                        playerDayMap={playerDayMap}
                        weekRows={weekRows}
                        lang={lang}
                      />
                      <div className={styles.chartLegend}>
                        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#10b981' }} />{lang === 'ja' ? '良好 60–100' : 'Good 60–100'}</span>
                        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#f59e0b' }} />{lang === 'ja' ? '注意 40–59' : 'Moderate 40–59'}</span>
                        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#ef4444' }} />{lang === 'ja' ? '警告 <40 ⚠️' : 'Alert <40 ⚠️'}</span>
                        <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#d1d5db' }} />{lang === 'ja' ? '未回答' : 'No data'}</span>
                        <span className={styles.legendScale}>{lang === 'ja' ? '最悪スコアの選手が上位' : 'Lowest avg shown first'}</span>
                      </div>
                    </div>
                  )}

                  {viewMode === 'values' && (
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                            {QUESTIONS.map(q => <th key={q.key} className={styles.th}>{lang === 'ja' ? q.ja : q.en}</th>)}
                            <th className={styles.th}>{lang === 'ja' ? '睡眠' : 'Sleep'}</th>
                            <th className={styles.th}>{lang === 'ja' ? '参加' : 'Avail'}</th>
                            <th className={styles.th}>{lang === 'ja' ? '体重' : 'Weight'}</th>
                            <th className={styles.th}>{lang === 'ja' ? '週平均' : 'Wk avg'}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weekPlayerList.map(({ name, avgs, sleepHours, avail }) => {
                            const overall = avg(QUESTIONS.map(q => avgs[q.key]));
                            const curBw   = bwMap[name]?.[weekCurWeek];
                            const prevBw  = bwMap[name]?.[weekPrevWeek];
                            const pct     = curBw && prevBw ? ((curBw - prevBw) / prevBw * 100).toFixed(1) : null;
                            return (
                              <tr key={name} className={styles.tr}>
                                <td className={styles.tdName}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AvatarPhoto url={avatarByName[name]} initials={name.slice(0, 2)} name={name} size={28} />
                                    <span>{nameLabel(name)}</span>
                                  </div>
                                </td>
                                {QUESTIONS.map(q => (
                                  <td key={q.key} className={`${styles.td} ${avgs[q.key] != null && avgs[q.key] < 40 ? styles.lowCell : ''}`}>
                                    <ScoreBadge score={avgs[q.key]} alarm={avgs[q.key] != null && avgs[q.key] < 40} />
                                  </td>
                                ))}
                                <td className={styles.td}>
                                  <SleepBadge hours={sleepHours != null ? Math.round(sleepHours) : null} />
                                </td>
                                <td className={styles.td}>
                                  <AvailBadge value={avail} lang={lang} />
                                </td>
                                <td className={styles.td}>
                                  {curBw != null
                                    ? <div className={styles.bwCell}>
                                        <span className={styles.bwValue}>{curBw} kg</span>
                                        {pct !== null && (
                                          <span className={styles.bwChange}>
                                            {parseFloat(pct) > 0 ? '↑' : parseFloat(pct) < 0 ? '↓' : '→'} {Math.abs(pct)}%
                                          </span>
                                        )}
                                      </div>
                                    : <span className={styles.noData}>—</span>
                                  }
                                </td>
                                <td className={styles.td}>
                                  <span className={styles.avgText} style={{ color: colorOf(overall) }}>{overall ?? '—'}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className={styles.footRow}>
                            <td className={styles.tdName}><strong>{lang === 'ja' ? 'チーム平均' : 'Team avg'}</strong></td>
                            {QUESTIONS.map(q => {
                              const a = avg(weekRows.filter(r => r.question_key === q.key).map(r => r.score));
                              return (
                                <td key={q.key} className={styles.td}>
                                  <span className={styles.avgText} style={{ color: colorOf(a) }}>{a ?? '—'}</span>
                                </td>
                              );
                            })}
                            <td className={styles.td} />
                            <td className={styles.td} />
                            <td className={styles.td} />
                            <td className={styles.td} />
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}

                  {viewMode === 'values' && weekPain.length > 0 && (() => {
                    const freq = weekPain.reduce((acc, r) => {
                      acc[r.body_part] = (acc[r.body_part] ?? 0) + 1;
                      return acc;
                    }, {});
                    const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
                    return (
                      <div className={styles.painSection}>
                        <div className={styles.painTitle}>
                          🩹 {lang === 'ja' ? '7日間の痛み・張り頻度' : 'Pain / Tightness Frequency (7 days)'}
                        </div>
                        <div className={styles.freqChips}>
                          {sorted.map(([key, count]) => {
                            const label   = BODY_PARTS.find(b => b.key === key);
                            const chipCls = count >= 3 ? styles.freqChipRed : count === 2 ? styles.freqChipOrange : styles.freqChipYellow;
                            return (
                              <span key={key} className={`${styles.freqChip} ${chipCls}`}>
                                {label ? (lang === 'ja' ? label.ja : label.en) : key}
                                <span className={styles.freqBadge}>{count}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              )
          }
        </div>
      )}

    </div>
  );
}
