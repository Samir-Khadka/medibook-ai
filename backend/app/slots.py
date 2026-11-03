"""Slot generation: derive bookable slots from a doctor's weekly schedule,
minus appointments with status in (requested, confirmed)."""
from datetime import date

from sqlalchemy.orm import Session

from . import models


def time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


def minutes_to_time(m: int) -> str:
    return f"{m // 60:02d}:{m % 60:02d}"


def generate_slots(doctor: models.Doctor, date_str: str, db: Session):
    """Return [{start, end, available}] for one doctor on one date (YYYY-MM-DD)."""
    day = date.fromisoformat(date_str)
    weekday = day.weekday()  # 0 = Monday
    schedules = [s for s in doctor.schedules if s.weekday == weekday]
    if not schedules:
        return []

    busy = db.query(models.Appointment).filter(
        models.Appointment.doctor_id == doctor.id,
        models.Appointment.date == date_str,
        models.Appointment.status.in_(["requested", "confirmed"]),
    ).all()

    slots = []
    for sched in schedules:
        cur = time_to_minutes(sched.start_time)
        end = time_to_minutes(sched.end_time)
        while cur + sched.slot_minutes <= end:
            start = minutes_to_time(cur)
            stop = minutes_to_time(cur + sched.slot_minutes)
            overlap = any(
                a.start_time < stop and start < a.end_time for a in busy
            )
            slots.append({"start": start, "end": stop, "available": not overlap})
            cur += sched.slot_minutes
    return sorted(slots, key=lambda s: s["start"])
