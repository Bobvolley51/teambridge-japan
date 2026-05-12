'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export default function PerformanceDashboard({ lang, profile }) {
  const [tab,              setTab]              = useState('acwr');
  const [records,          setRecords]          = useState([]);
  const [vertRecords,      setVertRecords]      = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [showLegend,       setShowLegend]       = useState(false);
  const [expandedSession,  setExpandedSession]  = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    const since = daysAgo(28).toISOString().slice(0, 10);
    const [rpeRes, vertRes] = await Promise.all([
      supabase.from('session_rpe').select('*').gte('event_date', since).order('event_date', { ascending: false }),
      supabase.from('vert_sessions').select('*').gte('session_date', since).order('session_date', { ascending: false }),
    ]);
    setRecords(rpeRes.data ?? []);
    setVertRecords(vertRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Build ACWR rows
  const day7  = daysAgo(7);
  const day28 = daysAgo(28);

  const playerMap = {};
  for (const r of records) {
    if (!playerMap[r.user_id]) {
      playerMap[r.user_id] = { name: r.user_name, all: [] };
    }
    playerMap[r.user_id].all.push(r);
  }

  const acwrRows = Object.entries(playerMap).map(([uid, p]) => {
    const acute = p.all
      .filter(s => new Date(s.event_date) >= day7)
      .reduce((sum, s) => sum + (s.load_au ?? 0), 0);
    const chronic28sum = p.all
      .filter(s => new Date(s.event_date) >= day28)
      .reduce((sum, s) => sum + (s.load_au ?? 0), 0);
    const chronic = Math.round(chronic28sum / 4);
    const acwr = chronic > 0 ? Math.round((acute / chronic) * 100) / 100 : null;
    const recent = [...p.all]
      .sort((a, b) => a.event_date.localeCompare(b.event_date))
      .slice(-7);
    return { uid, name: p.name, acute, chronic, acwr, recent };
  });

  acwrRows.sort((a, b) => (b.acwr ?? -1) - (a.acwr ?? -1));

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
                    {r.name} — ACWR {r.acwr?.toFixed(2)}
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
                    {r.name} — ACWR {r.acwr?.toFixed(2)}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {tab !== 'vert' && <div className={styles.content}>
        {loading ? (
          <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>

        ) : tab === 'acwr' ? (
          acwrRows.length === 0 ? (
            <div className={styles.empty}>
              {lang === 'ja' ? 'まだセッションデータがありません' : 'No session data yet — players submit RPE after Ball Practice / Game events'}
            </div>
          ) : (
            <>
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
                      ? 'ACWR = 直近7日間の負荷 ÷ 直近28日間の平均週負荷。選手の「今週の疲労」と「体の慣れ」のバランスを示します。負荷AU = RPE × 練習時間（分）。'
                      : 'ACWR = last 7 days load ÷ average weekly load over 28 days. It measures how this week\'s strain compares to what the body is conditioned for. Load (AU) = RPE × session duration (min).'}
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
                          <td>
                            <span className={styles.legendChip} style={{ color: zone.color, background: zone.bg, borderColor: zone.color }}>
                              {zone[lang]}
                            </span>
                          </td>
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

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                      <th className={styles.th}>{lang === 'ja' ? '急性負荷\n(7日)' : 'Acute\n(7d)'}</th>
                      <th className={styles.th}>{lang === 'ja' ? '慢性負荷\n(28d÷4)' : 'Chronic\n(28d÷4)'}</th>
                      <th className={styles.th}>ACWR</th>
                      <th className={styles.th}>{lang === 'ja' ? 'ステータス' : 'Status'}</th>
                      <th className={styles.th}>{lang === 'ja' ? '直近RPE' : 'Recent RPE'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acwrRows.map(row => {
                      const zone = row.acwr != null ? getZone(row.acwr) : null;
                      return (
                        <tr key={row.uid} className={styles.tr}>
                          <td className={styles.tdName}>{row.name}</td>
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
                            <div className={styles.dotRow}>
                              {row.recent.map((s, i) => (
                                <span key={i} className={styles.rpeDot}
                                  style={{ background: rpeColor(s.rpe) }}
                                  title={`${s.event_title} — RPE ${s.rpe} (${s.load_au} AU)`} />
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )

        ) : tab === 'vert' ? null : (() => {
          // Group RPE records by date + event title
          const sessionMap = {};
          for (const r of records) {
            const key = `${r.event_date}|${r.event_title ?? ''}`;
            if (!sessionMap[key]) sessionMap[key] = { date: r.event_date, title: r.event_title ?? '—', players: [] };
            sessionMap[key].players.push(r);
          }
          const sessions = Object.values(sessionMap).sort((a, b) => b.date.localeCompare(a.date));

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
                const sorted  = [...s.players].sort((a, b) => b.rpe - a.rpe);
                return (
                  <div key={key} className={styles.sessionCard}>
                    <button
                      className={`${styles.sessionHeader} ${open ? styles.sessionHeaderOpen : ''}`}
                      onClick={() => setExpandedSession(open ? null : key)}>
                      <div className={styles.sessLeft}>
                        <span className={styles.sessDate}>{s.date}</span>
                        <span className={styles.sessTitle}>{s.title}</span>
                        <span className={styles.sessCount}>{s.players.length} {lang === 'ja' ? '名' : 'players'}</span>
                      </div>
                      <div className={styles.sessStats}>
                        <div className={styles.sessStat}>
                          <span className={styles.sessStatLabel}>{lang === 'ja' ? '平均RPE' : 'Avg RPE'}</span>
                          <span className={styles.sessStatVal} style={{ color: rpeColor(avgRpe) }}>{avgRpe.toFixed(1)}</span>
                        </div>
                        <div className={styles.sessStat}>
                          <span className={styles.sessStatLabel}>{lang === 'ja' ? '範囲' : 'Range'}</span>
                          <span className={styles.sessStatVal}>
                            <span style={{ color: rpeColor(minRpe) }}>{minRpe}</span>
                            <span className={styles.sessRange}>–</span>
                            <span style={{ color: rpeColor(maxRpe) }}>{maxRpe}</span>
                          </span>
                        </div>
                        <div className={styles.sessStat}>
                          <span className={styles.sessStatLabel}>{lang === 'ja' ? '平均負荷' : 'Avg Load'}</span>
                          <span className={styles.sessStatVal}>{avgLoad} <span className={styles.sessAu}>AU</span></span>
                        </div>
                      </div>
                      <span className={styles.sessCaret}>{open ? '▲' : '▼'}</span>
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
                            </tr>
                          </thead>
                          <tbody>
                            {sorted.map((p, i) => (
                              <tr key={i} className={styles.sessTr}>
                                <td className={styles.sessTdName}>{p.user_name}</td>
                                <td className={styles.sessTd}>
                                  <span className={styles.rpeBadge} style={{ background: rpeColor(p.rpe), color: '#fff' }}>{p.rpe}</span>
                                </td>
                                <td className={styles.sessTd}>{p.duration_min ?? <span className={styles.noData}>—</span>}</td>
                                <td className={styles.sessTd}><span className={styles.loadNum}>{p.load_au}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>}

      {tab === 'vert' && (
        <VertDashboard lang={lang} profile={profile} />
      )}



    </div>
  );
}
