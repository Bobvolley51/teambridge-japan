'use client';

// components/Login.jsx — TeamBridge Japan login + account request

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Login.module.css';

export default function Login({ lang: initialLang = 'en', onLangChange }) {
  const [lang,        setLang]        = useState(initialLang);
  const [mode,        setMode]        = useState('password'); // 'password' | 'request'
  const [identifier,  setIdentifier]  = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username,    setUsername]    = useState('');
  const [reqPassword, setReqPassword] = useState('');
  const [reqConfirm,  setReqConfirm]  = useState('');
  const [reqMsg,      setReqMsg]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [message,     setMessage]     = useState(null);

  const t = {
    en: {
      title:           'TeamBridge Japan',
      subtitle:        'Shinshu Matsumoto Tridents',
      reqSubtitle:     'Request a new account',
      identifier:      'Email or username',
      email:           'Email address',
      password:        'Password',
      name:            'Your full name',
      usernameLabel:   'Username',
      usernamePlaceholder: 'e.g. thomas_r (letters, numbers, _)',
      msgPlaceholder:  'Optional message for the admin…',
      signIn:          'Sign in',
      sendRequest:     'Send Request',
      requestAccess:   'Request access to TeamBridge →',
      backToSignIn:    'Back to sign in',
      reqSent:         'Request submitted! You can log in as soon as an admin approves your account.',
      errorLogin:      'Invalid email / username or password.',
      newPassword:     'Set a password',
      confirmPassword: 'Confirm password',
      passwordShort:   'Password must be at least 8 characters.',
      passwordMismatch:'Passwords do not match.',
      usernameTaken:   'Username already taken.',
      usernameInvalid: 'Only letters, numbers and underscores (3–20 chars).',
    },
    ja: {
      title:              'TeamBridge Japan',
      subtitle:           '信州松本トライデンツ',
      reqSubtitle:        '新規アカウントを申請',
      identifier:         'メールまたはユーザー名',
      email:              'メールアドレス',
      password:           'パスワード',
      name:               'お名前',
      usernameLabel:      'ユーザー名',
      usernamePlaceholder:'例: thomas_r（文字・数字・_）',
      msgPlaceholder:     '管理者へのメッセージ（任意）',
      signIn:             'サインイン',
      sendRequest:        '申請を送る',
      requestAccess:      'アカウントを申請する →',
      backToSignIn:       'サインインに戻る',
      reqSent:            '申請を送りました。管理者が承認するとすぐにログインできます。',
      errorLogin:         'メールアドレス・ユーザー名またはパスワードが正しくありません。',
      newPassword:        'パスワードを設定',
      confirmPassword:    'パスワード（確認）',
      passwordShort:      'パスワードは8文字以上にしてください。',
      passwordMismatch:   'パスワードが一致しません。',
      usernameTaken:      'このユーザー名はすでに使われています。',
      usernameInvalid:    '文字・数字・アンダースコアのみ（3〜20文字）。',
    },
  }[lang];

  const handleLangChange = (l) => {
    setLang(l);
    if (onLangChange) onLangChange(l);
  };

  const switchMode = (next) => { setMode(next); setMessage(null); };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true); setMessage(null);
    let loginEmail = identifier.trim();
    if (!loginEmail.includes('@')) {
      // username lookup
      const res = await fetch('/api/lookup-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginEmail }),
      });
      const json = await res.json();
      if (!res.ok) { setMessage({ type: 'error', text: t.errorLogin }); setLoading(false); return; }
      loginEmail = json.email;
    }
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });
    if (error) setMessage({ type: 'error', text: t.errorLogin });
    setLoading(false);
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (reqPassword.length < 8) {
      setMessage({ type: 'error', text: t.passwordShort }); return;
    }
    if (reqPassword !== reqConfirm) {
      setMessage({ type: 'error', text: t.passwordMismatch }); return;
    }
    if (username && !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      setMessage({ type: 'error', text: t.usernameInvalid }); return;
    }
    setLoading(true);
    const res = await fetch('/api/request-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:       identifier.trim().toLowerCase(),
        password:    reqPassword,
        displayName: displayName.trim(),
        username:    username.trim().toLowerCase() || null,
        message:     reqMsg.trim() || null,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMessage({ type: 'error', text: json.error });
    else         setMessage({ type: 'success', text: t.reqSent });
    setLoading(false);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.langRow}>
          <button className={`${styles.langBtn} ${lang === 'en' ? styles.langBtnActive : ''}`} onClick={() => handleLangChange('en')}>EN</button>
          <button className={`${styles.langBtn} ${lang === 'ja' ? styles.langBtnActive : ''}`} onClick={() => handleLangChange('ja')}>日本語</button>
        </div>
        <img src="/logo-red.png" alt="Tridents Shinshu Matsumoto" className={styles.logo} />
        <h1 className={styles.title}>{t.title}</h1>

        {mode === 'request' ? (
          <>
            <p className={styles.subtitle}>{t.reqSubtitle}</p>
            <form className={styles.form} onSubmit={handleRequest}>
              <div className={styles.field}>
                <label className={styles.label}>{t.name}</label>
                <input className={styles.input} type="text" value={displayName}
                  onChange={e => setDisplayName(e.target.value)} required autoFocus
                  placeholder="Jane Smith" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t.usernameLabel}</label>
                <input className={styles.input} type="text" value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                  placeholder={t.usernamePlaceholder} autoComplete="username" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t.email}</label>
                <input className={styles.input} type="email" value={identifier}
                  onChange={e => setIdentifier(e.target.value)} required
                  placeholder="name@company.com" autoComplete="email" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t.newPassword}</label>
                <input className={styles.input} type="password" value={reqPassword}
                  onChange={e => setReqPassword(e.target.value)} required
                  placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>{t.confirmPassword}</label>
                <input className={styles.input} type="password" value={reqConfirm}
                  onChange={e => setReqConfirm(e.target.value)} required
                  placeholder="••••••••" autoComplete="new-password" />
              </div>
              <div className={styles.field}>
                <textarea className={styles.textarea} value={reqMsg}
                  onChange={e => setReqMsg(e.target.value)} rows={2}
                  placeholder={t.msgPlaceholder} />
              </div>
              {message && (
                <div className={`${styles.message} ${styles[`message_${message.type}`]}`}>
                  {message.text}
                </div>
              )}
              <button className={styles.submitBtn} type="submit" disabled={loading || !!message?.type === 'success'}>
                {loading ? '…' : t.sendRequest}
              </button>
            </form>
            <button className={styles.switchBtn} onClick={() => switchMode('password')}>
              ← {t.backToSignIn}
            </button>
          </>
        ) : (
          <>
            <p className={styles.subtitle}>{t.subtitle}</p>
            <form className={styles.form} onSubmit={handlePasswordLogin}>
              <div className={styles.field}>
                <label className={styles.label}>{t.identifier}</label>
                <input className={styles.input} type="text" value={identifier}
                  onChange={e => setIdentifier(e.target.value)} required autoComplete="username"
                  placeholder="name@company.com or username" autoFocus />
              </div>
              {mode === 'password' && (
                <div className={styles.field}>
                  <label className={styles.label}>{t.password}</label>
                  <input className={styles.input} type="password" value={password}
                    onChange={e => setPassword(e.target.value)} required
                    placeholder="••••••••" autoComplete="current-password" />
                </div>
              )}
              {message && (
                <div className={`${styles.message} ${styles[`message_${message.type}`]}`}>
                  {message.text}
                </div>
              )}
              <button className={styles.submitBtn} type="submit" disabled={loading}>
                {loading ? '…' : t.signIn}
              </button>
            </form>

            <div className={styles.divider} />

            <button className={styles.requestLink} onClick={() => switchMode('request')}>
              {t.requestAccess}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
