'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

let _id = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'success', duration = 2500) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const ICONS = { success: '✓', error: '✕', info: 'ℹ' };
const COLORS = {
  success: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46', icon: '#10b981' },
  error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '#ef4444' },
  info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', icon: '#3b82f6' },
};

function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999, pointerEvents: 'none', alignItems: 'center' }}>
      {toasts.map(t => {
        const c = COLORS[t.type] ?? COLORS.success;
        return (
          <div key={t.id} onClick={() => onDismiss(t.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
              padding: '10px 16px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
              fontSize: 13, fontWeight: 600, color: c.text,
              pointerEvents: 'all', cursor: 'pointer', whiteSpace: 'nowrap',
              animation: 'toastIn 0.2s ease',
              fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            }}>
            <span style={{ color: c.icon, fontSize: 15 }}>{ICONS[t.type]}</span>
            {t.message}
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
