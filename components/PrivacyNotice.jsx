'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './PrivacyNotice.module.css';

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO UPDATE THE PRIVACY NOTICE
//
// 1. Edit the text inside this component (BiRow values, disclaimer, etc.)
// 2. Bump PRIVACY_VERSION below to any new string (e.g. '1.2', '1.3', …)
// 3. Deploy — every user will be shown this notice on their next login
//    and must click "I agree" before they can continue.
//
// Do NOT skip step 2 or returning users will never see the updated text.
// ─────────────────────────────────────────────────────────────────────────────
export const PRIVACY_VERSION = '1.2';

function BiRow({ en, ja }) {
  return (
    <div className={styles.biRow}>
      <span className={styles.biEn}>{en}</span>
      <span className={styles.biJa}>{ja}</span>
    </div>
  );
}

export default function PrivacyNotice({ userId, lang, onLangChange, onAccept }) {
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    setSaving(true);
    const now = new Date().toISOString();
    const { error } = await supabase.from('profiles').update({
      privacy_accepted_at: now,
      privacy_version: PRIVACY_VERSION,
    }).eq('id', userId);
    if (!error) {
      setSaving(false);
      onAccept();
    } else {
      setSaving(false);
    }
  };

  const isJa = lang === 'ja';

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        {onLangChange && (
          <div className={styles.langToggle}>
            <button className={`${styles.langBtn} ${!isJa ? styles.langBtnActive : ''}`} onClick={() => onLangChange('en')}>EN</button>
            <button className={`${styles.langBtn} ${isJa  ? styles.langBtnActive : ''}`} onClick={() => onLangChange('ja')}>日本語</button>
          </div>
        )}

        <div className={styles.icon}>🏐</div>
        <h2 className={styles.title}>
          Data Privacy Notice<br />
          <span className={styles.titleJa}>データプライバシーについて</span>
        </h2>

        <div className={styles.body}>
          <div className={styles.welcome}>
            <p className={styles.welcomeText}>Welcome to TeamBridge Japan — we're glad to have you on the team! 🎉</p>
            <p className={styles.welcomeTextJa}>TeamBridge Japan へようこそ！チームの一員として歓迎します！🎉</p>
          </div>

          <BiRow
            en="Before you get started, please take a moment to read how we handle your data."
            ja="始める前に、データの取り扱いについてご確認ください。"
          />

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span>Data we collect</span>
              <span className={styles.sectionTitleJa}>収集するデータ</span>
            </div>
            <ul className={styles.list}>
              <li><BiRow en="Profile: name, role, avatar photo" ja="プロフィール（名前、役割、写真）" /></li>
              <li><BiRow en="Health data: daily wellness scores, body pain, session RPE & training load" ja="健康データ（ウェルネス評価、体の痛み、RPE・トレーニング負荷）" /></li>
              <li><BiRow en="Activity: calendar events, tasks, chat messages, travel plans" ja="活動データ（カレンダー、タスク、チャット、旅程）" /></li>
            </ul>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span>Who can see your health data</span>
              <span className={styles.sectionTitleJa}>健康データの閲覧権限</span>
            </div>
            <div className={styles.roles}>
              <span className={styles.roleChip}>Head Coach / ヘッドコーチ</span>
              <span className={styles.roleChip}>Athletic Trainer / アスレティックトレーナー</span>
              <span className={styles.roleChip}>Physiotherapist / 理学療法士</span>
              <span className={styles.roleChip}>Staff / Orga · スタッフ / 運営</span>
            </div>
            <BiRow
              en="Team members can only see their own data."
              ja="チームメートは自分自身のデータのみ閲覧できます。"
            />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span>Storage &amp; deletion</span>
              <span className={styles.sectionTitleJa}>データの保管・削除</span>
            </div>
            <BiRow
              en="Data is stored securely in Supabase and is never shared with third parties. You can request deletion of your account and all associated data at any time from the profile menu."
              ja="データはSupabase（EU基準のセキュリティ）に安全に保管され、第三者と共有されることはありません。プロフィールメニューからいつでもアカウントとデータの削除を申請できます。"
            />
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              <span>Disclaimer</span>
              <span className={styles.sectionTitleJa}>免責事項</span>
            </div>
            <div className={styles.disclaimer}>
              <p className={styles.disclaimerText}>
                TeamBridge Japan and its administrators are not responsible or liable for any damages, losses, or injuries arising from the use of this application. This app is a team communication tool and does not provide medical advice or diagnosis. Health data recorded here is for reference purposes only.
              </p>
              <p className={`${styles.disclaimerText} ${styles.disclaimerJa}`}>
                TeamBridge Japan およびその管理者・運営者は、本アプリの使用によって生じたいかなる損害・損失・怪我についても一切の責任を負いません。本アプリはチームコミュニケーションの補助ツールであり、医療上のアドバイスや診断を提供するものではありません。
              </p>
            </div>
          </div>
        </div>

        <button className={styles.acceptBtn} onClick={handleAccept} disabled={saving}>
          {saving ? '…' : (isJa ? '同意して続ける — I agree — Continue' : 'I agree — Continue · 同意して続ける')}
        </button>
      </div>
    </div>
  );
}
