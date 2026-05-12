'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './NutritionDashboard.module.css';

const MEALS = [
  { id: 'breakfast', en: 'Breakfast', ja: '朝食',     icon: '🌅' },
  { id: 'lunch',     en: 'Lunch',     ja: '昼食',     icon: '☀️' },
  { id: 'dinner',    en: 'Dinner',    ja: '夕食',     icon: '🌙' },
  { id: 'snack',     en: 'Snack',     ja: 'スナック', icon: '🍎' },
];

const RATINGS = [
  { v: 'green',  e: '🟢', en: 'Good',    ja: '良好'   },
  { v: 'yellow', e: '🟡', en: 'Fair',    ja: '普通'   },
  { v: 'red',    e: '🔴', en: 'Improve', ja: '要改善' },
];

const TRAINER_ROLES = ['Athletic Trainer', 'Headcoach'];

function getLast14Days() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else       { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      canvas.toBlob(resolve, 'image/jpeg', 0.85);
    };
    img.src = url;
  });
}

function emptyEntry() {
  return { id: null, notes: '', coach_review_requested: false, player_rating: null, photos: [], rating: null, comment: '', commentId: null, allComments: [] };
}

// ── MealCard defined before NutritionDashboard to avoid TDZ ──────────────
function MealCard({ meal, entry, lang, isTrainer, isOwn, uploading, onNotesChange, onAskCoach, onPlayerRating, onPhotoUpload, onPhotoDelete, onSaveComment, onPhotoClick }) {
  const [notes,   setNotes]   = useState(entry.notes);
  const [comment, setComment] = useState(entry.comment);
  const [rating,  setRating]  = useState(entry.rating);
  const fileRef = useRef();

  useEffect(() => { setNotes(entry.notes);     }, [entry.notes]);
  useEffect(() => { setComment(entry.comment); }, [entry.comment]);
  useEffect(() => { setRating(entry.rating);   }, [entry.rating]);

  const handleBlur = () => { if (notes !== entry.notes) onNotesChange(notes); };

  const handleFile = e => {
    const f = e.target.files[0];
    if (f) onPhotoUpload(f);
    e.target.value = '';
  };

  const handleSaveComment = () => {
    if (comment !== entry.comment || rating !== entry.rating) onSaveComment(comment, rating);
  };

  const topRating = entry.allComments?.find(c => c.rating)?.rating;

  return (
    <div className={`${styles.mealCard} ${entry.coach_review_requested && isTrainer ? styles.mealCardReview : ''}`}>
      <div className={styles.mealHeader}>
        <span className={styles.mealIcon}>{meal.icon}</span>
        <span className={styles.mealTitle}>{lang === 'ja' ? meal.ja : meal.en}</span>
        {topRating && <span className={styles.mealRating}>{RATINGS.find(r => r.v === topRating)?.e}</span>}
        {entry.coach_review_requested && (
          <span className={styles.reviewFlag}>
            {isTrainer
              ? (lang === 'ja' ? '❗ フィードバック依頼' : '❗ Feedback requested')
              : (lang === 'ja' ? '⏳ コーチ待ち' : '⏳ Waiting for coach')}
          </span>
        )}
      </div>

      {/* Photos */}
      <div className={styles.photoGrid}>
        {entry.photos.map(p => (
          <div key={p.id} className={styles.photoThumb}>
            <img src={p.url} className={styles.thumbImg} onClick={() => onPhotoClick(p.url)} alt="" />
            {isOwn && !isTrainer && (
              <button className={styles.thumbDel} onClick={() => onPhotoDelete(p.id, p.path)}>✕</button>
            )}
          </div>
        ))}
        {isOwn && !isTrainer && entry.photos.length < 3 && (
          <button className={styles.addPhotoBtn} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '…' : '+'}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          </button>
        )}
        {isOwn && !isTrainer && entry.photos.length >= 3 && (
          <div className={styles.photoLimitNote}>3 / 3</div>
        )}
      </div>

      {/* Notes */}
      {isOwn && !isTrainer ? (
        <textarea
          className={styles.notesArea}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          onBlur={handleBlur}
          placeholder={lang === 'ja' ? 'メモを追加…' : 'Add a note…'}
          rows={2}
        />
      ) : (
        entry.notes
          ? <div className={styles.notesRead}>{entry.notes}</div>
          : !isTrainer ? <div className={styles.notesEmpty}>{lang === 'ja' ? 'メモなし' : 'No notes'}</div> : null
      )}

      {/* Player self-rating */}
      {isOwn && !isTrainer && (
        <div className={styles.selfRatingRow}>
          <span className={styles.selfRatingLabel}>{lang === 'ja' ? '評価:' : 'Rate:'}</span>
          {RATINGS.map(r => (
            <button
              key={r.v}
              className={`${styles.ratingBtn} ${entry.player_rating === r.v ? styles.ratingBtnActive : ''}`}
              onClick={() => onPlayerRating(entry.player_rating === r.v ? null : r.v)}>
              {r.e}
            </button>
          ))}
        </div>
      )}
      {isTrainer && entry.player_rating && (
        <div className={styles.selfRatingRow}>
          <span className={styles.selfRatingLabel}>{lang === 'ja' ? '選手の評価:' : 'Player rating:'}</span>
          <span>{RATINGS.find(r => r.v === entry.player_rating)?.e}</span>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{RATINGS.find(r => r.v === entry.player_rating)?.[lang === 'ja' ? 'ja' : 'en']}</span>
        </div>
      )}

      {/* Ask Coach button (players only, own meals) */}
      {isOwn && !isTrainer && (
        <button
          className={`${styles.askCoachBtn} ${entry.coach_review_requested ? styles.askCoachBtnActive : ''}`}
          onClick={onAskCoach}>
          {entry.coach_review_requested
            ? (lang === 'ja' ? '⏳ コーチに聞いています…' : '⏳ Waiting for coach feedback…')
            : (lang === 'ja' ? '❓ コーチに聞く' : '❓ Ask Coach')}
        </button>
      )}

      {/* Trainer feedback section */}
      {isTrainer && (
        <div className={styles.trainerSection}>
          <div className={styles.ratingRow}>
            {RATINGS.map(r => (
              <button
                key={r.v}
                className={`${styles.ratingBtn} ${rating === r.v ? styles.ratingBtnActive : ''}`}
                onClick={() => setRating(v => v === r.v ? null : r.v)}>
                {r.e} {lang === 'ja' ? r.ja : r.en}
              </button>
            ))}
          </div>
          <textarea
            className={styles.commentArea}
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder={lang === 'ja' ? 'フィードバックを入力…' : 'Write feedback…'}
            rows={2}
          />
          <button className={styles.commentSaveBtn} onClick={handleSaveComment}>
            {lang === 'ja' ? '保存' : 'Save'}
          </button>
        </div>
      )}

      {/* Trainer comments visible to the player */}
      {!isTrainer && entry.allComments.length > 0 && (
        <div className={styles.coachComments}>
          <div className={styles.coachCommentsLabel}>{lang === 'ja' ? 'コーチから:' : 'From coach:'}</div>
          {entry.allComments.map(c => (
            <div key={c.id} className={styles.commentItem}>
              <span className={styles.commentAuthor}>{c.author_name}</span>
              {c.rating && <span className={styles.commentRating}>{RATINGS.find(r => r.v === c.rating)?.e}</span>}
              {c.comment && <span className={styles.commentText}>{c.comment}</span>}
            </div>
          ))}
        </div>
      )}

      {/* All comments visible to trainer */}
      {isTrainer && entry.allComments.length > 0 && (
        <div className={styles.coachComments}>
          {entry.allComments.map(c => (
            <div key={c.id} className={styles.commentItem}>
              <span className={styles.commentAuthor}>{c.author_name}</span>
              {c.rating && <span className={styles.commentRating}>{RATINGS.find(r => r.v === c.rating)?.e}</span>}
              {c.comment && <span className={styles.commentText}>{c.comment}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────
export default function NutritionDashboard({ lang, profile }) {
  const isTrainer = TRAINER_ROLES.includes(profile?.role);
  const DAYS = getLast14Days();

  const [view,         setView]         = useState('diary'); // 'diary' | 'stats'
  const [selectedDay,  setSelectedDay]  = useState(DAYS[DAYS.length - 1]);
  const [players,      setPlayers]      = useState([]);
  const [viewUserId,   setViewUserId]   = useState(profile?.id ?? '');
  const [viewUserName, setViewUserName] = useState(profile?.display_name ?? '');
  const [entries,      setEntries]      = useState({});
  const [loading,      setLoading]      = useState(false);
  const [saving,       setSaving]       = useState({});
  const [uploading,    setUploading]    = useState({});
  const [lightbox,     setLightbox]     = useState(null);
  const [uploadError,  setUploadError]  = useState(null);
  const [statsRows,    setStatsRows]    = useState(null); // null = not loaded yet
  const [myStats,      setMyStats]      = useState(null); // player's own 14-day summary

  // Load player list for trainer dropdown
  useEffect(() => {
    if (!isTrainer) return;
    supabase.from('profiles').select('id, display_name').eq('role', 'Player').order('display_name').then(({ data }) => {
      setPlayers(data ?? []);
    });
  }, [isTrainer]);

  const MAX_MEALS = DAYS.length * MEALS.length; // 14 days × 4 meals = 56

  // Load stats overview (trainers: all players; players: own summary)
  const loadStats = useCallback(async () => {
    const since = DAYS[0];
    if (isTrainer) {
      const [{ data: allPlayers }, { data: entries }] = await Promise.all([
        supabase.from('profiles').select('id, display_name').eq('role', 'Player').order('display_name'),
        supabase.from('nutrition_entries').select('user_id, player_rating').gte('meal_date', since),
      ]);
      if (!allPlayers) return;
      const map = {};
      for (const p of allPlayers) {
        map[p.id] = { name: p.display_name ?? '—', total: 0, green: 0, yellow: 0, red: 0, unrated: 0 };
      }
      for (const e of (entries ?? [])) {
        if (!map[e.user_id]) continue;
        const r = map[e.user_id];
        r.total++;
        if (e.player_rating === 'green')       r.green++;
        else if (e.player_rating === 'yellow') r.yellow++;
        else if (e.player_rating === 'red')    r.red++;
        else r.unrated++;
      }
      setStatsRows(Object.values(map));
    } else {
      // Player: load own summary
      const { data } = await supabase
        .from('nutrition_entries')
        .select('player_rating')
        .eq('user_id', profile?.id)
        .gte('meal_date', since);
      if (!data) return;
      const s = { total: data.length, green: 0, yellow: 0, red: 0, unrated: 0 };
      for (const e of data) {
        if (e.player_rating === 'green')  s.green++;
        else if (e.player_rating === 'yellow') s.yellow++;
        else if (e.player_rating === 'red')    s.red++;
        else s.unrated++;
      }
      setMyStats(s);
    }
  }, [isTrainer, profile?.id, DAYS]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const loadDay = useCallback(async () => {
    if (!viewUserId) return;
    setLoading(true);
    const { data } = await supabase
      .from('nutrition_entries')
      .select('id, meal_type, notes, coach_review_requested, player_rating, nutrition_photos(id, storage_path), nutrition_comments(id, author_id, author_name, comment, rating)')
      .eq('user_id', viewUserId)
      .eq('meal_date', selectedDay);

    const map = {};
    for (const e of (data ?? [])) {
      const myComment = isTrainer
        ? e.nutrition_comments?.find(c => c.author_id === profile?.id)
        : null;
      map[e.meal_type] = {
        id: e.id,
        notes: e.notes ?? '',
        coach_review_requested: e.coach_review_requested ?? false,
        player_rating: e.player_rating ?? null,
        photos: (e.nutrition_photos ?? []).map(p => ({
          id: p.id,
          url: supabase.storage.from('nutrition-photos').getPublicUrl(p.storage_path).data.publicUrl,
          path: p.storage_path,
        })),
        rating: myComment?.rating ?? null,
        comment: myComment?.comment ?? '',
        commentId: myComment?.id ?? null,
        allComments: e.nutrition_comments ?? [],
      };
    }
    setEntries(map);
    setLoading(false);
  }, [viewUserId, selectedDay, isTrainer, profile?.id]);

  useEffect(() => { loadDay(); }, [loadDay]);

  // Delete own photos older than 30 days on mount
  useEffect(() => {
    if (!profile?.id) return;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    (async () => {
      const { data: oldEntries } = await supabase
        .from('nutrition_entries')
        .select('id')
        .eq('user_id', profile.id)
        .lt('meal_date', cutoffStr);
      if (!oldEntries?.length) return;
      const ids = oldEntries.map(e => e.id);
      const { data: oldPhotos } = await supabase
        .from('nutrition_photos')
        .select('id, storage_path')
        .in('entry_id', ids);
      if (!oldPhotos?.length) return;
      await supabase.storage.from('nutrition-photos').remove(oldPhotos.map(p => p.storage_path));
      await supabase.from('nutrition_photos').delete().in('id', oldPhotos.map(p => p.id));
    })();
  }, [profile?.id]);

  async function ensureEntry(mealType) {
    const existing = entries[mealType];
    if (existing?.id) return existing.id;

    // Insert if not exists, skip if already exists (ignoreDuplicates won't overwrite notes)
    await supabase
      .from('nutrition_entries')
      .upsert(
        { user_id: viewUserId, user_name: viewUserName, meal_date: selectedDay, meal_type: mealType, notes: '' },
        { onConflict: 'user_id,meal_date,meal_type', ignoreDuplicates: true }
      );

    // Always fetch the id — works whether row was just created or already existed
    const { data, error } = await supabase
      .from('nutrition_entries')
      .select('id')
      .eq('user_id', viewUserId)
      .eq('meal_date', selectedDay)
      .eq('meal_type', mealType)
      .single();

    if (error) {
      console.error('ensureEntry fetch failed:', error);
      setUploadError(`DB error: ${error.message}`);
      return null;
    }
    if (data) {
      setEntries(e => ({ ...e, [mealType]: { ...(e[mealType] ?? emptyEntry()), id: data.id } }));
      return data.id;
    }
    return null;
  }

  async function saveNotes(mealType, notes) {
    setSaving(s => ({ ...s, [mealType]: true }));
    const id = await ensureEntry(mealType);
    if (id) {
      await supabase.from('nutrition_entries').update({ notes, updated_at: new Date().toISOString() }).eq('id', id);
      setEntries(e => ({ ...e, [mealType]: { ...(e[mealType] ?? emptyEntry()), notes } }));
    }
    setSaving(s => ({ ...s, [mealType]: false }));
  }

  async function toggleAskCoach(mealType) {
    const id = await ensureEntry(mealType);
    if (!id) return;
    const current = entries[mealType]?.coach_review_requested ?? false;
    const next = !current;
    await supabase.from('nutrition_entries').update({ coach_review_requested: next }).eq('id', id);
    if (next) {
      const { data: trainers } = await supabase.from('profiles').select('id').eq('role', 'Athletic Trainer');
      if (trainers?.length) {
        const meal = MEALS.find(m => m.id === mealType);
        await supabase.from('notifications').insert(
          trainers.map(t => ({
            user_id:    t.id,
            type:       'nutrition',
            title:      lang === 'ja' ? '栄養フィードバック依頼' : 'Nutrition Feedback Request',
            body:       `${viewUserName} — ${lang === 'ja' ? meal?.ja : meal?.en}`,
            nav_target: 'nutrition',
            ref_id:     id,
          }))
        );
      }
    }
    setEntries(e => ({ ...e, [mealType]: { ...(e[mealType] ?? emptyEntry()), id, coach_review_requested: next } }));
  }

  async function savePlayerRating(mealType, player_rating) {
    const id = await ensureEntry(mealType);
    if (!id) return;
    await supabase.from('nutrition_entries').update({ player_rating }).eq('id', id);
    setEntries(e => ({ ...e, [mealType]: { ...(e[mealType] ?? emptyEntry()), id, player_rating } }));
  }

  async function uploadPhoto(mealType, file) {
    setUploading(u => ({ ...u, [mealType]: true }));
    const id = await ensureEntry(mealType);
    if (!id) { setUploading(u => ({ ...u, [mealType]: false })); return; }

    const blob = await compressImage(file);
    const path = `${viewUserId}/${selectedDay}/${mealType}/${Date.now()}.jpg`;
    const { error: storageError } = await supabase.storage.from('nutrition-photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (storageError) {
      console.error('Storage upload failed:', storageError);
      setUploadError(`Storage error: ${storageError.message}`);
    } else {
      const { data: phData, error: dbError } = await supabase.from('nutrition_photos').insert({ entry_id: id, storage_path: path }).select('id').single();
      if (dbError) {
        console.error('nutrition_photos insert failed:', dbError);
        setUploadError(`DB error: ${dbError.message}`);
      } else if (phData) {
        const url = supabase.storage.from('nutrition-photos').getPublicUrl(path).data.publicUrl;
        setEntries(e => ({
          ...e,
          [mealType]: { ...(e[mealType] ?? emptyEntry()), id, photos: [...(e[mealType]?.photos ?? []), { id: phData.id, url, path }] },
        }));
      }
    }
    setUploading(u => ({ ...u, [mealType]: false }));
  }

  async function deletePhoto(mealType, photoId, path) {
    await supabase.storage.from('nutrition-photos').remove([path]);
    await supabase.from('nutrition_photos').delete().eq('id', photoId);
    setEntries(e => ({
      ...e,
      [mealType]: { ...(e[mealType] ?? emptyEntry()), photos: (e[mealType]?.photos ?? []).filter(p => p.id !== photoId) },
    }));
  }

  async function saveComment(mealType, comment, rating) {
    const entry = entries[mealType];
    if (!entry?.id) return;
    const payload = { entry_id: entry.id, author_id: profile?.id, author_name: profile?.name ?? '', comment, rating, updated_at: new Date().toISOString() };

    let commentId = entry.commentId;
    if (commentId) {
      await supabase.from('nutrition_comments').update({ comment, rating, updated_at: new Date().toISOString() }).eq('id', commentId);
    } else {
      const { data } = await supabase.from('nutrition_comments').insert(payload).select('id').single();
      commentId = data?.id ?? null;
    }
    await supabase.from('nutrition_entries').update({ coach_review_requested: false }).eq('id', entry.id);

    setEntries(e => ({
      ...e,
      [mealType]: {
        ...(e[mealType] ?? emptyEntry()),
        comment, rating, commentId,
        coach_review_requested: false,
        allComments: [
          ...(e[mealType]?.allComments ?? []).filter(c => c.author_id !== profile?.id),
          { id: commentId, author_id: profile?.id, author_name: profile?.name ?? '', comment, rating },
        ],
      },
    }));
  }

  const reviewRequests = isTrainer
    ? Object.values(entries).filter(e => e.coach_review_requested).length
    : 0;

  return (
    <div className={styles.wrapper}>

      {/* Top bar: tabs + trainer controls */}
      <div className={styles.topBar}>
        <div className={styles.topBarLeft}>
          <span className={styles.heading}>{lang === 'ja' ? '栄養ダイアリー' : 'Nutrition Diary'}</span>
          {isTrainer && (
            <div className={styles.viewTabs}>
              <button className={`${styles.viewTab} ${view === 'diary'  ? styles.viewTabActive : ''}`} onClick={() => setView('diary')}>
                {lang === 'ja' ? '日記' : 'Diary'}
              </button>
              <button className={`${styles.viewTab} ${view === 'stats' ? styles.viewTabActive : ''}`} onClick={() => setView('stats')}>
                {lang === 'ja' ? '概要' : 'Overview'}
              </button>
            </div>
          )}
        </div>
        {/* Player mini-stats (14-day) */}
        {!isTrainer && myStats && (
          <div className={styles.myStats}>
            <span className={styles.myStatsLabel}>{lang === 'ja' ? '直近14日' : 'Last 14d'}</span>
            <span className={styles.myStatItem}><span className={styles.myStatDot} style={{ background: '#16a34a' }} />{myStats.green}</span>
            <span className={styles.myStatItem}><span className={styles.myStatDot} style={{ background: '#d97706' }} />{myStats.yellow}</span>
            <span className={styles.myStatItem}><span className={styles.myStatDot} style={{ background: '#dc2626' }} />{myStats.red}</span>
            <span className={styles.myStatTotal}>{myStats.total} {lang === 'ja' ? '食' : 'meals'}</span>
          </div>
        )}
        {isTrainer && view === 'diary' && (
          <div className={styles.trainerControls}>
            <span className={styles.playerLabel}>{lang === 'ja' ? '選手:' : 'Player:'}</span>
            <select
              className={styles.playerSelect}
              value={viewUserId}
              onChange={ev => {
                const p = players.find(p => p.id === ev.target.value);
                setViewUserId(ev.target.value);
                setViewUserName(p?.display_name ?? '');
              }}>
              {players.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
            {reviewRequests > 0 && (
              <span className={styles.reviewBanner}>
                ❗ {reviewRequests} {lang === 'ja' ? '件のフィードバック依頼' : `meal${reviewRequests > 1 ? 's' : ''} awaiting feedback`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Upload error banner */}
      {uploadError && (
        <div style={{ background: '#fee2e2', borderBottom: '1px solid #fca5a5', padding: '8px 16px', fontSize: 13, color: '#7e0027', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          ⚠️ {uploadError}
          <button onClick={() => setUploadError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7e0027', fontSize: 16 }}>✕</button>
        </div>
      )}

      {/* ── Stats Overview (trainers only) ── */}
      {view === 'stats' && isTrainer && (
        <div className={styles.statsContent}>
          <div className={styles.statsHeader}>{lang === 'ja' ? '直近14日間の栄養記録' : 'Last 14 Days — Nutrition Submissions'}</div>
          {!statsRows ? (
            <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>
          ) : statsRows.length === 0 ? (
            <div className={styles.empty}>{lang === 'ja' ? 'データなし' : 'No data yet'}</div>
          ) : (
            <div className={styles.statsTableWrap}>
              <table className={styles.statsTable}>
                <thead>
                  <tr>
                    <th className={styles.statsThName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                    <th className={styles.statsTh}>{lang === 'ja' ? `提出 / ${MAX_MEALS}` : `Logged / ${MAX_MEALS}`}</th>
                    <th className={styles.statsTh}>🟢</th>
                    <th className={styles.statsTh}>🟡</th>
                    <th className={styles.statsTh}>🔴</th>
                    <th className={styles.statsTh}>{lang === 'ja' ? '未評価' : 'Unrated'}</th>
                  </tr>
                </thead>
                <tbody>
                  {statsRows.map((r, i) => (
                    <tr key={i} className={styles.statsTr}>
                      <td className={styles.statsTdName}>{r.name}</td>
                      <td className={styles.statsTd}>
                        <span className={`${styles.totalCell} ${r.total === 0 ? styles.totalZero : ''}`}>
                          <strong>{r.total}</strong>
                          <span className={styles.totalMax}>/{MAX_MEALS}</span>
                        </span>
                      </td>
                      <td className={styles.statsTd}>
                        {r.green > 0 ? <span className={styles.statsBadge} style={{ background: '#16a34a' }}>{r.green}</span> : <span className={styles.statsZero}>—</span>}
                      </td>
                      <td className={styles.statsTd}>
                        {r.yellow > 0 ? <span className={styles.statsBadge} style={{ background: '#d97706' }}>{r.yellow}</span> : <span className={styles.statsZero}>—</span>}
                      </td>
                      <td className={styles.statsTd}>
                        {r.red > 0 ? <span className={styles.statsBadge} style={{ background: '#dc2626' }}>{r.red}</span> : <span className={styles.statsZero}>—</span>}
                      </td>
                      <td className={styles.statsTd}>
                        {r.unrated > 0 ? <span className={styles.statsUnrated}>{r.unrated}</span> : <span className={styles.statsZero}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Diary view ── */}
      {view === 'diary' && (
        <>
          {/* 14-day strip */}
          <div className={styles.dayStrip}>
            {DAYS.map(d => {
              const date = new Date(d + 'T00:00:00');
              const isToday = d === DAYS[DAYS.length - 1];
              return (
                <button
                  key={d}
                  className={`${styles.dayPill} ${d === selectedDay ? styles.dayPillActive : ''}`}
                  onClick={() => setSelectedDay(d)}>
                  <span className={styles.dayName}>
                    {date.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { weekday: 'short' })}
                  </span>
                  <span className={styles.dayNum}>{date.getDate()}</span>
                  {isToday && <span className={styles.todayDot} />}
                </button>
              );
            })}
          </div>

          {/* Meal cards */}
          <div className={styles.mealsGrid}>
            {loading ? (
              <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>
            ) : (
              MEALS.map(meal => {
                const entry = entries[meal.id] ?? emptyEntry();
                const isOwn = viewUserId === profile?.id;
                return (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    entry={entry}
                    lang={lang}
                    isTrainer={isTrainer}
                    isOwn={isOwn}
                    uploading={!!uploading[meal.id]}
                    saving={!!saving[meal.id]}
                    onNotesChange={notes => saveNotes(meal.id, notes)}
                    onAskCoach={() => toggleAskCoach(meal.id)}
                    onPlayerRating={r => savePlayerRating(meal.id, r)}
                    onPhotoUpload={file => uploadPhoto(meal.id, file)}
                    onPhotoDelete={(id, path) => deletePhoto(meal.id, id, path)}
                    onSaveComment={(comment, rating) => saveComment(meal.id, comment, rating)}
                    onPhotoClick={url => setLightbox(url)}
                  />
                );
              })
            )}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className={styles.lightboxOverlay} onClick={() => setLightbox(null)}>
          <img src={lightbox} className={styles.lightboxImg} onClick={e => e.stopPropagation()} alt="" />
          <button className={styles.lightboxClose} onClick={() => setLightbox(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
