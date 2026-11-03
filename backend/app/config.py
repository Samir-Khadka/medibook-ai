"""Runtime configuration from environment variables."""
import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./medibook.db")
JWT_SECRET: str = os.getenv("JWT_SECRET", "dev-secret-change-me")
JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "60"))
