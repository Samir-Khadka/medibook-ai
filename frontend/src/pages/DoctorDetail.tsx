import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { SlotGrid, useSlots } from '../components/slots';
import {
  Avatar,
  EmptyState,
  ErrorBanner,
  Field,
  Spinner,
  Stars,
  Textarea,
} from '../components/ui';
import { WEEKDAY_NAMES, feeLabel, fmtDate, next14Days } from '../lib';
import type { Appointment, Doctor } from '../types';

export function DoctorDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const days = next14Days();
  const [date, setDate] = useState<string | null>(() => {
    const q = searchParams.get('date');
    return q && days.some((d) => d.date === q) ? q : days[0]!.date;
  });
  const [slot, setSlot] = useState<string | null>(() => searchParams.get('time'));
  const [reason, setReason] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Appointment | null>(null);

  const { slots, loading: slotsLoading, error: slotsError, reload } = useSlots(id ?? '', date);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getDoctor(id)
      .then((d) => {
        if (!cancelled) setDoctor(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.detail : 'Failed to load doctor.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // clear the selected slot when the date changes
  useEffect(() => {
    setSlot(null);
  }, [date]);

  async function onConfirm(e: FormEvent) {
    e.preventDefault();
    if (!id || !date || !slot) return;
    if (!user) {
      navigate('/login', { state: { from: `/doctors/${id}` } });
      return;
    }
    setBooking(true);
    setBookError(null);
    try {
      const appt = await api.createAppointment({
        doctor_id: id,
        date,
        start_time: slot,
        reason: reason.trim(),
      });
      setBooked(appt);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setBookError('That slot was just taken — please pick another one.');
        reload();
      } else {
        setBookError(err instanceof ApiError ? err.detail : 'Booking failed. Please try again.');
      }
    } finally {
      setBooking(false);
    }
  }

  if (loading) {
    return (
      <div className="container page">
        <Spinner label="Loading doctor…" />
      </div>
    );
  }
  if (error || !doctor) {
    return (
      <div className="container page">
        <ErrorBanner message={error ?? 'Doctor not found.'} onRetry={() => window.location.reload()} />
        <p>
          <Link to="/doctors">← Back to doctors</Link>
        </p>
      </div>
    );
  }

  if (booked) {
    return (
      <div className="container page narrow">
        <div className="card success-card">
          <div className="success-icon">✓</div>
          <h1>Appointment confirmed</h1>
          <p className="muted">Your visit is booked. Please arrive 10 minutes early.</p>
          <dl className="summary">
            <div>
              <dt>Doctor</dt>
              <dd>{doctor.name}</dd>
            </div>
            <div>
              <dt>Specialty</dt>
              <dd>{doctor.specialty}</dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{fmtDate(booked.date)}</dd>
            </div>
            <div>
              <dt>Time</dt>
              <dd>
                {booked.start_time} – {booked.end_time}
              </dd>
            </div>
            {booked.reason && (
              <div>
                <dt>Reason</dt>
                <dd>{booked.reason}</dd>
              </div>
            )}
            <div>
              <dt>Fee</dt>
              <dd>{feeLabel(doctor.consultation_fee)}</dd>
            </div>
          </dl>
          <div className="btn-row">
            <Link to="/dashboard" className="btn">
              View my appointments
            </Link>
            <Link to="/doctors" className="btn btn-outline">
              Book another
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container page">
      <p>
        <Link to="/doctors" className="back-link">
          ← All doctors
        </Link>
      </p>

      <div className="card doc-profile">
        <div className="doc-profile-head">
          <Avatar name={doctor.name} size={76} />
          <div>
            <h1>{doctor.name}</h1>
            <div className="chip-row">
              <span className="badge badge-teal">{doctor.specialty}</span>
              <span className="muted small">{doctor.qualification}</span>
            </div>
            <div className="stars-line">
              <Stars value={doctor.rating} />
              <span className="muted small">
                {doctor.rating.toFixed(1)} · {doctor.rating_count} ratings · {doctor.experience_years}{' '}
                yrs experience
              </span>
            </div>
          </div>
          <div className="doc-profile-fee">
            <span className="fee">{feeLabel(doctor.consultation_fee)}</span>
            <span className="muted small">per visit</span>
          </div>
        </div>

        {doctor.bio && (
          <div className="doc-bio">
            <h3>About</h3>
            <p className="muted">{doctor.bio}</p>
          </div>
        )}

        {doctor.schedule && doctor.schedule.length > 0 && (
          <div className="doc-schedule">
            <h3>Weekly schedule</h3>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Hours</th>
                    <th>Slot length</th>
                  </tr>
                </thead>
                <tbody>
                  {doctor.schedule.map((s, i) => (
                    <tr key={i}>
                      <td>{WEEKDAY_NAMES[s.weekday] ?? `Day ${s.weekday}`}</td>
                      <td>
                        {s.start_time} – {s.end_time}
                      </td>
                      <td>{s.slot_minutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="card booking-card">
        <h2>Book an appointment</h2>

        <h3 className="step-label">1 · Pick a day</h3>
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

        <h3 className="step-label">2 · Pick a time</h3>
        {slotsLoading && <Spinner label="Loading slots…" />}
        {slotsError && !slotsLoading && <ErrorBanner message={slotsError} onRetry={reload} />}
        {!slotsLoading && !slotsError && (
          <SlotGrid slots={slots} selected={slot} onSelect={setSlot} />
        )}
        {!slotsLoading && !slotsError && slots.length === 0 && (
          <EmptyState icon="📅" title="No schedule for this day" hint="Try another date." />
        )}

        {slot && (
          <form onSubmit={onConfirm} className="form booking-form">
            <h3 className="step-label">3 · Reason for visit</h3>
            {bookError && <ErrorBanner message={bookError} />}
            <Field label="Reason (optional)">
              <Textarea
                rows={3}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Briefly describe why you're visiting…"
              />
            </Field>
            <button type="submit" className="btn btn-lg btn-block" disabled={booking}>
              {booking
                ? 'Confirming…'
                : `Confirm · ${fmtDate(date ?? '')} · ${slot}`}
            </button>
            {!user && (
              <p className="muted small">You&apos;ll be asked to log in before confirming.</p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
