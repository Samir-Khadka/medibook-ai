# MediBook AI 🩺

An AI-powered doctor appointment platform — a complete rebuild of the old static
`Doctor-Appointment-Website` as a real full-stack app with an offline AI triage assistant.

**Stack:** FastAPI (Python 3.12) · React 18 + TypeScript + Vite · Postgres (SQLite for dev) · Docker Compose

## Features

**Patients**
- AI symptom checker — describe symptoms in plain English, get top-3 suggested specialties + urgency level + matched doctors with soonest slots
- Find doctors: search + specialty filter + smart-match ranking (soonest available slot, then rating)
- Book / cancel / reschedule appointments with real slot availability and conflict prevention
- Visit history with prescriptions and auto-generated visit summaries

**Doctors**
- Today's schedule, appointment details, confirm/complete flow
- Write visit reports + structured prescriptions (medicine, dosage, frequency, duration)

**Admins**
- Manage doctors (created by admin via `POST /api/doctors` — one call creates the login account + profile + weekly schedule; no doctor self-registration), patients, all appointments
- Stats dashboard

**AI features (all offline, zero API keys, zero cost)**
| Feature | How it works |
|---|---|
| Symptom triage (`POST /api/ai/triage`) | 69-entry symptom→specialty knowledge base (`backend/app/ai/symptoms.json`); keyword scoring → top-3 specialties + routine/soon/urgent |
| Smart doctor matching (`POST /api/ai/match`) | Ranks doctors by soonest free slot (14-day scan), then rating |
| Visit summary (`GET /api/visits/{id}/summary`) | Deterministic template from the visit record — no LLM |
| FAQ assistant (`POST /api/ai/faq`) | Rule-based answers over 16 clinic topics |

### AI guardrails (read this)
- The triage assistant is **informational only — never a medical diagnosis**. Every response carries that disclaimer; the word "diagnosis" never describes the output.
- **Emergency escalation is hard-coded:** chest pain, breathing difficulty, stroke signs, severe bleeding, etc. always return `urgency: "urgent"` + `emergency: true` with "Seek emergency care immediately."
- No patient data ever leaves the server for AI — everything runs locally in the backend.

## Quickstart

### One command (Docker)
```bash
cp .env.example .env   # set a long JWT_SECRET
docker compose up --build
# frontend → http://localhost:3000
# API      → http://localhost:8000  (docs at /docs)
docker compose exec backend python seed.py   # demo data
```

### Local dev
```bash
# backend
cd backend && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && python seed.py && uvicorn app.main:app --reload
# frontend
cd frontend && npm install && npm run dev   # → http://localhost:5173
```

### Demo logins (after seeding)
| Role | Email | Password |
|---|---|---|
| Admin | admin@medibook.ai | admin123 |
| Doctor | doctor@medibook.ai | doctor123 |
| Patient | patient@medibook.ai | patient123 |

Seed also creates 8 doctors across 7 specialties with Mon–Fri schedules.

## API overview

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` |
| Doctors | `GET /api/doctors` · `GET /api/doctors/{id}` · `GET /api/doctors/{id}/slots?date=` · `POST /api/doctors/{id}/rate` · admin `POST/PUT/DELETE /api/doctors` |
| Appointments | `POST /api/appointments` (409 on conflict) · `GET /api/appointments` · `PATCH /api/appointments/{id}` (accepts `cancel`/`confirm`/`complete` verbs) · `POST …/reschedule` |
| Visits | `POST /api/visits` (auto-completes appointment) · `GET /api/visits/me` · `GET /api/visits/{id}/summary` |
| AI | `POST /api/ai/triage` · `POST /api/ai/match` · `POST /api/ai/faq` |
| Admin | `GET /api/admin/stats` · `GET /api/admin/patients` |

Full interactive docs: run the backend and open `/docs`.

## Design notes
- Slots are generated from each doctor's weekly schedule minus appointments with status `requested`/`confirmed`.
- Auth: PBKDF2-SHA256 password hashing (stdlib) + JWT Bearer tokens.
- Frontend: hand-rolled CSS, light clinical-premium theme (white/ivory, teal accent, navy text) — no dark surfaces, no UI framework.

## Tests
```bash
cd backend && python -m pytest -q   # 63 tests
cd frontend && npm run build         # tsc + vite build
```

## Screenshots

> Screenshots coming soon — run it locally and try the AI triage flow.

## Project layout

```
medibook-ai/
├── backend/          # FastAPI: auth, doctors, appointments, visits, AI, admin
│   ├── app/          # routers, models, schemas, security, slots
│   ├── app/ai/       # triage.py, symptoms.json (69 entries), faq.py
│   ├── seed.py       # demo data
│   └── tests/        # pytest suite (SQLite)
├── frontend/         # React 18 + TS + Vite, hand-rolled clinical-premium CSS
│   └── src/pages/    # Landing, Triage, Doctors, dashboards, auth
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## License

MIT — demo project. Not a medical device; AI triage is informational only.
