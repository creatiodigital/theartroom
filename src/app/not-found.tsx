import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: '#111',
        color: '#fff',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', marginBottom: '0.75rem', fontWeight: 500 }}>
        Page not found
      </h2>
      <p style={{ color: '#999', fontSize: '0.875rem', maxWidth: '420px', lineHeight: 1.6 }}>
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        style={{
          marginTop: '1.5rem',
          padding: '0.625rem 1.5rem',
          backgroundColor: '#333',
          color: '#fff',
          border: '1px solid #555',
          borderRadius: '6px',
          textDecoration: 'none',
          fontSize: '0.875rem',
        }}
      >
        Go home
      </Link>
    </div>
  )
}
