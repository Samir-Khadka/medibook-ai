"""pytest fixtures: in-memory SQLite, TestClient with get_db overridden."""
import os
import sys
from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import deps, models  # noqa: E402
from app.database import Base  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password  # noqa: E402

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base.metadata.create_all(bind=engine)


@pytest.fixture
def db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    def override_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[deps.get_db] = override_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def make_user(db, name, email, password, role):
    user = models.User(name=name, email=email,
                       password_hash=hash_password(password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def auth_header(client, email, password):
    r = client.post("/api/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def next_weekday(target):
    """ISO date string of the next `target` weekday (0=Mon) strictly in the future."""
    d = date.today() + timedelta(days=1)
    while d.weekday() != target:
        d += timedelta(days=1)
    return d.isoformat()


WEEKDAY_SCHEDULE = [
    {"weekday": w, "start_time": "09:00", "end_time": "13:00", "slot_minutes": 30}
    for w in range(5)
]


def create_doctor_via_api(client, admin_h, email, specialty="Cardiology",
                          schedule=None):
    r = client.post("/api/doctors", json={
        "name": f"Dr. {email.split('@')[0].title()}", "email": email,
        "password": "doctor123", "specialty": specialty,
        "qualification": "MBBS", "experience_years": 5,
        "consultation_fee": 1000.0, "bio": "Test doctor",
        "schedule": schedule or WEEKDAY_SCHEDULE,
    }, headers=admin_h)
    assert r.status_code == 201, r.text
    return r.json()
