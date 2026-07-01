export default function NotFound() {
  return (
    <div style={{ padding: '48px 24px', fontFamily: 'sans-serif', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 48, marginBottom: 16, fontWeight: 700, color: '#7e0027' }}>404</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 8 }}>Page not found</h2>
      <p style={{ color: '#6b7280', fontSize: 14, marginBottom: 24, lineHeight: 1.5 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>
      <a href="/"
        style={{ display: 'inline-block', padding: '10px 24px', background: '#7e0027', color: '#fff', borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: 'none', fontFamily: 'inherit' }}>
        Go home
      </a>
    </div>
  );
}
