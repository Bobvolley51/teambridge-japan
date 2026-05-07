'use client';

// components/RoleManager.jsx — User management with edit + delete

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './RoleManager.module.css';

const ROLES = ['GM', 'Headcoach', 'Athletic', 'Therapist', 'Staff/Orga', 'Player'];
const POSITIONS = ['Setter', 'Middle', 'Outside', 'Opposite', 'Libero'];

const ROLE_COLORS = {
  GM:           styles.roleGM,
  Headcoach:    styles.roleHeadcoach,
  Athletic:     styles.roleAthletic,
  Therapist:    styles.roleTherapist,
  'Staff/Orga': styles.roleStaffOrga,
  Player:       styles.rolePlayer,
};

const ROLE_DOT_COLORS = {
  GM:           styles.dotGM,
  Headcoach:    styles.dotHeadcoach,
  Athletic:     styles.dotAthletic,
  Therapist:    styles.dotTherapist,
  'Staff/Orga': styles.dotStaffOrga,
  Player:       styles.dotPlayer,
};

function timeAgo(iso, lang) {
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (diff < 1)   return lang === 'ja' ? 'たった今' : 'just now';
  if (diff < 60)  return lang === 'ja' ? `${diff}分前` : `${diff}m ago`;
  const h = Math.floor(diff / 60);
  if (h < 24)    return lang === 'ja' ? `${h}時間前` : `${h}h ago`;
  return lang === 'ja' ? `${Math.floor(h/24)}日前` : `${Math.floor(h/24)}d ago`;
}

// ── App Usage Stats (Headcoach only) ────────────────────────

function lastSeenDot(lastSeen) {
  if (!lastSeen) return styles.dotGray;
  const h = (Date.now() - new Date(lastSeen)) / 3600000;
  if (h < 24)  return styles.dotGreen;
  if (h < 168) return styles.dotYellow;
  return styles.dotRed;
}

