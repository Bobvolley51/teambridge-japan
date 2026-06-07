'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toJstDateStr } from '@/lib/date';
import { sendAlertDM } from '@/lib/alertDM';
import { sendPush } from '@/lib/push';
import styles from './WellnessCheck.module.css';

const QUESTIONS = [
  { key: 'physical_readiness', en: 'Physical Readiness', ja: '身体の準備状態' },
  { key: 'mental_readiness',   en: 'Mental Readiness',   ja: 'メンタルの準備状態' },
  { key: 'sleep_quality',      en: 'Sleep Quality',      ja: '睡眠の質' },
];

const SLEEP_HOURS = [3, 4, 5, 6, 7, 8, 9, 10];

const AVAIL_OPTIONS = [
  { value: 100, en: 'Full',        ja: '全力OK',   cls: 'availFull' },
  { value: 50,  en: 'Limited',     ja: '制限あり', cls: 'availLtd'  },
  { value: 0,   en: 'Unavailable', ja: '不可',     cls: 'availNo'   },
];

const BODY_PART_LABELS = {
  shoulder_l:  'Left Shoulder',  shoulder_r:  'Right Shoulder',
  lower_back:  'Lower Back',     knee_l:      'Left Knee',
  knee_r:      'Right Knee',     ankle_l:     'Left Ankle',
  ankle_r:     'Right Ankle',    quad_l:      'Left Quad',
  quad_r:      'Right Quad',     hamstring_l: 'Left Hamstring',
  hamstring_r: 'Right Hamstring',
};

