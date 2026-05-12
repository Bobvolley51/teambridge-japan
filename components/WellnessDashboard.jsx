'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './WellnessDashboard.module.css';

// ── Constants ─────────────────────────────────────────────────

const QUESTIONS = [
  { key: 'fatigue',     en: 'Fatigue',      ja: '疲労' },
  { key: 'sleep',       en: 'Sleep',        ja: '睡眠' },
  { key: 'appetite',    en: 'Appetite',     ja: '食欲' },
  { key: 'temperature', en: 'Temperature',  ja: '体温' },
  { key: 'pain',        en: 'Body Pain',    ja: '痛み' },
];

const BODY_PARTS = [
  { key: 'shoulder_l',  en: 'Left Shoulder',   ja: '左肩' },
  { key: 'shoulder_r',  en: 'Right Shoulder',  ja: '右肩' },
  { key: 'lower_back',  en: 'Lower Back',       ja: '腰' },
  { key: 'knee_l',      en: 'Left Knee',        ja: '左膝' },
  { key: 'knee_r',      en: 'Right Knee',       ja: '右膝' },
  { key: 'ankle_l',     en: 'Left Ankle',       ja: '左足首' },
  { key: 'ankle_r',     en: 'Right Ankle',      ja: '右足首' },
  { key: 'quad_l',      en: 'Left Quad',        ja: '左大腿四頭筋' },
  { key: 'quad_r',      en: 'Right Quad',       ja: '右大腿四頭筋' },
  { key: 'hamstring_l', en: 'Left Hamstring',   ja: '左ハムストリングス' },
  { key: 'hamstring_r', en: 'Right Hamstring',  ja: '右ハムストリングス' },
];

const DAY_LABELS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ja: ['月', '火', '水', '木', '金', '土', '日'],
};

