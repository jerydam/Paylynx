# database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

# Supabase connection string (get this from Supabase dashboard → Settings → Database → Connection string)
# Format: postgresql+asyncpg://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL not set in .env")

# For async (recommended with FastAPI)
engine = create_async_engine(
    DATABASE_URL,
    echo=False,               # set to True for debugging SQL
    future=True,
    pool_pre_ping=True        # helps with connection health
)

# For sync (if you prefer non-async routes)
# sync_engine = create_engine(DATABASE_URL.replace("asyncpg", "psycopg2"))

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession
)

Base = declarative_base()

# Dependency for async routes
async def get_db():
    async with SessionLocal() as session:
        yield session

# Create tables (run once, or use Alembic for migrations)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Call this on startup (see main app below)