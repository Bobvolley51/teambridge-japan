'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './VertDashboard.module.css';

// Thresholds from VERT legend (OH/M volleyball category)
const T = {
  jumps:             { low: 90,   mid: 120,  inv: false },
  avg_hi_jump_cm:    { low: 40,   mid: 50,   inv: false },
  jpam:              { low: 0.7,  mid: 1.2,  inv: false },
  avg_hi_jump_power: { low: 40,   mid: 55,   inv: false },
  energy:            { low: 4500, mid: 6500, inv: false },
  sets_by_energy:    { low: 2,    mid: 5,    inv: false },
  intensity:         { low: 55,   mid: 90,   inv: false },
  high_impact_pct:   { low: 10,   mid: 20,   inv: true  },
  alert_impact_pct:  { low: 5,    mid: 10,   inv: true  },
  elevated_pct:      { low: 10,   mid: 20,   inv: true  },
};

function cellColor(field, value) {
  const t = T[field];
  if (!t || value == null) return '';
  const v = parseFloat(value);
  if (isNaN(v)) return '';
  const hi  = v >= t.mid;
  const mid = v >= t.low;
  if (t.inv) return hi ? styles.red : mid ? styles.amber : styles.green;
  return hi ? styles.green : mid ? styles.amber : styles.red;
}

const NUMERIC_FIELDS = [
  'jumps', 'avg_hi_jump_cm', 'jpam', 'avg_hi_jump_power',
  'high_impact_pct', 'alert_impact_pct', 'elevated_pct',
  'energy', 'sets_by_energy', 'intensity',
];

const DECIMAL_FIELDS = new Set(['avg_hi_jump_cm', 'jpam', 'avg_hi_jump_power', 'sets_by_energy']);

const EMPTY_ROW = () => ({
  vert_name: '', user_id: '',
  jumps: '', avg_hi_jump_cm: '', jpam: '', avg_hi_jump_power: '',
  high_impact_pct: '', alert_impact_pct: '', elevated_pct: '',
  energy: '', sets_by_energy: '', intensity: '',
});

const MAP_KEY = 'vert_name_map';
const loadMap  = () => { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch { return {}; } };
const saveMap  = m  => localStorage.setItem(MAP_KEY, JSON.stringify(m));

