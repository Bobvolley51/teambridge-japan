'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { SkeletonLine } from './Skeleton';
import styles from './Calendar.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = ['Ball-Practice', 'Weightlifting', 'Game', 'Meeting', 'Travel', 'Medical', 'Other'];

const CAT_LABEL = {
  en: { 'Ball-Practice': 'Ball Practice', Weightlifting: 'Weightlifting / Athletic', Game: 'Game', Meeting: 'Meeting', Travel: 'Travel', Medical: 'Medical/Physio', Other: 'Other' },
  ja: { 'Ball-Practice': 'ボール練習', Weightlifting: 'ウェイト・アスレチック', Game: '試合', Meeting: 'ミーティング', Travel: '旅行', Medical: 'メディカル/フィジオ', Other: 'その他' },
};

const DEFAULT_DURATION = { 'Ball-Practice': 120, Weightlifting: 75, Game: 240, Meeting: 30, Travel: 300, Medical: 60, Other: 300 };

const CAT = {
  'Ball-Practice': { bg: '#dbeafe', text: '#1e40af', solid: '#2563eb' },
  Weightlifting:   { bg: '#fef3c7', text: '#92400e', solid: '#d97706' },
  Game:     { bg: '#fee2e2', text: '#991b1b', solid: '#dc2626' },
  Meeting:  { bg: '#d1fae5', text: '#065f46', solid: '#059669' },
  Travel:   { bg: '#ede9fe', text: '#4c1d95', solid: '#7c3aed' },
  Medical:  { bg: '#fef3c7', text: '#92400e', solid: '#d97706' },
  Other:    { bg: '#f3f4f6', text: '#374151', solid: '#6b7280' },
};

function catColor(cat) { return CAT[cat] ?? CAT.Other; }

const RECUR_LABEL = {
  en: { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' },
  ja: { daily: '毎日', weekly: '毎週', monthly: '毎月', yearly: '毎年' },
};

const DAY_NAMES = {
  en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  ja: ['月','火','水','木','金','土','日'],
};

const WEEKDAYS = {
  en: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'],
  ja: ['月','火','水','木','金','土','日'],
};
const MONTHS = {
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  ja: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
};
const HOUR_START = 6;
const HOUR_END   = 24;
const SLOT_H     = 64;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}

function isToday(d) { return sameDay(d, new Date()); }

