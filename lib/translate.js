'use client';
import { useState, useEffect } from 'react';

const mem = new Map();

export async function translate(text, targetLang) {
  if (!text?.trim()) return text;
  const apiLang = targetLang === 'ja' ? 'Japanese' : 'English';
  const key = `tb_t:${targetLang}:${text.slice(0, 200)}`;
  if (mem.has(key)) return mem.get(key);
  try {
    const stored = localStorage.getItem(key);
    if (stored) { mem.set(key, stored); return stored; }
  } catch {}
  try {
    const res = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLang: apiLang }),
    });
    if (!res.ok) return null;
    const { translation } = await res.json();
    const result = translation ?? text;
    mem.set(key, result);
    try { localStorage.setItem(key, result); } catch {}
    return result;
  } catch { return null; }
}

export function useTranslated(text, lang) {
  const [out, setOut] = useState(text);
  useEffect(() => {
    let cancelled = false;
    if (!text?.trim()) { setOut(text); return; }
    translate(text, lang).then(t => { if (!cancelled) setOut(t ?? text); });
    return () => { cancelled = true; };
  }, [text, lang]);
  return out;
}
