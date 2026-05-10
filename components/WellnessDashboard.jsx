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

function getLast7Start(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() - 6 + offset * 7);
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

// ── SVG Bar Chart ─────────────────────────────────────────────

function BarChart({ data }) {
  const W = 560, H = 130;
  const P = { t: 22, b: 22, l: 20, r: 8 };
  const cW = W - P.l - P.r;
  const cH = H - P.t - P.b;
  const slotW = cW / data.length;
  const barW = Math.max(slotW * 0.55, 10);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg}>
      {/* Horizontal grid lines */}
      {[2, 4, 6, 8, 10].map(v => {
        const y = P.t + cH - (v / 10) * cH;
        return (
          <g key={v}>
            <line x1={P.l} y1={y} x2={W - P.r} y2={y} stroke="#f3f4f6" strokeWidth={1} />
            <text x={P.l - 3} y={y + 3} textAnchor="end" fontSize={8} fill="#d1d5db">{v}</text>
          </g>
        );
      })}

      {/* Threshold line at 5 */}
      <line x1={P.l} y1={P.t + cH - (5 / 10) * cH} x2={W - P.r} y2={P.t + cH - (5 / 10) * cH}
        stroke="#fecaca" strokeWidth={1} strokeDasharray="4 3" />

      {/* Bars */}
      {data.map((d, i) => {
        const cx  = P.l + i * slotW + slotW / 2;
        const bx  = cx - barW / 2;
        const val = d.value ?? 0;
        const bh  = Math.max((val / 10) * cH, d.value != null ? 3 : 0);
        const by  = P.t + cH - bh;
        const fill = colorOf(d.value);

        return (
          <g key={i}>
            <rect x={bx} y={by} width={barW} height={bh} fill={fill} rx={3}
              opacity={d.value == null ? 0.2 : 1} />
            {d.value != null && (
              <text x={cx} y={by - 4} textAnchor="middle" fontSize={9} fontWeight="700" fill={fill}>
                {d.value}
              </text>
            )}
            <text x={cx} y={H - 5} textAnchor="middle" fontSize={9} fill="#9ca3af">{d.label}</text>
          </g>
        );
      })}
    </svg>
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

