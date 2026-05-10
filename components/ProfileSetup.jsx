'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './ProfileSetup.module.css';

const POSITIONS = ['Setter', 'Outside', 'Middle', 'Opposite', 'Libero'];

export default function ProfileSetup({ userId, currentRole, lang, onComplete }) {
  const isJa     = lang === 'ja';
  const isPlayer = currentRole === 'Player';

  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [dob,        setDob]        = useState('');
  const [position,   setPosition]   = useState('');
  const [jersey,     setJersey]     = useState('');
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');

  const canSubmit = firstName.trim() && lastName.trim() && dob;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError('');

    const updates = {
      first_name:   firstName.trim(),
      last_name:    lastName.trim(),
      display_name: `${firstName.trim()} ${lastName.trim()}`,
      date_of_birth: dob,
      ...(isPlayer && position  ? { position }                                 : {}),
      ...(isPlayer && jersey !== '' ? { jersey_number: Number(jersey) || null } : {}),
    };

    const { error: err } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId);

    if (err) { setError(err.message); setSaving(false); return; }
    onComplete(updates);
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.emoji}>👤</span>
          <div>
            <div className={styles.title}>
              {isJa ? 'プロフィールを完成させてください' : 'Complete Your Profile'}
            </div>
            <div className={styles.sub}>
              {isJa
                ? 'アプリを使い始める前に、以下の情報を入力してください'
                : 'Please fill in your details before using the app'}
            </div>
          </div>
        </div>

        <form className={styles.form} onSubmit={handleSave}>
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>
                {isJa ? '名（First Name）' : 'First Name'} *
              </label>
              <input
                className={styles.input}
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder={isJa ? '例：太郎' : 'e.g. Thomas'}
                autoFocus
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                {isJa ? '姓（Last Name）' : 'Last Name'} *
              </label>
              <input
                className={styles.input}
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                placeholder={isJa ? '例：山田' : 'e.g. Ranner'}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              {isJa ? '生年月日' : 'Date of Birth'} *
            </label>
            <input
              className={styles.input}
              type="date"
              value={dob}
              onChange={e => setDob(e.target.value)}
            />
          </div>

          {isPlayer && (
            <div className={styles.row}>
              <div className={styles.field}>
                <label className={styles.label}>
                  {isJa ? 'ポジション' : 'Position'}
                </label>
                <select
                  className={styles.input}
                  value={position}
                  onChange={e => setPosition(e.target.value)}
                >
                  <option value="">{isJa ? '選択…' : 'Select…'}</option>
                  {POSITIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>
                  {isJa ? '背番号' : 'Jersey Number'}
                </label>
                <input
                  className={styles.input}
                  type="number"
                  min="0"
                  max="99"
                  value={jersey}
                  onChange={e => setJersey(e.target.value)}
                  placeholder="e.g. 7"
                />
              </div>
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}

          <button
            type="submit"
            className={styles.btn}
            disabled={!canSubmit || saving}
          >
            {saving ? '…' : (isJa ? '保存して始める →' : 'Save & Continue →')}
          </button>
        </form>
      </div>
    </div>
  );
}
