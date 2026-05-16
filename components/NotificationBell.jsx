'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/date';
import styles from './NotificationBell.module.css';

const TYPE_ICONS = {
  announcement:    '📢',
  calendar_invite: '📅',
  task_deadline:   '✅',
  dm:              '💬',
  wellness_other:  '🩺',
};

function typeIcon(type) { return TYPE_ICONS[type] ?? '🔔'; }

export default function NotificationBell({ userId, lang, onNavigate, chatUnread = 0 }) {
  const [items,  setItems]  = useState([]);
  const [open,   setOpen]   = useState(false);
  const wrapRef = useRef(null);

  const unread = items.filter(n => !n.is_read).length + chatUnread;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30);
    setItems(data ?? []);
  }, [userId]);

  const checkTaskDeadlines = useCallback(async (lang) => {
    const now    = new Date();
    const today  = now.toISOString().slice(0, 10);
    const cutoff = new Date(now.getTime() + 48 * 3600 * 1000).toISOString().slice(0, 10);

    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date')
      .eq('assigned_to', userId)
      .not('status', 'eq', 'done')
      .gte('due_date', today)
      .lte('due_date', cutoff);

    if (!tasks || tasks.length === 0) return;

    const { data: existing } = await supabase
      .from('notifications')
      .select('ref_id')
      .eq('user_id', userId)
      .eq('type', 'task_deadline')
      .gte('created_at', `${today}T00:00:00`);

    const alreadyNotified = new Set((existing ?? []).map(n => n.ref_id));
    const toInsert = tasks
      .filter(t => !alreadyNotified.has(t.id))
      .map(t => ({
        user_id:    userId,
        type:       'task_deadline',
        title:      lang === 'ja' ? `タスク期限: ${t.title}` : `Task due: ${t.title}`,
        body:       t.due_date,
        nav_target: 'tasks',
        ref_id:     t.id,
      }));

    if (toInsert.length > 0) {
      await supabase.from('notifications').insert(toInsert);
      load();
    }
  }, [userId, load]);

  useEffect(() => {
    load();
    checkTaskDeadlines(lang);

    const channel = supabase
      .channel(`notif_bell_${userId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'notifications',
        filter: `user_id=eq.${userId}`,
      }, () => load())
      .subscribe();

    return () => channel.unsubscribe();
    // lang intentionally omitted — only used for notification title text on first mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, load, checkTaskDeadlines]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markRead = async id => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const ids = items.filter(n => !n.is_read).map(n => n.id);
    if (!ids.length) return;
    const { error } = await supabase.from('notifications').update({ is_read: true }).in('id', ids);
    if (!error) setItems(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleClick = n => {
    markRead(n.id);
    if (n.nav_target && onNavigate) onNavigate(n.nav_target);
    setOpen(false);
  };

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        className={`${styles.bell} ${unread > 0 ? styles.bellActive : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className={styles.badge}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <span className={styles.panelTitle}>
              {lang === 'ja' ? '通知' : 'Notifications'}
            </span>
            {unread > 0 && (
              <button className={styles.markAllBtn} onClick={markAllRead}>
                {lang === 'ja' ? 'すべて既読' : 'Mark all read'}
              </button>
            )}
          </div>

          <div className={styles.list}>
            {chatUnread > 0 && (
              <button className={`${styles.item} ${styles.itemUnread}`} onClick={() => { if (onNavigate) onNavigate('chat'); setOpen(false); }}>
                <span className={styles.icon}>💬</span>
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>{lang === 'ja' ? `チャット ${chatUnread}件の未読メッセージ` : `${chatUnread} unread chat message${chatUnread > 1 ? 's' : ''}`}</div>
                </div>
                <span className={styles.dot} />
              </button>
            )}
            {items.length === 0 && chatUnread === 0 && (
              <div className={styles.empty}>{lang === 'ja' ? '通知はありません' : 'No notifications yet'}</div>
            )}
            {items.map(n => (
              <button
                key={n.id}
                className={`${styles.item} ${!n.is_read ? styles.itemUnread : ''}`}
                onClick={() => handleClick(n)}
              >
                <span className={styles.icon}>{typeIcon(n.type)}</span>
                <div className={styles.itemBody}>
                  <div className={styles.itemTitle}>{n.title}</div>
                  {n.body && <div className={styles.itemSub}>{n.body}</div>}
                  <div className={styles.itemTime}>{timeAgo(n.created_at, lang)}</div>
                </div>
                {!n.is_read && <span className={styles.dot} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
