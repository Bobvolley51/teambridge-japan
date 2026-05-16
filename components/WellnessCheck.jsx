'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sendAlertDM } from '@/lib/alertDM';
import styles from './WellnessCheck.module.css';

const SCORE_LABELS = {
  fatigue:  { en: 'Fatigue',   ja: '疲労' },
  sleep:    { en: 'Sleep',     ja: '睡眠' },
  appetite: { en: 'Appetite',  ja: '食欲' },
};

const BODY_PART_LABELS = {
  shoulder_l:  'Left Shoulder',  shoulder_r:  'Right Shoulder',
  lower_back:  'Lower Back',     knee_l:      'Left Knee',
  knee_r:      'Right Knee',     ankle_l:     'Left Ankle',
  ankle_r:     'Right Ankle',    quad_l:      'Left Quad',
  quad_r:      'Right Quad',     hamstring_l: 'Left Hamstring',
  hamstring_r: 'Right Hamstring',
};

const SYMPTOM_LABELS = {
  illness_headache:   'Headache',   illness_fever:     'Fever',
  illness_sorethroat: 'Sore throat',illness_cough:     'Cough',
  illness_runnynose:  'Runny nose', illness_nausea:    'Nausea',
  illness_malaise:    'Fatigue/Malaise', illness_other: 'Other',
};

const QUESTIONS = [
  { key: 'fatigue',  en: 'Fatigue level today',       ja: '今日の疲労レベルは？' },
  { key: 'sleep',    en: 'Sleep quality & duration',  ja: '睡眠の質と時間は？' },
  { key: 'appetite', en: 'Appetite',                  ja: '食欲は？' },
];

const ILLNESS_SYMPTOMS = [
  { key: 'illness_headache',   en: 'Headache',         ja: '頭痛' },
  { key: 'illness_fever',      en: 'Fever',            ja: '発熱' },
  { key: 'illness_sorethroat', en: 'Sore throat',      ja: '喉の痛み' },
  { key: 'illness_cough',      en: 'Cough',            ja: '咳' },
  { key: 'illness_runnynose',  en: 'Runny nose',       ja: '鼻水' },
  { key: 'illness_nausea',     en: 'Nausea',           ja: '吐き気' },
  { key: 'illness_malaise',    en: 'Fatigue / Malaise',ja: '倦怠感' },
  { key: 'illness_other',      en: 'Other',            ja: 'その他' },
];

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
  { key: 'other',       en: 'Other',           ja: 'その他' },
];

