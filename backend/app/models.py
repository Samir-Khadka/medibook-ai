"""SQLAlchemy models for MediBook AI."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, JSON, String
from sqlalchemy.orm import relationship

from .database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    """A user account. role is one of 'patient', 'doctor', 'admin'."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="patient")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    doctor_profile = relationship("Doctor", back_populates="user", uselist=False,
                                  cascade="all, delete-orphan")


class Doctor(Base):
    """Doctor profile — one per user with role='doctor'."""
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     unique=True, nullable=False)
    specialty = Column(String(80), nullable=False, index=True)
    qualification = Column(String(255), nullable=True)
    experience_years = Column(Integer, nullable=False, default=0)
    consultation_fee = Column(Float, nullable=False, default=0.0)
    bio = Column(String(2000), nullable=True)
    rating = Column(Float, nullable=False, default=0.0)
    rating_count = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    user = relationship("User", back_populates="doctor_profile")
    schedules = relationship("ScheduleSlot", back_populates="doctor",
                             cascade="all, delete-orphan")


class ScheduleSlot(Base):
    """One weekly availability window. weekday: 0=Monday .. 6=Sunday."""
    __tablename__ = "schedule_slots"

    id = Column(Integer, primary_key=True, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id", ondelete="CASCADE"),
                       nullable=False, index=True)
    weekday = Column(Integer, nullable=False)
    start_time = Column(String(5), nullable=False)   # "HH:MM"
    end_time = Column(String(5), nullable=False)     # "HH:MM"
    slot_minutes = Column(Integer, nullable=False, default=30)

    doctor = relationship("Doctor", back_populates="schedules")


class Appointment(Base):
    """An appointment. date/start_time/end_time are 'YYYY-MM-DD' / 'HH:MM' strings."""
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    date = Column(String(10), nullable=False, index=True)
    start_time = Column(String(5), nullable=False)
    end_time = Column(String(5), nullable=False)
    status = Column(String(20), nullable=False, default="requested", index=True)
    reason = Column(String(1000), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("Doctor", foreign_keys=[doctor_id])
    visit = relationship("Visit", back_populates="appointment", uselist=False,
                         cascade="all, delete-orphan")


class Visit(Base):
    """A doctor's visit record for one appointment (diagnosis notes + prescription)."""
    __tablename__ = "visits"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"),
                            unique=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False, index=True)
    diagnosis_notes = Column(String(4000), nullable=True)
    prescription = Column(JSON, nullable=False, default=list)  # [{medicine,dosage,frequency,duration_days}]
    advice = Column(String(4000), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_utcnow)

    appointment = relationship("Appointment", back_populates="visit")
    patient = relationship("User", foreign_keys=[patient_id])
    doctor = relationship("Doctor", foreign_keys=[doctor_id])
