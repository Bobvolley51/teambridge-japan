'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { syncPushSubscription, urlBase64ToUint8Array } from '@/lib/push-register';
import styles from './InstallPrompt.module.css';

const PREFS = [
  { key: 'chat_dm',       en: 'Direct messages',        ja: 'ダイレクトメッセージ' },
  { key: 'chat_channel',  en: 'Channel messages',       ja: 'チャンネルメッセージ' },
  { key: 'calendar',      en: 'Calendar changes',        ja: 'カレンダー変更・追加' },
  { key: 'tasks',         en: 'Task assignments',        ja: 'タスクの割り当て' },
  { key: 'announcements', en: 'Announcements',           ja: 'お知らせ' },
  { key: 'birthday',      en: 'Birthdays',               ja: '誕生日' },
  { key: 'nutrition',     en: 'Nutrition feedback requests', ja: '栄養フィードバック依頼' },
];

export default function InstallPrompt({ userId, lang }) {
  const [installable,    setInstallable]    = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS,          setIsIOS]          = useState(false);
  const [isStandalone,   setIsStandalone]   = useState(false);
  const [notifState,     setNotifState]     = useState('default');
  const [subscribing,    setSubscribing]    = useState(false);
  const [showIOSGuide,   setShowIOSGuide]   = useState(false);
  const [subError,       setSubError]       = useState(null);
  const [prefs,          setPrefs]          = useState(null); // null = loading
  const [savingPrefs,    setSavingPrefs]    = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
    if ('Notification' in window) setNotifState(Notification.permission);

    const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); setInstallable(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Load prefs from Supabase
  useEffect(() => {
    if (!userId) return;
    supabase.from('profiles').select('notif_prefs').eq('id', userId).single()
      .then(({ data }) => setPrefs(data?.notif_prefs ?? {}));
  }, [userId]);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') { setInstallable(false); setDeferredPrompt(null); }
  };

  const handleNotifications = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setSubError(lang === 'ja' ? 'このブラウザは通知をサポートしていません。' : 'Notifications not supported in this browser.');
      return;
    }
    setSubscribing(true);
    setSubError(null);
    try {
      const permission = await Notification.requestPermission();
      setNotifState(permission);
      if (permission !== 'granted') { setSubscribing(false); return; }

      // syncPushSubscription handles both new subscriptions and existing ones —
      // it always upserts so the DB stays in sync even after reinstalls.
      await syncPushSubscription(userId);
    } catch (err) {
      setSubError(err.message);
    }
    setSubscribing(false);
  };

  const handleUnsubscribe = async () => {
    setSubscribing(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setNotifState('default');
    } catch (err) {
      setSubError(err.message);
    }
    setSubscribing(false);
  };

  const togglePref = async (key) => {
    const current = prefs?.[key] ?? true;
    const updated  = { ...prefs, [key]: !current };
    setPrefs(updated);
    setSavingPrefs(true);
    await supabase.from('profiles').update({ notif_prefs: updated }).eq('id', userId);
    setSavingPrefs(false);
  };

  const notifSupported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
  const isGranted      = notifState === 'granted';

  return (
    <div className={styles.wrap}>

      {/* ── Install section ── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          📱 {lang === 'ja' ? 'アプリとしてインストール' : 'Install as app'}
        </div>

        {isStandalone ? (
          <div className={styles.statusRow}>
            <span className={styles.checkIcon}>✓</span>
            <span className={styles.statusText}>
              {lang === 'ja' ? 'すでにアプリとして起動しています。' : 'Running as installed app.'}
            </span>
          </div>
        ) : isIOS ? (
          <>
            <p className={styles.hint}>
              {lang === 'ja'
                ? 'Safariで開いて「共有 → ホーム画面に追加」をタップしてください。'
                : 'Open in Safari, tap the Share button, then "Add to Home Screen".'}
            </p>
            <button className={styles.btn} onClick={() => setShowIOSGuide(v => !v)}>
              {showIOSGuide ? (lang === 'ja' ? '閉じる' : 'Close guide') : (lang === 'ja' ? '手順を見る' : 'Show me how')}
            </button>
            {showIOSGuide && (
              <div className={styles.iosGuide}>
                <div className={styles.iosStep}><span className={styles.iosNum}>1</span>{lang === 'ja' ? 'Safariでこのページを開く' : 'Open this page in Safari'}</div>
                <div className={styles.iosStep}><span className={styles.iosNum}>2</span>{lang === 'ja' ? '下部の共有ボタン（四角＋矢印）をタップ' : 'Tap the Share button at the bottom (box with arrow)'}</div>
                <div className={styles.iosStep}><span className={styles.iosNum}>3</span>{lang === 'ja' ? '「ホーム画面に追加」を選択' : 'Select "Add to Home Screen"'}</div>
                <div className={styles.iosStep}><span className={styles.iosNum}>4</span>{lang === 'ja' ? '「追加」をタップして完了！' : 'Tap "Add" — done!'}</div>
              </div>
            )}
          </>
        ) : installable ? (
          <button className={styles.btn} onClick={handleInstall}>
            {lang === 'ja' ? 'アプリをインストール' : 'Install app'}
          </button>
        ) : (
          <p className={styles.hint}>
            {lang === 'ja'
              ? 'このブラウザはインストールをサポートしていないか、すでにインストール済みです。'
              : 'Already installed or browser doesn\'t support install prompts.'}
          </p>
        )}
      </div>

      {/* ── Notifications toggle ── */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>
          🔔 {lang === 'ja' ? 'プッシュ通知' : 'Push notifications'}
        </div>

        {isIOS && !isStandalone ? (
          <p className={styles.hint}>
            {lang === 'ja'
              ? 'iOSでは、まずホーム画面に追加してからアプリを開いてください。'
              : 'On iPhone, add the app to your Home Screen first, then open it from there.'}
          </p>
        ) : !notifSupported ? (
          <p className={styles.hint}>{lang === 'ja' ? 'このブラウザは通知をサポートしていません。' : 'Notifications not supported in this browser.'}</p>
        ) : isGranted ? (
          <div className={styles.statusRow}>
            <span className={styles.checkIcon}>✓</span>
            <span className={styles.statusText}>{lang === 'ja' ? '通知が有効です。' : 'Notifications enabled.'}</span>
            <button className={styles.btnTiny} onClick={handleUnsubscribe} disabled={subscribing} style={{ marginLeft: 'auto' }}>
              {subscribing ? '…' : (lang === 'ja' ? '無効' : 'Disable')}
            </button>
          </div>
        ) : notifState === 'denied' ? (
          <p className={styles.hint} style={{ color: '#b91c1c' }}>
            {lang === 'ja' ? '通知がブロックされています。ブラウザ設定から許可してください。' : 'Blocked in browser settings — allow notifications there first.'}
          </p>
        ) : (
          <>
            <p className={styles.hint}>
              {lang === 'ja' ? 'チャット、カレンダー、タスクなどの通知をリアルタイムで受け取れます。' : 'Get notified about chats, calendar changes, tasks and more — even when the app is closed.'}
            </p>
            <button className={styles.btn} onClick={handleNotifications} disabled={subscribing}>
              {subscribing ? '…' : (lang === 'ja' ? '通知を有効にする' : 'Enable notifications')}
            </button>
          </>
        )}

        {subError && <p className={styles.error}>{subError}</p>}
      </div>

      {/* ── Notification preferences (only when granted) ── */}
      {isGranted && prefs !== null && (
        <div className={styles.section}>
          <div className={styles.sectionLabel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>{lang === 'ja' ? '通知の種類' : 'What to notify me about'}</span>
            {savingPrefs && <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 400 }}>saving…</span>}
          </div>
          {PREFS.map(p => {
            const enabled = prefs[p.key] ?? true;
            return (
              <button key={p.key} className={styles.prefRow} type="button" onClick={() => togglePref(p.key)}>
                <span className={styles.prefLabel}>{lang === 'ja' ? p.ja : p.en}</span>
                <span className={`${styles.toggle} ${enabled ? styles.toggleOn : styles.toggleOff}`}>
                  <span className={styles.toggleKnob} style={{ left: enabled ? 18 : 2 }} />
                </span>
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}