function avg(arr, field) {
  const vals = arr.map(s => s[field]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function fmt(val, field) {
  if (val == null) return '—';
  const dec = DECIMAL_FIELDS.has(field) ? 1 : 0;
  return val.toFixed(dec);
}

export default function VertDashboard({ lang, profile }) {
  const [view,        setView]        = useState('stats');
  const [players,     setPlayers]     = useState([]);
  const [sessions,    setSessions]    = useState([]);
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows,        setRows]        = useState(() => [EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
  const [timeRange,   setTimeRange]   = useState('7d');
  const [saving,      setSaving]      = useState(false);
  const [savedMsg,    setSavedMsg]    = useState('');

  const isJa      = lang === 'ja';
  const canUpload = ['Headcoach', 'Athletic', 'Staff/Orga', 'GM'].includes(profile?.role);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name')
      .eq('role', 'Player').order('display_name')
      .then(({ data }) => setPlayers(data || []));
    loadSessions();
  }, []);

  async function loadSessions() {
    const { data } = await supabase
      .from('vert_sessions')
      .select('*')
      .order('session_date', { ascending: false });
    setSessions(data || []);
  }

  function autoMatchPlayer(vertName) {
    // 1. Saved mapping takes priority
    const saved = loadMap()[vertName.trim().toLowerCase()];
    if (saved) return saved;
    // 2. Try last-name match against app player display names
    const lower = vertName.trim().toLowerCase();
    const match = players.find(p => {
      const parts = p.display_name.toLowerCase().split(/\s+/);
      return parts.some(part => part === lower);
    });
    return match?.id || '';
  }

  function handleRowChange(idx, field, val) {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'vert_name' && val) {
        const matched = autoMatchPlayer(val);
        if (matched) next[idx] = { ...next[idx], user_id: matched };
      }
      return next;
    });
  }

  async function handleSave() {
    const valid = rows.filter(r => r.vert_name && r.jumps);
    if (!sessionName || !sessionDate || !valid.length) return;
    setSaving(true);

    const map = loadMap();
    valid.forEach(r => { if (r.vert_name && r.user_id) map[r.vert_name.trim().toLowerCase()] = r.user_id; });
    saveMap(map);

    await supabase.from('vert_sessions').insert(
      valid.map(r => ({
        session_name:      sessionName,
        session_date:      sessionDate,
        vert_name:         r.vert_name,
        user_id:           r.user_id || null,
        jumps:             parseInt(r.jumps)             || null,
        avg_hi_jump_cm:    parseFloat(r.avg_hi_jump_cm)  || null,
        jpam:              parseFloat(r.jpam)             || null,
        avg_hi_jump_power: parseFloat(r.avg_hi_jump_power)|| null,
        high_impact_pct:   parseInt(r.high_impact_pct)   || null,
        alert_impact_pct:  parseInt(r.alert_impact_pct)  || null,
        elevated_pct:      parseInt(r.elevated_pct)      || null,
        energy:            parseInt(r.energy)             || null,
        sets_by_energy:    parseFloat(r.sets_by_energy)  || null,
        intensity:         parseInt(r.intensity)          || null,
        uploaded_by:       profile?.id,
      }))
    );

    setSaving(false);
    setSavedMsg(isJa ? '保存しました ✓' : 'Saved ✓');
    setTimeout(() => setSavedMsg(''), 3000);
    setRows([EMPTY_ROW(), EMPTY_ROW(), EMPTY_ROW()]);
    setSessionName('');
    await loadSessions();
    setView('stats');
  }

  // Build filtered + aggregated stats
  const now = new Date();
  const cutoff = {
    '7d':  new Date(now - 7  * 86400000).toISOString().slice(0, 10),
    '14d': new Date(now - 14 * 86400000).toISOString().slice(0, 10),
    'all': '2000-01-01',
  };

  let filtered = sessions;
  if (timeRange === 'last') {
    const lastDate = sessions[0]?.session_date;
    filtered = lastDate ? sessions.filter(s => s.session_date === lastDate) : [];
  } else {
    filtered = sessions.filter(s => s.session_date >= cutoff[timeRange]);
  }

  const byPlayer = {};
  for (const s of filtered) {
    const key = s.user_id || s.vert_name;
    if (!byPlayer[key]) byPlayer[key] = { rows: [], vert_name: s.vert_name, user_id: s.user_id };
    byPlayer[key].rows.push(s);
  }

  const statsRows = Object.values(byPlayer).map(p => {
    const player = players.find(pl => pl.id === p.user_id);
    return {
      name:    player?.display_name || p.vert_name,
      count:   p.rows.length,
      ...Object.fromEntries(NUMERIC_FIELDS.map(f => [f, avg(p.rows, f)])),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  const STAT_COLS = [
    { key: 'jumps',             label: 'Jumps',       unit: ''   },
    { key: 'avg_hi_jump_cm',    label: 'Hi Jump',     unit: ' cm'},
    { key: 'jpam',              label: 'JPAM',        unit: ''   },
    { key: 'avg_hi_jump_power', label: 'Jump Power',  unit: ''   },
    { key: 'high_impact_pct',   label: 'Hi Impact',   unit: '%'  },
    { key: 'alert_impact_pct',  label: 'Alert',       unit: '%'  },
    { key: 'elevated_pct',      label: 'Elevated',    unit: '%'  },
    { key: 'energy',            label: 'Energy',      unit: ''   },
    { key: 'sets_by_energy',    label: 'Sets',        unit: ''   },
    { key: 'intensity',         label: 'Intensity',   unit: ''   },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2 className={styles.title}>
          <span className={styles.vertBadge}>VERT</span>
          {isJa ? ' ジャンプデータ' : ' Jump Data'}
        </h2>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${view === 'stats'  ? styles.tabActive : ''}`} onClick={() => setView('stats')}>
            {isJa ? '統計' : 'Statistics'}
          </button>
          {canUpload && (
            <button className={`${styles.tab} ${view === 'upload' ? styles.tabActive : ''}`} onClick={() => setView('upload')}>
              {isJa ? 'アップロード' : 'Upload Session'}
            </button>
          )}
        </div>
      </div>

      {/* ── STATISTICS VIEW ─────────────────────────────── */}
      {view === 'stats' && (
        <div className={styles.statsView}>
          <div className={styles.rangeBar}>
            {[
              ['last', isJa ? '最新' : 'Last Session'],
              ['7d',   '7 days'],
              ['14d',  '14 days'],
              ['all',  isJa ? '全期間' : 'All time'],
            ].map(([k, label]) => (
              <button key={k}
                className={`${styles.rangeBtn} ${timeRange === k ? styles.rangeBtnActive : ''}`}
                onClick={() => setTimeRange(k)}>
                {label}
              </button>
            ))}
          </div>

          {statsRows.length === 0 ? (
            <div className={styles.empty}>
              {isJa
                ? 'データなし。セッションをアップロードしてください。'
                : 'No data yet. Upload a session to get started.'}
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thSticky}>{isJa ? '選手' : 'Player'}</th>
                    <th className={styles.thNum} title="Sessions">{isJa ? 'セッション' : 'Sessions'}</th>
                    {STAT_COLS.map(c => (
                      <th key={c.key} className={styles.thNum}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {statsRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? styles.trEven : ''}>
                      <td className={styles.tdSticky}>{row.name}</td>
                      <td className={styles.tdCenter}>{row.count}</td>
                      {STAT_COLS.map(c => (
                        <td key={c.key} className={`${styles.tdCenter} ${cellColor(c.key, row[c.key])}`}>
                          {fmt(row[c.key], c.key)}{row[c.key] != null ? c.unit : ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.legend}>
            <span className={styles.lgGreen}>{isJa ? '高' : 'High'}</span>
            <span className={styles.lgAmber}>{isJa ? '中' : 'Med'}</span>
            <span className={styles.lgRed}>{isJa ? '低' : 'Low'}</span>
            <span className={styles.lgNote}>· {isJa ? '着地衝撃は逆スケール' : 'Landing impact: inverted scale'}</span>
          </div>
        </div>
      )}

      {/* ── UPLOAD VIEW ─────────────────────────────────── */}
      {view === 'upload' && canUpload && (
        <div className={styles.uploadView}>
          <div className={styles.sessionMeta}>
            <label className={styles.metaLabel}>{isJa ? 'セッション名' : 'Session name'}</label>
            <input className={styles.metaInput} value={sessionName}
              placeholder="Practice - 1"
              onChange={e => setSessionName(e.target.value)} />
            <label className={styles.metaLabel}>{isJa ? '日付' : 'Date'}</label>
            <input className={styles.metaInput} type="date" value={sessionDate}
              onChange={e => setSessionDate(e.target.value)} />
          </div>

          <p className={styles.uploadHint}>
            {isJa
              ? 'VERTレポートの各選手のデータを入力してください。VERT名は保存され、次回以降は自動的にマッチングされます。'
              : 'Enter each player\'s data from the VERT report. VERT names are remembered for future uploads.'}
          </p>

          <div className={styles.tableScroll}>
            <table className={styles.uploadTable}>
              <thead>
                <tr>
                  <th className={styles.thVertName}>VERT Name</th>
                  <th className={styles.thPlayer}>{isJa ? 'アプリ選手' : 'App Player'}</th>
                  <th>Jumps</th>
                  <th>Hi Jump cm</th>
                  <th>JPAM</th>
                  <th>Jump Power</th>
                  <th>Hi Impact%</th>
                  <th>Alert%</th>
                  <th>Elevated%</th>
                  <th>Energy</th>
                  <th>Sets</th>
                  <th>Intensity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input className={styles.cellInput} value={row.vert_name}
                        placeholder="Yamamoto"
                        onChange={e => handleRowChange(idx, 'vert_name', e.target.value)} />
                    </td>
                    <td>
                      <select className={styles.cellSelect} value={row.user_id}
                        onChange={e => handleRowChange(idx, 'user_id', e.target.value)}>
                        <option value="">— unlinked —</option>
                        {players.map(p => (
                          <option key={p.id} value={p.id}>{p.display_name}</option>
                        ))}
                      </select>
                    </td>
                    {NUMERIC_FIELDS.map(field => (
                      <td key={field}>
                        <input className={styles.cellInput}
                          type="number"
                          value={row[field]}
                          placeholder="—"
                          step={DECIMAL_FIELDS.has(field) ? '0.1' : '1'}
                          onChange={e => handleRowChange(idx, field, e.target.value)} />
                      </td>
                    ))}
                    <td>
                      <button className={styles.removeBtn} onClick={() => setRows(r => r.filter((_, i) => i !== idx))}>×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.uploadActions}>
            <button className={styles.addRowBtn}
              onClick={() => setRows(r => [...r, EMPTY_ROW()])}>
              + {isJa ? '行追加' : 'Add row'}
            </button>
            <div className={styles.actionsRight}>
              {savedMsg && <span className={styles.savedMsg}>{savedMsg}</span>}
              <button className={styles.saveBtn}
                disabled={saving || !sessionName || !rows.some(r => r.vert_name && r.jumps)}
                onClick={handleSave}>
                {saving ? '…' : (isJa ? '保存する' : 'Save Session')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
