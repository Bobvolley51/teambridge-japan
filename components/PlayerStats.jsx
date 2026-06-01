'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { toJstDate, toJstDateStr, dateToYmd } from '@/lib/date';
import styles from './PlayerStats.module.css';
import VertDashboard from './VertDashboard';

const QUESTIONS = [
  { key: 'physical_readiness', en: 'Physical', ja: '身体' },
  { key: 'mental_readiness',   en: 'Mental',   ja: 'メンタル' },
  { key: 'sleep_quality',      en: 'Sleep Q.', ja: '睡眠質' },
  { key: 'sleep_hours',        en: 'Sleep h',  ja: '睡眠時間' },
  { key: 'availability',       en: 'Avail.',   ja: '出場可否' },
];

const BODY_PARTS = [
  { key: 'shoulder_l',  en: 'L.Shoulder',  ja: '左肩' },
  { key: 'shoulder_r',  en: 'R.Shoulder',  ja: '右肩' },
  { key: 'lower_back',  en: 'Lower Back',  ja: '腰' },
  { key: 'knee_l',      en: 'L.Knee',      ja: '左膝' },
  { key: 'knee_r',      en: 'R.Knee',      ja: '右膝' },
  { key: 'ankle_l',     en: 'L.Ankle',     ja: '左足首' },
  { key: 'ankle_r',     en: 'R.Ankle',     ja: '右足首' },
  { key: 'quad_l',      en: 'L.Quad',      ja: '左大腿四頭筋' },
  { key: 'quad_r',      en: 'R.Quad',      ja: '右大腿四頭筋' },
  { key: 'hamstring_l', en: 'L.Ham',       ja: '左ハムストリングス' },
  { key: 'hamstring_r', en: 'R.Ham',       ja: '右ハムストリングス' },
];

function scoreColor(s) {
  if (s == null) return '#e5e7eb';
  if (s < 40)  return '#ef4444';
  if (s < 60)  return '#f59e0b';
  return '#10b981';
}

function rpeColor(rpe) {
  if (rpe <= 3) return '#10b981';
  if (rpe <= 6) return '#f59e0b';
  return '#ef4444';
}

function withinEditWindow(createdAt) {
  if (!createdAt) return false;
  return (Date.now() - new Date(createdAt).getTime()) < 2 * 60 * 60 * 1000;
}

function fmtDate(dateStr, lang) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { month: 'short', day: 'numeric', weekday: 'short' }
  );
}

function getLast7Dates() {
  const dates = [];
  const today = toJstDate(new Date());
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(dateToYmd(d));
  }
  return dates;
}

