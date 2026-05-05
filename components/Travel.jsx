'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { SkeletonCardBlock } from './Skeleton';
import styles from './Travel.module.css';

const EDIT_ROLES = ['GM', 'Headcoach', 'Athletic', 'Therapist', 'Staff/Orga'];

function buildTemplate(startDate, lang) {
  const d0 = startDate;
  const d1 = addDays(startDate, 1);
  const d2 = addDays(startDate, 2);
  const j = lang === 'ja';
  return [
    { item_date: d0, item_time: null,    item_type: 'other',    title: j ? '集合' : 'Team meeting' },
    { item_date: d0, item_time: null,    item_type: 'transfer', title: j ? '出発（バス）' : 'Bus departure' },
    { item_date: d0, item_time: null,    item_type: 'flight',   title: j ? 'フライト' : 'Flight' },
    { item_date: d0, item_time: null,    item_type: 'hotel',    title: j ? 'ホテルチェックイン' : 'Hotel check-in' },
    { item_date: d0, item_time: null,    item_type: 'meal',     title: j ? 'チームディナー' : 'Team dinner' },
    { item_date: d1, item_time: '09:00', item_type: 'recovery', title: j ? '朝の活性化' : 'Morning activation' },
    { item_date: d1, item_time: '12:00', item_type: 'meal',     title: j ? '試合前食事' : 'Pre-match meal' },
    { item_date: d1, item_time: null,    item_type: 'training', title: j ? 'ウォームアップ' : 'Warm-up' },
    { item_date: d1, item_time: null,    item_type: 'match',    title: j ? '試合' : 'Match' },
    { item_date: d1, item_time: null,    item_type: 'meal',     title: j ? '試合後食事' : 'Post-match meal' },
    { item_date: d2, item_time: '09:00', item_type: 'recovery', title: j ? '朝の活性化' : 'Morning activation' },
    { item_date: d2, item_time: '12:00', item_type: 'meal',     title: j ? '試合前食事' : 'Pre-match meal' },
    { item_date: d2, item_time: null,    item_type: 'training', title: j ? 'ウォームアップ' : 'Warm-up' },
    { item_date: d2, item_time: null,    item_type: 'match',    title: j ? '試合' : 'Match' },
    { item_date: d2, item_time: null,    item_type: 'flight',   title: j ? '帰りのフライト' : 'Return flight' },
  ];
}

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
function pad(n) { return String(n).padStart(2, '0'); }

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function getDates(startDate, endDate) {
  const dates = [];
  let cur = startDate;
  const last = endDate ?? startDate;
  while (cur <= last) { dates.push(cur); cur = addDays(cur, 1); }
  return dates;
}

