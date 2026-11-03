"""Authentication endpoints: register, login, me."""
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .. import models, schemas
from ..deps import get_current_user, get_db
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.TokenOut,
             status_code=status.HTTP_201_CREATED)
def register(data: schemas.RegisterIn, db: Session = Depends(get_db)):
    """Self-registration always creates a 'patient' account."""
    email = data.email.strip().lower()
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Email already registered")
    user = models.User(name=data.name.strip(), email=email,
                       password_hash=hash_password(data.password), role="patient")
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id, user.role),
            "token_type": "bearer", "user": user}


@router.post("/login", response_model=schemas.TokenOut)
async def login(request: Request, db: Session = Depends(get_db)):
    """Accepts JSON {email, password} or an OAuth2 password form."""
    email = password = None
    ctype = request.headers.get("content-type", "")
    if "application/json" in ctype:
        try:
            body = await request.json()
        except Exception:
            body = {}
        email = body.get("email")
        password = body.get("password")
    else:
        form = await request.form()
        email = form.get("username") or form.get("email")
        password = form.get("password")
    if not email or not password:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid email or password")
    user = db.query(models.User).filter(
        models.User.email == str(email).strip().lower()).first()
    if (not user or not user.is_active
            or not verify_password(str(password), user.password_hash)):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid email or password")
    return {"access_token": create_access_token(user.id, user.role),
            "token_type": "bearer", "user": user}


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return user
