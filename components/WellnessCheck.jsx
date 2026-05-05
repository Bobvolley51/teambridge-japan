'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './WellnessCheck.module.css';

const QUESTIONS = [
  { key: 'fatigue',     en: 'Fatigue level today',                          ja: '今日の疲労レベルは？' },
  { key: 'sleep',       en: 'Sleep quality & duration',                     ja: '睡眠の質と時間は？' },
  { key: 'appetite',    en: 'Appetite',                                      ja: '食欲は？' },
  { key: 'temperature', en: 'Body temperature / symptoms (headache, cough)', ja: '体温・症状（頭痛・咳など）は？' },
  { key: 'pain',        en: 'Overall body pain level',                       ja: '全身の痛みレベルは？' },
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

function btnStyle(score, selected) {
  if (!selected) return {};
  if (score <= 3) return { background: '#ef4444', color: '#fff', borderColor: '#ef4444' };
  if (score <= 6) return { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' };
  return { background: '#10b981', color: '#fff', borderColor: '#10b981' };
}

export default function WellnessCheck({ userId, userName, lang, onComplete }) {
  const [step,      setStep]      = useState(1);
  const [scores,    setScores]    = useState({});
  const [painParts, setPainParts] = useState([]);
  const [saving,    setSaving]    = useState(false);

  const allAnswered    = QUESTIONS.every(q => scores[q.key] != null);
  const answeredCount  = Object.keys(scores).length;

  const togglePart = (key) =>
    setPainParts(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const handleSubmit = async () => {
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);

    await supabase.from('wellness_responses').upsert(
      QUESTIONS.map(q => ({
        user_id:       userId,
        user_name:     userName,
        question_key:  q.key,
        score:         scores[q.key],
        response_date: today,
      })),
      { onConflict: 'user_id,question_key,response_date' }
    );

    await supabase.from('wellness_body_pain')
      .delete()
      .eq('user_id', userId)
      .eq('response_date', today);

    if (painParts.length > 0) {
      await supabase.from('wellness_body_pain').insert(
        painParts.map(part => ({
          user_id:       userId,
          user_name:     userName,
          response_date: today,
          body_part:     part,
        }))
      );
    }

    setSaving(false);
    onComplete();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* ── Step 1: Score questions ── */}
        {step === 1 && (
          <>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>💪</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? '今日のチェックイン (1/2)' : 'Daily Check-in (1/2)'}
                </div>
                <div className={styles.sub}>
                  {lang === 'ja'
                    ? '今日の状態を1〜10で教えてください（10が最高）'
                    : 'Rate how you feel today — 1 (worst) to 10 (best)'}
                </div>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: `${(answeredCount / QUESTIONS.length) * 100}%` }} />
            </div>

            <div className={styles.body}>
              {QUESTIONS.map((q, qi) => (
                <div key={q.key} className={styles.qBlock}>
                  <div className={styles.qText}>
                    <span className={styles.qNum}>{qi + 1}</span>
                    {lang === 'ja' ? q.ja : q.en}
                  </div>
                  <div className={styles.scale}>
                    <span className={styles.scaleLabel}>{lang === 'ja' ? '最悪' : 'Worst'}</span>
                    <div className={styles.scaleBtns}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                        <button key={n} className={styles.scaleBtn}
                          style={btnStyle(n, scores[q.key] === n)}
                          onClick={() => setScores(prev => ({ ...prev, [q.key]: n }))}>
                          {n}
                        </button>
                      ))}
                    </div>
                    <span className={styles.scaleLabel}>{lang === 'ja' ? '最高' : 'Best'}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.actions}>
              <button className={styles.submitBtn} disabled={!allAnswered} onClick={() => setStep(2)}>
                {lang === 'ja' ? '次へ →' : 'Next →'}
              </button>
            </div>
            <p className={styles.privacyNote}>
              🔒 {lang === 'ja'
                ? 'このデータはヘッドコーチ、アスレチックトレーナー、フィジオのみ閲覧できます'
                : 'Visible to Head Coach, Athletic Trainer & Physiotherapist only'}
            </p>
          </>
        )}

        {/* ── Step 2: Body parts ── */}
        {step === 2 && (
          <>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>🦵</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? '体の痛み・張り (2/2)' : 'Body Pain & Tightness (2/2)'}
                </div>
                <div className={styles.sub}>
                  {lang === 'ja'
                    ? '痛みや張りがある箇所を選んでください（任意）'
                    : 'Select areas with pain or tightness — optional'}
                </div>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: '100%' }} />
            </div>

            <div className={styles.body}>
              <div className={styles.partsGrid}>
                {BODY_PARTS.map(part => {
                  const selected = painParts.includes(part.key);
                  return (
                    <button key={part.key}
                      className={`${styles.partBtn} ${selected ? styles.partBtnSelected : ''}`}
                      onClick={() => togglePart(part.key)}>
                      {selected ? '✓ ' : ''}{lang === 'ja' ? part.ja : part.en}
                    </button>
                  );
                })}
              </div>
              {painParts.length === 0 && (
                <p className={styles.noPainHint}>
                  {lang === 'ja' ? '痛みなし — そのまま送信できます' : 'No pain — you can submit without selecting anything'}
                </p>
              )}
            </div>

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep(1)}>
                ← {lang === 'ja' ? '戻る' : 'Back'}
              </button>
              <button className={styles.submitBtn} disabled={saving} onClick={handleSubmit}>
                {saving ? '…' : (lang === 'ja' ? '送信する' : 'Submit')}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
