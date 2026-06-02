'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Tactics.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'scouting',  label: { en: 'Scouting',    ja: 'スカウティング' }, icon: '📋' },
  { id: 'roster',    label: { en: 'Roster',       ja: 'ロスター'       }, icon: '👥' },
  { id: 'setters',   label: { en: 'Setters',      ja: 'セッター'       }, icon: '🎯' },
  { id: 'servers',   label: { en: 'Servers',      ja: 'サーバー'       }, icon: '💥' },
  { id: 'spikers',   label: { en: 'Spikers',      ja: 'スパイカー'     }, icon: '⚡' },
  { id: 'videos',    label: { en: 'Videos',       ja: '動画'           }, icon: '▶'  },
  { id: 'rotation',  label: { en: 'Rotation',     ja: 'ローテーション' }, icon: '🔄' },
  { id: 'matches',   label: { en: 'Matches',      ja: '試合'           }, icon: '📊' },
];

const PLAYER_CATS = new Set(['setters', 'servers', 'spikers']);

const POSITIONS        = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Universal'];
const ROSTER_POSITIONS = ['Setter', 'Outside Hitter', 'Middle Blocker', 'Opposite', 'Libero', 'Universal'];
const COMMANDS         = ['Step Left', 'Half Step Left', 'Leave both Lines', 'Half Step Right', 'Step Right'];
const ZONES            = ['1', '2', '3', '4', '5', '6'];
const COURT_LAYOUT     = [['4','3','2'],['5','6','1']];
const COURT_POSITIONS  = [['pos4','pos3','pos2'],['pos5','pos6','pos1']];
const POS_LABELS       = { pos1:'1', pos2:'2', pos3:'3', pos4:'4', pos5:'5', pos6:'6' };

const AUTO_TABS = {
  Setter:          ['servers', 'setters'],
  'Outside Hitter':['servers', 'spikers'],
  'Middle Blocker':['servers', 'spikers'],
  Opposite:        ['servers', 'spikers'],
  Libero:          ['servers'],
  Universal:       ['servers', 'spikers'],
};

const COMMAND_COLORS = {
  'Step Left':        { bg: '#dbeafe', color: '#1d4ed8' },
  'Half Step Left':   { bg: '#eff6ff', color: '#3b82f6' },
  'Leave both Lines': { bg: '#f3e8ff', color: '#7e22ce' },
  'Half Step Right':  { bg: '#ffe4e6', color: '#e11d48' },
  'Step Right':       { bg: '#fee2e2', color: '#dc2626' },
};

const ZONE_COLORS = {
  '1': { bg: '#fee2e2', color: '#dc2626' },
  '2': { bg: '#ffedd5', color: '#c2410c' },
  '3': { bg: '#fefce8', color: '#a16207' },
  '4': { bg: '#dcfce7', color: '#15803d' },
  '5': { bg: '#dbeafe', color: '#1d4ed8' },
  '6': { bg: '#f3e8ff', color: '#7e22ce' },
};

const TYP_COLORS = [
  { match: 'jump',   bg: '#fee2e2', color: '#dc2626' },
  { match: 'float',  bg: '#dbeafe', color: '#1d4ed8' },
  { match: 'hybrid', bg: '#f3e8ff', color: '#7e22ce' },
];

const T = {
  addTeam:      { en: '+ Add Team',                ja: '+ チームを追加'         },
  editTeam:     { en: 'Edit team',                  ja: 'チームを編集'           },
  teamName:     { en: 'Team name',                  ja: 'チーム名'               },
  abbr:         { en: 'Abbreviation (2–4 letters)', ja: '略称（2〜4文字）'       },
  color:        { en: 'Color',                      ja: 'カラー'                 },
  logoUrl:      { en: 'Logo URL (optional)',         ja: 'ロゴURL（任意）'        },
  photoUrl:     { en: 'Photo URL (optional)',        ja: '写真URL（任意）'        },
  save:         { en: 'Save',                       ja: '保存'                   },
  saving:       { en: 'Saving…',                    ja: '保存中…'                },
  cancel:       { en: 'Cancel',                     ja: 'キャンセル'             },
  required:     { en: 'Required field.',            ja: 'この項目は必須です。'   },
  loading:      { en: 'Loading…',                   ja: '読込中…'                },
  back:         { en: '← All Teams',               ja: '← チーム一覧'           },
  print:        { en: 'Print',                      ja: '印刷'                   },
  noNotes:      { en: 'No notes yet.',              ja: 'まだメモがありません。'  },
  noPlayers:    { en: 'No players yet.',            ja: 'まだ選手がいません。'   },
  noVideos:     { en: 'No videos yet.',             ja: 'まだ動画がありません。'  },
  noRoster:     { en: 'No players yet.',            ja: 'まだ選手がいません。'   },
  noServers:    { en: 'No servers yet.',            ja: 'まだサーバーがいません。'},
  noMatches:    { en: 'No matches logged yet.',     ja: 'まだ試合がありません。'  },
  addNote:      { en: '+ Add note',                 ja: '+ メモを追加'           },
  addPlayer:    { en: '+ Add player',               ja: '+ 選手を追加'           },
  addVideo:     { en: '+ Add video',                ja: '+ 動画を追加'           },
  addRoster:    { en: '+ Add player',               ja: '+ 選手を追加'           },
  addServer:    { en: '+ Add server',               ja: '+ サーバーを追加'       },
  addMatch:     { en: '+ Add match',                ja: '+ 試合を追加'           },
  editNote:     { en: 'Edit note',                  ja: 'メモを編集'             },
  editPlayer:   { en: 'Edit player',                ja: '選手を編集'             },
  editVideo:    { en: 'Edit video',                 ja: '動画を編集'             },
  editRoster:   { en: 'Edit player',                ja: '選手を編集'             },
  editServer:   { en: 'Edit server',                ja: 'サーバーを編集'         },
  newNote:      { en: 'New note',                   ja: '新しいメモ'             },
  newPlayer:    { en: 'New player',                 ja: '新しい選手'             },
  newVideo:     { en: 'New video',                  ja: '新しい動画'             },
  newRoster:    { en: 'New player',                 ja: '新しい選手'             },
  newServer:    { en: 'New server',                 ja: '新しいサーバー'         },
  playerName:   { en: 'Player name',                ja: '選手名'                 },
  jersey:       { en: 'Jersey #',                   ja: '背番号'                 },
  notes:        { en: 'Notes',                      ja: 'メモ'                   },
  noteTitle:    { en: 'Title (optional)',            ja: 'タイトル（任意）'       },
  videoTitle:   { en: 'Video title',                ja: '動画タイトル'           },
  videoUrl:     { en: 'YouTube URL',                ja: 'YouTube URL'            },
  descOptional: { en: 'Description (optional)',     ja: '説明（任意）'           },
  watch:        { en: 'Watch ↗',                    ja: '視聴 ↗'                 },
  age:          { en: 'Age',                        ja: '年齢'                   },
  nationality:  { en: 'Nationality',                ja: '国籍'                   },
  position:     { en: 'Position',                   ja: 'ポジション'             },
  startingZone: { en: 'Starting Zone',              ja: 'スタートゾーン'         },
  typ:          { en: 'TYP',                        ja: 'タイプ'                 },
  command:      { en: 'COMMAND',                    ja: 'コマンド'               },
  bestServeZone:{ en: 'Best Serve Zone',            ja: 'ベストサーブゾーン'     },
  serveTargets: { en: 'Serve Targets (click zones)',ja: 'サーブターゲット（ゾーンをタップ）'},
  info1:        { en: 'INFO 1',                     ja: 'INFO 1'                 },
  info2:        { en: 'INFO 2',                     ja: 'INFO 2'                 },
  afterTo:      { en: 'AFTER TO',                   ja: 'タイムアウト後'         },
  matchDate:    { en: 'Date',                       ja: '日付'                   },
  matchVs:      { en: 'Opponent / Location',        ja: '対戦相手 / 会場'        },
  ourSets:      { en: 'Our sets',                   ja: '自チームセット'         },
  theirSets:    { en: 'Their sets',                 ja: '相手セット'             },
  selectPlayer: { en: 'Assign player',              ja: '選手を割り当て'         },
  clearSlot:    { en: 'Clear slot',                 ja: 'クリア'                 },
  serveHeatmap: { en: 'Serve Target Distribution',  ja: 'サーブターゲット分布'   },
  rotationHint: { en: 'Click a position to assign a player from your roster.',
                  ja: 'ポジションをクリックしてロスターから選手を割り当て。' },
};

