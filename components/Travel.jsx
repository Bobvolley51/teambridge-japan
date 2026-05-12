'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useTranslated } from '@/lib/translate';
import styles from './Travel.module.css';

function TText({ text, lang }) {
  const t = useTranslated(text, lang);
  return <>{t}</>;
}

const EDIT_ROLES = ['Organisation Staff', 'Coaching Staff', 'GM', 'Headcoach'];

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

function addDays(d, n) {
  const dt = new Date(d);          // date-only string → parsed as UTC
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function getDates(start, end) {
  if (!start) return [];
  const dates = [];
  let cur = start;
  const last = end ?? start;
  while (cur <= last && dates.length < 60) { dates.push(cur); cur = addDays(cur, 1); }
  return dates;
}

function fmtLong(d, lang) {
  return new Date(d).toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Tokyo' }
  );
}

function fmtShort(d, lang) {
  return new Date(d).toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { month: 'short', day: 'numeric', timeZone: 'Asia/Tokyo' }
  );
}

function tripStatus(trip) {
  const today = new Date().toISOString().slice(0, 10);
  const end = trip.end_date ?? trip.start_date;
  if (end < today) return 'past';
  if (trip.start_date <= today) return 'ongoing';
  return 'upcoming';
}

function StatusBadge({ trip, lang }) {
  const s = tripStatus(trip);
  if (s === 'past') return <span className={`${styles.badge} ${styles.badgePast}`}>{lang === 'ja' ? '終了' : 'Past'}</span>;
  if (s === 'ongoing') return <span className={`${styles.badge} ${styles.badgeOngoing}`}>{lang === 'ja' ? '進行中' : 'Ongoing'}</span>;
  const days = Math.ceil((new Date(trip.start_date + 'T00:00:00') - new Date()) / 86400000);
  const label = days <= 0 ? (lang === 'ja' ? '今日' : 'Today')
              : days === 1 ? (lang === 'ja' ? '明日' : 'Tomorrow')
              : lang === 'ja' ? `${days}日後` : `In ${days}d`;
  const cls = days <= 1 ? styles.badgeToday : days <= 7 ? styles.badgeSoon : styles.badgeUpcoming;
  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ── Trip form ─────────────────────────────────────────────────────────────────

function TripForm({ trip, lang, currentUserName, onSave, onClose }) {
  const [f, setF] = useState({
    title:         trip?.title         ?? '',
    start_date:    trip?.start_date    ?? '',
    end_date:      trip?.end_date      ?? '',
    location:      trip?.location      ?? '',
    flight_number: trip?.flight_number ?? '',
    hotel_name:    trip?.hotel_name    ?? '',
    hotel_address: trip?.hotel_address ?? '',
    notes:         trip?.notes         ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    if (f.end_date && f.end_date < f.start_date) {
      setErr(lang === 'ja' ? '終了日は開始日以降にしてください。' : 'End date must be on or after start date.');
      return;
    }
    setSaving(true);
    const payload = {
      title: f.title.trim(), start_date: f.start_date,
      end_date: f.end_date || null, location: f.location.trim() || null,
      flight_number: f.flight_number.trim() || null, hotel_name: f.hotel_name.trim() || null,
      hotel_address: f.hotel_address.trim() || null, notes: f.notes.trim() || null,
    };
    const { error } = trip
      ? await supabase.from('travel_trips').update(payload).eq('id', trip.id)
      : await supabase.from('travel_trips').insert({ ...payload, created_by: currentUserName });
    if (error) { setErr(error.message); setSaving(false); return; }
    onSave();
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span>{trip ? (lang === 'ja' ? '旅程を編集' : 'Edit Trip') : (lang === 'ja' ? '新しい旅程' : 'New Trip')}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label}>{lang === 'ja' ? 'タイトル *' : 'Title *'}</label>
          <input className={styles.input} value={f.title} onChange={e => set('title', e.target.value)} required autoFocus placeholder="e.g. Away Game vs Tokyo" />
          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>{lang === 'ja' ? '開始日 *' : 'Start *'}</label>
              <input className={styles.input} type="date" value={f.start_date} onChange={e => set('start_date', e.target.value)} required />
            </div>
            <div className={styles.col}>
              <label className={styles.label}>{lang === 'ja' ? '終了日' : 'End'}</label>
              <input className={styles.input} type="date" value={f.end_date} min={f.start_date} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <label className={styles.label}>{lang === 'ja' ? '場所' : 'Location'}</label>
          <input className={styles.input} value={f.location} onChange={e => set('location', e.target.value)} placeholder="e.g. Tokyo" />
          <label className={styles.label}>{lang === 'ja' ? 'フライト番号' : 'Flight no.'}</label>
          <input className={styles.input} value={f.flight_number} onChange={e => set('flight_number', e.target.value)} placeholder="e.g. NH123" />
          <label className={styles.label}>{lang === 'ja' ? 'ホテル名' : 'Hotel'}</label>
          <input className={styles.input} value={f.hotel_name} onChange={e => set('hotel_name', e.target.value)} placeholder="e.g. Toyoko Inn Tokyo" />
          <label className={styles.label}>{lang === 'ja' ? 'ホテル住所' : 'Hotel address'}</label>
          <input className={styles.input} value={f.hotel_address} onChange={e => set('hotel_address', e.target.value)} placeholder="e.g. 1-1 Shinjuku, Tokyo" />
          <label className={styles.label}>{lang === 'ja' ? 'メモ' : 'Notes'}</label>
          <textarea className={styles.textarea} value={f.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Meeting point, luggage rules…" />
          {err && <div className={styles.formErr}>{err}</div>}
          <div className={styles.modalFoot}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>{lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
            <button type="submit" className={styles.btnSave} disabled={saving}>{saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Item form ─────────────────────────────────────────────────────────────────

function ItemForm({ item, tripId, tripDates, defaultDate, lang, onSave, onClose }) {
  const [type,   setType]   = useState(item?.item_type ?? 'other');
  const [date,   setDate]   = useState(item?.item_date ?? defaultDate ?? tripDates[0] ?? '');
  const [time,   setTime]   = useState(item?.item_time ?? '');
  const [title,  setTitle]  = useState(item?.title ?? '');
  const [desc,   setDesc]   = useState(item?.description ?? '');
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const payload = { item_type: type, item_date: date, item_time: time || null, title: title.trim(), description: desc.trim() || null };
    const { error } = item
      ? await supabase.from('travel_items').update(payload).eq('id', item.id)
      : await supabase.from('travel_items').insert({ ...payload, trip_id: tripId });
    if (error) { setErr(error.message); setSaving(false); return; }
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
        <form className={styles.form} onSubmit={submit}>
          <label className={styles.label}>{lang === 'ja' ? '種類' : 'Type'}</label>
          <div className={styles.typeGrid}>
            {ITEM_TYPES.map(t => (
              <button key={t.key} type="button"
                className={`${styles.typeBtn} ${type === t.key ? styles.typeBtnActive : ''}`}
                onClick={() => setType(t.key)}>
                <span>{t.icon}</span>
                <span className={styles.typeBtnLabel}>{t[lang]}</span>
              </button>
            ))}
          </div>
          <div className={styles.row}>
            <div className={styles.col}>
              <label className={styles.label}>{lang === 'ja' ? '日付' : 'Day'}</label>
              <select className={styles.input} value={date} onChange={e => setDate(e.target.value)}>
                {tripDates.map((d, i) => <option key={d} value={d}>{`Day ${i + 1} — ${fmtShort(d, lang)}`}</option>)}
              </select>
            </div>
            <div className={styles.col}>
              <label className={styles.label}>{lang === 'ja' ? '時刻' : 'Time'}</label>
              <input className={styles.input} type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>
          <label className={styles.label}>{lang === 'ja' ? 'タイトル *' : 'Title *'}</label>
          <input className={styles.input} value={title} onChange={e => setTitle(e.target.value)} required autoFocus placeholder="e.g. Bus departure" />
          <label className={styles.label}>{lang === 'ja' ? '詳細' : 'Details'}</label>
          <textarea className={styles.textarea} value={desc} onChange={e => setDesc(e.target.value)} rows={2} placeholder="Address, terminal, notes…" />
          {err && <div className={styles.formErr}>{err}</div>}
          <div className={styles.modalFoot}>
            <button type="button" className={styles.btnCancel} onClick={onClose}>{lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
            <button type="submit" className={styles.btnSave} disabled={saving}>{saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Participants modal ────────────────────────────────────────────────────────

function ParticipantsModal({ tripId, currentIds, lang, onSave, onClose }) {
  const [allProfiles, setAllProfiles] = useState([]);
  const [selected,    setSelected]    = useState(() => new Set(currentIds));
  const [saving,      setSaving]      = useState(false);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, role').order('display_name')
      .then(({ data }) => setAllProfiles(data ?? []));
  }, []);

  const toggle = (id) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const save = async () => {
    setSaving(true);
    const current = new Set(currentIds);
    const toAdd    = [...selected].filter(id => !current.has(id));
    const toRemove = [...current].filter(id => !selected.has(id));
    await Promise.all([
      ...toAdd.map(id    => supabase.from('travel_participants').insert({ trip_id: tripId, profile_id: id })),
      ...toRemove.map(id => supabase.from('travel_participants').delete().eq('trip_id', tripId).eq('profile_id', id)),
    ]);
    setSaving(false);
    onSave();
    onClose();
  };

  const ROLE_ORDER = ['Player', 'Headcoach', 'Athletic Trainer', 'Therapist', 'Coaching Staff', 'Organisation Staff', 'GM'];
  const grouped = ROLE_ORDER.reduce((acc, role) => {
    const members = allProfiles.filter(p => p.role === role);
    if (members.length) acc.push({ role, members });
    return acc;
  }, []);

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span>{lang === 'ja' ? '参加者を管理' : 'Manage Travelers'}</span>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.participantsList}>
          {grouped.length === 0
            ? <div className={styles.hint}>{lang === 'ja' ? '読込中...' : 'Loading…'}</div>
            : grouped.map(({ role, members }) => (
              <div key={role} className={styles.roleGroup}>
                <div className={styles.roleGroupLabel}>{role}</div>
                {members.map(p => (
                  <label key={p.id} className={styles.participantCheck}>
                    <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    <span className={styles.participantCheckName}>{p.display_name || p.id.slice(0, 8)}</span>
                  </label>
                ))}
              </div>
            ))
          }
        </div>
        <div className={styles.modalFoot} style={{ padding: '12px 20px 16px' }}>
          <span className={styles.selectedCount}>{selected.size} {lang === 'ja' ? '人選択中' : 'selected'}</span>
          <button type="button" className={styles.btnCancel} onClick={onClose}>{lang === 'ja' ? 'キャンセル' : 'Cancel'}</button>
          <button type="button" className={styles.btnSave} disabled={saving} onClick={save}>{saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Travel({ lang = 'en', profile, currentUserName = '' }) {
  const toast   = useToast();
  const canEdit = EDIT_ROLES.includes(profile?.role);

  const [trips,      setTrips]      = useState([]);
  const [details,    setDetails]    = useState({});   // { [tripId]: { items, participants } }
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const [tripForm,         setTripForm]         = useState(null);
  const [itemForm,         setItemForm]         = useState(null);
  const [participantsForm, setParticipantsForm] = useState(null);

  useEffect(() => { loadAll(); }, []);

  // Load everything at once — no async on click, zero freeze risk
  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [tripsRes, itemsRes, partRes] = await Promise.all([
        supabase.from('travel_trips').select('*').order('start_date', { ascending: false }),
        supabase.from('travel_items').select('*').order('item_date').order('item_time'),
        supabase.from('travel_participants').select('profile_id, trip_id'),
      ]);

      const tripsData = tripsRes.data ?? [];
      const itemsData = itemsRes.data ?? [];
      const partsData = partRes.data  ?? [];

      // Look up profiles for participants
      const profileIds = [...new Set(partsData.map(p => p.profile_id))];
      let profileMap = {};
      if (profileIds.length > 0) {
        const { data: profileData } = await supabase
          .from('profiles').select('id, display_name, role').in('id', profileIds);
        for (const prof of profileData ?? []) profileMap[prof.id] = prof;
      }

      // Build per-trip detail map
      const detailMap = {};
      for (const trip of tripsData) {
        detailMap[trip.id] = {
          items: itemsData.filter(i => i.trip_id === trip.id),
          participants: partsData
            .filter(p => p.trip_id === trip.id)
            .map(p => ({ profile_id: p.profile_id, profiles: profileMap[p.profile_id] ?? null })),
        };
      }

      setTrips(tripsData);
      setDetails(detailMap);
    } catch (e) {
      setError(e.message ?? 'Could not load travel data');
    } finally {
      setLoading(false);
    }
  }

  // Click just toggles — no async
  function handleCardClick(tripId) {
    setExpandedId(prev => prev === tripId ? null : tripId);
  }

  async function handleDeleteTrip(trip) {
    if (!window.confirm(lang === 'ja' ? `「${trip.title}」を削除しますか？` : `Delete "${trip.title}"?`)) return;
    await supabase.from('travel_trips').delete().eq('id', trip.id);
    toast(lang === 'ja' ? '旅程を削除しました' : 'Trip deleted', 'info');
    if (expandedId === trip.id) setExpandedId(null);
    loadAll();
  }

  async function handleDeleteItem(itemId) {
    if (!window.confirm(lang === 'ja' ? '削除しますか？' : 'Delete this item?')) return;
    await supabase.from('travel_items').delete().eq('id', itemId);
    toast(lang === 'ja' ? '削除しました' : 'Deleted', 'info');
    loadAll();
  }

  const upcoming = trips.filter(t => tripStatus(t) !== 'past');
  const past     = trips.filter(t => tripStatus(t) === 'past');

  function renderExpanded(trip) {
    const detail     = details[trip.id] ?? { items: [], participants: [] };
    const tripDates  = getDates(trip.start_date, trip.end_date);
    const { items, participants } = detail;

    const itemsByDate = {};
    for (const item of items) {
      if (!itemsByDate[item.item_date]) itemsByDate[item.item_date] = [];
      itemsByDate[item.item_date].push(item);
    }

    return (
      <div className={styles.cardBody}>

        {canEdit && (
          <div className={styles.actionBar}>
            <button className={styles.btnAction} onClick={() => setTripForm(trip)}>
              ✏️ {lang === 'ja' ? '編集' : 'Edit trip'}
            </button>
            <button className={styles.btnAction} onClick={() => setParticipantsForm(trip.id)}>
              👥 {lang === 'ja' ? '参加者' : 'Travelers'}
            </button>
            <button className={styles.btnActionDanger} onClick={() => handleDeleteTrip(trip)}>
              {lang === 'ja' ? '削除' : 'Delete'}
            </button>
            <button className={styles.btnPrint} onClick={() => window.print()}>🖨</button>
          </div>
        )}

        {(trip.flight_number || trip.hotel_name || trip.notes) && (
          <div className={styles.logistics}>
            {trip.flight_number && (
              <div className={styles.logTile}>
                <span className={styles.logIcon}>✈️</span>
                <div>
                  <div className={styles.logLabel}>{lang === 'ja' ? 'フライト' : 'Flight'}</div>
                  <div className={styles.logValue}>{trip.flight_number}</div>
                </div>
              </div>
            )}
            {trip.hotel_name && (
              <div className={styles.logTile}>
                <span className={styles.logIcon}>🏨</span>
                <div>
                  <div className={styles.logLabel}>{lang === 'ja' ? 'ホテル' : 'Hotel'}</div>
                  <div className={styles.logValue}>{trip.hotel_name}</div>
                  {trip.hotel_address && <div className={styles.logSub}>{trip.hotel_address}</div>}
                </div>
              </div>
            )}
            {trip.notes && (
              <div className={styles.logTile}>
                <span className={styles.logIcon}>📋</span>
                <div>
                  <div className={styles.logLabel}>{lang === 'ja' ? 'メモ' : 'Notes'}</div>
                  <div className={styles.logValue} style={{ whiteSpace: 'pre-wrap' }}><TText text={trip.notes} lang={lang} /></div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className={styles.travelersSection}>
          <div className={styles.sectionLabel}>{lang === 'ja' ? '参加者' : 'Travelers'}</div>
          {participants.length === 0 ? (
            <div className={styles.hint}>
              {canEdit
                ? (lang === 'ja' ? '参加者ボタンから追加できます' : 'Add travelers using the Travelers button above')
                : (lang === 'ja' ? '参加者なし' : 'No travelers listed')}
            </div>
          ) : (
            <div className={styles.travelerChips}>
              {participants.map(p => {
                const name = p.profiles?.display_name ?? '?';
                const role = p.profiles?.role ?? '';
                return (
                  <div key={p.profile_id} className={styles.travelerChip}>
                    <span className={styles.travelerInitial}>{name.slice(0, 2).toUpperCase()}</span>
                    <div className={styles.travelerInfo}>
                      <span className={styles.travelerName}>{name}</span>
                      <span className={styles.travelerRole}>{role}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className={styles.schedule}>
          <div className={styles.sectionLabel} style={{ marginBottom: 12 }}>
            {lang === 'ja' ? 'スケジュール' : 'Schedule'}
          </div>
          {tripDates.length === 0 && (
            <div className={styles.hint}>{lang === 'ja' ? '日程が設定されていません。' : 'No dates set.'}</div>
          )}
          {tripDates.map((date, dayIdx) => {
            const dayItems = (itemsByDate[date] ?? []).slice().sort((a, b) => {
              if (!a.item_time && !b.item_time) return 0;
              if (!a.item_time) return 1;
              if (!b.item_time) return -1;
              return a.item_time.localeCompare(b.item_time);
            });
            return (
              <div key={date} className={styles.day}>
                <div className={styles.dayHeader}>
                  <span className={styles.dayBadge}>Day {dayIdx + 1}</span>
                  <span className={styles.dayDate}>{fmtLong(date, lang)}</span>
                  {canEdit && (
                    <button className={styles.btnAddItem}
                      onClick={() => setItemForm({ item: null, date, tripId: trip.id, tripDates })}>
                      + {lang === 'ja' ? '追加' : 'Add'}
                    </button>
                  )}
                </div>
                <div className={styles.dayItems}>
                  {dayItems.length === 0 && (
                    <div className={styles.emptyDay}>{lang === 'ja' ? '予定なし' : 'Nothing scheduled'}</div>
                  )}
                  {dayItems.map(item => {
                    const t = typeInfo(item.item_type);
                    return (
                      <div key={item.id} className={styles.scheduleItem}>
                        <span className={styles.itemIcon}>{t.icon}</span>
                        <span className={styles.itemTime}>{item.item_time ? item.item_time.slice(0, 5) : '—'}</span>
                        <div className={styles.itemContent}>
                          <div className={styles.itemTitle}><TText text={item.title} lang={lang} /></div>
                          {item.description && <div className={styles.itemDesc}><TText text={item.description} lang={lang} /></div>}
                        </div>
                        {canEdit && (
                          <div className={styles.itemActions}>
                            <button className={styles.btnItemEdit}
                              onClick={() => setItemForm({ item, date, tripId: trip.id, tripDates })}>✏️</button>
                            <button className={styles.btnItemDelete}
                              onClick={() => handleDeleteItem(item.id)}>🗑️</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    );
  }

  function renderCard(trip) {
    const isExpanded = expandedId === trip.id;
    const s          = tripStatus(trip);
    const partCount  = (details[trip.id]?.participants ?? []).length;

    return (
      <div key={trip.id}
        className={`${styles.card} ${isExpanded ? styles.cardExpanded : ''} ${s === 'ongoing' ? styles.cardOngoing : s === 'past' ? styles.cardPast : ''}`}>

        <div className={styles.cardHeader} onClick={() => handleCardClick(trip.id)}>
          <div className={styles.cardHeaderLeft}>
            <div className={styles.cardTitle}><TText text={trip.title} lang={lang} /></div>
            <div className={styles.cardMeta}>
              <span>📅 {fmtShort(trip.start_date, lang)}{trip.end_date && trip.end_date !== trip.start_date ? ` – ${fmtShort(trip.end_date, lang)}` : ''}</span>
              {trip.location && <span>📍 {trip.location}</span>}
              {partCount > 0 && <span>👥 {partCount}</span>}
            </div>
          </div>
          <div className={styles.cardHeaderRight}>
            <StatusBadge trip={trip} lang={lang} />
            <span className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}>›</span>
          </div>
        </div>

        {isExpanded && renderExpanded(trip)}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitle}><span>✈️</span><span>{lang === 'ja' ? '旅程' : 'Travel'}</span></div>
        {canEdit && (
          <button className={styles.btnNewTrip} onClick={() => setTripForm({})}>
            + {lang === 'ja' ? '新しい旅程' : 'New Trip'}
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loadingState}>{lang === 'ja' ? '読込中...' : 'Loading…'}</div>
      ) : error ? (
        <div className={styles.errorState}>{error}</div>
      ) : trips.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>✈️</div>
          <div>{lang === 'ja' ? 'まだ旅程がありません。' : 'No trips yet.'}</div>
          {canEdit && <div className={styles.emptyHint}>{lang === 'ja' ? '上の「新しい旅程」から追加してください。' : 'Use "New Trip" above to get started.'}</div>}
        </div>
      ) : (
        <div className={styles.tripGroups}>
          {upcoming.length > 0 && (
            <div className={styles.tripGroup}>
              <div className={styles.groupLabel}>{lang === 'ja' ? '予定・進行中' : 'Upcoming & Ongoing'}</div>
              {upcoming.map(renderCard)}
            </div>
          )}
          {past.length > 0 && (
            <div className={styles.tripGroup}>
              <div className={styles.groupLabel}>{lang === 'ja' ? '過去の旅程' : 'Past Trips'}</div>
              {past.map(renderCard)}
            </div>
          )}
        </div>
      )}

      {tripForm !== null && (
        <TripForm
          trip={tripForm?.id ? tripForm : null}
          lang={lang} currentUserName={currentUserName}
          onSave={() => { loadAll(); toast(lang === 'ja' ? '保存しました' : 'Saved', 'success'); }}
          onClose={() => setTripForm(null)}
        />
      )}

      {itemForm !== null && (
        <ItemForm
          item={itemForm.item} tripId={itemForm.tripId}
          tripDates={itemForm.tripDates} defaultDate={itemForm.date}
          lang={lang}
          onSave={() => { loadAll(); toast(lang === 'ja' ? '保存しました' : 'Item saved', 'success'); }}
          onClose={() => setItemForm(null)}
        />
      )}

      {participantsForm !== null && (
        <ParticipantsModal
          tripId={participantsForm}
          currentIds={(details[participantsForm]?.participants ?? []).map(p => p.profile_id)}
          lang={lang}
          onSave={() => { loadAll(); toast(lang === 'ja' ? '参加者を更新しました' : 'Travelers updated', 'success'); }}
          onClose={() => setParticipantsForm(null)}
        />
      )}
    </div>
  );
}
