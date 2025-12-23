from typing import Optional, List
from datetime import datetime
from sqlmodel import Field, SQLModel, create_engine, Session, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Database Models
class SentinelLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    text: str
    status: str = "ok" # "ok", "warn", "fail"
    source: Optional[str] = None

class SentinelEventDB(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    external_id: str = Field(index=True) # e.g., "quake-123"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    disaster_type: str
    description: str
    lat: float
    lon: float
    severity: Optional[str] = None
    processed: bool = False
    payout_tx: Optional[str] = None
    payout_amount: Optional[str] = None
    ai_confidence: Optional[int] = None
    ai_reasoning: Optional[str] = None
    # NGO information for transparency
    ngo_name: Optional[str] = None
    ngo_address: Optional[str] = None
    ngo_id: Optional[str] = None
    payout_timestamp: Optional[datetime] = None

# Async Engine
sqlite_file_name = "sentinel.db"
sqlite_url = f"sqlite+aiosqlite:///{sqlite_file_name}"

engine = create_async_engine(sqlite_url, echo=False)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)

async def get_session() -> AsyncSession:
    async_session = sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    async with async_session() as session:
        yield session
