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
