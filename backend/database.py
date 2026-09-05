from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./moodmate.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def create_tables() -> None:
    """Create all database tables required by the backend.

    Imports the ORM models before creating metadata so SQLAlchemy knows
    every table definition. This operation is safe to run on every startup.
    """

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """Provide one SQLAlchemy session to a request.

    Opens a session for the dependency-injected endpoint call.
    Always closes the session after the response or an exception.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
