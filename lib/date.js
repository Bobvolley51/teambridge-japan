export function timeAgo(ts, lang) {
  const m = Math.floor((Date.now() - new Date(ts)) / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (lang === 'ja') {
    if (m < 1)  return 'たった今';
    if (m < 60) return `${m}分前`;
    if (h < 24) return `${h}時間前`;
    return `${d}日前`;
  }
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export function toJstDate(date = new Date()) {
  const d = date instanceof Date ? new Date(date) : new Date(date);
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}

export function toJstDateStart(date = new Date()) {
  const d = toJstDate(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function dateToYmd(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toJstDateStr(date = new Date()) {
  // Intl-based: always correct regardless of the browser's local timezone
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(
    date instanceof Date ? date : new Date(date)
  );
}
