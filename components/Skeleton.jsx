'use client';

import styles from './Skeleton.module.css';

export function SkeletonLine({ width, height, style }) {
  return (
    <span className={styles.base} style={{ height: height ?? 14, width: width ?? '100%', marginBottom: 8, ...style }} />
  );
}

export function SkeletonCircle({ size = 36 }) {
  return (
    <span className={styles.circle} style={{ width: size, height: size }} />
  );
}

export function SkeletonCard({ height = 80 }) {
  return (
    <span className={styles.card} style={{ height }} />
  );
}

/* A ready-made "list of items" skeleton: n rows of avatar + two lines */
export function SkeletonList({ rows = 3 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={styles.row}>
          <SkeletonCircle size={36} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonLine width="70%" height={13} style={{ marginBottom: 0 }} />
            <SkeletonLine width="45%" height={10} style={{ marginBottom: 0 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* A card with a title line + body lines */
export function SkeletonCardBlock({ lines = 3 }) {
  return (
    <div className={styles.block}>
      <SkeletonLine width="50%" height={16} style={{ marginBottom: 4 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i % 2 === 0 ? '100%' : '75%'} height={12} style={{ marginBottom: 0 }} />
      ))}
    </div>
  );
}
