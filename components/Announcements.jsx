'use client';

// components/Announcements.jsx — TeamBridge Japan Announcements Feed Component

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { sendPush } from '@/lib/push';
import { timeAgo } from '@/lib/date';
import { useToast } from '@/lib/toast';
import { useTranslated } from '@/lib/translate';
import styles from './Announcements.module.css';

const PRIORITY_CONFIG = {
  high: {
    label:     { en: 'Priority', ja: '重要'   },
    className: styles.badgeHigh,
  },
  medium: {
    label:     { en: 'Info',     ja: 'お知らせ' },
    className: styles.badgeMedium,
  },
  low: {
    label:     { en: 'Reminder',   ja: 'その他'  },
    className: styles.badgeLow,
  },
};


function fmtEventDate(dateStr, timeStr, lang) {
  const d = new Date(dateStr + 'T00:00:00');
  const datePart = d.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-GB', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  return timeStr ? `${datePart} · ${timeStr.slice(0, 5)}` : datePart;
}

function AnnouncementCard({ ann, lang, readCount, totalUsers }) {
  const cfg   = PRIORITY_CONFIG[ann.priority] ?? PRIORITY_CONFIG.medium;
  const title   = useTranslated(ann.title,   lang);
  const content = useTranslated(ann.content, lang);
  return (
    <div className={styles.card}>
      <span className={`${styles.badge} ${cfg.className}`}>
        {cfg.label[lang]}
      </span>
      <h3 className={styles.cardTitle}>{title}</h3>
      {ann.event_date && (
        <div className={styles.cardDate}>
          📅 {fmtEventDate(ann.event_date, ann.event_time, lang)}
        </div>
      )}
      <p  className={styles.cardContent}>{content}</p>
      <div className={styles.cardFooter}>
        <span>{lang === 'ja' ? '投稿者' : 'by'}: {ann.author_name}</span>
        <span>{timeAgo(ann.created_at, lang)}</span>
      </div>
      {readCount > 0 && (
        <div className={styles.seenBy}>
          👁 {lang === 'ja'
            ? `${readCount}${totalUsers ? `/${totalUsers}` : ''}人が閲覧`
            : `Seen by ${readCount}${totalUsers ? `/${totalUsers}` : ''}`}
        </div>
      )}
    </div>
  );
}

function NewAnnouncementForm({ lang, onPost, onClose }) {
  const [title,     setTitle]     = useState('');
  const [content,   setContent]   = useState('');
  const [priority,  setPriority]  = useState('medium');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [posting,   setPosting]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setPosting(true);
    await onPost({
      title:      title.trim(),
      content:    content.trim(),
      priority,
      event_date: eventDate || null,
      event_time: eventDate && eventTime ? eventTime : null,
    });
    setPosting(false);
    onClose();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <label className={styles.label}>{lang === 'ja' ? 'タイトル' : 'Title'}</label>
        <input className={styles.formInput} value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={lang === 'ja' ? 'お知らせのタイトル...' : 'Announcement title…'} required />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label}>{lang === 'ja' ? '内容' : 'Content'}</label>
        <textarea className={styles.formTextarea} value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={lang === 'ja' ? '詳細を入力...' : 'Enter details…'} rows={3} required />
      </div>
      <div className={styles.formRow}>
        <label className={styles.label}>{lang === 'ja' ? '優先度' : 'Priority'}</label>
        <select className={styles.formSelect} value={priority}
          onChange={(e) => setPriority(e.target.value)}>
          <option value="high">{lang === 'ja' ? '重要' : 'Priority'}</option>
          <option value="medium">{lang === 'ja' ? 'お知らせ' : 'Info'}</option>
          <option value="low">{lang === 'ja' ? 'その他' : 'Reminder'}</option>
        </select>
      </div>
      <div className={styles.formDateRow}>
        <div className={styles.formDateCol}>
          <label className={styles.label}>{lang === 'ja' ? '日付（任意）' : 'Date (optional)'}</label>
          <input className={styles.formInput} type="date" value={eventDate}
            onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div className={styles.formDateCol}>
          <label className={styles.label}>{lang === 'ja' ? '時刻（任意）' : 'Time (optional)'}</label>
          <input className={styles.formInput} type="time" value={eventTime}
            onChange={(e) => setEventTime(e.target.value)} disabled={!eventDate} />
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          {lang === 'ja' ? 'キャンセル' : 'Cancel'}
        </button>
        <button type="submit" className={styles.postBtn} disabled={posting}>
          {posting ? (lang === 'ja' ? '投稿中...' : 'Posting…') : (lang === 'ja' ? '投稿する' : 'Post')}
        </button>
      </div>
    </form>
  );
}

