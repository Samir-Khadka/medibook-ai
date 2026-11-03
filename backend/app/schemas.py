"""Pydantic v2 request/response schemas — field names match the API contract exactly."""
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field, field_validator


# ---------------------------------------------------------------- helpers
def _validate_hhmm(value: str) -> str:
    import re
    if not re.fullmatch(r"\d{2}:\d{2}", value or ""):
        raise ValueError("time must be HH:MM")
    h, m = int(value[:2]), int(value[3:])
    if h > 23 or m > 59:
        raise ValueError("time must be HH:MM")
    return value


def _validate_yyyymmdd(value: str) -> str:
    import re
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value or ""):
        raise ValueError("date must be YYYY-MM-DD")
    datetime.strptime(value, "%Y-%m-%d")
    return value


# ---------------------------------------------------------------- auth
class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class LoginIn(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    name: str
    email: str
    role: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ---------------------------------------------------------------- doctors
class ScheduleIn(BaseModel):
    weekday: int = Field(ge=0, le=6)
    start_time: str
    end_time: str
    slot_minutes: int = Field(default=30, ge=5, le=480)

    _t1 = field_validator("start_time")(_validate_hhmm)
    _t2 = field_validator("end_time")(_validate_hhmm)


class ScheduleOut(ScheduleIn):
    id: int


class DoctorCreateIn(BaseModel):
    """Admin creates a doctor account: name/email/password make the User (role='doctor'),
    the rest make the Doctor profile — one call, as specified."""
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)
    specialty: str = Field(min_length=1, max_length=80)
    qualification: Optional[str] = None
    experience_years: int = Field(default=0, ge=0, le=80)
    consultation_fee: float = Field(default=0.0, ge=0)
    bio: Optional[str] = None
    schedule: List[ScheduleIn] = Field(default_factory=list)


class DoctorUpdateIn(BaseModel):
    name: Optional[str] = None
    specialty: Optional[str] = None
    qualification: Optional[str] = None
    experience_years: Optional[int] = Field(default=None, ge=0, le=80)
    consultation_fee: Optional[float] = Field(default=None, ge=0)
    bio: Optional[str] = None
    is_active: Optional[bool] = None
    schedule: Optional[List[ScheduleIn]] = None


class DoctorOut(BaseModel):
    id: int
    name: str
    specialty: str
    qualification: Optional[str] = None
    experience_years: int
    consultation_fee: float
    bio: Optional[str] = None
    rating: float
    rating_count: int
    is_active: bool


class DoctorDetailOut(DoctorOut):
    schedule: List[ScheduleOut]


class SlotOut(BaseModel):
    start: str
    end: str
    available: bool


class RateIn(BaseModel):
    rating: int = Field(ge=1, le=5)


class RatingOut(BaseModel):
    rating: float
    rating_count: int


# ---------------------------------------------------------------- appointments
class AppointmentCreateIn(BaseModel):
    doctor_id: int
    date: str
    start_time: str
    reason: Optional[str] = Field(default=None, max_length=1000)

    _d = field_validator("date")(_validate_yyyymmdd)
    _t = field_validator("start_time")(_validate_hhmm)


class AppointmentStatusIn(BaseModel):
    status: str


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    date: str
    start_time: str
    end_time: str
    status: str
    reason: Optional[str] = None
    doctor_name: Optional[str] = None
    doctor_specialty: Optional[str] = None
    patient_name: Optional[str] = None


class RescheduleIn(BaseModel):
    date: str
    start_time: str

    _d = field_validator("date")(_validate_yyyymmdd)
    _t = field_validator("start_time")(_validate_hhmm)


# ---------------------------------------------------------------- visits
class PrescriptionItem(BaseModel):
    medicine: str
    dosage: str
    frequency: str
    duration_days: int = Field(ge=1)


class VisitCreateIn(BaseModel):
    appointment_id: int
    diagnosis_notes: Optional[str] = None
    prescription: List[PrescriptionItem] = Field(default_factory=list)
    advice: Optional[str] = None


class VisitOut(BaseModel):
    id: int
    appointment_id: int
    patient_id: int
    doctor_id: int
    diagnosis_notes: Optional[str] = None
    prescription: List[dict]
    advice: Optional[str] = None
    created_at: datetime


class VisitHistoryOut(VisitOut):
    doctor_name: str
    appointment_date: str


class VisitSummaryOut(BaseModel):
    summary: str


# ---------------------------------------------------------------- AI
class TriageIn(BaseModel):
    symptoms: str = Field(min_length=1, max_length=2000)
    age: Optional[int] = Field(default=None, ge=0, le=130)
    duration_days: Optional[int] = Field(default=None, ge=0)


class TriageSpecialtyOut(BaseModel):
    specialty: str
    confidence: float
    matched_symptoms: List[str]
    reason: str


class TriageOut(BaseModel):
    specialties: List[TriageSpecialtyOut]
    urgency: str
    emergency: bool
    clarifying_questions: List[str]
    disclaimer: str


class MatchIn(BaseModel):
    specialty: str = Field(min_length=1)


class NextAvailableOut(BaseModel):
    date: str
    start_time: str


class MatchDoctorOut(BaseModel):
    doctor_id: int
    name: str
    specialty: str
    rating: float
    next_available: Optional[NextAvailableOut] = None


class FaqIn(BaseModel):
    question: str = Field(min_length=1, max_length=2000)


class FaqOut(BaseModel):
    answer: str
    topic: str


class FaqTopicOut(BaseModel):
    topic: str
    sample_questions: List[str]


# ---------------------------------------------------------------- admin
class AdminStatsOut(BaseModel):
    total_patients: int
    total_doctors: int
    appointments_today: int
    appointments_total: int
    by_status: dict


class AdminPatientOut(BaseModel):
    id: int
    name: str
    email: str
    created_at: datetime
    active: bool


class AdminPatientActiveIn(BaseModel):
    active: bool