function fmtFull(dateStr, lang) {
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

// ── Status helpers ────────────────────────────────────────────────────────────

function getTripStatus(trip) {
  const today = new Date().toISOString().slice(0, 10);
  const end   = trip.end_date ?? trip.start_date;
  if (end < today) return { status: 'past' };
  if (trip.start_date <= today) return { status: 'ongoing' };
  return { status: 'upcoming', days: Math.ceil((new Date(trip.start_date + 'T00:00:00') - new Date()) / 86400000) };
}

function StatusBadge({ trip, lang }) {
  const { status, days } = getTripStatus(trip);
  if (status === 'past')    return <span className={`${styles.badge} ${styles.badgePast}`}>{lang === 'ja' ? '終了' : 'Past'}</span>;
  if (status === 'ongoing') return <span className={`${styles.badge} ${styles.badgeOngoing}`}>{lang === 'ja' ? '進行中' : 'Ongoing'}</span>;
  const label = days === 0 ? (lang === 'ja' ? '今日' : 'Today')
              : days === 1 ? (lang === 'ja' ? '明日' : 'Tomorrow')
              : lang === 'ja' ? `${days}日後` : `In ${days}d`;
  const cls = days <= 1 ? styles.badgeToday : days <= 7 ? styles.badgeSoon : styles.badgeUpcoming;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── Type Picker ───────────────────────────────────────────────────────────────

function TypePicker({ value, onChange, lang }) {
  return (
    <div className={styles.typeGrid}>
      {ITEM_TYPES.map(t => (
        <button key={t.key} type="button"
          className={`${styles.typeGridBtn} ${value === t.key ? styles.typeGridActive : ''}`}
          onClick={() => onChange(t.key)}>
          <span className={styles.typeGridIcon}>{t.icon}</span>
          <span className={styles.typeGridLabel}>{t[lang]}</span>
        </button>
      ))}
    </div>
  );
}

// ── Trip Modal ────────────────────────────────────────────────────────────────

function TripModal({ trip, lang, currentUserName, onSave, onClose }) {
  const isNew = !trip;
  const [title,        setTitle]        = useState(trip?.title          ?? '');
  const [startDate,    setStartDate]    = useState(trip?.start_date     ?? '');
  const [endDate,      setEndDate]      = useState(trip?.end_date       ?? '');
  const [location,     setLocation]     = useState(trip?.location       ?? '');
  const [flightNumber, setFlightNumber] = useState(trip?.flight_number  ?? '');
  const [hotelName,    setHotelName]    = useState(trip?.hotel_name     ?? '');
  const [hotelAddress, setHotelAddress] = useState(trip?.hotel_address  ?? '');
  const [notes,        setNotes]        = useState(trip?.notes          ?? '');
  const [useTemplate,  setUseTemplate]  = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState(null);

  const handleTemplateToggle = (checked) => {
    setUseTemplate(checked);
    if (checked && startDate) setEndDate(addDays(startDate, 2));
  };

  const handleStartChange = (val) => {
    setStartDate(val);
    if (useTemplate && val) setEndDate(addDays(val, 2));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const effEnd = useTemplate && startDate ? addDays(startDate, 2) : endDate;
    if (effEnd && effEnd < startDate) {
      setError(lang === 'ja' ? '終了日は開始日以降にしてください。' : 'End date must be on or after start date.');
      return;
    }
    setSaving(true);
    const payload = {
      title:          title.trim(),
      start_date:     startDate,
      end_date:       effEnd || null,
      location:       location.trim()     || null,
      flight_number:  flightNumber.trim() || null,
      hotel_name:     hotelName.trim()    || null,
      hotel_address:  hotelAddress.trim() || null,
      notes:          notes.trim()        || null,
    };

    if (trip) {
      const { error: err } = await supabase.from('travel_trips').update(payload).eq('id', trip.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      const { data: newTrip, error: err } = await supabase
        .from('travel_trips').insert({ ...payload, created_by: currentUserName }).select().single();
      if (err) { setError(err.message); setSaving(false); return; }
      if (useTemplate && newTrip) {
        await supabase.from('travel_items').insert(
          buildTemplate(startDate, lang).map(it => ({ ...it, trip_id: newTrip.id }))
        );
      }
    }
    onSave(); onClose();
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span>{trip ? (lang === 'ja' ? '旅程を編集' : 'Edit Trip') : (lang === 'ja' ? '新しい旅程' : 'New Trip')}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form className={styles.form} onSubmit={handleSubmit}>
          {isNew && (
            <label className={styles.templateToggle}>
              <input type="checkbox" checked={useTemplate} onChange={e => handleTemplateToggle(e.target.checked)} />
              <span className={styles.templateLabel}>🏐 {lang === 'ja' ? '3日間アウェー戦テンプレートを使用' : 'Use 3-day away game template'}</span>
            </label>
          )}

          <label className={styles.label}>{lang === 'ja' ? 'タイトル *' : 'Title *'}</label>
          <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)}
            required autoFocus placeholder={lang === 'ja' ? '例: アウェー戦 vs 東京' : 'e.g. Away Game vs Tokyo'} />

          <div className={styles.fieldRow}>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? '開始日 *' : 'Start *'}</label>
              <input className={styles.input} type="date" value={startDate}
                onChange={e => handleStartChange(e.target.value)} required />
            </div>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? '終了日' : 'End'}</label>
              <input className={styles.input} type="date" value={endDate}
                min={startDate} disabled={useTemplate} onChange={e => setEndDate(e.target.value)} />
              {useTemplate && <span className={styles.templateHint}>+2 days (auto)</span>}
            </div>
          </div>

          <label className={styles.label}>{lang === 'ja' ? '場所' : 'Location'}</label>
          <input className={styles.input} value={location} onChange={e => setLocation(e.target.value)}
            placeholder={lang === 'ja' ? '例: 東京' : 'e.g. Tokyo'} />

          <div className={styles.fieldRow}>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? 'フライト番号' : 'Flight no.'}</label>
              <input className={styles.input} value={flightNumber} onChange={e => setFlightNumber(e.target.value)}
                placeholder="e.g. NH123" />
            </div>
            <div className={styles.fieldCol}>
              <label className={styles.label}>{lang === 'ja' ? 'ホテル名' : 'Hotel name'}</label>
              <input className={styles.input} value={hotelName} onChange={e => setHotelName(e.target.value)}
                placeholder={lang === 'ja' ? '例: 東京ホテル' : 'e.g. Tokyo Hotel'} />
            </div>
          </div>

          <label className={styles.label}>{lang === 'ja' ? 'ホテル住所' : 'Hotel address'}</label>
          <input className={styles.input} value={hotelAddress} onChange={e => setHotelAddress(e.target.value)}
            placeholder={lang === 'ja' ? '例: 東京都渋谷区...' : 'e.g. 1-1 Shibuya, Tokyo'} />

          <label className={styles.label}>{lang === 'ja' ? 'メモ' : 'Notes'}</label>
          <textarea className={styles.textarea} value={notes} onChange={e => setNotes(e.target.value)}
            rows={2} placeholder={lang === 'ja' ? '集合場所、持ち物など...' : 'Meeting point, notes...'} />

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

