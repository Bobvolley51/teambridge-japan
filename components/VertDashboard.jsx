'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './VertDashboard.module.css';

// Thresholds from VERT legend (OH/M volleyball) — avg-mode fields only
const T = {
  avg_hi_jump_cm:    { low: 40,   mid: 50,   inv: false },
  jpam:              { low: 0.7,  mid: 1.2,  inv: false },
  avg_hi_jump_power: { low: 40,   mid: 55,   inv: false },
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
  if (t.inv) return hi ? '#dc2626' : mid ? '#d97706' : '#059669';
  return hi ? '#059669' : mid ? '#d97706' : '#dc2626';
}

const NUMERIC_FIELDS = [
  'jumps', 'avg_hi_jump_cm', 'jpam', 'avg_hi_jump_power',
  'high_impact_pct', 'alert_impact_pct', 'elevated_pct',
  'energy', 'sets_by_energy', 'intensity',
];
const DECIMAL_FIELDS = new Set(['avg_hi_jump_cm', 'jpam', 'avg_hi_jump_power', 'sets_by_energy']);

// sum: totalled across sessions in avg mode; avg: averaged across sessions
const STAT_COLS = [
  { key: 'jumps',             label: { en: 'Total\nJumps',     ja: '総\nジャンプ' },     unit: '',    sum: true  },
  { key: 'avg_hi_jump_cm',    label: { en: 'Avg Hi\nJump',     ja: '最高\n到達点' },     unit: ' cm', sum: false },
  { key: 'jpam',              label: { en: 'JPAM\n(avg)',       ja: 'JPAM\n(avg)' },     unit: '',    sum: false },
  { key: 'avg_hi_jump_power', label: { en: 'Jump\nPower',      ja: '跳躍\nパワー' },    unit: '',    sum: false },
  { key: 'high_impact_pct',   label: { en: 'Hi\nImpact',       ja: '高衝撃\n%' },       unit: '%',   sum: false },
  { key: 'alert_impact_pct',  label: { en: 'Alert\n%',         ja: 'アラート\n%' },     unit: '%',   sum: false },
  { key: 'elevated_pct',      label: { en: 'Elevated\n%',      ja: '上昇\n%' },         unit: '%',   sum: false },
  { key: 'energy',            label: { en: 'Total\nEnergy',    ja: '総\nエネルギー' },  unit: '',    sum: true  },
  { key: 'sets_by_energy',    label: { en: 'Sets\n(avg)',      ja: 'セット\n(avg)' },   unit: '',    sum: false },
  { key: 'intensity',         label: { en: 'Intensity\n(avg)', ja: '強度\n(avg)' },     unit: '',    sum: false },
];

const SUM_FIELDS = new Set(STAT_COLS.filter(c => c.sum).map(c => c.key));

const MAP_KEY  = 'vert_name_map';
const loadMap  = () => { try { return JSON.parse(localStorage.getItem(MAP_KEY) || '{}'); } catch { return {}; } };
const saveMap  = m  => localStorage.setItem(MAP_KEY, JSON.stringify(m));

function avgField(arr, field) {
  const vals = arr.map(s => s[field]).filter(v => v != null);
  if (!vals.length) return null;
  const total = vals.reduce((a, b) => a + b, 0);
  return SUM_FIELDS.has(field) ? total : total / vals.length;
}

function fmt(val, field) {
  if (val == null) return '—';
  return val.toFixed(DECIMAL_FIELDS.has(field) ? 1 : 0);
}

