"""API tests: auth, doctors, appointments, visits, admin. All on SQLite."""
from datetime import date, timedelta

from tests.conftest import (WEEKDAY_SCHEDULE, auth_header, create_doctor_via_api,
                            make_user, next_weekday)


# ------------------------------------------------------------- fixtures
def seed_roles(client, db):
    make_user(db, "Admin", "admin@x.io", "admin123", "admin")
    make_user(db, "Pat", "pat@x.io", "pat123", "patient")
    admin_h = auth_header(client, "admin@x.io", "admin123")
    pat_h = auth_header(client, "pat@x.io", "pat123")
    doc = create_doctor_via_api(client, admin_h, "doc@x.io")
    doc_h = auth_header(client, "doc@x.io", "doctor123")
    return {"admin_h": admin_h, "pat_h": pat_h, "doc_h": doc_h, "doctor": doc}


def book(client, pat_h, doctor_id, date_s=None, start="09:00", reason="checkup"):
    r = client.post("/api/appointments", json={
        "doctor_id": doctor_id, "date": date_s or next_weekday(0),
        "start_time": start, "reason": reason}, headers=pat_h)
    return r


# ------------------------------------------------------------- auth
def test_register_returns_201_patient_role(client, db):
    r = client.post("/api/auth/register",
                    json={"name": "A", "email": "a@x.io", "password": "secret1"})
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"]
    assert body["user"]["role"] == "patient"
    assert body["user"]["email"] == "a@x.io"


def test_register_duplicate_email_400(client, db):
    client.post("/api/auth/register",
                json={"name": "A", "email": "a@x.io", "password": "secret1"})
    r = client.post("/api/auth/register",
                    json={"name": "B", "email": "a@x.io", "password": "secret2"})
    assert r.status_code == 400


def test_login_json_ok_and_bad_password_401(client, db):
    client.post("/api/auth/register",
                json={"name": "A", "email": "a@x.io", "password": "secret1"})
    r = client.post("/api/auth/login", json={"email": "a@x.io", "password": "secret1"})
    assert r.status_code == 200
    assert r.json()["user"]["name"] == "A"
    r = client.post("/api/auth/login", json={"email": "a@x.io", "password": "wrong"})
    assert r.status_code == 401
    r = client.post("/api/auth/login", json={"email": "nope@x.io", "password": "secret1"})
    assert r.status_code == 401


def test_me_requires_token_and_returns_user(client, db):
    assert client.get("/api/auth/me").status_code == 401
    client.post("/api/auth/register",
                json={"name": "A", "email": "a@x.io", "password": "secret1"})
    h = auth_header(client, "a@x.io", "secret1")
    r = client.get("/api/auth/me", headers=h)
    assert r.status_code == 200
    assert r.json() == {"id": r.json()["id"], "name": "A",
                        "email": "a@x.io", "role": "patient"}


# ------------------------------------------------------------- role guards
def test_patient_cannot_create_doctor_403(client, db):
    s = seed_roles(client, db)
    r = client.post("/api/doctors", json={
        "name": "X", "email": "x@x.io", "password": "doctor123",
        "specialty": "Cardiology", "schedule": []}, headers=s["pat_h"])
    assert r.status_code == 403


def test_unauthenticated_cannot_create_doctor(client, db):
    r = client.post("/api/doctors", json={"name": "X", "email": "x@x.io",
                                          "password": "doctor123", "specialty": "Cardiology"})
    assert r.status_code == 401


