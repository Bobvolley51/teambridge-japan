'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './PerformanceDashboard.module.css';

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

export default function PerformanceDashboard({ lang }) {
  const [tab,     setTab]     = useState('acwr');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const since = daysAgo(28).toISOString().slice(0, 10);
    const { data } = await supabase
      .from('session_rpe')
      .select('*')
      .gte('event_date', since)
      .order('event_date', { ascending: false });
    setRecords(data ?? []);
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
            { id: 'acwr',    en: 'ACWR Overview',   ja: 'ACWR 概要' },
            { id: 'history', en: 'Session History',  ja: 'セッション履歴' },
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

      <div className={styles.content}>
        {loading ? (
          <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>

        ) : tab === 'acwr' ? (
          acwrRows.length === 0 ? (
            <div className={styles.empty}>
              {lang === 'ja' ? 'まだセッションデータがありません' : 'No session data yet — players submit RPE after Training / Game events'}
            </div>
          ) : (
            <>
              <div className={styles.legendRow}>
                {ZONES.map((z, i) => (
                  <span key={z.id} className={styles.legendChip}
                    style={{ color: z.color, background: z.bg, borderColor: z.color }}>
                    {z[lang]} {ZONE_RANGE[i]}
                  </span>
                ))}
              </div>

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

        ) : (
          /* Session History */
          records.length === 0 ? (
            <div className={styles.empty}>
              {lang === 'ja' ? 'まだセッションデータがありません' : 'No session data yet'}
            </div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thName}>{lang === 'ja' ? '日付' : 'Date'}</th>
                    <th className={styles.thName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                    <th className={styles.thName}>{lang === 'ja' ? 'イベント' : 'Event'}</th>
                    <th className={styles.th}>RPE</th>
                    <th className={styles.th}>{lang === 'ja' ? '時間 (分)' : 'Duration (min)'}</th>
                    <th className={styles.th}>{lang === 'ja' ? '負荷 (AU)' : 'Load (AU)'}</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id} className={styles.tr}>
                      <td className={styles.tdName}>{r.event_date}</td>
                      <td className={styles.tdName}>{r.user_name}</td>
                      <td className={styles.tdName}>{r.event_title}</td>
                      <td className={styles.td}>
                        <span className={styles.rpeBadge}
                          style={{ background: rpeColor(r.rpe), color: '#fff' }}>
                          {r.rpe}
                        </span>
                      </td>
                      <td className={styles.td}>{r.duration_min}</td>
                      <td className={styles.td}>
                        <span className={styles.loadNum}>{r.load_au}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

    </div>
  );
}