export default function PlayerStats({ lang, profile, onEditWellness }) {
  const userId = profile?.id;
  const isJa   = lang === 'ja';

  const [activeTab,    setActiveTab]    = useState('wellness');
  const [wellnessRows, setWellnessRows] = useState([]);
  const [bodyPain,     setBodyPain]     = useState([]);
  const [rpeHistory,   setRpeHistory]   = useState([]);
  const [loading,      setLoading]      = useState(true);

  const [editRpeId, setEditRpeId] = useState(null);
  const [editRpe,   setEditRpe]   = useState(null);
  const [editDur,   setEditDur]   = useState('');
  const [saving,    setSaving]    = useState(false);

  const loadData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const since = toJstDate(new Date());
      since.setDate(since.getDate() - 6);
      const sinceStr = dateToYmd(since);

      const [wellRes, painRes, rpeRes] = await Promise.all([
        supabase.from('wellness_responses')
          .select('question_key, score, response_date, created_at')
          .eq('user_id', userId)
          .gte('response_date', sinceStr)
          .order('response_date', { ascending: false }),
        supabase.from('wellness_body_pain')
          .select('body_part, response_date')
          .eq('user_id', userId)
          .gte('response_date', sinceStr)
          .order('response_date', { ascending: false }),
        supabase.from('session_rpe')
          .select('*')
          .eq('user_id', userId)
          .order('event_date', { ascending: false })
          .limit(10),
      ]);

      setWellnessRows(wellRes.data ?? []);
      setBodyPain(painRes.data ?? []);
      setRpeHistory(rpeRes.data ?? []);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = toJstDateStr(new Date());
  const dates = getLast7Dates();

  const wellGrid = {};
  for (const row of wellnessRows) {
    if (!wellGrid[row.response_date]) wellGrid[row.response_date] = {};
    wellGrid[row.response_date][row.question_key] = { score: row.score, created_at: row.created_at };
  }

  const todayEntries = wellnessRows.filter(r => r.response_date === today);
  const todayCreatedAt = todayEntries.length > 0
    ? todayEntries.reduce((min, r) => r.created_at < min ? r.created_at : min, todayEntries[0].created_at)
    : null;
  const canEditWellness = withinEditWindow(todayCreatedAt);

  const todayPain = bodyPain.filter(p => p.response_date === today).map(p => p.body_part);

  const saveRpe = async (entry) => {
    if (!editRpe || !editDur) return;
    setSaving(true);
    const dur = parseInt(editDur);
    await supabase.from('session_rpe').update({
      rpe:          editRpe,
      duration_min: dur,
      load_au:      editRpe * dur,
    }).eq('id', entry.id);
    setSaving(false);
    setEditRpeId(null);
    loadData();
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.pageHeader}>
        <h2 className={styles.pageTitle}>
          {isJa ? 'マイデータ' : 'My Stats'}
        </h2>
        <div className={styles.pageTabs}>
          {[
            { id: 'wellness', label: isJa ? 'ウェルネス / RPE' : 'Wellness / RPE' },
            { id: 'vert',     label: isJa ? 'VERTジャンプ' : 'VERT Jumps' },
          ].map(t => (
            <button key={t.id}
              className={`${styles.pageTab} ${activeTab === t.id ? styles.pageTabActive : ''}`}
              onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'vert' ? (
        <VertDashboard lang={lang} profile={profile} />
      ) : loading ? (
        <div className={styles.loading}>{isJa ? '読込中...' : 'Loading…'}</div>
      ) : (
        <>
          {/* ── Wellness Section ── */}
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h3 className={styles.sectionTitle}>
                💪 {isJa ? 'ウェルネス（直近7日）' : 'Wellness — last 7 days'}
              </h3>
              {canEditWellness && onEditWellness && (
                <button className={styles.editBtn} onClick={onEditWellness}>
                  ✏️ {isJa ? '今日の回答を修正' : 'Edit today\'s check'}
                </button>
              )}
            </div>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thDate}>{isJa ? '日付' : 'Date'}</th>
                    {QUESTIONS.map(q => (
                      <th key={q.key} className={styles.th}>{q[lang]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dates.map(date => {
                    const dayData = wellGrid[date] ?? {};
                    const isToday = date === today;
                    return (
                      <tr key={date} className={isToday ? styles.todayRow : ''}>
                        <td className={styles.tdDate}>
                          {isToday
                            ? (isJa ? '今日' : 'Today')
                            : fmtDate(date, lang)}
                        </td>
                        {QUESTIONS.map(q => {
                          const cell = dayData[q.key];
                          return (
                            <td key={q.key} className={styles.tdScore}>
                              {cell
                                ? <span className={styles.scoreChip} style={{ background: scoreColor(cell.score) }}>{cell.score}</span>
                                : <span className={styles.scoreEmpty}>—</span>
                              }
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {todayPain.length > 0 && (
              <div className={styles.painRow}>
                <span className={styles.painLabel}>
                  🩹 {isJa ? '今日の痛み部位:' : 'Pain areas today:'}
                </span>
                {todayPain.map(key => {
                  const bp = BODY_PARTS.find(b => b.key === key);
                  return <span key={key} className={styles.painChip}>{bp ? bp[lang] : key}</span>;
                })}
              </div>
            )}

            <div className={styles.legend}>
              <span className={styles.legendDot} style={{ color: '#10b981' }}>● 7–10 {isJa ? '良好' : 'Good'}</span>
              <span className={styles.legendDot} style={{ color: '#f59e0b' }}>● 4–6 {isJa ? '普通' : 'Moderate'}</span>
              <span className={styles.legendDot} style={{ color: '#ef4444' }}>● 1–3 {isJa ? '不調' : 'Poor'}</span>
            </div>
          </section>

          {/* ── Session RPE Section ── */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              🏋️ {isJa ? 'セッションRPE（直近10回）' : 'Session RPE — last 10'}
            </h3>

            {rpeHistory.length === 0 ? (
              <p className={styles.empty}>
                {isJa ? 'まだセッションデータがありません。' : 'No sessions logged yet.'}
              </p>
            ) : (
              <div className={styles.rpeList}>
                {rpeHistory.map(entry => {
                  const editable  = withinEditWindow(entry.created_at);
                  const isEditing = editRpeId === entry.id;
                  return (
                    <div key={entry.id} className={styles.rpeEntry}>
                      <div className={styles.rpeMain}>
                        <span className={styles.rpeDate}>{fmtDate(entry.event_date, lang)}</span>
                        <span className={styles.rpeTitle}>{entry.event_title}</span>
                        <span className={styles.rpeBadge} style={{ background: rpeColor(entry.rpe) }}>
                          RPE {entry.rpe}
                        </span>
                        <span className={styles.rpeDur}>{entry.duration_min}{isJa ? '分' : 'min'}</span>
                        <span className={styles.rpeLoad}>{entry.load_au} AU</span>
                        {editable && !isEditing && (
                          <button className={styles.editSmallBtn}
                            onClick={() => { setEditRpeId(entry.id); setEditRpe(entry.rpe); setEditDur(String(entry.duration_min)); }}>
                            ✏️
                          </button>
                        )}
                      </div>

                      {isEditing && (
                        <div className={styles.rpeEditRow}>
                          <span className={styles.rpeEditLabel}>RPE</span>
                          <div className={styles.rpeEditBtns}>
                            {[1,2,3,4,5,6,7,8,9,10].map(n => (
                              <button key={n}
                                className={`${styles.rpeEditBtn} ${editRpe === n ? styles.rpeEditBtnActive : ''}`}
                                style={editRpe === n ? { background: rpeColor(n), borderColor: rpeColor(n), color: '#fff' } : {}}
                                onClick={() => setEditRpe(n)}>
                                {n}
                              </button>
                            ))}
                          </div>
                          <span className={styles.rpeEditLabel}>{isJa ? '時間(分)' : 'Mins'}</span>
                          <input type="number" className={styles.rpeEditInput}
                            value={editDur} onChange={e => setEditDur(e.target.value)} min={1} max={300} />
                          <button className={styles.saveSmallBtn}
                            disabled={saving || !editRpe || !editDur}
                            onClick={() => saveRpe(entry)}>
                            {saving ? '…' : (isJa ? '保存' : 'Save')}
                          </button>
                          <button className={styles.cancelSmallBtn} onClick={() => setEditRpeId(null)}>
                            {isJa ? 'キャンセル' : 'Cancel'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
