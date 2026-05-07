'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { SkeletonList } from './Skeleton';
import styles from './Chat.module.css';

const MAX_HISTORY = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function translateMessage(text, targetLang) {
  const res = await fetch('/api/translate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ text, targetLang: targetLang === 'ja' ? 'Japanese' : 'English' }),
  });
  if (!res.ok) throw new Error('Translation failed');
  const data = await res.json();
  return data.translation;
}

function slugify(str) {
  return str.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
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
  const [translation, setTranslation] = useState(null);
  const [translating, setTranslating] = useState(false);

  const handleTranslate = useCallback(async () => {
    if (translation) { setTranslation(null); return; }
    setTranslating(true);
    try {
      const result = await translateMessage(msg.content, uiLang === 'ja' ? 'en' : 'ja');
      setTranslation(result);
    } catch {
      setTranslation(uiLang === 'ja' ? '翻訳に失敗しました。' : 'Translation failed — check API key.');
    } finally {
      setTranslating(false);
    }
  }, [msg.content, translation, uiLang]);

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
        <button className={styles.translateBtn} onClick={handleTranslate} disabled={translating}>
          {translating
            ? (uiLang === 'ja' ? '翻訳中...' : 'Translating…')
            : translation
              ? (uiLang === 'ja' ? '翻訳を隠す' : 'Hide translation')
              : (uiLang === 'ja' ? '翻訳' : 'Translate')}
        </button>
        {translation && (
          <div className={styles.translation}>
            <span className={styles.translationLabel}>{uiLang === 'ja' ? '翻訳:' : 'Translation:'}</span>
            {translation}
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
  const [addProfileId,   setAddProfileId]   = useState('');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  const t = (en, ja) => uiLang === 'ja' ? ja : en;

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const [{ data: ch }, { data: pr }] = await Promise.all([
      supabase.from('channels').select('id, name, description, created_at').order('created_at'),
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
    const { error: err } = await supabase.from('channels').insert({
      id,
      name:        formName.trim(),
      description: formDesc.trim() || null,
      created_by:  currentUserId,
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

  async function handleAddMember() {
    if (!addProfileId) return;
    await supabase.from('channel_members').insert({ channel_id: target.id, profile_id: addProfileId });
    setAddProfileId('');
    await loadMembers(target.id);
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
            {channels.map(ch => (
              <div key={ch.id} className={styles.channelRow}>
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
                <div className={styles.addMemberRow}>
                  <select className={styles.modalSelect} value={addProfileId}
                    onChange={e => setAddProfileId(e.target.value)}>
                    <option value="">{t('— select user —', '— ユーザーを選択 —')}</option>
                    {profiles
                      .filter(p => !members.some(m => m.profile_id === p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.display_name || p.email} ({p.role})
                        </option>
                      ))}
                  </select>
                  <button className={styles.saveBtn} onClick={handleAddMember} disabled={!addProfileId}>
                    {t('Add', '追加')}
                  </button>
                </div>
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
      const name = (p.display_name || p.email || '').toLowerCase();
      return name.includes(query.toLowerCase());
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
                  {(p.display_name || p.email || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className={styles.dmUserInfo}>
                  <span className={styles.dmUserName}>{p.display_name || p.email}</span>
                  <span className={styles.dmUserRole}>{p.role}</span>
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
          className={`${styles.channelItem} ${activeChannel === dm.channelId ? styles.channelActive : ''}`}
          onClick={() => onSelect(dm.channelId)}>
          <span className={styles.dmDot}>●</span>
          {dm.name}
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
    supabase.from('profiles').select('id, display_name, email, role').order('display_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  // Load existing DM conversations for current user
  useEffect(() => {
    if (!currentUser?.id) return;
    async function loadDMs() {
      const { data } = await supabase
        .from('messages')
        .select('channel')
        .like('channel', 'dm:%')
        .limit(500);
      if (!data) return;
      const myId = currentUser.id;
      const seen = new Set();
      const convs = [];
      for (const row of data) {
        const ch = row.channel;
        if (seen.has(ch)) continue;
        // channel = "dm:uid1_uid2"
        const parts = ch.slice(3).split('_');
        if (parts.length !== 2) continue;
        const [a, b] = parts;
        const otherId = a === myId ? b : b === myId ? a : null;
        if (!otherId) continue;
        seen.add(ch);
        convs.push({ channelId: ch, otherId });
      }
      setDmConversations(convs);
    }
    loadDMs();
  }, [currentUser?.id]);

  // Resolve DM conversation names from profiles
  const dmConversationsWithNames = dmConversations.map(dm => {
    const other = profiles.find(p => p.id === dm.otherId);
    return { ...dm, name: other?.display_name || other?.email || dm.otherId.slice(0, 8) };
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
    // Add to sidebar if not already there
    setDmConversations(prev =>
      prev.some(d => d.channelId === chId)
        ? prev
        : [...prev, { channelId: chId, otherId: p.id }]
    );
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
