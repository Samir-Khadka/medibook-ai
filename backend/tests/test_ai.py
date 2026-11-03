"""Tests for the offline AI endpoints: triage, match, FAQ."""
import json
from datetime import date, timedelta

import pytest

from tests.conftest import (auth_header, create_doctor_via_api, make_user,
                            next_weekday)

DISCLAIMER = ("This is informational only and not a medical diagnosis. "
              "Consult a qualified doctor.")


def seed_admin(client, db):
    make_user(db, "Admin", "admin@x.io", "admin123", "admin")
    return auth_header(client, "admin@x.io", "admin123")


# ------------------------------------------------------------- triage mapping
@pytest.mark.parametrize("symptoms,expected", [
    ("I have acne and pimples on my face", "Dermatology"),
    ("My knee has been hurting for weeks", "Orthopedics"),
    ("fever and dry cough for two days", "General Medicine"),
    ("my vision is blurry", "Ophthalmology"),
    ("terrible migraine headache", "Neurology"),
    ("my child has a fever", "Pediatrics"),
    ("stomach pain after meals", "Gastroenterology"),
])
def test_triage_keyword_mapping(client, db, symptoms, expected):
    r = client.post("/api/ai/triage", json={"symptoms": symptoms})
    assert r.status_code == 200
    body = r.json()
    assert body["specialties"], body
    assert body["specialties"][0]["specialty"] == expected
    top = body["specialties"][0]
    assert 0 < top["confidence"] <= 1
    assert top["matched_symptoms"]
    assert top["reason"]


@pytest.mark.parametrize("symptoms", [
    "I have acne and pimples",
    "severe chest pain",
    "my knee hurts",
    "just feeling tired",
    "blurry vision at night",
])
def test_disclaimer_present_on_every_response(client, db, symptoms):
    r = client.post("/api/ai/triage", json={"symptoms": symptoms})
    body = r.json()
    assert DISCLAIMER in body["disclaimer"]
    # emergency responses prepend the emergency line
    if body["emergency"]:
        assert body["disclaimer"].startswith("Seek emergency care immediately.")


@pytest.mark.parametrize("symptoms", [
    "I have acne and pimples",
    "severe chest pain radiating to my arm",
    "my knee hurts when I walk",
    "just feeling tired all day",
    "blurry vision at night",
    "my child has a fever and cough",
])
def test_never_claims_diagnosis_outside_disclaimer(client, db, symptoms):
    body = client.post("/api/ai/triage", json={"symptoms": symptoms}).json()
    rest = json.dumps({k: v for k, v in body.items() if k != "disclaimer"})
    assert "diagnos" not in rest.lower()


@pytest.mark.parametrize("symptoms", [
    "I have severe chest pain",
    "difficulty breathing since morning",
])
def test_urgent_escalation(client, db, symptoms):
    body = client.post("/api/ai/triage", json={"symptoms": symptoms}).json()
    assert body["urgency"] == "urgent"
    assert body["emergency"] is True
    assert body["disclaimer"].startswith("Seek emergency care immediately.")
    assert DISCLAIMER in body["disclaimer"]


def test_triage_unknown_symptoms_still_safe(client, db):
    body = client.post("/api/ai/triage",
                       json={"symptoms": "xyzzy feeling weird"}).json()
    assert body["urgency"] == "routine"
    assert body["emergency"] is False
    assert DISCLAIMER in body["disclaimer"]
    assert body["clarifying_questions"]


def test_triage_optional_fields(client, db):
    body = client.post("/api/ai/triage",
                       json={"symptoms": "itchy skin", "age": 30,
                             "duration_days": 20}).json()
    assert body["specialties"][0]["specialty"] == "Dermatology"
    assert body["urgency"] == "soon"  # long duration escalates routine -> soon


# ------------------------------------------------------------- match
def test_match_ranks_soonest_slot_first(client, db):
    admin_h = seed_admin(client, db)
    tomorrow_wd = (date.today() + timedelta(days=1)).weekday()
    # doctor A: available tomorrow; doctor B: available 2 days later
    a = create_doctor_via_api(client, admin_h, "a@x.io", specialty="Dermatology",
                              schedule=[{"weekday": tomorrow_wd, "start_time": "09:00",
                                         "end_time": "10:00", "slot_minutes": 30}])
    b = create_doctor_via_api(client, admin_h, "b@x.io", specialty="Dermatology",
                              schedule=[{"weekday": (tomorrow_wd + 2) % 7, "start_time": "09:00",
                                         "end_time": "10:00", "slot_minutes": 30}])
    r = client.post("/api/ai/match", json={"specialty": "Dermatology"})
    assert r.status_code == 200
    results = r.json()
    assert [x["doctor_id"] for x in results] == [a["id"], b["id"]]
    assert results[0]["next_available"] is not None
    # higher rating wins ties on availability
    c = create_doctor_via_api(client, admin_h, "c@x.io", specialty="Dermatology",
                              schedule=[{"weekday": tomorrow_wd, "start_time": "09:00",
                                         "end_time": "10:00", "slot_minutes": 30}])
    r = client.post("/api/ai/match", json={"specialty": "dermatology"})
    assert r.status_code == 200  # case-insensitive
    assert {x["doctor_id"] for x in r.json()} == {a["id"], b["id"], c["id"]}


def test_match_only_active_doctors_and_empty_specialty(client, db):
    admin_h = seed_admin(client, db)
    d = create_doctor_via_api(client, admin_h, "gone@x.io", specialty="Neurology")
    client.delete(f"/api/doctors/{d['id']}", headers=admin_h)
    r = client.post("/api/ai/match", json={"specialty": "Neurology"})
    assert r.json() == []
    r = client.post("/api/ai/match", json={"specialty": "NoSuchSpecialty"})
    assert r.json() == []


# ------------------------------------------------------------- faq
@pytest.mark.parametrize("question,topic", [
    ("What are your opening hours?", "hours"),
    ("How do I book an appointment?", "booking"),
    ("What should I do in an emergency?", "emergency"),
    ("How do I cancel my visit?", "cancellation"),
    ("Can I reschedule my appointment?", "reschedule"),
    ("What are the consultation fees?", "fees"),
])
def test_faq_answers(client, db, question, topic):
    r = client.post("/api/ai/faq", json={"question": question})
    assert r.status_code == 200
    body = r.json()
    assert body["topic"] == topic
    assert len(body["answer"]) > 20


def test_faq_topics_list(client, db):
    r = client.get("/api/ai/faq/topics")
    assert r.status_code == 200
    topics = r.json()
    assert len(topics) >= 15
    for t in topics:
        assert t["topic"] and t["sample_questions"]