// ── Item Modal ────────────────────────────────────────────────────────────────

function ItemModal({ item, tripId, tripDates, lang, defaultDate, defaultType, onSave, onClose }) {
  const [itemType, setItemType] = useState(item?.item_type ?? defaultType ?? 'other');
  const [date,     setDate]     = useState(item?.item_date ?? defaultDate ?? tripDates[0] ?? '');
  const [time,     setTime]     = useState(item?.item_time ?? '');
  const [title,    setTitle]    = useState(item?.title ?? '');
  const [desc,     setDesc]     = useState(item?.description ?? '');
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { item_type: itemType, item_date: date, item_time: time || null, title: title.trim(), description: desc.trim() || null };
    const { error: err } = item
      ? await supabase.from('travel_items').update(payload).eq('id', item.id)
      : await supabase.from('travel_items').insert({ ...payload, trip_id: tripId });
    if (err) { setError(err.message); setSaving(false); return; }
    onSave(); onClose();
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
          <TypePicker value={itemType} onChange={setItemType} lang={lang} />
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
            required autoFocus placeholder={lang === 'ja' ? '例: 出発' : 'e.g. Departure'} />
          <label className={styles.label}>{lang === 'ja' ? '詳細' : 'Details'}</label>
          <textarea className={styles.textarea} value={desc} onChange={e => setDesc(e.target.value)}
            rows={2} placeholder={lang === 'ja' ? '集合場所、持ち物など...' : 'Meeting point, notes...'} />
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

// ── Quick Add Row ─────────────────────────────────────────────────────────────

function QuickAdd({ tripId, date, lang, onAdded }) {
  const [type,       setType]       = useState('other');
  const [time,       setTime]       = useState('');
  const [title,      setTitle]      = useState('');
  const [saving,     setSaving]     = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const titleRef  = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleAdd = async () => {
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
        <button type="button" className={styles.quickAddTypeBtn}
          onClick={() => setPickerOpen(v => !v)} title={lang === 'ja' ? '種類を選択' : 'Select type'}>
          {t.icon}
        </button>
        {pickerOpen && (
          <div className={styles.quickAddPicker}>
            {ITEM_TYPES.map(it => (
              <button key={it.key} type="button"
                className={`${styles.quickAddPickerItem} ${type === it.key ? styles.quickAddPickerActive : ''}`}
                onClick={() => { setType(it.key); setPickerOpen(false); titleRef.current?.focus(); }}>
                {it.icon} {it[lang]}
              </button>
            ))}
          </div>
        )}
      </div>
      <input type="time" className={styles.quickAddTime} value={time} onChange={e => setTime(e.target.value)} />
      <input ref={titleRef} type="text" className={styles.quickAddTitle}
        value={title} onChange={e => setTitle(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && handleAdd()}
        placeholder={lang === 'ja' ? '項目を入力して Enter...' : 'Add item and press Enter…'} />
      <button type="button" className={styles.quickAddSubmit}
        disabled={!title.trim() || saving} onClick={handleAdd}>
        {saving ? '…' : '+'}
      </button>
    </div>
  );
}

// ── Participants Section ──────────────────────────────────────────────────────

function ParticipantsSection({ trip, participants, allProfiles, canEdit, lang, onUpdate }) {
  const [managing, setManaging] = useState(false);

  const toggle = async (profileId) => {
    const isIn = participants.some(p => p.profile_id === profileId);
    if (isIn) {
      await supabase.from('travel_participants').delete().eq('trip_id', trip.id).eq('profile_id', profileId);
    } else {
      await supabase.from('travel_participants').insert({ trip_id: trip.id, profile_id: profileId });
    }
    onUpdate();
  };

  return (
    <div className={styles.infoSection}>
      <div className={styles.infoSectionHead}>
        <span className={styles.infoSectionTitle}>👥 {lang === 'ja' ? '参加メンバー' : 'Traveling'}</span>
        <span className={styles.infoSectionCount}>{participants.length}</span>
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
                onClick={() => toggle(p.id)}>
                {isIn ? '✓ ' : ''}{name}
                {p.role && <span className={styles.toggleRole}>{p.role}</span>}
              </button>
            );
          })}
        </div>
      ) : participants.length === 0 ? (
        <p className={styles.infoEmpty}>{lang === 'ja' ? '参加者が登録されていません。' : 'No participants listed yet.'}</p>
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
  );
}

