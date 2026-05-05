'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Chat.module.css';

const MAX_HISTORY = 50;

// ── Translation ──────────────────────────────────────────────────────────────

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
        <button
          className={styles.translateBtn}
          onClick={handleTranslate}
          disabled={translating}
        >
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
  const [view,           setView]           = useState('list');   // list | create | edit | members
  const [channels,       setChannels]       = useState([]);
  const [profiles,       setProfiles]       = useState([]);
  const [members,        setMembers]        = useState([]);
  const [target,         setTarget]         = useState(null);     // channel being edited/managed
  const [formName,       setFormName]       = useState('');
  const [formDesc,       setFormDesc]       = useState('');
  const [saving,         setSaving]         = useState(false);
  const [addProfileId,   setAddProfileId]   = useState('');
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

  async function handleEdit() {
    setError('');
    setSaving(true);
    const { error: err } = await supabase.from('channels')
      .update({ description: formDesc.trim() || null })
      .eq('id', target.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    await loadAll();
    setView('list');
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

  const memberProfileIds = new Set(members.map(m => m.profile_id));
  const nonMembers = profiles.filter(p => !memberProfileIds.has(p.id));

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.manageModal} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className={styles.manageHead}>
          {view !== 'list' && (
            <button className={styles.manageBack} onClick={() => { setView('list'); setError(''); }}>
              ← {t('Back', '戻る')}
            </button>
          )}
          <span className={styles.manageTitle}>
            {view === 'list'    && t('Manage Channels', 'チャンネル管理')}
            {view === 'create'  && t('New Channel', '新しいチャンネル')}
            {view === 'edit'    && t(`Edit #${target?.name}`, `#${target?.name} を編集`)}
            {view === 'members' && t(`Members — #${target?.name}`, `#${target?.name} のメンバー`)}
          </span>
          <button className={styles.manageClose} onClick={onClose}>✕</button>
        </div>

        {error && <div className={styles.manageError}>{error}</div>}

        {/* List view */}
        {view === 'list' && (
          <div className={styles.manageBody}>
            <button className={styles.createChannelBtn} onClick={() => { setFormName(''); setFormDesc(''); setView('create'); }}>
              + {t('New Channel', '新しいチャンネル')}
            </button>
            {channels.map(ch => (
              <div key={ch.id} className={styles.channelRow}>
                <div className={styles.channelRowInfo}>
                  <span className={styles.channelRowName}># {ch.name}</span>
                  {ch.description && <span className={styles.channelRowDesc}>{ch.description}</span>}
                </div>
                <div className={styles.channelRowActions}>
                  <button className={styles.rowBtn} onClick={() => {
                    setTarget(ch); setFormDesc(ch.description ?? ''); setView('edit');
                  }}>{t('Edit', '編集')}</button>
                  <button className={styles.rowBtn} onClick={async () => {
                    setTarget(ch); await loadMembers(ch.id); setView('members');
                  }}>{t('Members', 'メンバー')}</button>
                  {ch.id !== 'general' && (
                    <button className={`${styles.rowBtn} ${styles.rowBtnDanger}`} onClick={() => handleDelete(ch)}>
                      {t('Delete', '削除')}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create view */}
        {view === 'create' && (
          <div className={styles.manageBody}>
            <label className={styles.formLabel}>{t('Channel name', 'チャンネル名')}</label>
            <input
              className={styles.formInput}
              value={formName}
              onChange={e => setFormName(e.target.value)}
              placeholder={t('e.g. training-notes', '例：練習メモ')}
              autoFocus
            />
            {formName && <div className={styles.slugPreview}>ID: {slugify(formName)}</div>}
            <label className={styles.formLabel}>{t('Description (optional)', '説明（任意）')}</label>
            <input
              className={styles.formInput}
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder={t('What is this channel for?', 'このチャンネルの目的は？')}
            />
            <button className={styles.saveBtn} onClick={handleCreate} disabled={saving}>
              {saving ? t('Creating…', '作成中…') : t('Create Channel', 'チャンネルを作成')}
            </button>
          </div>
        )}

        {/* Edit view */}
        {view === 'edit' && (
          <div className={styles.manageBody}>
            <label className={styles.formLabel}>{t('Description', '説明')}</label>
            <input
              className={styles.formInput}
              value={formDesc}
              onChange={e => setFormDesc(e.target.value)}
              placeholder={t('What is this channel for?', 'このチャンネルの目的は？')}
              autoFocus
            />
            <button className={styles.saveBtn} onClick={handleEdit} disabled={saving}>
              {saving ? t('Saving…', '保存中…') : t('Save', '保存')}
            </button>
          </div>
        )}

        {/* Members view */}
        {view === 'members' && (
          <div className={styles.manageBody}>
            {/* Add member */}
            <div className={styles.addMemberRow}>
              <select
                className={styles.formSelect}
                value={addProfileId}
                onChange={e => setAddProfileId(e.target.value)}
              >
                <option value="">{t('— Add a member —', '— メンバーを追加 —')}</option>
                {nonMembers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.display_name || p.email} ({p.role})
                  </option>
                ))}
              </select>
              <button className={styles.saveBtn} onClick={handleAddMember} disabled={!addProfileId}>
                {t('Add', '追加')}
              </button>
            </div>

            {/* Current members */}
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
          </div>
        )}

      </div>
    </div>
  );
}

// ── Channel Sidebar ───────────────────────────────────────────────────────────

function ChannelSidebar({ channels, activeChannel, onSelect, canManage, onManage, uiLang, mobileOpen }) {
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
        <button
          key={ch.id}
          className={`${styles.channelItem} ${activeChannel === ch.id ? styles.channelActive : ''}`}
          onClick={() => onSelect(ch.id)}
          title={ch.description ?? ''}
        >
          <span className={styles.hash}>#</span>
          {ch.name}
        </button>
      ))}
    </aside>
  );
}

