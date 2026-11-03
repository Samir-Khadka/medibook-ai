import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../api';
import type { Slot } from '../types';

export interface SlotState {
  slots: Slot[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Fetches bookable slots for a doctor on a given YYYY-MM-DD date. */
export function useSlots(doctorId: string, date: string | null): SlotState {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!date) {
      setSlots([]);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .getSlots(doctorId, date)
      .then((s) => {
        if (!cancelled) setSlots(s);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof ApiError ? e.detail : 'Failed to load slots.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId, date, nonce]);

  return { slots, loading, error, reload };
}

export function SlotGrid({
  slots,
  selected,
  onSelect,
}: {
  slots: Slot[];
  selected: string | null;
  onSelect: (start: string) => void;
}) {
  const available = slots.filter((s) => s.available);
  if (slots.length === 0) {
    return <p className="muted">No slots for this day.</p>;
  }
  if (available.length === 0) {
    return <p className="muted">All slots are booked for this day — try another date.</p>;
  }
  return (
    <div className="slot-grid">
      {slots.map((s) => (
        <button
          key={s.start}
          type="button"
          className={`slot ${selected === s.start ? 'selected' : ''}`}
          disabled={!s.available}
          onClick={() => onSelect(s.start)}
          aria-pressed={selected === s.start}
        >
          <span className="slot-time">{s.start}</span>
          <span className="slot-sub">{s.end}</span>
        </button>
      ))}
    </div>
  );
}
