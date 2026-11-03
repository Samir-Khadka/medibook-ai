/**
 * Typed API client for the MediBook AI backend.
 * Reads the base URL from VITE_API_URL (default http://localhost:8000).
 * Auth token is stored in localStorage under "mb_token".
 */
import type {
  AdminPatient,
  AdminStats,
  Appointment,
  AppointmentAction,
  AuthResponse,
  Doctor,
  DoctorCreatePayload,
  DoctorUpdatePayload,
  FaqResult,
  MatchedDoctor,
  Slot,
  TriageResult,
  User,
  Visit,
} from './types';

const API_BASE =
  ((import.meta.env.VITE_API_URL as string | undefined) ?? '').replace(/\/+$/, '') ||
  'http://localhost:8000';

export const TOKEN_KEY = 'mb_token';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || `Request failed (${status})`;
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = opts;
  const url = new URL(API_BASE + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and that the API is running.');
  }

  if (res.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.dispatchEvent(new Event('mb:unauthorized'));
  }

  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as { detail?: unknown };
      if (typeof data.detail === 'string') detail = data.detail;
    } catch {
      // keep default
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  // --- auth ---
  register: (name: string, email: string, password: string) =>
    request<AuthResponse>('/api/auth/register', { method: 'POST', body: { name, email, password } }),
  login: (email: string, password: string) =>
    request<AuthResponse>('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => request<User>('/api/auth/me'),

  // --- doctors ---
  listDoctors: (params?: { specialty?: string; search?: string }) =>
    request<Doctor[]>('/api/doctors', { params }),
  getDoctor: (id: string) => request<Doctor>(`/api/doctors/${id}`),
  getSlots: (id: string, date: string) =>
    request<Slot[]>(`/api/doctors/${id}/slots`, { params: { date } }),
  rateDoctor: (id: string, rating: number) =>
    request<unknown>(`/api/doctors/${id}/rate`, { method: 'POST', body: { rating } }),

  // --- appointments ---
  createAppointment: (payload: { doctor_id: string; date: string; start_time: string; reason: string }) =>
    request<Appointment>('/api/appointments', { method: 'POST', body: payload }),
  listAppointments: (params?: { status?: string; upcoming?: boolean }) =>
    request<Appointment[]>('/api/appointments', { params }),
  updateAppointment: (id: string, status: AppointmentAction) =>
    request<Appointment>(`/api/appointments/${id}`, { method: 'PATCH', body: { status } }),
  rescheduleAppointment: (id: string, payload: { date: string; start_time: string }) =>
    request<Appointment>(`/api/appointments/${id}/reschedule`, { method: 'POST', body: payload }),

  // --- visits ---
  createVisit: (payload: {
    appointment_id: string;
    diagnosis_notes: string;
    prescription: { medicine: string; dosage: string; frequency: string; duration_days: number }[];
    advice: string;
  }) => request<Visit>('/api/visits', { method: 'POST', body: payload }),
  myVisits: () => request<Visit[]>('/api/visits/me'),
  visitSummary: (id: string) => request<{ summary: string }>(`/api/visits/${id}/summary`),

  // --- AI ---
  triage: (payload: { symptoms: string; age?: number; duration_days?: number }) =>
    request<TriageResult>('/api/ai/triage', { method: 'POST', body: payload }),
  match: (specialty: string) =>
    request<MatchedDoctor[]>('/api/ai/match', { method: 'POST', body: { specialty } }),
  faq: (question: string) => request<FaqResult>('/api/ai/faq', { method: 'POST', body: { question } }),

  // --- admin ---
  adminStats: () => request<AdminStats>('/api/admin/stats'),
  adminPatients: (search?: string) =>
    request<AdminPatient[]>('/api/admin/patients', { params: { search } }),
  setPatientActive: (id: string, active: boolean) =>
    request<AdminPatient>(`/api/admin/patients/${id}`, { method: 'PATCH', body: { active } }),
  adminCreateDoctor: (payload: DoctorCreatePayload) =>
    request<Doctor>('/api/doctors', { method: 'POST', body: payload }),
  adminUpdateDoctor: (id: string, payload: DoctorUpdatePayload) =>
    request<Doctor>(`/api/doctors/${id}`, { method: 'PUT', body: payload }),
  adminDeleteDoctor: (id: string) =>
    request<unknown>(`/api/doctors/${id}`, { method: 'DELETE' }),
};