function getWeekStart(date) {
  const d   = new Date(date);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toLocalDT(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function eventStyle(ev) {
  const s        = new Date(ev.start_time);
  const e        = new Date(ev.end_time);
  const startMin = (s.getHours() - HOUR_START) * 60 + s.getMinutes();
  const endMin   = (e.getHours() - HOUR_START) * 60 + e.getMinutes();
  const top      = Math.max(0, startMin / 60 * SLOT_H);
  const height   = Math.max(20, (endMin - startMin) / 60 * SLOT_H);
  return { top: `${top}px`, height: `${height}px` };
}

// Returns a human-readable description of the recurrence rule.
function formatRecurrence(recurrence, lang) {
  if (!recurrence) return null;
  if (recurrence.startsWith('weekly:')) {
    const days  = recurrence.split(':')[1].split(',').map(Number);
    const names = days.map(d => DAY_NAMES[lang][d]).join(', ');
    return lang === 'ja' ? `毎週 ${names}` : `Every ${names}`;
  }
  const label = RECUR_LABEL[lang]?.[recurrence];
  if (!label) return recurrence;
  return lang === 'ja' ? `${label}繰り返し` : `Repeats ${label.toLowerCase()}`;
}

// Expands recurring events into individual occurrences within [fromISO, toISO].
// Non-recurring events outside the range are dropped.
// Weekly with specific days is stored as "weekly:0,2" (0=Mon … 6=Sun).
function expandRecurring(rawEvents, fromISO, toISO) {
  const fromDate = new Date(fromISO);
  const toDate   = new Date(toISO);
  const result   = [];

  for (const ev of rawEvents) {
    const baseStart = new Date(ev.start_time);
    const duration  = new Date(ev.end_time) - baseStart;

    if (!ev.recurrence) {
      if (baseStart >= fromDate && baseStart <= toDate) {
        result.push({ ...ev, _key: ev.id });
      }
      continue;
    }

    const recEnd       = ev.recurrence_end ? new Date(ev.recurrence_end) : toDate;
    const effectiveEnd = recEnd < toDate ? recEnd : toDate;

    // Specific-days weekly: iterate day-by-day and include matching weekdays
    if (ev.recurrence.startsWith('weekly:')) {
      const selectedDays = ev.recurrence.split(':')[1].split(',').map(Number);
      const h = baseStart.getHours();
      const m = baseStart.getMinutes();
      const startDay = new Date(baseStart > fromDate ? baseStart : fromDate);
      startDay.setHours(0, 0, 0, 0);
      let d = new Date(startDay);
      while (d <= effectiveEnd) {
        const dow = (d.getDay() + 6) % 7; // 0=Mon … 6=Sun
        if (selectedDays.includes(dow)) {
          const occStart = new Date(d);
          occStart.setHours(h, m, 0, 0);
          if (occStart >= fromDate) {
            result.push({
              ...ev,
              start_time:      occStart.toISOString(),
              end_time:        new Date(occStart.getTime() + duration).toISOString(),
              _key:            `${ev.id}_${occStart.toISOString()}`,
              _baseStartTime:  ev.start_time,
              _baseEndTime:    ev.end_time,
            });
          }
        }
        d = new Date(d);
        d.setDate(d.getDate() + 1);
      }
      continue;
    }

    // Fixed-interval recurrence: daily / weekly / monthly / yearly
    let curr   = new Date(baseStart);
    let safety = 0;
    while (curr <= effectiveEnd && safety < 500) {
      safety++;
      if (curr >= fromDate) {
        result.push({
          ...ev,
          start_time:     curr.toISOString(),
          end_time:       new Date(curr.getTime() + duration).toISOString(),
          _key:           `${ev.id}_${curr.toISOString()}`,
          _baseStartTime: ev.start_time,
          _baseEndTime:   ev.end_time,
        });
      }
      const next = new Date(curr);
      if      (ev.recurrence === 'daily')   next.setDate(next.getDate() + 1);
      else if (ev.recurrence === 'weekly')  next.setDate(next.getDate() + 7);
      else if (ev.recurrence === 'monthly') next.setMonth(next.getMonth() + 1);
      else if (ev.recurrence === 'yearly')  next.setFullYear(next.getFullYear() + 1);
      else break;
      if (next.getTime() === curr.getTime()) break;
      curr = next;
    }
  }

  return result.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
}

// ── Event Form ────────────────────────────────────────────────────────────────

function EventForm({ lang, initialDate, currentUserName, currentUserId, profiles, event, onSave, onClose }) {
  const isEditing = !!event;

  // For editing: use base times so recurring events always edit the series root
  const editStartStr = event ? (event._baseStartTime ?? event.start_time) : null;
  const editEndStr   = event ? (event._baseEndTime   ?? event.end_time)   : null;

  const now  = new Date();
  const base = initialDate ?? now;
  const rm   = Math.ceil(now.getMinutes() / 15) * 15;
  const nowH = now.getHours() + (rm >= 60 ? 1 : 0);
  const nowM = rm % 60;
  const h    = base.getHours() || nowH;
  const m    = base.getHours() ? 0 : nowM;
  const defaultStartDate = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m);
  const defaultStart = toLocalDT(defaultStartDate);
  const initDuration = DEFAULT_DURATION[event?.category ?? 'Ball-Practice'] ?? 60;
  const defaultEnd   = toLocalDT(new Date(defaultStartDate.getTime() + initDuration * 60000));

  // Parse recurrence stored value back into type + days
  const parseRec = (rec) => {
    if (!rec) return ['', []];
    if (rec.startsWith('weekly:')) return ['weekly', rec.split(':')[1].split(',').map(Number)];
    return [rec, []];
  };
  const [initRecType, initRecDays] = parseRec(event?.recurrence ?? null);

  const [title,          setTitle]          = useState(event?.title ?? '');
  const [desc,           setDesc]           = useState(event?.description ?? '');
  const [location,       setLocation]       = useState(event?.location ?? '');
  const [category,       setCategory]       = useState(event?.category ?? 'Ball-Practice');
  const [start,          setStart]          = useState(isEditing ? toLocalDT(new Date(editStartStr)) : defaultStart);
  const [end,            setEnd]            = useState(isEditing ? toLocalDT(new Date(editEndStr))   : defaultEnd);
  const [allDay,         setAllDay]         = useState(event?.all_day ?? false);
  const [recurrence,     setRecurrence]     = useState(initRecType);
  const [recurrenceDays, setRecurrenceDays] = useState(initRecDays);
  const [recurrenceEnd,  setRecurrenceEnd]  = useState(event?.recurrence_end ?? '');
  const [participantIds, setParticipantIds] = useState(
    event?.event_participants?.map(ep => ep.profile_id) ?? []
  );
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState(null);

  const toggleParticipant = (id) => {
    setParticipantIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const POS_ORDER  = ['Setter', 'Middle', 'Outside', 'Opposite', 'Libero', 'Universal'];
  const ROLE_ORDER = ['GM', 'Headcoach', 'Athletic', 'Therapist', 'Staff/Orga'];

  const participantGroups = useMemo(() => {
    const byPos  = {};
    const byRole = {};
    for (const p of profiles) {
      if (p.position) { (byPos[p.position]  = byPos[p.position]  ?? []).push(p.id); }
      if (p.role && p.role !== 'Player') { (byRole[p.role] = byRole[p.role] ?? []).push(p.id); }
    }
    const all = profiles.map(p => p.id);
    const groups = [];
    if (all.length > 0) groups.push({ label: lang === 'ja' ? '全員' : 'All', ids: all });
    for (const pos of POS_ORDER) {
      if (byPos[pos]?.length) groups.push({ label: pos, ids: byPos[pos] });
    }
    for (const r of ROLE_ORDER) {
      if (byRole[r]?.length) groups.push({ label: r, ids: byRole[r] });
    }
    return groups;
  }, [profiles, lang]);

  const toggleGroup = (ids) => {
    const allIn = ids.every(id => participantIds.includes(id));
    setParticipantIds(prev =>
      allIn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  };

  const toggleRecurrDay = (dayIdx) => {
    setRecurrenceDays(prev =>
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx]
    );
  };

  const handleRecurrenceChange = (val) => {
    setRecurrence(val);
    if (val === 'weekly' && recurrenceDays.length === 0) {
      const dow = (new Date(start).getDay() + 6) % 7;
      setRecurrenceDays([dow]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const startDate = new Date(start);
    const endDate   = new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setError(lang === 'ja' ? '開始と終了の日時を入力してください。' : 'Please enter a valid start and end time.');
      return;
    }
    if (endDate <= startDate) {
      setError(lang === 'ja' ? '終了は開始より後にしてください。' : 'End must be after start.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      let recurrenceValue = recurrence || null;
      if (recurrence === 'weekly' && recurrenceDays.length > 0) {
        recurrenceValue = `weekly:${[...recurrenceDays].sort((a, b) => a - b).join(',')}`;
      }

      const payload = {
        title:          title.trim(),
        description:    desc.trim() || null,
        location:       location.trim() || null,
        category,
        start_time:     new Date(start).toISOString(),
        end_time:       new Date(end).toISOString(),
        all_day:        allDay,
        recurrence:     recurrenceValue,
        recurrence_end: recurrenceEnd || null,
      };

      if (isEditing) {
        const { error: err } = await supabase.from('events').update({
          ...payload,
          updated_by: currentUserName,
          updated_at: new Date().toISOString(),
        }).eq('id', event.id);
        if (err) throw new Error(err.message);
        await supabase.from('event_participants').delete().eq('event_id', event.id);
        if (participantIds.length > 0) {
          const { error: pErr } = await supabase.from('event_participants').insert(
            participantIds.map(pid => ({ event_id: event.id, profile_id: pid }))
          );
          if (pErr) throw new Error(pErr.message);
        }
        // Notify participants if event is within 36 h
        const hoursUntilEdit = (new Date(payload.start_time) - Date.now()) / 3600000;
        if (participantIds.length > 0 && hoursUntilEdit >= 0 && hoursUntilEdit <= 36) {
          const others = participantIds.filter(pid => pid !== currentUserId);
          const body   = new Date(payload.start_time).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const notifs = others.map(pid => ({
            user_id: pid, type: 'calendar_change',
            title: lang === 'ja' ? `予定変更: ${payload.title}` : `Event updated: ${payload.title}`,
            body, nav_target: 'calendar', ref_id: event.id,
          }));
          await Promise.all([
            notifs.length ? supabase.from('notifications').insert(notifs) : Promise.resolve(),
            fetch('/api/notify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ participantIds: others, eventTitle: payload.title, eventStart: payload.start_time, eventLocation: payload.location, changedBy: currentUserName, type: 'update' }) }).catch(() => {}),
          ]);
        }
      } else {
        const { data, error: err } = await supabase.from('events').insert({
          ...payload,
          created_by: currentUserName,
        }).select('id').single();
        if (err) throw new Error(err.message);
        if (participantIds.length > 0) {
          const { error: pErr } = await supabase.from('event_participants').insert(
            participantIds.map(pid => ({ event_id: data.id, profile_id: pid }))
          );
          if (pErr) throw new Error(pErr.message);
          const body      = new Date(payload.start_time).toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          const others     = participantIds.filter(pid => pid !== currentUserId);
          const notifs    = others.map(pid => ({
            user_id: pid, type: 'calendar_invite',
            title: lang === 'ja' ? `予定追加: ${payload.title}` : `Added to event: ${payload.title}`,
            body, nav_target: 'calendar', ref_id: data.id,
          }));
          const hoursUntil = (new Date(payload.start_time) - Date.now()) / 3600000;
          await Promise.all([
            notifs.length ? supabase.from('notifications').insert(notifs) : Promise.resolve(),
            hoursUntil >= 0 && hoursUntil <= 36
              ? fetch('/api/notify-email', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ participantIds: others, eventTitle: payload.title, eventStart: payload.start_time, eventLocation: payload.location, addedBy: currentUserName }) }).catch(() => {})
              : Promise.resolve(),
          ]);
        }
      }

      onSave(); onClose();
    } catch (caught) {
      setError(caught?.message ?? (lang === 'ja' ? '保存に失敗しました。再度お試しください。' : 'Save failed — please try again.'));
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span>
            {isEditing
              ? (lang === 'ja' ? '予定を編集' : 'Edit Event')
              : (lang === 'ja' ? '新しい予定' : 'New Event')}
          </span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input className={styles.fi} placeholder={lang === 'ja' ? 'タイトル *' : 'Title *'}
            value={title} onChange={e => setTitle(e.target.value)} required autoFocus />

          <div className={styles.allDayRow}>
            <input type="checkbox" id="ad" checked={allDay} onChange={e => setAllDay(e.target.checked)} />
            <label htmlFor="ad" className={styles.adLabel}>{lang === 'ja' ? '終日' : 'All day'}</label>
          </div>

          <div className={styles.timeRow}>
            <div className={styles.tf}>
              <label className={styles.tl}>{lang === 'ja' ? '開始' : 'Start'}</label>
              <input className={styles.fi} type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? start.slice(0, 10) : start}
                onChange={e => {
                  const newStart = e.target.value;
                  setStart(newStart);
                  if (newStart && end) {
                    const prevStart = allDay ? new Date(start + 'T00:00:00') : new Date(start);
                    const prevEnd   = allDay ? new Date(end   + 'T00:00:00') : new Date(end);
                    const duration  = prevEnd - prevStart;
                    if (duration > 0) {
                      const newStartDate = allDay ? new Date(newStart + 'T00:00:00') : new Date(newStart);
                      const newEnd = new Date(newStartDate.getTime() + duration);
                      setEnd(allDay ? newEnd.toISOString().slice(0, 10) : toLocalDT(newEnd));
                    }
                  }
                }}
                required />
            </div>
            <div className={styles.tf}>
              <label className={styles.tl}>{lang === 'ja' ? '終了' : 'End'}</label>
              <input className={styles.fi} type={allDay ? 'date' : 'datetime-local'}
                value={allDay ? end.slice(0, 10) : end} onChange={e => setEnd(e.target.value)} required />
            </div>
          </div>

          <select className={styles.fi} value={category} onChange={e => {
              const val = e.target.value;
              setCategory(val);
              if (!isEditing) {
                const startDate = new Date(start);
                setEnd(toLocalDT(new Date(startDate.getTime() + (DEFAULT_DURATION[val] ?? 60) * 60000)));
              }
            }}
            style={{ borderLeft: `4px solid ${catColor(category).solid}` }}>
            {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABEL[lang]?.[c] ?? c}</option>)}
          </select>

          <input className={styles.fi} placeholder={lang === 'ja' ? '場所' : 'Location'}
            value={location} onChange={e => setLocation(e.target.value)} />
          <textarea className={styles.fta} placeholder={lang === 'ja' ? '詳細' : 'Description'}
            value={desc} onChange={e => setDesc(e.target.value)} rows={2} />

          {/* Recurrence */}
          <div className={styles.tf}>
            <label className={styles.tl}>{lang === 'ja' ? '繰り返し' : 'Repeat'}</label>
            <select className={styles.fi} value={recurrence} onChange={e => handleRecurrenceChange(e.target.value)}>
              <option value="">{lang === 'ja' ? 'なし' : 'None'}</option>
              <option value="daily">{lang === 'ja' ? '毎日' : 'Daily'}</option>
              <option value="weekly">{lang === 'ja' ? '毎週（曜日を選択）' : 'Weekly (pick days)'}</option>
              <option value="monthly">{lang === 'ja' ? '毎月' : 'Monthly'}</option>
              <option value="yearly">{lang === 'ja' ? '毎年' : 'Yearly'}</option>
            </select>
          </div>

          {recurrence === 'weekly' && (
            <div className={styles.tf}>
              <label className={styles.tl}>{lang === 'ja' ? '曜日' : 'Days of week'}</label>
              <div className={styles.daysRow}>
                {DAY_NAMES[lang].map((dayName, i) => (
                  <button key={i} type="button"
                    className={`${styles.dayChip} ${recurrenceDays.includes(i) ? styles.dayChipActive : ''}`}
                    onClick={() => toggleRecurrDay(i)}>
                    {dayName}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recurrence && (
            <div className={styles.tf}>
              <label className={styles.tl}>{lang === 'ja' ? '繰り返し終了日（任意）' : 'Ends on (optional)'}</label>
              <input className={styles.fi} type="date" value={recurrenceEnd}
                onChange={e => setRecurrenceEnd(e.target.value)} />
            </div>
          )}

          {/* Participants */}
          {profiles.length > 0 && (
            <div className={styles.tf}>
              <label className={styles.tl}>{lang === 'ja' ? '参加者' : 'Participants'}</label>
              {participantGroups.length > 1 && (
                <div className={styles.groupChips}>
                  {participantGroups.map(g => {
                    const allIn = g.ids.every(id => participantIds.includes(id));
                    return (
                      <button key={g.label} type="button"
                        className={allIn ? styles.groupChipOn : styles.groupChip}
                        onClick={() => toggleGroup(g.ids)}>
                        {g.label} <span className={styles.groupChipCount}>{g.ids.length}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className={styles.participantsList}>
                {profiles.map(p => (
                  <label key={p.id} className={styles.participantRow}>
                    <input type="checkbox"
                      checked={participantIds.includes(p.id)}
                      onChange={() => toggleParticipant(p.id)} />
                    <span className={styles.participantName}>{p.display_name || p.email}</span>
                    {p.position
                      ? <span className={styles.participantRole}>{p.position}</span>
                      : p.role && p.role !== 'Player' && <span className={styles.participantRole}>{p.role}</span>
                    }
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <div className={styles.formErr}>{error}</div>}
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              {lang === 'ja' ? 'キャンセル' : 'Cancel'}
            </button>
            <button type="submit" className={styles.saveBtn} disabled={saving}>
              {saving ? '…' : (lang === 'ja' ? '保存' : 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Event Detail ──────────────────────────────────────────────────────────────

function EventDetail({ event, lang, canEdit, currentUserId, onEdit, onDelete, onClose }) {
  const [deleting,     setDeleting]     = useState(false);
  const [participants, setParticipants] = useState(event.event_participants ?? []);

  const handleDelete = async () => {
    setDeleting(true);
    await supabase.from('events').delete().eq('id', event.id);
    onDelete(); onClose();
  };

  const setMyStatus = async (newStatus) => {
    const { error } = await supabase
      .from('event_participants')
      .update({ status: newStatus })
      .eq('event_id', event.id)
      .eq('profile_id', currentUserId);
    if (!error) {
      setParticipants(prev => prev.map(p =>
        p.profile_id === currentUserId ? { ...p, status: newStatus } : p
      ));
    }
  };

  const s   = new Date(event.start_time);
  const e   = new Date(event.end_time);
  const fmt = (d) => event.all_day
    ? d.toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : d.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const recurText = formatRecurrence(event.recurrence, lang);
  const iAmListed = participants.some(p => p.profile_id === currentUserId);

  return (
    <div className={styles.overlay} onClick={ev => ev.target === ev.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.modalHead}>
          <span>{event.title}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.detailBody}>
          {event.category && (
            <div className={styles.dr}>
              <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: catColor(event.category).solid, marginTop: 3 }} />
              <span style={{ color: catColor(event.category).solid, fontWeight: 600 }}>{CAT_LABEL[lang]?.[event.category] ?? event.category}</span>
            </div>
          )}
          <div className={styles.dr}><span>🕐</span><span>{fmt(s)} – {fmt(e)}</span></div>
          {recurText && (
            <div className={styles.dr}>
              <span>↻</span>
              <span>
                {recurText}
                {event.recurrence_end && (
                  <> · {lang === 'ja' ? '終了: ' : 'until '}{new Date(event.recurrence_end).toLocaleDateString(lang === 'ja' ? 'ja-JP' : 'en-GB')}</>
                )}
                <span className={styles.recurNote}>
                  {lang === 'ja' ? ' — 削除すると全ての繰り返しが削除されます' : ' — deleting removes all occurrences'}
                </span>
              </span>
            </div>
          )}
          {event.location    && <div className={styles.dr}><span>📍</span><span>{event.location}</span></div>}
          {event.description && <div className={styles.dr}><span>📝</span><span>{event.description}</span></div>}
          {participants.length > 0 && (
            <div className={styles.dr}>
              <span>👥</span>
              <div className={styles.attendeeList}>
                <div className={styles.availSummary}>
                  <span className={styles.availIn}>✓ {participants.filter(p => (p.status ?? 'in') === 'in').length}</span>
                  <span className={styles.availMaybe}>? {participants.filter(p => p.status === 'maybe').length}</span>
                  <span className={styles.availOut}>✗ {participants.filter(p => p.status === 'out').length}</span>
                </div>
                {participants.map(ep => {
                  const name   = ep.profiles?.display_name || ep.profiles?.email || ep.profile_id;
                  const isMe   = ep.profile_id === currentUserId;
                  const status = ep.status ?? 'in';
                  return (
                    <div key={ep.profile_id} className={styles.attendeeRow}>
                      <span className={status === 'in' ? styles.statusIn : status === 'maybe' ? styles.statusMaybe : styles.statusOut}>
                        {status === 'in' ? '✓' : status === 'maybe' ? '?' : '✗'}
                      </span>
                      <span className={styles.attendeeName}>{name}{isMe ? (lang === 'ja' ? ' (自分)' : ' (you)') : ''}</span>
                      {isMe && (
                        <div className={styles.rsBtns}>
                          <button className={`${styles.rsBtn} ${status === 'in'    ? styles.rsBtnInActive    : ''}`} onClick={() => setMyStatus('in')}>
                            {lang === 'ja' ? '出席' : 'In'}
                          </button>
                          <button className={`${styles.rsBtn} ${status === 'maybe' ? styles.rsBtnMaybeActive : ''}`} onClick={() => setMyStatus('maybe')}>
                            {lang === 'ja' ? '未定' : 'Maybe'}
                          </button>
                          <button className={`${styles.rsBtn} ${status === 'out'   ? styles.rsBtnOutActive   : ''}`} onClick={() => setMyStatus('out')}>
                            {lang === 'ja' ? '欠席' : 'Out'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {!iAmListed && currentUserId && (
            <div className={styles.dr}>
              <span>ℹ️</span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {lang === 'ja' ? 'あなたはこの予定に招待されていません。' : 'You are not listed for this event.'}
              </span>
            </div>
          )}
          <div className={styles.drMeta}><span>{lang === 'ja' ? '作成: ' : 'Created by: '}{event.created_by}</span></div>
          {event.updated_by && (
            <div className={styles.drMeta}><span>{lang === 'ja' ? '最終編集: ' : 'Edited by: '}{event.updated_by}</span></div>
          )}
        </div>
        <div className={styles.formActions}>
          {canEdit && (
            <button className={styles.deleteBtn} onClick={handleDelete} disabled={deleting}>
              {deleting ? '…' : (lang === 'ja' ? '削除' : 'Delete')}
            </button>
          )}
          {canEdit && (
            <button className={styles.editDetailBtn} onClick={() => onEdit(event)}>
              {lang === 'ja' ? '編集' : 'Edit'}
            </button>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>{lang === 'ja' ? '閉じる' : 'Close'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ year, month, events, lang, today, onDayClick, onEventClick }) {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startDow = (firstDay.getDay() + 6) % 7;
  const cells    = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const dayEvents = (day) => events.filter(ev => sameDay(new Date(ev.start_time), new Date(year, month, day)));

  return (
    <div className={styles.monthView}>
      <div className={styles.weekdays}>
        {WEEKDAYS[lang].map(d => <div key={d} className={styles.wd}>{d}</div>)}
      </div>
      <div className={styles.grid}>
        {cells.map((day, i) => {
          const evs       = day ? dayEvents(day) : [];
          const todayCell = day && sameDay(new Date(year, month, day), today);
          return (
            <div key={i} className={`${styles.cell} ${!day ? styles.cellEmpty : ''} ${todayCell ? styles.cellToday : ''}`}
              onClick={() => day && onDayClick(new Date(year, month, day))}>
              {day && <span className={styles.dayNum}>{day}</span>}
              <div className={styles.pills}>
                {evs.slice(0, 3).map(ev => {
                  const cc = catColor(ev.category);
                  return (
                    <div key={ev._key ?? ev.id} className={styles.pill}
                      style={{ background: cc.bg, color: cc.text }}
                      onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                      title={ev.title}>
                      {ev.recurrence && <span className={styles.recurIcon}>↻</span>}
                      {!ev.all_day && <span className={styles.pillTime}>{pad(new Date(ev.start_time).getHours())}:{pad(new Date(ev.start_time).getMinutes())}</span>}
                      {ev.title}
                    </div>
                  );
                })}
                {evs.length > 3 && <div className={styles.more}>+{evs.length - 3}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────

function nowLineTop() {
  const n = new Date();
  const mins = (n.getHours() - HOUR_START) * 60 + n.getMinutes();
  return Math.max(0, mins / 60 * SLOT_H);
}

function WeekView({ weekStart, events, lang, today, onSlotClick, onEventClick }) {
  const gridRef = useRef(null);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart); d.setDate(d.getDate() + i); return d;
  });
  const [nowTop, setNowTop] = useState(nowLineTop);

  useEffect(() => {
    const id = setInterval(() => setNowTop(nowLineTop()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 7 * SLOT_H;
  }, [weekStart]);

  const dayEvs    = (day) => events.filter(ev => !ev.all_day && sameDay(new Date(ev.start_time), day));
  const allDayEvs = (day) => events.filter(ev =>  ev.all_day && sameDay(new Date(ev.start_time), day));

  return (
    <div className={styles.weekView}>
      <div className={styles.weekHead}>
        <div className={styles.gutterLabel} />
        {days.map((day, i) => (
          <div key={i} className={styles.weekDayCol}>
            <span className={styles.wdName}>{WEEKDAYS[lang][i]}</span>
            <span className={`${styles.wdNum} ${isToday(day) ? styles.wdToday : ''}`}>{day.getDate()}</span>
          </div>
        ))}
      </div>
      <div className={styles.allDayRow2}>
        <div className={styles.gutterLabel} />
        {days.map((day, i) => (
          <div key={i} className={styles.allDayCell}>
            {allDayEvs(day).map(ev => {
              const cc = catColor(ev.category);
              return (
                <div key={ev._key ?? ev.id} className={styles.allDayPill}
                  style={{ background: cc.bg, color: cc.text }}
                  onClick={() => onEventClick(ev)}>
                  {ev.recurrence && '↻ '}{ev.title}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className={styles.timeGridWrap} ref={gridRef}>
        <div className={styles.timeGrid}>
          <div className={styles.hoursCol}>
            {HOURS.map(h => <div key={h} className={styles.hourLabel}>{pad(h)}:00</div>)}
          </div>
          {days.map((day, di) => (
            <div key={di} className={styles.dayCol}>
              {HOURS.map(h => (
                <div key={h} className={styles.hourCell}
                  onClick={() => onSlotClick(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, 0))} />
              ))}
              {isToday(day) && (
                <div className={styles.nowLine} style={{ top: nowTop }} />
              )}
              {dayEvs(day).map(ev => (
                <div key={ev._key ?? ev.id} className={styles.tEvent}
                  style={{ ...eventStyle(ev), background: catColor(ev.category).solid }}
                  onClick={e => { e.stopPropagation(); onEventClick(ev); }}>
                  <span className={styles.tEventTitle}>{ev.recurrence && '↻ '}{ev.title}</span>
                  <span className={styles.tEventTime}>{pad(new Date(ev.start_time).getHours())}:{pad(new Date(ev.start_time).getMinutes())}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({ date, events, lang, today, onSlotClick, onEventClick }) {
  const gridRef = useRef(null);
  const [nowTop, setNowTop] = useState(nowLineTop);
  const isT = isToday(date);

  useEffect(() => {
    const id = setInterval(() => setNowTop(nowLineTop()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.scrollTop = isT ? Math.max(0, nowLineTop() - SLOT_H) : 7 * SLOT_H;
    }
  }, [date]);

  const dayEvs    = events.filter(ev => !ev.all_day && sameDay(new Date(ev.start_time), date));
  const allDayEvs = events.filter(ev =>  ev.all_day && sameDay(new Date(ev.start_time), date));

  return (
    <div className={styles.weekView}>
      <div className={styles.weekHead}>
        <div className={styles.gutterLabel} />
        <div className={`${styles.weekDayCol} ${styles.dayViewCol}`}>
          <span className={styles.wdName}>{WEEKDAYS[lang][(date.getDay()+6)%7]}</span>
          <span className={`${styles.wdNum} ${isT ? styles.wdToday : ''}`}>{date.getDate()}</span>
        </div>
      </div>
      {allDayEvs.length > 0 && (
        <div className={styles.allDayRow2}>
          <div className={styles.gutterLabel} />
          <div className={`${styles.allDayCell} ${styles.dayViewCol}`}>
            {allDayEvs.map(ev => {
              const cc = catColor(ev.category);
              return (
                <div key={ev._key ?? ev.id} className={styles.allDayPill}
                  style={{ background: cc.bg, color: cc.text }}
                  onClick={() => onEventClick(ev)}>
                  {ev.recurrence && '↻ '}{ev.title}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className={styles.timeGridWrap} ref={gridRef}>
        <div className={styles.timeGrid}>
          <div className={styles.hoursCol}>
            {HOURS.map(h => <div key={h} className={styles.hourLabel}>{pad(h)}:00</div>)}
          </div>
          <div className={`${styles.dayCol} ${styles.dayViewCol}`}>
            {HOURS.map(h => (
              <div key={h} className={styles.hourCell}
                onClick={() => onSlotClick(new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, 0))} />
            ))}
            {isT && <div className={styles.nowLine} style={{ top: nowTop }} />}
            {dayEvs.map(ev => (
              <div key={ev._key ?? ev.id} className={styles.tEvent}
                style={{ ...eventStyle(ev), background: catColor(ev.category).solid }}
                onClick={e => { e.stopPropagation(); onEventClick(ev); }}>
                <span className={styles.tEventTitle}>{ev.recurrence && '↻ '}{ev.title}</span>
                <span className={styles.tEventTime}>
                  {pad(new Date(ev.start_time).getHours())}:{pad(new Date(ev.start_time).getMinutes())} – {pad(new Date(ev.end_time).getHours())}:{pad(new Date(ev.end_time).getMinutes())}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Calendar ─────────────────────────────────────────────────────────────

export default function Calendar({ lang = 'en', currentUserName = '', role = 'Player', currentUserId = null }) {
  const toast = useToast();
  const today = new Date();
  const [view,      setView]      = useState('month');
  const [current,   setCurrent]   = useState(new Date(today.getFullYear(), today.getMonth(), today.getDate()));
  const [events,    setEvents]    = useState([]);
  const [profiles,  setProfiles]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [formDate,    setFormDate]    = useState(null);
  const [detailEv,    setDetailEv]    = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [copied,    setCopied]    = useState(false);
  const canEdit = ['GM', 'Headcoach', 'Athletic', 'Therapist', 'Staff/Orga'].includes(role);

  useEffect(() => {
    supabase.from('profiles').select('id, display_name, email, role, position')
      .order('display_name')
      .then(({ data }) => setProfiles(data ?? []));
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const from = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    const to   = new Date(current.getFullYear(), current.getMonth() + 2, 0, 23, 59);
    // Fetch events starting at or before `to` — recurring events that started earlier
    // will be expanded client-side; non-recurring ones outside [from, to] are dropped.
    const { data } = await supabase
      .from('events')
      .select('*, event_participants(profile_id, status, profiles(display_name, email))')
      .lte('start_time', to.toISOString())
      .order('start_time', { ascending: true });
    setEvents(expandRecurring(data ?? [], from.toISOString(), to.toISOString()));
    setLoading(false);
  }, [current]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  useEffect(() => {
    const ch = supabase.channel('events-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, loadEvents)
      .subscribe();
    return () => ch.unsubscribe();
  }, [loadEvents]);

  const navigate = (dir) => {
    setCurrent(prev => {
      const d = new Date(prev);
      if (view === 'month') d.setMonth(d.getMonth() + dir);
      if (view === 'week')  d.setDate(d.getDate() + dir * 7);
      if (view === 'day')   d.setDate(d.getDate() + dir);
      return d;
    });
  };

  const headerLabel = () => {
    if (view === 'month') return `${MONTHS[lang][current.getMonth()]} ${current.getFullYear()}`;
    if (view === 'week') {
      const ws = getWeekStart(current);
      const we = new Date(ws); we.setDate(we.getDate() + 6);
      return `${pad(ws.getDate())} – ${pad(we.getDate())} ${MONTHS[lang][we.getMonth()].slice(0,3)} ${we.getFullYear()}`;
    }
    return `${WEEKDAYS[lang][(current.getDay()+6)%7]}, ${pad(current.getDate())} ${MONTHS[lang][current.getMonth()]} ${current.getFullYear()}`;
  };

  const handleSlotClick = (date) => { if (canEdit) { setFormDate(date); setShowForm(true); } };
  const handleDayClick  = (date) => {
    if (view === 'month') { setCurrent(date); setView('day'); }
    else if (canEdit) { setFormDate(date); setShowForm(true); }
  };

  const icsUrl  = typeof window !== 'undefined' ? `${window.location.origin}/api/calendar` : '/api/calendar';
  const copyUrl = () => { navigator.clipboard.writeText(icsUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  const weekStart     = getWeekStart(current);
  const upcomingEvents = [...events].filter(ev => new Date(ev.start_time) >= today).slice(0, 5);

  return (
    <div className={styles.wrapper}>

      {/* Left: calendar */}
      <div className={styles.calPane}>
        <div className={styles.calHeader}>
          <button className={styles.navBtn} onClick={() => navigate(-1)}>‹</button>
          <span className={styles.headerLabel}>{headerLabel()}</span>
          <button className={styles.navBtn} onClick={() => navigate(1)}>›</button>
          <button className={styles.todayBtn} onClick={() => setCurrent(new Date(today.getFullYear(), today.getMonth(), today.getDate()))}>
            {lang === 'ja' ? '今日' : 'Today'}
          </button>
          <div className={styles.viewTabs}>
            {['month','week','day'].map(v => (
              <button key={v} className={`${styles.viewTab} ${view === v ? styles.viewTabActive : ''}`} onClick={() => setView(v)}>
                {v === 'month' ? (lang === 'ja' ? '月' : 'Month') : v === 'week' ? (lang === 'ja' ? '週' : 'Week') : (lang === 'ja' ? '日' : 'Day')}
              </button>
            ))}
          </div>
          {canEdit && (
            <button className={styles.addBtn} onClick={() => { setFormDate(current); setShowForm(true); }}>
              + {lang === 'ja' ? '予定' : 'Event'}
            </button>
          )}
        </div>

        {view === 'month' && (
          <MonthView year={current.getFullYear()} month={current.getMonth()}
            events={events} lang={lang} today={today}
            onDayClick={handleDayClick} onEventClick={setDetailEv} />
        )}
        {view === 'week' && (
          <WeekView weekStart={weekStart} events={events} lang={lang} today={today}
            onSlotClick={handleSlotClick} onEventClick={setDetailEv} />
        )}
        {view === 'day' && (
          <DayView date={current} events={events} lang={lang} today={today}
            onSlotClick={handleSlotClick} onEventClick={setDetailEv} />
        )}
      </div>

      {/* Right: sidebar */}
      <div className={styles.sidePane}>
        <div className={styles.subscribeBox}>
          <div className={styles.subTitle}>📅 {lang === 'ja' ? 'Googleカレンダーで購読' : 'Subscribe in Google Calendar'}</div>
          <p className={styles.subSub}>
            {lang === 'ja'
              ? '「他のカレンダー → URLから追加」にこのURLを貼り付けてください。'
              : 'Google Calendar → "Other calendars → From URL"'}
          </p>
          <div className={styles.icsRow}>
            <code className={styles.icsUrl}>{icsUrl}</code>
            <button className={styles.copyBtn} onClick={copyUrl}>{copied ? '✓' : (lang === 'ja' ? 'コピー' : 'Copy')}</button>
          </div>
        </div>

        <div className={styles.upHead}>{lang === 'ja' ? '今後の予定' : 'Upcoming'}</div>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 0' }}>
            {[70, 55, 80, 60].map((w, i) => <SkeletonLine key={i} width={`${w}%`} height={13} style={{ marginBottom: 0 }} />)}
          </div>
        ) : upcomingEvents.length === 0 ? (
          <p className={styles.emptyTxt}>{lang === 'ja' ? '予定がありません。' : 'No upcoming events.'}</p>
        ) : (
          <div className={styles.upList}>
            {upcomingEvents.map(ev => {
              const d = new Date(ev.start_time);
              return (
                <div key={ev._key ?? ev.id} className={styles.upItem} onClick={() => setDetailEv(ev)}>
                  <div className={styles.upDate}>
                    <span className={styles.upDay}>{pad(d.getDate())}</span>
                    <span className={styles.upMonth}>{MONTHS[lang][d.getMonth()].slice(0,3)}</span>
                  </div>
                  <div className={styles.upInfo}>
                    <span className={styles.upTitle}>{ev.recurrence && '↻ '}{ev.title}</span>
                    {ev.location && <span className={styles.upLoc}>📍 {ev.location}</span>}
                    {!ev.all_day && <span className={styles.upTime}>{pad(d.getHours())}:{pad(d.getMinutes())}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canEdit && showForm && (
        <EventForm lang={lang} initialDate={formDate} currentUserName={currentUserName} currentUserId={currentUserId}
          profiles={profiles}
          onSave={() => { loadEvents(); toast(lang === 'ja' ? '予定を作成しました' : 'Event created', 'success'); }}
          onClose={() => setShowForm(false)} />
      )}
      {canEdit && editingEvent && (
        <EventForm lang={lang} event={editingEvent} currentUserName={currentUserName} currentUserId={currentUserId}
          profiles={profiles}
          onSave={() => { loadEvents(); toast(lang === 'ja' ? '予定を更新しました' : 'Event updated', 'success'); }}
          onClose={() => setEditingEvent(null)} />
      )}
      {detailEv && (
        <EventDetail event={detailEv} lang={lang} canEdit={canEdit} currentUserId={currentUserId}
          onEdit={ev => { setDetailEv(null); setEditingEvent(ev); }}
          onDelete={() => { loadEvents(); toast(lang === 'ja' ? '予定を削除しました' : 'Event deleted', 'info'); }}
          onClose={() => setDetailEv(null)} />
      )}
    </div>
  );
}
