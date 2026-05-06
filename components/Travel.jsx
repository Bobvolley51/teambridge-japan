'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import styles from './Travel.module.css';

const EDIT_ROLES = ['Staff/Orga', 'GM', 'Headcoach'];

const ITEM_TYPES = [
  { key: 'flight',   icon: '✈️', en: 'Flight',   ja: 'フライト'     },
  { key: 'transfer', icon: '🚌', en: 'Transfer',  ja: '移動'         },
  { key: 'hotel',    icon: '🏨', en: 'Hotel',     ja: 'ホテル'       },
  { key: 'meal',     icon: '🍽️', en: 'Meal',      ja: '食事'         },
  { key: 'training', icon: '🏋️', en: 'Training',  ja: 'トレーニング' },
  { key: 'match',    icon: '🏐', en: 'Match',     ja: '試合'         },
  { key: 'recovery', icon: '🧘', en: 'Recovery',  ja: 'リカバリー'   },
  { key: 'other',    icon: '📋', en: 'Other',     ja: 'その他'       },
];

function typeInfo(key) { return ITEM_TYPES.find(t => t.key === key) ?? ITEM_TYPES[7]; }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDates(start, end) {
  const dates = [];
  let cur = start;
  const last = end ?? start;
  while (cur <= last) { dates.push(cur); cur = addDays(cur, 1); }
  return dates;
}

function fmtLong(dateStr, lang) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { weekday: 'long', month: 'long', day: 'numeric' }
  );
}

function fmtShort(dateStr, lang) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { month: 'short', day: 'numeric' }
  );
}

function getTripStatus(trip) {
  const today = new Date().toISOString().slice(0, 10);
  const end   = trip.end_date ?? trip.start_date;
  if (end < today)              return 'past';
  if (trip.start_date <= today) return 'ongoing';
  return 'upcoming';
}