// ── Helpers ───────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function toDateStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getPeriodStart(days, offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1) + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function colorOf(score) {
  if (score == null) return '#d1d5db';
  if (score < 5)     return '#ef4444';
  if (score < 7)     return '#f59e0b';
  return '#10b981';
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
          {/* Team row */}
          <tr className={styles.hmTeamRow}>
            <td className={styles.hmNameCell}><em>{lang === 'ja' ? 'チーム' : 'Team'}</em></td>
            {dates.map(ds => {
              const dayRows = weekRows.filter(r => r.response_date === ds);
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

// ── Main Component ────────────────────────────────────────────

export default function WellnessDashboard({ lang, profile }) {
  const todayStr = toDateStr(new Date());

  const [tab,        setTab]        = useState('today');
  const [date,       setDate]       = useState(todayStr);
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekDays,   setWeekDays]   = useState(7);
  const [rows,       setRows]       = useState([]);
  const [weekRows,   setWeekRows]   = useState([]);
  const [todayPain,  setTodayPain]  = useState([]);
  const [weekPain,   setWeekPain]   = useState([]);
  const [bwRows,     setBwRows]     = useState([]);
  const [nutriRows,  setNutriRows]  = useState([]);
  const [loading,    setLoading]    = useState(true);

  // ── Load today ──────────────────────────────────────────────
  const loadToday = useCallback(async () => {
    setLoading(true);
    const curWeek  = getWeekStart(date);
    const prevWeek = prevWeekStartOf(date);
    const [{ data }, { data: pain }, { data: bw }] = await Promise.all([
      supabase.from('wellness_responses').select('*').eq('response_date', date).order('user_name'),
      supabase.from('wellness_body_pain').select('user_name, body_part').eq('response_date', date),
      supabase.from('player_bodyweight').select('user_name, weight_kg, week_start').in('week_start', [curWeek, prevWeek]),
    ]);
    setRows(data ?? []);
    setTodayPain(pain ?? []);
    setBwRows(bw ?? []);
    setLoading(false);
  }, [date]);

  // ── Load week ───────────────────────────────────────────────
  const loadWeek = useCallback(async () => {
    setLoading(true);
    const ws = getPeriodStart(weekDays, weekOffset);
    const dates = Array.from({ length: weekDays }, (_, i) => {
      const d = new Date(ws); d.setDate(d.getDate() + i); return toDateStr(d);
    });
    const curWeek  = getWeekStart(dates[0]);
    const prevWeek = prevWeekStartOf(dates[0]);
    const [{ data }, { data: pain }, { data: bw }, { data: nutri }] = await Promise.all([
      supabase.from('wellness_responses').select('*').in('response_date', dates).order('user_name'),
      supabase.from('wellness_body_pain').select('user_name, body_part, response_date').in('response_date', dates),
      supabase.from('player_bodyweight').select('user_name, weight_kg, week_start').in('week_start', [curWeek, prevWeek]),
      supabase.from('nutrition_entries').select('user_name, player_rating, meal_date').in('meal_date', dates),
    ]);
    setWeekRows(data ?? []);
    setWeekPain(pain ?? []);
    setBwRows(bw ?? []);
    setNutriRows(nutri ?? []);
    setLoading(false);
  }, [weekOffset, weekDays]);

  useEffect(() => {
    if (tab === 'today') loadToday(); else loadWeek();
  }, [tab, loadToday, loadWeek]);

  // ── Body weight map: { userName: { weekStart: weight_kg } } ─
  const bwMap = {};
  for (const r of bwRows) {
    if (!bwMap[r.user_name]) bwMap[r.user_name] = {};
    bwMap[r.user_name][r.week_start] = parseFloat(r.weight_kg);
  }
  const todayCurWeek  = getWeekStart(date);
  const todayPrevWeek = prevWeekStartOf(date);

  const ws         = getPeriodStart(weekDays, weekOffset);
  const weekDates0 = toDateStr(ws);
  const weekCurWeek  = getWeekStart(weekDates0);
  const weekPrevWeek = prevWeekStartOf(weekDates0);

  // ── Today: derived data ─────────────────────────────────────
  const todayPlayers = {};
  for (const r of rows) {
    if (!todayPlayers[r.user_name]) todayPlayers[r.user_name] = {};
    todayPlayers[r.user_name][r.question_key] = r.score;
  }
  const todayList    = Object.entries(todayPlayers);
  const alarmedToday = [...new Set(rows.filter(r => r.score < 5).map(r => r.user_name))];

  // ── Week: derived data ──────────────────────────────────────
  const weekDates = Array.from({ length: weekDays }, (_, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i); return toDateStr(d);
  });

  const dayLabel = (ds) => {
    const d = new Date(ds);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // Build player-day map for heatmap: { playerName: { dateStr: [scores] } }
  const playerDayMap = {};
  for (const r of weekRows) {
    if (!playerDayMap[r.user_name]) playerDayMap[r.user_name] = {};
    if (!playerDayMap[r.user_name][r.response_date]) playerDayMap[r.user_name][r.response_date] = [];
    playerDayMap[r.user_name][r.response_date].push(r.score);
  }
  // Sort players: worst overall average first (most concerning at top)
  const heatmapPlayers = Object.keys(playerDayMap).sort((a, b) => {
    const aAvg = avg(Object.values(playerDayMap[a]).flat()) ?? 10;
    const bAvg = avg(Object.values(playerDayMap[b]).flat()) ?? 10;
    return aAvg - bAvg;
  });

  const weekPlayers = {};
  for (const r of weekRows) {
    if (!weekPlayers[r.user_name]) weekPlayers[r.user_name] = {};
    if (!weekPlayers[r.user_name][r.question_key]) weekPlayers[r.user_name][r.question_key] = [];
    weekPlayers[r.user_name][r.question_key].push(r.score);
  }
  const weekPlayerList = Object.entries(weekPlayers).map(([name, qs]) => ({
    name,
    avgs: Object.fromEntries(QUESTIONS.map(q => [q.key, avg(qs[q.key] ?? [])])),
  }));

  const alarmedWeek  = [...new Set(weekRows.filter(r => r.score < 5).map(r => r.user_name))];
  const weekLabel    = `${weekDates[0]} – ${weekDates[weekDates.length - 1]}`;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>

      {/* Header */}
      <div className={styles.topBar}>
        <div className={styles.heading}>
          💪 {lang === 'ja' ? 'ウェルネス チェックイン' : 'Wellness Check-in'}
        </div>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab === 'today' ? styles.tabActive : ''}`}
            onClick={() => setTab('today')}>
            {lang === 'ja' ? '今日' : 'Today'}
          </button>
          <button className={`${styles.tab} ${tab === 'week' ? styles.tabActive : ''}`}
            onClick={() => setTab('week')}>
            {lang === 'ja' ? '直近7日' : 'Last 7 Days'}
          </button>
        </div>
      </div>

      {/* ════ TODAY ════ */}
      {tab === 'today' && (
        <div className={styles.content}>
          <div className={styles.controls}>
            <input type="date" className={styles.datePicker} value={date}
              onChange={e => setDate(e.target.value)} />
          </div>

          {alarmedToday.length > 0 && (
            <div className={styles.alarm}>
              ⚠️&nbsp;
              {lang === 'ja'
                ? `低スコア検出 — ${alarmedToday.join('、')}`
                : `Low score alert — ${alarmedToday.join(', ')}`}
            </div>
          )}

          {loading
            ? <p className={styles.hint}>{lang === 'ja' ? '読込中…' : 'Loading…'}</p>
            : todayList.length === 0
              ? <p className={styles.hint}>{lang === 'ja' ? 'この日のデータはありません。' : 'No check-ins for this date.'}</p>
              : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                        {QUESTIONS.map(q => <th key={q.key} className={styles.th}>{lang === 'ja' ? q.ja : q.en}</th>)}
                        <th className={styles.th}>{lang === 'ja' ? '体重' : 'Weight'}</th>
                        <th className={styles.th}>{lang === 'ja' ? '平均' : 'Avg'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayList.map(([name, qs]) => {
                        const scores = QUESTIONS.map(q => qs[q.key]);
                        const a = avg(scores);
                        const curBw  = bwMap[name]?.[todayCurWeek];
                        const prevBw = bwMap[name]?.[todayPrevWeek];
                        const pct    = curBw && prevBw ? ((curBw - prevBw) / prevBw * 100).toFixed(1) : null;
                        return (
                          <tr key={name} className={styles.tr}>
                            <td className={styles.tdName}>{name}</td>
                            {QUESTIONS.map(q => (
                              <td key={q.key} className={`${styles.td} ${qs[q.key] != null && qs[q.key] < 5 ? styles.lowCell : ''}`}>
                                <ScoreBadge score={qs[q.key]} alarm={qs[q.key] != null && qs[q.key] < 5} />
                              </td>
                            ))}
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
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
          }

          {/* Score legend */}
          {todayList.length > 0 && (
            <div className={styles.chartLegend} style={{ marginTop: 8 }}>
              <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#10b981' }} />{lang === 'ja' ? '良好 7–10' : 'Good 7–10'}</span>
              <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#f59e0b' }} />{lang === 'ja' ? '注意 5–6' : 'Moderate 5–6'}</span>
              <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#ef4444' }} />{lang === 'ja' ? '警告 <5 ⚠️' : 'Alert <5 ⚠️'}</span>
              <span className={styles.legendScale}>{lang === 'ja' ? 'スケール：1（低）→ 10（高）' : 'Scale: 1 (low) → 10 (high)'}</span>
            </div>
          )}

          {/* Body pain today */}
          {todayPain.length > 0 && (
            <div className={styles.painSection}>
              <div className={styles.painTitle}>
                🩹 {lang === 'ja' ? '報告された痛み・張り' : 'Reported Pain / Tightness'}
              </div>
              {Object.entries(
                todayPain.reduce((acc, r) => {
                  if (!acc[r.user_name]) acc[r.user_name] = [];
                  acc[r.user_name].push(r.body_part);
                  return acc;
                }, {})
              ).map(([name, parts]) => (
                <div key={name} className={styles.painRow}>
                  <span className={styles.painName}>{name}</span>
                  <div className={styles.painParts}>
                    {parts.map(p => {
                      const label = BODY_PARTS.find(b => b.key === p);
                      return <span key={p} className={styles.painChip}>{label ? (lang === 'ja' ? label.ja : label.en) : p}</span>;
                    })}
                  </div>
                </div>
              ))}
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

          {alarmedWeek.length > 0 && (
            <div className={styles.alarm}>
              ⚠️&nbsp;
              {lang === 'ja'
                ? `今週の低スコア — ${alarmedWeek.join('、')}`
                : `Low scores (last 7 days) — ${alarmedWeek.join(', ')}`}
            </div>
          )}

          {loading
            ? <p className={styles.hint}>{lang === 'ja' ? '読込中…' : 'Loading…'}</p>
            : weekRows.length === 0
              ? <p className={styles.hint}>{lang === 'ja' ? 'この週のデータはありません。' : 'No check-ins for this week.'}</p>
              : (
                <div className={styles.weekContent}>

                  {/* Player heatmap */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>
                      {lang === 'ja' ? '選手別 ウェルネス ヒートマップ' : 'Player Wellness Heatmap'}
                      <span className={styles.hmSubtitle}>
                        {lang === 'ja' ? '（1日の全質問の平均スコア）' : '(daily avg across all questions)'}
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
                      <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#10b981' }} />{lang === 'ja' ? '良好 7–10' : 'Good 7–10'}</span>
                      <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#f59e0b' }} />{lang === 'ja' ? '注意 5–6' : 'Moderate 5–6'}</span>
                      <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#ef4444' }} />{lang === 'ja' ? '警告 <5 ⚠️' : 'Alert <5 ⚠️'}</span>
                      <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#d1d5db' }} />{lang === 'ja' ? '未回答' : 'No data'}</span>
                      <span className={styles.legendScale}>{lang === 'ja' ? '最悪スコアの選手が上位' : 'Lowest avg shown first'}</span>
                    </div>
                  </div>

                  {/* Weekly player summary table */}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                          {QUESTIONS.map(q => <th key={q.key} className={styles.th}>{lang === 'ja' ? q.ja : q.en}</th>)}
                          <th className={styles.th}>{lang === 'ja' ? '体重' : 'Weight'}</th>
                          <th className={styles.th}>{lang === 'ja' ? '週平均' : 'Wk avg'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekPlayerList.map(({ name, avgs }) => {
                          const overall = avg(QUESTIONS.map(q => avgs[q.key]));
                          const curBw   = bwMap[name]?.[weekCurWeek];
                          const prevBw  = bwMap[name]?.[weekPrevWeek];
                          const pct     = curBw && prevBw ? ((curBw - prevBw) / prevBw * 100).toFixed(1) : null;
                          return (
                            <tr key={name} className={styles.tr}>
                              <td className={styles.tdName}>{name}</td>
                              {QUESTIONS.map(q => (
                                <td key={q.key} className={`${styles.td} ${avgs[q.key] != null && avgs[q.key] < 5 ? styles.lowCell : ''}`}>
                                  <ScoreBadge score={avgs[q.key]} alarm={avgs[q.key] != null && avgs[q.key] < 5} />
                                </td>
                              ))}
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
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Body pain frequency */}
                  {weekPain.length > 0 && (() => {
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
                            const label = BODY_PARTS.find(b => b.key === key);
                            const chipCls = count >= 3 ? styles.freqChipRed
                              : count === 2 ? styles.freqChipOrange
                              : styles.freqChipYellow;
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

          {/* ── Nutrition submissions overview ── */}
          {nutriRows.length > 0 && (() => {
            const byPlayer = {};
            for (const r of nutriRows) {
              if (!byPlayer[r.user_name]) byPlayer[r.user_name] = { total: 0, green: 0, yellow: 0, red: 0, none: 0 };
              byPlayer[r.user_name].total++;
              if (r.player_rating === 'green')  byPlayer[r.user_name].green++;
              else if (r.player_rating === 'yellow') byPlayer[r.user_name].yellow++;
              else if (r.player_rating === 'red')    byPlayer[r.user_name].red++;
              else byPlayer[r.user_name].none++;
            }
            const players = Object.entries(byPlayer).sort((a, b) => b[1].total - a[1].total);
            return (
              <div className={styles.nutriSection}>
                <div className={styles.nutriTitle}>
                  🍽️ {lang === 'ja' ? '栄養記録' : 'Nutrition Submissions'}
                  <span className={styles.nutriPeriod}>({weekDays}{lang === 'ja' ? '日間' : 'd'})</span>
                </div>
                <table className={styles.nutriTable}>
                  <thead>
                    <tr>
                      <th className={styles.nutriThName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                      <th className={styles.nutriTh}>{lang === 'ja' ? '件数' : 'Meals'}</th>
                      <th className={styles.nutriTh}>🟢</th>
                      <th className={styles.nutriTh}>🟡</th>
                      <th className={styles.nutriTh}>🔴</th>
                      <th className={styles.nutriTh}>{lang === 'ja' ? '未評価' : '—'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players.map(([name, s]) => (
                      <tr key={name} className={styles.nutriTr}>
                        <td className={styles.nutriTdName}>{name}</td>
                        <td className={styles.nutriTd}><strong>{s.total}</strong></td>
                        <td className={styles.nutriTd} style={{ color: s.green  ? '#15803d' : '#d1d5db' }}>{s.green  || '—'}</td>
                        <td className={styles.nutriTd} style={{ color: s.yellow ? '#b45309' : '#d1d5db' }}>{s.yellow || '—'}</td>
                        <td className={styles.nutriTd} style={{ color: s.red    ? '#b91c1c' : '#d1d5db' }}>{s.red    || '—'}</td>
                        <td className={styles.nutriTd} style={{ color: '#9ca3af' }}>{s.none || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
