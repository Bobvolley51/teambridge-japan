'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/lib/toast';
import { useTranslated } from '@/lib/translate';
import { SkeletonCardBlock } from './Skeleton';
import styles from './Tasks.module.css';

const COLUMNS = [
  { id: 'todo',       label: { en: 'To Do',      ja: '未対応'   } },
  { id: 'inProgress', label: { en: 'In Progress', ja: '進行中'   } },
  { id: 'review',     label: { en: 'Review',      ja: 'レビュー' } },
  { id: 'done',       label: { en: 'Done',        ja: '完了'     } },
];

const PRIORITIES = ['high', 'medium', 'low'];

const PRIORITY_LABELS = {
  high:   { en: 'High',   ja: '高' },
  medium: { en: 'Medium', ja: '中' },
  low:    { en: 'Low',    ja: '低' },
};

const T = {
  tasks:         { en: 'Tasks',             ja: 'タスク'           },
  total:         { en: 'total',             ja: '件'               },
  addTask:       { en: '+ Add task',        ja: '+ タスクを追加'   },
  loading:       { en: 'Loading tasks…',    ja: 'タスクを読込中...' },
  newTask:       { en: 'New Task',          ja: '新しいタスク'     },
  editTask:      { en: 'Edit Task',         ja: 'タスクを編集'     },
  title:         { en: 'Title',             ja: 'タイトル'         },
  description:   { en: 'Description',      ja: '説明'             },
  priority:      { en: 'Priority',          ja: '優先度'           },
  dueDate:       { en: 'Due date',          ja: '期限'             },
  assignTo:      { en: 'Assign to',         ja: '担当者'           },
  unassigned:    { en: 'Unassigned',        ja: '未割当'           },
  allPriorities: { en: 'All priorities',   ja: 'すべての優先度'   },
  allMembers:    { en: 'All members',       ja: 'すべてのメンバー' },
  sortCreated:   { en: 'Sort: Created',     ja: '作成順'           },
  sortDue:       { en: 'Sort: Due date',    ja: '期限順'           },
  save:          { en: 'Save',              ja: '保存'             },
  saving:        { en: 'Saving…',           ja: '保存中…'          },
  cancel:        { en: 'Cancel',            ja: 'キャンセル'       },
  delete:        { en: 'Delete',            ja: '削除'             },
  column:        { en: 'Column',            ja: 'カラム'           },
  titleRequired: { en: 'Title is required', ja: 'タイトルが必要です' },
  noTasks:       { en: 'No tasks',          ja: 'タスクなし'         },
};

function tr(key, lang) { return T[key]?.[lang] ?? T[key]?.en ?? key; }

function profileName(p) { return p.display_name || p.email.split('@')[0]; }

function formatDue(dateStr, lang) {
  if (!dateStr) return null;
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(
    lang === 'ja' ? 'ja-JP' : 'en-GB',
    { month: 'short', day: 'numeric' }
  );
}

function isOverdue(dateStr) {
  if (!dateStr) return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return new Date(dateStr + 'T00:00:00') < today;
}

// ── Priority dot ──────────────────────────────────────────────────────────────

function PriorityDot({ priority }) {
  return <span className={`${styles.priorityDot} ${styles[`priority_${priority}`]}`} />;
}

// ── Task card ─────────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 72;

