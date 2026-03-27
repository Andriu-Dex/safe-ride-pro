export default function HomePage(): JSX.Element {
  return (
    <main
      style={{
        display: 'grid',
        minHeight: '100vh',
        placeItems: 'center',
        padding: '2rem',
      }}
    >
      <section
        style={{
          width: 'min(760px, 100%)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          background: 'var(--surface)',
          padding: '2.5rem',
          backdropFilter: 'blur(14px)',
          boxShadow: '0 18px 60px rgba(15, 23, 42, 0.08)',
        }}
      >
        <p
          style={{
            margin: 0,
            color: 'var(--accent)',
            fontSize: '0.95rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          Inicio del proyecto
        </p>
        <h1
          style={{
            marginBottom: '1rem',
            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
            lineHeight: 1,
          }}
        >
          SafeRidePro
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: '52ch',
            fontSize: '1.05rem',
            lineHeight: 1.7,
          }}
        >
          La base del monorepo ya esta preparada para comenzar a construir la plataforma de transporte seguro compartido para estudiantes.
        </p>
      </section>
    </main>
  );
}
