'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { toJstDate, dateToYmd } from '@/lib/date';
import { useTranslated } from '@/lib/translate';
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

const TRAINER_ROLES = ['Athletic Trainer', 'Therapist', 'Headcoach', 'Coaching Staff', 'GM / Director'];
const POSITIONS = ['Setter', 'Outside Hitter', 'Opposite', 'Middle Blocker', 'Libero'];

function playerFullLabel(p) {
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || p.display_name || '—';
  return p.jersey_number != null ? `#${p.jersey_number} ${name}` : name;
}

function getLast14Days() {
  const days = [];
  const today = toJstDate(new Date());
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(dateToYmd(d));
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
  const translatedNotes = useTranslated(entry.notes, lang);
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
    if (comment !== entry.comment || rating !== entry.rating || entry.coach_review_requested) onSaveComment(comment, rating);
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
            {p.createdAt && (
              <div className={styles.photoTimestamp}>
                {new Date(p.createdAt).toLocaleTimeString(lang === 'ja' ? 'ja-JP' : 'en-GB', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
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
          ? <div className={styles.notesRead}>{translatedNotes}</div>
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
export default function NutritionDashboard({ lang, profile, onBadgeCount }) {
  const isTrainer = TRAINER_ROLES.includes(profile?.role);
  const DAYS = useMemo(() => getLast14Days(), []);

  const [view,         setView]         = useState(isTrainer ? 'stats' : 'diary');
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
  const [statsRows,        setStatsRows]        = useState(null); // null = not loaded yet
  const [myStats,          setMyStats]          = useState(null); // player's own 14-day summary
  const [positionFilter,   setPositionFilter]   = useState('');
  const [unratedPlayerIds, setUnratedPlayerIds] = useState(new Set());
  const [unratedDays,      setUnratedDays]      = useState(new Set());
  const [feedbackWatchIds, setFeedbackWatchIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('nutrition_feedback_watch') ?? '[]')); }
    catch { return new Set(); }
  });
  const [pendingFilter,          setPendingFilter]          = useState(false);
  const [reviewRequestPlayerIds, setReviewRequestPlayerIds] = useState(new Set());
  const [reviewRequestDays,      setReviewRequestDays]      = useState(new Set());
  const [allRequests,            setAllRequests]            = useState(null);

  // Load player list + unrated-player set + review-request set for trainer dropdown
  useEffect(() => {
    if (!isTrainer) return;
    Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, display_name, jersey_number, position').eq('role', 'Player'),
      supabase.from('nutrition_entries').select('user_id').is('player_rating', null).gte('meal_date', DAYS[0]),
      supabase.from('nutrition_entries').select('user_id').eq('coach_review_requested', true).gte('meal_date', DAYS[0]),
    ]).then(([{ data: playerData }, { data: unratedData }, { data: reviewData }]) => {
      const sorted = (playerData ?? []).slice().sort((a, b) => (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999));
      setPlayers(sorted);
      setUnratedPlayerIds(new Set((unratedData ?? []).map(e => e.user_id)));
      setReviewRequestPlayerIds(new Set((reviewData ?? []).map(e => e.user_id)));
    });
  }, [isTrainer]);

  // Load which days have unrated or review-requested entries for the currently viewed player
  useEffect(() => {
    if (!isTrainer || !viewUserId) return;
    Promise.all([
      supabase.from('nutrition_entries').select('meal_date, player_rating').eq('user_id', viewUserId).gte('meal_date', DAYS[0]),
      supabase.from('nutrition_entries').select('meal_date').eq('user_id', viewUserId).eq('coach_review_requested', true).gte('meal_date', DAYS[0]),
    ]).then(([{ data: entryData }, { data: reqData }]) => {
      setUnratedDays(new Set((entryData ?? []).filter(e => !e.player_rating).map(e => e.meal_date)));
      setReviewRequestDays(new Set((reqData ?? []).map(e => e.meal_date)));
    });
  }, [viewUserId, isTrainer]);

  // Report pending request count to parent for nav badge
  useEffect(() => {
    onBadgeCount?.(reviewRequestPlayerIds.size);
  }, [reviewRequestPlayerIds.size, onBadgeCount]);

  const MAX_MEALS = DAYS.length * MEALS.length; // 14 days × 4 meals = 56

  // Real-time listener: keep reviewRequestPlayerIds in sync while the app is open.
  // Push notifications (via service worker) handle out-of-band delivery.
  useEffect(() => {
    if (!isTrainer) return;
    // Ask for notification permission now so syncPushSubscription can subscribe silently.
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    const channel = supabase
      .channel('nutrition-review-requests')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'nutrition_entries',
        filter: 'coach_review_requested=eq.true',
      }, (payload) => {
        const playerId = payload.new?.user_id;
        if (playerId) setReviewRequestPlayerIds(prev => new Set([...prev, playerId]));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isTrainer]);

  const toggleFeedbackWatch = useCallback((id) => {
    setFeedbackWatchIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem('nutrition_feedback_watch', JSON.stringify([...next])); } catch {}
      return next;
    });
  }, []);

  const loadAllRequests = useCallback(async () => {
    const { data } = await supabase
      .from('nutrition_entries')
      .select('id, user_id, meal_date, meal_type')
      .eq('coach_review_requested', true)
      .gte('meal_date', DAYS[0])
      .order('meal_date', { ascending: false });
    const enriched = (data ?? []).map(e => {
      const p = players.find(pl => pl.id === e.user_id);
      const m = MEALS.find(m => m.id === e.meal_type);
      return { ...e, playerLabel: p ? playerFullLabel(p) : '—', mealLabel: lang === 'ja' ? m?.ja : m?.en, mealIcon: m?.icon ?? '' };
    });
    setAllRequests(enriched);
  }, [players, lang, DAYS]);

  useEffect(() => {
    if (view === 'requests' && isTrainer) loadAllRequests();
  }, [view, loadAllRequests, isTrainer]);

  // Load stats overview (trainers: all players; players: own summary)
  const loadStats = useCallback(async () => {
    const since = DAYS[0];
    if (isTrainer) {
      const [{ data: allPlayers }, { data: entries }] = await Promise.all([
        supabase.from('profiles').select('id, first_name, last_name, display_name, jersey_number, position').eq('role', 'Player'),
        supabase.from('nutrition_entries').select('user_id, player_rating').gte('meal_date', since),
      ]);
      if (!allPlayers) return;
      const sortedPlayers = allPlayers.slice().sort((a, b) => (a.jersey_number ?? 9999) - (b.jersey_number ?? 9999));
      const map = {};
      for (const p of sortedPlayers) {
        map[p.id] = { id: p.id, name: playerFullLabel(p), position: p.position ?? '', total: 0, green: 0, yellow: 0, red: 0, unrated: 0 };
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
      // Preserve jersey sort order from sortedPlayers
      setStatsRows(sortedPlayers.map(p => map[p.id]).filter(Boolean));
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
      .select('id, meal_type, notes, coach_review_requested, player_rating, nutrition_photos(id, storage_path, created_at), nutrition_comments(id, author_id, author_name, comment, rating)')
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
          createdAt: p.created_at,
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
    const cutoff = toJstDate(new Date());
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = dateToYmd(cutoff);
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
      const { data: trainers } = await supabase.from('profiles').select('id').in('role', ['Athletic Trainer', 'Therapist']);
      if (trainers?.length) {
        const meal = MEALS.find(m => m.id === mealType);
        const title = lang === 'ja' ? '栄養フィードバック依頼' : 'Nutrition Feedback Request';
        const body  = `${viewUserName} — ${lang === 'ja' ? meal?.ja : meal?.en}`;
        await supabase.from('notifications').insert(
          trainers.map(t => ({
            user_id:    t.id,
            type:       'nutrition',
            title,
            body,
            nav_target: 'nutrition',
            ref_id:     id,
          }))
        );
        // Fire-and-forget push to trainers — works even when the app tab is closed
        fetch('/api/push', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            userIds: trainers.map(t => t.id),
            title,
            body,
            url:    '/?nav=nutrition',
            tag:    `nutrition-feedback-${id}`,
            prefKey: 'nutrition',
          }),
        }).catch(() => {});
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

    // Immediately remove processed request from UI state so navigating back to Requests
    // doesn't show stale data (avoids race with loadAllRequests re-querying the DB).
    const entryId = entry.id;
    const userId = viewUserId;
    setAllRequests(prev => (prev === null ? null : prev.filter(r => r.id !== entryId)));
    if (allRequests !== null && !allRequests.some(r => r.user_id === userId && r.id !== entryId)) {
      setReviewRequestPlayerIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
    }
    setReviewRequestDays(prev => { const n = new Set(prev); n.delete(selectedDay); return n; });

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
              <button className={`${styles.viewTab} ${view === 'diary'    ? styles.viewTabActive : ''}`} onClick={() => setView('diary')}>
                {lang === 'ja' ? '日記' : 'Diary'}
              </button>
              <button className={`${styles.viewTab} ${view === 'stats'   ? styles.viewTabActive : ''}`} onClick={() => setView('stats')}>
                {lang === 'ja' ? '概要' : 'Overview'}
              </button>
              <button className={`${styles.viewTab} ${view === 'requests' ? styles.viewTabActive : ''} ${reviewRequestPlayerIds.size > 0 ? styles.viewTabAlert : ''}`} onClick={() => setView('requests')}>
                {lang === 'ja' ? '依頼' : 'Requests'}
                {reviewRequestPlayerIds.size > 0 && <span className={styles.tabBadge}>{reviewRequestPlayerIds.size}</span>}
              </button>
            </div>
          )}
        </div>
        {/* Player mini-stats (14-day) */}
        {!isTrainer && myStats && (() => {
          const rated = myStats.green + myStats.yellow + myStats.red;
          const pct = (n) => rated > 0 ? Math.round(n / rated * 100) : 0;
          return (
          <div className={styles.myStats}>
            <span className={styles.myStatsLabel}>{lang === 'ja' ? '直近14日' : 'Last 14d'}</span>
            <span className={styles.myStatItem}><span className={styles.myStatDot} style={{ background: '#16a34a' }} />{myStats.green}{rated > 0 && <span className={styles.myStatPct}>{pct(myStats.green)}%</span>}</span>
            <span className={styles.myStatItem}><span className={styles.myStatDot} style={{ background: '#d97706' }} />{myStats.yellow}{rated > 0 && <span className={styles.myStatPct}>{pct(myStats.yellow)}%</span>}</span>
            <span className={styles.myStatItem}><span className={styles.myStatDot} style={{ background: '#dc2626' }} />{myStats.red}{rated > 0 && <span className={styles.myStatPct}>{pct(myStats.red)}%</span>}</span>
            <span className={styles.myStatTotal}>{myStats.total} {lang === 'ja' ? '食' : 'meals'}</span>
          </div>
          );
        })()}
        {isTrainer && view === 'diary' && (
          <div className={styles.trainerControls}>
            <span className={styles.playerLabel}>{lang === 'ja' ? '選手:' : 'Player:'}</span>
            <div className={styles.playerSelectWrap}>
              <select
                className={`${styles.playerSelect} ${reviewRequestPlayerIds.has(viewUserId) || (feedbackWatchIds.has(viewUserId) && unratedPlayerIds.has(viewUserId)) ? styles.playerSelectUnrated : ''}`}
                value={viewUserId}
                onChange={ev => {
                  const p = players.find(p => p.id === ev.target.value);
                  setViewUserId(ev.target.value);
                  setViewUserName(p?.display_name ?? '');
                }}>
                {[...players.filter(p => reviewRequestPlayerIds.has(p.id)), ...players.filter(p => !reviewRequestPlayerIds.has(p.id))].map(p => (
                  <option key={p.id} value={p.id}>
                    {reviewRequestPlayerIds.has(p.id) ? '❗ ' : feedbackWatchIds.has(p.id) && unratedPlayerIds.has(p.id) ? '⚠ ' : ''}{playerFullLabel(p)}
                  </option>
                ))}
              </select>
              <button
                className={`${styles.watchBtn} ${feedbackWatchIds.has(viewUserId) ? styles.watchBtnOn : ''}`}
                onClick={() => toggleFeedbackWatch(viewUserId)}
                title={feedbackWatchIds.has(viewUserId) ? (lang === 'ja' ? '監視解除' : 'Unwatch') : (lang === 'ja' ? '確認待ちに追加' : 'Watch for pending feedback')}>
                {feedbackWatchIds.has(viewUserId) ? '★' : '☆'}
              </button>
              {reviewRequestPlayerIds.has(viewUserId) ? (
                <span className={styles.reviewRequestBadge}>
                  ❗ {lang === 'ja' ? 'フィードバック依頼中' : 'Feedback requested'}
                </span>
              ) : feedbackWatchIds.has(viewUserId) && unratedPlayerIds.has(viewUserId) ? (
                <span className={styles.unratedBadge}>
                  {lang === 'ja' ? '未評価あり' : 'Unrated'}
                </span>
              ) : null}
            </div>
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
          <div className={styles.filterBar}>
            <span className={styles.filterLabel}>{lang === 'ja' ? 'ポジション' : 'Position'}</span>
            <div className={styles.filterBtns}>
              <button className={`${styles.filterBtn} ${!positionFilter ? styles.filterBtnActive : ''}`} onClick={() => setPositionFilter('')}>
                {lang === 'ja' ? '全員' : 'All'}
              </button>
              {POSITIONS.map(pos => (
                <button key={pos} className={`${styles.filterBtn} ${positionFilter === pos ? styles.filterBtnActive : ''}`} onClick={() => setPositionFilter(p => p === pos ? '' : pos)}>
                  {pos}
                </button>
              ))}
            </div>
            <span className={styles.filterSep} />
            <button
              className={`${styles.filterBtn} ${pendingFilter ? styles.filterBtnPending : ''}`}
              onClick={() => setPendingFilter(p => !p)}>
              ★ {lang === 'ja' ? '確認待ち' : 'Pending'}
            </button>
          </div>
          {!statsRows ? (
            <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>
          ) : (() => {
            const filtered = statsRows
              .filter(r => !positionFilter || r.position === positionFilter)
              .filter(r => !pendingFilter || reviewRequestPlayerIds.has(r.id) || (feedbackWatchIds.has(r.id) && r.unrated > 0));
            const visible = [
              ...filtered.filter(r => reviewRequestPlayerIds.has(r.id)),
              ...filtered.filter(r => !reviewRequestPlayerIds.has(r.id)),
            ];
            return visible.length === 0 ? (
              <div className={styles.empty}>{lang === 'ja' ? 'データなし' : 'No data yet'}</div>
            ) : (
            <div className={styles.statsTableWrap}>
              <table className={styles.statsTable}>
                <thead>
                  <tr>
                    <th className={styles.statsTh} title={lang === 'ja' ? 'フィードバック監視' : 'Watch for feedback'}>★</th>
                    <th className={styles.statsThName}>{lang === 'ja' ? '選手' : 'Player'}</th>
                    <th className={styles.statsTh}>{lang === 'ja' ? `提出 / ${MAX_MEALS}` : `Logged / ${MAX_MEALS}`}</th>
                    <th className={styles.statsThBar}>{lang === 'ja' ? '評価の内訳' : 'Rating breakdown'}</th>
                    <th className={styles.statsTh}>🟢</th>
                    <th className={styles.statsTh}>🟡</th>
                    <th className={styles.statsTh}>🔴</th>
                    <th className={styles.statsTh}>{lang === 'ja' ? '未評価' : 'Unrated'}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r, i) => {
                    const rated = r.green + r.yellow + r.red;
                    const ratedPct = r.total > 0 ? Math.round(rated / r.total * 100) : 0;
                    const gPct = rated > 0 ? r.green / rated * 100 : 0;
                    const yPct = rated > 0 ? r.yellow / rated * 100 : 0;
                    const rPct = rated > 0 ? r.red / rated * 100 : 0;
                    return (
                      <tr key={i} className={`${styles.statsTr} ${reviewRequestPlayerIds.has(r.id) ? styles.statsTrRequested : feedbackWatchIds.has(r.id) && r.unrated > 0 ? styles.statsTrPending : ''}`}>
                        <td className={styles.statsTd}>
                          <button
                            className={`${styles.watchBtn} ${feedbackWatchIds.has(r.id) || reviewRequestPlayerIds.has(r.id) ? styles.watchBtnOn : ''}`}
                            onClick={() => toggleFeedbackWatch(r.id)}
                            title={feedbackWatchIds.has(r.id) ? (lang === 'ja' ? '監視解除' : 'Unwatch') : (lang === 'ja' ? '確認待ちに追加' : 'Watch for pending feedback')}>
                            {reviewRequestPlayerIds.has(r.id) ? '❗' : feedbackWatchIds.has(r.id) ? '★' : '☆'}
                          </button>
                        </td>
                        <td className={styles.statsTdName}>{r.name}</td>
                        <td className={styles.statsTd}>
                          <span className={`${styles.totalCell} ${r.total === 0 ? styles.totalZero : ''}`}>
                            <strong>{r.total}</strong>
                            <span className={styles.totalMax}>/{MAX_MEALS}</span>
                          </span>
                        </td>
                        <td className={styles.statsTdBar}>
                          {r.total === 0 ? (
                            <span className={styles.statsZero}>—</span>
                          ) : (
                            <div className={styles.ratingBarWrap}>
                              <div className={styles.ratingBar}>
                                {gPct > 0 && <div className={styles.ratingBarGreen}  style={{ width: `${gPct}%` }} />}
                                {yPct > 0 && <div className={styles.ratingBarYellow} style={{ width: `${yPct}%` }} />}
                                {rPct > 0 && <div className={styles.ratingBarRed}    style={{ width: `${rPct}%` }} />}
                                {ratedPct < 100 && <div className={styles.ratingBarUnrated} style={{ width: `${100 - ratedPct}%` }} />}
                              </div>
                              <span className={styles.ratedPct}>
                                {rated > 0
                                  ? <><span style={{ color: '#16a34a' }}>{Math.round(gPct)}%</span>{' / '}<span style={{ color: '#d97706' }}>{Math.round(yPct)}%</span>{' / '}<span style={{ color: '#dc2626' }}>{Math.round(rPct)}%</span></>
                                  : `${ratedPct}% rated`
                                }
                              </span>
                            </div>
                          )}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
            );
          })()}
        </div>
      )}

      {/* ── Requests view ── */}
      {view === 'requests' && isTrainer && (
        <div className={styles.statsContent}>
          <div className={styles.statsHeader}>
            {lang === 'ja' ? 'フィードバック依頼一覧（直近14日）' : 'Pending Feedback Requests — Last 14 Days'}
          </div>
          {allRequests === null ? (
            <div className={styles.empty}>{lang === 'ja' ? '読み込み中…' : 'Loading…'}</div>
          ) : allRequests.length === 0 ? (
            <div className={styles.empty}>{lang === 'ja' ? '依頼はありません' : 'No pending requests'}</div>
          ) : (
            <div className={styles.requestsList}>
              {allRequests.map((r, i) => (
                <button
                  key={r.id}
                  className={styles.requestItem}
                  onClick={() => { setViewUserId(r.user_id); setSelectedDay(r.meal_date); setView('diary'); }}>
                  <span className={styles.requestItemIcon}>{r.mealIcon}</span>
                  <span className={styles.requestItemBody}>
                    <span className={styles.requestItemName}>{r.playerLabel}</span>
                    <span className={styles.requestItemMeta}>
                      {r.mealLabel} · {new Date(r.meal_date + 'T00:00:00').toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-US', { month: 'short', day: 'numeric', weekday: 'short' })}
                    </span>
                  </span>
                  <span className={styles.requestItemArrow}>›</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Diary view ── */}
      {view === 'diary' && (
        <>
          {/* 14-day strip */}
          <div className={styles.dayStrip}>
            {[...DAYS].reverse().map(d => {
              const date = new Date(d + 'T00:00:00');
              const isToday = d === DAYS[DAYS.length - 1];
              return (
                <button
                  key={d}
                  className={`${styles.dayPill} ${d === selectedDay ? styles.dayPillActive : isTrainer && reviewRequestDays.has(d) ? styles.dayPillRequested : isTrainer && unratedDays.has(d) ? styles.dayPillUnrated : ''}`}
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
