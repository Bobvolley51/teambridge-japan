'use client';

import { useState, useRef, useEffect } from 'react';
import styles from './Select.module.css';

/**
 * Universal styled Select component.
 *
 * Props:
 *   value      — current value (string)
 *   onChange   — (value: string) => void
 *   options    — Array<{ value: string, label: string, meta?: string, initials?: string, disabled?: boolean }>
 *   placeholder — string shown when value is empty (also added as first option)
 *   size       — 'sm' | 'md' | 'lg' (default 'md')
 *   disabled   — boolean
 *   className  — extra class applied to .wrap
 *   style      — inline style for .wrap
 *   accentColor — hex string, applied as left border color (e.g. '#2563eb' for calendar category)
 */
export default function Select({
  value,
  onChange,
  options = [],
  placeholder = '',
  size = 'md',
  disabled = false,
  className = '',
  style,
  accentColor,
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  const selected = options.find(o => String(o.value) === String(value));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const sizeClass = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : '';

  const triggerStyle = accentColor
    ? { borderLeft: `4px solid ${accentColor}` }
    : undefined;

  return (
    <div
      className={[styles.wrap, sizeClass, accentColor ? styles.accentLeft : '', className].filter(Boolean).join(' ')}
      style={style}
      ref={wrapRef}
    >
      <button
        type="button"
        className={styles.trigger}
        style={triggerStyle}
        onClick={() => { if (!disabled) setOpen(v => !v); }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selected?.initials && (
          <span className={styles.optionAvatar}>{selected.initials}</span>
        )}
        <span className={selected ? styles.triggerValue : styles.triggerPlaceholder}>
          {selected ? selected.label : (placeholder || '—')}
        </span>
        <span className={`${styles.chevron} ${open ? styles.chevronOpen : ''}`}>▼</span>
      </button>

      {open && (
        <div className={styles.dropdown} role="listbox">
          {placeholder && (
            <button
              type="button"
              className={`${styles.option} ${!value ? styles.optionActive : ''}`}
              onClick={() => { onChange(''); setOpen(false); }}
            >
              <span>{placeholder}</span>
            </button>
          )}
          {placeholder && options.length > 0 && <div className={styles.divider} />}
          {options.map((opt, i) => (
            <button
              key={`${opt.value}_${i}`}
              type="button"
              role="option"
              aria-selected={String(opt.value) === String(value)}
              className={[
                styles.option,
                String(opt.value) === String(value) ? styles.optionActive : '',
                opt.disabled ? styles.optionDisabled : '',
              ].filter(Boolean).join(' ')}
              onClick={() => {
                if (!opt.disabled) { onChange(opt.value); setOpen(false); }
              }}
            >
              {opt.initials && <span className={styles.optionAvatar}>{opt.initials}</span>}
              <span style={{ flex: 1 }}>{opt.label}</span>
              {opt.meta && <span className={styles.optionMeta}>{opt.meta}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
