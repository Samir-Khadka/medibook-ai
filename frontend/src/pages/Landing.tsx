import { Link } from 'react-router-dom';

const SPECIALTIES = [
  { name: 'Cardiology', icon: '🫀', blurb: 'Heart & circulation' },
  { name: 'Dermatology', icon: '🧴', blurb: 'Skin, hair & nails' },
  { name: 'Neurology', icon: '🧠', blurb: 'Brain & nerves' },
  { name: 'Orthopedics', icon: '🦴', blurb: 'Bones & joints' },
  { name: 'Pediatrics', icon: '👶', blurb: "Children's health" },
  { name: 'General Medicine', icon: '🩺', blurb: 'Everyday care' },
  { name: 'Ophthalmology', icon: '👁️', blurb: 'Eyes & vision' },
  { name: 'Gynecology', icon: '🤰', blurb: "Women's health" },
];

const STEPS = [
  {
    n: '1',
    title: 'Describe your symptoms',
    text: 'Tell our AI what you feel in plain words — no medical jargon needed.',
  },
  {
    n: '2',
    title: 'Get matched to a specialty',
    text: 'The triage engine suggests the right specialty with a confidence score.',
  },
  {
    n: '3',
    title: 'Book in minutes',
    text: 'See live availability, pick a slot, and confirm your appointment.',
  },
];

export function Landing() {
  return (
    <div className="landing">
      {/* hero */}
      <section className="hero">
        <div className="container hero-inner">
          <div className="hero-copy">
            <span className="pill">AI-powered appointments</span>
            <h1>
              See the right doctor,
              <br />
              <span className="accent">sooner.</span>
            </h1>
            <p className="lead">
              Describe your symptoms and MediBook AI matches you with the right specialist —
              then books you into a real slot in minutes, not weeks.
            </p>
            <div className="hero-cta">
              <Link to="/triage" className="btn btn-lg">
                Check symptoms with AI
              </Link>
              <Link to="/doctors" className="btn btn-lg btn-outline">
                Find a doctor
              </Link>
            </div>
            <p className="hero-note">
              <strong>Urgent?</strong> If this is an emergency, call your local emergency number
              immediately — don&apos;t wait for an appointment.
            </p>
          </div>
          <div className="hero-card" aria-hidden="true">
            <div className="hero-card-head">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
            <div className="hero-card-body">
              <div className="mock-row">
                <span className="mock-avatar">👩‍⚕️</span>
                <div>
                  <strong>Dr. Anjali Sharma</strong>
                  <div className="muted small">Cardiology · ★ 4.9</div>
                </div>
              </div>
              <div className="mock-slots">
                <span className="mock-slot">09:00</span>
                <span className="mock-slot on">09:30</span>
                <span className="mock-slot">10:00</span>
                <span className="mock-slot">10:30</span>
              </div>
              <div className="mock-bar" />
              <div className="mock-cta">Confirm appointment</div>
            </div>
          </div>
        </div>
      </section>

      {/* specialties */}
      <section className="section">
        <div className="container">
          <h2>Browse by specialty</h2>
          <p className="muted section-sub">Eight specialties, one booking flow.</p>
          <div className="spec-grid">
            {SPECIALTIES.map((s) => (
              <Link
                key={s.name}
                to={`/doctors?specialty=${encodeURIComponent(s.name)}`}
                className="spec-card"
              >
                <span className="spec-icon">{s.icon}</span>
                <strong>{s.name}</strong>
                <span className="muted small">{s.blurb}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="section section-tint">
        <div className="container">
          <h2>How it works</h2>
          <p className="muted section-sub">From symptoms to a confirmed visit in three steps.</p>
          <div className="steps">
            {STEPS.map((s) => (
              <div key={s.n} className="step-card">
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p className="muted">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI triage teaser */}
      <section className="section">
        <div className="container">
          <div className="teaser card">
            <div>
              <span className="pill">AI triage</span>
              <h2>Not sure which doctor you need?</h2>
              <p className="muted">
                Answer a few quick questions and our triage engine suggests the most likely
                specialties, flags urgency, and shows you matched doctors with their soonest
                available slots.
              </p>
              <p className="disclaimer-inline">
                AI triage is informational only — not a medical diagnosis.
              </p>
            </div>
            <div className="teaser-cta">
              <Link to="/triage" className="btn btn-lg">
                Start symptom check
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="footer">
        <div className="container footer-inner">
          <div>
            <strong>MediBook AI</strong>
            <p className="muted small">AI-assisted doctor appointments.</p>
          </div>
          <div className="footer-links">
            <Link to="/doctors">Find a doctor</Link>
            <Link to="/triage">AI symptom check</Link>
            <Link to="/login">Log in</Link>
          </div>
        </div>
        <div className="container">
          <p className="disclaimer-footer">
            AI triage is informational only — not a medical diagnosis.
          </p>
        </div>
      </footer>
    </div>
  );
}
