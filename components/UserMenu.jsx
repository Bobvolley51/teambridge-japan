'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import InstallPrompt from './InstallPrompt';
import styles from './UserMenu.module.css';

const POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Libero'];

export default function UserMenu({ user, profile, lang, onProfileUpdate }) {
  const [open,        setOpen]        = useState(false);
  const [view,        setView]        = useState('menu'); // 'menu' | 'profile' | 'calendar' | 'install'
  const [calCopied,   setCalCopied]   = useState(false);
  const [showPwForm,  setShowPwForm]  = useState(false);
  const [oldPw,       setOldPw]       = useState('');
  const [newPw,       setNewPw]       = useState('');
  const [confirmPw,   setConfirmPw]   = useState('');
  const [uploading,   setUploading]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [showDelConfirm, setShowDelConfirm] = useState(false);
  const [msg,         setMsg]         = useState(null);

  // Profile fields
  const [firstName,   setFirstName]   = useState('');
  const [lastName,    setLastName]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [dob,         setDob]         = useState('');
  const [position,    setPosition]    = useState('');
  const [jersey,      setJersey]      = useState('');

  const fileRef = useRef(null);
  const ref     = useRef(null);

  const isPlayer  = profile?.role === 'Player';
  const initials  = (user.email ?? 'U').slice(0, 2).toUpperCase();
  const avatarUrl = profile?.avatar_url ?? null;
  const name      = profile?.display_name || user.email;

  useEffect(() => {
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setDisplayName(profile?.display_name ?? '');
    setDob(profile?.date_of_birth ?? '');
    setPosition(profile?.position ?? '');
    setJersey(profile?.jersey_number != null ? String(profile.jersey_number) : '');
  }, [profile]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setView('menu'); setMsg(null); setShowDelConfirm(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const reset = () => {
    setView('menu'); setMsg(null);
    setOldPw(''); setNewPw(''); setConfirmPw('');
    setShowDelConfirm(false); setShowPwForm(false);
  };

  const personalIcsUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar?uid=${user.id}`
    : `/api/calendar?uid=${user.id}`;
  const copyCalUrl = () => {
    navigator.clipboard.writeText(personalIcsUrl);
    setCalCopied(true);
    setTimeout(() => setCalCopied(false), 2000);
  };

  // ── Save profile ────────────────────────────────────────────────────────
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const fn = firstName.trim();
    const ln = lastName.trim();
    const updates = {
      first_name:   fn || null,
      last_name:    ln || null,
      display_name: displayName.trim() || (fn && ln ? `${fn} ${ln}` : null),
      date_of_birth: dob || null,
      ...(isPlayer ? {
        position:      position || null,
        jersey_number: jersey !== '' ? (Number(jersey) || null) : null,
      } : {}),
    };

    const { error } = await supabase.from('profiles').update(updates).eq('id', user.id);
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: lang === 'ja' ? '保存しました。' : 'Saved!' });
      onProfileUpdate?.();
    }
  };

  // ── Upload avatar ───────────────────────────────────────────────────────
  const resizeImage = (file, maxPx = 400) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const sx   = (img.width  - size) / 2;
        // Portrait photos: crop near the top to capture the face instead of the body
        const isPortrait = img.height > img.width * 1.2;
        const sy = Math.round((img.height - size) * (isPortrait ? 0.1 : 0.5));
        const out  = Math.min(size, maxPx);
        const canvas = document.createElement('canvas');
        canvas.width  = out;
        canvas.height = out;
        canvas.getContext('2d').drawImage(img, sx, sy, size, size, 0, 0, out, out);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Image conversion failed')),
          'image/jpeg', 0.85
        );
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setMsg(null);

    let blob;
    try { blob = await resizeImage(file); }
    catch { blob = file; }

    const path = `${user.id}.jpg`;
    const { error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

    if (uploadErr) { setMsg({ type: 'error', text: uploadErr.message }); setUploading(false); return; }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`;
    const { error: updateErr } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
    setUploading(false);
    if (updateErr) {
      setMsg({ type: 'error', text: updateErr.message });
    } else {
      setMsg({ type: 'success', text: lang === 'ja' ? '写真を更新しました。' : 'Photo updated!' });
      onProfileUpdate?.();
    }
  };

  // ── Change password (requires old password verification) ───────────────
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setMsg({ type: 'error', text: lang === 'ja' ? 'パスワードが一致しません。' : 'New passwords do not match.' });
      return;
    }
    if (newPw.length < 6) {
      setMsg({ type: 'error', text: lang === 'ja' ? '6文字以上必要です。' : 'Minimum 6 characters.' });
      return;
    }
    setSaving(true);
    // Verify old password by re-signing in
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: oldPw });
    if (signInErr) {
      setSaving(false);
      setMsg({ type: 'error', text: lang === 'ja' ? '現在のパスワードが正しくありません。' : 'Current password is incorrect.' });
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: lang === 'ja' ? 'パスワードを変更しました。' : 'Password updated!' });
      setOldPw(''); setNewPw(''); setConfirmPw('');
      setShowPwForm(false);
    }
  };

  const handleSignOut = () => supabase.auth.signOut();

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: user.id }),
    });
    setDeleting(false);
    if (res.ok) {
      await supabase.auth.signOut();
    } else {
      const { error } = await res.json();
      setMsg({ type: 'error', text: error ?? 'Deletion failed.' });
    }
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <button className={styles.avatarBtn} onClick={() => { setOpen((v) => !v); setView('menu'); setMsg(null); setShowDelConfirm(false); }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="avatar" className={styles.avatarImg} />
          : <span className={styles.avatarInitials}>{initials}</span>
        }
      </button>

      {open && (
        <div className={styles.dropdown}>

          {/* User info header — always visible */}
          <div className={styles.userInfo}>
            <div className={styles.avatarLgWrap}>
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className={styles.avatarLgImg} />
                : <div className={styles.avatarLg}>{initials}</div>
              }
            </div>
            <div>
              <span className={styles.displayName}>{name}</span>
              <span className={styles.email}>{user.email}</span>
              {profile?.role && <div className={styles.roleBadge}>{profile.role}</div>}
            </div>
          </div>

          <div className={styles.divider} />

          {/* ── Main menu ── */}
          {view === 'menu' && (
            <>
              <button className={styles.menuItem} onClick={() => setView('profile')}>
                👤 {lang === 'ja' ? 'プロフィール編集' : 'Edit profile'}
              </button>
              <button className={styles.menuItem} onClick={() => setView('calendar')}>
                📅 {lang === 'ja' ? 'カレンダー購読URL' : 'Calendar subscription'}
              </button>
              <button className={styles.menuItem} onClick={() => setView('install')}>
                📲 {lang === 'ja' ? 'アプリ・通知設定' : 'App & notifications'}
              </button>
              <div className={styles.divider} />
              <button className={`${styles.menuItem} ${styles.signOut}`} onClick={handleSignOut}>
                → {lang === 'ja' ? 'ログアウト' : 'Sign out'}
              </button>
            </>
          )}

          {/* ── Edit profile ── */}
          {view === 'profile' && (
            <form className={styles.pwForm} onSubmit={handleSaveProfile}>

              {/* Avatar */}
              <div className={styles.avatarUploadRow}>
                <div className={styles.avatarPreview}>
                  {avatarUrl
                    ? <img src={avatarUrl} alt="avatar" className={styles.avatarPreviewImg} />
                    : <div className={styles.avatarPreviewInitials}>{initials}</div>
                  }
                </div>
                <button type="button" className={styles.uploadBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? '…' : (lang === 'ja' ? '写真を変更' : 'Change photo')}
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              </div>

              {/* First + Last name */}
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{lang === 'ja' ? '名' : 'First name'}</label>
                  <input className={styles.fieldInput} type="text"
                    placeholder={lang === 'ja' ? '例：太郎' : 'e.g. Thomas'}
                    value={firstName} onChange={e => setFirstName(e.target.value)} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>{lang === 'ja' ? '姓' : 'Last name'}</label>
                  <input className={styles.fieldInput} type="text"
                    placeholder={lang === 'ja' ? '例：山田' : 'e.g. Ranner'}
                    value={lastName} onChange={e => setLastName(e.target.value)} />
                </div>
              </div>

              {/* Display name (nickname / alias) */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{lang === 'ja' ? '表示名（ニックネーム）' : 'Display name (nickname)'}</label>
                <input className={styles.fieldInput} type="text"
                  placeholder={lang === 'ja' ? '空白で名前を自動生成' : 'Leave blank to use first + last'}
                  value={displayName} onChange={e => setDisplayName(e.target.value)} />
              </div>

              {/* Date of birth */}
              <div className={styles.field}>
                <label className={styles.fieldLabel}>{lang === 'ja' ? '生年月日' : 'Date of birth'}</label>
                <input className={styles.fieldInput} type="date"
                  value={dob} onChange={e => setDob(e.target.value)} />
              </div>

              {/* Position + jersey (players only) */}
              {isPlayer && (
                <div className={styles.fieldRow}>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{lang === 'ja' ? 'ポジション' : 'Position'}</label>
                    <select className={styles.fieldInput} value={position} onChange={e => setPosition(e.target.value)}>
                      <option value="">{lang === 'ja' ? '選択…' : 'Select…'}</option>
                      {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>{lang === 'ja' ? '背番号' : 'Jersey #'}</label>
                    <input className={styles.fieldInput} type="number" min="0" max="99"
                      placeholder="e.g. 7"
                      value={jersey} onChange={e => setJersey(e.target.value)} />
                  </div>
                </div>
              )}

              {msg && <div className={`${styles.msg} ${styles[`msg_${msg.type}`]}`}>{msg.text}</div>}

              <div className={styles.pwActions}>
                <button type="button" className={styles.cancelBtn} onClick={reset}>
                  {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}
                </button>
              </div>

              {/* Password change section */}
              <div className={styles.dangerZone} style={{ borderColor: '#d1d5db', background: '#f9fafb' }}>
                <div className={styles.dangerZoneLabel} style={{ color: '#6b7280' }}>
                  🔑 {lang === 'ja' ? 'パスワード変更' : 'Change password'}
                </div>
                {!showPwForm ? (
                  <button type="button" className={styles.dangerZoneBtn}
                    style={{ color: '#374151', borderColor: '#d1d5db' }}
                    onClick={() => { setShowPwForm(true); setMsg(null); }}>
                    {lang === 'ja' ? 'パスワードを変更する…' : 'Change my password…'}
                  </button>
                ) : (
                  <div className={styles.dangerConfirm}>
                    <input className={styles.fieldInput} type="password"
                      placeholder={lang === 'ja' ? '現在のパスワード' : 'Current password'}
                      value={oldPw} onChange={e => setOldPw(e.target.value)} required />
                    <input className={styles.fieldInput} type="password"
                      placeholder={lang === 'ja' ? '新しいパスワード' : 'New password'}
                      value={newPw} onChange={e => setNewPw(e.target.value)} required />
                    <input className={styles.fieldInput} type="password"
                      placeholder={lang === 'ja' ? '新しいパスワード（確認）' : 'Confirm new password'}
                      value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                    <div className={styles.pwActions}>
                      <button type="button" className={styles.cancelBtn} onClick={() => { setShowPwForm(false); setOldPw(''); setNewPw(''); setConfirmPw(''); setMsg(null); }}>
                        {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                      </button>
                      <button type="button" className={styles.saveBtn} disabled={saving} onClick={handleSavePassword}>
                        {saving ? '…' : (lang === 'ja' ? '変更する' : 'Update')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Danger zone */}
              <div className={styles.dangerZone}>
                <div className={styles.dangerZoneLabel}>
                  {lang === 'ja' ? '危険な操作' : 'Danger zone'}
                </div>
                {!showDelConfirm ? (
                  <button type="button" className={styles.dangerZoneBtn} onClick={() => setShowDelConfirm(true)}>
                    🗑 {lang === 'ja' ? 'アカウント削除…' : 'Delete my account…'}
                  </button>
                ) : (
                  <div className={styles.dangerConfirm}>
                    <p className={styles.deleteWarning}>
                      {lang === 'ja'
                        ? '⚠️ アカウントとすべての個人データ（ウェルネス記録、RPE、チャット、プロフィール）が完全に削除されます。この操作は取り消せません。'
                        : '⚠️ This permanently deletes your account and all personal data — wellness, RPE, chat, profile. Cannot be undone.'}
                    </p>
                    <div className={styles.pwActions}>
                      <button type="button" className={styles.cancelBtn} onClick={() => setShowDelConfirm(false)}>
                        {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                      </button>
                      <button type="button" className={styles.deleteConfirmBtn} onClick={handleDeleteAccount} disabled={deleting}>
                        {deleting ? '…' : (lang === 'ja' ? '削除する' : 'Delete')}
                      </button>
                    </div>
                  </div>
                )}
              </div>

            </form>
          )}

          {/* ── App & notifications ── */}
          {view === 'install' && (
            <div className={styles.pwForm} style={{ padding: 0, gap: 0 }}>
              <div style={{ padding: '8px 14px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                  {lang === 'ja' ? 'アプリ・通知設定' : 'App & notifications'}
                </span>
                <button type="button" className={styles.cancelBtn} onClick={reset} style={{ padding: '3px 10px' }}>
                  {lang === 'ja' ? '戻る' : 'Back'}
                </button>
              </div>
              <InstallPrompt userId={user.id} lang={lang} />
            </div>
          )}

          {/* ── Calendar subscription ── */}
          {view === 'calendar' && (
            <div className={styles.pwForm}>
              <div className={styles.calSubSection}>
                <div className={styles.calSubLabel}>📅 {lang === 'ja' ? 'カレンダー購読URL' : 'Your personal calendar URL'}</div>
                <div className={styles.calSubHint}>
                  {lang === 'ja'
                    ? 'Googleカレンダー「他のカレンダー → URLから追加」に貼り付けてください。招待されたイベントのみ表示され、「不参加」にしたイベントは自動的に非表示になります。'
                    : 'Paste in Google Calendar → "Other calendars → From URL". Shows only your invited events. Events you mark "Out" disappear automatically.'}
                </div>
                <div className={styles.calSubRow}>
                  <span className={styles.calSubUrl}>{personalIcsUrl}</span>
                  <button type="button" className={styles.calCopyBtn} onClick={copyCalUrl}>
                    {calCopied ? '✓' : (lang === 'ja' ? 'コピー' : 'Copy')}
                  </button>
                </div>
              </div>
              <div className={styles.pwActions}>
                <button type="button" className={styles.cancelBtn} onClick={reset}>
                  {lang === 'ja' ? '戻る' : 'Back'}
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