function StatusBadge({ trip, lang }) {
  const s = getTripStatus(trip);
  const days = Math.ceil((new Date(trip.start_date + 'T00:00:00') - new Date()) / 86400000);
  if (s === 'past')    return <span className={`${styles.badge} ${styles.badgePast}`}>{lang === 'ja' ? '終了' : 'Past'}</span>;
  if (s === 'ongoing') return <span className={`${styles.badge} ${styles.badgeOngoing}`}>{lang === 'ja' ? '進行中' : 'Ongoing'}</span>;
  const label = days <= 0 ? (lang === 'ja' ? '今日' : 'Today')
              : days === 1 ? (lang === 'ja' ? '明日' : 'Tomorrow')
              : lang === 'ja' ? `${days}日後` : `In ${days}d`;
  const cls = days <= 1 ? styles.badgeToday : days <= 7 ? styles.badgeSoon : styles.badgeUpcoming;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── Trip Form (create/edit) ────────────────────────────────────────────────────

function TripForm({ trip, lang, currentUserName, onSave, onClose }) {
  const isNew = !trip;
  const [f, setF] = useState({
    title:         trip?.title          ?? '',
    start_date:    trip?.start_date     ?? '',
    end_date:      trip?.end_date       ?? '',
    location:      trip?.location       ?? '',
    flight_number: trip?.flight_number  ?? '',
    hotel_name:    trip?.hotel_name     ?? '',
    hotel_address: trip?.hotel_address  ?? '',
    notes:         trip?.notes          ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!f.title.trim() || !f.start_date) return;
    if (f.end_date && f.end_date < f.start_date) {
      setError(lang === 'ja' ? '終了日は開始日以降にしてください。' : 'End date must be on or after start date.');
      return;
    }
    setSaving(true);
    const payload = {
      title:         f.title.trim(),
      start_date:    f.start_date,
      end_date:      f.end_date      || null,
      location:      f.location.trim()      || null,
      flight_number: f.flight_number.trim() || null,
      hotel_name:    f.hotel_name.trim()    || null,
      hotel_address: f.hotel_address.trim() || null,
      notes:         f.notes.trim()         || null,
    };
    if (trip) {
      const { error: err } = await supabase.from('travel_trips').update(payload).eq('id', trip.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { error: err } = await supabase.from('travel_trips').insert({ ...payload, created_by: currentUserName });
      if (err) { setError(err.message); setSaving(false); return; }
    }
    onSave();
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span>{isNew ? (lang === 'ja' ? '新しい旅程' : 'New Trip') : (lang === 'ja' ? '旅程を編集' : 'Edit Trip')}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>{lang === 'ja' ? 'タイトル *' : 'Title *'}</label>
          <input className={styles.input} value={f.title} onChange={e => set('title', e.target.value)} required autoFocus
            placeholder={lang === 'ja' ? '例: アウェー戦 vs 東京' : 'e.g. Away Game vs Tokyo'} />

          <div className={styles.fieldRow}>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? '開始日 *' : 'Start *'}</label>
              <input className={styles.input} type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} required />
            </div>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? '終了日' : 'End'}</label>
              <input className={styles.input} type="date" value={f.end_date} min={f.start_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>

          <label className={styles.label}>{lang === 'ja' ? '場所' : 'Location'}</label>
          <input className={styles.input} value={f.location} onChange={e => set('location', e.target.value)}
            placeholder={lang === 'ja' ? '例: 東京' : 'e.g. Tokyo'} />

          <label className={styles.label}>{lang === 'ja' ? 'フライト番号' : 'Flight no.'}</label>
          <input className={styles.input} value={f.flight_number} onChange={e => set('flight_number', e.target.value)} placeholder="e.g. NH123" />

          <label className={styles.label}>{lang === 'ja' ? 'ホテル名' : 'Hotel name'}</label>
          <input className={styles.input} value={f.hotel_name} onChange={e => set('hotel_name', e.target.value)}
            placeholder={lang === 'ja' ? '例: 東京ホテル' : 'e.g. Toyoko Inn Tokyo'} />

          <label className={styles.label}>{lang === 'ja' ? 'ホテル住所' : 'Hotel address'}</label>
          <input className={styles.input} value={f.hotel_address} onChange={e => set('hotel_address', e.target.value)}
            placeholder={lang === 'ja' ? '例: 東京都新宿区1-1-1' : 'e.g. 1-1 Shinjuku, Tokyo'} />

          <label className={styles.label}>{lang === 'ja' ? 'メモ' : 'Notes'}</label>
          <textarea className={styles.textarea} value={f.notes} onChange={e => set('notes', e.target.value)}
            rows={2} placeholder={lang === 'ja' ? '集合場所、持ち物など...' : 'Meeting point, luggage rules…'} />

          {error && <div className={styles.formErr}>{error}</div>}
          <div className={styles.modalFoot}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Item Form (create/edit) ────────────────────────────────────────────────────

function ItemForm({ item, tripId, tripDates, lang, defaultDate, onSave, onClose }) {
  const [type,  setType]  = useState(item?.item_type ?? 'other');
  const [date,  setDate]  = useState(item?.item_date ?? defaultDate ?? tripDates[0] ?? '');
  const [time,  setTime]  = useState(item?.item_time ?? '');
  const [title, setTitle] = useState(item?.title ?? '');
  const [desc,  setDesc]  = useState(item?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const payload = { item_type: type, item_date: date, item_time: time || null, title: title.trim(), description: desc.trim() || null };
    const { error: err } = item
      ? await supabase.from('travel_items').update(payload).eq('id', item.id)
      : await supabase.from('travel_items').insert({ ...payload, trip_id: tripId });
    if (err) { setError(err.message); setSaving(false); return; }
    onSave();
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span>{item ? (lang === 'ja' ? '項目を編集' : 'Edit Item') : (lang === 'ja' ? '項目を追加' : 'Add Item')}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label}>{lang === 'ja' ? '種類' : 'Type'}</label>
          <div className={styles.typeGrid}>
            {ITEM_TYPES.map(t => (
              <button key={t.key} type="button"
                className={`${styles.typeGridBtn} ${type === t.key ? styles.typeGridActive : ''}`}
                onClick={() => setType(t.key)}>
                <span className={styles.typeGridIcon}>{t.icon}</span>
                <span className={styles.typeGridLabel}>{t[lang]}</span>
              </button>
            ))}
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? '日付' : 'Day'}</label>
              <select className={styles.input} value={date} onChange={e => setDate(e.target.value)}>
                {tripDates.map((d, i) => <option key={d} value={d}>{`Day ${i + 1} — ${fmtShort(d, lang)}`}</option>)}
              </select>
            </div>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? '時刻' : 'Time'}</label>
              <input className={styles.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <label className={styles.label}>{lang === 'ja' ? 'タイトル *' : 'Title *'}</label>
          <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)}
            required autoFocus placeholder={lang === 'ja' ? '例: 出発' : 'e.g. Bus departure'} />

          <label className={styles.label}>{lang === 'ja' ? '詳細' : 'Details'}</label>
          <textarea className={styles.textarea} value={desc} onChange={e => setDesc(e.target.value)}
            rows={2} placeholder={lang === 'ja' ? '住所、番号など...' : 'Address, notes, flight no.…'} />

          {error && <div className={styles.formErr}>{error}</div>}
          <div className={styles.modalFoot}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>{lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>{saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Quick add row (editors only) ──────────────────────────────────────────────

function QuickAdd({ tripId, date, lang, onAdded }) {
  const [type,  setType]  = useState('other');
  const [time,  setTime]  = useState('');
  const [title, setTitle] = useState('');
  const [open,  setOpen]  = useState(false);
  const [saving, setSaving] = useState(false);
  const pickerRef = useRef(null);
  const titleRef  = useRef(null);

  useEffect(() => {
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const add = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    await supabase.from('travel_items').insert({ trip_id: tripId, item_date: date, item_time: time || null, title: title.trim(), item_type: type });
    setTitle(''); setTime(''); setSaving(false);
    titleRef.current?.focus();
    onAdded();
  };

  const t = typeInfo(type);
  return (
    <div className={styles.quickAdd}>
      <div className={styles.quickAddTypeWrap} ref={pickerRef}>
        <button type="button" className={styles.quickAddTypeBtn} onClick={() => setOpen(v => !v)}>{t.icon}</button>
        {open && (
          <div className={styles.quickAddPicker}>
            {ITEM_TYPES.map(it => (
              <button key={it.key} type="button"
                className={`${styles.quickAddPickerItem} ${type === it.key ? styles.quickAddPickerActive : ''}`}
                onClick={() => { setType(it.key); setOpen(false); titleRef.current?.focus(); }}>
                {it.icon} {it[lang]}
              </button>
            ))}
          </div>
        )}
      </div>
      <input type="time" className={styles.quickAddTime} value={time} onChange={e => setTime(e.target.value)} />
      <input ref={titleRef} type="text" className={styles.quickAddTitle} value={title}
        onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()}
        placeholder={lang === 'ja' ? '項目を入力して Enter...' : 'Add item and press Enter…'} />
      <button type="button" className={styles.quickAddSubmit} disabled={!title.trim() || saving} onClick={add}>
        {saving ? '…' : '+'}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Travel({ lang = 'en', profile, currentUserName = '' }) {
  const toast   = useToast();
  const canEdit = EDIT_ROLES.includes(profile?.role);
  const userId  = profile?.id ?? null;

  const [trips,        setTrips]        = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [items,        setItems]        = useState([]);
  const [participants, setParticipants] = useState([]);
  const [allProfiles,  setAllProfiles]  = useState([]);
  const [packItems,    setPackItems]    = useState([]);
  const [myChecks,     setMyChecks]     = useState(new Set());
  const [loading,      setLoading]      = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);
  const [error,        setError]        = useState('');

  const [tripFormOpen, setTripFormOpen] = useState(false);
  const [editingTrip,  setEditingTrip]  = useState(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem,  setEditingItem]  = useState(null);
  const [addDate,      setAddDate]      = useState(null);
  const [managing,     setManaging]     = useState(false);

  // Load trip list
  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('travel_trips').select('*').order('start_date', { ascending: false });
      if (err) throw err;
      setTrips(data ?? []);
    } catch (e) {
      setError(e.message ?? 'Could not load trips');
    } finally {
      setLoading(false);
    }
  }, []);

  // Load detail data for a selected trip
  const loadTripData = useCallback(async (tripId) => {
    setLoadingData(true);
    try {
      const { data: itemsData }  = await supabase.from('travel_items')
        .select('*').eq('trip_id', tripId).order('item_date').order('item_time', { nullsFirst: false });
      setItems(itemsData ?? []);

      const { data: partsData }  = await supabase.from('travel_participants')
        .select('profile_id').eq('trip_id', tripId);
      setParticipants(partsData ?? []);

      const { data: packData }   = await supabase.from('travel_packing_items')
        .select('*').eq('trip_id', tripId).order('sort_order').order('created_at');
      setPackItems(packData ?? []);

      if (packData?.length && userId) {
        const { data: checks } = await supabase.from('travel_packing_checks')
          .select('item_id').eq('user_id', userId).in('item_id', packData.map(i => i.id));
        setMyChecks(new Set((checks ?? []).map(c => c.item_id)));
      } else {
        setMyChecks(new Set());
      }
    } finally {
      setLoadingData(false);
    }
  }, [userId]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, email, role').order('display_name')
      .then(({ data }) => { if (data) setAllProfiles(data); });
  }, []);

  useEffect(() => {
    if (selectedTrip) {
      setManaging(false);
      loadTripData(selectedTrip.id);
    } else {
      setItems([]); setParticipants([]); setPackItems([]); setMyChecks(new Set());
    }
  }, [selectedTrip?.id]);

  const deleteTrip = async (trip) => {
    if (!window.confirm(lang === 'ja' ? `「${trip.title}」を削除しますか？` : `Delete "${trip.title}"?`)) return;
    await supabase.from('travel_trips').delete().eq('id', trip.id);
    setTrips(p => p.filter(t => t.id !== trip.id));
    if (selectedTrip?.id === trip.id) setSelectedTrip(null);
    toast(lang === 'ja' ? '旅程を削除しました' : 'Trip deleted', 'info');
  };

  const deleteItem = async (item) => {
    if (!window.confirm(lang === 'ja' ? `「${item.title}」を削除しますか？` : `Delete "${item.title}"?`)) return;
    await supabase.from('travel_items').delete().eq('id', item.id);
    setItems(p => p.filter(i => i.id !== item.id));
  };

  const toggleParticipant = async (profileId) => {
    const isIn = participants.some(p => p.profile_id === profileId);
    if (isIn) {
      await supabase.from('travel_participants').delete().eq('trip_id', selectedTrip.id).eq('profile_id', profileId);
      setParticipants(p => p.filter(pt => pt.profile_id !== profileId));
    } else {
      await supabase.from('travel_participants').insert({ trip_id: selectedTrip.id, profile_id: profileId });
      setParticipants(p => [...p, { profile_id: profileId }]);
    }
  };

  const toggleCheck = async (itemId) => {
    if (!userId) return;
    const checked = myChecks.has(itemId);
    setMyChecks(prev => { const n = new Set(prev); checked ? n.delete(itemId) : n.add(itemId); return n; });
    if (checked) {
      await supabase.from('travel_packing_checks').delete().eq('item_id', itemId).eq('user_id', userId);
    } else {
      await supabase.from('travel_packing_checks').insert({ item_id: itemId, user_id: userId });
    }
  };

  const addPackItem = async (title) => {
    if (!title.trim()) return;
    await supabase.from('travel_packing_items').insert({ trip_id: selectedTrip.id, title: title.trim(), sort_order: packItems.length });
    loadTripData(selectedTrip.id);
  };

  const deletePackItem = async (id) => {
    await supabase.from('travel_packing_items').delete().eq('id', id);
    setPackItems(p => p.filter(i => i.id !== id));
  };

  const tripDates = selectedTrip ? getDates(selectedTrip.start_date, selectedTrip.end_date) : [];

  const itemsByDate = {};
  for (const item of items) {
    if (!itemsByDate[item.item_date]) itemsByDate[item.item_date] = [];
    itemsByDate[item.item_date].push(item);
  }

  return (
    <div className={styles.wrapper}>

      {/* ── Sidebar ─────────────────────────────── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>{lang === 'ja' ? '旅程' : 'Travel'}</span>
          {canEdit && (
            <button className={styles.addTripBtn} onClick={() => { setEditingTrip(null); setTripFormOpen(true); }}>
              + {lang === 'ja' ? '追加' : 'New'}
            </button>
          )}
        </div>
        <div className={styles.tripList}>
          {loading ? (
            <div className={styles.hint}>{lang === 'ja' ? '読込中...' : 'Loading…'}</div>
          ) : error ? (
            <div className={styles.hint} style={{ color: '#ef4444' }}>{error}</div>
          ) : trips.length === 0 ? (
            <div className={styles.hint}>{lang === 'ja' ? '旅程がありません。' : 'No trips yet.'}</div>
          ) : trips.map(trip => {
            const s = getTripStatus(trip);
            return (
              <div key={trip.id}
                className={`${styles.tripRow} ${selectedTrip?.id === trip.id ? styles.tripRowActive : ''} ${s === 'ongoing' ? styles.tripRowOngoing : s === 'past' ? styles.tripRowPast : ''}`}
                onClick={() => setSelectedTrip(selectedTrip?.id === trip.id ? null : trip)}>
                <div className={styles.tripRowTop}>
                  <span className={styles.tripRowTitle}>{trip.title}</span>
                  <StatusBadge trip={trip} lang={lang} />
                </div>
                <span className={styles.tripRowMeta}>
                  {fmtShort(trip.start_date, lang)}
                  {trip.end_date && trip.end_date !== trip.start_date ? ` – ${fmtShort(trip.end_date, lang)}` : ''}
                  {trip.location ? ` · ${trip.location}` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Content ─────────────────────────────── */}
      <div className={styles.content}>
        {!selectedTrip ? (
          <div className={styles.emptyState}>
            <div>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✈️</div>
              <div>{lang === 'ja' ? '旅程を選択してください。' : 'Select a trip to view the itinerary.'}</div>
            </div>
          </div>
        ) : loadingData ? (
          <div className={styles.emptyState}>
            <div style={{ color: '#9ca3af', fontSize: 13 }}>{lang === 'ja' ? '読込中...' : 'Loading…'}</div>
          </div>
        ) : (
          <div className={styles.scrollArea}>

            {/* ── Trip info card ── */}
            <div className={styles.infoCard}>
              <div className={styles.infoCardHeader}>
                <div>
                  <div className={styles.tripTitle}>
                    {selectedTrip.title}
                    <StatusBadge trip={selectedTrip} lang={lang} />
                  </div>
                  <div className={styles.tripDates}>
                    📅&nbsp;
                    {fmtShort(selectedTrip.start_date, lang)}
                    {selectedTrip.end_date && selectedTrip.end_date !== selectedTrip.start_date
                      ? ` – ${fmtShort(selectedTrip.end_date, lang)}` : ''}
                    &nbsp;·&nbsp;{tripDates.length} {lang === 'ja' ? '日間' : tripDates.length === 1 ? 'day' : 'days'}
                    {selectedTrip.location && <>&nbsp;·&nbsp;📍 {selectedTrip.location}</>}
                  </div>
                </div>
                <div className={styles.infoCardActions}>
                  {canEdit && (
                    <>
                      <button className={styles.editTripBtn} onClick={() => { setEditingTrip(selectedTrip); setTripFormOpen(true); }}>
                        ✏️ {lang === 'ja' ? '編集' : 'Edit'}
                      </button>
                      <button className={styles.deleteTripBtn} onClick={() => deleteTrip(selectedTrip)}>
                        {lang === 'ja' ? '削除' : 'Delete'}
                      </button>
                    </>
                  )}
                  <button className={styles.printBtn} onClick={() => window.print()}>
                    🖨 {lang === 'ja' ? '印刷' : 'Print'}
                  </button>
                </div>
              </div>

              {/* Logistics row */}
              <div className={styles.logisticsRow}>
                {selectedTrip.flight_number && (
                  <div className={styles.logItem}>
                    <span className={styles.logIcon}>✈️</span>
                    <div>
                      <div className={styles.logLabel}>{lang === 'ja' ? 'フライト' : 'Flight'}</div>
                      <div className={styles.logValue}>{selectedTrip.flight_number}</div>
                    </div>
                  </div>
                )}
                {selectedTrip.hotel_name && (
                  <div className={styles.logItem}>
                    <span className={styles.logIcon}>🏨</span>
                    <div>
                      <div className={styles.logLabel}>{lang === 'ja' ? 'ホテル' : 'Hotel'}</div>
                      <div className={styles.logValue}>{selectedTrip.hotel_name}</div>
                      {selectedTrip.hotel_address && (
                        <div className={styles.logSub}>{selectedTrip.hotel_address}</div>
                      )}
                    </div>
                  </div>
                )}
                {selectedTrip.notes && (
                  <div className={styles.logItem}>
                    <span className={styles.logIcon}>📋</span>
                    <div>
                      <div className={styles.logLabel}>{lang === 'ja' ? 'メモ' : 'Notes'}</div>
                      <div className={styles.logValue} style={{ whiteSpace: 'pre-wrap' }}>{selectedTrip.notes}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Participants */}
              <div className={styles.participantsRow}>
                <span className={styles.participantsLabel}>
                  👥 {lang === 'ja' ? '参加メンバー' : 'Traveling'} ({participants.length})
                </span>
                {canEdit && (
                  <button className={styles.manageBtn} onClick={() => setManaging(v => !v)}>
                    {managing ? (lang === 'ja' ? '完了' : 'Done') : (lang === 'ja' ? '管理' : 'Manage')}
                  </button>
                )}
              </div>

              {managing && canEdit ? (
                <div className={styles.participantGrid}>
                  {allProfiles.map(p => {
                    const isIn = participants.some(pt => pt.profile_id === p.id);
                    const name = p.display_name || p.email.split('@')[0];
                    return (
                      <button key={p.id}
                        className={`${styles.participantToggle} ${isIn ? styles.participantToggleOn : ''}`}
                        onClick={() => toggleParticipant(p.id)}>
                        {isIn ? '✓ ' : ''}{name}
                        {p.role && <span className={styles.toggleRole}>{p.role}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : participants.length === 0 ? (
                <div className={styles.hint} style={{ padding: '6px 0' }}>
                  {lang === 'ja' ? 'まだ参加者が登録されていません。' : 'No participants listed yet.'}
                </div>
              ) : (
                <div className={styles.avatarRow}>
                  {participants.map(p => {
                    const prof = allProfiles.find(ap => ap.id === p.profile_id);
                    const name = prof?.display_name || prof?.email?.split('@')[0] || '?';
                    return (
                      <div key={p.profile_id} className={styles.avatarChip} title={name}>
                        {name.slice(0, 2).toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── Day-by-day timetable ── */}
            <div className={styles.timetable}>
              {tripDates.length === 0 && (
                <div className={styles.hint}>{lang === 'ja' ? '日程が設定されていません。' : 'No dates set for this trip.'}</div>
              )}
              {tripDates.map((date, dayIdx) => {
                const dayItems = (itemsByDate[date] ?? []).slice().sort((a, b) => {
                  if (!a.item_time && !b.item_time) return 0;
                  if (!a.item_time) return 1;
                  if (!b.item_time) return -1;
                  return a.item_time.localeCompare(b.item_time);
                });
                return (
                  <div key={date} className={styles.daySection}>
                    <div className={styles.dayHeader}>
                      <span className={styles.dayLabel}>Day {dayIdx + 1}</span>
                      <span className={styles.dayDate}>{fmtLong(date, lang)}</span>
                      {canEdit && (
                        <button className={styles.addItemBtn} onClick={() => { setEditingItem(null); setAddDate(date); setItemFormOpen(true); }}>
                          + {lang === 'ja' ? '追加' : 'Add'}
                        </button>
                      )}
                    </div>
                    <div className={styles.dayItems}>
                      {dayItems.length === 0 ? (
                        <div className={styles.emptyDay}>{lang === 'ja' ? '予定なし' : 'Nothing scheduled'}</div>
                      ) : dayItems.map(item => {
                        const t = typeInfo(item.item_type);
                        return (
                          <div key={item.id} className={styles.rundownItem}>
                            <span className={styles.itemTypeIcon} title={t[lang]}>{t.icon}</span>
                            <div className={styles.itemTime}>{item.item_time ? item.item_time.slice(0, 5) : '—'}</div>
                            <div className={styles.itemContent}>
                              <div className={styles.itemTitle}>{item.title}</div>
                              {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                            </div>
                            {canEdit && (
                              <div className={styles.itemActions}>
                                <button className={styles.itemEditBtn}
                                  onClick={() => { setEditingItem(item); setAddDate(date); setItemFormOpen(true); }}>✏️</button>
                                <button className={styles.itemDeleteBtn} onClick={() => deleteItem(item)}>🗑️</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {canEdit && <QuickAdd tripId={selectedTrip.id} date={date} lang={lang} onAdded={() => loadTripData(selectedTrip.id)} />}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Packing list ── */}
            <PackingSection
              packItems={packItems} myChecks={myChecks}
              canEdit={canEdit} lang={lang}
              onToggle={toggleCheck}
              onAdd={addPackItem}
              onDelete={deletePackItem}
            />

          </div>
        )}
      </div>

      {/* ── Modals ── */}
      {tripFormOpen && (
        <TripForm
          trip={editingTrip} lang={lang} currentUserName={currentUserName}
          onSave={async () => {
            await loadTrips();
            if (editingTrip) {
              const { data } = await supabase.from('travel_trips').select('*').eq('id', editingTrip.id).single();
              if (data) setSelectedTrip(data);
              toast(lang === 'ja' ? '旅程を更新しました' : 'Trip updated', 'success');
            } else {
              toast(lang === 'ja' ? '旅程を作成しました' : 'Trip created', 'success');
            }
          }}
          onClose={() => setTripFormOpen(false)}
        />
      )}

      {itemFormOpen && selectedTrip && (
        <ItemForm
          item={editingItem} tripId={selectedTrip.id} tripDates={tripDates}
          lang={lang} defaultDate={addDate}
          onSave={() => { loadTripData(selectedTrip.id); toast(lang === 'ja' ? '項目を保存しました' : 'Item saved', 'success'); }}
          onClose={() => setItemFormOpen(false)}
        />
      )}
    </div>
  );
}

// ── Packing list sub-component ────────────────────────────────────────────────

function PackingSection({ packItems, myChecks, canEdit, lang, onToggle, onAdd, onDelete }) {
  const [newItem, setNewItem] = useState('');
  const [open, setOpen] = useState(false);
  const packed = packItems.filter(i => myChecks.has(i.id)).length;

  if (packItems.length === 0 && !canEdit) return null;

  return (
    <div className={styles.packSection}>
      <button className={styles.packToggle} onClick={() => setOpen(v => !v)}>
        🧳 {lang === 'ja' ? '持ち物リスト' : 'Packing List'}
        {packItems.length > 0 && (
          <span className={`${styles.packProgress} ${packed === packItems.length ? styles.packProgressDone : ''}`}>
            {packed}/{packItems.length}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: '#9ca3af' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.packBody}>
          {packItems.length === 0 ? (
            <div className={styles.hint}>{lang === 'ja' ? 'まだ持ち物がありません。' : 'No items yet.'}</div>
          ) : (
            <div className={styles.packingList}>
              {packItems.map(item => {
                const checked = myChecks.has(item.id);
                return (
                  <div key={item.id} className={`${styles.packingItem} ${checked ? styles.packingItemDone : ''}`}>
                    <button className={`${styles.packCheckbox} ${checked ? styles.packCheckboxDone : ''}`}
                      onClick={() => onToggle(item.id)}>{checked ? '✓' : ''}</button>
                    <span className={styles.packTitle}>{item.title}</span>
                    {canEdit && (
                      <button className={styles.packDeleteBtn} onClick={() => onDelete(item.id)}>×</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {canEdit && (
            <div className={styles.packAddRow}>
              <input className={styles.packInput} value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { onAdd(newItem); setNewItem(''); } }}
                placeholder={lang === 'ja' ? 'パスポート、ユニフォーム… Enter' : 'Passport, jersey… Enter to add'} />
              <button className={styles.packAddBtn} disabled={!newItem.trim()}
                onClick={() => { onAdd(newItem); setNewItem(''); }}>+</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
