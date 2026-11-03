"""Appointment booking and lifecycle (status transitions, rescheduling)."""
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..deps import (doctor_profile, get_current_admin, get_current_patient,
                    get_current_user, get_db)
from ..slots import generate_slots, minutes_to_time, time_to_minutes

router = APIRouter(prefix="/api/appointments", tags=["appointments"])

STATUSES = ("requested", "confirmed", "completed", "cancelled")

# Verb aliases accepted for convenience (frontend sends "cancel"/"confirm"/"complete").
STATUS_ALIASES = {"cancel": "cancelled", "confirm": "confirmed",
                  "complete": "completed"}


def appointment_to_out(appt: models.Appointment) -> dict:
    """Serialize an appointment with joined doctor/patient display fields."""
    doctor = appt.doctor
    patient = appt.patient
    return {
        "id": appt.id,
        "patient_id": appt.patient_id,
        "doctor_id": appt.doctor_id,
        "date": appt.date,
        "start_time": appt.start_time,
        "end_time": appt.end_time,
        "status": appt.status,
        "reason": appt.reason,
        "doctor_name": doctor.user.name if doctor and doctor.user else None,
        "doctor_specialty": doctor.specialty if doctor else None,
        "patient_name": patient.name if patient else None,
    }


def _today_str() -> str:
    return date.today().isoformat()


def _now_hhmm() -> str:
    return datetime.now().strftime("%H:%M")


def _validate_slot(doctor: models.Doctor, date_str: str, start_time: str,
                   db: Session, exclude_appointment_id: int | None = None):
    """Return the slot's end_time, or raise 400 (outside schedule / past) / 409 (conflict).

    Conflicts are detected against requested/confirmed appointments directly, so a
    rescheduled appointment does not collide with itself.
    """
    if not doctor.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Doctor is not active")
    today = _today_str()
    if date_str < today or (date_str == today and start_time <= _now_hhmm()):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot book a slot in the past")

    slots = generate_slots(doctor, date_str, db)
    slot = next((s for s in slots if s["start"] == start_time), None)
    if slot is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Slot is outside the doctor's schedule")

    q = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor.id,
        models.Appointment.date == date_str,
        models.Appointment.status.in_(["requested", "confirmed"]),
        models.Appointment.start_time < slot["end"],
        slot["start"] < models.Appointment.end_time,
    )
    if exclude_appointment_id:
        q = q.filter(models.Appointment.id != exclude_appointment_id)
    if q.first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT,
                            detail="Slot is already booked")
    return slot["end"]


def _get_doctor_or_404(doctor_id: int, db: Session) -> models.Doctor:
    doctor = db.query(models.Doctor).options(
        joinedload(models.Doctor.schedules)).filter(
        models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Doctor not found")
    return doctor


@router.post("", response_model=schemas.AppointmentOut,
             status_code=status.HTTP_201_CREATED)
def book_appointment(data: schemas.AppointmentCreateIn,
                     patient: models.User = Depends(get_current_patient),
                     db: Session = Depends(get_db)):
    doctor = _get_doctor_or_404(data.doctor_id, db)
    end_time = _validate_slot(doctor, data.date, data.start_time, db)
    appt = models.Appointment(
        patient_id=patient.id, doctor_id=doctor.id, date=data.date,
        start_time=data.start_time, end_time=end_time,
        status="requested", reason=data.reason)
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appointment_to_out(appt)


@router.get("", response_model=list[schemas.AppointmentOut])
def list_appointments(status: str | None = Query(None),
                      upcoming: bool = Query(False),
                      user: models.User = Depends(get_current_user),
                      db: Session = Depends(get_db)):
    q = db.query(models.Appointment)
    if user.role == "patient":
        q = q.filter(models.Appointment.patient_id == user.id)
    elif user.role == "doctor":
        profile = db.query(models.Doctor).filter(
            models.Doctor.user_id == user.id).first()
        if not profile:
            return []
        q = q.filter(models.Appointment.doctor_id == profile.id)
    # admin sees all
    if status:
        if status not in STATUSES:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Invalid status")
        q = q.filter(models.Appointment.status == status)
    if upcoming:
        q = q.filter(models.Appointment.date >= _today_str(),
                     models.Appointment.status != "cancelled")
    q = q.options(joinedload(models.Appointment.doctor).joinedload(models.Doctor.user),
                  joinedload(models.Appointment.patient))
    appts = q.order_by(models.Appointment.created_at.desc(),
                       models.Appointment.id.desc()).all()
    return [appointment_to_out(a) for a in appts]


def _allowed_transition(role: str, old: str, new: str) -> bool:
    if role == "admin":
        return new in STATUSES
    if role == "patient":
        return (old, new) in (("requested", "cancelled"), ("confirmed", "cancelled"))
    if role == "doctor":
        return (old, new) in (("requested", "confirmed"), ("confirmed", "completed"))
    return False


@router.patch("/{appointment_id}", response_model=schemas.AppointmentOut)
def update_status(appointment_id: int, data: schemas.AppointmentStatusIn,
                  user: models.User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    new_status = STATUS_ALIASES.get(data.status, data.status)
    if new_status not in STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Invalid status")
    appt = db.query(models.Appointment).options(
        joinedload(models.Appointment.doctor).joinedload(models.Doctor.user),
        joinedload(models.Appointment.patient)).filter(
        models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Appointment not found")

    role = user.role
    if role == "patient":
        if appt.patient_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Not your appointment")
    elif role == "doctor":
        profile = db.query(models.Doctor).filter(
            models.Doctor.user_id == user.id).first()
        if not profile or appt.doctor_id != profile.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                                detail="Not your appointment")
    elif role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")

    if appt.status == new_status:
        # Idempotent: already in the requested state (e.g. visit creation
        # auto-completes, then the client PATCHes "complete" again).
        return appointment_to_out(appt)
    if not _allowed_transition(role, appt.status, new_status):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail=f"Cannot change status from {appt.status} to {new_status}")
    appt.status = new_status
    db.commit()
    db.refresh(appt)
    return appointment_to_out(appt)


@router.post("/{appointment_id}/reschedule", response_model=schemas.AppointmentOut)
def reschedule(appointment_id: int, data: schemas.RescheduleIn,
               patient: models.User = Depends(get_current_patient),
               db: Session = Depends(get_db)):
    appt = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Appointment not found")
    if appt.patient_id != patient.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Not your appointment")
    if appt.status not in ("requested", "confirmed"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Only requested or confirmed appointments can be rescheduled")
    doctor = _get_doctor_or_404(appt.doctor_id, db)
    end_time = _validate_slot(doctor, data.date, data.start_time, db,
                              exclude_appointment_id=appt.id)
    appt.date = data.date
    appt.start_time = data.start_time
    appt.end_time = end_time
    db.commit()
    db.refresh(appt)
    return appointment_to_out(appt)
