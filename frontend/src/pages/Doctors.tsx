import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { Avatar, EmptyState, ErrorBanner, Field, Input, PageHeader, Spinner, Stars } from '../components/ui';
import { feeLabel, fmtDateShort, next14Days, toDateStr } from '../lib';
import type { Doctor } from '../types';

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

type NextInfo = { date: string; start_time: string } | null;

export function Doctors() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSpecialty = searchParams.get('specialty') ?? 'All';

  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState(initialSpecialty);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextMap, setNextMap] = useState<Record<string, NextInfo | undefined>>({});

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstRun = useRef(true);

  const load = useCallback(async (q: string, spec: string) => {
    setLoading(true);
    setError(null);
    try {
      const [docs, matched] = await Promise.all([
        api.listDoctors({
          specialty: spec === 'All' ? undefined : spec,
          search: q.trim() || undefined,
        }),
        spec === 'All' ? Promise.resolve([]) : api.match(spec).catch(() => []),
      ]);
      setDoctors(docs.filter((d) => d.is_active));
      const seeded: Record<string, NextInfo | undefined> = {};
      for (const m of matched) seeded[m.doctor_id] = m.next_available;
      setNextMap(seeded);
    } catch (e) {
      setError(e instanceof ApiError ? e.detail : 'Failed to load doctors.');
    } finally {
      setLoading(false);
    }
  }, []);

  // initial load + debounced search/filter changes
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      load(search, specialty);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(search, specialty), 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, specialty, load]);

  function pickSpecialty(s: string) {
    setSpecialty(s);
    if (s === 'All') searchParams.delete('specialty');
    else searchParams.set('specialty', s);
    setSearchParams(searchParams, { replace: true });
  }

  // Lazily probe each doctor's slots (next 5 days) when /ai/match didn't seed it.
  const probeQueue = useMemo(() => doctors.filter((d) => !(d.id in nextMap)), [doctors, nextMap]);
  useEffect(() => {
    let cancelled = false;
    const days = next14Days()
      .slice(1, 6)
      .map((d) => d.date);
    async function probe(doc: Doctor): Promise<NextInfo> {
      for (const date of days) {
        try {
          const slots = await api.getSlots(doc.id, date);
          const open = slots.find((s) => s.available);
          if (open) return { date, start_time: open.start };
        } catch {
          // keep probing next day
        }
        if (cancelled) return null;
      }
      return null;
    }
    (async () => {
      for (const doc of probeQueue) {
        if (cancelled) return;
        const info = await probe(doc);
        if (!cancelled) setNextMap((m) => ({ ...m, [doc.id]: info }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [probeQueue]);

  return (
    <div className="container page">
      <PageHeader title="Find a doctor" sub="Search by name or filter by specialty." />

      <div className="toolbar">
        <Field label="Search">
          <Input
            type="search"
            placeholder="Doctor name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </Field>
      </div>

      <div className="chips" role="group" aria-label="Specialty filter">
        {['All', ...SPECIALTIES].map((s) => (
          <button
            key={s}
            type="button"
            className={`chip ${specialty === s ? 'active' : ''}`}
            onClick={() => pickSpecialty(s)}
            aria-pressed={specialty === s}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && <Spinner label="Finding doctors…" />}
      {error && !loading && <ErrorBanner message={error} onRetry={() => load(search, specialty)} />}

      {!loading && !error && doctors.length === 0 && (
        <EmptyState
          icon="🩺"
          title="No doctors found"
          hint="Try a different name or specialty."
        />
      )}

      <div className="doc-grid">
        {doctors.map((d) => {
          const next = nextMap[d.id];
          return (
            <article key={d.id} className="card doc-card">
              <div className="doc-top">
                <Avatar name={d.name} />
                <div>
                  <h3>{d.name}</h3>
                  <span className="badge badge-teal">{d.specialty}</span>
                </div>
              </div>
              <div className="doc-meta">
                <span className="stars-inline">
                  <Stars value={d.rating} size={15} />
                  <span className="muted small">
                    {d.rating.toFixed(1)} ({d.rating_count})
                  </span>
                </span>
                <span className="muted small">{d.qualification}</span>
                <span className="muted small">{d.experience_years} yrs experience</span>
              </div>
              <div className="doc-next">
                {next === undefined ? (
                  <span className="muted small">Checking availability…</span>
                ) : next ? (
                  <span className="next-ok">
                    Next: {fmtDateShort(next.date)} · {next.start_time}
                  </span>
                ) : (
                  <span className="muted small">No slots in the next 5 days</span>
                )}
              </div>
              <div className="doc-foot">
                <span className="fee">{feeLabel(d.consultation_fee)}</span>
                <Link to={`/doctors/${d.id}`} className="btn btn-sm">
                  Book
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/** Prefetch helper used by the "book soonest slot" buttons on the triage page. */
export function bookSoonestPath(doctorId: string, info: { date: string; start_time: string }): string {
  const days = next14Days().map((d) => d.date);
  const has = days.includes(info.date);
  return `/doctors/${doctorId}?date=${has ? info.date : toDateStr(new Date())}&time=${info.start_time}`;
}
