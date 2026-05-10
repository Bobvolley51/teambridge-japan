'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './VertDashboard.module.css';

// Thresholds from VERT legend (OH/M volleyball)
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
  const hi = v >= t.mid, mid = v >= t.low;
  if (t.inv) return hi ? styles.red : mid ? styles.amber : styles.green;
  return hi ? styles.green : mid ? styles.amber : styles.red;
}

const NUMERIC_FIELDS = [
  'jumps', 'avg_hi_jump_cm', 'jpam', 'avg_hi_jump_power',
  'high_impact_pct', 'alert_impact_pct', 'elevated_pct',
  'energy', 'sets_by_energy', 'intensity',
];
const DECIMAL_FIELDS = new Set(['avg_hi_jump_cm', 'jpam', 'avg_hi_jump_power', 'sets_by_energy']);

const STAT_COLS = [
  { key: 'jumps',             label: 'Jumps',      unit: ''   },
  { key: 'avg_hi_jump_cm',    label: 'Hi Jump',    unit: ' cm'},
  { key: 'jpam',              label: 'JPAM',       unit: ''   },
  { key: 'avg_hi_jump_power', label: 'Jump Power', unit: ''   },
  { key: 'high_impact_pct',   label: 'Hi Impact',  unit: '%'  },
  { key: 'alert_impact_pct',  label: 'Alert',      unit: '%'  },
  { key: 'elevated_pct',      label: 'Elevated',   unit: '%'  },
  { key: 'energy',            label: 'Energy',     unit: ''   },
  { key: 'sets_by_energy',    label: 'Sets',       unit: ''   },
  { key: 'intensity',         label: 'Intensity',  unit: ''   },
];

const MAP_KEY  = 'vert_name_map';
const loadMap  = () => { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch { return {}; } };
const saveMap  = m  => localStorage.setItem(MAP_KEY, JSON.stringify(m));

