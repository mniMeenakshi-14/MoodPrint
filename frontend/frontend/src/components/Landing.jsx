// Minimal MoodPrint landing page

export default function Landing({ onStart }) {
  return (
    <main
      className="landing"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '24px',
        boxSizing: 'border-box'
      }}
    >
      <section
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '22px'
        }}
      >
        <h1
          className="grad-text"
          style={{
            fontSize: 'clamp(3.5rem, 9vw, 6rem)',
            fontWeight: '800',
            letterSpacing: '-3px',
            margin: 0
          }}
        >
          MoodPrint
        </h1>

        <p
          className="muted"
          style={{
            fontSize: 'clamp(1rem, 2.5vw, 1.3rem)',
            margin: 0,
            letterSpacing: '0.5px'
          }}
        >
          Your space. Your feelings. Your peace.
        </p>

        <button
          className="btn primary"
          onClick={onStart}
          style={{
            marginTop: '18px',
            padding: '14px 38px',
            fontSize: '1rem',
            borderRadius: '12px',
            cursor: 'pointer'
          }}
        >
          Get Started →
        </button>
      </section>
    </main>
  );
}