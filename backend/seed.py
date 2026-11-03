"""Seed the MediBook AI database with demo accounts and sample data.

Run from the repo root:  python -m backend.seed
or:                        python backend/seed.py

Idempotent-ish: if admin@medibook.ai already exists, nothing is created.
"""
import os
import sys
from datetime import date, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import Base, SessionLocal, engine  # noqa: E402
from app.models import Appointment, Doctor, ScheduleSlot, User, Visit  # noqa: E402
from app.security import hash_password  # noqa: E402

Base.metadata.create_all(bind=engine)

WEEKDAY_SCHEDULE = [  # Mon-Fri, two windows
    {"weekday": w, "start_time": "09:00", "end_time": "13:00", "slot_minutes": 30}
    for w in range(5)
] + [
    {"weekday": w, "start_time": "15:00", "end_time": "18:00", "slot_minutes": 30}
    for w in range(5)
]

DOCTORS = [
    # name, email, specialty, qualification, exp_years, fee, bio
    ("Dr. Ramesh Adhikari", "doctor@medibook.ai", "Cardiology",
     "MBBS, MD (Cardiology)", 12, 1200.0,
     "Interventional cardiologist with 12 years of experience in heart care."),
    ("Dr. Sita Karki", "sita.karki@medibook.ai", "Dermatology",
     "MBBS, MD (Dermatology)", 8, 800.0,
     "Dermatologist specializing in skin, hair and nail disorders."),
    ("Dr. Binod Thapa", "binod.thapa@medibook.ai", "Neurology",
     "MBBS, DM (Neurology)", 10, 1500.0,
     "Neurologist focused on headaches, seizures and movement disorders."),
    ("Dr. Gita Shrestha", "gita.shrestha@medibook.ai", "Orthopedics",
     "MBBS, MS (Orthopedics)", 9, 1000.0,
     "Orthopedic surgeon for bones, joints and sports injuries."),
    ("Dr. Prakash Rai", "prakash.rai@medibook.ai", "Pediatrics",
     "MBBS, MD (Pediatrics)", 7, 700.0,
     "Pediatrician caring for infants, children and adolescents."),
    ("Dr. Mina Gurung", "mina.gurung@medibook.ai", "General Medicine",
     "MBBS, MD (Internal Medicine)", 11, 900.0,
     "Internist for everyday health concerns and chronic care."),
    ("Dr. Arjun KC", "arjun.kc@medibook.ai", "Ophthalmology",
     "MBBS, MS (Ophthalmology)", 6, 850.0,
     "Eye specialist for vision care, cataract and eye infections."),
    ("Dr. Sunita Maharjan", "sunita.maharjan@medibook.ai", "Cardiology",
     "MBBS, MD (Cardiology)", 5, 1000.0,
     "Cardiologist with a focus on preventive heart health."),
]


def main():
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == "admin@medibook.ai").first():
            print("Seed: admin@medibook.ai already exists — skipping.")
            return

        admin = User(name="Admin", email="admin@medibook.ai",
                     password_hash=hash_password("admin123"), role="admin")
        patient = User(name="Demo Patient", email="patient@medibook.ai",
                       password_hash=hash_password("patient123"), role="patient")
        db.add_all([admin, patient])
        db.flush()

        doctors = {}
        for i, (name, email, specialty, qual, exp, fee, bio) in enumerate(DOCTORS):
            password = "doctor123" if i == 0 else "doctor123"
            user = User(name=name, email=email,
                        password_hash=hash_password(password), role="doctor")
            db.add(user)
            db.flush()
            doc = Doctor(user_id=user.id, specialty=specialty, qualification=qual,
                         experience_years=exp, consultation_fee=fee, bio=bio,
                         rating=round(4.2 + (i % 4) * 0.2, 1), rating_count=10 + i * 3)
            db.add(doc)
            db.flush()
            for s in WEEKDAY_SCHEDULE:
                db.add(ScheduleSlot(doctor_id=doc.id, **s))
            doctors[name] = doc

        # Sample appointments for the demo patient
        cardio = doctors["Dr. Ramesh Adhikari"]
        derma = doctors["Dr. Sita Karki"]
        future = (date.today() + timedelta(days=3)).isoformat()
        if date.fromisoformat(future).weekday() > 4:  # keep on a weekday
            future = (date.today() + timedelta(days=3 + (7 - date.fromisoformat(future).weekday()))).isoformat()
        past = (date.today() - timedelta(days=10)).isoformat()

        a1 = Appointment(patient_id=patient.id, doctor_id=cardio.id,
                         date=future, start_time="09:30", end_time="10:00",
                         status="requested", reason="Chest discomfort on exertion")
        a2 = Appointment(patient_id=patient.id, doctor_id=derma.id,
                         date=future, start_time="10:00", end_time="10:30",
                         status="confirmed", reason="Persistent skin rash")
        a3 = Appointment(patient_id=patient.id, doctor_id=cardio.id,
                         date=past, start_time="09:00", end_time="09:30",
                         status="completed", reason="Routine heart checkup")
        db.add_all([a1, a2, a3])
        db.flush()
        db.add(Visit(
            appointment_id=a3.id, patient_id=patient.id, doctor_id=cardio.id,
            diagnosis_notes="Blood pressure slightly elevated; ECG normal. "
                            "Advised lifestyle changes and a follow-up in 3 months.",
            prescription=[
                {"medicine": "Amlodipine", "dosage": "5 mg",
                 "frequency": "Once daily", "duration_days": 30},
                {"medicine": "Atorvastatin", "dosage": "10 mg",
                 "frequency": "Once daily at night", "duration_days": 30},
            ],
            advice="Reduce salt intake, walk 30 minutes daily, avoid smoking."))
        db.commit()

        print("Seed complete.")
        print("Demo logins:")
        print("  admin    admin@medibook.ai    / admin123")
        print("  doctor   doctor@medibook.ai   / doctor123")
        print("  patient  patient@medibook.ai  / patient123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
