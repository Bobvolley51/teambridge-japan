'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toJstDate, dateToYmd } from '@/lib/date';
import styles from './SessionRPE.module.css';

function rpeBtnStyle(n, selected) {
  if (!selected) return {};
  if (n <= 3) return { background: '#10b981', color: '#fff', borderColor: '#10b981' };
  if (n <= 6) return { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' };
  return { background: '#ef4444', color: '#fff', borderColor: '#ef4444' };
}

const ZONE = {
  easy:     { en: 'Easy',     ja: '楽',     color: '#10b981' },
  moderate: { en: 'Moderate', ja: '普通',   color: '#f59e0b' },
  hard:     { en: 'Hard',     ja: 'きつい', color: '#ef4444' },
};

function rpeZone(rpe) {
  if (!rpe) return null;
  if (rpe <= 3) return 'easy';
  if (rpe <= 6) return 'moderate';
  return 'hard';
}

function defaultDur(ev) {
  if (!ev) return 90;
  const mins = Math.round((new Date(ev.end_time) - new Date(ev.start_time)) / 60000);
  return isNaN(mins) || mins <= 0 ? 90 : mins;
}

function sliderColor(v) {
  if (v == null) return '#9ca3af';
  if (v <= 39)   return '#ef4444';
  if (v <= 59)   return '#f59e0b';
  return '#10b981';
}

export default function SessionRPE({ pendingEvents, userId, userName, lang, onComplete }) {
  const [idx,              setIdx]              = useState(0);
  const [page,             setPage]             = useState(1);
  const [rpe,              setRpe]              = useState(null);
  const [durMin,           setDurMin]           = useState(() => defaultDur(pendingEvents[0]));
  const [energyLevel,      setEnergyLevel]      = useState(null);
  const [focusLevel,       setFocusLevel]       = useState(null);
  const [mindfulness,      setMindfulness]      = useState(null);
  const [practiceGoal,     setPracticeGoal]     = useState(null);
  const [saving,           setSaving]           = useState(false);
  const [alreadyConfirm,   setAlreadyConfirm]   = useState(0);

  const event          = pendingEvents[idx];
  const dur            = parseInt(durMin) || 0;
  const load           = rpe && dur > 0 ? rpe * dur : null;
  const zone           = rpeZone(rpe);
  const isBallPractice = event?.category === 'Ball-Practice';

  const extraAnswered = !isBallPractice || (
    energyLevel !== null && focusLevel !== null &&
    mindfulness !== null && practiceGoal !== null
  );

  function advanceEvent() {
    const next = idx + 1;
    if (next >= pendingEvents.length) {
      onComplete();
    } else {
      setIdx(next);
      setPage(1);
      setRpe(null);
      setDurMin(defaultDur(pendingEvents[next]));
      setEnergyLevel(null);
      setFocusLevel(null);
      setMindfulness(null);
      setPracticeGoal(null);
    }
  }

  // Save a "did not train" record so the popup won't reappear on next login
  const handleSkip = async () => {
    setSaving(true);
    try {
      await supabase.from('session_rpe').upsert(
        {
          user_id:      userId,
          user_name:    userName,
          event_id:     event.id,
          event_title:  event.title,
          event_date:   dateToYmd(toJstDate(event.start_time)),
          rpe:          null,
          duration_min: 0,
          load_au:      0,
          attended:     false,
        },
        { onConflict: 'user_id,event_id' }
      );
    } catch (_) {}
    setSaving(false);
    advanceEvent();
  };

  const handleRpeNext = () => {
    if (isBallPractice) {
      setPage(2);
    } else {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await supabase.from('session_rpe').upsert(
        {
          user_id:               userId,
          user_name:             userName,
          event_id:              event.id,
          event_title:           event.title,
          event_category:        event.category,
          event_date:            dateToYmd(toJstDate(event.start_time)),
          rpe,
          duration_min:          dur,
          load_au:               rpe * dur,
          energy_level:          energyLevel,
          focus_level:           focusLevel,
          mindfulness:           mindfulness === 'yes' ? true : mindfulness === 'no' ? false : null,
          practice_goal_reached: practiceGoal === 'yes' ? true : practiceGoal === 'no' ? false : null,
        },
        { onConflict: 'user_id,event_id' }
      );

      // ACWR is visible in the Performance / Load Management dashboard — no DM alert
    } catch (_) {}
    setSaving(false);
    advanceEvent();
  };

  if (!event) return null;

  const dateStr = new Date(event.start_time).toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { weekday: 'short', month: 'short', day: 'numeric' }
  );

  const handleAlreadyAnswered = () => {
    if (alreadyConfirm < 2) { setAlreadyConfirm(s => s + 1); return; }
    handleSkip(); // reuse skip logic — saves attended:false so it won't reappear
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* ── Page 1: RPE + duration ── */}
        {page === 1 && (
          <>
            <div className={styles.contextBanner}>
              {event.category === 'Game' ? '🏐' : '🏋️'} {event.title} · {dateStr}
            </div>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>📊</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? 'セッション RPE' : 'Session RPE'}
                  {pendingEvents.length > 1 && (
                    <span className={styles.progressPill}>{idx + 1} / {pendingEvents.length}</span>
                  )}
                  {isBallPractice && (
                    <span className={styles.progressPill}>1/2</span>
                  )}
                </div>
                <div className={styles.sub}>{lang === 'ja' ? 'セッション全体の評価' : 'Rate your overall session'}</div>
              </div>
            </div>

            <div className={styles.body}>
              <p className={styles.question}>
                {lang === 'ja'
                  ? 'セッション全体のきつさを1〜10で評価してください（1 = 非常に楽、10 = 最大限）'
                  : 'How hard was the overall session? Rate 1 (very easy) to 10 (maximal effort)'}
              </p>

              <div className={styles.rpeScale}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                  <button key={n} className={styles.rpeBtn}
                    style={rpeBtnStyle(n, rpe === n)}
                    onClick={() => setRpe(n)}>
                    {n}
                  </button>
                ))}
              </div>

              {zone && (
                <div className={styles.zoneTag} style={{ color: ZONE[zone].color, borderColor: ZONE[zone].color }}>
                  {ZONE[zone][lang]}
                </div>
              )}

              <div className={styles.durRow}>
                <span className={styles.durLabel}>
                  {lang === 'ja' ? 'セッション時間（分）' : 'Session duration (min)'}
                </span>
                <input
                  type="number" className={styles.durInput}
                  value={durMin} min={1} max={600}
                  onChange={e => setDurMin(e.target.value)}
                />
              </div>

              {load != null && (
                <div className={styles.loadPreview}>
                  <span className={styles.loadLabel}>
                    {lang === 'ja' ? 'トレーニング負荷' : 'Training Load'}
                  </span>
                  <span className={styles.loadValue}>{load}</span>
                  <span className={styles.loadUnit}>AU</span>
                  <span className={styles.loadHint}>
                    {lang === 'ja' ? `RPE ${rpe} × ${durMin}分` : `RPE ${rpe} × ${durMin} min`}
                  </span>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button className={styles.skipBtn} disabled={saving} onClick={handleSkip}>
                {lang === 'ja' ? '不参加' : 'Did not train'}
              </button>
              <button className={styles.submitBtn} disabled={!rpe || saving} onClick={handleRpeNext}>
                {isBallPractice
                  ? (lang === 'ja' ? '次へ →' : 'Next →')
                  : (saving ? '…' : (lang === 'ja' ? '送信する' : 'Submit'))}
              </button>
            </div>
            <div className={styles.skipArea}>
              {alreadyConfirm === 0 && (
                <button className={styles.alreadyBtn} onClick={() => setAlreadyConfirm(1)}>
                  {lang === 'ja' ? '既に回答済み' : 'Already answered this'}
                </button>
              )}
              {alreadyConfirm === 1 && (
                <div className={styles.skipConfirm}>
                  <span>{lang === 'ja' ? '本当にもう回答しましたか？' : 'Are you sure you already rated this?'}</span>
                  <button className={styles.skipConfirmBtn} onClick={() => setAlreadyConfirm(2)}>{lang === 'ja' ? 'はい' : 'Yes'}</button>
                  <button className={styles.skipCancelBtn} onClick={() => setAlreadyConfirm(0)}>{lang === 'ja' ? 'いいえ' : 'No'}</button>
                </div>
              )}
              {alreadyConfirm === 2 && (
                <div className={styles.skipConfirm}>
                  <span>{lang === 'ja' ? '閉じますか？' : 'Dismiss this session?'}</span>
                  <button className={styles.skipConfirmBtn} onClick={handleAlreadyAnswered} disabled={saving}>{lang === 'ja' ? '確認して閉じる' : 'Confirm & close'}</button>
                  <button className={styles.skipCancelBtn} onClick={() => setAlreadyConfirm(0)}>{lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
                </div>
              )}
            </div>
            <p className={styles.privacyNote}>
              🔒 {lang === 'ja'
                ? 'このデータはヘッドコーチ、アスレチックトレーナー、フィジオのみ閲覧できます'
                : 'Visible to Head Coach, Athletic Trainer & Physiotherapist only'}
            </p>
          </>
        )}

        {/* ── Page 2: Ball-Practice extra questions ── */}
        {page === 2 && (
          <>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>⚡</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? '練習フィードバック (2/2)' : 'Practice Feedback (2/2)'}
                </div>
                <div className={styles.sub}>{event.title} · {dateStr}</div>
              </div>
            </div>

            <div className={styles.body}>

              {/* Energy Level */}
              <div className={styles.extraBlock}>
                <div className={styles.extraLabel}>
                  {lang === 'ja' ? 'エネルギーレベル' : 'Energy Level'}
                  <span className={styles.extraScale}>0 – 100</span>
                </div>
                <div className={styles.sliderRow}>
                  <span className={styles.sliderEndLabel}>{lang === 'ja' ? '低' : 'Low'}</span>
                  <div className={styles.sliderWrap}>
                    <input type="range" min={0} max={100} step={5}
                      value={energyLevel ?? 50}
                      className={styles.slider}
                      style={{ accentColor: sliderColor(energyLevel) }}
                      onChange={e => setEnergyLevel(+e.target.value)}
                    />
                    <span className={styles.sliderVal} style={{ color: sliderColor(energyLevel), borderColor: sliderColor(energyLevel) }}>
                      {energyLevel ?? '—'}
                    </span>
                  </div>
                  <span className={styles.sliderEndLabel}>{lang === 'ja' ? '高' : 'High'}</span>
                </div>
              </div>

              {/* Focus Level */}
              <div className={styles.extraBlock}>
                <div className={styles.extraLabel}>
                  {lang === 'ja' ? 'フォーカスレベル' : 'Focus Level'}
                  <span className={styles.extraScale}>0 – 100</span>
                </div>
                <div className={styles.sliderRow}>
                  <span className={styles.sliderEndLabel}>{lang === 'ja' ? '低' : 'Low'}</span>
                  <div className={styles.sliderWrap}>
                    <input type="range" min={0} max={100} step={5}
                      value={focusLevel ?? 50}
                      className={styles.slider}
                      style={{ accentColor: sliderColor(focusLevel) }}
                      onChange={e => setFocusLevel(+e.target.value)}
                    />
                    <span className={styles.sliderVal} style={{ color: sliderColor(focusLevel), borderColor: sliderColor(focusLevel) }}>
                      {focusLevel ?? '—'}
                    </span>
                  </div>
                  <span className={styles.sliderEndLabel}>{lang === 'ja' ? '高' : 'High'}</span>
                </div>
              </div>

              {/* Mindfulness */}
              <div className={styles.extraBlock}>
                <div className={styles.extraLabel}>
                  {lang === 'ja' ? 'マインドフルネス実施' : 'Mindfulness today'}
                </div>
                <div className={styles.yesNoRow}>
                  <button className={`${styles.yesNoBtn} ${mindfulness === 'no'  ? styles.yesNoBtnNo  : ''}`} onClick={() => setMindfulness('no')}>
                    {lang === 'ja' ? 'いいえ' : 'No'}
                  </button>
                  <button className={`${styles.yesNoBtn} ${mindfulness === 'yes' ? styles.yesNoBtnYes : ''}`} onClick={() => setMindfulness('yes')}>
                    {lang === 'ja' ? 'はい' : 'Yes'}
                  </button>
                </div>
              </div>

              {/* Individual practice goal */}
              <div className={styles.extraBlock}>
                <div className={styles.extraLabel}>
                  {lang === 'ja' ? '個人練習目標達成' : 'Individual practice goal reached'}
                </div>
                <div className={styles.yesNoRow}>
                  <button className={`${styles.yesNoBtn} ${practiceGoal === 'no'  ? styles.yesNoBtnNo  : ''}`} onClick={() => setPracticeGoal('no')}>
                    {lang === 'ja' ? 'いいえ' : 'No'}
                  </button>
                  <button className={`${styles.yesNoBtn} ${practiceGoal === 'yes' ? styles.yesNoBtnYes : ''}`} onClick={() => setPracticeGoal('yes')}>
                    {lang === 'ja' ? 'はい' : 'Yes'}
                  </button>
                </div>
              </div>

            </div>

            <div className={styles.actions}>
              <button className={styles.skipBtn} onClick={() => setPage(1)}>
                ← {lang === 'ja' ? '戻る' : 'Back'}
              </button>
              <button className={styles.submitBtn} disabled={!extraAnswered || saving} onClick={handleSubmit}>
                {saving ? '…' : (lang === 'ja' ? '送信する' : 'Submit')}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
