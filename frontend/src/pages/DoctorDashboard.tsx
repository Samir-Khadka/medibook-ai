import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import {
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Spinner,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { canonicalStatus, fmtDate, todayStr } from '../lib';
import type { Appointment, PrescriptionItem } from '../types';

type Tab = 'today' | 'upcoming';

const EMPTY_RX: PrescriptionItem = { medicine: '', dosage: '', frequency: '', duration_days: 7 };

export function DoctorDashboard() {
  const [tab, setTab] = useState<Tab>('today');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [reportFor, setReportFor] = useState<Appointment | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const appts = await api.listAppointments({ upcoming: true });
      setAppointments(appts);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Failed to load your schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const today = todayStr();
  const todayList = useMemo(
    () =>
      appointments
        .filter((a) => a.date === today)
        .sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [appointments, today],
  );
  const upcomingList = useMemo(
    () =>
      appointments
        .filter((a) => a.date > today && canonicalStatus(a.status) !== 'cancelled')
        .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)),
    [appointments, today],
  );

  async function setStatus(a: Appointment, status: 'confirm' | 'complete' | 'cancel') {
    setBusyId(a.id);
    setError(null);
    try {
      const updated = await api.updateAppointment(a.id, status);
      setAppointments((list) => list.map((x) => (x.id === a.id ? updated : x)));
      setSelected(updated);
      setNotice(
        status === 'confirm'
          ? 'Appointment confirmed.'
          : status === 'complete'
            ? 'Appointment marked complete.'
            : 'Appointment cancelled.',
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Could not update the appointment.');
    } finally {
      setBusyId(null);
    }
  }

  function renderRow(a: Appointment) {
    return (
      <button
        key={a.id}
        type="button"
        className={`appt-row ${selected?.id === a.id ? 'active' : ''}`}
        onClick={() => setSelected(a)}
      >
        <span className="appt-row-time">
          {a.start_time}
          <span className="muted small">– {a.end_time}</span>
        </span>
        <span className="appt-row-main">
          <strong>{a.patient_name ?? 'Patient'}</strong>
          <span className="muted small">{a.reason || 'No reason given'}</span>
        </span>
        <StatusBadge status={a.status} />
      </button>
    );
  }

  const list = tab === 'today' ? todayList : upcomingList;

  return (
    <div className="container page">
      <PageHeader title="Doctor panel" sub={`Your schedule for ${fmtDate(today)}.`} />

      {notice && <div className="notice">{notice}</div>}
      {loading && <Spinner label="Loading your schedule…" />}
      {error && !loading && <ErrorBanner message={error} onRetry={load} />}

      {!loading && !error && (
        <>
          <div className="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'today'}
              className={`tab ${tab === 'today' ? 'active' : ''}`}
              onClick={() => setTab('today')}
            >
              Today ({todayList.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'upcoming'}
              className={`tab ${tab === 'upcoming' ? 'active' : ''}`}
              onClick={() => setTab('upcoming')}
            >
              Upcoming ({upcomingList.length})
            </button>
          </div>

          <div className="doctor-layout">
            <div className="appt-rows">
              {list.length === 0 && (
                <EmptyState
                  icon="🩺"
                  title={tab === 'today' ? 'No appointments today' : 'Nothing upcoming'}
                  hint="Enjoy the quiet — new bookings will appear here."
                />
              )}
              {list.map(renderRow)}
            </div>

            <aside className="appt-detail">
              {!selected && (
                <p className="muted">Select an appointment to see details and take action.</p>
              )}
              {selected && (
                <div className="card">
                  <div className="appt-top">
                    <h3>{selected.patient_name ?? 'Patient'}</h3>
                    <StatusBadge status={selected.status} />
                  </div>
                  <dl className="summary">
                    <div>
                      <dt>Date</dt>
                      <dd>{fmtDate(selected.date)}</dd>
                    </div>
                    <div>
                      <dt>Time</dt>
                      <dd>
                        {selected.start_time} – {selected.end_time}
                      </dd>
                    </div>
                    {selected.patient_email && (
                      <div>
                        <dt>Patient email</dt>
                        <dd>{selected.patient_email}</dd>
                      </div>
                    )}
                    <div>
                      <dt>Reason</dt>
                      <dd>{selected.reason || '—'}</dd>
                    </div>
                  </dl>
                  <div className="btn-row">
                    {canonicalStatus(selected.status) === 'pending' && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busyId === selected.id}
                        onClick={() => void setStatus(selected, 'confirm')}
                      >
                        Confirm
                      </button>
                    )}
                    {(canonicalStatus(selected.status) === 'pending' ||
                      canonicalStatus(selected.status) === 'confirmed') && (
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() => setReportFor(selected)}
                      >
                        Write report
                      </button>
                    )}
                    {canonicalStatus(selected.status) !== 'completed' &&
                      canonicalStatus(selected.status) !== 'cancelled' && (
                        <button
                          type="button"
                          className="btn btn-sm btn-danger"
                          disabled={busyId === selected.id}
                          onClick={() => {
                            if (window.confirm('Cancel this appointment?'))
                              void setStatus(selected, 'cancel');
                          }}
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {reportFor && (
        <ReportModal
          appointment={reportFor}
          onClose={() => setReportFor(null)}
          onDone={() => {
            setReportFor(null);
            setNotice('Visit report saved and appointment completed.');
            void load();
          }}
        />
      )}
    </div>
  );
}

function ReportModal({
  appointment,
  onClose,
  onDone,
}: {
  appointment: Appointment;
  onClose: () => void;
  onDone: () => void;
}) {
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [rows, setRows] = useState<PrescriptionItem[]>([{ ...EMPTY_RX }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRow(i: number, patch: Partial<PrescriptionItem>) {
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...patch } : row)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const prescription = rows
        .filter((r) => r.medicine.trim())
        .map((r) => ({
          medicine: r.medicine.trim(),
          dosage: r.dosage.trim(),
          frequency: r.frequency.trim(),
          duration_days: Number(r.duration_days) || 0,
        }));
      await api.createVisit({
        appointment_id: appointment.id,
        diagnosis_notes: diagnosis.trim(),
        prescription,
        advice: advice.trim(),
      });
      // Assumed: creating the visit does not auto-complete the appointment on the
      // backend, so mark it complete explicitly.
      try {
        await api.updateAppointment(appointment.id, 'complete');
      } catch {
        // visit is saved; status update is best-effort
      }
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not save the report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={`Visit report — ${appointment.patient_name ?? 'Patient'}`} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="form">
        {error && <ErrorBanner message={error} />}
        <Field label="Diagnosis notes">
          <Textarea
            rows={4}
            required
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            placeholder="Clinical findings, diagnosis…"
          />
        </Field>

        <div className="rx-head">
          <h4>Prescription</h4>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() => setRows((r) => [...r, { ...EMPTY_RX }])}
          >
            + Add medicine
          </button>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="rx-row">
            <Input
              placeholder="Medicine"
              value={r.medicine}
              onChange={(e) => setRow(i, { medicine: e.target.value })}
              aria-label={`Medicine ${i + 1}`}
            />
            <Input
              placeholder="Dosage (e.g. 500mg)"
              value={r.dosage}
              onChange={(e) => setRow(i, { dosage: e.target.value })}
              aria-label={`Dosage ${i + 1}`}
            />
            <Input
              placeholder="Frequency (e.g. 2× daily)"
              value={r.frequency}
              onChange={(e) => setRow(i, { frequency: e.target.value })}
              aria-label={`Frequency ${i + 1}`}
            />
            <Input
              type="number"
              min={0}
              placeholder="Days"
              value={r.duration_days}
              onChange={(e) => setRow(i, { duration_days: Number(e.target.value) })}
              aria-label={`Duration in days ${i + 1}`}
            />
            {rows.length > 1 && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove medicine ${i + 1}`}
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <Field label="Advice for the patient">
          <Textarea
            rows={3}
            value={advice}
            onChange={(e) => setAdvice(e.target.value)}
            placeholder="Rest, diet, follow-up…"
          />
        </Field>

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : 'Save report & complete visit'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