export default function VertDashboard({ lang, profile }) {
  const [view,        setView]        = useState('stats');
  const [players,     setPlayers]     = useState([]);
  const [sessions,    setSessions]    = useState([]);
  const [timeRange,   setTimeRange]   = useState('7d');
  const [showLegend,  setShowLegend]  = useState(false);
  const [statsMode,   setStatsMode]   = useState('avg');   // 'avg' | 'sessions'
  const [sortCol,     setSortCol]     = useState('name');
  const [sortDir,     setSortDir]     = useState('asc');
  const [playerFilter,setPlayerFilter]= useState('');
  const [trendsTab,   setTrendsTab]   = useState('progress');

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
  const canUpload = ['Headcoach', 'Athletic Trainer', 'Coaching Staff', 'GM'].includes(profile?.role);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, position')
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
  const isPlayer  = profile?.role === 'Player';
  const now = new Date();
  const cutoff = {
    '7d':  new Date(+now - 7  * 86400000).toISOString().slice(0, 10),
    '14d': new Date(+now - 14 * 86400000).toISOString().slice(0, 10),
    'all': '2000-01-01',
  };
  let filtered = sessions;
  if (isPlayer) filtered = filtered.filter(s => s.user_id === profile?.id);
  if (timeRange === 'last') {
    const ld = filtered[0]?.session_date;
    filtered = ld ? filtered.filter(s => s.session_date === ld) : [];
  } else {
    filtered = filtered.filter(s => s.session_date >= cutoff[timeRange]);
  }

  // Per-session rows (for 'sessions' mode)
  const sessionRows = filtered.map(s => {
    const player = players.find(pl => pl.id === s.user_id);
    return { ...s, name: player?.display_name || s.vert_name || '—' };
  });

  // Averaged rows (for 'avg' mode)
  const byPlayer = {};
  for (const s of filtered) {
    const key = s.user_id || s.vert_name;
    if (!byPlayer[key]) byPlayer[key] = { rows: [], vert_name: s.vert_name, user_id: s.user_id };
    byPlayer[key].rows.push(s);
  }
  const avgRows = Object.values(byPlayer).map(p => {
    const player = players.find(pl => pl.id === p.user_id);
    return {
      name:     player?.display_name || p.vert_name || '—',
      position: player?.position || '',
      count:    p.rows.length,
      ...Object.fromEntries(NUMERIC_FIELDS.map(f => [f, avgField(p.rows, f)])),
    };
  });

  function applySort(rows) {
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'string'
        ? (av || '').localeCompare(bv || '')
        : av - bv;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }

  function toggleSort(col) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filterText = playerFilter.trim().toLowerCase();
  const statsRows  = applySort(
    avgRows.filter(r => !filterText || (r.name || '').toLowerCase().includes(filterText))
  );
  const sessRows   = applySort(
    sessionRows.filter(r => !filterText || (r.name || '').toLowerCase().includes(filterText))
  );

  // Alert: players with concerning landing impact
  const landingAlerts = avgRows.filter(r =>
    (r.elevated_pct != null && r.elevated_pct >= 20) ||
    (r.alert_impact_pct != null && r.alert_impact_pct >= 10)
  );

  function SortTh({ col, label, className }) {
    const active = sortCol === col;
    return (
      <th className={`${className || styles.thNum} ${styles.thSortable} ${active ? styles.thSortActive : ''}`}
          onClick={() => toggleSort(col)}>
        {label}{active ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </th>
    );
  }

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
          <button className={`${styles.tab} ${view === 'trends' ? styles.tabActive : ''}`} onClick={() => setView('trends')}>
            {isJa ? 'トレンド' : 'Trends'}
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
          {/* Alert banner */}
          {!isPlayer && landingAlerts.length > 0 && (
            <div className={styles.alertBanner}>
              <span className={styles.alertTitle}>⚠ {isJa ? '着地衝撃アラート' : 'Landing Impact Alert'}</span>
              {landingAlerts.map(r => (
                <span key={r.name} className={styles.alertPlayer}>
                  {r.name}
                  {r.alert_impact_pct >= 10 && <> — Alert {r.alert_impact_pct}%</>}
                  {r.elevated_pct    >= 20 && <> — Elevated {r.elevated_pct}%</>}
                </span>
              ))}
            </div>
          )}

          <div className={styles.statsControls}>
            <div className={styles.rangeBar}>
              {[['last', isJa ? '最新' : 'Last'], ['7d', '7d'], ['14d', '14d'], ['all', isJa ? '全期間' : 'All']].map(([k, label]) => (
                <button key={k} className={`${styles.rangeBtn} ${timeRange === k ? styles.rangeBtnActive : ''}`} onClick={() => setTimeRange(k)}>
                  {label}
                </button>
              ))}
            </div>

            {!isPlayer && (
              <div className={styles.statsRight}>
                <input
                  className={styles.playerSearch}
                  placeholder={isJa ? '選手で絞り込み…' : 'Filter player…'}
                  value={playerFilter}
                  onChange={e => setPlayerFilter(e.target.value)}
                />
                <div className={styles.modeToggle}>
                  <button className={`${styles.modeBtn} ${statsMode === 'avg' ? styles.modeBtnActive : ''}`} onClick={() => setStatsMode('avg')}>
                    {isJa ? '平均' : 'Averages'}
                  </button>
                  <button className={`${styles.modeBtn} ${statsMode === 'sessions' ? styles.modeBtnActive : ''}`} onClick={() => setStatsMode('sessions')}>
                    {isJa ? 'セッション別' : 'Per Session'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {(statsMode === 'avg' ? statsRows : sessRows).length === 0 ? (
            <div className={styles.empty}>
              {isJa ? 'データなし。セッションをアップロードしてください。' : 'No data yet. Upload a session to get started.'}
            </div>
          ) : statsMode === 'avg' ? (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <SortTh col="name"  label={isJa ? '選手' : 'Player'} className={styles.thSticky} />
                    <SortTh col="count" label="n" />
                    {STAT_COLS.map(c => <SortTh key={c.key} col={c.key} label={isJa ? c.label.ja : c.label.en} />)}
                  </tr>
                </thead>
                <tbody>
                  {statsRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? styles.trEven : ''}>
                      <td className={styles.tdSticky}>{row.name}</td>
                      <td className={styles.tdCenter}>{row.count}</td>
                      {STAT_COLS.map(c => {
                        const val = row[c.key];
                        const clr = val != null ? cellColor(c.key, val) : '';
                        return (
                          <td key={c.key} className={styles.tdCenter}
                              style={clr ? { color: clr, fontWeight: 600 } : val == null ? { color: '#d1d5db' } : { color: '#374151' }}>
                            {fmt(val, c.key)}{val != null ? c.unit : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <SortTh col="session_date" label={isJa ? '日付' : 'Date'} className={styles.thSticky} />
                    {!isPlayer && <SortTh col="name" label={isJa ? '選手' : 'Player'} />}
                    <SortTh col="session_name" label={isJa ? 'セッション' : 'Session'} />
                    {STAT_COLS.map(c => <SortTh key={c.key} col={c.key} label={isJa ? c.label.ja : c.label.en} />)}
                  </tr>
                </thead>
                <tbody>
                  {sessRows.map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? styles.trEven : ''}>
                      <td className={styles.tdSticky}>{row.session_date}</td>
                      {!isPlayer && <td className={styles.tdCenter}>{row.name}</td>}
                      <td className={styles.tdCenter}>{row.session_name}</td>
                      {STAT_COLS.map(c => {
                        const val = row[c.key];
                        const clr = val != null ? cellColor(c.key, val) : '';
                        return (
                          <td key={c.key} className={styles.tdCenter}
                              style={clr ? { color: clr, fontWeight: 600 } : val == null ? { color: '#d1d5db' } : { color: '#374151' }}>
                            {fmt(val, c.key)}{val != null ? c.unit : ''}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.legendBar}>
            <div className={styles.legendSwatches}>
              <span className={styles.lgGreen}>{isJa ? '高' : 'High'}</span>
              <span className={styles.lgAmber}>{isJa ? '中' : 'Med'}</span>
              <span className={styles.lgRed}>{isJa ? '低' : 'Low'}</span>
              <span className={styles.lgNote}>· {isJa ? '着地衝撃は逆スケール' : 'Landing impact: inverted scale'}</span>
            </div>
            <button className={styles.legendToggle} onClick={() => setShowLegend(v => !v)}>
              {showLegend ? (isJa ? '閉じる ▲' : 'Hide legend ▲') : (isJa ? '凡例を表示 ▼' : 'Show legend ▼')}
            </button>
          </div>

          {showLegend && (
            <div className={styles.legendTable}>
              <table className={styles.lgTable}>
                <thead>
                  <tr>
                    <th className={styles.lgThMetric}>{isJa ? '指標' : 'Metric'}</th>
                    <th className={styles.lgThDesc}>{isJa ? '説明' : 'Description'}</th>
                    <th className={`${styles.lgTh} ${styles.lgRed}`}>{isJa ? '低' : 'Low'}</th>
                    <th className={`${styles.lgTh} ${styles.lgAmber}`}>{isJa ? '中' : 'Medium'}</th>
                    <th className={`${styles.lgTh} ${styles.lgGreen}`}>{isJa ? '高' : 'High'}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: isJa ? 'ジャンプ数 (OH/M)'  : 'Jumps (OH/M)',       desc: isJa ? '計測されたジャンプ総数'                          : 'Total jumps counted',                           low: '<90',    mid: '90–119',     hi: '≥120' },
                    { label: isJa ? '最高到達点'          : 'Avg High Jump',       desc: isJa ? '上位25%のジャンプ高さの平均'                    : 'Average of top 25% of jump heights',           low: '<40 cm', mid: '40–49 cm',   hi: '≥50 cm' },
                    { label: 'JPAM',                                               desc: isJa ? 'アクティブな1分あたりのジャンプ数'              : 'Jumps per active minute',                       low: '<0.7',   mid: '0.7–1.2',    hi: '≥1.2' },
                    { label: isJa ? '跳躍パワー'          : 'Avg High Jump Power', desc: isJa ? '跳躍の素早さ（38cm超のジャンプ）'              : 'Jump quickness (jumps over 38 cm)',            low: '<40',    mid: '40–54',      hi: '≥55' },
                    { label: isJa ? 'エネルギー'          : 'Energy',             desc: isJa ? '体への負荷量（J/kg）'                            : 'How hard the athlete works their body (J/kg)',  low: '<4500',  mid: '4500–6499',  hi: '≥6500' },
                    { label: isJa ? 'セット数(avg)'       : 'Sets by Energy',     desc: isJa ? 'エネルギーに基づく換算セット数'                  : 'Equivalent sets played based on energy',        low: '<2',     mid: '2–4',        hi: '≥5' },
                    { label: isJa ? '強度'                : 'Intensity',          desc: isJa ? '1分あたりの負荷（J/kg/分）'                      : 'Workload per minute (J/kg/min)',                low: '<55',    mid: '55–89',      hi: '≥90' },
                    { label: isJa ? '高衝撃%'             : 'Hi Impact %',        desc: isJa ? 'ピーク加速度≥15G & <20G — 強い着地（低いほど良い）' : 'Peak acceleration ≥15 G & <20 G — hard landings (lower is better)',    low: '≥20%', mid: '10–19%', hi: '<10%', inv: true },
                    { label: isJa ? 'アラート%'           : 'Alert %',            desc: isJa ? 'ピーク加速度≥20G — より強い着地（低いほど良い）' : 'Peak acceleration ≥20 G — harder landings (lower is better)',          low: '≥10%', mid: '5–9%',   hi: '<5%',  inv: true },
                    { label: isJa ? '上昇%'               : 'Elevated %',         desc: isJa ? '高衝撃+アラート合計（低いほど良い）'             : 'Hi Impact + Alert combined (lower is better)',                          low: '≥20%', mid: '10–19%', hi: '<10%', inv: true },
                  ].map(r => (
                    <tr key={r.label} className={styles.lgRow}>
                      <td className={styles.lgTdMetric}>{r.label}</td>
                      <td className={styles.lgTdDesc}>{r.desc}</td>
                      <td className={`${styles.lgTd} ${r.inv ? styles.red : styles.red}`}>{r.low}</td>
                      <td className={`${styles.lgTd} ${styles.amber}`}>{r.mid}</td>
                      <td className={`${styles.lgTd} ${r.inv ? styles.green : styles.green}`}>{r.hi}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TRENDS ─────────────────────────────────────────── */}
      {view === 'trends' && (() => {
        function isoWeekStart(dateStr) {
          const d = new Date(dateStr + 'T00:00:00');
          const day = d.getDay();
          d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
          return d.toISOString().slice(0, 10);
        }

        // Shared: per-player sessions oldest→newest
        const trendMap = {};
        for (const s of [...filtered].sort((a, b) => a.session_date.localeCompare(b.session_date))) {
          const key = s.user_id || s.vert_name;
          if (!trendMap[key]) {
            const pl = players.find(p => p.id === s.user_id);
            trendMap[key] = { name: pl?.display_name || s.vert_name || '—', position: pl?.position || '', sessions: [] };
          }
          trendMap[key].sessions.push(s);
        }
        const trendPlayers = Object.values(trendMap).sort((a, b) => a.name.localeCompare(b.name));

        function delta(prev, curr, inv) {
          if (prev == null || curr == null) return null;
          const d = curr - prev;
          if (Math.abs(d) < 0.5) return { arrow: '→', color: '#9ca3af', d };
          const improving = inv ? d < 0 : d > 0;
          return { arrow: improving ? '↑' : '↓', color: improving ? '#059669' : '#dc2626', d };
        }

        const TREND_COLS = [
          { key: 'avg_hi_jump_cm', label: isJa ? '到達点'  : 'Hi Jump',   unit: ' cm', inv: false },
          { key: 'elevated_pct',   label: isJa ? '上昇%'   : 'Elevated%', unit: '%',   inv: true  },
          { key: 'intensity',      label: isJa ? '強度'    : 'Intensity',  unit: '',    inv: false },
        ];

        const SUB_TABS = [
          ['progress',  isJa ? '推移'       : 'Progress'],
          ['volume',    isJa ? '週別量'      : 'Volume'],
          ['benchmark', isJa ? 'Benchmark'  : 'Benchmark'],
          ['landing',   isJa ? '着地負荷'   : 'Landing'],
          ['ingame',    isJa ? 'ゲーム内'   : 'In-Game'],
        ];

        const timeControls = (
          <div className={styles.trendControls}>
            <span className={styles.trendHint}>{isJa ? '期間:' : 'Range:'}</span>
            {[['last', isJa ? '最新' : 'Last'], ['7d', '7d'], ['14d', '14d'], ['all', isJa ? '全期間' : 'All']].map(([k, label]) => (
              <button key={k} className={`${styles.rangeBtn} ${timeRange === k ? styles.rangeBtnActive : ''}`} onClick={() => setTimeRange(k)}>
                {label}
              </button>
            ))}
          </div>
        );

        return (
          <div className={styles.trendWrap}>
            {/* Sub-tab nav */}
            <div className={styles.trendSubTabs}>
              {SUB_TABS.map(([k, label]) => (
                <button key={k}
                  className={`${styles.trendSubTab} ${trendsTab === k ? styles.trendSubTabActive : ''}`}
                  onClick={() => setTrendsTab(k)}>
                  {label}
                </button>
              ))}
            </div>
            {timeControls}

            {/* ── PROGRESS: session-by-session per player ── */}
            {trendsTab === 'progress' && (trendPlayers.length === 0
              ? <div className={styles.trendEmpty}>{isJa ? 'データなし' : 'No data for the selected time range'}</div>
              : trendPlayers.map(p => {
                const first = p.sessions[0];
                const last  = p.sessions[p.sessions.length - 1];
                return (
                  <div key={p.name} className={styles.trendCard}>
                    <div className={styles.trendCardHeader}>
                      <span className={styles.trendPlayerName}>{p.name}</span>
                      {p.position && <span className={styles.trendPosBadge}>{p.position}</span>}
                      <span className={styles.trendSessCount}>{p.sessions.length} {isJa ? 'セッション' : 'sessions'}</span>
                      {p.sessions.length > 1 && (
                        <div className={styles.trendSummary}>
                          {TREND_COLS.map(col => {
                            const d = delta(first[col.key], last[col.key], col.inv);
                            if (!d) return null;
                            return (
                              <span key={col.key} className={styles.trendSumItem} style={{ color: d.color }}>
                                {col.label} {d.arrow} {d.d > 0 ? '+' : ''}{d.d.toFixed(col.key === 'intensity' ? 0 : 1)}{col.unit}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className={styles.trendTableWrap}>
                      <table className={styles.trendTable}>
                        <thead>
                          <tr>
                            <th className={styles.trendThDate}>{isJa ? '日付' : 'Date'}</th>
                            <th className={styles.trendThSess}>{isJa ? 'セッション' : 'Session'}</th>
                            {TREND_COLS.map(col => <th key={col.key} className={styles.trendTh}>{col.label}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {p.sessions.map((s, i) => {
                            const prev = p.sessions[i - 1];
                            return (
                              <tr key={i} className={styles.trendTr}>
                                <td className={styles.trendTdDate}>{s.session_date}</td>
                                <td className={styles.trendTdSess}>{s.session_name || '—'}</td>
                                {TREND_COLS.map(col => {
                                  const val = s[col.key];
                                  const d   = prev ? delta(prev[col.key], val, col.inv) : null;
                                  const clr = cellColor(col.key, val);
                                  return (
                                    <td key={col.key} className={styles.trendTdVal}>
                                      <span className={styles.trendVal} style={{ color: clr || '#111827' }}>
                                        {val != null ? `${parseFloat(val).toFixed(col.key === 'intensity' ? 0 : 1)}${col.unit}` : '—'}
                                      </span>
                                      {d && <span className={styles.trendArrow} style={{ color: d.color }}>{d.arrow}</span>}
                                    </td>
                                  );
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}

            {/* ── VOLUME: weekly jump quota grid ── */}
            {trendsTab === 'volume' && (() => {
              const weekSet = new Set();
              const playerWeeks = {};
              for (const s of filtered) {
                if (!s.user_id) continue;
                const week = isoWeekStart(s.session_date);
                weekSet.add(week);
                if (!playerWeeks[s.user_id]) {
                  const pl = players.find(p => p.id === s.user_id);
                  playerWeeks[s.user_id] = { name: pl?.display_name || s.vert_name || '—', data: {} };
                }
                playerWeeks[s.user_id].data[week] = (playerWeeks[s.user_id].data[week] || 0) + (s.jumps || 0);
              }
              const weeks = [...weekSet].sort();
              const volRows = Object.values(playerWeeks).sort((a, b) => a.name.localeCompare(b.name));
              const allVals = volRows.flatMap(r => weeks.map(w => r.data[w] || 0)).filter(v => v > 0);
              const maxJumps = allVals.length ? Math.max(...allVals) : 1;

              if (!volRows.length) return <div className={styles.trendEmpty}>{isJa ? 'データなし' : 'No data for the selected time range'}</div>;

              return (
                <div className={styles.volWrap}>
                  <p className={styles.volHint}>{isJa ? '週ごとの総ジャンプ数（深い色ほど多い）' : 'Total jumps per week — darker = more volume'}</p>
                  <div className={styles.volTableWrap}>
                    <table className={styles.volTable}>
                      <thead>
                        <tr>
                          <th className={styles.volThPlayer}>{isJa ? '選手' : 'Player'}</th>
                          {weeks.map(w => <th key={w} className={styles.volTh}>{w.slice(5)}</th>)}
                          <th className={styles.volThTotal}>{isJa ? '合計' : 'Total'}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {volRows.map(row => {
                          const total = weeks.reduce((sum, w) => sum + (row.data[w] || 0), 0);
                          return (
                            <tr key={row.name} className={styles.volTr}>
                              <td className={styles.volTdPlayer}>{row.name}</td>
                              {weeks.map(w => {
                                const v = row.data[w];
                                const opacity = v ? 0.15 + 0.85 * (v / maxJumps) : 0;
                                return (
                                  <td key={w} className={styles.volTd}
                                      style={v ? { background: `rgba(220,38,38,${opacity.toFixed(2)})`, color: opacity > 0.5 ? '#fff' : '#111827', fontWeight: 700 } : {}}>
                                    {v || '—'}
                                  </td>
                                );
                              })}
                              <td className={styles.volTdTotal}>{total}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* ── BENCHMARK: position comparison ── */}
            {trendsTab === 'benchmark' && (() => {
              const BENCH_COLS = [
                { key: 'avg_hi_jump_cm',  label: isJa ? '到達点'   : 'Hi Jump',   unit: ' cm', inv: false },
                { key: 'jumps',           label: isJa ? 'ジャンプ' : 'Jumps',    unit: '',    inv: false },
                { key: 'elevated_pct',    label: isJa ? '上昇%'    : 'Elevated%', unit: '%',   inv: true  },
                { key: 'intensity',       label: isJa ? '強度'     : 'Intensity', unit: '',    inv: false },
              ];
              const POS_ORDER = ['Setter', 'Middle', 'Outside', 'Opposite', 'Libero', 'Other'];
              const POS_LABEL = { Setter: isJa ? 'セッター' : 'Setter', Middle: isJa ? 'ミドル' : 'Middle', Outside: isJa ? 'アウトサイド' : 'Outside', Opposite: isJa ? 'オポジット' : 'Opposite', Libero: isJa ? 'リベロ' : 'Libero', Other: isJa ? 'その他' : 'Other' };
              const byPos = {};
              for (const row of avgRows) {
                const pos = row.position || 'Other';
                if (!byPos[pos]) byPos[pos] = [];
                byPos[pos].push(row);
              }
              const posGroups = [...POS_ORDER, ...Object.keys(byPos).filter(p => !POS_ORDER.includes(p))]
                .filter(p => byPos[p]?.length)
                .map(pos => {
                  const members = byPos[pos];
                  const avg = {};
                  for (const col of BENCH_COLS) {
                    const vals = members.map(m => m[col.key]).filter(v => v != null);
                    avg[col.key] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
                  }
                  return { pos, members, avg };
                });

              if (!posGroups.length) return (
                <div className={styles.trendEmpty}>
                  {isJa ? 'ポジションデータなし。選手プロフィールにポジションを設定してください。' : 'No position data. Ensure player profiles include a position.'}
                </div>
              );

              return (
                <div className={styles.benchWrap}>
                  {posGroups.map(({ pos, members, avg }) => (
                    <div key={pos} className={styles.benchSection}>
                      <div className={styles.benchPosHeader}>
                        <span className={styles.benchPosName}>{POS_LABEL[pos] || pos}</span>
                        <span className={styles.benchPosCount}>{members.length} {isJa ? '名' : 'players'}</span>
                      </div>
                      <div className={styles.benchTableWrap}>
                        <table className={styles.benchTable}>
                          <thead>
                            <tr>
                              <th className={styles.benchThPlayer}>{isJa ? '選手' : 'Player'}</th>
                              {BENCH_COLS.map(col => <th key={col.key} className={styles.benchTh}>{col.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            <tr className={styles.benchAvgRow}>
                              <td className={styles.benchTdAvgLabel}>{isJa ? '平均' : 'Pos. avg'}</td>
                              {BENCH_COLS.map(col => {
                                const v = avg[col.key];
                                return (
                                  <td key={col.key} className={styles.benchTdAvg}>
                                    {v != null ? `${v.toFixed(col.key === 'jumps' ? 0 : 1)}${col.unit}` : '—'}
                                  </td>
                                );
                              })}
                            </tr>
                            {[...members].sort((a, b) => a.name.localeCompare(b.name)).map(player => (
                              <tr key={player.name} className={styles.benchTr}>
                                <td className={styles.benchTdPlayer}>{player.name}</td>
                                {BENCH_COLS.map(col => {
                                  const v = player[col.key];
                                  const posAvg = avg[col.key];
                                  const clr = v != null ? cellColor(col.key, v) : '';
                                  const diff = v != null && posAvg != null ? v - posAvg : null;
                                  const diffStr = diff != null
                                    ? `${diff >= 0 ? '+' : ''}${diff.toFixed(col.key === 'jumps' ? 0 : 1)}${col.unit}`
                                    : '';
                                  const diffColor = diff == null ? '#9ca3af'
                                    : (col.inv ? diff < 0 : diff > 0) ? '#059669' : '#dc2626';
                                  return (
                                    <td key={col.key} className={styles.benchTd}>
                                      <span className={styles.benchVal} style={clr ? { color: clr } : {}}>
                                        {v != null ? `${v.toFixed(col.key === 'jumps' ? 0 : 1)}${col.unit}` : '—'}
                                      </span>
                                      {diffStr && <span className={styles.benchDelta} style={{ color: diffColor }}>{diffStr}</span>}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── LANDING: landing load monitoring ── */}
            {trendsTab === 'landing' && (() => {
              const LAND_COLS = [
                { key: 'elevated_pct',    label: isJa ? '上昇%'    : 'Elevated%',  unit: '%', inv: true },
                { key: 'alert_impact_pct',label: isJa ? 'アラート%': 'Alert%',    unit: '%', inv: true },
                { key: 'high_impact_pct', label: isJa ? '高衝撃%'  : 'Hi Impact%', unit: '%', inv: true },
              ];
              if (!trendPlayers.length) return <div className={styles.trendEmpty}>{isJa ? 'データなし' : 'No data for the selected time range'}</div>;
              return (
                <div className={styles.landWrap}>
                  <p className={styles.landHint}>{isJa ? '着地衝撃指標の推移。上昇トレンドに注意（逆スケール）。' : 'Landing impact over time. Higher = more stress. Watch for upward trends.'}</p>
                  {trendPlayers.map(p => (
                    <div key={p.name} className={styles.trendCard}>
                      <div className={styles.trendCardHeader}>
                        <span className={styles.trendPlayerName}>{p.name}</span>
                        {p.position && <span className={styles.trendPosBadge}>{p.position}</span>}
                        <span className={styles.trendSessCount}>{p.sessions.length} {isJa ? 'セッション' : 'sessions'}</span>
                      </div>
                      <div className={styles.trendTableWrap}>
                        <table className={styles.trendTable}>
                          <thead>
                            <tr>
                              <th className={styles.trendThDate}>{isJa ? '日付' : 'Date'}</th>
                              <th className={styles.trendThSess}>{isJa ? 'セッション' : 'Session'}</th>
                              {LAND_COLS.map(col => <th key={col.key} className={styles.trendTh}>{col.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {p.sessions.map((s, i) => {
                              const prev = p.sessions[i - 1];
                              return (
                                <tr key={i} className={styles.trendTr}>
                                  <td className={styles.trendTdDate}>{s.session_date}</td>
                                  <td className={styles.trendTdSess}>{s.session_name || '—'}</td>
                                  {LAND_COLS.map(col => {
                                    const val = s[col.key];
                                    const d   = prev ? delta(prev[col.key], val, col.inv) : null;
                                    const clr = cellColor(col.key, val);
                                    return (
                                      <td key={col.key} className={styles.trendTdVal}>
                                        <span className={styles.trendVal} style={clr ? { color: clr } : {}}>
                                          {val != null ? `${val}${col.unit}` : '—'}
                                        </span>
                                        {d && <span className={styles.trendArrow} style={{ color: d.color }}>{d.arrow}</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* ── IN-GAME: metric drift across sets/halves ── */}
            {trendsTab === 'ingame' && (() => {
              const byDate = {};
              for (const s of filtered) {
                if (!byDate[s.session_date]) byDate[s.session_date] = {};
                const sName = s.session_name || 'Session';
                if (!byDate[s.session_date][sName]) byDate[s.session_date][sName] = [];
                byDate[s.session_date][sName].push(s);
              }
              const gameDays = Object.entries(byDate)
                .filter(([, sm]) => Object.keys(sm).length >= 2)
                .sort(([a], [b]) => b.localeCompare(a));

              const GAME_COLS = [
                { key: 'avg_hi_jump_cm', label: isJa ? '到達点'   : 'Hi Jump',   unit: ' cm', inv: false },
                { key: 'intensity',      label: isJa ? '強度'     : 'Intensity', unit: '',    inv: false },
                { key: 'elevated_pct',   label: isJa ? '上昇%'    : 'Elevated%', unit: '%',   inv: true  },
                { key: 'jumps',          label: isJa ? 'ジャンプ' : 'Jumps',     unit: '',    inv: false },
              ];

              if (!gameDays.length) return (
                <div className={styles.trendEmpty}>
                  {isJa
                    ? '同日に複数セッションが見つかりません。セット/ハーフ別PDFをまとめてアップロードしてください。'
                    : 'No same-day multi-session data found. Upload multiple PDFs for the same date (e.g. Set 1, Set 2).'}
                </div>
              );

              return (
                <div className={styles.ingameWrap}>
                  <p className={styles.ingameHint}>{isJa ? '同日複数セッション間の指標変化（セット/ハーフ別）' : 'Metric drift across sessions on the same day (e.g. by set or half)'}</p>
                  {gameDays.map(([date, sessMap]) => {
                    const sessNames = Object.keys(sessMap).sort();
                    const playerSet = new Set();
                    for (const rows of Object.values(sessMap)) {
                      for (const r of rows) if (r.user_id) playerSet.add(r.user_id);
                    }
                    const gamePlayers = [...playerSet].map(uid => {
                      const pl = players.find(p => p.id === uid);
                      return { uid, name: pl?.display_name || uid };
                    }).sort((a, b) => a.name.localeCompare(b.name));

                    return (
                      <div key={date} className={styles.ingameCard}>
                        <div className={styles.ingameDateHeader}>
                          <span className={styles.ingameDate}>{date}</span>
                          <span className={styles.ingameSessNames}>{sessNames.join(' → ')}</span>
                        </div>
                        <div className={styles.trendTableWrap}>
                          <table className={styles.ingameTable}>
                            <thead>
                              <tr>
                                <th className={styles.ingameThPlayer}>{isJa ? '選手' : 'Player'}</th>
                                {sessNames.map(sn => (
                                  <th key={sn} colSpan={GAME_COLS.length} className={styles.ingameThSession}>{sn}</th>
                                ))}
                              </tr>
                              <tr>
                                <th className={styles.ingameThSub} />
                                {sessNames.flatMap(sn =>
                                  GAME_COLS.map(col => (
                                    <th key={`${sn}-${col.key}`} className={styles.ingameThSub}>{col.label}</th>
                                  ))
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {gamePlayers.map(({ uid, name }) => (
                                <tr key={uid} className={styles.ingameTr}>
                                  <td className={styles.ingameTdPlayer}>{name}</td>
                                  {sessNames.flatMap((sn, si) => {
                                    const prevRows = si > 0 ? (sessMap[sessNames[si - 1]] || []) : [];
                                    const currRows = sessMap[sn] || [];
                                    const curr = currRows.find(r => r.user_id === uid);
                                    const prev = prevRows.find(r => r.user_id === uid);
                                    return GAME_COLS.map(col => {
                                      const val = curr?.[col.key];
                                      const prevVal = prev?.[col.key];
                                      const d = si > 0 && prevVal != null ? delta(prevVal, val, col.inv) : null;
                                      const clr = cellColor(col.key, val);
                                      return (
                                        <td key={`${sn}-${col.key}`} className={styles.ingameTd}>
                                          {val != null ? (
                                            <>
                                              <span style={clr ? { color: clr, fontWeight: 700 } : {}}>
                                                {col.key === 'avg_hi_jump_cm' ? parseFloat(val).toFixed(1) : Math.round(val)}{col.unit}
                                              </span>
                                              {d && <span style={{ color: d.color, fontSize: 10, marginLeft: 2 }}>{d.arrow}</span>}
                                            </>
                                          ) : <span style={{ color: '#d1d5db' }}>—</span>}
                                        </td>
                                      );
                                    });
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        );
      })()}

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
