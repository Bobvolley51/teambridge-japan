'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './Tactics.module.css';

const CATEGORIES = [
  { id: 'roster',   label: { en: 'Roster',    ja: 'ロスター'       }, icon: '👥' },
  { id: 'scouting', label: { en: 'Scouting',  ja: 'スカウティング' }, icon: '📋' },
  { id: 'setters',  label: { en: 'Setters',   ja: 'セッター'       }, icon: '🎯' },
  { id: 'servers',  label: { en: 'Servers',   ja: 'サーバー'       }, icon: '💥' },
  { id: 'spikers',  label: { en: 'Spikers',   ja: 'スパイカー'     }, icon: '⚡' },
  { id: 'videos',   label: { en: 'Videos',    ja: '動画'           }, icon: '▶' },
];

const PLAYER_CATS = new Set(['setters', 'servers', 'spikers']);

const T = {
  tactics:      { en: 'Tactics',                   ja: '戦術'                 },
  selectTeam:   { en: 'Select a team',              ja: 'チームを選択'         },
  addTeam:      { en: 'Add team',                   ja: 'チームを追加'         },
  editTeam:     { en: 'Edit team',                  ja: 'チームを編集'         },
  teamName:     { en: 'Team name',                  ja: 'チーム名'             },
  abbr:         { en: 'Abbreviation (2–4 letters)', ja: '略称（2〜4文字）'     },
  color:        { en: 'Color',                      ja: 'カラー'               },
  logoUrl:      { en: 'Logo URL (optional)',         ja: 'ロゴURL（任意）'      },
  addNote:      { en: '+ Add note',                 ja: '+ メモを追加'         },
  addPlayer:    { en: '+ Add player',               ja: '+ 選手を追加'         },
  addVideo:     { en: '+ Add video',                ja: '+ 動画を追加'         },
  editNote:     { en: 'Edit note',                  ja: 'メモを編集'           },
  editPlayer:   { en: 'Edit player',                ja: '選手を編集'           },
  editVideo:    { en: 'Edit video',                 ja: '動画を編集'           },
  newNote:      { en: 'New note',                   ja: '新しいメモ'           },
  newPlayer:    { en: 'New player',                 ja: '新しい選手'           },
  newVideo:     { en: 'New video',                  ja: '新しい動画'           },
  playerName:   { en: 'Player name',                ja: '選手名'               },
  jersey:       { en: 'Jersey #',                   ja: '背番号'               },
  notes:        { en: 'Notes',                      ja: 'メモ'                 },
  noteTitle:    { en: 'Title (optional)',            ja: 'タイトル（任意）'     },
  videoTitle:   { en: 'Video title',                ja: '動画タイトル'         },
  videoUrl:     { en: 'YouTube URL',                ja: 'YouTube URL'          },
  descOptional: { en: 'Description (optional)',     ja: '説明（任意）'         },
  save:         { en: 'Save',                       ja: '保存'                 },
  saving:       { en: 'Saving…',                    ja: '保存中…'              },
  cancel:       { en: 'Cancel',                     ja: 'キャンセル'           },
  delete:       { en: 'Delete',                     ja: '削除'                 },
  watch:        { en: 'Watch ↗',                    ja: '視聴 ↗'               },
  noNotes:      { en: 'No notes yet.',              ja: 'まだメモがありません。' },
  noPlayers:    { en: 'No players yet.',            ja: 'まだ選手がいません。'  },
  noVideos:     { en: 'No videos yet.',             ja: 'まだ動画がありません。' },
  required:     { en: 'Required field.',            ja: 'この項目は必須です。'  },
  loading:      { en: 'Loading…',                   ja: '読込中…'              },
  confirmDel:   { en: 'Delete',                     ja: '削除する'             },
  addRoster:    { en: '+ Add player',               ja: '+ 選手を追加'         },
  editRoster:   { en: 'Edit player',                ja: '選手を編集'           },
  newRoster:    { en: 'New player',                 ja: '新しい選手'           },
  noRoster:     { en: 'No players yet.',            ja: 'まだ選手がいません。'  },
  age:          { en: 'Age',                        ja: '年齢'                 },
  nationality:  { en: 'Nationality',               ja: '国籍'                 },
  addServer:    { en: '+ Add server',               ja: '+ サーバーを追加'     },
  editServer:   { en: 'Edit server',                ja: 'サーバーを編集'       },
  newServer:    { en: 'New server',                 ja: '新しいサーバー'       },
  noServers:    { en: 'No servers yet.',             ja: 'まだサーバーがいません。' },
  position:     { en: 'Position',                   ja: 'ポジション'           },
  startingZone: { en: 'Starting Zone',              ja: 'スタートゾーン'       },
  typ:          { en: 'TYP',                        ja: 'タイプ'               },
  command:      { en: 'COMMAND',                    ja: 'コマンド'             },
  bestServeZone:{ en: 'Best Serve Zone',            ja: 'ベストサーブゾーン'   },
  info1:        { en: 'INFO 1',                     ja: 'INFO 1'               },
  info2:        { en: 'INFO 2',                     ja: 'INFO 2'               },
  afterTo:      { en: 'AFTER TO',                   ja: 'タイムアウト後'       },
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
      <img
        src={team.logo_url}
        alt={team.abbr}
        width={size}
        height={size}
        className={styles.teamLogo}
        onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
      />
    );
  }
  return (
    <span
      className={styles.teamBadge}
      style={{ background: team.color, width: size, height: size, fontSize: Math.round(size * 0.34) }}
    >
      {team.abbr}
    </span>
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

const POSITIONS        = ['Setter', 'Middle', 'Outside', 'Opposite', 'Universal'];
const ROSTER_POSITIONS = ['Setter', 'Middle', 'Outside', 'Opposite', 'Libero', 'Universal'];
const COMMANDS         = ['Step Left', 'Half Step Left', 'Leave both Lines', 'Half Step Right', 'Step Right'];

// Which tabs get auto-populated when a roster player is added
const AUTO_TABS = {
  Setter:    ['servers', 'setters'],
  Middle:    ['servers', 'spikers'],
  Outside:   ['servers', 'spikers'],
  Opposite:  ['servers', 'spikers'],
  Libero:    ['servers'],
  Universal: ['servers', 'spikers'],
};
const ZONES     = ['1', '2', '3', '4', '5', '6'];

const COMMAND_COLORS = {
  'Step Left':        { bg: '#dbeafe', color: '#1d4ed8' },
  'Half Step Left':   { bg: '#eff6ff', color: '#3b82f6' },
  'Leave both Lines': { bg: '#dcfce7', color: '#15803d' },
  'Half Step Right':  { bg: '#fff7ed', color: '#ea580c' },
  'Step Right':       { bg: '#ffedd5', color: '#c2410c' },
};

const POSITION_COLORS = {
  'Setter':    { bg: '#f3e8ff', color: '#7e22ce' },
  'Middle':    { bg: '#dbeafe', color: '#1d4ed8' },
  'Outside':   { bg: '#dcfce7', color: '#15803d' },
  'Opposite':  { bg: '#fee2e2', color: '#dc2626' },
  'Libero':    { bg: '#fefce8', color: '#a16207' },
  'Universal': { bg: '#f3f4f6', color: '#374151' },
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

// ── Roster modal ─────────────────────────────────────────────────────────────

function RosterModal({ note, lang, onSave, onClose }) {
  const isNew = !note?.id;
  const [form, setForm] = useState({
    title:       note?.title       ?? '',
    jersey:      note?.jersey      ?? '',
    position:    note?.position    ?? '',
    age:         note?.age         ?? '',
    nationality: note?.nationality ?? '',
    body:        note?.body        ?? '',
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
              <select className={styles.modalSelect} value={form.position} onChange={e => set('position', e.target.value)}>
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

          <label className={styles.label}>{tr('notes', lang)}</label>
          <textarea className={styles.modalTextarea} value={form.body} onChange={e => set('body', e.target.value)} rows={3} />

        </div>
        <div className={styles.modalFooter}>
          {isNew && form.position && (
            <span className={styles.autoCreateHint}>
              {lang === 'ja'
                ? `保存すると ${(AUTO_TABS[form.position] ?? []).join(', ')} に自動追加されます`
                : `Will also add to: ${(AUTO_TABS[form.position] ?? []).join(', ')}`}
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
  const cols = [
    { key: 'jersey',      label: '#'           },
    { key: 'title',       label: 'Name'        },
    { key: 'position',    label: 'Position'    },
    { key: 'age',         label: 'Age'         },
    { key: 'nationality', label: 'Nationality' },
    { key: 'body',        label: 'Notes'       },
  ];

  return (
    <div className={styles.serverTableWrap}>
      <table className={styles.serverTable}>
        <thead>
          <tr>
            {cols.map(c => <th key={c.key} className={styles.serverTh}>{c.label}</th>)}
            <th className={styles.serverTh} />
          </tr>
        </thead>
        <tbody>
          {players.map(p => (
            <tr key={p.id} className={styles.serverTr} onClick={() => onEdit(p)}>
              {cols.map(c => {
                const val = p[c.key];
                let content = val || '—';
                if (c.key === 'position' && val) {
                  const col = POSITION_COLORS[val];
                  if (col) content = <span className={styles.tacChip} style={{ background: col.bg, color: col.color }}>{val}</span>;
                }
                return (
                  <td key={c.key} className={`${styles.serverTd} ${c.key === 'body' ? styles.serverTdWrap : ''}`}>
                    {content}
                  </td>
                );
              })}
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

// ── Server modal ──────────────────────────────────────────────────────────────

function ServerModal({ note, lang, onSave, onClose }) {
  const isNew = !note?.id;
  const [form, setForm] = useState({
    title:           note?.title           ?? '',
    jersey:          note?.jersey          ?? '',
    position:        note?.position        ?? '',
    starting_zone:   note?.starting_zone   ?? '',
    typ:             note?.typ             ?? '',
    command:         note?.command         ?? '',
    best_serve_zone: note?.best_serve_zone ?? '',
    info1:           note?.info1           ?? '',
    info2:           note?.info2           ?? '',
    after_to:        note?.after_to        ?? '',
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
      <div className={styles.modal} style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
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
              <select className={styles.modalSelect} value={form.position} onChange={e => set('position', e.target.value)}>
                <option value="">—</option>
                {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('startingZone', lang)}</label>
              <select className={styles.modalSelect} value={form.starting_zone} onChange={e => set('starting_zone', e.target.value)}>
                <option value="">—</option>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('bestServeZone', lang)}</label>
              <select className={styles.modalSelect} value={form.best_serve_zone} onChange={e => set('best_serve_zone', e.target.value)}>
                <option value="">—</option>
                {ZONES.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('typ', lang)}</label>
              <input className={styles.modalInput} value={form.typ} onChange={e => set('typ', e.target.value)} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('command', lang)}</label>
              <select className={styles.modalSelect} value={form.command} onChange={e => set('command', e.target.value)}>
                <option value="">—</option>
                {COMMANDS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

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
    { key: 'best_serve_zone', label: 'Best Serve Zone' },
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
    if (key === 'command')        return chip(COMMAND_COLORS, value);
    if (key === 'position')       return chip(POSITION_COLORS, value);
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
            {cols.map(c => <th key={c.key} className={styles.serverTh}>{c.label}</th>)}
            <th className={styles.serverTh} />
          </tr>
        </thead>
        <tbody>
          {servers.map(s => (
            <tr key={s.id} className={styles.serverTr} onClick={() => onEdit(s)}>
              {cols.map(c => (
                <td key={c.key} className={styles.serverTd}>{renderCell(c.key, s[c.key])}</td>
              ))}
              <td className={styles.serverTd} onClick={e => e.stopPropagation()}>
                <button className={styles.noteDupBtn} title="Duplicate row" onClick={() => onDuplicate(s)}>⧉</button>
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
    title:  note?.title  ?? '',
    body:   note?.body   ?? '',
    url:    note?.url    ?? '',
    jersey: note?.jersey ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (isPlayer && !form.title.trim())                  { setErr(tr('required', lang)); return; }
    if (isVideo  && !form.url.trim())                    { setErr(tr('required', lang)); return; }
    if (!isPlayer && !isVideo && !form.body.trim())      { setErr(tr('required', lang)); return; }
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
          {(note.title || note.jersey) && (
            <div className={styles.noteCardHeader}>
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

// ── Main component ────────────────────────────────────────────────────────────

export default function Tactics({ lang = 'en', profile }) {
  const [teams,          setTeams]          = useState([]);
  const [notes,          setNotes]          = useState([]);
  const [selectedTeam,   setSelectedTeam]   = useState(null);
  const [activeCategory, setActiveCategory] = useState('scouting');
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [teamModal,      setTeamModal]      = useState(null);
  const [noteModal,      setNoteModal]      = useState(null);
  const [notesLoading,   setNotesLoading]   = useState(false);

  const authorName = profile?.display_name || profile?.email?.split('@')[0] || '';

  useEffect(() => {
    supabase.from('tactics_teams').select('*').order('sort_order').order('name')
      .then(({ data, error: err }) => {
        if (err) setError(err.message);
        else {
          const list = data ?? [];
          setTeams(list);
          if (list.length > 0) setSelectedTeam(list[0]);
        }
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!selectedTeam) return;
    setNotesLoading(true);
    supabase.from('tactics_notes').select('*')
      .eq('team_id', selectedTeam.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (data) setNotes(data); setNotesLoading(false); });
  }, [selectedTeam?.id]);

  // Realtime for notes
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
      setSelectedTeam(data);
    }
    setTeamModal(null);
  }, [teams.length, selectedTeam?.id]);

  const deleteTeam = useCallback(async (team) => {
    if (!confirm(`Delete ${team.name}?`)) return;
    await supabase.from('tactics_teams').delete().eq('id', team.id);
    setTeams(prev => {
      const next = prev.filter(t => t.id !== team.id);
      if (selectedTeam?.id === team.id) setSelectedTeam(next[0] ?? null);
      return next;
    });
  }, [selectedTeam?.id]);

  const saveNote = useCallback(async (form) => {
    const payload = {
      team_id:         selectedTeam.id,
      category:        activeCategory,
      title:           form.title           || null,
      body:            form.body            || null,
      url:             form.url             || null,
      jersey:          form.jersey          || null,
      position:        form.position        || null,
      age:             form.age             || null,
      nationality:     form.nationality     || null,
      starting_zone:   form.starting_zone   || null,
      typ:             form.typ             || null,
      command:         form.command         || null,
      best_serve_zone: form.best_serve_zone || null,
      info1:           form.info1           || null,
      info2:           form.info2           || null,
      after_to:        form.after_to        || null,
      author_name:     authorName,
      updated_at:      new Date().toISOString(),
    };

    if (form.id) {
      const { error: err } = await supabase.from('tactics_notes').update(payload).eq('id', form.id);
      if (err) { setError(err.message); return; }
      setNotes(prev => prev.map(n => n.id === form.id ? { ...n, ...payload, id: form.id } : n));
    } else {
      const { data, error: err } = await supabase.from('tactics_notes').insert(payload).select().single();
      if (err) { setError(err.message); return; }
      setNotes(prev => [data, ...prev]);

      // Auto-create entries in other tabs when adding a new roster player
      if (activeCategory === 'roster' && form.position) {
        const tabs = AUTO_TABS[form.position] ?? [];
        if (tabs.length > 0) {
          const autoRows = tabs.map(cat => ({
            team_id:     selectedTeam.id,
            category:    cat,
            title:       form.title  || null,
            jersey:      form.jersey || null,
            position:    form.position,
            author_name: authorName,
          }));
          const { data: autoData } = await supabase.from('tactics_notes').insert(autoRows).select();
          if (autoData) setNotes(prev => [...prev, ...autoData]);
        }
      }
    }
    setNoteModal(null);
  }, [selectedTeam?.id, activeCategory, authorName]);

  const deleteNote = useCallback(async (noteId) => {
    setNotes(prev => prev.filter(n => n.id !== noteId));
    await supabase.from('tactics_notes').delete().eq('id', noteId);
  }, []);

  const duplicateServer = useCallback(async (server) => {
    const { id, created_at, ...rest } = server;
    const payload = { ...rest, author_name: authorName, updated_at: new Date().toISOString() };
    const { data, error: err } = await supabase.from('tactics_notes').insert(payload).select().single();
    if (err) { setError(err.message); return; }
    setNotes(prev => [data, ...prev]);
  }, [authorName]);

  const isRoster   = activeCategory === 'roster';
  const isServer   = activeCategory === 'servers';
  const catNotesRaw = notes.filter(n => n.category === activeCategory);
  const catNotes    = (isRoster || isServer)
    ? [...catNotesRaw].sort((a, b) => (parseInt(a.jersey) || 999) - (parseInt(b.jersey) || 999))
    : catNotesRaw;
  const isPlayer   = PLAYER_CATS.has(activeCategory) && !isServer;
  const isVideo    = activeCategory === 'videos';
  const addLabel   = isRoster ? tr('addRoster', lang) : isServer ? tr('addServer', lang) : tr(isPlayer ? 'addPlayer' : isVideo ? 'addVideo' : 'addNote', lang);
  const emptyLabel = isRoster ? tr('noRoster', lang)  : isServer ? tr('noServers', lang) : tr(isPlayer ? 'noPlayers' : isVideo ? 'noVideos' : 'noNotes', lang);

  if (loading) return <div className={styles.loading}>{tr('loading', lang)}</div>;

  return (
    <div className={styles.wrapper}>
      {error && (
        <div className={styles.error}>{error}<button onClick={() => setError(null)}>✕</button></div>
      )}

      <div className={styles.layout}>

        {/* ── Team sidebar ── */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>{tr('tactics', lang)}</span>
          </div>
          <div className={styles.teamList}>
            {teams.map((team, i) => (
              <div key={team.id}>
                {i > 0 && team.sort_order - teams[i - 1].sort_order > 10 && (
                  <div className={styles.teamDivider} />
                )}
                <div
                  className={`${styles.teamRow} ${selectedTeam?.id === team.id ? styles.teamRowActive : ''}`}
                  onClick={() => { setSelectedTeam(team); setNotes([]); }}
                >
                  <TeamBadge team={team} size={26} />
                  <span className={styles.teamRowName}>{team.name}</span>
                  <div className={styles.teamRowActions}>
                    <button className={styles.teamActionBtn} onClick={e => { e.stopPropagation(); setTeamModal(team); }}>✏</button>
                    <button className={styles.teamActionBtn} onClick={e => { e.stopPropagation(); deleteTeam(team); }}>×</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className={styles.addTeamBtn} onClick={() => setTeamModal('new')}>
            + {tr('addTeam', lang)}
          </button>
        </aside>

        {/* ── Main content ── */}
        <div className={styles.content}>
          {!selectedTeam ? (
            <div className={styles.emptyState}>{tr('selectTeam', lang)}</div>
          ) : (
            <>
              <div className={styles.contentHeader}>
                <TeamBadge team={selectedTeam} size={38} />
                <h2 className={styles.contentTeamName}>{selectedTeam.name}</h2>
              </div>

              <div className={styles.categoryTabs}>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    className={`${styles.catTab} ${activeCategory === cat.id ? styles.catTabActive : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                  >
                    <span className={styles.catIcon}>{cat.icon}</span>
                    <span>{cat.label[lang]}</span>
                  </button>
                ))}
              </div>

              <div className={styles.noteArea}>
                {notesLoading ? (
                  <p className={styles.emptyNotes}>{tr('loading', lang)}</p>
                ) : isRoster ? (
                  <>
                    {catNotes.length === 0
                      ? <p className={styles.emptyNotes}>{emptyLabel}</p>
                      : <RosterTable players={catNotes} lang={lang} onEdit={n => setNoteModal(n)} onDelete={deleteNote} />
                    }
                  </>
                ) : isServer ? (
                  <>
                    {catNotes.length === 0
                      ? <p className={styles.emptyNotes}>{emptyLabel}</p>
                      : <ServerTable servers={catNotes} lang={lang} onEdit={n => setNoteModal(n)} onDelete={deleteNote} onDuplicate={duplicateServer} />
                    }
                  </>
                ) : catNotes.length === 0 ? (
                  <p className={styles.emptyNotes}>{emptyLabel}</p>
                ) : (
                  <div className={`${styles.noteGrid} ${isVideo ? styles.noteGridVideo : ''}`}>
                    {catNotes.map(note => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        category={activeCategory}
                        lang={lang}
                        onEdit={n => setNoteModal(n)}
                        onDelete={deleteNote}
                      />
                    ))}
                  </div>
                )}
                <button className={styles.addNoteBtn} onClick={() => setNoteModal('new')}>
                  {addLabel}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {teamModal && (
        <TeamModal
          team={teamModal === 'new' ? null : teamModal}
          lang={lang}
          onSave={saveTeam}
          onClose={() => setTeamModal(null)}
        />
      )}

      {noteModal && isRoster && (
        <RosterModal
          note={noteModal === 'new' ? null : noteModal}
          lang={lang}
          onSave={saveNote}
          onClose={() => setNoteModal(null)}
        />
      )}

      {noteModal && isServer && (
        <ServerModal
          note={noteModal === 'new' ? null : noteModal}
          lang={lang}
          onSave={saveNote}
          onClose={() => setNoteModal(null)}
        />
      )}

      {noteModal && !isRoster && !isServer && (
        <NoteModal
          note={noteModal === 'new' ? null : noteModal}
          category={activeCategory}
          lang={lang}
          onSave={saveNote}
          onClose={() => setNoteModal(null)}
        />
      )}
    </div>
  );
}
