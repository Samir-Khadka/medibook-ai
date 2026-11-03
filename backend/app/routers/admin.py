"""Admin endpoints: platform stats and patient management."""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_current_admin, get_db

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats", response_model=schemas.AdminStatsOut)
def stats(admin: models.User = Depends(get_current_admin),
          db: Session = Depends(get_db)):
    today = date.today().isoformat()
    by_status = {s: 0 for s in ("requested", "confirmed", "completed", "cancelled")}
    rows = db.query(models.Appointment.status).all()
    for (s,) in rows:
        if s in by_status:
            by_status[s] += 1
    return {
        "total_patients": db.query(models.User).filter(
            models.User.role == "patient").count(),
        "total_doctors": db.query(models.Doctor).count(),
        "appointments_today": db.query(models.Appointment).filter(
            models.Appointment.date == today).count(),
        "appointments_total": db.query(models.Appointment).count(),
        "by_status": by_status,
    }


@router.get("/patients", response_model=list[schemas.AdminPatientOut])
def list_patients(search: str | None = None,
                  admin: models.User = Depends(get_current_admin),
                  db: Session = Depends(get_db)):
    q = db.query(models.User).filter(models.User.role == "patient")
    if search:
        term = f"%{search.strip()}%"
        q = q.filter(models.User.name.ilike(term) | models.User.email.ilike(term))
    patients = q.order_by(models.User.id).all()
    return [{"id": p.id, "name": p.name, "email": p.email,
             "created_at": p.created_at, "active": p.is_active}
            for p in patients]


@router.patch("/patients/{patient_id}", response_model=schemas.AdminPatientOut)
def set_patient_active(patient_id: int, data: schemas.AdminPatientActiveIn,
                       admin: models.User = Depends(get_current_admin),
                       db: Session = Depends(get_db)):
    if patient_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="You cannot deactivate your own account")
    patient = db.query(models.User).filter(
        models.User.id == patient_id, models.User.role == "patient").first()
    if not patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail="Patient not found")
    patient.is_active = data.active
    db.commit()
    db.refresh(patient)
    return {"id": patient.id, "name": patient.name, "email": patient.email,
            "created_at": patient.created_at, "active": patient.is_active}
