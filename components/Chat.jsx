'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { sendPush } from '@/lib/push';
import { translate } from '@/lib/translate';
import { SkeletonList } from './Skeleton';
import AvatarPhoto from './AvatarPhoto';
import styles from './Chat.module.css';

const MAX_HISTORY = 100;

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

function nameInitials(name) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name || '').slice(0, 2).toUpperCase() || '?';
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

// ── Date separator ────────────────────────────────────────────────────────────

function getDateLabel(dateStr, uiLang) {
  const d = new Date(dateStr);
  const now = new Date();
  const toDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  if (toDay(d) === toDay(now)) return uiLang === 'ja' ? '今日' : 'Today';
  const yest = new Date(now); yest.setDate(yest.getDate() - 1);
  if (toDay(d) === toDay(yest)) return uiLang === 'ja' ? '昨日' : 'Yesterday';
  const opts = { day: 'numeric', month: 'long' };
  if (d.getFullYear() !== now.getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString(uiLang === 'ja' ? 'ja-JP' : 'en-GB', opts);
}

function DateSeparator({ dateStr, uiLang }) {
  return (
    <div className={styles.dateSep}>
      <div className={styles.dateSepLine} />
      <span className={styles.dateSepText}>{getDateLabel(dateStr, uiLang)}</span>
      <div className={styles.dateSepLine} />
    </div>
  );
}

// ── Mention renderer ──────────────────────────────────────────────────────────

function renderContent(content) {
  const parts = content.split(/(https?:\/\/[^\s<>"]+|@\S+)/g);
  if (parts.length === 1) return content;
  return parts.map((part, i) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className={styles.msgLink} onClick={e => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    if (/^@\S+$/.test(part)) {
      if (part.toLowerCase() === '@all')
        return <span key={i} className={styles.mentionAll}>{part}</span>;
      return <span key={i} className={styles.mention}>{part}</span>;
    }
    return part;
  });
}

// ── Message ───────────────────────────────────────────────────────────────────

const QUICK_EMOJIS = ['👍','❤️','😂','🔥','👏','😮'];

function Message({ msg, isMe, uiLang, avatarUrl, senderName, msgReactions, currentUserId,
                   onReply, onReact, onEdit, onDelete, onPin, replyMsg, editingId, editText,
                   onEditChange, onEditSave, onEditCancel, isFirst, isChannel,
                   receiptStatus, isOnline, canPin }) {
  const [jaText, setJaText] = useState(null);
  const [enText, setEnText] = useState(null);
  const [showTranslations, setShowTranslations] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const longPressTimer = useRef(null);
  const swipeStartX = useRef(0);
  const swipeStartY = useRef(0);
  const didSwipe = useRef(false);

  const handleTouchStart = (e) => {
    swipeStartX.current = e.touches[0].clientX;
    swipeStartY.current = e.touches[0].clientY;
    didSwipe.current = false;
    longPressTimer.current = setTimeout(() => { setShowActions(true); setShowEmojiPicker(true); }, 450);
  };
  const handleTouchMove = (e) => {
    const dx = e.touches[0].clientX - swipeStartX.current;
    const dy = Math.abs(e.touches[0].clientY - swipeStartY.current);
    if (dx > 8 && dx > dy * 1.3) {
      clearTimeout(longPressTimer.current);
      didSwipe.current = true;
      setSwipeX(Math.min(dx * 0.55, 64));
    }
  };
  const handleTouchEnd = () => {
    clearTimeout(longPressTimer.current);
    if (didSwipe.current && swipeX >= 40) onReply(msg);
    setSwipeX(0);
    didSwipe.current = false;
  };

  useEffect(() => {
    if (!showTranslations) return;
    let cancelled = false;
    Promise.all([translate(msg.content, 'ja'), translate(msg.content, 'en')])
      .then(([ja, en]) => { if (!cancelled) { setJaText(ja); setEnText(en); } });
    return () => { cancelled = true; };
  }, [msg.content, showTranslations]);

  const time = new Date(msg.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  const isEditing = editingId === msg.id;
  const isDeleted = msg.is_deleted;

  const rxnGroups = {};
  for (const r of (msgReactions ?? [])) {
    if (!rxnGroups[r.emoji]) rxnGroups[r.emoji] = { count: 0, byMe: false };
    rxnGroups[r.emoji].count++;
    if (r.user_id === currentUserId) rxnGroups[r.emoji].byMe = true;
  }

  return (
    <div
      className={`${styles.msgRow} ${isMe ? styles.msgRowMe : ''} ${!isFirst ? styles.msgGrouped : ''}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => { setShowActions(false); setShowEmojiPicker(false); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ transform: swipeX > 0 ? `translateX(${isMe ? -swipeX : swipeX}px)` : undefined, transition: swipeX === 0 ? 'transform 0.2s ease' : 'none' }}
    >
      {/* Swipe-to-reply hint arrow */}
      {swipeX > 10 && (
        <div className={styles.swipeArrow} style={{ opacity: Math.min(swipeX / 40, 1), [isMe ? 'right' : 'left']: `${swipeX + 4}px` }}>↩</div>
      )}

      {/* Avatar column — others only */}
      {!isMe && (
        isFirst
          ? <div className={styles.avatarWrap}>
              <AvatarPhoto url={avatarUrl} initials={msg.user_initials || nameInitials(senderName)} name={senderName ?? msg.user_name} size={32} />
              {isOnline && <span className={styles.onlineDot} />}
            </div>
          : <div className={styles.avatarSpacer} />
      )}

      <div className={styles.msgBubbleWrap}>
        {/* Sender name: shown in channels, first msg in group, not mine */}
        {isChannel && isFirst && !isMe && (
          <div className={styles.msgSenderName}>{senderName ?? msg.user_name}</div>
        )}

        {isEditing ? (
          <div className={styles.editWrap}>
            <input className={styles.editInput} value={editText}
              onChange={e => onEditChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onEditSave(); if (e.key === 'Escape') onEditCancel(); }}
              autoFocus />
            <div className={styles.editActions}>
              <button className={styles.editSaveBtn} onClick={onEditSave}>{uiLang === 'ja' ? '保存' : 'Save'}</button>
              <button className={styles.editCancelBtn} onClick={onEditCancel}>{uiLang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
            </div>
          </div>
        ) : (
          <div className={`${styles.bubble}
            ${isMe ? styles.bubbleMe : styles.bubbleThem}
            ${isFirst ? (isMe ? styles.bubbleTailMe : styles.bubbleTail) : ''}`}>

            {/* Reply quote */}
            {replyMsg && !isDeleted && (
              <div className={styles.replyQuote}>
                <span className={styles.replyQuoteName}>{replyMsg.user_name}</span>
                <span className={styles.replyQuoteText}>{replyMsg.content || '📷'}</span>
              </div>
            )}

            {isDeleted ? (
              <span className={styles.deletedMsg}>{uiLang === 'ja' ? '🗑 このメッセージは削除されました' : '🗑 This message was deleted'}</span>
            ) : (
              <>
                {msg.image_url && (
                  <img src={msg.image_url} alt="shared" className={styles.msgImage}
                    onClick={() => window.open(msg.image_url, '_blank')} />
                )}
                {msg.content && <span className={styles.bubbleText}>{renderContent(msg.content)}</span>}
              </>
            )}

            {/* Time + delivery receipt inside bubble */}
            {!isDeleted && (
              <span className={styles.timeInBubble}>
                {msg.edited_at && <span className={styles.editedTag}>{uiLang === 'ja' ? '編集済 ' : 'edited '}</span>}
                {time}
                {isMe && receiptStatus === 'sending'   && <span className={styles.tick}>⌛</span>}
                {isMe && receiptStatus === 'sent'      && <span className={styles.tick}>✓</span>}
                {isMe && receiptStatus === 'delivered' && <span className={styles.tick}>✓✓</span>}
                {isMe && receiptStatus === 'read'      && <span className={`${styles.tick} ${styles.tickRead}`}>✓✓</span>}
              </span>
            )}
          </div>
        )}

        {/* Reactions */}
        {Object.keys(rxnGroups).length > 0 && (
          <div className={styles.reactionsBar}>
            {Object.entries(rxnGroups).map(([emoji, { count, byMe }]) => (
              <button key={emoji} className={`${styles.reactionBtn} ${byMe ? styles.reactionBtnMe : ''}`}
                onClick={() => onReact(msg.id, emoji)}>
                {emoji} {count}
              </button>
            ))}
          </div>
        )}

        {/* Translate */}
        {!isDeleted && msg.content && (
          <>
            <button className={styles.translateBtn} onClick={() => setShowTranslations(v => !v)}>
              {showTranslations ? (uiLang === 'ja' ? '翻訳を隠す' : 'Hide') : (uiLang === 'ja' ? '翻訳' : 'Translate')}
            </button>
            {showTranslations && (
              <div className={styles.translations}>
                {enText && enText !== msg.content && <div className={styles.translation}><span className={styles.translationLabel}>EN:</span>{enText}</div>}
                {jaText && jaText !== msg.content && <div className={styles.translation}><span className={styles.translationLabel}>日本語:</span>{jaText}</div>}
              </div>
            )}
          </>
        )}
      </div>

      {/* Hover action buttons */}
      {showActions && !isDeleted && !isEditing && (
        <div className={`${styles.msgActions} ${isMe ? styles.msgActionsMe : ''}`}>
          <div className={styles.emojiPickerWrap}>
            <button className={styles.msgActionBtn} title="React" onClick={() => setShowEmojiPicker(v => !v)}>😊</button>
            {showEmojiPicker && (
              <div className={styles.emojiQuickPicker}>
                {QUICK_EMOJIS.map(e => (
                  <button key={e} className={styles.quickEmoji}
                    onClick={() => { onReact(msg.id, e); setShowEmojiPicker(false); }}>{e}</button>
                ))}
              </div>
            )}
          </div>
          <button className={styles.msgActionBtn} title={uiLang === 'ja' ? '返信' : 'Reply'} onClick={() => onReply(msg)}>↩</button>
          {canPin && !isChannel && <button className={styles.msgActionBtn} title={uiLang === 'ja' ? 'ピン留め' : 'Pin'} onClick={() => onPin(msg)}>📌</button>}
          {canPin && isChannel && <button className={styles.msgActionBtn} title={uiLang === 'ja' ? 'ピン留め' : 'Pin'} onClick={() => onPin(msg)}>📌</button>}
          {isMe && <button className={styles.msgActionBtn} title={uiLang === 'ja' ? '編集' : 'Edit'} onClick={() => onEdit(msg)}>✏️</button>}
          {isMe && <button className={styles.msgActionBtn} title={uiLang === 'ja' ? '削除' : 'Delete'} onClick={() => onDelete(msg.id)}>🗑️</button>}
        </div>
      )}
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
      supabase.from('profiles').select('id, display_name, email, role, avatar_url').order('display_name'),
    ]);
    setChannels(ch ?? []);
    setProfiles(pr ?? []);
  }

  async function loadMembers(channelId) {
    const { data } = await supabase
      .from('channel_members')
      .select('profile_id, profiles(id, display_name, email, avatar_url)')
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
      id, name: formName.trim(), description: formDesc.trim() || null,
      created_by: currentUserId, sort_order: maxOrder + 1,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setFormName(''); setFormDesc('');
    await loadAll();
    setView('list');
  }

  async function handleSaveDesc() {
    setError(''); setSaving(true);
    const { error: err } = await supabase.from('channels')
      .update({ description: formDesc.trim() || null }).eq('id', target.id);
    setSaving(false);
    if (err) { setError(err.message); return; }
    await loadAll(); setView('members');
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
    setAddProfileIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  async function handleMove(ch, dir) {
    const idx = channels.findIndex(c => c.id === ch.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= channels.length) return;
    const other = channels[swapIdx];
    await Promise.all([
      supabase.from('channels').update({ sort_order: other.sort_order }).eq('id', ch.id),
      supabase.from('channels').update({ sort_order: ch.sort_order }).eq('id', other.id),
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
                : view === 'edit' ? t('Edit Channel', 'チャンネルを編集')
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
                    onClick={() => handleDelete(ch)}>{t('Delete', '削除')}</button>
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
                {profiles.filter(p => !members.some(m => m.profile_id === p.id)).length > 0 && (
                  <div className={styles.addMemberMulti}>
                    <div className={styles.addMemberMultiList}>
                      {profiles.filter(p => !members.some(m => m.profile_id === p.id)).map(p => (
                        <label key={p.id} className={styles.memberCheckRow}>
                          <input type="checkbox" checked={addProfileIds.has(p.id)} onChange={() => toggleAddProfile(p.id)} />
                          <AvatarPhoto url={p.avatar_url ?? null} initials={profileInitials(p)} name={p.display_name || p.email} size={24} />
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
                        <AvatarPhoto url={p?.avatar_url ?? null} initials={p ? profileInitials(p) : '?'} name={p?.display_name || p?.email} size={28} />
                        <span className={styles.memberName}>{p?.display_name || p?.email}</span>
                        <button className={`${styles.rowBtn} ${styles.rowBtnDanger}`}
                          onClick={() => handleRemoveMember(m.profile_id)}>{t('Remove', '削除')}</button>
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
          <input className={styles.modalInput}
            placeholder={uiLang === 'ja' ? '名前で検索…' : 'Search by name…'}
            value={query} onChange={e => setQuery(e.target.value)} autoFocus />
          <div className={styles.dmUserList}>
            {filtered.map(p => (
              <button key={p.id} className={styles.dmUserItem} onClick={() => onSelect(p)}>
                <AvatarPhoto url={p.avatar_url ?? null} initials={profileInitials(p)} name={profileFullName(p)} size={36} />
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

// ── Sidebar / Chat List ───────────────────────────────────────────────────────

function Sidebar({ channels, dmConversations, activeChannel, onSelect, onNewDM, canManage, onManage, uiLang, unreadCounts, currentUserId, onlineUsers }) {
  return (
    <aside className={styles.sidebar}>
      {/* Mobile-only colored header (hidden on desktop via CSS) */}
      <div className={styles.mobileListHeader}>
        <span className={styles.mobileListTitle}>{uiLang === 'ja' ? 'チャット' : 'Chat'}</span>
        <div className={styles.mobileListActions}>
          {canManage && (
            <button className={styles.mobileListBtn} onClick={onManage} title="Manage channels">⚙️</button>
          )}
          <button className={styles.mobileListBtn} onClick={onNewDM} title="New DM">✏️</button>
        </div>
      </div>

      {/* Desktop channel header */}
      <div className={`${styles.sidebarHead} ${styles.desktopSidebarHead}`}>
        <span className={styles.sectionLabel}>{uiLang === 'ja' ? 'チャンネル' : 'Channels'}</span>
        {canManage && (
          <button className={styles.manageBtn} onClick={onManage} title={uiLang === 'ja' ? 'チャンネル管理' : 'Manage channels'}>⚙</button>
        )}
      </div>

      {/* Mobile section label */}
      <div className={styles.mobileSectionLabel}>{uiLang === 'ja' ? 'チャンネル' : 'CHANNELS'}</div>

      {channels.map(ch => {
        const unread = unreadCounts?.[ch.id] ?? 0;
        return (
          <button key={ch.id}
            className={`${styles.channelItem} ${activeChannel === ch.id ? styles.channelActive : ''}`}
            onClick={() => onSelect(ch.id)} title={ch.description ?? ''}>
            <span className={styles.hash}>#</span>
            <span className={styles.chanItemName}>{ch.name}</span>
            {unread > 0 && activeChannel !== ch.id && (
              <span className={styles.chanUnreadBadge}>{unread > 99 ? '99+' : unread}</span>
            )}
          </button>
        );
      })}

      <div className={styles.sidebarDivider} />

      {/* DM section header */}
      <div className={styles.sidebarHead}>
        <span className={styles.sectionLabel}>{uiLang === 'ja' ? 'ダイレクト' : 'Direct Messages'}</span>
        <button className={styles.manageBtn} onClick={onNewDM} title={uiLang === 'ja' ? '新規DM' : 'New DM'}>+</button>
      </div>

      {dmConversations.map(dm => {
        const unread = unreadCounts?.[dm.channelId] ?? 0;
        const lastTime = dm.lastMsg?.created_at
          ? new Date(dm.lastMsg.created_at).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
          : null;
        const lastContent = dm.lastMsg
          ? (dm.lastMsg.image_url && !dm.lastMsg.content ? '📷 Photo' : dm.lastMsg.content?.slice(0, 32) ?? '')
          : '';
        const isMyLast = dm.lastMsg?.sender_id === currentUserId;

        return (
          <button key={dm.channelId}
            className={`${styles.channelItem} ${styles.dmItem} ${activeChannel === dm.channelId ? styles.channelActive : ''}`}
            onClick={() => onSelect(dm.channelId)} title={dm.name}>
            <div className={styles.avatarWrap}>
              <AvatarPhoto url={dm.avatarUrl} initials={dm.initials ?? dm.name?.slice(0, 2)?.toUpperCase()} name={dm.name} size={40} />
              {onlineUsers?.has(dm.otherId) && <span className={styles.onlineDot} />}
            </div>
            <div className={styles.dmItemInfo}>
              <div className={styles.dmItemHeader}>
                <span className={styles.dmItemName}>{dm.name}</span>
                {lastTime && <span className={styles.dmItemTime}>{lastTime}</span>}
              </div>
              {lastContent && (
                <span className={styles.dmItemLastMsg}>
                  {isMyLast ? (uiLang === 'ja' ? 'あなた: ' : 'You: ') : ''}{lastContent}
                </span>
              )}
            </div>
            {unread > 0 && activeChannel !== dm.channelId && (
              <span className={styles.dmUnreadBadge}>{unread > 99 ? '99+' : unread}</span>
            )}
          </button>
        );
      })}
      {dmConversations.length === 0 && (
        <p className={styles.dmEmpty}>{uiLang === 'ja' ? 'まだDMなし' : 'No DMs yet'}</p>
      )}
    </aside>
  );
}

const ALL_ENTRY = { id: '__all__', display_name: 'all', _isAll: true };

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
  const [mobileShowList,    setMobileShowList]    = useState(true);

  const [profiles,      setProfiles]      = useState([]);
  const [mentionQuery,  setMentionQuery]  = useState(null);
  const [mentionIdx,    setMentionIdx]    = useState(0);
  const [myReadAt,      setMyReadAt]      = useState({});
  const [partnerReadAt, setPartnerReadAt] = useState(null);
  const [unreadCounts,  setUnreadCounts]  = useState({});
  const [replyTo,       setReplyTo]       = useState(null);
  const [reactions,     setReactions]     = useState({});
  const [typingUsers,   setTypingUsers]   = useState([]);
  const [editingId,     setEditingId]     = useState(null);
  const [editText,      setEditText]      = useState('');
  const [onlineUsers,   setOnlineUsers]   = useState(new Set());
  const [pinnedMsg,     setPinnedMsg]     = useState(null); // { id, content, user_name }

  const fileInputRef     = useRef(null);
  const endRef           = useRef(null);
  const subscriptionRef  = useRef(null);
  const readSubRef       = useRef(null);
  const inputRef         = useRef(null);
  const typingStopRef    = useRef(null);
  const isTouchRef       = useRef(false);

  // Detect touch device once on mount
  useEffect(() => {
    isTouchRef.current = window.matchMedia('(hover: none)').matches;
  }, []);

  // Online presence — track who's active right now
  useEffect(() => {
    if (!currentUser?.id) return;
    const ch = supabase.channel('tb-presence', {
      config: { presence: { key: currentUser.id } },
    })
      .on('presence', { event: 'sync' }, () => {
        setOnlineUsers(new Set(Object.keys(ch.presenceState())));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({ user_id: currentUser.id });
        }
      });
    return () => { ch.unsubscribe(); };
  }, [currentUser?.id]);

  // Load pinned message for active channel
  useEffect(() => {
    if (!activeChannel) { setPinnedMsg(null); return; }
    supabase.from('pinned_messages')
      .select('id, content, user_name, message_id')
      .eq('channel_id', activeChannel)
      .order('pinned_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setPinnedMsg(data?.[0] ?? null));
  }, [activeChannel]);

  const canManage = profile?.role && profile.role !== 'Player';
  const messages  = messagesByChannel[activeChannel] ?? [];

  useEffect(() => {
    if (currentUser?.id) {
      localStorage.setItem(`chat_last_visited_${currentUser.id}`, new Date().toISOString());
    }
  }, [currentUser?.id]);

  // Load channels on mount
  useEffect(() => {
    async function loadChannels() {
      const { data } = await supabase
        .from('channels').select('id, name, description').order('sort_order').order('created_at');
      const list = data ?? [];
      setChannels(list);
      if (list.length > 0 && !activeChannel) setActiveChannel(list[0].id);
    }
    loadChannels();
  }, []);

  // Load profiles for @-mentions and DM picker
  useEffect(() => {
    supabase.from('profiles').select('id, display_name, first_name, last_name, email, role, position, avatar_url').order('display_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  // Load existing DM conversations — from localStorage first, then sync from DB
  useEffect(() => {
    if (!currentUser?.id) return;
    const myId = currentUser.id;
    const storageKey = `dm_convs_${myId}`;

    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      if (stored.length > 0) setDmConversations(stored);
    } catch {}

    async function loadDMs() {
      const { data } = await supabase
        .from('messages')
        .select('channel, created_at, content, user_name, sender_id, image_url')
        .like('channel', 'dm:%')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!data) return;
      const seen = new Map();
      for (const row of data) {
        if (!seen.has(row.channel)) seen.set(row.channel, row);
      }
      const convs = [];
      for (const [ch, row] of seen) {
        const inner = ch.slice(3);
        const sep = inner.indexOf('_');
        if (sep === -1) continue;
        const a = inner.slice(0, sep);
        const b = inner.slice(sep + 1);
        const otherId = a === myId ? b : b === myId ? a : null;
        if (!otherId) continue;
        convs.push({ channelId: ch, otherId, latestAt: row.created_at, lastMsg: row });
      }
      convs.sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
      if (convs.length > 0) {
        setDmConversations(convs);
        localStorage.setItem(storageKey, JSON.stringify(convs));
      }
    }
    loadDMs();
  }, [currentUser?.id]);

  // ── Read receipts ─────────────────────────────────────────────

  const markAsRead = useCallback(async (channelId) => {
    if (!currentUser?.id || !channelId) return;
    const now = new Date().toISOString();
    await supabase.from('channel_reads').upsert(
      { user_id: currentUser.id, channel_id: channelId, last_read_at: now },
      { onConflict: 'user_id,channel_id' }
    );
    setMyReadAt(prev => ({ ...prev, [channelId]: now }));
    setUnreadCounts(prev => ({ ...prev, [channelId]: 0 }));
  }, [currentUser?.id]);

  // Load my read timestamps + unread counts for all known DM channels
  useEffect(() => {
    if (!currentUser?.id || dmConversations.length === 0) return;
    const myId = currentUser.id;
    const channelIds = dmConversations.map(d => d.channelId);

    supabase.from('channel_reads').select('channel_id, last_read_at')
      .eq('user_id', myId).in('channel_id', channelIds)
      .then(({ data }) => {
        const reads = {};
        for (const r of (data ?? [])) reads[r.channel_id] = r.last_read_at;
        setMyReadAt(reads);

        Promise.all(channelIds.map(async chId => {
          const since = reads[chId] ?? '1970-01-01T00:00:00Z';
          const { count } = await supabase.from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel', chId).neq('sender_id', myId).gt('created_at', since);
          return [chId, count ?? 0];
        })).then(pairs => {
          setUnreadCounts(Object.fromEntries(pairs));
        });
      });
  }, [currentUser?.id, dmConversations.length]);

  // Load unread counts for regular channels
  useEffect(() => {
    if (!currentUser?.id || channels.length === 0) return;
    const myId = currentUser.id;
    const chIds = channels.map(c => c.id);

    supabase.from('channel_reads').select('channel_id, last_read_at')
      .eq('user_id', myId).in('channel_id', chIds)
      .then(({ data }) => {
        const reads = {};
        for (const r of (data ?? [])) reads[r.channel_id] = r.last_read_at;

        Promise.all(chIds.map(async chId => {
          const since = reads[chId] ?? '1970-01-01T00:00:00Z';
          const { count } = await supabase.from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('channel', chId).neq('sender_id', myId).gt('created_at', since);
          return [chId, count ?? 0];
        })).then(pairs => {
          setUnreadCounts(prev => ({ ...prev, ...Object.fromEntries(pairs) }));
        });
      });
  }, [currentUser?.id, channels.length]);

  // Mark channel as read when switching to it
  useEffect(() => {
    if (!activeChannel || isDM(activeChannel) || !currentUser?.id) return;
    markAsRead(activeChannel);
  }, [activeChannel, currentUser?.id]);

  // When active DM channel changes: mark as read, load partner read time, subscribe
  useEffect(() => {
    if (!activeChannel || !isDM(activeChannel) || !currentUser?.id) return;
    markAsRead(activeChannel);

    supabase.from('channel_reads').select('user_id, last_read_at').eq('channel_id', activeChannel)
      .then(({ data }) => {
        const inner   = activeChannel.slice(3);
        const sep     = inner.indexOf('_');
        const a       = inner.slice(0, sep);
        const b       = inner.slice(sep + 1);
        const otherId = a === currentUser.id ? b : a;
        const row     = (data ?? []).find(r => r.user_id === otherId);
        setPartnerReadAt(row?.last_read_at ?? null);
      });

    readSubRef.current?.unsubscribe();
    const rs = supabase.channel(`reads-${activeChannel}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'channel_reads',
        filter: `channel_id=eq.${activeChannel}`,
      }, payload => {
        if (payload.new?.user_id !== currentUser.id) {
          setPartnerReadAt(payload.new.last_read_at);
        }
      })
      .subscribe();
    readSubRef.current = rs;
    return () => { rs.unsubscribe(); readSubRef.current = null; };
  }, [activeChannel, currentUser?.id]);

  // Profile lookup by ID
  const profilesById = useMemo(() => {
    const m = {};
    for (const p of profiles) m[p.id] = p;
    return m;
  }, [profiles]);

  // Resolve DM conversation names from profiles
  const dmConversationsWithNames = dmConversations.map(dm => {
    const other    = profiles.find(p => p.id === dm.otherId);
    const name     = other ? profileFullName(other) : dm.otherId.slice(0, 8);
    const subtitle = other ? (other.position || other.role || '') : '';
    const initials = other ? profileInitials(other) : '?';
    const avatarUrl = other?.avatar_url ?? null;
    return { ...dm, name, subtitle, initials, avatarUrl };
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Auto-resize textarea as content grows/shrinks
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }, [inputValue]);

  // Load history when active channel changes
  useEffect(() => {
    if (!activeChannel) return;
    let cancelled = false;
    async function loadHistory() {
      setLoading(true);
      setError(null);
      const { data, error: dbError } = await supabase
        .from('messages').select('*').eq('channel', activeChannel)
        .order('created_at', { ascending: true }).limit(MAX_HISTORY);
      if (cancelled) return;
      if (dbError) {
        setError((uiLang === 'ja' ? 'メッセージを読み込めませんでした：' : 'Could not load messages: ') + dbError.message);
      } else {
        setMessagesByChannel(prev => ({ ...prev, [activeChannel]: data ?? [] }));
        if (data?.length) {
          const ids = data.map(m => m.id);
          supabase.from('message_reactions').select('*').in('message_id', ids)
            .then(({ data: rxns }) => {
              if (!rxns || cancelled) return;
              const map = {};
              for (const r of rxns) { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); }
              if (!cancelled) setReactions(map);
            });
        }
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
    const channel = supabase.channel(`chat:${activeChannel}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages',
        filter: `channel=eq.${activeChannel}` }, payload => {
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
            const updated = prev.map(d => d.channelId === activeChannel
              ? { ...d, latestAt: newMsg.created_at, lastMsg: newMsg } : d);
            return [...updated].sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
          });
          if (newMsg.sender_id && newMsg.sender_id !== currentUser?.id) {
            markAsRead(activeChannel);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions',
        filter: `message_id=in.(${[].join(',')})` }, () => {
        supabase.from('message_reactions').select('*')
          .in('message_id', (messagesByChannel[activeChannel] ?? []).map(m => m.id))
          .then(({ data: rxns }) => {
            if (!rxns) return;
            const map = {};
            for (const r of rxns) { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); }
            setReactions(map);
          });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages',
        filter: `channel=eq.${activeChannel}` }, payload => {
        setMessagesByChannel(prev => {
          const existing = prev[activeChannel] ?? [];
          const updated  = existing.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m);
          return { ...prev, [activeChannel]: updated };
        });
      })
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId === currentUser?.id) return;
        setTypingUsers(prev => {
          const filtered = prev.filter(u => u.id !== payload.userId);
          if (!payload.typing) return filtered;
          return [...filtered, { id: payload.userId, name: payload.name }];
        });
        setTimeout(() => {
          setTypingUsers(prev => prev.filter(u => u.id !== payload.userId));
        }, 3000);
      })
      .subscribe();
    subscriptionRef.current = channel;
    return () => { channel.unsubscribe(); setTypingUsers([]); };
  }, [activeChannel]);

  // ── Feature handlers ──────────────────────────────────────────

  const broadcastTyping = useCallback(() => {
    if (!activeChannel || !subscriptionRef.current) return;
    subscriptionRef.current.send({
      type: 'broadcast', event: 'typing',
      payload: { userId: currentUser?.id, name: currentUser?.name, typing: true },
    });
  }, [activeChannel, currentUser]);

  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!currentUser?.id) return;
    const existing = (reactions[messageId] ?? []).find(r => r.user_id === currentUser.id && r.emoji === emoji);
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id);
    } else {
      await supabase.from('message_reactions').insert({
        message_id: messageId, user_id: currentUser.id, user_name: currentUser.name, emoji,
      });
    }
    const allIds = (messagesByChannel[activeChannel] ?? []).map(m => m.id);
    const { data: rxns } = await supabase.from('message_reactions').select('*').in('message_id', allIds);
    if (rxns) {
      const map = {};
      for (const r of rxns) { if (!map[r.message_id]) map[r.message_id] = []; map[r.message_id].push(r); }
      setReactions(map);
    }
  }, [reactions, activeChannel, messagesByChannel, currentUser]);

  const deleteMessage = useCallback(async (msgId) => {
    await supabase.from('messages').update({ is_deleted: true, content: '' }).eq('id', msgId);
  }, []);

  const togglePin = useCallback(async (msg) => {
    if (!activeChannel) return;
    if (pinnedMsg?.message_id === msg.id) {
      // Unpin
      await supabase.from('pinned_messages').delete().eq('id', pinnedMsg.id);
      setPinnedMsg(null);
    } else {
      // Replace any existing pin for this channel
      await supabase.from('pinned_messages').delete().eq('channel_id', activeChannel);
      const { data } = await supabase.from('pinned_messages').insert({
        channel_id: activeChannel,
        message_id: msg.id,
        content:    msg.content?.slice(0, 100) ?? (msg.image_url ? '📷 Photo' : ''),
        user_name:  msg.user_name,
        pinned_by:  currentUser?.id,
      }).select().single();
      setPinnedMsg(data ?? null);
    }
  }, [activeChannel, pinnedMsg, currentUser]);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editText.trim()) return;
    await supabase.from('messages').update({ content: editText.trim(), edited_at: new Date().toISOString() }).eq('id', editingId);
    setEditingId(null); setEditText('');
  }, [editingId, editText]);

  const uploadImage = useCallback(async (file) => {
    if (!file || !activeChannel) return;
    const ext  = file.name.split('.').pop();
    const path = `${activeChannel}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('chat-images').upload(path, file);
    if (upErr) return;
    const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
    return publicUrl;
  }, [activeChannel]);

  const mentionMatches = mentionQuery && !isActiveDM
    ? [
        // @all always at top when query matches "all" (or is blank/partial)
        ...('all'.startsWith(mentionQuery.query.toLowerCase()) ? [ALL_ENTRY] : []),
        ...profiles
          .filter(p => (p.display_name || p.email || '').toLowerCase().includes(mentionQuery.query.toLowerCase()))
          .slice(0, 6),
      ]
    : mentionQuery
      ? profiles.filter(p => (p.display_name || p.email || '').toLowerCase().includes(mentionQuery.query.toLowerCase())).slice(0, 6)
      : [];

  const insertMention = useCallback((p) => {
    const name = p._isAll ? 'all' : (p.display_name || p.email);
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

  const sendMessage = useCallback(async (imageUrl = null) => {
    const text = inputValue.trim();
    if ((!text && !imageUrl) || sending || !activeChannel) return;
    setSending(true);
    setInputValue('');
    const replyId = replyTo?.id ?? null;
    setReplyTo(null);

    const optimisticMsg = {
      id:            crypto.randomUUID(),
      channel:       activeChannel,
      user_name:     currentUser.name,
      user_initials: currentUser.initials,
      sender_id:     currentUser.id,
      content:       text,
      image_url:     imageUrl,
      reply_to_id:   replyId,
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
      image_url:     imageUrl ?? null,
      reply_to_id:   replyId,
    });

    if (isDM(activeChannel)) {
      const now = new Date().toISOString();
      setDmConversations(prev => {
        const updated = prev.map(d => d.channelId === activeChannel
          ? { ...d, latestAt: now, lastMsg: { content: text, sender_id: currentUser.id, image_url: imageUrl, created_at: now } } : d);
        return [...updated].sort((a, b) => (b.latestAt ?? '').localeCompare(a.latestAt ?? ''));
      });
    }

    if (!insertError && isDM(activeChannel)) {
      const inner = activeChannel.slice(3);
      const sep = inner.indexOf('_');
      const a = inner.slice(0, sep);
      const b = inner.slice(sep + 1);
      const recipientId = a === currentUser.id ? b : a;
      supabase.from('notifications').insert({
        user_id: recipientId, type: 'dm', title: currentUser.name,
        body: text, nav_target: 'chat',
      }).then();
      sendPush([recipientId], {
        title:   currentUser.name,
        body:    text.length > 80 ? text.slice(0, 80) + '…' : text,
        url:     '/?nav=chat',
        tag:     `dm-${activeChannel}`,
        prefKey: 'chat_dm',
      });
    }

    // Channel @mention notifications
    if (!insertError && !isDM(activeChannel) && text.includes('@')) {
      const mentionTokens = (text.match(/@(\S+)/g) ?? []).map(m => m.slice(1).toLowerCase());

      if (mentionTokens.includes('all')) {
        // @all — notify every channel member (or all profiles for open channels)
        const { data: members } = await supabase.from('channel_members')
          .select('profile_id').eq('channel_id', activeChannel);
        const recipientIds = (members?.length > 0
          ? members.map(m => m.profile_id)
          : profiles.map(p => p.id)
        ).filter(id => id !== currentUser.id);

        if (recipientIds.length > 0) {
          recipientIds.forEach(uid => {
            supabase.from('notifications').insert({
              user_id: uid, type: 'mention', title: currentUser.name,
              body: `@all in #${activeChannel}: ${text.slice(0, 80)}`,
              nav_target: 'chat',
            }).then();
          });
          sendPush(recipientIds, {
            title:   `${currentUser.name} in #${activeChannel}`,
            body:    text.length > 80 ? text.slice(0, 80) + '…' : text,
            url:     '/?nav=chat',
            tag:     `all-${activeChannel}`,
            prefKey: 'chat_mention',
          });
        }
      } else if (mentionTokens.length > 0) {
        // Individual @mentions
        const mentionedProfiles = profiles.filter(p => {
          const name = (profileFullName(p) || p.display_name || '').toLowerCase();
          return mentionTokens.some(tok => name.includes(tok));
        }).filter(p => p.id !== currentUser.id);

        if (mentionedProfiles.length > 0) {
          const recipientIds = mentionedProfiles.map(p => p.id);
          recipientIds.forEach(uid => {
            supabase.from('notifications').insert({
              user_id: uid, type: 'mention', title: currentUser.name,
              body: `mentioned you in #${activeChannel}: ${text.slice(0, 80)}`,
              nav_target: 'chat',
            }).then();
          });
          sendPush(recipientIds, {
            title:   `${currentUser.name} in #${activeChannel}`,
            body:    text.length > 80 ? text.slice(0, 80) + '…' : text,
            url:     '/?nav=chat',
            tag:     `mention-${activeChannel}`,
            prefKey: 'chat_mention',
          });
        }
      }
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
  }, [inputValue, sending, activeChannel, currentUser, replyTo, profiles]);

  const handleKeyDown = useCallback(e => {
    if (mentionQuery && mentionMatches.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, mentionMatches.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Escape')    { setMentionQuery(null); return; }
      if (e.key === 'Enter')     { e.preventDefault(); insertMention(mentionMatches[mentionIdx]); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // Mobile / touch: Return key inserts a line break (send via button)
      // Desktop: Enter sends, Shift+Enter inserts a line break
      if (isTouchRef.current) return;
      e.preventDefault();
      sendMessage();
    }
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
    setMobileShowList(false);
  };

  const activeChannelObj = channels.find(c => c.id === activeChannel);
  const activeDM         = dmConversationsWithNames.find(d => d.channelId === activeChannel);
  const isActiveDM       = isDM(activeChannel);

  const headerTitle = isActiveDM
    ? activeDM?.name ?? activeChannel
    : activeChannelObj ? `# ${activeChannelObj.name}` : `# ${activeChannel}`;

  const inputPlaceholder = isActiveDM
    ? (uiLang === 'ja' ? `${activeDM?.name ?? ''} にメッセージを送信...` : `Message ${activeDM?.name ?? ''}…`)
    : (uiLang === 'ja' ? `#${activeChannel ?? ''} にメッセージを送信...` : `Message #${activeChannel ?? ''}… (@ to mention)`);

  return (
    <div className={`${styles.wrapper} ${mobileShowList ? styles.mobilePanelList : styles.mobilePanelChat}`}>
      <Sidebar
        channels={channels}
        dmConversations={dmConversationsWithNames}
        activeChannel={activeChannel}
        onSelect={ch => { setActiveChannel(ch); setError(null); setMobileShowList(false); }}
        onNewDM={() => setShowNewDM(true)}
        canManage={canManage}
        onManage={() => setShowManage(true)}
        uiLang={uiLang}
        unreadCounts={unreadCounts}
        currentUserId={currentUser?.id}
        onlineUsers={onlineUsers}
      />

      <div className={styles.chatArea}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            {/* Mobile back button — returns to chat list */}
            <button className={styles.mobileBackBtn} onClick={() => setMobileShowList(true)}>‹</button>
            {isActiveDM
              ? <AvatarPhoto url={activeDM?.avatarUrl ?? null} initials={activeDM?.initials ?? '?'} name={activeDM?.name} size={32} />
              : <span className={styles.headerHashIcon}>#</span>
            }
            <div className={styles.headerTitleWrap}>
              <span className={styles.headerChannel}>{isActiveDM ? activeDM?.name : activeChannelObj?.name ?? activeChannel}</span>
              {!isActiveDM && activeChannelObj?.description && (
                <span className={styles.headerDesc}>{activeChannelObj.description}</span>
              )}
            </div>
          </div>
          <span className={styles.headerCount}>
            {loading ? '…' : `${messages.length} ${uiLang === 'ja' ? 'msg' : 'msg'}`}
          </span>
        </div>

        {error && (
          <div className={styles.errorBanner}>
            {error}
            <button onClick={() => setError(null)} className={styles.errorDismiss}>✕</button>
          </div>
        )}

        {/* Pinned message banner */}
        {pinnedMsg && (
          <div className={styles.pinnedBanner}>
            <span className={styles.pinnedIcon}>📌</span>
            <div className={styles.pinnedContent}>
              <span className={styles.pinnedName}>{pinnedMsg.user_name}</span>
              <span className={styles.pinnedText}>{pinnedMsg.content || '📷'}</span>
            </div>
            {canManage && (
              <button className={styles.pinnedUnpin} onClick={() => togglePin({ id: pinnedMsg.message_id })} title="Unpin">✕</button>
            )}
          </div>
        )}

        <div className={styles.messageList}>
          {loading && <div style={{ padding: '16px 8px' }}><SkeletonList rows={5} /></div>}
          {!loading && messages.length === 0 && (
            <p className={styles.emptyText}>
              {isActiveDM
                ? (uiLang === 'ja' ? `${activeDM?.name ?? ''} にメッセージを送りましょう！` : `Start a conversation with ${activeDM?.name ?? ''}`)
                : (uiLang === 'ja' ? 'まだメッセージがありません。最初に送信しましょう！' : 'No messages yet. Be the first to say something!')}
            </p>
          )}
          {(() => {
            const items = [];
            for (let i = 0; i < messages.length; i++) {
              const msg  = messages[i];
              const prev = messages[i - 1];

              const msgDay  = new Date(msg.created_at).toDateString();
              const prevDay = prev ? new Date(prev.created_at).toDateString() : null;

              if (!prev || msgDay !== prevDay) {
                items.push(<DateSeparator key={`date-${i}-${msg.id}`} dateStr={msg.created_at} uiLang={uiLang} />);
              }

              const msgSenderId  = msg.sender_id || msg.user_name;
              const prevSenderId = prev ? (prev.sender_id || prev.user_name) : null;
              const isFirst = !prev || prevSenderId !== msgSenderId || msgDay !== prevDay;

              const isMe   = msg.sender_id ? msg.sender_id === currentUser.id : msg.user_name === currentUser.name;
              const sender = msg.sender_id ? profilesById[msg.sender_id] : null;
              const url    = isMe ? currentUser.avatarUrl : (sender?.avatar_url ?? null);
              const name   = isMe ? currentUser.name : (sender ? profileFullName(sender) : msg.user_name);

              // Delivery receipt status (shown inside bubble for my messages)
              let receiptStatus = null;
              if (isMe) {
                if (msg._optimistic) receiptStatus = 'sending';
                else if (isActiveDM) {
                  receiptStatus = (partnerReadAt && msg.created_at <= partnerReadAt) ? 'read' : 'delivered';
                } else {
                  receiptStatus = 'sent';
                }
              }

              items.push(
                <Message
                  key={msg.id}
                  msg={msg}
                  isMe={isMe}
                  uiLang={uiLang}
                  avatarUrl={url}
                  senderName={name}
                  currentUserId={currentUser.id}
                  msgReactions={reactions[msg.id] ?? []}
                  onReact={toggleReaction}
                  onReply={setReplyTo}
                  onEdit={(m) => { setEditingId(m.id); setEditText(m.content); }}
                  onDelete={deleteMessage}
                  onPin={togglePin}
                  editingId={editingId}
                  editText={editText}
                  onEditChange={setEditText}
                  onEditSave={saveEdit}
                  onEditCancel={() => { setEditingId(null); setEditText(''); }}
                  replyMsg={msg.reply_to_id ? (messagesByChannel[activeChannel] ?? []).find(m => m.id === msg.reply_to_id) : null}
                  isFirst={isFirst}
                  isChannel={!isActiveDM}
                  receiptStatus={receiptStatus}
                  isOnline={!isMe && msg.sender_id ? onlineUsers.has(msg.sender_id) : false}
                  canPin={canManage}
                />
              );
            }
            return items;
          })()}

          {/* Typing indicator */}
          {typingUsers.length > 0 && (
            <div className={styles.typingIndicator}>
              <span className={styles.typingDots}>
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
                <span className={styles.typingDot} />
              </span>
              <span className={styles.typingText}>
                {typingUsers.map(u => u.name).join(', ')}{' '}
                {typingUsers.length === 1
                  ? (uiLang === 'ja' ? 'が入力中…' : 'is typing…')
                  : (uiLang === 'ja' ? 'が入力中…' : 'are typing…')}
              </span>
            </div>
          )}

          <div ref={endRef} />
        </div>

        <div className={styles.inputWrap}>
          {replyTo && (
            <div className={styles.replyBar}>
              <span className={styles.replyBarText}>
                ↩ {uiLang === 'ja' ? `${replyTo.user_name} に返信` : `Replying to ${replyTo.user_name}`}: {replyTo.content?.slice(0, 60)}{replyTo.content?.length > 60 ? '…' : ''}
              </span>
              <button className={styles.replyBarClose} onClick={() => setReplyTo(null)}>✕</button>
            </div>
          )}
          {mentionQuery && mentionMatches.length > 0 && (
            <div className={styles.mentionDropdown}>
              {mentionMatches.map((p, i) => (
                <button key={p.id}
                  className={`${styles.mentionItem} ${i === mentionIdx ? styles.mentionItemActive : ''} ${p._isAll ? styles.mentionItemAll : ''}`}
                  onMouseDown={e => { e.preventDefault(); insertMention(p); }}>
                  {p._isAll ? (
                    <>
                      <span className={styles.mentionAllIcon}>@all</span>
                      <span className={styles.mentionEmail}>{uiLang === 'ja' ? '全員に通知' : 'Notify everyone'}</span>
                    </>
                  ) : (
                    <>
                      <span className={styles.mentionName}>{p.display_name || p.email}</span>
                      {p.display_name && <span className={styles.mentionEmail}>{p.email}</span>}
                    </>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className={styles.inputBar}>
            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              style={{ display: 'none' }}
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                setSending(true);
                const url = await uploadImage(file);
                if (url) await sendMessage(url);
                setSending(false);
                e.target.value = '';
              }}
            />
            <button
              className={styles.attachBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || !activeChannel}
              title={uiLang === 'ja' ? '画像を送信' : 'Send image'}>
              📎
            </button>
            <textarea
              ref={inputRef}
              rows={1}
              className={styles.input}
              value={inputValue}
              onChange={e => {
                const val = e.target.value;
                setInputValue(val);
                // Typing indicator
                broadcastTyping();
                clearTimeout(typingStopRef.current);
                typingStopRef.current = setTimeout(() => {
                  subscriptionRef.current?.send({
                    type: 'broadcast', event: 'typing',
                    payload: { userId: currentUser?.id, name: currentUser?.name, typing: false },
                  });
                }, 3000);
                // @mention detection
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
              onClick={() => sendMessage()}
              disabled={sending || !inputValue.trim() || !activeChannel}>
              {sending ? '…' : (uiLang === 'ja' ? '送信' : 'Send')}
            </button>
          </div>
        </div>
      </div>

      {showManage && (
        <ChannelManageModal
          onClose={() => {
            setShowManage(false);
            supabase.from('channels').select('id, name, description').order('sort_order').order('created_at')
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
