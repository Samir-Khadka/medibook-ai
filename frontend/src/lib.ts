/** Shared formatting + date helpers. */

export const WEEKDAY_NAMES = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const; // contract: weekday 0-6, Monday-Sunday

export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function parseDate(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00');
}

/** Contract weekday index (0=Mon..6=Sun) for a YYYY-MM-DD date. */
export function weekdayIndex(dateStr: string): number {
  return (parseDate(dateStr).getDay() + 6) % 7;
}

export function todayStr(): string {
  const d = new Date();
  return toDateStr(d);
}

export function toDateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface DayChip {
  date: string; // YYYY-MM-DD
  dayShort: string;
  dayNum: number;
  monthShort: string;
  isToday: boolean;
}

export function next14Days(): DayChip[] {
  const out: DayChip[] = [];
  const now = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    out.push({
      date: toDateStr(d),
      dayShort: WEEKDAY_SHORT[weekdayIndex(toDateStr(d))],
      dayNum: d.getDate(),
      monthShort: MONTH_SHORT[d.getMonth()],
      isToday: i === 0,
    });
  }
  return out;
}

export function fmtDate(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${WEEKDAY_SHORT[weekdayIndex(dateStr)]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function fmtDateShort(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${WEEKDAY_SHORT[weekdayIndex(dateStr)]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

/** Consultation fee display. Currency is not in the contract; Rs. is the product default. */
export function feeLabel(fee: number): string {
  return `Rs. ${Number(fee).toLocaleString()}`;
}

/** Confidence may be 0-1 or 0-100; normalize to a 0-100 percentage. */
export function confidencePct(c: number): number {
  const v = c <= 1 ? c * 100 : c;
  return Math.max(0, Math.min(100, Math.round(v)));
}

/** Normalize appointment status to a canonical UI form. */
export type CanonicalStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export function canonicalStatus(s: string): CanonicalStatus {
  const v = s.toLowerCase();
  if (v === 'confirm' || v === 'confirmed') return 'confirmed';
  if (v === 'cancel' || v === 'cancelled') return 'cancelled';
  if (v === 'complete' || v === 'completed') return 'completed';
  return 'pending';
}
