'use client';
import { useState } from 'react';
import styles from './AvatarPhoto.module.css';

/**
 * Reusable avatar that shows a photo (or initials fallback).
 * Clicking a photo opens a full-screen lightbox.
 *
 * Props:
 *   url       – avatar_url from profile (null/undefined = show initials)
 *   initials  – fallback text (2 chars)
 *   name      – shown under the photo in the lightbox
 *   size      – number in px (default 32)
 *   className – optional extra class on the wrapper
 *   bg        – override background colour for initials circle
 */
export default function AvatarPhoto({ url, initials = '?', name, size = 32, className = '', bg }) {
  const [open, setOpen] = useState(false);
  const fontSize = Math.max(9, Math.round(size * 0.36));

  return (
    <>
      <div
        className={`${styles.wrap} ${className}`}
        style={{ width: size, height: size, fontSize, background: url ? undefined : (bg ?? undefined) }}
        onClick={url ? () => setOpen(true) : undefined}
        title={name}
        role={url ? 'button' : undefined}
        aria-label={url ? `View photo of ${name}` : undefined}
      >
        {url
          ? <img src={url} alt={name ?? initials} className={styles.img} />
          : <span className={styles.initials}>{(initials ?? '?').slice(0, 2).toUpperCase()}</span>
        }
        {url && <span className={styles.zoomHint}>🔍</span>}
      </div>

      {open && (
        <div className={styles.lightbox} onClick={() => setOpen(false)}>
          <div className={styles.lightboxInner} onClick={e => e.stopPropagation()}>
            <img src={url} alt={name ?? initials} className={styles.lightboxImg} />
            {name && <div className={styles.lightboxName}>{name}</div>}
            <button className={styles.lightboxClose} onClick={() => setOpen(false)}>✕</button>
          </div>
        </div>
      )}
    </>
  );
}
