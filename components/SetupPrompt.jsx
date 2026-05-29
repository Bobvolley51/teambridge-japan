'use client';

import { useState, useEffect } from 'react';
import styles from './SetupPrompt.module.css';

const STORAGE_KEY = (uid) => `setup_dismissed_${uid}`;

export default function SetupPrompt({ userId, lang, role, onNavigate, onOpenWellness }) {
  const [dismissed,  setDismissed]  = useState(true); // start hidden to avoid flash
  const [notifState, setNotifState] = useState('default');
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    const dismissed = localStorage.getItem(STORAGE_KEY(userId));
    if (!dismissed) setDismissed(false);
    if ('Notification' in window) setNotifState(Notification.permission);
  }, [userId]);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY(userId), '1');
    setDismissed(true);
  };

  const enableNotifications = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      setNotifState(permission);
      if (permission !== 'granted') { setSubscribing(false); return; }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (!existing) {
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
        });
        await fetch('/api/push-subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, subscription: sub.toJSON() }),
        });
      }
    } catch {}
    setSubscribing(false);
  };

  const isIOS = typeof window !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true);
  const notifGranted = notifState === 'granted';
  const notifBlocked = notifState === 'denied';
  const isPlayer = role === 'Player';

  if (dismissed) return null;

  const t = (en, ja) => lang === 'ja' ? ja : en;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>👋 {t('Getting started', 'スタートガイド')}</span>
        <button className={styles.closeBtn} onClick={dismiss} title={t('Dismiss', '閉じる')}>✕</button>
      </div>

      <div className={styles.steps}>

        {/* Step 1: Notifications */}
        <div className={`${styles.step} ${notifGranted ? styles.stepDone : ''}`}>
          <div className={styles.stepIcon}>{notifGranted ? '✅' : '🔔'}</div>
          <div className={styles.stepBody}>
            <div className={styles.stepTitle}>
              {t('Enable notifications', '通知を有効にする')}
            </div>
            <div className={styles.stepDesc}>
              {t(
                'Get push alerts for schedule changes, messages and session reminders — even when the app is closed.',
                'スケジュール変更・メッセージ・セッションのリマインダーを受け取れます。'
              )}
            </div>
            {notifGranted ? (
              <span className={styles.doneLabel}>{t('Enabled ✓', '有効 ✓')}</span>
            ) : notifBlocked ? (
              <span className={styles.blockedLabel}>
                {t('Blocked in browser settings', 'ブラウザ設定でブロックされています')}
              </span>
            ) : isIOS && !isStandalone ? (
              <span className={styles.hintLabel}>
                {t('Add to Home Screen first, then open from there', 'まずホーム画面に追加してください')}
              </span>
            ) : (
              <button className={styles.actionBtn} onClick={enableNotifications} disabled={subscribing}>
                {subscribing ? '…' : t('Enable now', '今すぐ有効にする')}
              </button>
            )}
          </div>
        </div>

        {/* Step 2: Calendar */}
        <div className={styles.step}>
          <div className={styles.stepIcon}>📅</div>
          <div className={styles.stepBody}>
            <div className={styles.stepTitle}>
              {t('Your schedule', 'スケジュール')}
            </div>
            <div className={styles.stepDesc}>
              {t(
                'Check training sessions, games and events. Tap an event to confirm your attendance.',
                'トレーニング・試合・イベントを確認し、参加可否を登録できます。'
              )}
            </div>
            <button className={styles.actionBtnSecondary} onClick={() => { onNavigate('calendar'); dismiss(); }}>
              {t('Open Calendar →', 'カレンダーを開く →')}
            </button>
          </div>
        </div>

        {/* Step 3: Wellness (players only) */}
        {isPlayer && (
          <div className={styles.step}>
            <div className={styles.stepIcon}>💪</div>
            <div className={styles.stepBody}>
              <div className={styles.stepTitle}>
                {t('Daily check-in', 'デイリーチェックイン')}
              </div>
              <div className={styles.stepDesc}>
                {t(
                  'Log how you feel each morning — sleep, energy and muscle soreness. Takes 30 seconds.',
                  '毎朝、体調（睡眠・エネルギー・筋肉の状態）を30秒で記録できます。'
                )}
              </div>
              {onOpenWellness && (
                <button className={styles.actionBtnSecondary} onClick={() => { onOpenWellness(); dismiss(); }}>
                  {t('Try it now →', '今すぐ試す →')}
                </button>
              )}
            </div>
          </div>
        )}

      </div>

      <div className={styles.footer}>
        <button className={styles.dismissBtn} onClick={dismiss}>
          {t('Got it, dismiss', 'わかりました')}
        </button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
