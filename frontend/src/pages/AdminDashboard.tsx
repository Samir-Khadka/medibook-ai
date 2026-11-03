import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api, ApiError } from '../api';
import {
  EmptyState,
  ErrorBanner,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Stars,
  StatusBadge,
  Textarea,
} from '../components/ui';
import { WEEKDAY_NAMES, canonicalStatus, feeLabel, fmtDate } from '../lib';
import type {
  AdminPatient,
  AdminStats,
  Appointment,
  Doctor,
  DoctorCreatePayload,
  ScheduleBlock,
} from '../types';

const SPECIALTIES = [
  'Cardiology',
  'Dermatology',
  'Neurology',
  'Orthopedics',
  'Pediatrics',
  'General Medicine',
  'Ophthalmology',
  'Gynecology',
];

type Tab = 'doctors' | 'patients' | 'appointments';

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>('doctors');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [doctorsError, setDoctorsError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Doctor | 'new' | null>(null);

  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState<string | null>(null);
  const [patientSearch, setPatientSearch] = useState('');

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(true);
  const [apptsError, setApptsError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const [notice, setNotice] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      setStats(await api.adminStats());
    } catch (e) {
      setStatsError(e instanceof ApiError ? e.detail : 'Failed to load stats.');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const loadDoctors = useCallback(async () => {
    setDoctorsLoading(true);
    setDoctorsError(null);
    try {
      setDoctors(await api.listDoctors());
    } catch (e) {
      setDoctorsError(e instanceof ApiError ? e.detail : 'Failed to load doctors.');
    } finally {
      setDoctorsLoading(false);
    }
  }, []);

  const loadPatients = useCallback(async (q: string) => {
    setPatientsLoading(true);
    setPatientsError(null);
    try {
      setPatients(await api.adminPatients(q.trim() || undefined));
    } catch (e) {
      setPatientsError(e instanceof ApiError ? e.detail : 'Failed to load patients.');
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const loadAppointments = useCallback(async () => {
    setApptsLoading(true);
    setApptsError(null);
    try {
      setAppointments(await api.listAppointments());
    } catch (e) {
      setApptsError(e instanceof ApiError ? e.detail : 'Failed to load appointments.');
    } finally {
      setApptsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadDoctors();
    void loadAppointments();
  }, [loadStats, loadDoctors, loadAppointments]);

  useEffect(() => {
    const t = setTimeout(() => loadPatients(patientSearch), 400);
    return () => clearTimeout(t);
  }, [patientSearch, loadPatients]);

  async function togglePatient(p: AdminPatient) {
    try {
      const updated = await api.setPatientActive(p.id, !p.active);
      setPatients((list) => list.map((x) => (x.id === p.id ? updated : x)));
      setNotice(`Patient ${updated.active ? 'activated' : 'deactivated'}.`);
    } catch (e) {
      setNotice(null);
      alert(e instanceof ApiError ? e.detail : 'Action failed.');
    }
  }

  async function deactivateDoctor(d: Doctor) {
    if (!window.confirm(`Deactivate ${d.name}? They will no longer appear in search.`)) return;
    try {
      // Assumed: deactivation is a PUT flipping is_active (contract defines PUT/DELETE).
      await api.adminUpdateDoctor(d.id, { is_active: false });
      setNotice(`${d.name} deactivated.`);
      await loadDoctors();
    } catch (e) {
      alert(e instanceof ApiError ? e.detail : 'Action failed.');
    }
  }

  const filteredAppts =
    statusFilter === 'all'
      ? appointments
      : appointments.filter((a) => canonicalStatus(a.status) === statusFilter);

  const statusCounts: Record<string, number> = {};
  for (const a of appointments) {
    const s = canonicalStatus(a.status);
    statusCounts[s] = (statusCounts[s] ?? 0) + 1;
  }

  return (
    <div className="container page">
      <PageHeader title="Admin panel" sub="Platform overview and management." />
      {notice && <div className="notice">{notice}</div>}

      {statsLoading && <Spinner label="Loading stats…" />}
      {statsError && <ErrorBanner message={statsError} onRetry={loadStats} />}
      {stats && (
        <div className="stat-grid">
          <div className="card stat-card">
            <span className="stat-num">{stats.total_patients}</span>
            <span className="muted">Patients</span>
          </div>
          <div className="card stat-card">
            <span className="stat-num">{stats.total_doctors}</span>
            <span className="muted">Doctors</span>
          </div>
          <div className="card stat-card">
            <span className="stat-num">{stats.appointments_today}</span>
            <span className="muted">Appointments today</span>
          </div>
          <div className="card stat-card">
            <span className="stat-num">{stats.appointments_total}</span>
            <span className="muted">Total appointments</span>
          </div>
        </div>
      )}

      <div className="tabs" role="tablist">
        {(['doctors', 'patients', 'appointments'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            className={`tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t[0]!.toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'doctors' && (
        <div className="card">
          <div className="table-head">
            <h3>Doctors</h3>
            <button type="button" className="btn btn-sm" onClick={() => setEditing('new')}>
              + Add doctor
            </button>
          </div>
          {doctorsLoading && <Spinner label="Loading doctors…" />}
          {doctorsError && <ErrorBanner message={doctorsError} onRetry={loadDoctors} />}
          {!doctorsLoading && !doctorsError && doctors.length === 0 && (
            <EmptyState icon="🩺" title="No doctors yet" hint="Add the first doctor to get started." />
          )}
          {!doctorsLoading && !doctorsError && doctors.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Specialty</th>
                    <th>Rating</th>
                    <th>Fee</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((d) => (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.name}</strong>
                      </td>
                      <td>{d.specialty}</td>
                      <td>
                        <Stars value={d.rating} size={13} />{' '}
                        <span className="muted small">{d.rating.toFixed(1)}</span>
                      </td>
                      <td>{feeLabel(d.consultation_fee)}</td>
                      <td>
                        <span className={`badge ${d.is_active ? 'badge-teal' : 'badge-gray'}`}>
                          {d.is_active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="row-actions">
                        <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(d)}>
                          Edit
                        </button>
                        {d.is_active && (
                          <button
                            type="button"
                            className="btn btn-sm btn-danger"
                            onClick={() => void deactivateDoctor(d)}
                          >
                            Deactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'patients' && (
        <div className="card">
          <div className="table-head">
            <h3>Patients</h3>
            <Input
              type="search"
              placeholder="Search patients…"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              className="table-search"
            />
          </div>
          {patientsLoading && <Spinner label="Loading patients…" />}
          {patientsError && <ErrorBanner message={patientsError} onRetry={() => loadPatients(patientSearch)} />}
          {!patientsLoading && !patientsError && patients.length === 0 && (
            <EmptyState icon="🧑‍⚕️" title="No patients found" hint="Try a different search." />
          )}
          {!patientsLoading && !patientsError && patients.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.name}</strong>
                      </td>
                      <td className="muted">{p.email}</td>
                      <td>
                        <span className={`badge ${p.active ? 'badge-teal' : 'badge-gray'}`}>
                          {p.active ? 'active' : 'inactive'}
                        </span>
                      </td>
                      <td className="row-actions">
                        <button
                          type="button"
                          className={`btn btn-sm ${p.active ? 'btn-danger' : 'btn-outline'}`}
                          onClick={() => void togglePatient(p)}
                        >
                          {p.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'appointments' && (
        <div className="card">
          <div className="table-head">
            <h3>Appointments</h3>
            <div className="chips">
              {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${statusFilter === s ? 'active' : ''}`}
                  onClick={() => setStatusFilter(s)}
                >
                  {s === 'all' ? 'All' : `${s[0]!.toUpperCase() + s.slice(1)} (${statusCounts[s] ?? 0})`}
                </button>
              ))}
            </div>
          </div>
          {apptsLoading && <Spinner label="Loading appointments…" />}
          {apptsError && <ErrorBanner message={apptsError} onRetry={loadAppointments} />}
          {!apptsLoading && !apptsError && filteredAppts.length === 0 && (
            <EmptyState icon="📅" title="No appointments" hint="Nothing matches this filter." />
          )}
          {!apptsLoading && !apptsError && filteredAppts.length > 0 && (
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAppts.map((a) => (
                    <tr key={a.id}>
                      <td>{fmtDate(a.date)}</td>
                      <td>{a.start_time}</td>
                      <td>{a.patient_name ?? a.patient_id}</td>
                      <td>{a.doctor_name ?? a.doctor_id}</td>
                      <td>
                        <StatusBadge status={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {editing && (
        <DoctorModal
          doctor={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setNotice('Doctor saved.');
            void loadDoctors();
          }}
        />
      )}
    </div>
  );
}

function DoctorModal({
  doctor,
  onClose,
  onSaved,
}: {
  doctor: Doctor | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(doctor?.name ?? '');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [specialty, setSpecialty] = useState(doctor?.specialty ?? SPECIALTIES[0]!);
  const [qualification, setQualification] = useState(doctor?.qualification ?? '');
  const [experience, setExperience] = useState(String(doctor?.experience_years ?? 1));
  const [fee, setFee] = useState(String(doctor?.consultation_fee ?? 500));
  const [bio, setBio] = useState(doctor?.bio ?? '');
  const [schedule, setSchedule] = useState<ScheduleBlock[]>(
    doctor?.schedule ?? [{ weekday: 0, start_time: '09:00', end_time: '13:00', slot_minutes: 30 }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setRow(i: number, patch: Partial<ScheduleBlock>) {
    setSchedule((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const base = {
        name: name.trim(),
        specialty,
        qualification: qualification.trim(),
        experience_years: Number(experience) || 0,
        consultation_fee: Number(fee) || 0,
        bio: bio.trim(),
        schedule,
      };
      if (doctor) {
        await api.adminUpdateDoctor(doctor.id, base);
      } else {
        const payload: DoctorCreatePayload = {
          ...base,
          email: email.trim(),
          password,
        };
        await api.adminCreateDoctor(payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Could not save the doctor.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={doctor ? `Edit ${doctor.name}` : 'Add doctor'} onClose={onClose} wide>
      <form onSubmit={onSubmit} className="form">
        {error && <ErrorBanner message={error} />}
        <div className="form-row">
          <Field label="Full name">
            <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Jane Doe" />
          </Field>
          <Field label="Specialty">
            <Select value={specialty} onChange={(e) => setSpecialty(e.target.value)}>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {!doctor && (
          <div className="form-row">
            <Field label="Login email">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@example.com"
              />
            </Field>
            <Field label="Temporary password">
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </Field>
          </div>
        )}
        <div className="form-row">
          <Field label="Qualification">
            <Input
              value={qualification}
              onChange={(e) => setQualification(e.target.value)}
              placeholder="MBBS, MD"
            />
          </Field>
          <Field label="Experience (years)">
            <Input
              type="number"
              min={0}
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
            />
          </Field>
          <Field label="Consultation fee">
            <Input type="number" min={0} value={fee} onChange={(e) => setFee(e.target.value)} />
          </Field>
        </div>
        <Field label="Bio">
          <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Short professional bio…" />
        </Field>

        <div className="rx-head">
          <h4>Weekly schedule</h4>
          <button
            type="button"
            className="btn btn-sm btn-outline"
            onClick={() =>
              setSchedule((r) => [...r, { weekday: 0, start_time: '09:00', end_time: '13:00', slot_minutes: 30 }])
            }
          >
            + Add block
          </button>
        </div>
        {schedule.map((s, i) => (
          <div key={i} className="rx-row sched-row">
            <Select
              value={s.weekday}
              onChange={(e) => setRow(i, { weekday: Number(e.target.value) })}
              aria-label={`Weekday ${i + 1}`}
            >
              {WEEKDAY_NAMES.map((w, idx) => (
                <option key={w} value={idx}>
                  {w}
                </option>
              ))}
            </Select>
            <Input
              type="time"
              value={s.start_time}
              onChange={(e) => setRow(i, { start_time: e.target.value })}
              aria-label={`Start time ${i + 1}`}
            />
            <Input
              type="time"
              value={s.end_time}
              onChange={(e) => setRow(i, { end_time: e.target.value })}
              aria-label={`End time ${i + 1}`}
            />
            <Input
              type="number"
              min={5}
              step={5}
              value={s.slot_minutes}
              onChange={(e) => setRow(i, { slot_minutes: Number(e.target.value) })}
              aria-label={`Slot minutes ${i + 1}`}
            />
            {schedule.length > 1 && (
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove block ${i + 1}`}
                onClick={() => setSchedule((r) => r.filter((_, j) => j !== i))}
              >
                ✕
              </button>
            )}
          </div>
        ))}

        <div className="btn-row">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Saving…' : doctor ? 'Save changes' : 'Create doctor'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>
    </Modal>
  );
}