export default function Announcements({ lang = 'en', currentUserName = 'Team Member' }) {
  const toast = useToast();
  const [announcements, setAnnouncements] = useState([]);
  const [readCounts,    setReadCounts]    = useState({});
  const [totalUsers,    setTotalUsers]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);
  const [showForm, setShowForm] = useState(false);

  // Load announcements + read counts
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const { data: { user: me } } = await supabase.auth.getUser();

      const { data, error: err } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (cancelled) return;
      if (err) { setError(err.message); setLoading(false); return; }

      const anns = data ?? [];
      setAnnouncements(anns);
      setLoading(false);

      if (!anns.length) return;
      const ids = anns.map(a => a.id);

      // Fetch read counts + total user count in parallel
      const [{ data: reads }, { count }] = await Promise.all([
        supabase.from('announcement_reads').select('announcement_id').in('announcement_id', ids),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      if (cancelled) return;
      const cm = {};
      for (const r of reads ?? []) cm[r.announcement_id] = (cm[r.announcement_id] || 0) + 1;
      setReadCounts(cm);
      setTotalUsers(count);

      // Mark all visible announcements as read (fire-and-forget)
      if (me) {
        supabase.from('announcement_reads').upsert(
          ids.map(id => ({ announcement_id: id, user_id: me.id })),
          { onConflict: 'announcement_id,user_id', ignoreDuplicates: true }
        );
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // Realtime: new announcements appear instantly for everyone
  useEffect(() => {
    const channel = supabase
      .channel('announcements-realtime')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'announcements' },
        (p) => {
          setAnnouncements((prev) => {
            if (prev.some((a) => a.id === p.new.id)) return prev;
            return [p.new, ...prev]; // newest first
          });
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  // Post a new announcement and notify all other users
  const postAnnouncement = useCallback(async ({ title, content, priority, event_date, event_time }) => {
    const { data: { user: me } } = await supabase.auth.getUser();

    const { data: ann, error: err } = await supabase.from('announcements').insert({
      title,
      content,
      priority,
      event_date: event_date ?? null,
      event_time: event_time ?? null,
      author_name: currentUserName,
    }).select('id').single();

    if (err) { setError('Could not post: ' + err.message); return; }
    toast(lang === 'ja' ? 'お知らせを投稿しました' : 'Announcement posted', 'success');

    const { data: profiles } = await supabase.from('profiles').select('id');
    if (profiles?.length) {
      const notifs = profiles
        .filter(p => p.id !== me?.id)
        .map(p => ({
          user_id:    p.id,
          type:       'announcement',
          title,
          body:       content?.slice(0, 80) || null,
          nav_target: 'feed',
          ref_id:     ann?.id ?? null,
        }));
      if (notifs.length) {
        await supabase.from('notifications').insert(notifs);
        const recipientIds = notifs.map(n => n.user_id);
        sendPush(recipientIds, {
          title:   `📢 ${title}`,
          body:    content?.slice(0, 80) || '',
          url:     '/?nav=feed',
          tag:     `ann-${ann?.id}`,
          prefKey: 'announcements',
        });
      }
    }
  }, [currentUserName]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>
          {lang === 'ja' ? 'お知らせ' : 'Announcements'}
        </span>
        <button className={styles.newBtn} onClick={() => setShowForm((v) => !v)}>
          {showForm
            ? (lang === 'ja' ? '閉じる' : 'Close')
            : (lang === 'ja' ? '+ 投稿' : '+ New')}
        </button>
      </div>

      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {showForm && (
        <NewAnnouncementForm
          lang={lang}
          onPost={postAnnouncement}
          onClose={() => setShowForm(false)}
        />
      )}

      <div className={styles.feed}>
        {loading && (
          <p className={styles.loadingText}>
            {lang === 'ja' ? '読込中...' : 'Loading…'}
          </p>
        )}
        {!loading && announcements.length === 0 && (
          <p className={styles.emptyText}>
            {lang === 'ja' ? 'まだお知らせがありません。' : 'No announcements yet.'}
          </p>
        )}
        {announcements.map((ann) => (
          <AnnouncementCard key={ann.id} ann={ann} lang={lang}
            readCount={readCounts[ann.id] ?? 0} totalUsers={totalUsers} />
        ))}
      </div>
    </div>
  );
}