function avgField(arr, field) {
  const vals = arr.map(s => s[field]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function fmt(val, field) {
  if (val == null) return '—';
  return val.toFixed(DECIMAL_FIELDS.has(field) ? 1 : 0);
}

export default function VertDashboard({ lang, profile }) {
  const [view,       setView]       = useState('stats');
  const [players,    setPlayers]    = useState([]);
  const [sessions,   setSessions]   = useState([]);
  const [timeRange,  setTimeRange]  = useState('7d');

  // Upload flow state
  const [uploadState, setUploadState] = useState('idle');  // 'idle' | 'parsing' | 'review'
  const [parseError,  setParseError]  = useState('');
  const [sessionName, setSessionName] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [rows,        setRows]        = useState([]);
  const [saving,      setSaving]      = useState(false);
  const [savedMsg,    setSavedMsg]    = useState('');
  const [dragOver,    setDragOver]    = useState(false);
  const fileInputRef = useRef();

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
      .from('vert_sessions').select('*')
      .order('session_date', { ascending: false });
    setSessions(data || []);
  }

  function autoMatchPlayer(vertName, playerList) {
    const saved = loadMap()[vertName.trim().toLowerCase()];
    if (saved) return saved;
    const lower = vertName.trim().toLowerCase();
    const match = playerList.find(p =>
      p.display_name.toLowerCase().split(/\s+/).some(part => part === lower)
    );
    return match?.id || '';
  }

  async function handleFile(file) {
    if (!file || file.type !== 'application/pdf') {
      setParseError(isJa ? 'PDFファイルを選択してください' : 'Please select a PDF file');
      return;
    }
    setParseError('');
    setUploadState('parsing');

    const form = new FormData();
    form.append('file', file);

    try {
      const res  = await fetch('/api/parse-vert', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok || data.error) {
        setParseError(data.error || 'Parse failed');
        setUploadState('idle');
        return;
      }

      // Build rows, auto-matching player names against current players list
      const mappedRows = (data.players || []).map(p => ({
        vert_name:         p.vert_name   ?? '',
        user_id:           autoMatchPlayer(p.vert_name ?? '', players),
        jumps:             p.jumps             ?? '',
        avg_hi_jump_cm:    p.avg_hi_jump_cm    ?? '',
        jpam:              p.jpam              ?? '',
        avg_hi_jump_power: p.avg_hi_jump_power ?? '',
        high_impact_pct:   p.high_impact_pct   ?? '',
        alert_impact_pct:  p.alert_impact_pct  ?? '',
        elevated_pct:      p.elevated_pct      ?? '',
        energy:            p.energy            ?? '',
        sets_by_energy:    p.sets_by_energy    ?? '',
        intensity:         p.intensity         ?? '',
      }));

      setSessionName(data.session_name || '');
      setSessionDate(data.session_date || new Date().toISOString().slice(0, 10));
      setRows(mappedRows);
      setUploadState('review');
    } catch (err) {
      setParseError(err.message || 'Network error');
      setUploadState('idle');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }

  function handleRowChange(idx, field, val) {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      if (field === 'vert_name' && val) {
        const matched = autoMatchPlayer(val, players);
        if (matched) next[idx] = { ...next[idx], user_id: matched };
      }
      return next;
    });
  }

  async function handleSave() {
    const valid = rows.filter(r => r.vert_name);
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
        jumps:             r.jumps             !== '' ? parseInt(r.jumps)              : null,
        avg_hi_jump_cm:    r.avg_hi_jump_cm    !== '' ? parseFloat(r.avg_hi_jump_cm)   : null,
        jpam:              r.jpam              !== '' ? parseFloat(r.jpam)              : null,
        avg_hi_jump_power: r.avg_hi_jump_power !== '' ? parseFloat(r.avg_hi_jump_power): null,
        high_impact_pct:   r.high_impact_pct   !== '' ? parseInt(r.high_impact_pct)    : null,
        alert_impact_pct:  r.alert_impact_pct  !== '' ? parseInt(r.alert_impact_pct)   : null,
        elevated_pct:      r.elevated_pct      !== '' ? parseInt(r.elevated_pct)       : null,
        energy:            r.energy            !== '' ? parseInt(r.energy)             : null,
        sets_by_energy:    r.sets_by_energy    !== '' ? parseFloat(r.sets_by_energy)   : null,
        intensity:         r.intensity         !== '' ? parseInt(r.intensity)          : null,
        uploaded_by:       profile?.id,
      }))
    );

    setSaving(false);
    setSavedMsg(isJa ? '保存しました ✓' : 'Saved ✓');
    setTimeout(() => setSavedMsg(''), 3000);
    setUploadState('idle');
    setRows([]);
    setSessionName('');
    await loadSessions();
    setView('stats');
  }

  // Stats computation
  const now = new Date();
  const cutoff = {
    '7d':  new Date(+now - 7  * 86400000).toISOString().slice(0, 10),
    '14d': new Date(+now - 14 * 86400000).toISOString().slice(0, 10),
    'all': '2000-01-01',
  };
  let filtered = sessions;
  if (timeRange === 'last') {
    const ld = sessions[0]?.session_date;
    filtered = ld ? sessions.filter(s => s.session_date === ld) : [];
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
      name:  player?.display_name || p.vert_name,
      count: p.rows.length,
      ...Object.fromEntries(NUMERIC_FIELDS.map(f => [f, avgField(p.rows, f)])),
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

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
            <button className={`${styles.tab} ${view === 'upload' ? styles.tabActive : ''}`} onClick={() => { setView('upload'); setUploadState('idle'); }}>
              {isJa ? 'アップロード' : 'Upload Session'}
            </button>
          )}
        </div>
      </div>

      {/* ── STATISTICS ─────────────────────────────────────── */}
      {view === 'stats' && (
        <div>
          <div className={styles.rangeBar}>
            {[['last', isJa ? '最新' : 'Last Session'], ['7d', '7 days'], ['14d', '14 days'], ['all', isJa ? '全期間' : 'All time']].map(([k, label]) => (
              <button key={k} className={`${styles.rangeBtn} ${timeRange === k ? styles.rangeBtnActive : ''}`} onClick={() => setTimeRange(k)}>
                {label}
              </button>
            ))}
          </div>

          {statsRows.length === 0 ? (
            <div className={styles.empty}>
              {isJa ? 'データなし。セッションをアップロードしてください。' : 'No data yet. Upload a session to get started.'}
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thSticky}>{isJa ? '選手' : 'Player'}</th>
                    <th className={styles.thNum}>{isJa ? 'n' : 'n'}</th>
                    {STAT_COLS.map(c => <th key={c.key} className={styles.thNum}>{c.label}</th>)}
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

      {/* ── UPLOAD: DROP ZONE ──────────────────────────────── */}
      {view === 'upload' && canUpload && uploadState === 'idle' && (
        <div className={styles.uploadView}>
          <div
            className={`${styles.dropZone} ${dragOver ? styles.dropZoneOver : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}>
            <div className={styles.dropIcon}>📄</div>
            <div className={styles.dropTitle}>
              {isJa ? 'VERT Session Report PDF をドロップ' : 'Drop the VERT Session Report PDF here'}
            </div>
            <div className={styles.dropSub}>
              {isJa ? 'またはクリックしてファイルを選択' : 'or click to browse'}
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" className={styles.fileHidden}
              onChange={e => handleFile(e.target.files[0])} />
          </div>
          {parseError && <div className={styles.parseError}>{parseError}</div>}
        </div>
      )}

      {/* ── UPLOAD: PARSING ────────────────────────────────── */}
      {view === 'upload' && canUpload && uploadState === 'parsing' && (
        <div className={styles.parsingState}>
          <div className={styles.spinner} />
          <div className={styles.parsingText}>
            {isJa ? 'PDFを解析中…' : 'Reading PDF…'}
          </div>
        </div>
      )}

      {/* ── UPLOAD: REVIEW ─────────────────────────────────── */}
      {view === 'upload' && canUpload && uploadState === 'review' && (
        <div className={styles.uploadView}>
          <div className={styles.reviewHeader}>
            <div className={styles.sessionMetaRow}>
              <label className={styles.metaLabel}>{isJa ? 'セッション名' : 'Session'}</label>
              <input className={styles.metaInput} value={sessionName}
                onChange={e => setSessionName(e.target.value)} />
              <label className={styles.metaLabel}>{isJa ? '日付' : 'Date'}</label>
              <input className={styles.metaInput} type="date" value={sessionDate}
                onChange={e => setSessionDate(e.target.value)} />
            </div>
            <p className={styles.reviewHint}>
              {isJa
                ? 'PDFから読み取ったデータです。選手の紐付けを確認して「保存」してください。'
                : 'Data read from PDF. Check the player links then save.'}
            </p>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.uploadTable}>
              <thead>
                <tr>
                  <th className={styles.thVertName}>VERT Name</th>
                  <th className={styles.thPlayer}>{isJa ? 'アプリ選手' : 'Player'}</th>
                  <th>Jumps</th><th>Hi Jump cm</th><th>JPAM</th><th>Jump Power</th>
                  <th>Hi Impact%</th><th>Alert%</th><th>Elevated%</th>
                  <th>Energy</th><th>Sets</th><th>Intensity</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx} className={row.user_id ? '' : styles.trUnlinked}>
                    <td>
                      <input className={styles.cellInput} value={row.vert_name}
                        onChange={e => handleRowChange(idx, 'vert_name', e.target.value)} />
                    </td>
                    <td>
                      <select className={`${styles.cellSelect} ${row.user_id ? styles.cellSelectLinked : ''}`}
                        value={row.user_id}
                        onChange={e => handleRowChange(idx, 'user_id', e.target.value)}>
                        <option value="">— unlinked —</option>
                        {players.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                      </select>
                    </td>
                    {NUMERIC_FIELDS.map(field => (
                      <td key={field}>
                        <input className={styles.cellInput} type="number" value={row[field] ?? ''}
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

          {rows.some(r => !r.user_id) && (
            <div className={styles.unlinkWarn}>
              {isJa
                ? '⚠ 紐付けされていない選手がいます。後でマッピングを設定することもできます。'
                : '⚠ Some players are unlinked. You can link them later by re-uploading.'}
            </div>
          )}

          <div className={styles.uploadActions}>
            <button className={styles.cancelBtn} onClick={() => setUploadState('idle')}>
              {isJa ? '← 戻る' : '← Back'}
            </button>
            <div className={styles.actionsRight}>
              {savedMsg && <span className={styles.savedMsg}>{savedMsg}</span>}
              <button className={styles.saveBtn}
                disabled={saving || !sessionName || rows.length === 0}
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
