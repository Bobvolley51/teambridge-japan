'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { sendPush } from '@/lib/push';
import { translate } from '@/lib/translate';
import { SkeletonList } from './Skeleton';
import styles from './Chat.module.css';

const MAX_HISTORY = 50;

function profileFullName(p) {
  if (!p) return '';
  if (p.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
  return p.display_name || p.email || '';
}

function profileInitials(p) {
  const name = profileFullName(p);
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

function slugify(str) {
  return (str || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function dmChannelId(uid1, uid2) {
  return 'dm:' + [uid1, uid2].sort().join('_');
}

function isDM(channelId) {
  return typeof channelId === 'string' && channelId.startsWith('dm:');
}

// ── Mention renderer ─────────────────────────────────────────────────────────

function renderContent(content) {
  if (!content.includes('@')) return content;
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) =>
    /^@\S+$/.test(part)
      ? <span key={i} className={styles.mention}>{part}</span>
      : part
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ initials, isMe, avatarUrl }) {
  return (
    <div className={`${styles.avatar} ${isMe ? styles.avatarMe : ''}`}>
      {avatarUrl
        ? <img src={avatarUrl} alt={initials} className={styles.avatarImg} />
        : initials}
    </div>
  );
}

// ── Message ──────────────────────────────────────────────────────────────────

function Message({ msg, isMe, uiLang, currentUserAvatarUrl }) {
  const [jaText, setJaText] = useState(null);
  const [enText, setEnText] = useState(null);
  const [showTranslations, setShowTranslations] = useState(false);

  useEffect(() => {
    if (!showTranslations) return;
    let cancelled = false;
    Promise.all([
      translate(msg.content, 'ja'),
      translate(msg.content, 'en'),
    ]).then(([ja, en]) => {
      if (!cancelled) { setJaText(ja); setEnText(en); }
    });
    return () => { cancelled = true; };
  }, [msg.content, showTranslations]);

  const time = new Date(msg.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className={`${styles.message} ${isMe ? styles.messageMe : ''}`}>
      <Avatar initials={msg.user_initials} isMe={isMe} avatarUrl={isMe ? currentUserAvatarUrl : null} />
      <div className={styles.messageBody}>
        <div className={styles.messageHeader}>
          <span className={styles.userName}>{msg.user_name}</span>
          <span className={styles.time}>{time}</span>
        </div>
        <p className={styles.content}>{renderContent(msg.content)}</p>
        <button
          className={styles.translateBtn}
          onClick={() => setShowTranslations(v => !v)}
        >
          {showTranslations
            ? (uiLang === 'ja' ? '翻訳を隠す' : 'Hide translations')
            : (uiLang === 'ja' ? '翻訳' : 'Translate')}
        </button>
        {showTranslations && (
          <div className={styles.translations}>
            {enText && enText !== msg.content && (
              <div className={styles.translation}>
                <span className={styles.translationLabel}>EN:</span>
                {enText}
              </div>
            )}
            {jaText && jaText !== msg.content && (
              <div className={styles.translation}>
                <span className={styles.translationLabel}>日本語:</span>
                {jaText}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Channel Manage Modal ──────────────────────────────────────────────────────

function ChannelManageModal({ onClose, currentUserId, uiLang }) {
  const [view,           setView]           = useState('list');
  const [channels,       setChannels]       = useState([]);
  const [profiles,       setProfiles]       = useState([]);
  const [members,        setMembers]        = useState([]);
  const [target,         setTarget]         = useState(null);
  const [formName,       setFormName]       = useState('');
  const [formDesc,       setFormDesc]       = useState('');
  const [addProfileIds,  setAddProfileIds]  = useState(new Set());
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  const t = (en, ja) => uiLang === 'ja' ? ja : en;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{ data: ch }, { data: pr }] = await Promise.all([
      supabase.from('channels').select('id, name, description, created_at, sort_order').order('sort_order'),
      supabase.from('profiles').select('id, display_name, email, role').order('display_name'),
    ]);
    setChannels(ch ?? []);
    setProfiles(pr ?? []);
  }

  async function loadMembers(channelId) {
    const { data } = await supabase
      .from('channel_members')
      .select('profile_id, profiles(id, display_name, email)')
      .eq('channel_id', channelId);
    setMembers(data ?? []);
  }

  async function handleCreate() {
    setError('');
    const id = slugify(formName);
    if (!id) { setError(t('Channel name is required.', 'チャンネル名が必要です。')); return; }
    setSaving(true);
    const maxOrder = channels.reduce((m, c) => Math.max(m, c.sort_order ?? 0), 0);
    const { error: err } = await supabase.from('channels').insert({
      id,
      name:        formName.trim(),
      description: formDesc.trim() || null,
      created_by:  currentUserId,
      sort_order:  maxOrder + 1,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setFormName(''); setFormDesc('');
    await loadAll();
    setView('list');
  }

  async function handleSaveDesc() {
    setError('');
    setSaving(true);
    const { error: err } = await supabase.from('channels')
      .update({ description: formDesc.trim() || null })
      .eq('id', target.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    await loadAll();
    setView('members');
  }

  async function handleDelete(ch) {
    if (!confirm(t(`Delete #${ch.name}? All messages will remain but the channel will be gone.`,
                   `#${ch.name} を削除しますか？メッセージはそのまま残ります。`))) return;
    await supabase.from('channels').delete().eq('id', ch.id);
    await loadAll();
  }

  async function handleAddMembers() {
    if (!addProfileIds.size) return;
    const rows = [...addProfileIds].map(pid => ({ channel_id: target.id, profile_id: pid }));
    await supabase.from('channel_members').insert(rows);
    setAddProfileIds(new Set());
    await loadMembers(target.id);
  }

  function toggleAddProfile(id) {
    setAddProfileIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleMove(ch, dir) {
    const idx     = channels.findIndex(c => c.id === ch.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= channels.length) return;
    const other = channels[swapIdx];
    await Promise.all([
      supabase.from('channels').update({ sort_order: other.sort_order }).eq('id', ch.id),
      supabase.from('channels').update({ sort_order: ch.sort_order   }).eq('id', other.id),
    ]);
    await loadAll();
  }

  async function handleRemoveMember(profileId) {
    await supabase.from('channel_members').delete()
      .eq('channel_id', target.id).eq('profile_id', profileId);
    await loadMembers(target.id);
  }

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <span>{view === 'list' ? t('Manage Channels', 'チャンネル管理')
                : view === 'create' ? t('New Channel', '新しいチャンネル')
                : view === 'edit'   ? t('Edit Channel', 'チャンネルを編集')
                : t('Members', 'メンバー')}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        {error && <div className={styles.modalError}>{error}</div>}

        {view === 'list' && (
          <div className={styles.modalBody}>
            <button className={styles.createBtn} onClick={() => setView('create')}>
              + {t('New Channel', '新しいチャンネル')}
            </button>
            {channels.map((ch, idx) => (
              <div key={ch.id} className={styles.channelRow}>
                <div className={styles.sortBtns}>
                  <button className={styles.sortBtn} disabled={idx === 0} onClick={() => handleMove(ch, -1)}>↑</button>
                  <button className={styles.sortBtn} disabled={idx === channels.length - 1} onClick={() => handleMove(ch, 1)}>↓</button>
                </div>
                <span className={styles.channelRowName}># {ch.name}</span>
                <div className={styles.channelRowActions}>
                  <button className={styles.rowBtn} onClick={() => {
                    setTarget(ch); setFormDesc(ch.description ?? '');
                    setView('edit'); loadMembers(ch.id);
                  }}>{t('Edit', '編集')}</button>
                  <button className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                    onClick={() => handleDelete(ch)}>
                    {t('Delete', '削除')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {view === 'create' && (
          <div className={styles.modalBody}>
            <label className={styles.modalLabel}>{t('Channel name', 'チャンネル名')}</label>
            <input className={styles.modalInput} value={formName}
              onChange={e => setFormName(e.target.value)} placeholder="e.g. team-news" autoFocus />
            <label className={styles.modalLabel}>{t('Description (optional)', '説明（任意）')}</label>
            <input className={styles.modalInput} value={formDesc}
              onChange={e => setFormDesc(e.target.value)} placeholder={t('What is this channel for?', 'このチャンネルの目的は？')} />
            <div className={styles.modalActions}>
              <button className={styles.backBtn} onClick={() => setView('list')}>← {t('Back', '戻る')}</button>
              <button className={styles.saveBtn} onClick={handleCreate} disabled={saving}>
                {saving ? '…' : t('Create', '作成')}
              </button>
            </div>
          </div>
        )}

        {(view === 'edit' || view === 'members') && (
          <div className={styles.modalBody}>
            <div className={styles.modalTabs}>
              <button className={`${styles.modalTab} ${view === 'edit' ? styles.modalTabActive : ''}`}
                onClick={() => setView('edit')}>{t('Details', '詳細')}</button>
              <button className={`${styles.modalTab} ${view === 'members' ? styles.modalTabActive : ''}`}
                onClick={() => { setView('members'); loadMembers(target.id); }}>{t('Members', 'メンバー')}</button>
            </div>

            {view === 'edit' && (
              <>
                <label className={styles.modalLabel}>{t('Description', '説明')}</label>
                <input className={styles.modalInput} value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder={t('What is this channel for?', 'このチャンネルの目的は？')} autoFocus />
                <div className={styles.modalActions}>
                  <button className={styles.backBtn} onClick={() => setView('list')}>← {t('Back', '戻る')}</button>
                  <button className={styles.saveBtn} onClick={handleSaveDesc} disabled={saving}>
                    {saving ? '…' : t('Save', '保存')}
                  </button>
                </div>
              </>
            )}

            {view === 'members' && (
              <>
                {/* Multi-select add */}
                {profiles.filter(p => !members.some(m => m.profile_id === p.id)).length > 0 && (
                  <div className={styles.addMemberMulti}>
                    <div className={styles.addMemberMultiList}>
                      {profiles
                        .filter(p => !members.some(m => m.profile_id === p.id))
                        .map(p => (
                          <label key={p.id} className={styles.memberCheckRow}>
                            <input type="checkbox"
                              checked={addProfileIds.has(p.id)}
                              onChange={() => toggleAddProfile(p.id)} />
                            <span className={styles.memberCheckName}>{p.display_name || p.email}</span>
                            <span className={styles.memberCheckRole}>{p.role}</span>
                          </label>
                        ))}
                    </div>
                    <button className={styles.saveBtn} onClick={handleAddMembers} disabled={!addProfileIds.size}>
                      {t(`Add (${addProfileIds.size})`, `追加 (${addProfileIds.size})`)}
                    </button>
                  </div>
                )}
                <div className={styles.memberDivider} />
                {members.length === 0 ? (
                  <div className={styles.emptyMembers}>{t('No members yet — channel is open to all.', 'まだメンバーがいません。全員が参加できます。')}</div>
                ) : (
                  members.map(m => {
                    const p = m.profiles;
                    return (
                      <div key={m.profile_id} className={styles.memberRow}>
                        <span className={styles.memberName}>{p?.display_name || p?.email}</span>
                        <button className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                          onClick={() => handleRemoveMember(m.profile_id)}>
                          {t('Remove', '削除')}
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── New DM Modal ──────────────────────────────────────────────────────────────

function NewDMModal({ profiles, currentUserId, onSelect, onClose, uiLang }) {
  const [query, setQuery] = useState('');
  const filtered = profiles
    .filter(p => p.id !== currentUserId)
    .filter(p => {
      const name = profileFullName(p).toLowerCase();
      return name.includes(query.toLowerCase()) || (p.email || '').toLowerCase().includes(query.toLowerCase());
    });

  return (
    <div className={styles.modalOverlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <span>{uiLang === 'ja' ? 'ダイレクトメッセージ' : 'New Direct Message'}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <input
            className={styles.modalInput}
            placeholder={uiLang === 'ja' ? '名前で検索…' : 'Search by name…'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className={styles.dmUserList}>
            {filtered.map(p => (
              <button key={p.id} className={styles.dmUserItem} onClick={() => onSelect(p)}>
                <div className={styles.dmUserAvatar}>
                  {profileInitials(p)}
                </div>
                <div className={styles.dmUserInfo}>
                  <span className={styles.dmUserName}>{profileFullName(p)}</span>
                  <span className={styles.dmUserRole}>{p.position || p.role}</span>
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className={styles.emptyText}>{uiLang === 'ja' ? '一致するユーザーなし' : 'No users found'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

function Sidebar({ channels, dmConversations, activeChannel, onSelect, onNewDM, canManage, onManage, uiLang, mobileOpen }) {
  return (
    <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarMobileOpen : ''}`}>
      <div className={styles.sidebarHead}>
        <span className={styles.sectionLabel}>{uiLang === 'ja' ? 'チャンネル' : 'Channels'}</span>
        {canManage && (
          <button className={styles.manageBtn} onClick={onManage} title={uiLang === 'ja' ? 'チャンネル管理' : 'Manage channels'}>
            ⚙
          </button>
        )}
      </div>
      {channels.map(ch => (
        <button key={ch.id}
          className={`${styles.channelItem} ${activeChannel === ch.id ? styles.channelActive : ''}`}
          onClick={() => onSelect(ch.id)}
          title={ch.description ?? ''}>
          <span className={styles.hash}>#</span>
          {ch.name}
        </button>
      ))}

      <div className={styles.sidebarDivider} />

      <div className={styles.sidebarHead}>
        <span className={styles.sectionLabel}>{uiLang === 'ja' ? 'ダイレクト' : 'Direct Messages'}</span>
        <button className={styles.manageBtn} onClick={onNewDM} title={uiLang === 'ja' ? '新規DM' : 'New DM'}>
          +
        </button>
      </div>
      {dmConversations.map(dm => (
        <button key={dm.channelId}
          className={`${styles.channelItem} ${styles.dmItem} ${activeChannel === dm.channelId ? styles.channelActive : ''}`}
          onClick={() => onSelect(dm.channelId)}
          title={dm.name}>
          <span className={styles.dmAvatar}>{dm.initials ?? dm.name?.slice(0, 2)?.toUpperCase()}</span>
          <span className={styles.dmItemInfo}>
            <span className={styles.dmItemName}>{dm.name}</span>
            {dm.subtitle && <span className={styles.dmItemSub}>{dm.subtitle}</span>}
          </span>
        </button>
      ))}
      {dmConversations.length === 0 && (
        <p className={styles.dmEmpty}>{uiLang === 'ja' ? 'まだDMなし' : 'No DMs yet'}</p>
      )}
    </aside>
  );
}

// ── Main Chat Component ───────────────────────────────────────────────────────

export default function Chat({ currentUser, uiLang = 'en', profile }) {
  const [channels,          setChannels]          = useState([]);
  const [dmConversations,   setDmConversations]   = useState([]);
  const [activeChannel,     setActiveChannel]     = useState(null);
  const [messagesByChannel, setMessagesByChannel] = useState({});
  const [inputValue,        setInputValue]        = useState('');
  const [sending,           setSending]           = useState(false);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [showManage,        setShowManage]        = useState(false);
  const [showNewDM,         setShowNewDM]         = useState(false);
  const [showChanList,      setShowChanList]      = useState(false);

  const [profiles,     setProfiles]     = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIdx,   setMentionIdx]   = useState(0);

  const endRef          = useRef(null);
  const subscriptionRef = useRef(null);
  const inputRef        = useRef(null);

  const canManage = profile?.role && profile.role !== 'Player';
  const messages  = messagesByChannel[activeChannel] ?? [];

  // Stamp last-visited time so Dashboard can filter already-seen messages
  useEffect(() => {
    if (currentUser?.id) {
      localStorage.setItem(`chat_last_visited_${currentUser.id}`, new Date().toISOString());
    }
  }, [currentUser?.id]);

  // Load channels on mount
  useEffect(() => {
    async function loadChannels() {
      const { data } = await supabase
        .from('channels').select('id, name, description').order('created_at');
      const list = data ?? [];
      setChannels(list);
      if (list.length > 0 && !activeChannel) setActiveChannel(list[0].id);
    }
    loadChannels();
  }, []);

  // Load profiles for @-mentions and DM picker
  useEffect(() => {
    supabase.from('profiles').select('id, display_name, first_name, last_name, email, role, position').order('display_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  // Load existing DM conversations — from localStorage first, then sync from DB
  useEffect(() => {
    if (!currentUser?.id) return;
    const myId = currentUser.id;
    const storageKey = `dm_convs_${myId}`;

    // Restore from localStorage immediately so sidebar shows on remount
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      if (stored.length > 0) setDmConversations(stored);
    } catch {}

    async function loadDMs() {
      const { data } = await supabase
        .from('messages')
        .select('channel, created_at')
        .like('channel', 'dm:%')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!data) return;
      const seen = new Map(); // channelId → latestAt
      for (const row of data) {
        if (!seen.has(row.channel)) seen.set(row.channel, row.created_at);
      }
      const convs = [];
      for (const [ch, latestAt] of seen) {
        const inner = ch.slice(3);
        const sep = inner.indexOf('_');
        if (sep === -1) continue;
        const a = inner.slice(0, sep);
        const b = inner.slice(sep + 1);
        const otherId = a === myId ? b : b === myId ? a : null;
        if (!otherId) continue;
        convs.push({ channelId: ch, otherId, latestAt });
      }
      convs.sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
      if (convs.length > 0) {
        setDmConversations(convs);
        localStorage.setItem(storageKey, JSON.stringify(convs));
      }
    }
    loadDMs();
  }, [currentUser?.id]);

  // Resolve DM conversation names from profiles
  const dmConversationsWithNames = dmConversations.map(dm => {
    const other = profiles.find(p => p.id === dm.otherId);
    const name = other ? profileFullName(other) : dm.otherId.slice(0, 8);
    const subtitle = other ? (other.position || other.role || '') : '';
    const initials = other ? profileInitials(other) : '?';
    return { ...dm, name, subtitle, initials };
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Load history when active channel changes
  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;
    async function loadHistory() {
      setLoading(true);
      setError(null);
      const { data, error: dbError } = await supabase
        .from('messages').select('*')
        .eq('channel', activeChannel)
        .order('created_at', { ascending: true })
        .limit(MAX_HISTORY);
      if (cancelled) return;
      if (dbError) {
        setError((uiLang === 'ja' ? 'メッセージを読み込めませんでした：' : 'Could not load messages: ') + dbError.message);
      } else {
        setMessagesByChannel(prev => ({ ...prev, [activeChannel]: data ?? [] }));
      }
      setLoading(false);
    }
    loadHistory();
    return () => { cancelled = true; };
  }, [activeChannel, uiLang]);

  // Realtime subscription
  useEffect(() => {
    if (!activeChannel) return;
    subscriptionRef.current?.unsubscribe();
    const channel = supabase
      .channel(`chat:${activeChannel}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `channel=eq.${activeChannel}`,
      }, payload => {
        const newMsg = payload.new;
        setMessagesByChannel(prev => {
          const existing = prev[activeChannel] ?? [];
          if (existing.some(m => m.id === newMsg.id)) return prev;
          const optIdx = existing.findIndex(
            m => m._optimistic && m.user_name === newMsg.user_name && m.content === newMsg.content
          );
          if (optIdx !== -1) {
            const updated = [...existing];
            updated[optIdx] = newMsg;
            return { ...prev, [activeChannel]: updated };
          }
          return { ...prev, [activeChannel]: [...existing, newMsg] };
        });
        if (isDM(activeChannel)) {
          setDmConversations(prev => {
            const updated = prev.map(d => d.channelId === activeChannel ? { ...d, latestAt: newMsg.created_at } : d);
            return [...updated].sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
          });
        }
      })
      .subscribe();
    subscriptionRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [activeChannel]);

  const mentionMatches = mentionQuery
    ? profiles
        .filter(p => (p.display_name || p.email || '').toLowerCase().includes(mentionQuery.query.toLowerCase()))
        .slice(0, 6)
    : [];

  const insertMention = useCallback((p) => {
    const name = p.display_name || p.email;
    const cursor = inputRef.current?.selectionStart ?? inputValue.length;
    const before = inputValue.slice(0, mentionQuery?.start ?? cursor);
    const after  = inputValue.slice(cursor);
    const newVal = `${before}@${name} ${after}`;
    setInputValue(newVal);
    setMentionQuery(null);
    setTimeout(() => {
      const pos = before.length + name.length + 2;
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(pos, pos);
    }, 0);
  }, [inputValue, mentionQuery]);

  const sendMessage = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || sending || !activeChannel) return;
    setSending(true);
    setInputValue('');

    const optimisticMsg = {
      id:            crypto.randomUUID(),
      channel:       activeChannel,
      user_name:     currentUser.name,
      user_initials: currentUser.initials,
      content:       text,
      created_at:    new Date().toISOString(),
      _optimistic:   true,
    };
    setMessagesByChannel(prev => ({
      ...prev,
      [activeChannel]: [...(prev[activeChannel] ?? []), optimisticMsg],
    }));

    const { error: insertError } = await supabase.from('messages').insert({
      channel:       activeChannel,
      user_name:     currentUser.name,
      user_initials: currentUser.initials,
      content:       text,
      sender_id:     currentUser.id,
    });

    // Bump DM to top of list
    if (isDM(activeChannel)) {
      const now = new Date().toISOString();
      setDmConversations(prev => {
        const updated = prev.map(d => d.channelId === activeChannel ? { ...d, latestAt: now } : d);
        return [...updated].sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
      });
    }

    // Send notification + push to recipient for DMs
    if (!insertError && isDM(activeChannel)) {
      const inner = activeChannel.slice(3);
      const sep = inner.indexOf('_');
      const a = inner.slice(0, sep);
      const b = inner.slice(sep + 1);
      const recipientId = a === currentUser.id ? b : a;
      supabase.from('notifications').insert({
        user_id:    recipientId,
        type:       'dm',
        title:      currentUser.name,
        body:       text,
        nav_target: 'chat',
      }).then();
      sendPush([recipientId], {
        title:   currentUser.name,
        body:    text.length > 80 ? text.slice(0, 80) + '…' : text,
        url:     '/?nav=chat',
        tag:     `dm-${activeChannel}`,
        prefKey: 'chat_dm',
      });
    }

    if (insertError) {
      setError('Send failed: ' + insertError.message);
      setMessagesByChannel(prev => ({
        ...prev,
        [activeChannel]: (prev[activeChannel] ?? []).filter(m => m.id !== optimisticMsg.id),
      }));
      setInputValue(text);
    }
    setSending(false);
  }, [inputValue, sending, activeChannel, currentUser]);

  const handleKeyDown = useCallback(e => {
    if (mentionQuery && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape')    { setMentionQuery(null); return; }
      if (e.key === 'Enter')     { e.preventDefault(); insertMention(mentionMatches[mentionIdx]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [mentionQuery, mentionMatches, mentionIdx, insertMention, sendMessage]);

  const handleSelectDMUser = (p) => {
    const chId = dmChannelId(currentUser.id, p.id);
    setDmConversations(prev => {
      if (prev.some(d => d.channelId === chId)) return prev;
      const next = [...prev, { channelId: chId, otherId: p.id }];
      localStorage.setItem(`dm_convs_${currentUser.id}`, JSON.stringify(next));
      return next;
    });
    setActiveChannel(chId);
    setShowNewDM(false);
    setShowChanList(false);
  };

  const activeChannelObj  = channels.find(c => c.id === activeChannel);
  const activeDM          = dmConversationsWithNames.find(d => d.channelId === activeChannel);
  const isActiveDM        = isDM(activeChannel);

  const headerTitle = isActiveDM
    ? activeDM?.name ?? activeChannel
    : activeChannelObj ? `# ${activeChannelObj.name}` : `# ${activeChannel}`;

  const inputPlaceholder = isActiveDM
    ? (uiLang === 'ja' ? `${activeDM?.name ?? ''} にメッセージを送信...` : `Message ${activeDM?.name ?? ''}…`)
    : (uiLang === 'ja' ? `#${activeChannel ?? ''} にメッセージを送信...` : `Message #${activeChannel ?? ''}… (@ to mention)`);

  return (
    <div className={styles.wrapper}>
      {showChanList && (
        <div className={styles.mobileOverlay} onClick={() => setShowChanList(false)} />
      )}

      <Sidebar
        channels={channels}
        dmConversations={dmConversationsWithNames}
        activeChannel={activeChannel}
        onSelect={ch => { setActiveChannel(ch); setError(null); setShowChanList(false); }}
        onNewDM={() => setShowNewDM(true)}
        canManage={canManage}
        onManage={() => setShowManage(true)}
        uiLang={uiLang}
        mobileOpen={showChanList}
      />

      <div className={styles.chatArea}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.mobileChanBtn} onClick={() => setShowChanList(v => !v)}>≡</button>
            <span className={styles.headerChannel}>{headerTitle}</span>
            {!isActiveDM && activeChannelObj?.description && (
              <span className={styles.headerDesc}>{activeChannelObj.description}</span>
            )}
            {isActiveDM && (
              <span className={styles.headerDesc}>
                {uiLang === 'ja' ? 'ダイレクトメッセージ' : 'Direct Message'}
              </span>
            )}
          </div>
          <span className={styles.headerCount}>
            {loading ? '…' : `${messages.length} ${uiLang === 'ja' ? 'メッセージ' : 'messages'}`}
          </span>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            {error}
            <button onClick={() => setError(null)} className={styles.errorDismiss}>✕</button>
          </div>
        )}

        <div className={styles.messageList}>
          {loading && <div style={{ padding: '16px 8px' }}><SkeletonList rows={5} /></div>}
          {!loading && messages.length === 0 && (
            <p className={styles.emptyText}>
              {isActiveDM
                ? (uiLang === 'ja' ? 'まだメッセージがありません。最初に送信しましょう！' : `Start a conversation with ${activeDM?.name ?? ''}`)
                : (uiLang === 'ja' ? 'まだメッセージがありません。最初に送信しましょう！' : 'No messages yet. Be the first to say something!')}
            </p>
          )}
          {messages.map(msg => (
            <Message
              key={msg.id}
              msg={msg}
              isMe={msg.user_name === currentUser.name}
              uiLang={uiLang}
              currentUserAvatarUrl={currentUser.avatarUrl}
            />
          ))}
          <div ref={endRef} />
        </div>

        <div className={styles.inputWrap}>
          {mentionQuery && mentionMatches.length > 0 && (
            <div className={styles.mentionDropdown}>
              {mentionMatches.map((p, i) => (
                <button key={p.id}
                  className={`${styles.mentionItem} ${i === mentionIdx ? styles.mentionItemActive : ''}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(p); }}>
                  <span className={styles.mentionName}>{p.display_name || p.email}</span>
                  {p.display_name && <span className={styles.mentionEmail}>{p.email}</span>}
                </button>
              ))}
            </div>
          )}
          <div className={styles.inputBar}>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={inputValue}
              onChange={e => {
                const val = e.target.value;
                setInputValue(val);
                if (!isActiveDM) {
                  const cursor = e.target.selectionStart ?? val.length;
                  const before = val.slice(0, cursor);
                  const m = before.match(/@([^\s@]*)$/);
                  if (m) {
                    setMentionQuery({ query: m[1], start: cursor - m[0].length });
                    setMentionIdx(0);
                  } else {
                    setMentionQuery(null);
                  }
                }
              }}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              disabled={sending || !activeChannel}
            />
            <button
              className={styles.sendButton}
              onClick={sendMessage}
              disabled={sending || !inputValue.trim() || !activeChannel}>
              {uiLang === 'ja' ? '送信' : 'Send'}
            </button>
          </div>
        </div>
      </div>

      {showManage && (
        <ChannelManageModal
          onClose={() => {
            setShowManage(false);
            supabase.from('channels').select('id, name, description').order('created_at')
              .then(({ data }) => {
                setChannels(data ?? []);
                if (data && data.length > 0 && !data.find(c => c.id === activeChannel)) {
                  setActiveChannel(data[0].id);
                }
              });
          }}
          currentUserId={currentUser?.id}
          uiLang={uiLang}
        />
      )}

      {showNewDM && (
        <NewDMModal
          profiles={profiles}
          currentUserId={currentUser?.id}
          onSelect={handleSelectDMUser}
          onClose={() => setShowNewDM(false)}
          uiLang={uiLang}
        />
      )}
    </div>
  );
}
