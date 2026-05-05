'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './GlobalSearch.module.css';

const ICONS = {
  event:        '📅',
  task:         '✅',
  announcement: '📢',
  trip:         '✈️',
  profile:      '👤',
};

const NAV_TARGET = {
  event:        'calendar',
  task:         'tasks',
  announcement: 'feed',
  trip:         'travel',
  profile:      'admin',
};

async function runSearch(query) {
  const q = query.trim();
  if (!q) return [];

  const like = `%${q}%`;

  const [
    { data: events },
    { data: tasks },
    { data: anns },
    { data: trips },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('events').select('id, title, category, start_time').ilike('title', like).limit(5),
    supabase.from('tasks').select('id, title, status, priority').ilike('title', like).limit(5),
    supabase.from('announcements').select('id, title, content').ilike('title', like).limit(5),
    supabase.from('travel_trips').select('id, title, start_date, location').ilike('title', like).limit(5),
    supabase.from('profiles').select('id, display_name, role, email').or(`display_name.ilike.${like},email.ilike.${like}`).limit(5),
  ]);

  const results = [];

  for (const e of events ?? []) {
    const d = e.start_time ? new Date(e.start_time).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : '';
    results.push({ type: 'event', id: e.id, title: e.title, sub: `${e.category}${d ? ' · ' + d : ''}` });
  }
  for (const t of tasks ?? []) {
    results.push({ type: 'task', id: t.id, title: t.title, sub: `${t.status} · ${t.priority}` });
  }
  for (const a of anns ?? []) {
    results.push({ type: 'announcement', id: a.id, title: a.title, sub: a.content?.slice(0, 60) ?? '' });
  }
  for (const tr of trips ?? []) {
    results.push({ type: 'trip', id: tr.id, title: tr.title, sub: [tr.start_date, tr.location].filter(Boolean).join(' · ') });
  }
  for (const p of profiles ?? []) {
    results.push({ type: 'profile', id: p.id, title: p.display_name || p.email, sub: p.role ?? '' });
  }

  return results;
}

function groupResults(results) {
  const groups = {};
  for (const r of results) {
    if (!groups[r.type]) groups[r.type] = [];
    groups[r.type].push(r);
  }
  return groups;
}

const GROUP_LABELS = {
  event:        { en: 'Events',        ja: 'イベント'   },
  task:         { en: 'Tasks',         ja: 'タスク'     },
  announcement: { en: 'Announcements', ja: 'お知らせ'   },
  trip:         { en: 'Travel',        ja: '旅程'       },
  profile:      { en: 'People',        ja: 'メンバー'   },
};

export default function GlobalSearch({ lang = 'en', onNavigate, onClose }) {
  const [query,      setQuery]      = useState('');
  const [results,    setResults]    = useState([]);
  const [searching,  setSearching]  = useState(false);
  const [activeIdx,  setActiveIdx]  = useState(0);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      const res = await runSearch(query);
      setResults(res);
      setActiveIdx(0);
      setSearching(false);
    }, 280);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  const flatResults = results;

  const handleSelect = useCallback((item) => {
    onNavigate(NAV_TARGET[item.type]);
    onClose();
  }, [onNavigate, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatResults.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && flatResults[activeIdx]) handleSelect(flatResults[activeIdx]);
  };

  const groups = groupResults(results);
  let globalIdx = 0;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            ref={inputRef}
            className={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={lang === 'ja' ? '検索...' : 'Search…'}
          />
          <span className={styles.kbd}>Esc</span>
        </div>

        <div className={styles.results}>
          {!query.trim() && (
            <div className={styles.empty}>
              {lang === 'ja' ? 'キーワードを入力してください' : 'Start typing to search'}
            </div>
          )}
          {query.trim() && !searching && results.length === 0 && (
            <div className={styles.empty}>
              {lang === 'ja' ? '結果が見つかりません' : 'No results found'}
            </div>
          )}
          {Object.entries(groups).map(([type, items]) => (
            <div key={type} className={styles.group}>
              <div className={styles.groupLabel}>{GROUP_LABELS[type]?.[lang] ?? type}</div>
              {items.map(item => {
                const idx = globalIdx++;
                return (
                  <button
                    key={item.id}
                    className={`${styles.item} ${idx === activeIdx ? styles.itemActive : ''}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setActiveIdx(idx)}
                  >
                    <span className={styles.itemIcon}>{ICONS[item.type]}</span>
                    <div className={styles.itemText}>
                      <div className={styles.itemTitle}>{item.title}</div>
                      {item.sub && <div className={styles.itemSub}>{item.sub}</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className={styles.hint}>
          {lang === 'ja' ? '↑↓ で選択、Enter で移動' : '↑↓ to navigate · Enter to open · Esc to close'}
        </div>
      </div>
    </div>
  );
}