const ILLNESS_SYMPTOMS = [
  { key: 'illness_headache',   en: 'Headache',          ja: '頭痛' },
  { key: 'illness_fever',      en: 'Fever',             ja: '発熱' },
  { key: 'illness_sorethroat', en: 'Sore throat',       ja: '喉の痛み' },
  { key: 'illness_cough',      en: 'Cough',             ja: '咳' },
  { key: 'illness_runnynose',  en: 'Runny nose',        ja: '鼻水' },
  { key: 'illness_nausea',     en: 'Nausea',            ja: '吐き気' },
  { key: 'illness_malaise',    en: 'Fatigue / Malaise', ja: '倦怠感' },
  { key: 'illness_other',      en: 'Other',             ja: 'その他' },
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

function wellnessColor(v) {
  if (v == null) return '#9ca3af';
  if (v < 40)    return '#ef4444';
  if (v < 60)    return '#f59e0b';
  return '#10b981';
}

function painColor(v) {
  if (v == null) return '#9ca3af';
  if (v >= 70)   return '#ef4444';
  if (v >= 40)   return '#f59e0b';
  return '#10b981';
}

function sleepHourColor(h) {
  if (h >= 7) return '#10b981';
  if (h === 6) return '#f59e0b';
  return '#ef4444';
}

export default function WellnessCheck({ userId, userName, lang, onComplete }) {
  const [step,            setStep]            = useState(1);
  const [scores,          setScores]          = useState({});
  const [sleepHours,      setSleepHours]      = useState(null);
  const [availability,    setAvailability]    = useState(null);
  const [illness,         setIllness]         = useState(null);
  const [hasPain,         setHasPain]         = useState(null);
  const [illnessSymptoms, setIllnessSymptoms] = useState([]);
  const [bodyTemp,        setBodyTemp]        = useState('');
  const [painParts,       setPainParts]       = useState([]);
  const [painLevels,      setPainLevels]      = useState({});
  const [otherMessage,      setOtherMessage]      = useState('');
  const [illnessOtherText,  setIllnessOtherText]  = useState('');
  const [saving,          setSaving]          = useState(false);
  const [submitError,     setSubmitError]     = useState('');
  const [skipConfirm,     setSkipConfirm]     = useState(0); // 0=hidden, 1=first, 2=second

  const today = toJstDateStr(new Date());

  const handleSkip = async () => {
    if (skipConfirm < 2) { setSkipConfirm(s => s + 1); return; }
    // Mark today as done on the profile so the form won't re-appear
    await supabase.from('profiles').update({ last_wellness_date: today }).eq('id', userId);
    onComplete();
  };

  const allAnswered = QUESTIONS.every(q => scores[q.key] != null)
    && sleepHours   != null
    && availability != null
    && illness      !== null
    && hasPain      !== null;

  const answeredCount = Object.keys(scores).length
    + (sleepHours   != null ? 1 : 0)
    + (availability != null ? 1 : 0)
    + (illness      !== null ? 1 : 0)
    + (hasPain      !== null ? 1 : 0);
  const totalQ = QUESTIONS.length + 4;

  const needsPage2 = illness === 'yes' || hasPain === 'yes';
  const needsPage3 = painParts.includes('other');
  const totalSteps = needsPage2 ? (needsPage3 ? 3 : 2) : 1;

  const ratedParts    = painParts.filter(k => k !== 'other');
  const allPartsRated = (hasPain !== 'yes' || (painParts.length > 0 && ratedParts.every(k => painLevels[k] != null)))
    && (illness !== 'yes' || bodyTemp !== '');

  const toggleIllnessSymptom = key =>
    setIllnessSymptoms(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);

  const togglePart = key => {
    setPainParts(prev => {
      if (prev.includes(key)) {
        setPainLevels(l => { const c = { ...l }; delete c[key]; return c; });
        return prev.filter(k => k !== key);
      }
      return [...prev, key];
    });
  };

  const handleNext      = () => needsPage2 ? setStep(2) : handleSubmit();
  const handleNextPage2 = () => needsPage3 ? setStep(3) : handleSubmit();

  const handleSubmit = async () => {
    setSaving(true);
    setSubmitError('');
    const today = toJstDateStr(new Date());

    const wellnessRows = [
      ...QUESTIONS.map(q => ({
        user_id: userId, user_name: userName,
        question_key: q.key, score: scores[q.key], response_date: today,
      })),
      { user_id: userId, user_name: userName, question_key: 'sleep_hours',  score: sleepHours,   response_date: today },
      { user_id: userId, user_name: userName, question_key: 'availability', score: availability, response_date: today },
    ];

    const tempVal = illness === 'yes' && bodyTemp !== '' ? parseFloat(bodyTemp) : null;
    if (tempVal != null && !isNaN(tempVal)) {
      wellnessRows.push({
        user_id: userId, user_name: userName,
        question_key: 'temperature', score: tempVal, response_date: today,
      });
    }

    const { error: upsertError } = await supabase.from('wellness_responses').upsert(wellnessRows, {
      onConflict: 'user_id,question_key,response_date',
    });
    if (upsertError) {
      console.error('wellness_responses upsert failed:', upsertError);
      setSubmitError(lang === 'ja' ? '送信に失敗しました。再試行してください。' : 'Failed to submit wellness. Please try again.');
      setSaving(false);
      return;
    }

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

    // Notify on illness — in-app notification + push to Headcoach / Therapist / Athletic Trainer
    if (illness === 'yes') {
      const { data: recipients } = await supabase
        .from('profiles').select('id')
        .in('role', ['Athletic Trainer', 'Therapist', 'Headcoach']);
      if (recipients?.length) {
        const symptomList = illnessSymptoms.map(k => {
          const s = ILLNESS_SYMPTOMS.find(x => x.key === k);
          return s ? (lang === 'ja' ? s.ja : s.en) : k;
        }).join(', ');
        const tempStr  = tempVal != null && !isNaN(tempVal) ? ` — Temp: ${tempVal.toFixed(1)}°C` : '';
        const otherNote = illnessOtherText.trim() ? ` — Other: ${illnessOtherText.trim()}` : '';
        const body = `${symptomList || 'Illness reported'}${tempStr}${otherNote}`;
        await supabase.from('notifications').insert(
          recipients.map(r => ({
            user_id: r.id, type: 'wellness_illness',
            title: `${userName} reported illness`,
            body,
            nav_target: 'wellness',
          }))
        );
        // Push so staff are notified immediately even if app is closed
        sendPush(
          recipients.map(r => r.id),
          {
            title:   `🤒 ${userName} reported illness`,
            body:    body.length > 80 ? body.slice(0, 80) + '…' : body,
            url:     '/?nav=wellness',
            tag:     `illness-${userId}`,
            prefKey: 'wellness_illness',
          }
        );
      }
    }

    // Notify on "Other" pain
    if (needsPage3 && otherMessage.trim()) {
      const { data: recipients } = await supabase
        .from('profiles').select('id')
        .in('role', ['Athletic Trainer', 'Therapist']);
      if (recipients?.length) {
        await supabase.from('notifications').insert(
          recipients.map(r => ({
            user_id: r.id, type: 'wellness_other',
            title: `${userName} reported an unlisted pain`,
            body: otherMessage.trim(), nav_target: 'wellness',
          }))
        );
      }
    }

    // Alert DM for low wellness scores or high pain
    const alerts = [];
    for (const q of QUESTIONS) {
      if (scores[q.key] != null && scores[q.key] < 40) {
        alerts.push(`⚠️ Low ${q.en.toLowerCase()}: ${scores[q.key]}/100`);
      }
    }
    if (illness === 'yes') {
      const symptomList = illnessSymptoms.map(k => {
        const s = ILLNESS_SYMPTOMS.find(x => x.key === k);
        return s ? (lang === 'ja' ? s.ja : s.en) : k;
      }).join(', ');
      const tempStr = tempVal != null && !isNaN(tempVal) ? ` — Temp: ${tempVal.toFixed(1)}°C` : '';
      alerts.push(`🤒 Illness${symptomList ? `: ${symptomList}` : ''}${tempStr}`);
    }
    const highPainParts = ratedParts.filter(k => (painLevels[k] ?? 0) >= 40);
    if (highPainParts.length > 0) {
      const partList = highPainParts.map(k => `${BODY_PART_LABELS[k] ?? k} (${painLevels[k]}/100)`).join(', ');
      alerts.push(`🩹 Pain: ${partList}`);
    }
    if (alerts.length > 0) {
      sendAlertDM(userId, userName, [`📋 Wellness — ${userName}`, ...alerts]).catch(() => {});
    }

    setSaving(false);
    onComplete();
  };

  const stepLabel = s => `${s}/${totalSteps}`;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <>
            <div className={styles.contextBanner}>
              📅 {lang === 'ja' ? `${today} のチェックイン` : `Check-in for ${today}`}
            </div>
            <div className={styles.header}>
              <span className={styles.headerEmoji}>💪</span>
              <div>
                <div className={styles.title}>
                  {lang === 'ja' ? `今日のチェックイン (${stepLabel(1)})` : `Daily Check-in (${stepLabel(1)})`}
                </div>
                <div className={styles.sub}>
                  {lang === 'ja' ? '0 = 最悪　100 = 完璧' : '0 = worst  ·  100 = perfect'}
                </div>
              </div>
            </div>

            <div className={styles.progress}>
              <div className={styles.progressBar} style={{ width: `${(answeredCount / totalQ) * 100}%` }} />
            </div>

            <div className={styles.body}>

              {/* 0-100 slider questions */}
              {QUESTIONS.map((q, qi) => {
                const val   = scores[q.key];
                const color = wellnessColor(val);
                return (
                  <div key={q.key} className={styles.qBlock}>
                    <div className={styles.qText}>
                      <span className={styles.qNum}>{qi + 1}</span>
                      {lang === 'ja' ? q.ja : q.en}
                    </div>
                    <div className={styles.sliderRow}>
                      <span className={styles.scaleLabel}>{lang === 'ja' ? '最悪' : '0'}</span>
                      <div className={styles.sliderWrap}>
                        <input
                          type="range" min={0} max={100} step={5}
                          value={val ?? 50}
                          className={styles.slider}
                          style={{ accentColor: color }}
                          onChange={e => setScores(p => ({ ...p, [q.key]: +e.target.value }))}
                        />
                        <span className={styles.sliderVal} style={{ color, borderColor: color }}>
                          {val ?? '—'}
                        </span>
                      </div>
                      <span className={styles.scaleLabel}>{lang === 'ja' ? '完璧' : '100'}</span>
                    </div>
                  </div>
                );
              })}

              {/* Sleep hours */}
              <div className={styles.qBlock}>
                <div className={styles.qText}>
                  <span className={styles.qNum}>{QUESTIONS.length + 1}</span>
                  {lang === 'ja' ? '昨夜の睡眠時間' : 'Hours of sleep last night'}
                </div>
                <div className={styles.sleepHourBtns}>
                  {SLEEP_HOURS.map(h => {
                    const sel = sleepHours === h;
                    const c   = sleepHourColor(h);
                    return (
                      <button key={h} className={styles.sleepHourBtn}
                        style={sel ? { background: c, color: '#fff', borderColor: c } : {}}
                        onClick={() => setSleepHours(h)}>
                        {h === 10 ? '10+' : h}
                      </button>
                    );
                  })}
                </div>
                {sleepHours != null && (
                  <div className={styles.sleepHint} style={{ color: sleepHourColor(sleepHours) }}>
                    {sleepHours >= 7
                      ? (lang === 'ja' ? '✓ 良好' : '✓ Good')
                      : sleepHours === 6
                        ? (lang === 'ja' ? '△ 普通' : '△ OK')
                        : (lang === 'ja' ? '✗ 不足' : '✗ Too little')}
                  </div>
                )}
              </div>

              {/* Availability */}
              <div className={styles.qBlock}>
                <div className={styles.qText}>
                  <span className={styles.qNum}>{QUESTIONS.length + 2}</span>
                  {lang === 'ja' ? '今日の練習参加状況' : 'Availability today'}
                </div>
                <div className={styles.availBtns}>
                  {AVAIL_OPTIONS.map(opt => {
                    const sel = availability === opt.value;
                    return (
                      <button key={opt.value}
                        className={`${styles.availBtn} ${sel ? styles[opt.cls] : ''}`}
                        onClick={() => setAvailability(opt.value)}>
                        {lang === 'ja' ? opt.ja : opt.en}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Illness */}
              <div className={styles.qBlock}>
                <div className={styles.qText}>
                  <span className={styles.qNum}>{QUESTIONS.length + 3}</span>
                  {lang === 'ja' ? '体調不良・病気の症状はありますか？' : 'Any illness symptoms today?'}
                </div>
                <div className={styles.yesNoRow}>
                  <button className={`${styles.yesNoBtn} ${illness === 'no' ? styles.yesNoBtnNo : ''}`}
                    onClick={() => setIllness('no')}>
                    {lang === 'ja' ? 'いいえ' : 'No'}
                  </button>
                  <button className={`${styles.yesNoBtn} ${illness === 'yes' ? styles.yesNoBtnYes : ''}`}
                    onClick={() => setIllness('yes')}>
                    {lang === 'ja' ? 'はい' : 'Yes'}
                  </button>
                </div>
              </div>

              {/* Pain */}
              <div className={styles.qBlock}>
                <div className={styles.qText}>
                  <span className={styles.qNum}>{QUESTIONS.length + 4}</span>
                  {lang === 'ja' ? '体の痛みや違和感はありますか？' : 'Any body pain or soreness today?'}
                </div>
                <div className={styles.yesNoRow}>
                  <button className={`${styles.yesNoBtn} ${hasPain === 'no' ? styles.yesNoBtnNo : ''}`}
                    onClick={() => setHasPain('no')}>
                    {lang === 'ja' ? 'いいえ' : 'No'}
                  </button>
                  <button className={`${styles.yesNoBtn} ${hasPain === 'yes' ? styles.yesNoBtnYes : ''}`}
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
            <div className={styles.skipArea}>
              {skipConfirm === 0 && (
                <button className={styles.skipBtn} onClick={() => setSkipConfirm(1)}>
                  {lang === 'ja' ? '既に回答済み' : 'Already answered today'}
                </button>
              )}
              {skipConfirm === 1 && (
                <div className={styles.skipConfirm}>
                  <span>{lang === 'ja' ? '本当に今日はもう回答しましたか？' : 'Are you sure you already answered today?'}</span>
                  <button className={styles.skipConfirmBtn} onClick={() => setSkipConfirm(2)}>
                    {lang === 'ja' ? 'はい' : 'Yes'}
                  </button>
                  <button className={styles.skipCancelBtn} onClick={() => setSkipConfirm(0)}>
                    {lang === 'ja' ? 'いいえ' : 'No'}
                  </button>
                </div>
              )}
              {skipConfirm === 2 && (
                <div className={styles.skipConfirm}>
                  <span>{lang === 'ja' ? '今日のフォームを閉じますか？' : 'Dismiss this form for today?'}</span>
                  <button className={styles.skipConfirmBtn} onClick={handleSkip} disabled={saving}>
                    {lang === 'ja' ? '確認して閉じる' : 'Confirm & close'}
                  </button>
                  <button className={styles.skipCancelBtn} onClick={() => setSkipConfirm(0)}>
                    {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                  </button>
                </div>
              )}
            </div>
            {submitError && (
              <div style={{ color: '#b91c1c', marginTop: 10, fontSize: 13 }}>
                {submitError}
              </div>
            )}
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
                  {illnessSymptoms.includes('illness_other') && (
                    <div className={styles.otherMessageBlock}>
                      <label className={styles.otherMessageLabel}>
                        {lang === 'ja' ? 'その他の症状を教えてください' : 'Please describe your other symptoms:'}
                      </label>
                      <textarea
                        className={styles.otherMessageArea} rows={3}
                        value={illnessOtherText} onChange={e => setIllnessOtherText(e.target.value)}
                        placeholder={lang === 'ja' ? '例：目が充血している...' : 'e.g. Red eyes, dizziness…'}
                      />
                    </div>
                  )}
                  <div className={styles.tempRow}>
                    <label className={styles.tempLabel}>
                      🌡️ {lang === 'ja' ? '体温（°C）' : 'Body temperature (°C)'}
                      <span className={styles.tempRequired}>*</span>
                    </label>
                    <div className={styles.tempInputWrap}>
                      <input
                        className={`${styles.tempInput} ${bodyTemp === '' ? styles.tempInputEmpty : ''}`}
                        type="number" step="0.1" min="35" max="42"
                        value={bodyTemp} onChange={e => setBodyTemp(e.target.value)}
                        placeholder="e.g. 36.5"
                      />
                      {bodyTemp === '' && (
                        <span className={styles.tempHint}>
                          {lang === 'ja' ? '必須' : 'Required'}
                        </span>
                      )}
                    </div>
                  </div>
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

                  {ratedParts.length > 0 && (
                    <div className={styles.partRatings}>
                      <div className={styles.partRatingsTitle}>
                        {lang === 'ja'
                          ? '各部位の痛みの強さ（0 = なし　100 = 最悪）'
                          : 'Pain level per area — 0 (none) to 100 (worst)'}
                      </div>
                      {ratedParts.map(partKey => {
                        const part  = BODY_PARTS.find(p => p.key === partKey);
                        const val   = painLevels[partKey];
                        const color = painColor(val);
                        return (
                          <div key={partKey} className={styles.partRatingRow}>
                            <div className={styles.partRatingLabel}>{lang === 'ja' ? part.ja : part.en}</div>
                            <div className={styles.sliderWrap} style={{ flex: 1 }}>
                              <input
                                type="range" min={0} max={100} step={5}
                                value={val ?? 50}
                                className={styles.slider}
                                style={{ accentColor: color }}
                                onChange={e => setPainLevels(p => ({ ...p, [partKey]: +e.target.value }))}
                              />
                              <span className={styles.sliderVal} style={{ color, borderColor: color }}>
                                {val ?? '—'}
                              </span>
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
                  {lang === 'ja' ? 'どのような痛みや症状ですか？' : 'Describe your pain or concern:'}
                </label>
                <textarea
                  className={styles.otherMessageArea} rows={5}
                  value={otherMessage} onChange={e => setOtherMessage(e.target.value)}
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
