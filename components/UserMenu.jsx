'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './UserMenu.module.css';

export default function UserMenu({ user, profile, lang, onProfileUpdate }) {
  const [open,       setOpen]       = useState(false);
  const [view,       setView]       = useState('menu'); // 'menu' | 'password' | 'profile' | 'delete' | 'calendar'
  const [calCopied,  setCalCopied]  = useState(false);
  const [deleting,   setDeleting]   = useState(false);
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [displayName, setDisplayName] = useState('');
  const [uploading,  setUploading]  = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [msg,        setMsg]        = useState(null);
  const fileRef = useRef(null);
  const ref     = useRef(null);

  const initials   = (user.email ?? 'U').slice(0, 2).toUpperCase();
  const avatarUrl  = profile?.avatar_url ?? null;
  const name       = profile?.display_name || user.email;

  useEffect(() => {
    setDisplayName(profile?.display_name ?? '');
  }, [profile]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false); setView('menu'); setMsg(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const reset = () => { setView('menu'); setMsg(null); setNewPw(''); setConfirmPw(''); };

  const personalIcsUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/calendar?uid=${user.id}`
    : `/api/calendar?uid=${user.id}`;
  const copyCalUrl = () => {
    navigator.clipboard.writeText(personalIcsUrl);
    setCalCopied(true);
    setTimeout(() => setCalCopied(false), 2000);
  };

  // ── Save display name ───────────────────────────────────────────────────
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: lang === 'ja' ? '保存しました。' : 'Saved!' });
      onProfileUpdate?.();
    }
  };

  // Resize + compress to JPEG before upload (handles large photos and HEIC from iOS)
  const resizeImage = (file, maxPx = 800) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (ev) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale  = Math.min(maxPx / img.width, maxPx / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          blob => blob ? resolve(blob) : reject(new Error('Image conversion failed')),
          'image/jpeg', 0.85
        );
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });

  // ── Upload avatar ───────────────────────────────────────────────────────
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

    if (uploadErr) {
      setMsg({ type: 'error', text: uploadErr.message });
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const publicUrl = `${data.publicUrl}?t=${Date.now()}`; // cache-bust

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    setUploading(false);
    if (updateErr) {
      setMsg({ type: 'error', text: updateErr.message });
    } else {
      setMsg({ type: 'success', text: lang === 'ja' ? '写真を更新しました。' : 'Photo updated!' });
      onProfileUpdate?.();
    }
  };

  // ── Change password ─────────────────────────────────────────────────────
  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (newPw !== confirmPw) {
      setMsg({ type: 'error', text: lang === 'ja' ? 'パスワードが一致しません。' : 'Passwords do not match.' });
      return;
    }
    if (newPw.length < 6) {
      setMsg({ type: 'error', text: lang === 'ja' ? '6文字以上必要です。' : 'Minimum 6 characters.' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setSaving(false);
    if (error) {
      setMsg({ type: 'error', text: error.message });
    } else {
      setMsg({ type: 'success', text: lang === 'ja' ? 'パスワードを変更しました。' : 'Password updated!' });
      setNewPw(''); setConfirmPw('');
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
      {/* Header button */}
      <button className={styles.avatarBtn} onClick={() => { setOpen((v) => !v); setView('menu'); setMsg(null); }}>
        {avatarUrl
          ? <img src={avatarUrl} alt="avatar" className={styles.avatarImg} />
          : <span className={styles.avatarInitials}>{initials}</span>
        }
      </button>

      {open && (
        <div className={styles.dropdown}>

          {/* User info header */}
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

          {/* Menu */}
          {view === 'menu' && (
            <>
              <button className={styles.menuItem} onClick={() => setView('profile')}>
                👤 {lang === 'ja' ? 'プロフィール編集' : 'Edit profile'}
              </button>
              <button className={styles.menuItem} onClick={() => setView('password')}>
                🔑 {lang === 'ja' ? 'パスワード変更' : 'Change password'}
              </button>
              <button className={styles.menuItem} onClick={() => setView('calendar')}>
                📅 {lang === 'ja' ? 'カレンダー購読URL' : 'Calendar subscription'}
              </button>
              <div className={styles.divider} />
              <button className={`${styles.menuItem} ${styles.signOut}`} onClick={handleSignOut}>
                → {lang === 'ja' ? 'ログアウト' : 'Sign out'}
              </button>
              <div className={styles.divider} />
              <button className={`${styles.menuItem} ${styles.deleteItem}`} onClick={() => setView('delete')}>
                🗑 {lang === 'ja' ? 'アカウント削除' : 'Delete my account'}
              </button>
            </>
          )}

          {/* Delete account confirmation */}
          {view === 'delete' && (
            <div className={styles.pwForm}>
              <p className={styles.deleteWarning}>
                {lang === 'ja'
                  ? '⚠️ アカウントとすべての個人データ（ウェルネス記録、RPE、チャット、プロフィール）が完全に削除されます。この操作は取り消せません。'
                  : '⚠️ This will permanently delete your account and all personal data — wellness records, RPE, chat messages, and profile. This cannot be undone.'}
              </p>
              {msg && <div className={`${styles.msg} ${styles[`msg_${msg.type}`]}`}>{msg.text}</div>}
              <div className={styles.pwActions}>
                <button type="button" className={styles.cancelBtn} onClick={reset}>
                  {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button type="button" className={styles.deleteConfirmBtn} onClick={handleDeleteAccount} disabled={deleting}>
                  {deleting ? '…' : (lang === 'ja' ? '削除する' : 'Delete')}
                </button>
              </div>
            </div>
          )}

          {/* Edit profile */}
          {view === 'profile' && (
            <form className={styles.pwForm} onSubmit={handleSaveProfile}>
              {/* Avatar upload */}
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

              <input
                className={styles.pwInput}
                type="text"
                placeholder={lang === 'ja' ? '表示名' : 'Display name'}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />

              {msg && <div className={`${styles.msg} ${styles[`msg_${msg.type}`]}`}>{msg.text}</div>}

              <div className={styles.pwActions}>
                <button type="button" className={styles.cancelBtn} onClick={reset}>
                  {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}
                </button>
              </div>
            </form>
          )}

          {/* Calendar subscription */}
          {view === 'calendar' && (
            <div className={styles.pwForm}>
              <div className={styles.calSubSection}>
                <div className={styles.calSubLabel}>📅 {lang === 'ja' ? 'カレンダー購読URL' : 'Your personal calendar URL'}</div>
                <div className={styles.calSubHint}>
                  {lang === 'ja'
                    ? 'Googleカレンダー「他のカレンダー → URLから追加」に貼り付けてください。招待されたイベントのみ表示され、「不参加」にしたイベントは自動的に非表示になります。'
                    : 'Paste in Google Calendar → "Other calendars → From URL". Shows only your invited events. Events you mark "Out" will disappear automatically.'}
                </div>
                <div className={styles.calSubRow}>
                  <span className={styles.calSubUrl}>{personalIcsUrl}</span>
                  <button className={styles.calCopyBtn} onClick={copyCalUrl}>
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

          {/* Change password */}
          {view === 'password' && (
            <form className={styles.pwForm} onSubmit={handleSavePassword}>
              <input className={styles.pwInput} type="password"
                placeholder={lang === 'ja' ? '新しいパスワード' : 'New password'}
                value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
              <input className={styles.pwInput} type="password"
                placeholder={lang === 'ja' ? '確認用パスワード' : 'Confirm password'}
                value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
              {msg && <div className={`${styles.msg} ${styles[`msg_${msg.type}`]}`}>{msg.text}</div>}
              <div className={styles.pwActions}>
                <button type="button" className={styles.cancelBtn} onClick={reset}>
                  {lang === 'ja' ? 'キャンセル' : 'Cancel'}
                </button>
                <button type="submit" className={styles.saveBtn} disabled={saving}>
                  {saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}
                </button>
              </div>
            </form>
          )}

        </div>
      )}
    </div>
  );
}
