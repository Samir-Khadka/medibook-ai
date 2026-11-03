# MediBook AI — Frontend

AI-powered doctor appointment platform. React 18 + TypeScript + Vite, hand-rolled
light clinical-premium CSS (no UI framework), React Router 6.

## Setup

```bash
npm install            # or: npm install --ignore-scripts
cp .env.example .env   # optional; defaults to http://localhost:8000
npm run dev            # serves on http://localhost:5173
npm run build          # tsc + vite build → dist/
```

The API base URL is read from `VITE_API_URL` (build-time). Auth token is stored in
`localStorage` under `mb_token`.

## Pages

| Route            | Page                                   |
| ---------------- | -------------------------------------- |
| `/`              | Landing (hero, specialties, AI teaser) |
| `/login`         | Login                                  |
| `/register`      | Patient self-registration              |
| `/doctors`       | Search + specialty filter + doctor cards |
| `/doctors/:id`   | Profile, weekly schedule, slot booking |
| `/triage`        | AI symptom checker (3-step flow)       |
| `/dashboard`     | Patient: upcoming / past, reschedule, prescriptions, ratings |
| `/doctor`        | Doctor: today/upcoming schedule, confirm/complete, visit reports |
| `/admin`         | Admin: stats, doctors, patients, appointments |

## API contract assumptions

The backend (`../backend`) implements the contract in the project spec. Where the
contract was silent, the frontend assumes the following (flagged for backend
alignment):

1. **Appointment status values** — contract shows PATCH verbs `cancel`/`confirm`/`complete`;
   the client sends those verbs verbatim and normalizes read values
   (`cancelled`/`confirmed`/`completed`) to a canonical UI form.
2. **List endpoints return bare arrays** (`GET /api/doctors`, `/api/appointments`,
   `/api/admin/patients`, `/api/visits/me`), not `{items: [...]}` wrappers.
3. **Joined fields on appointments** (`doctor_name`, `doctor_specialty`,
   `patient_name`, `patient_email`) — optional; the UI falls back to ids.
4. **`appointment_id` and `date` on visit objects** — optional; used to link a past
   appointment to its prescription.
5. **Error shape** — `{detail: string}` (FastAPI style); 409 on slot conflict shows
   "slot just taken".
6. **Reschedule** `POST /api/appointments/{id}/reschedule` returns the updated appointment.
7. **Visit creation** — creating a visit does not auto-complete the appointment, so the
   client also sends PATCH `{status: "complete"}` (best-effort).
8. **Deactivating a doctor** is `PUT /api/doctors/{id}` with `{is_active: false}`.
9. **Triage clarifying answers** — no separate field in the contract, so selected
   clarifying questions are appended to `symptoms` as context on resubmit.
10. **IDs are strings**; **confidence** is 0–1 or 0–100 (normalized client-side);
    **fee currency** is displayed as `Rs.` (not in contract).
11. `GET /api/appointments?upcoming=true` is sent as the string `"true"`.

No mock layer is included — the client is strictly typed against the contract and
fails with a clear "could not reach the server" banner when the API is down.
