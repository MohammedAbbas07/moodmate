from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from auth import create_access_token, hash_password, verify_password, verify_token
from database import create_tables, get_db
from models import SavedItem, User

app = FastAPI(
    title="MoodMate API",
    description="Authentication and saved-item API for MoodMate.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)


class AuthRequest(BaseModel):
    """Validate the email and password sent to auth endpoints."""

    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1)


class AuthResponse(BaseModel):
    """Define the common response returned after authentication."""

    user_id: int
    token: str
    message: str


class ProfileResponse(BaseModel):
    """Serialize the authenticated user's public profile."""

    user_id: int
    email: str
    created_at: datetime


class SavedItemRequest(BaseModel):
    """Validate a catalog item identifier submitted for saving."""

    item_id: str = Field(min_length=1, max_length=255)


class SavedItemResponse(BaseModel):
    """Serialize one saved catalog item for API responses."""

    id: int
    item_id: str
    saved_at: datetime


class SavedItemsResponse(BaseModel):
    """Wrap the authenticated user's saved-item collection."""

    saved_items: list[SavedItemResponse]


class MessageResponse(BaseModel):
    """Represent simple success messages returned by mutation endpoints."""

    message: str


@app.on_event("startup")
def initialize_database() -> None:
    """Create SQLite tables before the first request.

    The metadata is built from the imported ORM models.
    SQLite's file is created automatically when the engine connects.
    """
    create_tables()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> int:
    """Extract and validate the user ID from a bearer header.

    Protected routes depend on this function before accessing user data.
    Missing, malformed, expired, and invalid tokens all become HTTP 401 errors.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing authorization token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return verify_token(credentials.credentials)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def normalize_email(email: str) -> str:
    """Normalize email input before lookup and persistence.

    Trimming prevents accidental whitespace from creating duplicate accounts.
    Lowercasing makes authentication behavior consistent for email addresses.
    """
    return email.strip().lower()


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: AuthRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Register a new user and return a seven-day access token.

    Rejects short passwords and duplicate email addresses before insertion.
    Rolls back failed database transactions so the session remains usable.
    """
    email = normalize_email(payload.email)
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="A valid email is required")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    try:
        if db.query(User).filter(User.email == email).first() is not None:
            raise HTTPException(status_code=400, detail="Email already exists")

        user = User(email=email, password_hash=hash_password(payload.password))
        db.add(user)
        db.commit()
        db.refresh(user)
        return AuthResponse(
            user_id=user.id,
            token=create_access_token(user.id),
            message="Signup successful",
        )
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Email already exists") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error") from exc


@app.post("/api/auth/login", response_model=AuthResponse)
def login(payload: AuthRequest, db: Session = Depends(get_db)) -> AuthResponse:
    """Authenticate an existing user and return a seven-day access token.

    Email lookup and password verification happen entirely on the backend.
    Unknown users and incorrect passwords intentionally share one 401 response.
    """
    email = normalize_email(payload.email)

    try:
        user = db.query(User).filter(User.email == email).first()
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid credentials")
        return AuthResponse(
            user_id=user.id,
            token=create_access_token(user.id),
            message="Login successful",
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error") from exc


@app.post("/api/auth/logout", response_model=MessageResponse)
def logout(user_id: int = Depends(get_current_user_id)) -> MessageResponse:
    """Validate the current token and acknowledge logout.

    JWTs are stateless, so this endpoint does not need a database mutation.
    The frontend should discard the token after receiving this response.
    """
    _ = user_id
    return MessageResponse(message="Logout successful")


@app.get("/api/user/profile", response_model=ProfileResponse)
def get_profile(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> ProfileResponse:
    """Return the profile belonging to the authenticated token subject.

    The token is validated before the user is queried.
    A valid token for a deleted user is treated as unauthorized.
    """
    try:
        user = db.get(User, user_id)
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return ProfileResponse(user_id=user.id, email=user.email, created_at=user.created_at)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error") from exc


@app.post("/api/user/saved-items", response_model=dict, status_code=status.HTTP_201_CREATED)
def save_item(
    payload: SavedItemRequest,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Save one catalog item for the authenticated user.

    Duplicate user/item pairs return HTTP 409 instead of creating duplicates.
    Database failures are rolled back before an error response is returned.
    """
    try:
        if db.get(User, user_id) is None:
            raise HTTPException(status_code=401, detail="User not found")
        existing = (
            db.query(SavedItem)
            .filter(SavedItem.user_id == user_id, SavedItem.item_id == payload.item_id)
            .first()
        )
        if existing is not None:
            raise HTTPException(status_code=409, detail="Item already saved")

        saved_item = SavedItem(user_id=user_id, item_id=payload.item_id)
        db.add(saved_item)
        db.commit()
        return {"message": "Item saved", "item_id": payload.item_id}
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="Item already saved") from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error") from exc


@app.get("/api/user/saved-items", response_model=SavedItemsResponse)
def list_saved_items(
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> SavedItemsResponse:
    """List all saved items belonging to the authenticated user.

    Results are ordered newest first for predictable watchlist presentation.
    Only item IDs and persistence metadata are returned by this endpoint.
    """
    try:
        saved_items = (
            db.query(SavedItem)
            .filter(SavedItem.user_id == user_id)
            .order_by(SavedItem.saved_at.desc())
            .all()
        )
        return SavedItemsResponse(
            saved_items=[
                SavedItemResponse(id=item.id, item_id=item.item_id, saved_at=item.saved_at)
                for item in saved_items
            ]
        )
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=500, detail="Database error") from exc


@app.delete("/api/user/saved-items/{item_id}", response_model=MessageResponse)
def delete_saved_item(
    item_id: str,
    user_id: int = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> MessageResponse:
    """Delete one saved item owned by the authenticated user.

    The item ID is scoped by user ID so users cannot remove another user's item.
    Missing records return HTTP 404 and successful deletion is committed.
    """
    try:
        saved_item = (
            db.query(SavedItem)
            .filter(SavedItem.user_id == user_id, SavedItem.item_id == item_id)
            .first()
        )
        if saved_item is None:
            raise HTTPException(status_code=404, detail="Item not found")
        db.delete(saved_item)
        db.commit()
        return MessageResponse(message="Item removed")
    except HTTPException:
        db.rollback()
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail="Database error") from exc
