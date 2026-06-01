'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toJstDateStr } from '@/lib/date';
import styles from './BodyWeightCheck.module.css';

export default function BodyWeightCheck({ userId, userName, weekStart, lang, onComplete }) {
  const [weight,  setWeight]  = useState('');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  const kg = parseFloat(weight);
  const valid = !isNaN(kg) && kg > 30 && kg < 250;

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    const { error: err } = await supabase.from('player_bodyweight').upsert(
      {
        user_id:       userId,
        user_name:     userName,
        weight_kg:     kg,
        week_start:    weekStart,
        recorded_date: toJstDateStr(new Date()),
      },
      { onConflict: 'user_id,week_start' }
    );
    setSaving(false);
    if (err) { setError(err.message); return; }
    onComplete();
  };

  const handleSkip = () => {
    localStorage.setItem(`bw_done_${userId}_${weekStart}`, 'skip');
    onComplete();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        <div className={styles.header}>
          <span className={styles.headerEmoji}>⚖️</span>
          <div>
            <div className={styles.title}>
              {lang === 'ja' ? '週次体重測定' : 'Weekly Body Weight'}
            </div>
            <div className={styles.sub}>
              {lang === 'ja'
                ? 'アスレチックトレーナーまたは医療スタッフに測定してもらった体重を入力してください'
                : 'Enter the weight measured by your Athletic Trainer or Medical Staff'}
            </div>
          </div>
        </div>

        <div className={styles.body}>
          <div className={styles.inputRow}>
            <input
              className={styles.weightInput}
              type="number"
              step="0.1"
              min="30"
              max="250"
              value={weight}
              onChange={e => setWeight(e.target.value)}
              placeholder="e.g. 82.5"
              autoFocus
            />
            <span className={styles.unit}>kg</span>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.actions}>
          <button className={styles.skipBtn} onClick={handleSkip}>
            {lang === 'ja' ? 'スキップ' : 'Skip'}
          </button>
          <button className={styles.submitBtn} disabled={!valid || saving} onClick={handleSubmit}>
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