function AppStats({ profiles, lang }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceIso  = since.toISOString();
    const sinceDate = since.toISOString().slice(0, 10);

    Promise.all([
      supabase.from('messages').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso),
      supabase.from('wellness_responses').select('user_id').gte('response_date', sinceDate),
      supabase.from('session_rpe').select('user_id').gte('event_date', sinceDate),
      supabase.from('tasks').select('status'),
      supabase.from('messages').select('sender_id').gte('created_at', sinceIso),
    ]).then(([msgs, wellness, rpe, tasks, msgPerUser]) => {
      const wellnessList  = wellness.data  ?? [];
      const rpeList       = rpe.data       ?? [];
      const msgList       = msgPerUser.data ?? [];
      const taskList      = tasks.data     ?? [];

      const perUser = {};
      for (const r of wellnessList) {
        if (!perUser[r.user_id]) perUser[r.user_id] = { wellness: 0, rpe: 0, messages: 0 };
        perUser[r.user_id].wellness++;
      }
      for (const r of rpeList) {
        if (!perUser[r.user_id]) perUser[r.user_id] = { wellness: 0, rpe: 0, messages: 0 };
        perUser[r.user_id].rpe++;
      }
      for (const r of msgList) {
        if (!perUser[r.sender_id]) perUser[r.sender_id] = { wellness: 0, rpe: 0, messages: 0 };
        perUser[r.sender_id].messages++;
      }

      setStats({
        messages:      msgs.count ?? 0,
        wellnessUsers: new Set(wellnessList.map(r => r.user_id)).size,
        playerCount:   profiles.filter(p => p.role === 'Player').length,
        rpe:           rpeList.length,
        tasksDone:     taskList.filter(t => t.status === 'done').length,
        tasksTotal:    taskList.length,
        perUser,
      });
    });
  }, [profiles]);

  const since7 = new Date(Date.now() - 7 * 86400000).toISOString();
  const activeUsers = profiles.filter(p => p.last_seen_at && p.last_seen_at >= since7).length;

  const tiles = [
    {
      icon: '🟢',
      value: stats ? `${activeUsers}/${profiles.length}` : '…',
      label: lang === 'ja' ? 'アクティブ (7日)' : 'Active users (7d)',
      highlight: stats && profiles.length > 0 && activeUsers === profiles.length,
    },
    {
      icon: '💬',
      value: stats?.messages ?? '…',
      label: lang === 'ja' ? 'チャット (7日)' : 'Chat messages (7d)',
    },
    {
      icon: '💪',
      value: stats ? `${stats.wellnessUsers}/${stats.playerCount}` : '…',
      label: lang === 'ja' ? 'ウェルネス提出 (7日)' : 'Wellness (7d)',
      highlight: stats && stats.playerCount > 0 && stats.wellnessUsers === stats.playerCount,
    },
    {
      icon: '📊',
      value: stats?.rpe ?? '…',
      label: lang === 'ja' ? 'RPE記録 (7日)' : 'RPE entries (7d)',
    },
    {
      icon: '✅',
      value: stats ? `${stats.tasksDone}/${stats.tasksTotal}` : '…',
      label: lang === 'ja' ? 'タスク完了' : 'Tasks completed',
      highlight: stats && stats.tasksTotal > 0 && stats.tasksDone === stats.tasksTotal,
    },
  ];

  return (
    <div className={styles.statsSection}>
      <div className={styles.statsBlock}>
        <div className={styles.statsBlockTitle}>
          {lang === 'ja' ? '直近7日間の活動' : 'Activity — last 7 days'}
        </div>
        <div className={styles.statsTiles}>
          {tiles.map(tile => (
            <div key={tile.label} className={`${styles.statsTile} ${tile.highlight ? styles.statsTileGreen : ''}`}>
              <span className={styles.statsTileIcon}>{tile.icon}</span>
              <span className={styles.statsTileValue}>{tile.value}</span>
              <span className={styles.statsTileLabel}>{tile.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.statsBlock}>
        <div className={styles.statsBlockTitle}>
          {lang === 'ja' ? 'ユーザーごとの活動 (7日)' : 'Per-user activity — last 7 days'}
        </div>
        <div className={styles.userStatTable}>
          <div className={styles.userStatHead}>
            <span>{lang === 'ja' ? 'ユーザー' : 'User'}</span>
            <span>{lang === 'ja' ? '最終ログイン' : 'Last seen'}</span>
            <span title={lang === 'ja' ? 'ウェルネス' : 'Wellness'}>💪</span>
            <span title="RPE">📊</span>
            <span title={lang === 'ja' ? 'チャット' : 'Chat'}>💬</span>
          </div>
          {[...profiles].sort((a, b) => {
            const roleOrder = ROLES.indexOf(a.role) - ROLES.indexOf(b.role);
            if (roleOrder !== 0) return roleOrder;
            if (!a.last_seen_at && !b.last_seen_at) return 0;
            if (!a.last_seen_at) return 1;
            if (!b.last_seen_at) return -1;
            return new Date(b.last_seen_at) - new Date(a.last_seen_at);
          }).map(p => {
            const name     = p.display_name || p.email.split('@')[0];
            const u        = stats?.perUser?.[p.id] ?? { wellness: 0, rpe: 0, messages: 0 };
            const dot      = lastSeenDot(p.last_seen_at);
            const isPlayer = p.role === 'Player';
            const lastSeen = p.last_seen_at
              ? timeAgo(p.last_seen_at, lang)
              : (lang === 'ja' ? 'なし' : 'Never');
            return (
              <div key={p.id} className={styles.userStatRow}>
                <div className={styles.userStatName}>
                  <span className={`${styles.activityDot} ${dot}`} />
                  <span className={styles.userStatLabel}>{name}</span>
                  <span className={`${styles.roleBadge} ${ROLE_COLORS[p.role] ?? ''}`}>{p.role}</span>
                </div>
                <span className={styles.userStatLastSeen}>{lastSeen}</span>
                <span className={`${styles.userStatVal} ${isPlayer && u.wellness > 0 ? styles.userStatValGreen : styles.userStatValGray}`}>
                  {isPlayer ? (stats ? u.wellness : '…') : '—'}
                </span>
                <span className={`${styles.userStatVal} ${isPlayer && u.rpe > 0 ? styles.userStatValGreen : styles.userStatValGray}`}>
                  {isPlayer ? (stats ? u.rpe : '…') : '—'}
                </span>
                <span className={`${styles.userStatVal} ${u.messages > 0 ? styles.userStatValGreen : styles.userStatValGray}`}>
                  {stats ? u.messages : '…'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Edit User Modal ──────────────────────────────────────────

function EditModal({ profile, lang, onSave, onClose }) {
  const [name,    setName]    = useState(profile.display_name ?? '');
  const [role,    setRole]    = useState(profile.role ?? 'Player');
  const [pos,     setPos]     = useState(profile.position ?? '');
  const [jersey,  setJersey]  = useState(profile.jersey_number ?? '');
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const updates = {
      display_name:  name.trim() || null,
      role,
      position:      role === 'Player' ? (pos || null) : null,
      jersey_number: role === 'Player' && jersey !== '' ? Number(jersey) : null,
    };
    const { error: err } = await supabase.from('profiles').update(updates).eq('id', profile.id);
    if (err) { setError(err.message); setSaving(false); return; }
    onSave({ ...profile, ...updates });
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.editModal}>
        <div className={styles.modalHead}>
          <span>{lang === 'ja' ? 'ユーザーを編集' : 'Edit User'}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form className={styles.editForm} onSubmit={handleSave}>
          <div className={styles.editField}>
            <label className={styles.editLabel}>{lang === 'ja' ? '表示名' : 'Display Name'}</label>
            <input
              className={styles.editInput}
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder={profile.email}
              autoFocus
            />
          </div>
          <div className={styles.editField}>
            <label className={styles.editLabel}>{lang === 'ja' ? '役割' : 'Role'}</label>
            <select className={styles.editInput} value={role} onChange={e => setRole(e.target.value)}>
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {role === 'Player' && (
            <>
              <div className={styles.editField}>
                <label className={styles.editLabel}>{lang === 'ja' ? 'ポジション' : 'Position'}</label>
                <select className={styles.editInput} value={pos} onChange={e => setPos(e.target.value)}>
                  <option value="">{lang === 'ja' ? '未設定' : 'Unassigned'}</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className={styles.editField}>
                <label className={styles.editLabel}>{lang === 'ja' ? '背番号' : 'Jersey #'}</label>
                <input
                  className={styles.editInput}
                  type="number"
                  min="0"
                  max="99"
                  value={jersey}
                  onChange={e => setJersey(e.target.value)}
                  placeholder="—"
                />
              </div>
            </>
          )}
          <div className={styles.editFieldSub}>
            <span className={styles.editSub}>{profile.email}</span>
          </div>
          {error && <div className={styles.editError}>{error}</div>}
          <div className={styles.editActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              {lang === 'ja' ? 'キャンセル' : 'Cancel'}
            </button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm Modal ─────────────────────────────────────

function DeleteModal({ profile, lang, currentUserId, onDelete, onClose }) {
  const [deleting, setDeleting] = useState(false);
  const [error,    setError]    = useState(null);
  const isSelf = profile.id === currentUserId;

  const handleDelete = async () => {
    if (isSelf) return;
    setDeleting(true);
    setError(null);
    const res = await fetch('/api/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: profile.id }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? 'Delete failed.'); setDeleting(false); return; }
    onDelete(profile.id);
    onClose();
  };

  const name = profile.display_name || profile.email;

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.editModal}>
        <div className={styles.modalHead}>
          <span>{lang === 'ja' ? 'ユーザーを削除' : 'Delete User'}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.deleteBody}>
          <div className={styles.deleteIcon}>🗑️</div>
          <p className={styles.deleteMsg}>
            {lang === 'ja'
              ? `「${name}」を完全に削除しますか？この操作は元に戻せません。`
              : `Permanently delete "${name}"? This cannot be undone.`}
          </p>
          {isSelf && (
            <p className={styles.deleteWarn}>
              {lang === 'ja' ? '自分自身は削除できません。' : 'You cannot delete your own account.'}
            </p>
          )}
          {error && <div className={styles.editError}>{error}</div>}
        </div>
        <div className={styles.editActions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            {lang === 'ja' ? 'キャンセル' : 'Cancel'}
          </button>
          <button className={styles.deleteConfirmBtn} onClick={handleDelete} disabled={deleting || isSelf}>
            {deleting ? '…' : (lang === 'ja' ? '削除する' : 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────

export default function RoleManager({ lang = 'en', currentUserId, currentUserRole }) {
  const [profiles,    setProfiles]    = useState([]);
  const [requests,    setRequests]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(null);
  const [actioning,   setActioning]   = useState(null);
  const [error,       setError]       = useState(null);
  const [success,     setSuccess]     = useState(null);
  const [editProfile, setEditProfile] = useState(null);
  const [delProfile,  setDelProfile]  = useState(null);
  const [activeTab,   setActiveTab]   = useState('users');
  const isHeadcoach = currentUserRole === 'Headcoach';

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: profs }, { data: reqs }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: true }),
      supabase.from('account_requests').select('*').eq('status', 'pending').order('created_at', { ascending: true }),
    ]);
    setProfiles(profs ?? []);
    setRequests(reqs ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const flash = (msg, isError = false) => {
    if (isError) setError(msg);
    else { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); }
  };

  // Inline role change (quick select in row)
  const updateRole = async (profileId, newRole) => {
    setSaving(profileId);
    setError(null); setSuccess(null);
    const { error: err } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId);
    if (err) { flash(err.message, true); }
    else {
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p));
      flash(lang === 'ja' ? '役割を更新しました。' : 'Role updated.');
    }
    setSaving(null);
  };

  const approveRequest = async (req) => {
    setActioning(req.id);
    setError(null);
    const res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: req.id, userId: req.user_id }),
    });
    const json = await res.json();
    if (!res.ok) flash(json.error ?? 'Could not approve account.', true);
    else {
      setRequests(prev => prev.filter(r => r.id !== req.id));
      flash(lang === 'ja' ? `${req.display_name} のアカウントを承認しました。` : `${req.display_name}'s account is now active.`);
      load();
    }
    setActioning(null);
  };

  const rejectRequest = async (req) => {
    setActioning(req.id);
    await supabase.from('account_requests').update({ status: 'rejected' }).eq('id', req.id);
    setRequests(prev => prev.filter(r => r.id !== req.id));
    setActioning(null);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerTitle}>{lang === 'ja' ? 'ユーザー管理' : 'User Management'}</span>
        <div className={styles.headerRight}>
          {isHeadcoach && (
            <div className={styles.tabGroup}>
              <button
                className={`${styles.tabBtn} ${activeTab === 'users' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('users')}>
                {lang === 'ja' ? 'ユーザー' : 'Users'}
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === 'stats' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('stats')}>
                📈 {lang === 'ja' ? '統計' : 'Stats'}
              </button>
            </div>
          )}
          <span className={styles.headerSub}>{lang === 'ja' ? `${profiles.length}名` : `${profiles.length} users`}</span>
        </div>
      </div>

      {error   && <div className={styles.errorBanner}>{error}<button onClick={() => setError(null)}>✕</button></div>}
      {success && <div className={styles.successBanner}>{success}</div>}

      {/* ── Pending requests ── */}
      {requests.length > 0 && (
        <div className={styles.requestsSection}>
          <div className={styles.requestsHeading}>
            <span>{lang === 'ja' ? '申請中' : 'Pending Requests'}</span>
            <span className={styles.requestsBadge}>{requests.length}</span>
          </div>
          {requests.map(req => (
            <div key={req.id} className={styles.requestCard}>
              <div className={styles.requestAvatar}>
                {(req.display_name ?? '?').slice(0, 2).toUpperCase()}
              </div>
              <div className={styles.requestInfo}>
                <span className={styles.requestName}>{req.display_name}</span>
                <span className={styles.requestEmail}>{req.email}</span>
                {req.message && <span className={styles.requestMsg}>"{req.message}"</span>}
                <span className={styles.requestAge}>{timeAgo(req.created_at, lang)}</span>
              </div>
              <div className={styles.requestActions}>
                <button className={styles.approveBtn} disabled={actioning === req.id} onClick={() => approveRequest(req)}>
                  {actioning === req.id ? '…' : (lang === 'ja' ? '承認' : 'Approve')}
                </button>
                <button className={styles.rejectBtn} disabled={actioning === req.id} onClick={() => rejectRequest(req)}>
                  {lang === 'ja' ? '拒否' : 'Reject'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Stats tab ── */}
      {!loading && isHeadcoach && activeTab === 'stats' && (
        <AppStats profiles={profiles} lang={lang} />
      )}

      {/* ── User list ── */}
      {activeTab === 'users' && (loading ? (
        <div className={styles.loading}>{lang === 'ja' ? '読込中...' : 'Loading…'}</div>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>{lang === 'ja' ? 'ユーザー' : 'User'}</span>
            <span>{lang === 'ja' ? '役割' : 'Role'}</span>
            <span>{lang === 'ja' ? '操作' : 'Actions'}</span>
          </div>

          {profiles.map(profile => {
            const displayName = profile.display_name || profile.email;
            return (
              <div key={profile.id} className={styles.row}>
                {/* User info */}
                <div className={styles.userCell}>
                  <div className={styles.avatar}>
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>
                      {profile.role === 'Player' && profile.jersey_number != null && (
                        <span className={styles.jerseyBadge}>#{profile.jersey_number}</span>
                      )}
                      {displayName}
                    </span>
                    {profile.display_name && (
                      <span className={styles.userEmail}>{profile.email}</span>
                    )}
                    {profile.username && (
                      <span className={styles.userUsername}>@{profile.username}</span>
                    )}
                    <span className={styles.badgeRow}>
                      {profile.role === 'Player' && profile.position && (
                        <span className={styles.posBadge}>{profile.position}</span>
                      )}
                      {profile.id === currentUserId && (
                        <span className={styles.youBadge}>{lang === 'ja' ? '自分' : 'You'}</span>
                      )}
                      {profile.last_seen_at && (
                        <span className={styles.lastSeenBadge} title={new Date(profile.last_seen_at).toLocaleString()}>
                          🕐 {timeAgo(profile.last_seen_at, lang)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                {/* Role quick-select */}
                <div className={styles.roleCell}>
                  <span className={`${styles.roleBadge} ${ROLE_COLORS[profile.role] ?? ''}`}>
                    {profile.role}
                  </span>
                  <select className={styles.roleSelect} value={profile.role}
                    disabled={saving === profile.id}
                    onChange={e => updateRole(profile.id, e.target.value)}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {saving === profile.id && <span className={styles.spinner}>…</span>}
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                  <button className={styles.editBtn} onClick={() => setEditProfile(profile)}
                    title={lang === 'ja' ? '編集' : 'Edit'}>
                    ✏️
                  </button>
                  <button className={styles.delBtn} onClick={() => setDelProfile(profile)}
                    title={lang === 'ja' ? '削除' : 'Delete'}
                    disabled={profile.id === currentUserId}>
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}

          {profiles.length === 0 && (
            <p className={styles.empty}>{lang === 'ja' ? 'ユーザーが見つかりません。' : 'No users found.'}</p>
          )}
        </div>
      ))}

      {/* ── Edit modal ── */}
      {editProfile && (
        <EditModal
          profile={editProfile}
          lang={lang}
          onSave={updated => setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p))}
          onClose={() => setEditProfile(null)}
        />
      )}

      {/* ── Delete confirm modal ── */}
      {delProfile && (
        <DeleteModal
          profile={delProfile}
          lang={lang}
          currentUserId={currentUserId}
          onDelete={id => setProfiles(prev => prev.filter(p => p.id !== id))}
          onClose={() => setDelProfile(null)}
        />
      )}

    </div>
  );
}
