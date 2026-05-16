// lib/push.js — fire-and-forget push helper for client-side code

export function sendPush(userIds, { title, body, url = '/', tag, prefKey } = {}) {
  if (!userIds?.length) return;
  fetch('/api/push', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userIds, title, body, url, tag, prefKey }),
  }).catch(() => {});
}
