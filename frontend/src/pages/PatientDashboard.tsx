import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import { SlotGrid, useSlots } from '../components/slots';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  PageHeader,
  Spinner,
  Stars,
  StatusBadge,
} from '../components/ui';
import { canonicalStatus, fmtDate, next14Days, todayStr } from '../lib';
import type { Appointment, Visit } from '../types';

type Tab = 'upcoming' | 'past';

export function PatientDashboard() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const [rescheduleFor, setRescheduleFor] = useState<Appointment | null>(null);
  const [visitFor, setVisitFor] = useState<Appointment | null>(null);
  const [visitSummary, setVisitSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [ratings, setRatings] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appts, v] = await Promise.all([api.listAppointments(), api.myVisits()]);
      setAppointments(appts);
      setVisits(v);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Failed to load your appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { upcoming, past } = useMemo(() => {
    const today = todayStr();
    const up = appointments
      .filter((a) => {
        const st = canonicalStatus(a.status);
        return st !== 'cancelled' && st !== 'completed' && a.date >= today;
      })
      .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time));
    const pastAppts = appointments
      .filter((a) => !up.includes(a))
      .sort((a, b) => (b.date + b.start_time).localeCompare(a.date + a.start_time));
    return { upcoming: up, past: pastAppts };
  }, [appointments]);

  const visitByAppointment = useMemo(() => {
    const m = new Map<string, Visit>();
    for (const v of visits) {
      if (v.appointment_id) m.set(v.appointment_id, v);
    }
    return m;
  }, [visits]);

  async function doAction(fn: () => Promise<unknown>, okMsg: string) {
    setActionMsg(null);
    setError(null);
    try {
      await fn();
      setActionMsg(okMsg);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Action failed. Please try again.');
    }
  }

  function cancelAppt(a: Appointment) {
    if (!window.confirm('Cancel this appointment?')) return;
    void doAction(() => api.updateAppointment(a.id, 'cancel'), 'Appointment cancelled.');
  }

  async function rateVisit(a: Appointment, rating: number) {
    setRatings((r) => ({ ...r, [a.id]: rating }));
    try {
      await api.rateDoctor(a.doctor_id, rating);
      setActionMsg('Thanks for your rating!');
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Could not submit your rating.');
    }
  }

  function openVisit(a: Appointment) {
    setVisitFor(a);
    setVisitSummary(null);
    const v = visitByAppointment.get(a.id);
    if (v?.summary) {
      setVisitSummary(v.summary);
      return;
    }
    if (v) {
      setSummaryLoading(true);
      api
        .visitSummary(v.id)
        .then((s) => setVisitSummary(s.summary))
        .catch(() => setVisitSummary(null))
        .finally(() => setSummaryLoading(false));
    }
  }

  function renderCard(a: Appointment, isPast: boolean) {
    const visit = visitByAppointment.get(a.id);
    const done = canonicalStatus(a.status) === 'completed';
    return (
      <article key={a.id} className="card appt-card">
        <div className="appt-top">
          <div>
            <h3>{a.doctor_name ?? 'Doctor'}</h3>
            {a.doctor_specialty && <span className="muted small">{a.doctor_specialty}</span>}
          </div>
          <StatusBadge status={a.status} />
        </div>
        <div className="appt-meta">
          <span>📅 {fmtDate(a.date)}</span>
          <span>
            🕘 {a.start_time} – {a.end_time}
          </span>
        </div>
        {a.reason && <p className="muted small appt-reason">“{a.reason}”</p>}
        <div className="btn-row">
          {!isPast && (
            <>
              <button type="button" className="btn btn-sm btn-outline" onClick={() => setRescheduleFor(a)}>
                Reschedule
              </button>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => cancelAppt(a)}>
                Cancel
              </button>
            </>
          )}
          {isPast && visit && (
            <button type="button" className="btn btn-sm btn-outline" onClick={() => openVisit(a)}>
              View prescription
            </button>
          )}
          {isPast && done && (
            <span className="rate-inline">
              <span className="muted small">Rate your visit</span>
              <Stars value={ratings[a.id] ?? 0} onRate={(r) => void rateVisit(a, r)} size={20} />
            </span>
          )}
        </div>
      </article>
    );
  }

  return (
    <div className="container page">
      <PageHeader title="My appointments" sub="Upcoming visits, history, and prescriptions." />

      {actionMsg && <div className="notice">{actionMsg}</div>}
      {loading && <Spinner label="Loading your appointments…" />}
      {error && !loading && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'upcoming'}
              className={`tab ${tab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setTab('upcoming')}
            >
              Upcoming ({upcoming.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'past'}
              className={`tab ${tab === 'past' ? 'active' : ''}`}
              onClick={() => setTab('past')}
            >
              Past ({past.length})
            </button>
          </div>

          {tab === 'upcoming' && (
            <div className="appt-grid">
              {upcoming.length === 0 && (
                <EmptyState
                  icon="📅"
                  title="No upcoming appointments"
                  hint="Find a doctor and book your first visit."
                />
              )}
              {upcoming.map((a) => renderCard(a, false))}
            </div>
          )}

          {tab === 'past' && (
            <div className="appt-grid">
              {past.length === 0 && (
                <EmptyState icon="🗂️" title="No past visits" hint="Your history will appear here." />
              )}
              {past.map((a) => renderCard(a, true))}
            </div>
          )}
        </>
      )}

      {rescheduleFor && (
        <RescheduleModal
          appointment={rescheduleFor}
          onClose={() => setRescheduleFor(null)}
          onDone={() => {
            setRescheduleFor(null);
            setActionMsg('Appointment rescheduled.');
            void load();
          }}
        />
      )}

      {visitFor && (
        <VisitModal
          appointment={visitFor}
          visit={visitByAppointment.get(visitFor.id) ?? null}
          summary={visitSummary}
          summaryLoading={summaryLoading}
          onClose={() => setVisitFor(null)}
        />
      )}
    </div>
  );
}

function RescheduleModal({
  appointment,
  onClose,
  onDone,
}: {
  appointment: Appointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const days = next14Days();
  const [date, setDate] = useState(days[0]!.date);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { slots, loading, error: slotsError, reload } = useSlots(appointment.doctor_id, date);

  useEffect(() => {
    setSlot(null);
  }, [date]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!slot) return;
    setBusy(true);
    setError(null);
    try {
      await api.rescheduleAppointment(appointment.id, { date, start_time: slot });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('That slot was just taken — please pick another one.');
        reload();
      } else {
        setError(err instanceof ApiError ? err.detail : 'Reschedule failed. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Reschedule appointment" onClose={onClose} wide>
      <div className="day-chips">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className={`day-chip ${date === d.date ? 'active' : ''}`}
            onClick={() => setDate(d.date)}
            aria-pressed={date === d.date}
          >
            <span className="day-chip-dow">{d.dayShort}</span>
            <span className="day-chip-num">{d.dayNum}</span>
            <span className="day-chip-mon">{d.monthShort}</span>
          </button>
        ))}
      </div>
      {loading && <Spinner label="Loading slots…" />}
      {slotsError && !loading && <ErrorBanner message={slotsError} onRetry={reload} />}
      {!loading && !slotsError && <SlotGrid slots={slots} selected={slot} onSelect={setSlot} />}
      {error && <ErrorBanner message={error} />}
      <form onSubmit={onSubmit}>
        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy || !slot}>
            {busy ? 'Rescheduling…' : 'Confirm new slot'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose}>
            Keep current
          </button>
        </div>
      </form>
    </Modal>
  );
}

function VisitModal({
  appointment,
  visit,
  summary,
  summaryLoading,
  onClose,
}: {
  appointment: Appointment;
  visit: Visit | null;
  summary: string | null;
  summaryLoading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal title={`Visit — ${fmtDate(appointment.date)}`} onClose={onClose} wide>
      {!visit && <p className="muted">No visit report was recorded for this appointment.</p>}
      {visit && (
        <div className="visit-detail">
          {summaryLoading && <Spinner label="Loading summary…" />}
          {summary && (
            <div className="visit-summary">
              <h4>AI summary</h4>
              <p>{summary}</p>
            </div>
          )}
          <h4>Diagnosis notes</h4>
          <p className="muted">{visit.diagnosis_notes || '—'}</p>
          <h4>Prescription</h4>
          {visit.prescription.length === 0 ? (
            <p className="muted">No medicines prescribed.</p>
          ) : (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {visit.prescription.map((p, i) => (
                    <tr key={i}>
                      <td>{p.medicine}</td>
                      <td>{p.dosage}</td>
                      <td>{p.frequency}</td>
                      <td>{p.duration_days} day{p.duration_days === 1 ? '' : 's'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <h4>Advice</h4>
          <p className="muted">{visit.advice || '—'}</p>
          <p className="disclaimer-inline">
            AI summary is informational only — not a medical diagnosis.
          </p>
        </div>
      )}
    </Modal>
  );
}