// ── Packing Section ───────────────────────────────────────────────────────────

function PackingSection({ trip, packingItems, myChecks, setMyChecks, canEdit, userId, lang, onUpdate }) {
  const [newItem, setNewItem] = useState('');
  const [saving,  setSaving]  = useState(false);

  const addItem = async () => {
    if (!newItem.trim() || saving) return;
    setSaving(true);
    await supabase.from('travel_packing_items').insert({ trip_id: trip.id, title: newItem.trim(), sort_order: packingItems.length });
    setNewItem('');
    setSaving(false);
    onUpdate();
  };

  const deleteItem = async (id) => {
    await supabase.from('travel_packing_items').delete().eq('id', id);
    onUpdate();
  };

  const toggleCheck = async (itemId) => {
    if (!userId) return;
    const isChecked = myChecks.has(itemId);
    setMyChecks(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId); else next.add(itemId);
      return next;
    });
    if (isChecked) {
      await supabase.from('travel_packing_checks').delete().eq('item_id', itemId).eq('user_id', userId);
    } else {
      await supabase.from('travel_packing_checks').insert({ item_id: itemId, user_id: userId });
    }
  };

  const packed = packingItems.filter(i => myChecks.has(i.id)).length;

  return (
    <div className={styles.infoSection}>
      <div className={styles.infoSectionHead}>
        <span className={styles.infoSectionTitle}>🧳 {lang === 'ja' ? '持ち物リスト' : 'Packing List'}</span>
        {packingItems.length > 0 && (
          <span className={`${styles.packProgress} ${packed === packingItems.length ? styles.packProgressDone : ''}`}>
            {packed}/{packingItems.length}
          </span>
        )}
      </div>

      {packingItems.length === 0 ? (
        <p className={styles.infoEmpty}>
          {canEdit
            ? (lang === 'ja' ? '下記から持ち物を追加してください。' : 'Add packing items below.')
            : (lang === 'ja' ? '持ち物リストはまだありません。' : 'No packing list yet.')}
        </p>
      ) : (
        <div className={styles.packingList}>
          {packingItems.map(item => {
            const checked = myChecks.has(item.id);
            return (
              <div key={item.id} className={`${styles.packingItem} ${checked ? styles.packingItemDone : ''}`}>
                <button className={`${styles.packCheckbox} ${checked ? styles.packCheckboxDone : ''}`}
                  onClick={() => toggleCheck(item.id)}>
                  {checked ? '✓' : ''}
                </button>
                <span className={styles.packTitle}>{item.title}</span>
                {canEdit && (
                  <button className={styles.packDeleteBtn} onClick={() => deleteItem(item.id)}>×</button>
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
            onKeyDown={e => e.key === 'Enter' && addItem()}
            placeholder={lang === 'ja' ? '例: パスポート、ユニフォーム… Enter で追加' : 'e.g. Passport, jersey… Enter to add'} />
          <button className={styles.packAddBtn} onClick={addItem} disabled={!newItem.trim() || saving}>+</button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function Travel({ lang = 'en', profile, currentUserName = '' }) {
  const toast   = useToast();
  const canEdit = EDIT_ROLES.includes(profile?.role);
  const userId  = profile?.id ?? null;

  const [trips,        setTrips]        = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [items,        setItems]        = useState([]);
  const [participants, setParticipants] = useState([]);
  const [packingItems, setPackingItems] = useState([]);
  const [myChecks,     setMyChecks]     = useState(new Set());
  const [allProfiles,  setAllProfiles]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);

  const [showTripModal,   setShowTripModal]   = useState(false);
  const [editingTrip,     setEditingTrip]     = useState(null);
  const [showItemModal,   setShowItemModal]   = useState(false);
  const [editingItem,     setEditingItem]     = useState(null);
  const [itemDefaultDate, setItemDefaultDate] = useState(null);
  const [itemDefaultType, setItemDefaultType] = useState(null);
  const [deleting,        setDeleting]        = useState(null);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('travel_trips').select('*').order('start_date', { ascending: false });
    setTrips(data ?? []);
    setLoading(false);
  }, []);

  const loadTripData = useCallback(async (tripId) => {
    setLoadingData(true);
    try {
      const [itemsRes, partsRes, packRes] = await Promise.all([
        supabase.from('travel_items').select('*').eq('trip_id', tripId).order('item_date').order('item_time'),
        supabase.from('travel_participants').select('profile_id').eq('trip_id', tripId),
        supabase.from('travel_packing_items').select('*').eq('trip_id', tripId).order('sort_order').order('created_at'),
      ]);

      setItems(itemsRes.data ?? []);
      setParticipants(partsRes.data ?? []);
      const pItems = packRes.data ?? [];
      setPackingItems(pItems);

      if (pItems.length > 0 && userId) {
        const { data: checksData } = await supabase
          .from('travel_packing_checks').select('item_id').eq('user_id', userId)
          .in('item_id', pItems.map(i => i.id));
        setMyChecks(new Set((checksData ?? []).map(c => c.item_id)));
      } else {
        setMyChecks(new Set());
      }
    } finally {
      setLoadingData(false);
    }
  }, [userId]);

  useEffect(() => {
    loadTrips();
    supabase.from('profiles').select('id, display_name, email, role').order('display_name')
      .then(({ data }) => setAllProfiles(data ?? []));
  }, [loadTrips]);

  useEffect(() => {
    if (selectedTrip) loadTripData(selectedTrip.id);
    else { setItems([]); setParticipants([]); setPackingItems([]); setMyChecks(new Set()); }
  }, [selectedTrip, loadTripData]);

  const handleDeleteTrip = async (trip) => {
    if (!window.confirm(lang === 'ja' ? `「${trip.title}」を削除しますか？` : `Delete "${trip.title}"? This cannot be undone.`)) return;
    setDeleting(trip.id);
    await supabase.from('travel_trips').delete().eq('id', trip.id);
    setTrips(prev => prev.filter(t => t.id !== trip.id));
    if (selectedTrip?.id === trip.id) setSelectedTrip(null);
    setDeleting(null);
    toast(lang === 'ja' ? '旅程を削除しました' : 'Trip deleted', 'info');
  };

  const handleDeleteItem = async (item) => {
    if (!window.confirm(lang === 'ja' ? `「${item.title}」を削除しますか？` : `Delete "${item.title}"?`)) return;
    await supabase.from('travel_items').delete().eq('id', item.id);
    setItems(prev => prev.filter(i => i.id !== item.id));
  };

  const tripDates = selectedTrip ? getDates(selectedTrip.start_date, selectedTrip.end_date) : [];

  const itemsByDate = {};
  for (const item of items) {
    if (!itemsByDate[item.item_date]) itemsByDate[item.item_date] = [];
    itemsByDate[item.item_date].push(item);
  }

  return (
    <div className={styles.wrapper}>

      {/* ── Sidebar ── */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHead}>
          <span className={styles.sidebarTitle}>{lang === 'ja' ? '旅程' : 'Travel'}</span>
          {canEdit && (
            <button className={styles.addTripBtn} onClick={() => { setEditingTrip(null); setShowTripModal(true); }}>
              + {lang === 'ja' ? '追加' : 'New'}
            </button>
          )}
        </div>
        <div className={styles.tripList}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
              <SkeletonCardBlock lines={2} />
              <SkeletonCardBlock lines={2} />
              <SkeletonCardBlock lines={2} />
            </div>
          ) : trips.length === 0 ? (
            <div className={styles.hint}>{lang === 'ja' ? '旅程がありません。' : 'No trips yet.'}</div>
          ) : trips.map(trip => {
            const { status } = getTripStatus(trip);
            return (
              <div key={trip.id}
                className={`${styles.tripRow} ${selectedTrip?.id === trip.id ? styles.tripRowActive : ''} ${status === 'ongoing' ? styles.tripRowOngoing : status === 'past' ? styles.tripRowPast : ''}`}
                onClick={() => setSelectedTrip(trip)}>
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

      {/* ── Content ── */}
      <div className={styles.content}>
        {!selectedTrip ? (
          <div className={styles.emptyState}>{lang === 'ja' ? '旅程を選択してください。' : 'Select a trip to view the itinerary.'}</div>
        ) : (
          <>
            {/* Trip header */}
            <div className={styles.tripHeader}>
              <div className={styles.tripHeaderInfo}>
                <h2 className={styles.tripTitle}>{selectedTrip.title}</h2>
                <div className={styles.tripMeta}>
                  📅 {fmtShort(selectedTrip.start_date, lang)}
                  {selectedTrip.end_date && selectedTrip.end_date !== selectedTrip.start_date
                    ? ` – ${fmtShort(selectedTrip.end_date, lang)}` : ''}
                  {selectedTrip.location && <> &nbsp;·&nbsp; 📍 {selectedTrip.location}</>}
                  &nbsp;·&nbsp; {tripDates.length} {lang === 'ja' ? '日間' : tripDates.length === 1 ? 'day' : 'days'}
                </div>
                {(selectedTrip.flight_number || selectedTrip.hotel_name) && (
                  <div className={styles.tripDetailChips}>
                    {selectedTrip.flight_number && (
                      <span className={styles.detailChip}>✈️ {selectedTrip.flight_number}</span>
                    )}
                    {selectedTrip.hotel_name && (
                      <span className={styles.detailChip}>
                        🏨 {selectedTrip.hotel_name}
                        {selectedTrip.hotel_address ? ` — ${selectedTrip.hotel_address}` : ''}
                      </span>
                    )}
                  </div>
                )}
                {selectedTrip.notes && <div className={styles.tripNotes}>{selectedTrip.notes}</div>}
              </div>
              <div className={styles.tripHeaderActions}>
                {canEdit && (
                  <>
                    <button className={styles.editTripBtn} onClick={() => { setEditingTrip(selectedTrip); setShowTripModal(true); }}>
                      ✏️ {lang === 'ja' ? '編集' : 'Edit'}
                    </button>
                    <button className={styles.deleteTripBtn} onClick={() => handleDeleteTrip(selectedTrip)} disabled={deleting === selectedTrip.id}>
                      {deleting === selectedTrip.id ? '…' : (lang === 'ja' ? '削除' : 'Delete')}
                    </button>
                  </>
                )}
                <button className={styles.printBtn} onClick={() => window.print()}>
                  🖨 {lang === 'ja' ? '印刷' : 'Print'}
                </button>
              </div>
            </div>

            {/* Participants + Packing side by side */}
            {!loadingData && (
              <div className={styles.infoPanels}>
                <ParticipantsSection
                  trip={selectedTrip} participants={participants} allProfiles={allProfiles}
                  canEdit={canEdit} lang={lang} onUpdate={() => loadTripData(selectedTrip.id)}
                />
                <PackingSection
                  trip={selectedTrip} packingItems={packingItems} myChecks={myChecks} setMyChecks={setMyChecks}
                  canEdit={canEdit} userId={userId} lang={lang} onUpdate={() => loadTripData(selectedTrip.id)}
                />
              </div>
            )}

            {/* Daily rundown */}
            <div className={styles.rundown}>
              {loadingData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <SkeletonCardBlock lines={3} />
                  <SkeletonCardBlock lines={3} />
                </div>
              ) : tripDates.map((date, dayIdx) => {
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
                      <span className={styles.dayDate}>{fmtFull(date, lang)}</span>
                    </div>
                    <div className={styles.dayItems}>
                      {dayItems.length === 0 && !canEdit && (
                        <div className={styles.emptyDay}>{lang === 'ja' ? 'まだ予定はありません。' : 'No items yet.'}</div>
                      )}
                      {dayItems.map(item => {
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
                                <button className={styles.itemEditBtn} onClick={() => { setEditingItem(item); setItemDefaultDate(null); setItemDefaultType(null); setShowItemModal(true); }} title={lang === 'ja' ? '編集' : 'Edit'}>✏️</button>
                                <button className={styles.itemDeleteBtn} onClick={() => handleDeleteItem(item)} title={lang === 'ja' ? '削除' : 'Delete'}>🗑️</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {canEdit && (
                        <QuickAdd tripId={selectedTrip.id} date={date} lang={lang} onAdded={() => loadTripData(selectedTrip.id)} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Modals ── */}
      {showTripModal && (
        <TripModal trip={editingTrip} lang={lang} currentUserName={currentUserName}
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
          onClose={() => setShowTripModal(false)} />
      )}
      {showItemModal && selectedTrip && (
        <ItemModal item={editingItem} tripId={selectedTrip.id} tripDates={tripDates} lang={lang}
          defaultDate={itemDefaultDate} defaultType={itemDefaultType}
          onSave={() => { loadTripData(selectedTrip.id); toast(lang === 'ja' ? '項目を保存しました' : 'Item saved', 'success'); }}
          onClose={() => setShowItemModal(false)} />
      )}
    </div>
  );
}