# ------------------------------------------------------------- doctors
def test_list_and_detail_doctors(client, db):
    s = seed_roles(client, db)
    r = client.get("/api/doctors")
    assert r.status_code == 200
    assert any(d["id"] == s["doctor"]["id"] for d in r.json())
    r = client.get(f"/api/doctors/{s['doctor']['id']}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["specialty"] == "Cardiology"
    assert len(detail["schedule"]) == len(WEEKDAY_SCHEDULE)
    assert detail["schedule"][0]["weekday"] == 0
    assert detail["schedule"][0]["start_time"] == "09:00"
    assert detail["schedule"][0]["slot_minutes"] == 30


def test_doctor_search_and_specialty_filter(client, db):
    s = seed_roles(client, db)
    create_doctor_via_api(client, s["admin_h"], "skin@x.io", specialty="Dermatology")
    r = client.get("/api/doctors", params={"specialty": "derma"})
    assert r.status_code == 200
    assert all(d["specialty"] == "Dermatology" for d in r.json())
    r = client.get("/api/doctors", params={"search": "skin"})
    assert any(d["specialty"] == "Dermatology" for d in r.json())


def test_admin_update_and_soft_delete_doctor(client, db):
    s = seed_roles(client, db)
    did = s["doctor"]["id"]
    r = client.put(f"/api/doctors/{did}", json={"consultation_fee": 2000.0},
                   headers=s["admin_h"])
    assert r.status_code == 200
    assert r.json()["consultation_fee"] == 2000.0
    r = client.delete(f"/api/doctors/{did}", headers=s["admin_h"])
    assert r.status_code == 200
    assert r.json()["is_active"] is False
    r = client.get(f"/api/doctors/{did}")
    assert r.json()["is_active"] is False


def test_slots_respect_schedule_and_weekend_empty(client, db):
    s = seed_roles(client, db)
    did = s["doctor"]["id"]
    monday = next_weekday(0)
    r = client.get(f"/api/doctors/{did}/slots", params={"date": monday})
    assert r.status_code == 200
    slots = r.json()
    assert slots[0] == {"start": "09:00", "end": "09:30", "available": True}
    assert slots[-1]["end"] == "13:00"
    assert all(x["available"] for x in slots)
    sunday = next_weekday(6)
    r = client.get(f"/api/doctors/{did}/slots", params={"date": sunday})
    assert r.status_code == 200
    assert r.json() == []


def test_slots_404_unknown_doctor(client, db):
    assert client.get("/api/doctors/9999/slots",
                      params={"date": next_weekday(0)}).status_code == 404


# ------------------------------------------------------------- appointments
def test_book_appointment_201(client, db):
    s = seed_roles(client, db)
    r = book(client, s["pat_h"], s["doctor"]["id"])
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["status"] == "requested"
    assert body["start_time"] == "09:00"
    assert body["end_time"] == "09:30"
    assert body["reason"] == "checkup"


def test_double_booking_409(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    assert book(client, s["pat_h"], s["doctor"]["id"], date_s=day).status_code == 201
    make_user(db, "Pat2", "pat2@x.io", "pat123", "patient")
    h2 = auth_header(client, "pat2@x.io", "pat123")
    r = book(client, h2, s["doctor"]["id"], date_s=day)
    assert r.status_code == 409


def test_booking_outside_schedule_400(client, db):
    s = seed_roles(client, db)
    r = book(client, s["pat_h"], s["doctor"]["id"],
             date_s=next_weekday(0), start="14:00")
    assert r.status_code == 400
    r = book(client, s["pat_h"], s["doctor"]["id"],
             date_s=next_weekday(6), start="09:00")
    assert r.status_code == 400


def test_booking_in_past_400(client, db):
    s = seed_roles(client, db)
    yesterday = (date.today() - timedelta(days=1)).isoformat()
    r = book(client, s["pat_h"], s["doctor"]["id"], date_s=yesterday)
    assert r.status_code == 400


def test_slot_marked_unavailable_after_booking(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    book(client, s["pat_h"], s["doctor"]["id"], date_s=day, start="09:00")
    r = client.get(f"/api/doctors/{s['doctor']['id']}/slots", params={"date": day})
    slot = next(x for x in r.json() if x["start"] == "09:00")
    assert slot["available"] is False
    other = next(x for x in r.json() if x["start"] == "09:30")
    assert other["available"] is True


def test_appointment_list_role_scoped(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    book(client, s["pat_h"], s["doctor"]["id"], date_s=day)
    # patient sees own
    r = client.get("/api/appointments", headers=s["pat_h"])
    assert len(r.json()) == 1
    # doctor sees own
    r = client.get("/api/appointments", headers=s["doc_h"])
    assert len(r.json()) == 1
    # another patient sees none
    make_user(db, "Pat2", "pat2@x.io", "pat123", "patient")
    h2 = auth_header(client, "pat2@x.io", "pat123")
    r = client.get("/api/appointments", headers=h2)
    assert r.json() == []
    # admin sees all
    r = client.get("/api/appointments", headers=s["admin_h"])
    assert len(r.json()) == 1
    # status + upcoming filters
    r = client.get("/api/appointments",
                   params={"status": "requested", "upcoming": "true"},
                   headers=s["admin_h"])
    assert len(r.json()) == 1


def test_patient_cancel_and_doctor_transitions(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    appt = book(client, s["pat_h"], s["doctor"]["id"], date_s=day).json()
    aid = appt["id"]
    # doctor confirms
    r = client.patch(f"/api/appointments/{aid}", json={"status": "confirmed"},
                     headers=s["doc_h"])
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"
    # patient cancels confirmed
    r = client.patch(f"/api/appointments/{aid}", json={"status": "cancelled"},
                     headers=s["pat_h"])
    assert r.status_code == 200
    assert r.json()["status"] == "cancelled"
    # doctor completes the full chain on a fresh appointment
    appt2 = book(client, s["pat_h"], s["doctor"]["id"],
                 date_s=day, start="10:00").json()
    aid2 = appt2["id"]
    assert client.patch(f"/api/appointments/{aid2}", json={"status": "confirmed"},
                        headers=s["doc_h"]).status_code == 200
    r = client.patch(f"/api/appointments/{aid2}", json={"status": "completed"},
                     headers=s["doc_h"])
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


def test_illegal_transitions_400_and_forbidden_403(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    appt = book(client, s["pat_h"], s["doctor"]["id"], date_s=day).json()
    aid = appt["id"]
    # patient may not confirm
    r = client.patch(f"/api/appointments/{aid}", json={"status": "confirmed"},
                     headers=s["pat_h"])
    assert r.status_code == 400
    # doctor may not cancel
    r = client.patch(f"/api/appointments/{aid}", json={"status": "cancelled"},
                     headers=s["doc_h"])
    assert r.status_code == 400
    # doctor may not complete a merely requested appointment
    r = client.patch(f"/api/appointments/{aid}", json={"status": "completed"},
                     headers=s["doc_h"])
    assert r.status_code == 400
    # other patient's appointment -> 403
    make_user(db, "Pat2", "pat2@x.io", "pat123", "patient")
    h2 = auth_header(client, "pat2@x.io", "pat123")
    r = client.patch(f"/api/appointments/{aid}", json={"status": "cancelled"},
                     headers=h2)
    assert r.status_code == 403
    # admin may set any status
    r = client.patch(f"/api/appointments/{aid}", json={"status": "completed"},
                     headers=s["admin_h"])
    assert r.status_code == 200
    assert r.json()["status"] == "completed"


def test_reschedule_ok_and_conflict_409(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    appt = book(client, s["pat_h"], s["doctor"]["id"], date_s=day,
                start="09:00").json()
    # move to a free slot
    r = client.post(f"/api/appointments/{appt['id']}/reschedule",
                    json={"date": day, "start_time": "09:30"}, headers=s["pat_h"])
    assert r.status_code == 200
    assert r.json()["start_time"] == "09:30"
    assert r.json()["end_time"] == "10:00"
    # another patient takes 09:00, then rescheduling back conflicts
    make_user(db, "Pat2", "pat2@x.io", "pat123", "patient")
    h2 = auth_header(client, "pat2@x.io", "pat123")
    assert book(client, h2, s["doctor"]["id"], date_s=day, start="09:00").status_code == 201
    r = client.post(f"/api/appointments/{appt['id']}/reschedule",
                    json={"date": day, "start_time": "09:00"}, headers=s["pat_h"])
    assert r.status_code == 409
    # rescheduling someone else's appointment -> 403
    r = client.post(f"/api/appointments/{appt['id']}/reschedule",
                    json={"date": day, "start_time": "10:00"}, headers=h2)
    assert r.status_code == 403


def test_rate_doctor_after_completed(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    appt = book(client, s["pat_h"], s["doctor"]["id"], date_s=day).json()
    # cannot rate before a completed appointment
    r = client.post(f"/api/doctors/{s['doctor']['id']}/rate", json={"rating": 5},
                    headers=s["pat_h"])
    assert r.status_code == 403
    client.patch(f"/api/appointments/{appt['id']}", json={"status": "confirmed"},
                 headers=s["doc_h"])
    client.patch(f"/api/appointments/{appt['id']}", json={"status": "completed"},
                 headers=s["doc_h"])
    r = client.post(f"/api/doctors/{s['doctor']['id']}/rate", json={"rating": 4},
                    headers=s["pat_h"])
    assert r.status_code == 200
    assert r.json() == {"rating": 4.0, "rating_count": 1}
    r = client.post(f"/api/doctors/{s['doctor']['id']}/rate", json={"rating": 5},
                    headers=s["pat_h"])
    assert r.json() == {"rating": 4.5, "rating_count": 2}


# ------------------------------------------------------------- visits
def _confirmed_appointment(client, db, s, day=None, start="09:00"):
    appt = book(client, s["pat_h"], s["doctor"]["id"],
                date_s=day or next_weekday(0), start=start).json()
    r = client.patch(f"/api/appointments/{appt['id']}",
                     json={"status": "confirmed"}, headers=s["doc_h"])
    assert r.status_code == 200
    return appt


def test_create_visit_marks_completed(client, db):
    s = seed_roles(client, db)
    appt = _confirmed_appointment(client, db, s)
    r = client.post("/api/visits", json={
        "appointment_id": appt["id"],
        "diagnosis_notes": "Mild viral fever",
        "prescription": [{"medicine": "Paracetamol", "dosage": "500 mg",
                          "frequency": "Twice daily", "duration_days": 3}],
        "advice": "Rest and fluids"}, headers=s["doc_h"])
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["prescription"][0]["medicine"] == "Paracetamol"
    # appointment is now completed
    r = client.get("/api/appointments", headers=s["pat_h"])
    assert r.json()[0]["status"] == "completed"


def test_visit_requires_confirmed_and_no_duplicate(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    appt = book(client, s["pat_h"], s["doctor"]["id"], date_s=day).json()
    # requested (not confirmed) -> 400
    r = client.post("/api/visits", json={"appointment_id": appt["id"],
                                         "prescription": []}, headers=s["doc_h"])
    assert r.status_code == 400
    appt = _confirmed_appointment(client, db, s, day=day, start="10:00")
    payload = {"appointment_id": appt["id"], "prescription": []}
    assert client.post("/api/visits", json=payload, headers=s["doc_h"]).status_code == 201
    # duplicate visit -> 400
    r = client.post("/api/visits", json=payload, headers=s["doc_h"])
    assert r.status_code == 400


def test_visit_forbidden_for_other_doctor(client, db):
    s = seed_roles(client, db)
    other = create_doctor_via_api(client, s["admin_h"], "other@x.io")
    other_h = auth_header(client, "other@x.io", "doctor123")
    appt = _confirmed_appointment(client, db, s)
    r = client.post("/api/visits",
                    json={"appointment_id": appt["id"], "prescription": []},
                    headers=other_h)
    assert r.status_code == 403
    assert other["id"] != s["doctor"]["id"]


def test_visit_history_and_summary(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    appt = _confirmed_appointment(client, db, s, day=day)
    r = client.post("/api/visits", json={
        "appointment_id": appt["id"], "diagnosis_notes": "All good",
        "prescription": [{"medicine": "Vitamin C", "dosage": "500 mg",
                          "frequency": "Once daily", "duration_days": 7}],
        "advice": "Exercise"}, headers=s["doc_h"])
    vid = r.json()["id"]
    r = client.get("/api/visits/me", headers=s["pat_h"])
    assert r.status_code == 200
    hist = r.json()
    assert len(hist) == 1
    assert hist[0]["appointment_date"] == day
    assert "doc" in hist[0]["doctor_name"].lower() or "Dr" in hist[0]["doctor_name"]
    # scoped read
    assert client.get(f"/api/visits/{vid}", headers=s["pat_h"]).status_code == 200
    assert client.get(f"/api/visits/{vid}", headers=s["doc_h"]).status_code == 200
    assert client.get(f"/api/visits/{vid}", headers=s["admin_h"]).status_code == 200
    make_user(db, "Pat2", "pat2@x.io", "pat123", "patient")
    h2 = auth_header(client, "pat2@x.io", "pat123")
    assert client.get(f"/api/visits/{vid}", headers=h2).status_code == 403
    # deterministic summary
    r = client.get(f"/api/visits/{vid}/summary", headers=s["pat_h"])
    assert r.status_code == 200
    summary = r.json()["summary"]
    assert "Pat" in summary and "Cardiology" in summary
    assert "1. Vitamin C — 500 mg, Once daily, for 7 days" in summary
    assert "All good" in summary and "Exercise" in summary


# ------------------------------------------------------------- admin
def test_admin_stats(client, db):
    s = seed_roles(client, db)
    day = next_weekday(0)
    book(client, s["pat_h"], s["doctor"]["id"], date_s=day)
    r = client.get("/api/admin/stats", headers=s["admin_h"])
    assert r.status_code == 200
    body = r.json()
    assert body["total_patients"] == 1
    assert body["total_doctors"] == 1
    assert body["appointments_today"] == 0
    assert body["appointments_total"] == 1
    assert body["by_status"] == {"requested": 1, "confirmed": 0,
                                 "completed": 0, "cancelled": 0}
    assert client.get("/api/admin/stats", headers=s["pat_h"]).status_code == 403


def test_admin_patients_deactivate(client, db):
    s = seed_roles(client, db)
    r = client.get("/api/admin/patients", params={"search": "pat"},
                   headers=s["admin_h"])
    assert r.status_code == 200
    patients = r.json()
    assert len(patients) == 1
    assert patients[0]["active"] is True
    pid = patients[0]["id"]
    r = client.patch(f"/api/admin/patients/{pid}", json={"active": False},
                     headers=s["admin_h"])
    assert r.status_code == 200
    assert r.json()["active"] is False
    # deactivated patient can no longer log in
    r = client.post("/api/auth/login", json={"email": "pat@x.io", "password": "pat123"})
    assert r.status_code == 401
    # admin cannot deactivate self
    me = client.get("/api/auth/me", headers=s["admin_h"]).json()
    r = client.patch(f"/api/admin/patients/{me['id']}", json={"active": False},
                     headers=s["admin_h"])
    assert r.status_code == 400


# ------------------------------------------------------------- health
def test_health(client, db):
    assert client.get("/api/health").json() == {"status": "ok"}


# --------------------------------- frontend-integration: aliases, joined fields
def test_status_verb_aliases_accepted(client, db):
    s = seed_roles(client, db)
    r = book(client, s["pat_h"], s["doctor"]["id"])
    aid = r.json()["id"]
    # patient cancels with verb "cancel" (frontend sends verbs)
    r = client.patch(f"/api/appointments/{aid}", json={"status": "cancel"},
                     headers=s["pat_h"])
    assert r.status_code == 200, r.text
    assert r.json()["status"] == "cancelled"
    assert r.json()["doctor_name"]  # joined field present


def test_idempotent_same_status_transition(client, db):
    s = seed_roles(client, db)
    r = book(client, s["pat_h"], s["doctor"]["id"])
    aid = r.json()["id"]
    client.patch(f"/api/appointments/{aid}", json={"status": "confirm"},
                 headers=s["doc_h"])
    # completing twice (visit auto-completes, then client PATCHes complete)
    r1 = client.patch(f"/api/appointments/{aid}", json={"status": "complete"},
                      headers=s["doc_h"])
    r2 = client.patch(f"/api/appointments/{aid}", json={"status": "complete"},
                      headers=s["doc_h"])
    assert r1.status_code == 200 and r2.status_code == 200
    assert r2.json()["status"] == "completed"


def test_appointment_list_has_joined_names(client, db):
    s = seed_roles(client, db)
    book(client, s["pat_h"], s["doctor"]["id"])
    r = client.get("/api/appointments", headers=s["pat_h"])
    assert r.status_code == 200
    appts = r.json()
    assert len(appts) >= 1
    assert appts[0]["doctor_name"] == "Doc" or appts[0]["doctor_name"]
    assert appts[0]["doctor_specialty"]
    assert appts[0]["patient_name"] == "Pat"


def test_invalid_status_still_rejected(client, db):
    s = seed_roles(client, db)
    r = book(client, s["pat_h"], s["doctor"]["id"])
    aid = r.json()["id"]
    r = client.patch(f"/api/appointments/{aid}", json={"status": "nope"},
                     headers=s["pat_h"])
    assert r.status_code == 400
