'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './SessionRPE.module.css';

function rpeBtnStyle(n, selected) {
  if (!selected) return {};
  if (n <= 3) return { background: '#10b981', color: '#fff', borderColor: '#10b981' };
  if (n <= 6) return { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' };
  return { background: '#ef4444', color: '#fff', borderColor: '#ef4444' };
}

const ZONE = {
  easy:     { en: 'Easy',     ja: '楽',       color: '#10b981' },
  moderate: { en: 'Moderate', ja: '普通',     color: '#f59e0b' },
  hard:     { en: 'Hard',     ja: 'きつい',   color: '#ef4444' },
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

export default function SessionRPE({ pendingEvents, userId, userName, lang, onComplete }) {
  const [idx,    setIdx]    = useState(0);
  const [rpe,    setRpe]    = useState(null);
  const [durMin, setDurMin] = useState(() => defaultDur(pendingEvents[0]));
  const [saving, setSaving] = useState(false);

  const event = pendingEvents[idx];
  const dur   = parseInt(durMin) || 0;
  const load  = rpe && dur > 0 ? rpe * dur : null;
  const zone  = rpeZone(rpe);

  function advance() {
    localStorage.setItem(`rpe_done_${userId}_${event.id}`, '1');
    const next = idx + 1;
    if (next >= pendingEvents.length) {
      onComplete();
    } else {
      setIdx(next);
      setRpe(null);
      setDurMin(defaultDur(pendingEvents[next]));
    }
  }

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await supabase.from('session_rpe').upsert(
        {
          user_id:      userId,
          user_name:    userName,
          event_id:     event.id,
          event_title:  event.title,
          event_date:   event.start_time.slice(0, 10),
          rpe,
          duration_min: dur,
          load_au:      rpe * dur,
        },
        { onConflict: 'user_id,event_id' }
      );
    } catch (_) {}
    setSaving(false);
    advance();
  };

  if (!event) return null;

  const dateStr = new Date(event.start_time).toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { weekday: 'short', month: 'short', day: 'numeric' }
  );

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        <div className={styles.header}>
          <span className={styles.headerEmoji}>🏋️</span>
          <div>
            <div className={styles.title}>
              {lang === 'ja' ? 'セッション RPE' : 'Session RPE'}
              {pendingEvents.length > 1 && (
                <span className={styles.progressPill}>{idx + 1} / {pendingEvents.length}</span>
              )}
            </div>
            <div className={styles.sub}>{event.title} · {dateStr}</div>
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
              type="number"
              className={styles.durInput}
              value={durMin}
              min={1}
              max={600}
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
          <button className={styles.skipBtn} onClick={advance}>
            {lang === 'ja' ? 'スキップ' : 'Skip'}
          </button>
          <button className={styles.submitBtn} disabled={!rpe || saving} onClick={handleSubmit}>
            {saving ? '…' : (lang === 'ja' ? '送信する' : 'Submit')}
          </button>
        </div>
        <p className={styles.privacyNote}>
          🔒 {lang === 'ja'
            ? 'このデータはヘッドコーチ、アスレチックトレーナー、フィジオのみ閲覧できます'
            : 'Visible to Head Coach, Athletic Trainer & Physiotherapist only'}
        </p>

      </div>
    </div>
  );
}