// ── Main Chat Component ───────────────────────────────────────────────────────

export default function Chat({ currentUser, uiLang = 'en', profile }) {
  const [channels,          setChannels]          = useState([]);
  const [activeChannel,     setActiveChannel]     = useState(null);
  const [messagesByChannel, setMessagesByChannel] = useState({});
  const [inputValue,        setInputValue]        = useState('');
  const [sending,           setSending]           = useState(false);
  const [loading,           setLoading]           = useState(false);
  const [error,             setError]             = useState(null);
  const [showManage,        setShowManage]        = useState(false);
  const [showChanList,      setShowChanList]      = useState(false);

  const [profiles,     setProfiles]     = useState([]);
  const [mentionQuery, setMentionQuery] = useState(null); // { query, start } | null
  const [mentionIdx,   setMentionIdx]   = useState(0);

  const endRef          = useRef(null);
  const subscriptionRef = useRef(null);
  const inputRef        = useRef(null);

  const canManage = profile?.role && profile.role !== 'Player';
  const messages  = messagesByChannel[activeChannel] ?? [];

  // Load channels from DB on mount
  useEffect(() => {
    async function loadChannels() {
      const { data } = await supabase
        .from('channels')
        .select('id, name, description')
        .order('created_at');
      const list = data ?? [];
      setChannels(list);
      if (list.length > 0 && !activeChannel) setActiveChannel(list[0].id);
    }
    loadChannels();
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Load history when channel changes
  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;

    async function loadHistory() {
      setLoading(true);
      setError(null);
      const { data, error: dbError } = await supabase
        .from('messages')
        .select('*')
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
          // Replace matching optimistic message from this sender to avoid duplicates
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

  // Load profiles for @-mention autocomplete
  useEffect(() => {
    supabase.from('profiles').select('id, display_name, email').order('display_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  // Profiles matching current @query
  const mentionMatches = mentionQuery
    ? profiles
        .filter(p => (p.display_name || p.email || '').toLowerCase().includes(mentionQuery.query.toLowerCase()))
        .slice(0, 6)
    : [];

  const insertMention = useCallback((profile) => {
    const name = profile.display_name || profile.email;
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

  // Send a message
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

  const activeChannelObj = channels.find(c => c.id === activeChannel);

  return (
    <div className={styles.wrapper}>
      {/* Mobile overlay — tap to close channel list */}
      {showChanList && (
        <div className={styles.mobileOverlay} onClick={() => setShowChanList(false)} />
      )}

      <ChannelSidebar
        channels={channels}
        activeChannel={activeChannel}
        onSelect={ch => { setActiveChannel(ch); setError(null); setShowChanList(false); }}
        canManage={canManage}
        onManage={() => setShowManage(true)}
        uiLang={uiLang}
        mobileOpen={showChanList}
      />

      <div className={styles.chatArea}>
        {/* Channel header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <button className={styles.mobileChanBtn} onClick={() => setShowChanList(v => !v)}>
              ≡
            </button>
            <span className={styles.headerChannel}># {activeChannel}</span>
            {activeChannelObj?.description && (
              <span className={styles.headerDesc}>{activeChannelObj.description}</span>
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

        {/* Message list */}
        <div className={styles.messageList}>
          {loading && (
            <p className={styles.loadingText}>
              {uiLang === 'ja' ? 'メッセージを読み込み中...' : 'Loading messages…'}
            </p>
          )}
          {!loading && messages.length === 0 && (
            <p className={styles.emptyText}>
              {uiLang === 'ja' ? 'まだメッセージがありません。最初に送信しましょう！' : 'No messages yet. Be the first to say something!'}
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

        {/* Input bar */}
        <div className={styles.inputWrap}>
          {mentionQuery && mentionMatches.length > 0 && (
            <div className={styles.mentionDropdown}>
              {mentionMatches.map((p, i) => (
                <button
                  key={p.id}
                  className={`${styles.mentionItem} ${i === mentionIdx ? styles.mentionItemActive : ''}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(p); }}
                >
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
              const cursor = e.target.selectionStart ?? val.length;
              const before = val.slice(0, cursor);
              const m = before.match(/@([^\s@]*)$/);
              if (m) {
                setMentionQuery({ query: m[1], start: cursor - m[0].length });
                setMentionIdx(0);
              } else {
                setMentionQuery(null);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              uiLang === 'ja'
                ? `#${activeChannel ?? ''} にメッセージを送信...`
                : `Message #${activeChannel ?? ''}… (@ to mention)`
            }
            disabled={sending || !activeChannel}
          />
          <button
            className={styles.sendButton}
            onClick={sendMessage}
            disabled={sending || !inputValue.trim() || !activeChannel}
          >
            {uiLang === 'ja' ? '送信' : 'Send'}
          </button>
          </div>
        </div>
      </div>

      {showManage && (
        <ChannelManageModal
          onClose={() => {
            setShowManage(false);
            // Reload channels in case any were added/removed
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
    </div>
  );
}
