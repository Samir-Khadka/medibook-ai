import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api';
import { bookSoonestPath } from './Doctors';
import {
  ErrorBanner,
  Field,
  Input,
  Spinner,
  Stars,
  Textarea,
} from '../components/ui';
import { confidencePct, fmtDateShort } from '../lib';
import type { MatchedDoctor, TriageResult } from '../types';

type Step = 'input' | 'clarify' | 'result';

const URGENCY_META: Record<string, { label: string; tone: string; text: string }> = {
  routine: {
    label: 'Routine',
    tone: 'teal',
    text: 'No urgent signs detected. Book a visit at your convenience.',
  },
  soon: {
    label: 'See a doctor soon',
    tone: 'amber',
    text: 'Your symptoms suggest you should see a doctor within the next few days.',
  },
  urgent: {
    label: 'Urgent',
    tone: 'red',
    text: 'Your symptoms suggest you need prompt medical attention.',
  },
};

export function Triage() {
  const [step, setStep] = useState<Step>('input');
  const [symptoms, setSymptoms] = useState('');
  const [age, setAge] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [result, setResult] = useState<TriageResult | null>(null);
  const [pickedQuestions, setPickedQuestions] = useState<string[]>([]);
  const [refinedSymptoms, setRefinedSymptoms] = useState('');

  const [matched, setMatched] = useState<MatchedDoctor[]>([]);
  const [matchedFor, setMatchedFor] = useState('');
  const [matchedLoading, setMatchedLoading] = useState(false);
  const [matchedError, setMatchedError] = useState<string | null>(null);

  // quick health-question widget
  const [faqQ, setFaqQ] = useState('');
  const [faqA, setFaqA] = useState<{ answer: string; topic: string } | null>(null);
  const [faqBusy, setFaqBusy] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);

  async function runTriage(text: string): Promise<TriageResult> {
    const payload: { symptoms: string; age?: number; duration_days?: number } = { symptoms: text };
    const a = parseInt(age, 10);
    if (!Number.isNaN(a) && a > 0) payload.age = a;
    const d = parseInt(duration, 10);
    if (!Number.isNaN(d) && d >= 0) payload.duration_days = d;
    return api.triage(payload);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!symptoms.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const r = await runTriage(symptoms.trim());
      setResult(r);
      if (r.clarifying_questions.length > 0) {
        setStep('clarify');
      } else {
        setStep('result');
        void loadMatched(r);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Triage failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function loadMatched(r: TriageResult) {
    const top = r.specialties[0];
    if (!top) return;
    setMatchedLoading(true);
    setMatchedError(null);
    try {
      const docs = await api.match(top.specialty);
      setMatched(docs);
      setMatchedFor(top.specialty);
    } catch (err) {
      setMatchedError(err instanceof ApiError ? err.detail : 'Could not load matched doctors.');
    } finally {
      setMatchedLoading(false);
    }
  }

  async function onRefine(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // Contract doesn't define a separate answers field; append the selected
      // questions as context so the second pass can refine its assessment.
      const extra = pickedQuestions.map((q) => `Relevant context: ${q}`).join('\n');
      const text = refinedSymptoms.trim()
        ? `${refinedSymptoms.trim()}\n${extra}`
        : `${symptoms.trim()}\n${extra}`;
      const r = await runTriage(text);
      setResult(r);
      setStep('result');
      void loadMatched(r);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Triage failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function toggleQuestion(q: string) {
    setPickedQuestions((p) => (p.includes(q) ? p.filter((x) => x !== q) : [...p, q]));
  }

  function reset() {
    setStep('input');
    setResult(null);
    setPickedQuestions([]);
    setRefinedSymptoms('');
    setMatched([]);
    setMatchedFor('');
    setError(null);
  }

  async function askFaq(e: FormEvent) {
    e.preventDefault();
    if (!faqQ.trim()) return;
    setFaqBusy(true);
    setFaqError(null);
    setFaqA(null);
    try {
      const r = await api.faq(faqQ.trim());
      setFaqA(r);
    } catch (err) {
      setFaqError(err instanceof ApiError ? err.detail : 'Could not answer that question.');
    } finally {
      setFaqBusy(false);
    }
  }

  return (
    <div className="container page narrow">
      <h1>AI symptom checker</h1>
      <p className="muted">
        Describe what you&apos;re feeling and we&apos;ll suggest the right specialty — then match
        you with doctors and their soonest slots.
      </p>
      <p className="disclaimer-box">
        <strong>Disclaimer:</strong> AI triage is informational only — not a medical diagnosis. If
        this is an emergency, call your local emergency number immediately.
      </p>

      {step === 'input' && (
        <div className="card">
          <form onSubmit={onSubmit} className="form">
            {error && <ErrorBanner message={error} />}
            <Field label="Describe your symptoms">
              <Textarea
                rows={5}
                required
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Sharp chest pain when I climb stairs, started 2 days ago…"
              />
            </Field>
            <div className="form-row">
              <Field label="Age (optional)">
                <Input
                  type="number"
                  min={0}
                  max={130}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="32"
                />
              </Field>
              <Field label="Duration in days (optional)">
                <Input
                  type="number"
                  min={0}
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="3"
                />
              </Field>
            </div>
            <button type="submit" className="btn btn-lg btn-block" disabled={busy || !symptoms.trim()}>
              {busy ? 'Analyzing…' : 'Analyze symptoms'}
            </button>
          </form>

          <div className="faq-widget">
            <h3>Quick health question</h3>
            <form onSubmit={askFaq} className="faq-form">
              <Input
                value={faqQ}
                onChange={(e) => setFaqQ(e.target.value)}
                placeholder="e.g. What are early signs of high blood pressure?"
                aria-label="Health question"
              />
              <button type="submit" className="btn" disabled={faqBusy || !faqQ.trim()}>
                {faqBusy ? '…' : 'Ask'}
              </button>
            </form>
            {faqError && <ErrorBanner message={faqError} />}
            {faqA && (
              <div className="faq-answer">
                <span className="badge badge-teal">{faqA.topic}</span>
                <p>{faqA.answer}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {step === 'clarify' && result && (
        <div className="card">
          <h2>A couple of quick questions</h2>
          <p className="muted">Tap any that apply — this helps refine the result.</p>
          {error && <ErrorBanner message={error} />}
          <form onSubmit={onRefine} className="form">
            <div className="chips chips-wrap">
              {result.clarifying_questions.map((q) => (
                <button
                  key={q}
                  type="button"
                  className={`chip ${pickedQuestions.includes(q) ? 'active' : ''}`}
                  onClick={() => toggleQuestion(q)}
                  aria-pressed={pickedQuestions.includes(q)}
                >
                  {q}
                </button>
              ))}
            </div>
            <Field label="Anything else to add? (optional)">
              <Textarea
                rows={3}
                value={refinedSymptoms}
                onChange={(e) => setRefinedSymptoms(e.target.value)}
                placeholder="Additional details…"
              />
            </Field>
            <div className="btn-row">
              <button type="submit" className="btn btn-lg" disabled={busy}>
                {busy ? 'Refining…' : 'See my results'}
              </button>
              <button
                type="button"
                className="btn btn-lg btn-outline"
                disabled={busy}
                onClick={() => {
                  setStep('result');
                  void loadMatched(result);
                }}
              >
                Skip
              </button>
            </div>
          </form>
        </div>
      )}

      {step === 'result' && result && (
        <div className="triage-result">
          {result.emergency && (
            <div className="emergency-box" role="alert">
              <strong>🚨 Seek emergency care immediately.</strong>
              <p>Your symptoms may indicate a medical emergency. Do not wait for an appointment.</p>
            </div>
          )}

          <div className={`urgency-banner urgency-${URGENCY_META[result.urgency]?.tone ?? 'teal'}`}>
            <strong>{URGENCY_META[result.urgency]?.label ?? result.urgency}</strong>
            <p>{URGENCY_META[result.urgency]?.text}</p>
          </div>

          <h2>Possible specialties</h2>
          <div className="spec-results">
            {result.specialties.slice(0, 3).map((s) => (
              <div key={s.specialty} className="card spec-result">
                <div className="spec-result-head">
                  <strong>{s.specialty}</strong>
                  <span className="muted small">{confidencePct(s.confidence)}% match</span>
                </div>
                <div className="conf-bar" aria-hidden="true">
                  <div className="conf-fill" style={{ width: `${confidencePct(s.confidence)}%` }} />
                </div>
                <p className="muted small">{s.reason}</p>
                {s.matched_symptoms.length > 0 && (
                  <div className="matched-tags">
                    {s.matched_symptoms.map((m) => (
                      <span key={m} className="tag">
                        {m}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <h2>Matched doctors{matchedFor ? ` — ${matchedFor}` : ''}</h2>
          {matchedLoading && <Spinner label="Finding matched doctors…" />}
          {matchedError && <ErrorBanner message={matchedError} onRetry={() => loadMatched(result)} />}
          {!matchedLoading && !matchedError && matched.length === 0 && (
            <p className="muted">No doctors matched this specialty yet.</p>
          )}
          <div className="match-list">
            {matched.map((m) => (
              <div key={m.doctor_id} className="card match-card">
                <div>
                  <strong>{m.name}</strong>
                  <div className="stars-line">
                    <Stars value={m.rating} size={14} />
                    <span className="muted small">{m.rating.toFixed(1)}</span>
                  </div>
                  {m.next_available ? (
                    <span className="next-ok small">
                      Soonest: {fmtDateShort(m.next_available.date)} · {m.next_available.start_time}
                    </span>
                  ) : (
                    <span className="muted small">No upcoming slots</span>
                  )}
                </div>
                {m.next_available && (
                  <Link to={bookSoonestPath(m.doctor_id, m.next_available)} className="btn btn-sm">
                    Book soonest slot
                  </Link>
                )}
              </div>
            ))}
          </div>

          {result.disclaimer && (
            <p className="disclaimer-box">
              <strong>Disclaimer:</strong> {result.disclaimer}
            </p>
          )}

          <button type="button" className="btn btn-outline" onClick={reset}>
            Start over
          </button>
        </div>
      )}
    </div>
  );
}
