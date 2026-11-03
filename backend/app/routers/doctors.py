"""Doctor directory (public read) + admin management.

Design choice: doctors are onboarded by an admin, not by self-registration.
POST /api/doctors (admin) creates BOTH the login account (User, role='doctor')
AND the Doctor profile (specialty, fee, schedule, ...) in a single call.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..deps import (doctor_profile, get_current_admin, get_current_patient, get_db)
from ..security import hash_password
from ..slots import generate_slots

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


def doctor_to_out(doctor: models.Doctor) -> dict:
    return {
        "id": doctor.id,
        "name": doctor.user.name if doctor.user else "",
        "specialty": doctor.specialty,
        "qualification": doctor.qualification,
        "experience_years": doctor.experience_years,
        "consultation_fee": doctor.consultation_fee,
        "bio": doctor.bio,
        "rating": doctor.rating,
        "rating_count": doctor.rating_count,
        "is_active": doctor.is_active,
    }


def _get_doctor_or_404(doctor_id: int, db: Session) -> models.Doctor:
    doctor = db.query(models.Doctor).options(
        joinedload(models.Doctor.user), joinedload(models.Doctor.schedules)
    ).filter(models.Doctor.id == doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Doctor not found")
    return doctor


@router.get("", response_model=list[schemas.DoctorOut])
def list_doctors(specialty: str | None = None, search: str | None = None,
                 skip: int = Query(0, ge=0), limit: int = Query(50, ge=1, le=200),
                 db: Session = Depends(get_db)):
    q = db.query(models.Doctor).join(models.User,
                                     models.Doctor.user_id == models.User.id)
    if specialty:
        q = q.filter(models.Doctor.specialty.ilike(f"%{specialty.strip()}%"))
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(models.User.name.ilike(term) | models.Doctor.specialty.ilike(term))
    doctors = q.order_by(models.Doctor.id).offset(skip).limit(limit).all()
    return [doctor_to_out(d) for d in doctors]


@router.get("/{doctor_id}", response_model=schemas.DoctorDetailOut)
def get_doctor(doctor_id: int, db: Session = Depends(get_db)):
    doctor = _get_doctor_or_404(doctor_id, db)
    out = doctor_to_out(doctor)
    out["schedule"] = [
        {"id": s.id, "weekday": s.weekday, "start_time": s.start_time,
         "end_time": s.end_time, "slot_minutes": s.slot_minutes}
        for s in sorted(doctor.schedules, key=lambda s: (s.weekday, s.start_time))
    ]
    return out


@router.post("", response_model=schemas.DoctorOut,
             status_code=status.HTTP_201_CREATED)
def create_doctor(data: schemas.DoctorCreateIn,
                  admin: models.User = Depends(get_current_admin),
                  db: Session = Depends(get_db)):
    """Admin creates a doctor account: User (role='doctor') + Doctor profile + schedule."""
    email = data.email.strip().lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Email already registered")
    user = models.User(name=data.name.strip(), email=email,
                       password_hash=hash_password(data.password), role="doctor")
    db.add(user)
    db.flush()
    doctor = models.Doctor(
        user_id=user.id, specialty=data.specialty.strip(),
        qualification=data.qualification, experience_years=data.experience_years,
        consultation_fee=data.consultation_fee, bio=data.bio)
    db.add(doctor)
    db.flush()
    for s in data.schedule:
        db.add(models.ScheduleSlot(doctor_id=doctor.id, weekday=s.weekday,
                                   start_time=s.start_time, end_time=s.end_time,
                                   slot_minutes=s.slot_minutes))
    db.commit()
    db.refresh(doctor)
    return doctor_to_out(doctor)


@router.put("/{doctor_id}", response_model=schemas.DoctorOut)
def update_doctor(doctor_id: int, data: schemas.DoctorUpdateIn,
                  admin: models.User = Depends(get_current_admin),
                  db: Session = Depends(get_db)):
    doctor = _get_doctor_or_404(doctor_id, db)
    if data.name is not None:
        doctor.user.name = data.name.strip()
    for field in ("specialty", "qualification", "experience_years",
                  "consultation_fee", "bio", "is_active"):
        value = getattr(data, field)
        if value is not None:
            setattr(doctor, field, value.strip() if isinstance(value, str) else value)
    if data.schedule is not None:
        db.query(models.ScheduleSlot).filter(
            models.ScheduleSlot.doctor_id == doctor.id).delete()
        for s in data.schedule:
            db.add(models.ScheduleSlot(doctor_id=doctor.id, weekday=s.weekday,
                                       start_time=s.start_time, end_time=s.end_time,
                                       slot_minutes=s.slot_minutes))
    db.commit()
    db.refresh(doctor)
    return doctor_to_out(doctor)


@router.delete("/{doctor_id}", status_code=status.HTTP_200_OK)
def delete_doctor(doctor_id: int,
                  admin: models.User = Depends(get_current_admin),
                  db: Session = Depends(get_db)):
    """Soft deactivation: the doctor stays in the DB but becomes unbookable."""
    doctor = _get_doctor_or_404(doctor_id, db)
    doctor.is_active = False
    db.commit()
    return {"id": doctor.id, "is_active": False}


@router.get("/{doctor_id}/slots", response_model=list[schemas.SlotOut])
def doctor_slots(doctor_id: int, date: str, db: Session = Depends(get_db)):
    doctor = _get_doctor_or_404(doctor_id, db)
    try:
        return generate_slots(doctor, date, db)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="date must be YYYY-MM-DD")


@router.post("/{doctor_id}/rate", response_model=schemas.RatingOut)
def rate_doctor(doctor_id: int, data: schemas.RateIn,
                patient: models.User = Depends(get_current_patient),
                db: Session = Depends(get_db)):
    """A patient may rate a doctor only if they have a completed appointment with them."""
    doctor = _get_doctor_or_404(doctor_id, db)
    completed = db.query(models.Appointment).filter(
        models.Appointment.patient_id == patient.id,
        models.Appointment.doctor_id == doctor.id,
        models.Appointment.status == "completed",
    ).first()
    if not completed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="You can only rate a doctor after a completed appointment")
    total = doctor.rating * doctor.rating_count + data.rating
    doctor.rating_count += 1
    doctor.rating = round(total / doctor.rating_count, 2)
    db.commit()
    return {"rating": doctor.rating, "rating_count": doctor.rating_count}