function btnStyle(score, selected) {
  if (!selected) return {};
  if (score <= 3) return { background: '#ef4444', color: '#fff', borderColor: '#ef4444' };
  if (score <= 6) return { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' };
  return { background: '#10b981', color: '#fff', borderColor: '#10b981' };
}

function painBtnStyle(score, selected) {
  if (!selected) return {};
  if (score <= 3) return { background: '#10b981', color: '#fff', borderColor: '#10b981' };
  if (score <= 6) return { background: '#f59e0b', color: '#fff', borderColor: '#f59e0b' };
  return { background: '#ef4444', color: '#fff', borderColor: '#ef4444' };
}

export default function WellnessCheck({ userId, userName, lang, onComplete }) {
  const [step,            setStep]            = useState(1);
  const [scores,          setScores]          = useState({});
  const [illness,         setIllness]         = useState(null);
  const [hasPain,         setHasPain]         = useState(null);
  const [illnessSymptoms, setIllnessSymptoms] = useState([]);
  const [bodyTemp,        setBodyTemp]        = useState('');
  const [painParts,       setPainParts]       = useState([]);
  const [painLevels,      setPainLevels]      = useState({});
  const [otherMessage,    setOtherMessage]    = useState('');
  const [saving,          setSaving]          = useState(false);

  const allAnswered   = QUESTIONS.every(q => scores[q.key] != null) && illness !== null && hasPain !== null;
  const answeredCount = Object.keys(scores).length + (illness !== null ? 1 : 0) + (hasPain !== null ? 1 : 0);
  const totalQ        = QUESTIONS.length + 2;

  const needsPage2 = illness === 'yes' || hasPain === 'yes';
  const needsPage3 = painParts.includes('other');

  const totalSteps = needsPage2 ? (needsPage3 ? 3 : 2) : 1;

  // All selected non-"other" parts must have a pain level rated
  const ratedParts   = painParts.filter(k => k !== 'other');
  const allPartsRated = hasPain !== 'yes' || (ratedParts.length > 0 && ratedParts.every(k => painLevels[k] != null));

  const toggleIllnessSymptom = (key) =>
    setIllnessSymptoms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const togglePart = (key) => {
    setPainParts(prev => {
      if (prev.includes(key)) {
        setPainLevels(l => { const c = { ...l }; delete c[key]; return c; });
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleNext = () => needsPage2 ? setStep(2) : handleSubmit();
  const handleNextPage2 = () => needsPage3 ? setStep(3) : handleSubmit();

  const handleSubmit = async () => {
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);

    const wellnessRows = QUESTIONS.map(q => ({
      user_id: userId, user_name: userName,
      question_key: q.key, score: scores[q.key], response_date: today,
    }));

    // Temperature: only save when fever is selected AND value is above normal
    const hasFever = illnessSymptoms.includes('illness_fever');
    const tempVal  = hasFever && bodyTemp !== '' ? parseFloat(bodyTemp) : null;
    if (tempVal != null && !isNaN(tempVal) && tempVal > 37.0) {
      wellnessRows.push({
        user_id: userId, user_name: userName,
        question_key: 'temperature', score: tempVal, response_date: today,
      });
    }

    await supabase.from('wellness_responses').upsert(wellnessRows, {
      onConflict: 'user_id,question_key,response_date',
    });

    await supabase.from('wellness_body_pain')
      .delete().eq('user_id', userId).eq('response_date', today);

    const painRows = [
      ...painParts.map(part => ({
        user_id: userId, user_name: userName, response_date: today,
        body_part: part,
        pain_level: part === 'other' ? null : (painLevels[part] ?? null),
      })),
      ...illnessSymptoms.map(sym => ({
        user_id: userId, user_name: userName, response_date: today,
        body_part: sym, pain_level: null,
      })),
    ];
    if (painRows.length > 0) {
      await supabase.from('wellness_body_pain').insert(painRows);
    }

    // Send notification to Athletic Trainers and Therapists if "Other" pain was reported
    if (needsPage3 && otherMessage.trim()) {
      const { data: recipients } = await supabase
        .from('profiles')
        .select('id')
        .in('role', ['Athletic Trainer', 'Therapist']);

      if (recipients?.length) {
        await supabase.from('notifications').insert(
          recipients.map(r => ({
            user_id:    r.id,
            type:       'wellness_other',
            title:      `${userName} reported an unlisted pain`,
            body:       otherMessage.trim(),
            nav_target: 'wellness',
          }))
        );
      }
    }

    // Build alert lines for any alarming values
    const alerts = [];

    for (const q of QUESTIONS) {
      if (scores[q.key] != null && scores[q.key] <= 3) {
        alerts.push(`⚠️ Low ${SCORE_LABELS[q.key].en.toLowerCase()} score: ${scores[q.key]}/10`);
      }
    }

    if (illness === 'yes') {
      const symptomList = illnessSymptoms.map(k => SYMPTOM_LABELS[k] ?? k).join(', ');
      const tempStr = tempVal != null && !isNaN(tempVal) ? ` — Temp: ${tempVal.toFixed(1)}°C` : '';
      alerts.push(`🤒 Illness reported${symptomList ? `: ${symptomList}` : ''}${tempStr}`);
    }

    // Per-body-part high pain alerts
    const highPainParts = ratedParts.filter(k => (painLevels[k] ?? 0) >= 7);
    if (highPainParts.length > 0) {
      const partList = highPainParts.map(k => `${BODY_PART_LABELS[k] ?? k} (${painLevels[k]}/10)`).join(', ');
      alerts.push(`🩹 High pain: ${partList}`);
    }

    if (alerts.length > 0) {
      sendAlertDM(userId, userName, [`📋 Wellness check — ${userName}`, ...alerts]).catch(() => {});
    }

    setSaving(false);
    onComplete();
  };

  const stepLabel = (s) => `${s}/${totalSteps}`;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>💪</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? `今日のチェックイン (${stepLabel(1)})` : `Daily Check-in (${stepLabel(1)})`}
                </div>
                <div className={styles.sub}>
                  {lang === 'ja'
                    ? '今日の状態を教えてください（10が最高）'
                    : 'Rate how you feel today — 1 (worst) to 10 (best)'}
                </div>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: `${(answeredCount / totalQ) * 100}%` }} />
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

              <div className={styles.qBlock}>
                <div className={styles.qText}>
                  <span className={styles.qNum}>{QUESTIONS.length + 1}</span>
                  {lang === 'ja' ? '体調不良・病気の症状はありますか？' : 'Any illness symptoms today?'}
                </div>
                <div className={styles.yesNoRow}>
                  <button
                    className={`${styles.yesNoBtn} ${illness === 'no' ? styles.yesNoBtnNo : ''}`}
                    onClick={() => setIllness('no')}>
                    {lang === 'ja' ? 'いいえ' : 'No'}
                  </button>
                  <button
                    className={`${styles.yesNoBtn} ${illness === 'yes' ? styles.yesNoBtnYes : ''}`}
                    onClick={() => setIllness('yes')}>
                    {lang === 'ja' ? 'はい' : 'Yes'}
                  </button>
                </div>
              </div>

              <div className={styles.qBlock}>
                <div className={styles.qText}>
                  <span className={styles.qNum}>{QUESTIONS.length + 2}</span>
                  {lang === 'ja' ? '体の痛みや違和感はありますか？' : 'Any body pain or soreness today?'}
                </div>
                <div className={styles.yesNoRow}>
                  <button
                    className={`${styles.yesNoBtn} ${hasPain === 'no' ? styles.yesNoBtnNo : ''}`}
                    onClick={() => setHasPain('no')}>
                    {lang === 'ja' ? 'いいえ' : 'No'}
                  </button>
                  <button
                    className={`${styles.yesNoBtn} ${hasPain === 'yes' ? styles.yesNoBtnYes : ''}`}
                    onClick={() => setHasPain('yes')}>
                    {lang === 'ja' ? 'はい' : 'Yes'}
                  </button>
                </div>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.submitBtn} disabled={!allAnswered} onClick={handleNext}>
                {needsPage2
                  ? (lang === 'ja' ? '次へ →' : 'Next →')
                  : (lang === 'ja' ? '送信する' : 'Submit')}
              </button>
            </div>
            <p className={styles.privacyNote}>
              🔒 {lang === 'ja'
                ? 'このデータはヘッドコーチ、アスレチックトレーナー、フィジオのみ閲覧できます'
                : 'Visible to Head Coach, Athletic Trainer & Physiotherapist only'}
            </p>
          </>
        )}

        {/* ── Step 2: illness + body parts ── */}
        {step === 2 && (
          <>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>{illness === 'yes' && hasPain !== 'yes' ? '🤒' : '🦵'}</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? `詳細 (${stepLabel(2)})` : `Details (${stepLabel(2)})`}
                </div>
                <div className={styles.sub}>
                  {lang === 'ja' ? '該当する項目を選んでください' : 'Select all that apply'}
                </div>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: `${(2 / totalSteps) * 100}%` }} />
            </div>

            <div className={styles.body}>
              {illness === 'yes' && (
                <div className={styles.followUpSection}>
                  <div className={styles.followUpTitle}>
                    {lang === 'ja' ? '症状を選んでください' : 'What symptoms do you have?'}
                  </div>
                  <div className={styles.partsGrid}>
                    {ILLNESS_SYMPTOMS.map(sym => {
                      const selected = illnessSymptoms.includes(sym.key);
                      return (
                        <button key={sym.key}
                          className={`${styles.partBtn} ${selected ? styles.partBtnSelected : ''}`}
                          onClick={() => toggleIllnessSymptom(sym.key)}>
                          {selected ? '✓ ' : ''}{lang === 'ja' ? sym.ja : sym.en}
                        </button>
                      );
                    })}
                  </div>

                  {/* Temperature — only when Fever is selected */}
                  {illnessSymptoms.includes('illness_fever') && (
                    <div className={styles.tempRow}>
                      <label className={styles.tempLabel}>
                        🌡️ {lang === 'ja' ? '体温（°C）' : 'Body temperature (°C)'}
                      </label>
                      <input
                        className={styles.tempInput}
                        type="number"
                        step="0.1"
                        min="37"
                        max="42"
                        value={bodyTemp}
                        onChange={e => setBodyTemp(e.target.value)}
                        placeholder="e.g. 38.5"
                        autoFocus
                      />
                    </div>
                  )}
                </div>
              )}

              {hasPain === 'yes' && (
                <div className={styles.followUpSection}>
                  <div className={styles.followUpTitle}>
                    {lang === 'ja' ? '痛みや張りがある箇所を選んでください' : 'Where do you have pain or tightness?'}
                  </div>
                  <div className={styles.partsGrid}>
                    {BODY_PARTS.map(part => {
                      const selected = painParts.includes(part.key);
                      const isOther  = part.key === 'other';
                      return (
                        <button key={part.key}
                          className={`${styles.partBtn} ${selected ? styles.partBtnSelected : ''} ${isOther ? styles.partBtnOther : ''}`}
                          onClick={() => togglePart(part.key)}>
                          {selected ? '✓ ' : ''}{lang === 'ja' ? part.ja : part.en}
                        </button>
                      );
                    })}
                  </div>

                  {/* Per-part pain level rating */}
                  {ratedParts.length > 0 && (
                    <div className={styles.partRatings}>
                      <div className={styles.partRatingsTitle}>
                        {lang === 'ja'
                          ? '各部位の痛みの強さ（1＝軽い・10＝最悪）'
                          : 'Rate pain in each area — 1 (mild) to 10 (worst)'}
                      </div>
                      {ratedParts.map(partKey => {
                        const part = BODY_PARTS.find(p => p.key === partKey);
                        return (
                          <div key={partKey} className={styles.partRatingRow}>
                            <div className={styles.partRatingLabel}>
                              {lang === 'ja' ? part.ja : part.en}
                            </div>
                            <div className={styles.scaleBtns}>
                              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                                <button key={n} className={styles.scaleBtn}
                                  style={painBtnStyle(n, painLevels[partKey] === n)}
                                  onClick={() => setPainLevels(prev => ({ ...prev, [partKey]: n }))}>
                                  {n}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep(1)}>
                ← {lang === 'ja' ? '戻る' : 'Back'}
              </button>
              <button className={styles.submitBtn} disabled={saving || !allPartsRated} onClick={handleNextPage2}>
                {needsPage3
                  ? (lang === 'ja' ? '次へ →' : 'Next →')
                  : (saving ? '…' : (lang === 'ja' ? '送信する' : 'Submit'))}
              </button>
            </div>
          </>
        )}

        {/* ── Step 3: Other pain message ── */}
        {step === 3 && (
          <>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>📩</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? `メッセージ (${stepLabel(3)})` : `Message (${stepLabel(3)})`}
                </div>
                <div className={styles.sub}>
                  {lang === 'ja'
                    ? 'トレーナー・フィジオに直接メッセージを送ります'
                    : 'This message goes directly to the Trainer & Therapist'}
                </div>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: '100%' }} />
            </div>

            <div className={styles.body}>
              <div className={styles.otherMessageBlock}>
                <label className={styles.otherMessageLabel}>
                  {lang === 'ja'
                    ? 'どのような痛みや症状ですか？'
                    : 'Describe your pain or concern:'}
                </label>
                <textarea
                  className={styles.otherMessageArea}
                  rows={5}
                  value={otherMessage}
                  onChange={e => setOtherMessage(e.target.value)}
                  placeholder={lang === 'ja'
                    ? '例：練習中に右肩の外側が痛む...'
                    : 'e.g. Sharp pain on the outside of my right shoulder during serving…'}
                  autoFocus
                />
                <p className={styles.otherMessageHint}>
                  🔒 {lang === 'ja'
                    ? 'アスレチックトレーナーとフィジオにのみ送信されます'
                    : 'Sent only to Athletic Trainer & Therapist'}
                </p>
              </div>
            </div>

            <div className={styles.actions}>
              <button className={styles.backBtn} onClick={() => setStep(2)}>
                ← {lang === 'ja' ? '戻る' : 'Back'}
              </button>
              <button className={styles.submitBtn} disabled={saving || !otherMessage.trim()} onClick={handleSubmit}>
                {saving ? '…' : (lang === 'ja' ? '送信する' : 'Submit')}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