export default function WellnessDashboard({ lang }) {
  const todayStr = toDateStr(new Date());

  const [tab,        setTab]        = useState('today');
  const [date,       setDate]       = useState(todayStr);
  const [weekOffset, setWeekOffset] = useState(0);
  const [rows,       setRows]       = useState([]);
  const [weekRows,   setWeekRows]   = useState([]);
  const [todayPain,  setTodayPain]  = useState([]);
  const [weekPain,   setWeekPain]   = useState([]);
  const [loading,    setLoading]    = useState(true);

  // ── Load today ──────────────────────────────────────────────
  const loadToday = useCallback(async () => {
    setLoading(true);
    const [{ data }, { data: pain }] = await Promise.all([
      supabase.from('wellness_responses').select('*').eq('response_date', date).order('user_name'),
      supabase.from('wellness_body_pain').select('user_name, body_part').eq('response_date', date),
    ]);
    setRows(data ?? []);
    setTodayPain(pain ?? []);
    setLoading(false);
  }, [date]);

  // ── Load week ───────────────────────────────────────────────
  const loadWeek = useCallback(async () => {
    setLoading(true);
    const ws = getLast7Start(weekOffset);
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws); d.setDate(d.getDate() + i); return toDateStr(d);
    });
    const [{ data }, { data: pain }] = await Promise.all([
      supabase.from('wellness_responses').select('*').in('response_date', dates).order('user_name'),
      supabase.from('wellness_body_pain').select('user_name, body_part, response_date').in('response_date', dates),
    ]);
    setWeekRows(data ?? []);
    setWeekPain(pain ?? []);
    setLoading(false);
  }, [weekOffset]);

  useEffect(() => {
    if (tab === 'today') loadToday(); else loadWeek();
  }, [tab, loadToday, loadWeek]);

  // ── Today: derived data ─────────────────────────────────────
  const todayPlayers = {};
  for (const r of rows) {
    if (!todayPlayers[r.user_name]) todayPlayers[r.user_name] = {};
    todayPlayers[r.user_name][r.question_key] = r.score;
  }
  const todayList    = Object.entries(todayPlayers);
  const alarmedToday = [...new Set(rows.filter(r => r.score < 5).map(r => r.user_name))];

  // ── Week: derived data ──────────────────────────────────────
  const ws        = getLast7Start(weekOffset);
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws); d.setDate(d.getDate() + i); return toDateStr(d);
  });

  const dayLabel = (ds) => {
    const d = new Date(ds);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const dailyAvg = weekDates.map(ds => {
    const dayRows = weekRows.filter(r => r.response_date === ds);
    return { label: dayLabel(ds), value: dayRows.length ? avg(dayRows.map(r => r.score)) : null };
  });

  const questionDailyAvg = QUESTIONS.map(q => ({
    ...q,
    days: weekDates.map(ds => {
      const qRows = weekRows.filter(r => r.response_date === ds && r.question_key === q.key);
      return { label: dayLabel(ds), value: qRows.length ? avg(qRows.map(r => r.score)) : null };
    }),
  }));

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
  const weekLabel    = `${weekDates[0]} – ${weekDates[6]}`;

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
                        <th className={styles.th}>{lang === 'ja' ? '平均' : 'Avg'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayList.map(([name, qs]) => {
                        const scores = QUESTIONS.map(q => qs[q.key]);
                        const a = avg(scores);
                        return (
                          <tr key={name} className={styles.tr}>
                            <td className={styles.tdName}>{name}</td>
                            {QUESTIONS.map(q => (
                              <td key={q.key} className={`${styles.td} ${qs[q.key] != null && qs[q.key] < 5 ? styles.lowCell : ''}`}>
                                <ScoreBadge score={qs[q.key]} alarm={qs[q.key] != null && qs[q.key] < 5} />
                              </td>
                            ))}
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
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
          }

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
                {lang === 'ja' ? '最新7日' : 'Latest 7 days'}
              </button>
            )}
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

                  {/* Overall daily average chart */}
                  <div className={styles.chartCard}>
                    <div className={styles.chartTitle}>
                      {lang === 'ja' ? 'チーム全体 — 日別平均' : 'Team Overall — Daily Average'}
                    </div>
                    <BarChart data={dailyAvg} />
                    <div className={styles.chartLegend}>
                      <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#10b981' }} />7–10</span>
                      <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#f59e0b' }} />5–6</span>
                      <span className={styles.legendItem}><span className={styles.legendDot} style={{ background: '#ef4444' }} />&lt;5 ⚠️</span>
                    </div>
                  </div>

                  {/* Per-question charts */}
                  <div className={styles.qGrid}>
                    {questionDailyAvg.map(q => (
                      <div key={q.key} className={styles.qChartCard}>
                        <div className={styles.qChartTitle}>{lang === 'ja' ? q.ja : q.en}</div>
                        <BarChart data={q.days} />
                      </div>
                    ))}
                  </div>

                  {/* Weekly player summary table */}
                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                          {QUESTIONS.map(q => <th key={q.key} className={styles.th}>{lang === 'ja' ? q.ja : q.en}</th>)}
                          <th className={styles.th}>{lang === 'ja' ? '週平均' : 'Wk avg'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekPlayerList.map(({ name, avgs }) => {
                          const overall = avg(QUESTIONS.map(q => avgs[q.key]));
                          return (
                            <tr key={name} className={styles.tr}>
                              <td className={styles.tdName}>{name}</td>
                              {QUESTIONS.map(q => (
                                <td key={q.key} className={`${styles.td} ${avgs[q.key] != null && avgs[q.key] < 5 ? styles.lowCell : ''}`}>
                                  <ScoreBadge score={avgs[q.key]} alarm={avgs[q.key] != null && avgs[q.key] < 5} />
                                </td>
                              ))}
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
        </div>
      )}
    </div>
  );
}
