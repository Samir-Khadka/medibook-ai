/**
 * Domain types for MediBook AI, matching the backend API contract exactly.
 * Fields marked "assumed" are not spelled out in the contract; see README.
 */

export type Role = 'patient' | 'doctor' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface ScheduleBlock {
  /** 0-6, Monday-Sunday (per contract) */
  weekday: number;
  start_time: string; // "09:00"
  end_time: string; // "13:00"
  slot_minutes: number;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  qualification: string;
  experience_years: number;
  consultation_fee: number;
  bio: string;
  rating: number;
  rating_count: number;
  is_active: boolean;
  schedule?: ScheduleBlock[];
}

export interface Slot {
  start: string; // "09:00"
  end: string; // "09:30"
  available: boolean;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'cancel'
  | 'confirm'
  | 'complete';

/** Actions sent to PATCH /api/appointments/{id} (contract verbs). */
export type AppointmentAction = 'cancel' | 'confirm' | 'complete';

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string; // YYYY-MM-DD
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  reason: string;
  // --- assumed joined fields (backend may return plain ids only) ---
  doctor_name?: string;
  doctor_specialty?: string;
  patient_name?: string;
  patient_email?: string;
}

export interface PrescriptionItem {
  medicine: string;
  dosage: string;
  frequency: string;
  duration_days: number;
}

export interface Visit {
  id: string;
  appointment_id?: string;
  doctor_id?: string;
  patient_id?: string;
  doctor_name?: string;
  date?: string; // assumed
  diagnosis_notes: string;
  prescription: PrescriptionItem[];
  advice: string;
  summary?: string;
}

export interface TriageSpecialty {
  specialty: string;
  confidence: number;
  matched_symptoms: string[];
  reason: string;
}

export type Urgency = 'routine' | 'soon' | 'urgent';

export interface TriageResult {
  specialties: TriageSpecialty[];
  urgency: Urgency;
  emergency: boolean;
  clarifying_questions: string[];
  disclaimer: string;
}

export interface MatchedDoctor {
  doctor_id: string;
  name: string;
  specialty: string;
  rating: number;
  next_available: { date: string; start_time: string } | null;
}

export interface FaqResult {
  answer: string;
  topic: string;
}

export interface AdminStats {
  total_patients: number;
  total_doctors: number;
  appointments_today: number;
  appointments_total: number;
  by_status: Record<string, number>;
}

export interface AdminPatient {
  id: string;
  name: string;
  email: string;
  active: boolean;
}

export interface DoctorCreatePayload {
  name: string;
  email: string;
  password: string;
  specialty: string;
  qualification: string;
  experience_years: number;
  consultation_fee: number;
  bio: string;
  schedule: ScheduleBlock[];
}

export interface DoctorUpdatePayload {
  name?: string;
  specialty?: string;
  qualification?: string;
  experience_years?: number;
  consultation_fee?: number;
  bio?: string;
  schedule?: ScheduleBlock[];
  is_active?: boolean;
}