function tr(key, lang) { return T[key]?.[lang] ?? T[key]?.en ?? key; }

function ytThumb(url) {
  if (!url) return null;
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? `https://img.youtube.com/vi/${m[1]}/mqdefault.jpg` : null;
}

// ── Team badge ────────────────────────────────────────────────────────────────

function TeamBadge({ team, size = 30 }) {
  if (team.logo_url) {
    return (
      <img src={team.logo_url} alt={team.abbr} width={size} height={size}
        className={styles.teamLogo}
        onError={e => { e.currentTarget.style.display = 'none'; }}
      />
    );
  }
  return (
    <span className={styles.teamBadge}
      style={{ background: team.color, width: size, height: size, fontSize: Math.round(size * 0.34) }}>
      {team.abbr}
    </span>
  );
}

// ── Court diagram (serve zones + heatmap) ─────────────────────────────────────

function CourtDiagram({ mode = 'pick', selected = [], onChange, heatmap = {}, compact = false }) {
  const maxCount = Math.max(1, ...Object.values(heatmap));

  function toggle(zone) {
    if (mode !== 'pick') return;
    onChange?.(selected.includes(zone) ? selected.filter(z => z !== zone) : [...selected, zone]);
  }

  function zoneStyle(zone) {
    if (mode === 'display') {
      const n = heatmap[zone] || 0;
      if (!n) return { background: '#f3f4f6', color: '#9ca3af' };
      const t = n / maxCount;
      return {
        background: `rgba(126,0,39,${0.18 + t * 0.72})`,
        color: t > 0.4 ? '#fff' : '#5c001a',
        borderColor: 'rgba(126,0,39,0.25)',
        fontWeight: 700,
      };
    }
    return selected.includes(zone)
      ? { background: '#7e0027', color: '#fff', borderColor: '#5c001a' }
      : { background: '#f9fafb', color: '#374151', borderColor: '#e5e7eb' };
  }

  return (
    <div className={`${styles.courtDiagram} ${compact ? styles.courtCompact : ''}`}>
      <div className={styles.courtNetLabel}>{mode === 'pick' ? '— NET —' : ''}</div>
      {COURT_LAYOUT.map((row, ri) => (
        <div key={ri} className={styles.courtRow}>
          {row.map(zone => {
            const count = heatmap[zone] || 0;
            return (
              <button key={zone} type="button"
                className={styles.courtZone}
                style={zoneStyle(zone)}
                onClick={() => toggle(zone)}
                disabled={mode === 'display'}>
                <span className={styles.czNum}>{zone}</span>
                {mode === 'display' && count > 0 && (
                  <span className={styles.czCount}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Team modal ────────────────────────────────────────────────────────────────

function TeamModal({ team, lang, onSave, onClose }) {
  const isNew = !team?.id;
  const [form, setForm] = useState({
    name:     team?.name     ?? '',
    abbr:     team?.abbr     ?? '',
    color:    team?.color    ?? '#3b82f6',
    logo_url: team?.logo_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.abbr.trim()) { setErr(tr('required', lang)); return; }
    setSaving(true);
    await onSave({ ...form, name: form.name.trim(), abbr: form.abbr.trim().toUpperCase().slice(0, 4), id: team?.id });
    setSaving(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? tr('addTeam', lang) : tr('editTeam', lang)}</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        {err && <p className={styles.modalErr}>{err}</p>}
        <div className={styles.modalBody}>
          <label className={styles.label}>{tr('teamName', lang)}</label>
          <input className={styles.modalInput} value={form.name} onChange={e => set('name', e.target.value)} autoFocus />

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('abbr', lang)}</label>
              <input className={styles.modalInput} value={form.abbr} onChange={e => set('abbr', e.target.value)} maxLength={4} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('color', lang)}</label>
              <div className={styles.colorRow}>
                <input type="color" className={styles.colorPicker} value={form.color} onChange={e => set('color', e.target.value)} />
                <TeamBadge team={{ ...form, abbr: form.abbr || '?' }} size={34} />
              </div>
            </div>
          </div>

          <label className={styles.label}>{tr('logoUrl', lang)}</label>
          <input className={styles.modalInput} value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://..." />
        </div>
        <div className={styles.modalFooter}>
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={onClose}>{tr('cancel', lang)}</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? tr('saving', lang) : tr('save', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Roster modal (with photo) ─────────────────────────────────────────────────

function RosterModal({ note, lang, onSave, onClose }) {
  const isNew = !note?.id;
  const [form, setForm] = useState({
    title:       note?.title       ?? '',
    jersey:      note?.jersey      ?? '',
    position:    note?.position    ?? '',
    age:         note?.age         ?? '',
    nationality: note?.nationality ?? '',
    body:        note?.body        ?? '',
    photo_url:   note?.photo_url   ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setErr(tr('required', lang)); return; }
    setSaving(true);
    await onSave({ ...form, id: note?.id });
    setSaving(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? tr('newRoster', lang) : tr('editRoster', lang)}</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        {err && <p className={styles.modalErr}>{err}</p>}
        <div className={styles.modalBody}>
          <div className={styles.modalRow}>
            <div className={styles.modalField} style={{ flex: 3 }}>
              <label className={styles.label}>{tr('playerName', lang)}</label>
              <input className={styles.modalInput} value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
            </div>
            <div className={styles.modalField} style={{ flex: 1 }}>
              <label className={styles.label}>{tr('jersey', lang)}</label>
              <input className={styles.modalInput} value={form.jersey} onChange={e => set('jersey', e.target.value)} />
            </div>
          </div>

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('position', lang)}</label>
              <select className={styles.modalInput} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">—</option>
                {ROSTER_POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('age', lang)}</label>
              <input className={styles.modalInput} type="number" min="15" max="50" value={form.age} onChange={e => set('age', e.target.value)} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('nationality', lang)}</label>
              <input className={styles.modalInput} value={form.nationality} onChange={e => set('nationality', e.target.value)} />
            </div>
          </div>

          <label className={styles.label}>{tr('photoUrl', lang)}</label>
          <input className={styles.modalInput} value={form.photo_url} onChange={e => set('photo_url', e.target.value)} placeholder="https://..." />

          <label className={styles.label}>{tr('notes', lang)}</label>
          <textarea className={styles.modalTextarea} value={form.body} onChange={e => set('body', e.target.value)} rows={3} />
        </div>
        <div className={styles.modalFooter}>
          {isNew && form.position && (
            <span className={styles.autoCreateHint}>
              {lang === 'ja'
                ? `保存すると ${(AUTO_TABS[form.position] ?? []).join(', ')} に自動追加`
                : `Auto-adds to: ${(AUTO_TABS[form.position] ?? []).join(', ')}`}
            </span>
          )}
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={onClose}>{tr('cancel', lang)}</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? tr('saving', lang) : tr('save', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Roster table ──────────────────────────────────────────────────────────────

function RosterTable({ players, lang, onEdit, onDelete }) {
  if (players.length === 0) return null;
  return (
    <div className={styles.serverTableWrap}>
      <table className={styles.serverTable}>
        <thead>
          <tr>
            <th className={styles.serverTh}></th>
            <th className={styles.serverTh}>#</th>
            <th className={styles.serverTh}>Name</th>
            <th className={styles.serverTh}>Position</th>
            <th className={styles.serverTh}>Age</th>
            <th className={styles.serverTh}>Nationality</th>
            <th className={styles.serverTh}>Notes</th>
            <th className={styles.serverTh}></th>
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id} className={styles.serverTr} onClick={() => onEdit(p)}>
              <td className={styles.serverTd}>
                {p.photo_url
                  ? <img src={p.photo_url} alt={p.title} className={styles.playerThumb} />
                  : <div className={styles.playerThumbPlaceholder}>{(p.title || '?')[0]}</div>
                }
              </td>
              <td className={styles.serverTd}>{p.jersey || '—'}</td>
              <td className={styles.serverTd} style={{ fontWeight: 600 }}>{p.title || '—'}</td>
              <td className={styles.serverTd}>{p.position || '—'}</td>
              <td className={styles.serverTd}>{p.age || '—'}</td>
              <td className={styles.serverTd}>{p.nationality || '—'}</td>
              <td className={`${styles.serverTd} ${styles.serverTdWrap}`}>{p.body || '—'}</td>
              <td className={styles.serverTd} onClick={e => e.stopPropagation()}>
                <button className={styles.noteDeleteBtn} onClick={() => onDelete(p.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Server modal (with serve target zone diagram) ─────────────────────────────

function ServerModal({ note, lang, onSave, onClose }) {
  const isNew = !note?.id;
  const [form, setForm] = useState({
    title:              note?.title              ?? '',
    jersey:             note?.jersey             ?? '',
    position:           note?.position           ?? '',
    starting_zone:      note?.starting_zone      ?? '',
    typ:                note?.typ                ?? '',
    command:            note?.command            ?? '',
    best_serve_zone:    note?.best_serve_zone    ?? '',
    serve_target_zones: note?.serve_target_zones ?? [],
    info1:              note?.info1              ?? '',
    info2:              note?.info2              ?? '',
    after_to:           note?.after_to           ?? '',
    photo_url:          note?.photo_url          ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setErr(tr('required', lang)); return; }
    setSaving(true);
    await onSave({ ...form, id: note?.id });
    setSaving(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? tr('newServer', lang) : tr('editServer', lang)}</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        {err && <p className={styles.modalErr}>{err}</p>}
        <div className={styles.modalBody}>
          <div className={styles.modalRow}>
            <div className={styles.modalField} style={{ flex: 3 }}>
              <label className={styles.label}>{tr('playerName', lang)}</label>
              <input className={styles.modalInput} value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
            </div>
            <div className={styles.modalField} style={{ flex: 1 }}>
              <label className={styles.label}>{tr('jersey', lang)}</label>
              <input className={styles.modalInput} value={form.jersey} onChange={e => set('jersey', e.target.value)} />
            </div>
          </div>

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('position', lang)}</label>
              <select className={styles.modalInput} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">—</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('startingZone', lang)}</label>
              <select className={styles.modalInput} value={form.starting_zone} onChange={e => set('starting_zone', e.target.value)}>
                <option value="">—</option>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('typ', lang)}</label>
              <input className={styles.modalInput} value={form.typ} onChange={e => set('typ', e.target.value)} />
            </div>
          </div>

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('command', lang)}</label>
              <select className={styles.modalInput} value={form.command} onChange={e => set('command', e.target.value)}>
                <option value="">—</option>
                {COMMANDS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('bestServeZone', lang)}</label>
              <select className={styles.modalInput} value={form.best_serve_zone} onChange={e => set('best_serve_zone', e.target.value)}>
                <option value="">—</option>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <label className={styles.label}>{tr('serveTargets', lang)}</label>
          <CourtDiagram
            mode="pick"
            selected={form.serve_target_zones}
            onChange={v => set('serve_target_zones', v)}
          />

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('info1', lang)}</label>
              <input className={styles.modalInput} value={form.info1} onChange={e => set('info1', e.target.value)} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('info2', lang)}</label>
              <input className={styles.modalInput} value={form.info2} onChange={e => set('info2', e.target.value)} />
            </div>
          </div>

          <label className={styles.label}>{tr('afterTo', lang)}</label>
          <input className={styles.modalInput} value={form.after_to} onChange={e => set('after_to', e.target.value)} />

          <label className={styles.label}>{tr('photoUrl', lang)}</label>
          <input className={styles.modalInput} value={form.photo_url} onChange={e => set('photo_url', e.target.value)} placeholder="https://..." />
        </div>
        <div className={styles.modalFooter}>
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={onClose}>{tr('cancel', lang)}</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? tr('saving', lang) : tr('save', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Serve heatmap ─────────────────────────────────────────────────────────────

function ServeHeatmap({ servers, lang }) {
  const heatmap = {};
  servers.forEach(s => {
    (s.serve_target_zones || []).forEach(z => {
      heatmap[z] = (heatmap[z] || 0) + 1;
    });
    if (s.best_serve_zone && !(s.serve_target_zones?.length)) {
      heatmap[s.best_serve_zone] = (heatmap[s.best_serve_zone] || 0) + 1;
    }
  });
  if (!Object.keys(heatmap).length) return null;
  return (
    <div className={styles.heatmapBlock}>
      <p className={styles.heatmapTitle}>{tr('serveHeatmap', lang)}</p>
      <CourtDiagram mode="display" heatmap={heatmap} compact />
    </div>
  );
}

// ── Server table ──────────────────────────────────────────────────────────────

function ServerTable({ servers, lang, onEdit, onDelete, onDuplicate }) {
  if (servers.length === 0) return null;
  const cols = [
    { key: 'title',           label: 'Name'            },
    { key: 'jersey',          label: '#'               },
    { key: 'position',        label: 'Position'        },
    { key: 'starting_zone',   label: 'Start Zone'      },
    { key: 'typ',             label: 'TYP'             },
    { key: 'command',         label: 'COMMAND'         },
    { key: 'best_serve_zone', label: 'Best Zone'       },
    { key: 'info1',           label: 'INFO 1'          },
    { key: 'info2',           label: 'INFO 2'          },
    { key: 'after_to',        label: 'AFTER TO'        },
  ];

  function chip(colorMap, value) {
    const c = colorMap[value];
    if (!c) return value;
    return <span className={styles.tacChip} style={{ background: c.bg, color: c.color }}>{value}</span>;
  }

  function renderCell(key, value) {
    if (!value) return '—';
    if (key === 'command') return chip(COMMAND_COLORS, value);
    if (key === 'starting_zone' || key === 'best_serve_zone') return chip(ZONE_COLORS, value);
    if (key === 'typ') {
      const v = value.toLowerCase();
      const match = TYP_COLORS.find(t => v.includes(t.match));
      if (match) return <span className={styles.tacChip} style={{ background: match.bg, color: match.color }}>{value}</span>;
    }
    return value;
  }

  return (
    <div className={styles.serverTableWrap}>
      <table className={styles.serverTable}>
        <thead>
          <tr>
            <th className={styles.serverTh}></th>
            {cols.map(c => <th key={c.key} className={styles.serverTh}>{c.label}</th>)}
            <th className={styles.serverTh}>Targets</th>
            <th className={styles.serverTh}></th>
          </tr>
        </thead>
        <tbody>
          {servers.map(s => (
            <tr key={s.id} className={styles.serverTr} onClick={() => onEdit(s)}>
              <td className={styles.serverTd}>
                {s.photo_url
                  ? <img src={s.photo_url} alt={s.title} className={styles.playerThumb} />
                  : <div className={styles.playerThumbPlaceholder}>{(s.title || '?')[0]}</div>
                }
              </td>
              {cols.map(c => (
                <td key={c.key} className={styles.serverTd}>{renderCell(c.key, s[c.key])}</td>
              ))}
              <td className={styles.serverTd}>
                {(s.serve_target_zones || []).length > 0
                  ? (s.serve_target_zones || []).map(z => (
                      <span key={z} className={styles.tacChip}
                        style={{ background: ZONE_COLORS[z]?.bg, color: ZONE_COLORS[z]?.color, marginRight: 2 }}>
                        {z}
                      </span>
                    ))
                  : '—'
                }
              </td>
              <td className={styles.serverTd} onClick={e => e.stopPropagation()}>
                <button className={styles.noteDupBtn} title="Duplicate" onClick={() => onDuplicate(s)}>⧉</button>
                <button className={styles.noteDeleteBtn} onClick={() => onDelete(s.id)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Note modal ────────────────────────────────────────────────────────────────

function NoteModal({ note, category, lang, onSave, onClose }) {
  const isPlayer = PLAYER_CATS.has(category);
  const isVideo  = category === 'videos';
  const isNew    = !note?.id;

  const [form, setForm] = useState({
    title:     note?.title     ?? '',
    body:      note?.body      ?? '',
    url:       note?.url       ?? '',
    jersey:    note?.jersey    ?? '',
    photo_url: note?.photo_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (isPlayer && !form.title.trim())             { setErr(tr('required', lang)); return; }
    if (isVideo  && !form.url.trim())               { setErr(tr('required', lang)); return; }
    if (!isPlayer && !isVideo && !form.body.trim()) { setErr(tr('required', lang)); return; }
    setSaving(true);
    await onSave({ ...form, id: note?.id });
    setSaving(false);
  };

  const title = isNew
    ? tr(isPlayer ? 'newPlayer' : isVideo ? 'newVideo' : 'newNote', lang)
    : tr(isPlayer ? 'editPlayer' : isVideo ? 'editVideo' : 'editNote', lang);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{title}</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        {err && <p className={styles.modalErr}>{err}</p>}
        <div className={styles.modalBody}>
          {isVideo && (
            <>
              <label className={styles.label}>{tr('videoTitle', lang)}</label>
              <input className={styles.modalInput} value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
              <label className={styles.label}>{tr('videoUrl', lang)}</label>
              <input className={styles.modalInput} value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://youtube.com/watch?v=..." />
              <label className={styles.label}>{tr('descOptional', lang)}</label>
              <textarea className={styles.modalTextarea} value={form.body} onChange={e => set('body', e.target.value)} rows={2} />
            </>
          )}
          {isPlayer && (
            <>
              <div className={styles.modalRow}>
                <div className={styles.modalField} style={{ flex: 3 }}>
                  <label className={styles.label}>{tr('playerName', lang)}</label>
                  <input className={styles.modalInput} value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
                </div>
                <div className={styles.modalField} style={{ flex: 1 }}>
                  <label className={styles.label}>{tr('jersey', lang)}</label>
                  <input className={styles.modalInput} value={form.jersey} onChange={e => set('jersey', e.target.value)} />
                </div>
              </div>
              <label className={styles.label}>{tr('photoUrl', lang)}</label>
              <input className={styles.modalInput} value={form.photo_url} onChange={e => set('photo_url', e.target.value)} placeholder="https://..." />
              <label className={styles.label}>{tr('notes', lang)}</label>
              <textarea className={styles.modalTextarea} value={form.body} onChange={e => set('body', e.target.value)} rows={4} />
            </>
          )}
          {!isPlayer && !isVideo && (
            <>
              <label className={styles.label}>{tr('noteTitle', lang)}</label>
              <input className={styles.modalInput} value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
              <label className={styles.label}>{tr('notes', lang)}</label>
              <textarea className={styles.modalTextarea} value={form.body} onChange={e => set('body', e.target.value)} rows={5} />
            </>
          )}
        </div>
        <div className={styles.modalFooter}>
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={onClose}>{tr('cancel', lang)}</button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? tr('saving', lang) : tr('save', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Note card ─────────────────────────────────────────────────────────────────

function NoteCard({ note, category, lang, onEdit, onDelete }) {
  const isVideo = category === 'videos';
  const thumb   = isVideo ? ytThumb(note.url) : null;

  return (
    <div className={`${styles.noteCard} ${isVideo ? styles.noteCardVideo : ''}`}>
      {isVideo ? (
        <div className={styles.videoLayout}>
          <div className={styles.videoThumbWrap}>
            {thumb
              ? <img src={thumb} alt={note.title} className={styles.videoThumb} />
              : <div className={styles.videoThumbFallback}>▶</div>
            }
          </div>
          <div className={styles.videoInfo}>
            {note.title && <p className={styles.noteTitle}>{note.title}</p>}
            {note.body  && <p className={styles.noteBody}>{note.body}</p>}
            {note.url   && (
              <a href={note.url} target="_blank" rel="noopener noreferrer" className={styles.watchLink}>
                {tr('watch', lang)}
              </a>
            )}
          </div>
        </div>
      ) : (
        <>
          {(note.photo_url || note.title || note.jersey) && (
            <div className={styles.noteCardHeader}>
              {note.photo_url && <img src={note.photo_url} alt={note.title} className={styles.notePhoto} />}
              {note.jersey && <span className={styles.jerseyBadge}>#{note.jersey}</span>}
              {note.title  && <span className={styles.noteTitle}>{note.title}</span>}
            </div>
          )}
          {note.body && <p className={styles.noteBody}>{note.body}</p>}
        </>
      )}
      <div className={styles.noteMeta}>
        <span className={styles.noteAuthor}>{note.author_name}</span>
        <div className={styles.noteMetaActions}>
          <button className={styles.noteEditBtn}   onClick={() => onEdit(note)}>✏</button>
          <button className={styles.noteDeleteBtn} onClick={() => onDelete(note.id)}>×</button>
        </div>
      </div>
    </div>
  );
}

// ── Rotation viewer ───────────────────────────────────────────────────────────

function RotationViewer({ rotations = {}, roster, onSave, lang }) {
  const [activeRot,  setActiveRot]  = useState(1);
  const [editingPos, setEditingPos] = useState(null);
  const [saving,     setSaving]     = useState(false);

  const rotKey = `rot_${activeRot}`;
  const rot    = rotations[rotKey] || {};

  const assign = async (posKey, player) => {
    setSaving(true);
    await onSave({
      ...rotations,
      [rotKey]: { ...rot, [posKey]: player || null },
    });
    setSaving(false);
    setEditingPos(null);
  };

  return (
    <div className={styles.rotWrapper}>
      <div className={styles.rotTabs}>
        {[1,2,3,4,5,6].map(n => (
          <button key={n}
            className={`${styles.rotTab} ${activeRot === n ? styles.rotTabActive : ''}`}
            onClick={() => setActiveRot(n)}>
            {lang === 'ja' ? `ローテ ${n}` : `Rotation ${n}`}
          </button>
        ))}
      </div>

      <p className={styles.rotHint}>{tr('rotationHint', lang)}</p>

      <div className={styles.rotCourt}>
        <div className={styles.rotNet}>{lang === 'ja' ? 'ネット' : 'NET'}</div>
        {COURT_POSITIONS.map((row, ri) => (
          <div key={ri} className={styles.rotRow}>
            {row.map(posKey => {
              const p = rot[posKey];
              return (
                <button key={posKey}
                  className={`${styles.rotCell} ${p ? styles.rotCellFilled : ''}`}
                  onClick={() => setEditingPos(posKey)}
                  disabled={saving}>
                  {p ? (
                    <div className={styles.rotPlayerInfo}>
                      {p.photo_url && <img src={p.photo_url} alt={p.name} className={styles.rotPhoto} />}
                      {p.jersey && <span className={styles.rotJersey}>#{p.jersey}</span>}
                      <span className={styles.rotName}>{p.name}</span>
                    </div>
                  ) : (
                    <span className={styles.rotZoneNum}>{POS_LABELS[posKey]}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {editingPos && (
        <div className={styles.overlay} onClick={() => setEditingPos(null)}>
          <div className={styles.modal} style={{ maxWidth: 360 }} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                {tr('selectPlayer', lang)} — {lang === 'ja' ? 'ゾーン' : 'Zone'} {POS_LABELS[editingPos]}
              </span>
              <button className={styles.closeBtn} onClick={() => setEditingPos(null)}>×</button>
            </div>
            <div className={styles.modalBody} style={{ gap: 4, paddingTop: 8, maxHeight: 360, overflowY: 'auto' }}>
              <button className={styles.rotClearBtn} onClick={() => assign(editingPos, null)}>
                — {tr('clearSlot', lang)}
              </button>
              {roster.length === 0 && (
                <p style={{ color: '#9ca3af', fontSize: 13, margin: '8px 0' }}>
                  {lang === 'ja' ? 'まずロスターに選手を追加してください' : 'Add players to Roster first'}
                </p>
              )}
              {roster.map(p => (
                <button key={p.id}
                  className={`${styles.rotPickBtn} ${rot[editingPos]?.name === p.title ? styles.rotPickBtnActive : ''}`}
                  onClick={() => assign(editingPos, { name: p.title, jersey: p.jersey, photo_url: p.photo_url })}>
                  {p.photo_url && <img src={p.photo_url} alt={p.title} className={styles.rotPickPhoto} />}
                  {p.jersey ? <span className={styles.jerseyBadge}>#{p.jersey}</span> : null}
                  <span style={{ flex: 1, textAlign: 'left' }}>{p.title}</span>
                  {p.position && <span className={styles.rotPickPos}>{p.position}</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Match modal ───────────────────────────────────────────────────────────────

function MatchModal({ match, lang, onSave, onClose }) {
  const isNew = !match?.id;
  const [form, setForm] = useState({
    match_date: match?.match_date ?? new Date().toISOString().slice(0, 10),
    location:   match?.location   ?? '',
    our_sets:   match?.our_sets   ?? '',
    their_sets: match?.their_sets ?? '',
    notes:      match?.notes      ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>{isNew ? 'New Match' : 'Edit Match'}</span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.label}>{tr('matchDate', lang)}</label>
          <input type="date" className={styles.modalInput} value={form.match_date}
            onChange={e => set('match_date', e.target.value)} />

          <label className={styles.label}>{tr('matchVs', lang)}</label>
          <input className={styles.modalInput} value={form.location} autoFocus
            onChange={e => set('location', e.target.value)} placeholder="vs. Team Name" />

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('ourSets', lang)}</label>
              <input type="number" min="0" max="3" className={styles.modalInput}
                value={form.our_sets} onChange={e => set('our_sets', e.target.value)} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('theirSets', lang)}</label>
              <input type="number" min="0" max="3" className={styles.modalInput}
                value={form.their_sets} onChange={e => set('their_sets', e.target.value)} />
            </div>
          </div>

          <label className={styles.label}>{tr('notes', lang)}</label>
          <textarea className={styles.modalTextarea} value={form.notes}
            onChange={e => set('notes', e.target.value)} rows={3} />
        </div>
        <div className={styles.modalFooter}>
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={onClose}>{tr('cancel', lang)}</button>
            <button className={styles.saveBtn} disabled={saving}
              onClick={async () => { setSaving(true); await onSave({ ...form, id: match?.id }); setSaving(false); }}>
              {saving ? tr('saving', lang) : tr('save', lang)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Match list ────────────────────────────────────────────────────────────────

function MatchList({ matches, lang, onEdit, onDelete }) {
  return (
    <div className={styles.matchList}>
      {matches.map(m => {
        const us   = m.our_sets   ?? 0;
        const them = m.their_sets ?? 0;
        const win  = us > them;
        const dateStr = m.match_date
          ? new Date(m.match_date + 'T12:00:00').toLocaleDateString(
              lang === 'ja' ? 'ja-JP' : 'en-GB',
              { day: 'numeric', month: 'short', year: 'numeric' }
            )
          : '—';
        return (
          <div key={m.id} className={styles.matchRow} onClick={() => onEdit(m)}>
            <span className={styles.matchDate}>{dateStr}</span>
            <span className={styles.matchVs}>{m.location || '—'}</span>
            <span className={`${styles.matchResult} ${win ? styles.matchWin : styles.matchLoss}`}>
              {win ? 'W' : 'L'}
            </span>
            <span className={styles.matchScore}>{us} – {them}</span>
            {m.notes && <span className={styles.matchNoteText}>{m.notes}</span>}
            <button className={styles.noteDeleteBtn}
              onClick={e => { e.stopPropagation(); if (confirm('Delete match?')) onDelete(m.id); }}>
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Tactics({ lang = 'en', profile }) {
  const [view,          setView]          = useState('teams');
  const [teams,         setTeams]         = useState([]);
  const [notes,         setNotes]         = useState([]);
  const [matches,       setMatches]       = useState([]);
  const [selectedTeam,  setSelectedTeam]  = useState(null);
  const [activeTab,     setActiveTab]     = useState('scouting');
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [teamModal,     setTeamModal]     = useState(null);
  const [noteModal,     setNoteModal]     = useState(null);
  const [matchModal,    setMatchModal]    = useState(null);
  const [notesLoading,  setNotesLoading]  = useState(false);

  const authorName = profile?.display_name || profile?.email?.split('@')[0] || '';

  useEffect(() => {
    supabase.from('tactics_teams').select('*').order('sort_order').order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else setTeams(data ?? []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedTeam) { setNotes([]); setMatches([]); return; }
    setNotesLoading(true);
    Promise.all([
      supabase.from('tactics_notes').select('*').eq('team_id', selectedTeam.id).order('created_at', { ascending: false }),
      supabase.from('tactics_matches').select('*').eq('team_id', selectedTeam.id).order('match_date', { ascending: false }),
    ]).then(([nr, mr]) => {
      if (nr.data) setNotes(nr.data);
      if (mr.data) setMatches(mr.data);
      setNotesLoading(false);
    });
  }, [selectedTeam?.id]);

  useEffect(() => {
    const ch = supabase.channel('tactics-notes-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tactics_notes' }, p => {
        if (p.new.team_id === selectedTeam?.id)
          setNotes(prev => prev.some(n => n.id === p.new.id) ? prev : [p.new, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tactics_notes' }, p => {
        setNotes(prev => prev.map(n => n.id === p.new.id ? p.new : n));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tactics_notes' }, p => {
        setNotes(prev => prev.filter(n => n.id !== p.old.id));
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [selectedTeam?.id]);

  const selectTeam = (team) => {
    setSelectedTeam(team);
    setView('team');
    setActiveTab('scouting');
    setNotes([]);
    setMatches([]);
  };

  const saveTeam = useCallback(async (form) => {
    if (form.id) {
      const { error: err } = await supabase.from('tactics_teams')
        .update({ name: form.name, abbr: form.abbr, color: form.color, logo_url: form.logo_url || null })
        .eq('id', form.id);
      if (err) { setError(err.message); return; }
      const updated = { ...form, logo_url: form.logo_url || null };
      setTeams(prev => prev.map(t => t.id === form.id ? { ...t, ...updated } : t));
      if (selectedTeam?.id === form.id) setSelectedTeam(p => ({ ...p, ...updated }));
    } else {
      const { data, error: err } = await supabase.from('tactics_teams')
        .insert({ name: form.name, abbr: form.abbr, color: form.color, logo_url: form.logo_url || null, sort_order: teams.length })
        .select().single();
      if (err) { setError(err.message); return; }
      setTeams(prev => [...prev, data]);
    }
    setTeamModal(null);
  }, [teams.length, selectedTeam?.id]);

  const deleteTeam = useCallback(async (team) => {
    if (!confirm(`Delete ${team.name}?`)) return;
    await supabase.from('tactics_teams').delete().eq('id', team.id);
    setTeams(prev => prev.filter(t => t.id !== team.id));
    if (selectedTeam?.id === team.id) { setSelectedTeam(null); setView('teams'); }
  }, [selectedTeam?.id]);

  const saveNote = useCallback(async (form) => {
    const payload = {
      team_id:            selectedTeam.id,
      category:           activeTab,
      title:              form.title              || null,
      body:               form.body               || null,
      url:                form.url                || null,
      jersey:             form.jersey             || null,
      position:           form.position           || null,
      age:                form.age                || null,
      nationality:        form.nationality        || null,
      starting_zone:      form.starting_zone      || null,
      typ:                form.typ                || null,
      command:            form.command            || null,
      best_serve_zone:    form.best_serve_zone    || null,
      serve_target_zones: form.serve_target_zones?.length ? form.serve_target_zones : null,
      info1:              form.info1              || null,
      info2:              form.info2              || null,
      after_to:           form.after_to           || null,
      photo_url:          form.photo_url          || null,
      author_name:        authorName,
      updated_at:         new Date().toISOString(),
    };

    if (form.id) {
      const { error: err } = await supabase.from('tactics_notes').update(payload).eq('id', form.id);
      if (err) { setError(err.message); return; }
      setNotes(prev => prev.map(n => n.id === form.id ? { ...n, ...payload, id: form.id } : n));
    } else {
      const { data, error: err } = await supabase.from('tactics_notes').insert(payload).select().single();
      if (err) { setError(err.message); return; }
      setNotes(prev => [data, ...prev]);

      if (activeTab === 'roster' && form.position) {
        const tabs = AUTO_TABS[form.position] ?? [];
        if (tabs.length > 0) {
          const autoRows = tabs.map(cat => ({
            team_id:     selectedTeam.id,
            category:    cat,
            title:       form.title    || null,
            jersey:      form.jersey   || null,
            position:    form.position,
            photo_url:   form.photo_url || null,
            author_name: authorName,
          }));
          const { data: autoData } = await supabase.from('tactics_notes').insert(autoRows).select();
          if (autoData) setNotes(prev => [...prev, ...autoData]);
        }
      }
    }
    setNoteModal(null);
  }, [selectedTeam?.id, activeTab, authorName]);

  const deleteNote = useCallback(async (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    await supabase.from('tactics_notes').delete().eq('id', noteId);
  }, []);

  const duplicateServer = useCallback(async (server) => {
    const { id, created_at, updated_at, ...rest } = server;
    const { data, error: err } = await supabase.from('tactics_notes')
      .insert({ ...rest, updated_at: new Date().toISOString() }).select().single();
    if (err) { setError(err.message); return; }
    setNotes(prev => [data, ...prev]);
  }, []);

  const saveRotation = useCallback(async (rotations) => {
    const { error: err } = await supabase.from('tactics_teams')
      .update({ rotations }).eq('id', selectedTeam.id);
    if (err) { setError(err.message); return; }
    setTeams(prev => prev.map(t => t.id === selectedTeam.id ? { ...t, rotations } : t));
    setSelectedTeam(p => ({ ...p, rotations }));
  }, [selectedTeam?.id]);

  const saveMatch = useCallback(async (form) => {
    const payload = {
      team_id:    selectedTeam.id,
      match_date: form.match_date || null,
      location:   form.location   || null,
      our_sets:   parseInt(form.our_sets)   || null,
      their_sets: parseInt(form.their_sets) || null,
      notes:      form.notes      || null,
    };
    if (form.id) {
      const { error: err } = await supabase.from('tactics_matches').update(payload).eq('id', form.id);
      if (err) { setError(err.message); return; }
      setMatches(prev => prev.map(m => m.id === form.id ? { ...m, ...payload } : m));
    } else {
      const { data, error: err } = await supabase.from('tactics_matches').insert(payload).select().single();
      if (err) { setError(err.message); return; }
      setMatches(prev => [data, ...prev]);
    }
    setMatchModal(null);
  }, [selectedTeam?.id]);

  const deleteMatch = useCallback(async (matchId) => {
    setMatches(prev => prev.filter(m => m.id !== matchId));
    await supabase.from('tactics_matches').delete().eq('id', matchId);
  }, []);

  // Derived
  const isRoster   = activeTab === 'roster';
  const isServer   = activeTab === 'servers';
  const isRotation = activeTab === 'rotation';
  const isMatches  = activeTab === 'matches';
  const isVideo    = activeTab === 'videos';
  const isPlayerTab = PLAYER_CATS.has(activeTab) && !isServer;

  const catNotesRaw = notes.filter(n => n.category === activeTab);
  const catNotes = (isRoster || isServer)
    ? [...catNotesRaw].sort((a, b) => (parseInt(a.jersey) || 999) - (parseInt(b.jersey) || 999))
    : catNotesRaw;

  const rosterPlayers = [...notes.filter(n => n.category === 'roster')]
    .sort((a, b) => (parseInt(a.jersey) || 999) - (parseInt(b.jersey) || 999));

  const addLabel = isRoster ? tr('addRoster', lang)
    : isServer ? tr('addServer', lang)
    : tr(isPlayerTab ? 'addPlayer' : isVideo ? 'addVideo' : 'addNote', lang);

  const emptyLabel = isRoster ? tr('noRoster', lang)
    : isServer ? tr('noServers', lang)
    : tr(isPlayerTab ? 'noPlayers' : isVideo ? 'noVideos' : 'noNotes', lang);

  if (loading) return <div className={styles.loading}>{tr('loading', lang)}</div>;

  // ── Team grid ─────────────────────────────────────────────────────────────
  if (view === 'teams') {
    return (
      <div className={styles.wrapper}>
        {error && <div className={styles.error}>{error}<button onClick={() => setError(null)}>✕</button></div>}
        <div className={styles.teamsHeader}>
          <h2 className={styles.teamsTitle}>{lang === 'ja' ? '戦術 — チーム一覧' : 'Tactics — Opponent Teams'}</h2>
          <button className={styles.addTeamBtn} onClick={() => setTeamModal('new')}>
            {tr('addTeam', lang)}
          </button>
        </div>
        {teams.length === 0 ? (
          <div className={styles.emptyState}>
            <p>{lang === 'ja' ? 'まだチームがありません。' : 'No opponent teams yet.'}</p>
            <button className={styles.addNoteBtn} onClick={() => setTeamModal('new')}>
              {tr('addTeam', lang)}
            </button>
          </div>
        ) : (
          <div className={styles.teamGrid}>
            {teams.map(team => (
              <div key={team.id} className={styles.teamCard} onClick={() => selectTeam(team)}>
                <div className={styles.teamCardLogo}>
                  {team.logo_url ? (
                    <img src={team.logo_url} alt={team.name} className={styles.teamCardLogoImg}
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                  ) : (
                    <div className={styles.teamCardAbbr} style={{ background: team.color }}>
                      {team.abbr}
                    </div>
                  )}
                </div>
                <p className={styles.teamCardName}>{team.name}</p>
                <div className={styles.teamCardActions} onClick={e => e.stopPropagation()}>
                  <button className={styles.teamActionBtn} title="Edit" onClick={() => setTeamModal(team)}>✏</button>
                  <button className={styles.teamActionBtn} title="Delete" onClick={() => deleteTeam(team)}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {teamModal && (
          <TeamModal team={teamModal === 'new' ? null : teamModal} lang={lang} onSave={saveTeam} onClose={() => setTeamModal(null)} />
        )}
      </div>
    );
  }

  // ── Team detail ───────────────────────────────────────────────────────────
  return (
    <div className={styles.wrapper}>
      {error && <div className={styles.error}>{error}<button onClick={() => setError(null)}>✕</button></div>}

      <div className={styles.contentHeader}>
        <button className={styles.backBtn} onClick={() => { setView('teams'); setSelectedTeam(null); }}>
          {tr('back', lang)}
        </button>
        <TeamBadge team={selectedTeam} size={40} />
        <h2 className={styles.contentTeamName}>{selectedTeam.name}</h2>
        <div className={styles.headerActions}>
          <button className={styles.teamActionBtn} onClick={() => setTeamModal(selectedTeam)}>✏</button>
          <button className={styles.printBtn} onClick={() => window.print()}>
            🖨 {tr('print', lang)}
          </button>
        </div>
      </div>

      <div className={styles.categoryTabs}>
        {CATEGORIES.map(cat => (
          <button key={cat.id}
            className={`${styles.catTab} ${activeTab === cat.id ? styles.catTabActive : ''}`}
            onClick={() => setActiveTab(cat.id)}>
            <span className={styles.catIcon}>{cat.icon}</span>
            <span>{cat.label[lang]}</span>
          </button>
        ))}
      </div>

      <div className={styles.noteArea}>
        {notesLoading ? (
          <p className={styles.emptyNotes}>{tr('loading', lang)}</p>
        ) : isRotation ? (
          <RotationViewer
            rotations={selectedTeam.rotations || {}}
            roster={rosterPlayers}
            onSave={saveRotation}
            lang={lang}
          />
        ) : isMatches ? (
          <>
            {matches.length === 0
              ? <p className={styles.emptyNotes}>{tr('noMatches', lang)}</p>
              : <MatchList matches={matches} lang={lang} onEdit={m => setMatchModal(m)} onDelete={deleteMatch} />
            }
            <button className={styles.addNoteBtn} onClick={() => setMatchModal('new')}>
              {tr('addMatch', lang)}
            </button>
          </>
        ) : isRoster ? (
          <>
            {catNotes.length === 0
              ? <p className={styles.emptyNotes}>{emptyLabel}</p>
              : <RosterTable players={catNotes} lang={lang} onEdit={n => setNoteModal(n)} onDelete={deleteNote} />
            }
            <button className={styles.addNoteBtn} onClick={() => setNoteModal('new')}>{addLabel}</button>
          </>
        ) : isServer ? (
          <>
            <ServeHeatmap servers={catNotes} lang={lang} />
            {catNotes.length === 0
              ? <p className={styles.emptyNotes}>{emptyLabel}</p>
              : <ServerTable servers={catNotes} lang={lang} onEdit={n => setNoteModal(n)} onDelete={deleteNote} onDuplicate={duplicateServer} />
            }
            <button className={styles.addNoteBtn} onClick={() => setNoteModal('new')}>{addLabel}</button>
          </>
        ) : catNotes.length === 0 ? (
          <>
            <p className={styles.emptyNotes}>{emptyLabel}</p>
            <button className={styles.addNoteBtn} onClick={() => setNoteModal('new')}>{addLabel}</button>
          </>
        ) : (
          <>
            <div className={`${styles.noteGrid} ${isVideo ? styles.noteGridVideo : ''}`}>
              {catNotes.map(note => (
                <NoteCard key={note.id} note={note} category={activeTab} lang={lang}
                  onEdit={n => setNoteModal(n)} onDelete={deleteNote} />
              ))}
            </div>
            <button className={styles.addNoteBtn} onClick={() => setNoteModal('new')}>{addLabel}</button>
          </>
        )}
      </div>

      {teamModal && (
        <TeamModal team={teamModal === 'new' ? null : teamModal} lang={lang} onSave={saveTeam} onClose={() => setTeamModal(null)} />
      )}
      {noteModal && isRoster && (
        <RosterModal note={noteModal === 'new' ? null : noteModal} lang={lang} onSave={saveNote} onClose={() => setNoteModal(null)} />
      )}
      {noteModal && isServer && (
        <ServerModal note={noteModal === 'new' ? null : noteModal} lang={lang} onSave={saveNote} onClose={() => setNoteModal(null)} />
      )}
      {noteModal && !isRoster && !isServer && (
        <NoteModal note={noteModal === 'new' ? null : noteModal} category={activeTab} lang={lang} onSave={saveNote} onClose={() => setNoteModal(null)} />
      )}
      {matchModal && (
        <MatchModal match={matchModal === 'new' ? null : matchModal} lang={lang} onSave={saveMatch} onClose={() => setMatchModal(null)} />
      )}
    </div>
  );
}
