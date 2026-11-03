"""MediBook AI — FastAPI application entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import admin, ai, appointments, auth, doctors, health, visits

Base.metadata.create_all(bind=engine)

app = FastAPI(title="MediBook AI", version="1.0.0",
              description="AI-powered doctor appointment platform")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(visits.router)
app.include_router(ai.router)
app.include_router(admin.router)


def run():
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
