"""Visit records: the doctor's notes + prescription per appointment."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..deps import (doctor_profile, get_current_patient, get_current_user, get_db)

router = APIRouter(prefix="/api/visits", tags=["visits"])


def _visit_out(visit: models.Visit, doctor_name: str,
               appointment_date: str) -> dict:
    return {
        "id": visit.id,
        "appointment_id": visit.appointment_id,
        "patient_id": visit.patient_id,
        "doctor_id": visit.doctor_id,
        "diagnosis_notes": visit.diagnosis_notes,
        "prescription": visit.prescription or [],
        "advice": visit.advice,
        "created_at": visit.created_at,
        "doctor_name": doctor_name,
        "appointment_date": appointment_date,
    }


@router.post("", response_model=schemas.VisitOut,
             status_code=status.HTTP_201_CREATED)
def create_visit(data: schemas.VisitCreateIn,
                 doctor: models.Doctor = Depends(doctor_profile),
                 db: Session = Depends(get_db)):
    """Record a visit. The appointment must be the doctor's own, status 'confirmed',
    with no visit yet. Marks the appointment 'completed'."""
    appt = db.query(models.Appointment).filter(
        models.Appointment.id == data.appointment_id).first()
    if not appt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Appointment not found")
    if appt.doctor_id != doctor.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Not your appointment")
    if appt.status != "confirmed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Visit can only be recorded for a confirmed appointment")
    if appt.visit is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="This appointment already has a visit")
    visit = models.Visit(
        appointment_id=appt.id, patient_id=appt.patient_id, doctor_id=doctor.id,
        diagnosis_notes=data.diagnosis_notes,
        prescription=[item.model_dump() for item in data.prescription],
        advice=data.advice)
    appt.status = "completed"
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return visit


@router.get("/me", response_model=list[schemas.VisitHistoryOut])
def my_visits(patient: models.User = Depends(get_current_patient),
              db: Session = Depends(get_db)):
    visits = (db.query(models.Visit)
              .options(joinedload(models.Visit.appointment))
              .join(models.Doctor, models.Visit.doctor_id == models.Doctor.id)
              .join(models.User, models.Doctor.user_id == models.User.id)
              .filter(models.Visit.patient_id == patient.id)
              .order_by(models.Visit.created_at.desc(), models.Visit.id.desc())
              .all())
    return [_visit_out(v, v.doctor.user.name if v.doctor.user else "",
                       v.appointment.date if v.appointment else "")
            for v in visits]


def _get_visit_scoped(visit_id: int, user: models.User,
                      db: Session) -> models.Visit:
    visit = db.query(models.Visit).options(
        joinedload(models.Visit.appointment)).filter(
        models.Visit.id == visit_id).first()
    if not visit:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Visit not found")
    if user.role == "admin":
        return visit
    if user.role == "patient" and visit.patient_id == user.id:
        return visit
    if user.role == "doctor":
        profile = db.query(models.Doctor).filter(
            models.Doctor.user_id == user.id).first()
        if profile and visit.doctor_id == profile.id:
            return visit
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/{visit_id}", response_model=schemas.VisitOut)
def get_visit(visit_id: int, user: models.User = Depends(get_current_user),
              db: Session = Depends(get_db)):
    visit = _get_visit_scoped(visit_id, user, db)
    return visit


@router.get("/{visit_id}/summary", response_model=schemas.VisitSummaryOut)
def visit_summary(visit_id: int, user: models.User = Depends(get_current_user),
                  db: Session = Depends(get_db)):
    """Deterministic, template-based summary — no LLM involved."""
    visit = _get_visit_scoped(visit_id, user, db)
    doctor_name = visit.doctor.user.name if visit.doctor and visit.doctor.user else "Unknown"
    specialty = visit.doctor.specialty if visit.doctor else ""
    patient_name = visit.patient.name if visit.patient else "Unknown"
    appt_date = visit.appointment.date if visit.appointment else "Unknown"

    lines = [
        "Visit Summary",
        f"Patient: {patient_name} | Doctor: {doctor_name} ({specialty})",
        f"Date: {appt_date}",
        "",
        "Notes:",
        visit.diagnosis_notes or "—",
        "",
        "Prescription:",
    ]
    if visit.prescription:
        for i, item in enumerate(visit.prescription, 1):
            lines.append(
                f"{i}. {item.get('medicine', '—')} — {item.get('dosage', '—')}, "
                f"{item.get('frequency', '—')}, for {item.get('duration_days', '—')} days")
    else:
        lines.append("—")
    lines += ["", "Advice:", visit.advice or "—"]
    return {"summary": "\n".join(lines)}
