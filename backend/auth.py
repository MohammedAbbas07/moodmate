import os
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv
from passlib.context import CryptContext

load_dotenv()

SECRET_KEY = os.getenv("MOODMATE_SECRET_KEY", "change-this-development-secret")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 7
password_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plain-text password with bcrypt.

    Passwords are never stored directly in the database.
    Passlib manages the salt and work factor for each hash.
    """
    return password_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Compare a submitted password with its stored bcrypt hash.

    The comparison is performed by Passlib using a timing-safe verifier.
    Invalid hashes return False instead of exposing internal errors.
    """
    try:
        return password_context.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


def create_access_token(user_id: int) -> str:
    """Create a signed bearer token for a user.

    The token stores the user ID in the subject claim.
    It expires seven days after creation and uses the configured secret key.
    """
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> int:
    """Validate a bearer token and return its user ID.

    Signature and expiration are checked by PyJWT.
    Malformed, expired, or missing subject claims raise ValueError.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise ValueError("Token subject is missing")
        return int(user_id)
    except (jwt.InvalidTokenError, TypeError, ValueError) as exc:
        raise ValueError("Invalid token") from exc