function TaskCard({ task, lang, profiles, onEdit, onDelete, onMove }) {
  const assignee = profiles.find(p => p.id === task.assigned_to);
  const assigneeName = assignee ? profileName(assignee) : (task.assignee || null);
  const overdue = isOverdue(task.due_date);
  const taskTitle = useTranslated(task.title, lang);
  const taskDesc  = useTranslated(task.description, lang);

  const colIdx = COLUMNS.findIndex(c => c.id === task.status);
  const prevCol = COLUMNS[colIdx - 1] ?? null;
  const nextCol = COLUMNS[colIdx + 1] ?? null;

  const touchX   = useRef(null);
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);

  const handleTouchStart = (e) => {
    touchX.current = e.touches[0].clientX;
    setSwiping(false);
  };

  const handleTouchMove = (e) => {
    if (touchX.current === null) return;
    const dx = e.touches[0].clientX - touchX.current;
    if (Math.abs(dx) > 8) setSwiping(true);
    setOffset(Math.max(-120, Math.min(120, dx)));
  };

  const handleTouchEnd = () => {
    if (offset > SWIPE_THRESHOLD && task.status !== 'done') {
      onMove(task.id, 'done');
    } else if (offset < -SWIPE_THRESHOLD) {
      onDelete(task.id);
    }
    setOffset(0);
    setSwiping(false);
    touchX.current = null;
  };

  const showComplete = offset > 20 && task.status !== 'done';
  const showDelete   = offset < -20;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 10 }}>
      {/* Swipe hint backgrounds */}
      {showComplete && (
        <div style={{ position: 'absolute', inset: 0, background: '#dcfce7', display: 'flex', alignItems: 'center', paddingLeft: 16, borderRadius: 10 }}>
          <span style={{ fontSize: 18 }}>✅</span>
        </div>
      )}
      {showDelete && (
        <div style={{ position: 'absolute', inset: 0, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 16, borderRadius: 10 }}>
          <span style={{ fontSize: 18 }}>🗑️</span>
        </div>
      )}
      <div
        className={styles.card}
        draggable={!swiping}
        onDragStart={(e) => e.dataTransfer.setData('taskId', task.id)}
        onClick={() => !swiping && onEdit(task)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: offset === 0 ? 'transform 0.2s ease' : 'none', willChange: 'transform' }}
      >
        <p className={styles.cardTitle}>{taskTitle}</p>
        {task.description && (
          <p className={styles.cardDesc}>{taskDesc}</p>
        )}
        {task.due_date && (
          <span className={`${styles.dueChip} ${overdue ? styles.overdueChip : ''}`}>
            {overdue ? '⚠ ' : '📅 '}{formatDue(task.due_date, lang)}
          </span>
        )}
        <div className={styles.cardFooter}>
          {assigneeName
            ? <span className={styles.assignee}>{assigneeName}</span>
            : <span />}
          <div className={styles.cardRight}>
            {prevCol && (
              <button
                className={styles.moveBtnBack}
                onClick={(e) => { e.stopPropagation(); onMove(task.id, prevCol.id); }}
                title={prevCol.label[lang]}
              >
                ←
              </button>
            )}
            {nextCol && (
              <button
                className={styles.moveBtn}
                onClick={(e) => { e.stopPropagation(); onMove(task.id, nextCol.id); }}
                title={nextCol.label[lang]}
              >
                → {nextCol.label[lang]}
              </button>
            )}
            <PriorityDot priority={task.priority} />
            <button
              className={styles.deleteBtn}
              onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
              aria-label={tr('delete', lang)}
            >×</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Task modal ────────────────────────────────────────────────────────────────

