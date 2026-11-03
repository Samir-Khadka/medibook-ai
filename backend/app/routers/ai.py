"""Offline AI endpoints: symptom triage, doctor matching, FAQ."""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from .. import models, schemas
from ..ai import faq as faq_engine
from ..ai import triage as triage_engine
from ..deps import get_db
from ..slots import generate_slots

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/triage", response_model=schemas.TriageOut)
def triage(data: schemas.TriageIn):
    return triage_engine.triage(data.symptoms, age=data.age,
                                duration_days=data.duration_days)


@router.post("/match", response_model=list[schemas.MatchDoctorOut])
def match_doctors(data: schemas.MatchIn, db: Session = Depends(get_db)):
    """Rank active doctors of the requested specialty by soonest available slot
    (scanning the next 14 days), then by rating descending."""
    specialty = data.specialty.strip()
    doctors = (db.query(models.Doctor)
               .options(joinedload(models.Doctor.user), joinedload(models.Doctor.schedules))
               .filter(models.Doctor.specialty.ilike(f"%{specialty}%"),
                       models.Doctor.is_active.is_(True))
               .all())
    if not doctors:
        return []

    today = date.today()
    results = []
    for doc in doctors:
        next_avail = None
        for offset in range(14):
            day = (today + timedelta(days=offset)).isoformat()
            for slot in generate_slots(doc, day, db):
                if slot["available"]:
                    next_avail = {"date": day, "start_time": slot["start"]}
                    break
            if next_avail:
                break
        results.append({
            "doctor_id": doc.id,
            "name": doc.user.name if doc.user else "",
            "specialty": doc.specialty,
            "rating": doc.rating,
            "next_available": next_avail,
        })

    def sort_key(r):
        avail = r["next_available"]
        return (avail is None,
                avail["date"] if avail else "",
                avail["start_time"] if avail else "",
                -r["rating"])

    return sorted(results, key=sort_key)


@router.post("/faq", response_model=schemas.FaqOut)
def faq(data: schemas.FaqIn):
    return faq_engine.answer(data.question)


@router.get("/faq/topics", response_model=list[schemas.FaqTopicOut])
def faq_topics():
    return faq_engine.get_topics()
