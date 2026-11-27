import os
from sqlalchemy import create_engine
from sqlalchemy.engine import URL
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


# Resolve database URL
if settings.DATABASE_URL:
    db_url_str = settings.DATABASE_URL.strip()
    if db_url_str.startswith("postgres://"):
        db_url_str = "postgresql+psycopg://" + db_url_str[len("postgres://"):]
    elif db_url_str.startswith("postgresql://"):
        db_url_str = "postgresql+psycopg://" + db_url_str[len("postgresql://"):]
elif settings.DB_USER and settings.DB_PASSWORD and settings.DB_NAME:
    db_url_str = str(
        URL.create(
            drivername="postgresql+psycopg",
            username=settings.DB_USER,
            password=settings.DB_PASSWORD,
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            database=settings.DB_NAME,
        )
    )
elif os.getenv("VERCEL"):
    db_url_str = "sqlite:////tmp/ls_interiors.db"
else:
    db_url_str = "sqlite:///./ls_interiors.db"

is_sqlite = db_url_str.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

# Create the database engine
engine = create_engine(
    db_url_str,
    pool_pre_ping=not is_sqlite and not os.getenv("VERCEL"),
    connect_args=connect_args,
)

# Export database_url for Alembic and other tools
database_url = engine.url

# Create database sessions
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)