function TaskModal({ task, colId, profiles, lang, onSave, onDelete, onClose }) {
  const isNew = !task?.id;
  const [form, setForm] = useState({
    title:       task?.title       ?? '',
    description: task?.description ?? '',
    priority:    task?.priority    ?? 'medium',
    due_date:    task?.due_date    ?? '',
    assigned_to: task?.assigned_to ?? '',
    status:      task?.status      ?? colId ?? 'todo',
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { setErr(tr('titleRequired', lang)); return; }
    setSaving(true);
    await onSave({ ...form, title: form.title.trim(), id: task?.id });
    setSaving(false);
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>
            {isNew ? tr('newTask', lang) : tr('editTask', lang)}
          </span>
          <button className={styles.closeBtn} onClick={onClose}>×</button>
        </div>

        {err && <p className={styles.modalErr}>{err}</p>}

        <div className={styles.modalBody}>
          <label className={styles.label}>{tr('title', lang)}</label>
          <input
            className={styles.modalInput}
            value={form.title}
            onChange={e => set('title', e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
            autoFocus
          />

          <label className={styles.label}>{tr('description', lang)}</label>
          <textarea
            className={styles.modalTextarea}
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={3}
          />

          <div className={styles.modalRow}>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('priority', lang)}</label>
              <select
                className={styles.modalSelect}
                value={form.priority}
                onChange={e => set('priority', e.target.value)}
              >
                {PRIORITIES.map(p => (
                  <option key={p} value={p}>{PRIORITY_LABELS[p][lang]}</option>
                ))}
              </select>
            </div>
            <div className={styles.modalField}>
              <label className={styles.label}>{tr('dueDate', lang)}</label>
              <input
                type="date"
                className={styles.modalInput}
                value={form.due_date ?? ''}
                onChange={e => set('due_date', e.target.value)}
              />
            </div>
          </div>

          <label className={styles.label}>{tr('assignTo', lang)}</label>
          <select
            className={styles.modalSelect}
            value={form.assigned_to}
            onChange={e => set('assigned_to', e.target.value)}
          >
            <option value="">{tr('unassigned', lang)}</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>{profileName(p)}</option>
            ))}
          </select>

          {!isNew && (
            <>
              <label className={styles.label}>{tr('column', lang)}</label>
              <select
                className={styles.modalSelect}
                value={form.status}
                onChange={e => set('status', e.target.value)}
              >
                {COLUMNS.map(c => (
                  <option key={c.id} value={c.id}>{c.label[lang]}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <div className={styles.modalFooter}>
          {!isNew && (
            <button className={styles.modalDeleteBtn} onClick={() => onDelete(task.id)}>
              {tr('delete', lang)}
            </button>
          )}
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={onClose}>
              {tr('cancel', lang)}
            </button>
            <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? tr('saving', lang) : tr('save', lang)}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Filter bar ────────────────────────────────────────────────────────────────

function FilterBar({ lang, profiles, filterPriority, filterAssignee, sortBy, onChange, isCoach }) {
  return (
    <div className={styles.filterBar}>
      <select
        className={styles.filterSelect}
        value={filterPriority}
        onChange={e => onChange('priority', e.target.value)}
      >
        <option value="all">{tr('allPriorities', lang)}</option>
        {PRIORITIES.map(p => (
          <option key={p} value={p}>{PRIORITY_LABELS[p][lang]}</option>
        ))}
      </select>

      {isCoach && (
        <select
          className={styles.filterSelect}
          value={filterAssignee}
          onChange={e => onChange('assignee', e.target.value)}
        >
          <option value="all">{tr('allMembers', lang)}</option>
          {profiles.map(p => (
            <option key={p.id} value={p.id}>{profileName(p)}</option>
          ))}
        </select>
      )}

      <button
        className={styles.sortBtn}
        onClick={() => onChange('sort', sortBy === 'created' ? 'due' : 'created')}
      >
        {sortBy === 'due' ? tr('sortDue', lang) : tr('sortCreated', lang)}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Tasks({ lang = 'en', profile }) {
  const toast = useToast();
  const [tasks,          setTasks]          = useState([]);
  const [profiles,       setProfiles]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [sortBy,         setSortBy]         = useState('created');
  const [editingTask,    setEditingTask]    = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('tasks').select('*').order('created_at', { ascending: true });
      if (cancelled) return;
      if (err) setError(err.message);
      else setTasks(data ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    supabase.from('profiles').select('id, email, display_name')
      .order('display_name').then(({ data }) => { if (data) setProfiles(data); });
  }, []);

  useEffect(() => {
    const ch = supabase.channel('tasks-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, p => {
        setTasks(prev => prev.some(t => t.id === p.new.id) ? prev : [...prev, p.new]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, p => {
        setTasks(prev => prev.map(t => t.id === p.new.id ? p.new : t));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tasks' }, p => {
        setTasks(prev => prev.filter(t => t.id !== p.old.id));
      })
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const saveTask = useCallback(async (form) => {
    const assigneeProfile = profiles.find(p => p.id === form.assigned_to);
    const payload = {
      title:       form.title,
      description: form.description || null,
      priority:    form.priority,
      due_date:    form.due_date    || null,
      assigned_to: form.assigned_to || null,
      assignee:    assigneeProfile ? profileName(assigneeProfile) : null,
      status:      form.status,
    };

    if (form.id) {
      const { error: err } = await supabase.from('tasks').update(payload).eq('id', form.id);
      if (err) { setError('Could not update task: ' + err.message); return; }
      toast(lang === 'ja' ? 'タスクを更新しました' : 'Task updated', 'success');
    } else {
      const optimistic = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString(), _optimistic: true };
      setTasks(prev => [...prev, optimistic]);
      const { error: err } = await supabase.from('tasks').insert(payload);
      if (err) {
        setError('Could not add task: ' + err.message);
        setTasks(prev => prev.filter(t => t.id !== optimistic.id));
        return;
      }
      toast(lang === 'ja' ? 'タスクを作成しました' : 'Task created', 'success');
    }
    setEditingTask(null);
  }, [profiles, lang, toast]);

  const moveTask = useCallback(async (taskId, newStatus) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
    const { error: err } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);
    if (err) setError('Could not move task: ' + err.message);
  }, []);

  const deleteTask = useCallback(async (taskId) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setEditingTask(null);
    const { error: err } = await supabase.from('tasks').delete().eq('id', taskId);
    if (err) setError('Could not delete task: ' + err.message);
    else toast(lang === 'ja' ? 'タスクを削除しました' : 'Task deleted', 'info');
  }, [lang, toast]);

  const handleFilterChange = useCallback((type, value) => {
    if (type === 'priority') setFilterPriority(value);
    else if (type === 'assignee') setFilterAssignee(value);
    else if (type === 'sort') setSortBy(value);
  }, []);

  const STAFF_ROLES = ['GM', 'Headcoach', 'Athletic Trainer', 'Therapist', 'Coaching Staff', 'Organisation Staff'];
  const isStaff = STAFF_ROLES.includes(profile?.role);

  const visibleTasks = tasks
    .filter(t => isStaff || t.assigned_to === profile?.id)
    .filter(t => filterPriority === 'all' || t.priority === filterPriority)
    .filter(t => !isStaff || filterAssignee === 'all' || t.assigned_to === filterAssignee)
    .sort((a, b) => {
      if (sortBy !== 'due') return new Date(a.created_at) - new Date(b.created_at);
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date);
    });

  if (loading) return (
    <div style={{ display: 'flex', gap: 16, padding: '16px 0' }}>
      <SkeletonCardBlock lines={4} />
      <SkeletonCardBlock lines={4} />
      <SkeletonCardBlock lines={3} />
    </div>
  );

  return (
    <div className={styles.wrapper}>
      {error && (
        <div className={styles.error}>
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      <div className={styles.header}>
        <span className={styles.headerTitle}>{tr('tasks', lang)}</span>
        <span className={styles.headerCount}>{visibleTasks.length} {tr('total', lang)}</span>
      </div>

      <FilterBar
        lang={lang}
        profiles={profiles}
        filterPriority={filterPriority}
        filterAssignee={filterAssignee}
        sortBy={sortBy}
        onChange={handleFilterChange}
        isCoach={isCoach}
      />

      <div className={styles.kanban}>
        {COLUMNS.map(col => {
          const colTasks = visibleTasks.filter(t => t.status === col.id);
          return (
            <div
              key={col.id}
              className={styles.column}
              onDragOver={e => e.preventDefault()}
              onDrop={e => {
                const id = e.dataTransfer.getData('taskId');
                if (id) moveTask(id, col.id);
              }}
            >
              <div className={styles.colHeader}>
                <span>{col.label[lang]}</span>
                <span className={styles.colCount}>{colTasks.length}</span>
              </div>

              <div className={styles.cardList}>
                {colTasks.length === 0
                  ? <div className={styles.emptyCol}>{tr('noTasks', lang)}</div>
                  : colTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      lang={lang}
                      profiles={profiles}
                      onEdit={setEditingTask}
                      onDelete={deleteTask}
                      onMove={moveTask}
                    />
                  ))
                }
              </div>

              <button
                className={styles.addTaskBtn}
                onClick={() => setEditingTask({ _new: true, status: col.id })}
              >
                {tr('addTask', lang)}
              </button>
            </div>
          );
        })}
      </div>

      {editingTask && (
        <TaskModal
          task={editingTask._new ? null : editingTask}
          colId={editingTask.status}
          profiles={profiles}
          lang={lang}
          onSave={saveTask}
          onDelete={deleteTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
