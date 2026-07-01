'use client';

export default function Error({ error, reset }) {
  return (
    <div style={{ padding: '48px 24px', fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <h2 style={{ color: '#b91c1c', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        An unexpected error occurred. Try the actions below to recover.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button onClick={reset}
          style={{ padding: '10px 24px', background: '#7e0027', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
          Try again
        </button>
        <button onClick={() => window.location.href = '/'}
          style={{ padding: '10px 24px', background: 'transparent', color: '#374151', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
          Go home
        </button>
      </div>
    </div>
  );
}
