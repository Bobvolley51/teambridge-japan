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
  // sessions: [{ sessionName, sessionDate, rows, fileName }]
  const [uploadState,   setUploadState]   = useState('idle'); // 'idle'|'parsing'|'review'
  const [parseError,    setParseError]    = useState('');
  const [parsedSessions,setParsedSessions]= useState([]);     // multi-session review
  const [activeSession, setActiveSession] = useState(0);      // which session tab is open
  const [saving,        setSaving]        = useState(false);
  const [savedMsg,      setSavedMsg]      = useState('');
  const [dragOver,      setDragOver]      = useState(false);
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
    try {
      if (!vertName) return '';
      const key  = String(vertName).trim().toLowerCase();
      if (!key) return '';
      const saved = loadMap()[key];
      if (saved) return saved;
      const match = (playerList || []).find(p => {
        if (!p?.display_name) return false;
        return String(p.display_name).trim().toLowerCase().split(/\s+/).some(part => part === key);
      });
      return match?.id || '';
    } catch {
      return '';
    }
  }

  async function parseOneFile(file) {
    const form = new FormData();
    form.append('file', file);
    const res  = await fetch('/api/parse-vert', { method: 'POST', body: form });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Parse failed');
    return data;
  }

  function buildRows(playerData, playerList) {
    return (playerData || []).map(p => ({
      vert_name:         p.vert_name         ?? '',
      user_id:           autoMatchPlayer(p.vert_name ?? '', playerList),
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
  }

  async function handleFiles(fileList) {
    const files = [...fileList].filter(f => f.type === 'application/pdf');
    if (!files.length) {
      setParseError(isJa ? 'PDFファイルを選択してください' : 'Please select PDF files');
      return;
    }
    setParseError('');
    setUploadState('parsing');

    try {
      const results = await Promise.all(files.map(parseOneFile));

      // Check for missing API key
      const noKey = results.find(r => r.error === 'NO_API_KEY');
      if (noKey) {
        setParseError(isJa
          ? 'PDFの解析にはANTHROPIC_API_KEYが必要です。VercelのEnvironment Variablesに追加してください（1回のアップロードは約0.2円）。'
          : 'PDF parsing requires an Anthropic API key (~$0.002/upload). Add ANTHROPIC_API_KEY in your Vercel project → Settings → Environment Variables, then redeploy.');
        setUploadState('idle');
        return;
      }

      const successful = results.filter(r => r.players?.length > 0);

      if (!successful.length) {
        setParseError(isJa
          ? 'データが見つかりませんでした。VERT Session Report PDFを使用してください（Coach Reportではなく）。'
          : 'No player data found. Use the VERT Session Report PDF, not the Coach Report.');
        setUploadState('idle');
        return;
      }

      setParsedSessions(successful.map((data, i) => ({
        fileName:    files[i]?.name || `Session ${i + 1}`,
        sessionName: data.session_name || '',
        sessionDate: data.session_date || new Date().toISOString().slice(0, 10),
        rows:        buildRows(data.players, players),
      })));
      setActiveSession(0);
      setUploadState('review');
    } catch (err) {
      setParseError(err.message || 'Network error');
      setUploadState('idle');
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function updateSession(sIdx, field, val) {
    setParsedSessions(prev => prev.map((s, i) => i === sIdx ? { ...s, [field]: val } : s));
  }

  function updateRow(sIdx, rIdx, field, val) {
    setParsedSessions(prev => prev.map((s, i) => {
      if (i !== sIdx) return s;
      const rows = [...s.rows];
      rows[rIdx] = { ...rows[rIdx], [field]: val };
      if (field === 'vert_name' && val) {
        const matched = autoMatchPlayer(val, players);
        if (matched) rows[rIdx] = { ...rows[rIdx], user_id: matched };
      }
      return { ...s, rows };
    }));
  }

  function removeRow(sIdx, rIdx) {
    setParsedSessions(prev => prev.map((s, i) =>
      i === sIdx ? { ...s, rows: s.rows.filter((_, j) => j !== rIdx) } : s
    ));
  }

  async function handleSaveAll() {
    setSaving(true);
    const map = loadMap();

    for (const sess of parsedSessions) {
      const valid = sess.rows.filter(r => r.vert_name && r.user_id);
      if (!sess.sessionName || !sess.sessionDate || !valid.length) continue;

      valid.forEach(r => { if (r.vert_name && r.user_id) map[String(r.vert_name).trim().toLowerCase()] = r.user_id; });

      await supabase.from('vert_sessions').insert(
        valid.map(r => ({
          session_name:      sess.sessionName,
          session_date:      sess.sessionDate,
          vert_name:         r.vert_name,
          user_id:           r.user_id || null,
          jumps:             r.jumps             !== '' ? parseInt(r.jumps)               : null,
          avg_hi_jump_cm:    r.avg_hi_jump_cm    !== '' ? parseFloat(r.avg_hi_jump_cm)    : null,
          jpam:              r.jpam              !== '' ? parseFloat(r.jpam)               : null,
          avg_hi_jump_power: r.avg_hi_jump_power !== '' ? parseFloat(r.avg_hi_jump_power) : null,
          high_impact_pct:   r.high_impact_pct   !== '' ? parseInt(r.high_impact_pct)     : null,
          alert_impact_pct:  r.alert_impact_pct  !== '' ? parseInt(r.alert_impact_pct)    : null,
          elevated_pct:      r.elevated_pct      !== '' ? parseInt(r.elevated_pct)        : null,
          energy:            r.energy            !== '' ? parseInt(r.energy)              : null,
          sets_by_energy:    r.sets_by_energy    !== '' ? parseFloat(r.sets_by_energy)    : null,
          intensity:         r.intensity         !== '' ? parseInt(r.intensity)           : null,
          uploaded_by:       profile?.id,
        }))
      );
    }

    saveMap(map);
    setSaving(false);
    setSavedMsg(isJa ? `${parsedSessions.length}セッション保存しました ✓` : `${parsedSessions.length} session${parsedSessions.length > 1 ? 's' : ''} saved ✓`);
    setTimeout(() => setSavedMsg(''), 3000);
    setUploadState('idle');
    setParsedSessions([]);
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
  }).sort((a, b) => (a.name || '').localeCompare(b.name || ''));

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
              {isJa ? 'VERT Session Report PDF をドロップ' : 'Drop VERT Session Report PDFs here'}
            </div>
            <div className={styles.dropSub}>
              {isJa ? '複数ファイル可 · クリックして選択' : 'Multiple files supported · or click to browse'}
            </div>
            <input ref={fileInputRef} type="file" accept="application/pdf" multiple className={styles.fileHidden}
              onChange={e => handleFiles(e.target.files)} />
          </div>
          {parseError && <div className={styles.parseError}>{parseError}</div>}
        </div>
      )}

      {/* ── UPLOAD: PARSING ────────────────────────────────── */}
      {view === 'upload' && canUpload && uploadState === 'parsing' && (
        <div className={styles.parsingState}>
          <div className={styles.spinner} />
          <div className={styles.parsingText}>
            {isJa ? 'PDFを解析中…' : 'Reading PDFs…'}
          </div>
        </div>
      )}

      {/* ── UPLOAD: REVIEW (multi-session) ─────────────────── */}
      {view === 'upload' && canUpload && uploadState === 'review' && (
        <div className={styles.uploadView}>
          <p className={styles.reviewHint}>
            {isJa
              ? `${parsedSessions.length}件のセッションを読み込みました。選手の紐付けを確認して「すべて保存」してください。`
              : `${parsedSessions.length} session${parsedSessions.length > 1 ? 's' : ''} read. Check player links then save all.`}
          </p>

          {/* Session tabs */}
          {parsedSessions.length > 1 && (
            <div className={styles.sessionTabs}>
              {parsedSessions.map((s, i) => (
                <button key={i}
                  className={`${styles.sessionTab} ${activeSession === i ? styles.sessionTabActive : ''}`}
                  onClick={() => setActiveSession(i)}>
                  {s.sessionName || s.fileName}
                  {s.rows.some(r => !r.user_id) && <span className={styles.warnDot}>!</span>}
                </button>
              ))}
            </div>
          )}

          {parsedSessions.map((sess, sIdx) => sIdx !== activeSession ? null : (
            <div key={sIdx}>
              <div className={styles.sessionMetaRow}>
                <label className={styles.metaLabel}>{isJa ? 'セッション名' : 'Session'}</label>
                <input className={styles.metaInput} value={sess.sessionName}
                  onChange={e => updateSession(sIdx, 'sessionName', e.target.value)} />
                <label className={styles.metaLabel}>{isJa ? '日付' : 'Date'}</label>
                <input className={styles.metaInput} type="date" value={sess.sessionDate}
                  onChange={e => updateSession(sIdx, 'sessionDate', e.target.value)} />
              </div>

              {(() => {
                const indexedRows = sess.rows.map((row, i) => ({ row, i }));
                const matched   = indexedRows.filter(({ row }) => row.user_id);
                const unmatched = indexedRows.filter(({ row }) => !row.user_id);
                const tableHead = (
                  <tr>
                    <th className={styles.thVertName}>VERT Name</th>
                    <th className={styles.thPlayer}>{isJa ? 'アプリ選手' : 'Player'}</th>
                    <th>Jumps</th><th>Hi Jump cm</th><th>JPAM</th><th>Jump Power</th>
                    <th>Hi Impact%</th><th>Alert%</th><th>Elevated%</th>
                    <th>Energy</th><th>Sets</th><th>Intensity</th>
                    <th></th>
                  </tr>
                );
                const renderRow = ({ row, i: rIdx }) => (
                  <tr key={rIdx}>
                    <td>
                      <input className={styles.cellInput} value={row.vert_name}
                        onChange={e => updateRow(sIdx, rIdx, 'vert_name', e.target.value)} />
                    </td>
                    <td>
                      <select className={`${styles.cellSelect} ${row.user_id ? styles.cellSelectLinked : ''}`}
                        value={row.user_id}
                        onChange={e => updateRow(sIdx, rIdx, 'user_id', e.target.value)}>
                        <option value="">— unlinked —</option>
                        {players.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
                      </select>
                    </td>
                    {NUMERIC_FIELDS.map(field => (
                      <td key={field}>
                        <input className={styles.cellInput} type="number" value={row[field] ?? ''}
                          step={DECIMAL_FIELDS.has(field) ? '0.1' : '1'}
                          onChange={e => updateRow(sIdx, rIdx, field, e.target.value)} />
                      </td>
                    ))}
                    <td>
                      <button className={styles.removeBtn} onClick={() => removeRow(sIdx, rIdx)}>×</button>
                    </td>
                  </tr>
                );
                return (
                  <>
                    {matched.length > 0 && (
                      <>
                        <div className={styles.sectionLabel}>
                          <span className={styles.sectionLabelSave}>
                            ✓ {isJa ? `${matched.length}名 — 保存されます` : `${matched.length} player${matched.length !== 1 ? 's' : ''} — will be saved`}
                          </span>
                        </div>
                        <div className={styles.tableScroll}>
                          <table className={styles.uploadTable}>
                            <thead>{tableHead}</thead>
                            <tbody>{matched.map(renderRow)}</tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {unmatched.length > 0 && (
                      <>
                        <div className={styles.sectionLabel} style={{ marginTop: matched.length ? 16 : 0 }}>
                          <span className={styles.sectionLabelSkip}>
                            — {isJa ? `${unmatched.length}名 — スキップ（アプリユーザーなし）` : `${unmatched.length} player${unmatched.length !== 1 ? 's' : ''} — will be skipped (no app user)`}
                          </span>
                          <span className={styles.sectionLabelHint}>
                            {isJa
                              ? 'ユーザー管理でプロフィールを追加してから再アップロードするか、今すぐ紐付けてください。'
                              : 'Link to an existing player now, or add them in Users admin first then re-upload.'}
                          </span>
                        </div>
                        <div className={`${styles.tableScroll} ${styles.tableScrollMuted}`}>
                          <table className={`${styles.uploadTable} ${styles.uploadTableMuted}`}>
                            <thead>{tableHead}</thead>
                            <tbody>{unmatched.map(renderRow)}</tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          ))}

          <div className={styles.uploadActions}>
            <button className={styles.cancelBtn} onClick={() => { setUploadState('idle'); setParsedSessions([]); }}>
              {isJa ? '← 戻る' : '← Back'}
            </button>
            <div className={styles.actionsRight}>
              {savedMsg && <span className={styles.savedMsg}>{savedMsg}</span>}
              <button className={styles.saveBtn}
                disabled={saving || parsedSessions.length === 0}
                onClick={handleSaveAll}>
                {saving ? '…' : (isJa ? 'すべて保存する' : `Save All${parsedSessions.length > 1 ? ` (${parsedSessions.length})` : ''}`)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
