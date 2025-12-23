import logging
import asyncio
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
import re
import hashlib

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlmodel import select, desc, func

from backend.config import get_settings
from backend.services.ingestion import IngestionSwitchboard, SourceEvent
from backend.agent import get_ai_decision
from backend.services.onchain import PayoutTransactor
from backend.services.ngo_manager import NGOManager
from backend.database import init_db, get_session, SentinelLog, SentinelEventDB

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()

# Initialize NGO Manager
ngo_manager = NGOManager()

LIVE_EVENT_CACHE: dict[str, dict] = {}
SOURCE_STATUS_CACHE: dict[str, dict] = {
    "gdacs": {"status": "unknown", "last_check": None, "events": 0},
    "eonet": {"status": "unknown", "last_check": None, "events": 0},
    "nws": {"status": "unknown", "last_check": None, "events": 0},
}
STARTUP_TIME = datetime.now(timezone.utc)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Universal Sentinel Backend Initialized")
    await init_db()
    # Start background polling (it will check mode internally)
    asyncio.create_task(background_poller())
    yield
    # Shutdown
    logger.info("Universal Sentinel Backend Shutdown")

async def background_poller():
    """Background task to poll data sources in LIVE mode."""
    global SOURCE_STATUS_CACHE
    while True:
        try:
            # Only run in LIVE mode
            if settings.sentinel_mode != "LIVE":
                await asyncio.sleep(60)
                continue
                
            logger.info("Running background poll...")
            switchboard = IngestionSwitchboard()
            result = switchboard.ingest()
            
            # Update source status cache from logs
            now = datetime.now(timezone.utc).isoformat()
            for log_text in result.logs:
                log_lower = log_text.lower()
                if "gdacs" in log_lower:
                    SOURCE_STATUS_CACHE["gdacs"] = {
                        "status": "ok" if "signal lost" not in log_lower else "error",
                        "last_check": now,
                        "message": log_text,
                        "events": sum(1 for e in result.events if e.source == "gdacs"),
                    }
                elif "eonet" in log_lower:
                    SOURCE_STATUS_CACHE["eonet"] = {
                        "status": "ok" if "signal lost" not in log_lower else "error",
                        "last_check": now,
                        "message": log_text,
                        "events": sum(1 for e in result.events if e.source == "eonet"),
                    }
                elif "nws" in log_lower:
                    SOURCE_STATUS_CACHE["nws"] = {
                        "status": "ok" if "signal lost" not in log_lower else "error",
                        "last_check": now,
                        "message": log_text,
                        "events": sum(1 for e in result.events if e.source == "nws"),
                    }
            
            # Only persist source status logs (not BACKGROUND DETECTED) to avoid spam
            async for session in get_session():
                 # Only add source status logs (GDACS/EONET/NWS), not background detections
                 for log_text in result.logs:
                     if any(x in log_text.lower() for x in ["gdacs", "eonet", "nws", "signal lost", "quiet", "no warnings", "alerts"]):
                         # Check if this exact log already exists in the last 5 minutes (dedupe)
                         five_min_ago = datetime.now(timezone.utc) - timedelta(minutes=5)
                         recent = await session.execute(
                             select(SentinelLog).where(
                                 SentinelLog.text == log_text,
                                 SentinelLog.timestamp >= five_min_ago
                             ).limit(1)
                         )
                         if not recent.scalars().first():
                             session.add(SentinelLog(text=log_text, status="ok"))
                 
                 # Don't add BACKGROUND DETECTED logs - they're too noisy
                 # Events are still cached in LIVE_EVENT_CACHE for UI
                 for event in result.events:
                     eid = _event_id(event)
                     LIVE_EVENT_CACHE[eid] = _event_out(event, eid)
                 
                 await session.commit()
                 
        except Exception as e:
            logger.error(f"Background poll failed: {e}")
        
        await asyncio.sleep(60) # Poll every minute

app = FastAPI(title="Universal Sentinel API", lifespan=lifespan)

# CORS - Allow specific origins for production and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://sentinel-sigma-five.vercel.app",
        "http://localhost:5173",  # Keep for local dev
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

class SimulationRequest(BaseModel):
    scenario_type: Optional[str] = None

class DecisionResponse(BaseModel):
    authorization: str  # "YES" or "NO"
    decision: str
    confidence_score: float
    reasoning: str
    payout_amount_usdc: str
    tx_hash: Optional[str] = None

class ProcessingResult(BaseModel):
    event: SourceEvent
    ai_decision: DecisionResponse
    status: str

class PolicyConfig(BaseModel):
    """Parametric policy configuration visible to users"""
    max_payout_usdc: int = 10000
    vault_balance_usdc: float = 10000
    triggers: dict = {
        "earthquake": {"min_magnitude": 6.5, "population_threshold": 50000},
        "fire": {"persistence_hours": 24, "thermal_anomaly": True},
        "storm": {"min_category": 3, "evacuation_order": True},
    }
    high_risk_zones: List[str] = ["Miami", "Tokyo", "Manila", "Houston", "New Orleans", "Tampa"]
    ai_confidence_threshold: int = 70

# Global policy (in production, this would be on-chain or in DB)
POLICY = PolicyConfig()

@app.get("/status")
async def get_status():
    async for session in get_session():
        # Get last 50 logs from DB
        result = await session.execute(select(SentinelLog).order_by(desc(SentinelLog.timestamp)).limit(50))
        logs = result.scalars().all()
        
        # Calculate balance from actual payouts in database
        payouts_result = await session.execute(
            select(SentinelEventDB).where(SentinelEventDB.payout_tx.isnot(None))
        )
        payouts = payouts_result.scalars().all()
        spent = sum(float(e.payout_amount or 0) for e in payouts)
        
        # Get last payout info for display
        last_payout_info = None
        if payouts:
            last_payout = max(payouts, key=lambda p: p.payout_timestamp or p.timestamp)
            last_payout_info = {
                "timestamp": (last_payout.payout_timestamp or last_payout.timestamp).isoformat(),
                "amount": last_payout.payout_amount,
                "ngo_name": last_payout.ngo_name,
                "ngo_address": last_payout.ngo_address,
            }
        
        return {
            "mode": settings.sentinel_mode,
            "processing": False, # Todo: track active processing in DB or mem
            "logs": [{"text": l.text, "status": l.status} for l in reversed(logs)],
            "vault_balance": max(0, 10000 - spent),
            "last_payout": last_payout_info,
        }

async def process_event_pipeline(event: SourceEvent):
    """
    Run the full pipeline: Observer -> Judge -> Vault
    Disaster Detection -> AI Authorization (YES/NO) -> NGO Selection -> Blockchain Payout
    """
    logger.info(f"Processing event: {event.description}")
    
    async for session in get_session():
        session.add(SentinelLog(text=f"STEP 1: DISASTER DETECTED - {event.description}", status="warn"))
        await session.commit()

    # 1. AI Decision (Judge)
    decision_data = get_ai_decision(event.disaster_type, event.raw, f"{event.location[0]}, {event.location[1]}")
    
    # Extract strict YES/NO authorization
    authorization = str(decision_data.get("authorization", "NO")).strip().upper()
    if authorization not in ("YES", "NO"):
        logger.warning(f"Invalid authorization '{authorization}', defaulting to NO")
        authorization = "NO"
    
    decision = DecisionResponse(
        authorization=authorization,
        decision=decision_data.get("decision", "DENY"),
        confidence_score=float(decision_data.get("confidence_score", 0)),
        reasoning=decision_data.get("reasoning", "No reasoning provided"),
        payout_amount_usdc=str(decision_data.get("payout_amount_usdc", "0"))
    )
    
    async for session in get_session():
        session.add(SentinelLog(
            text=f"STEP 2: AI AUTHORIZATION = {authorization} | Decision: {decision.decision} ({decision.confidence_score}% Confidence)", 
            status="ok" if authorization == "YES" else "fail"
        ))
        session.add(SentinelLog(
            text=f"AI REASONING: {decision.reasoning}", 
            status="ok"
        ))
        await session.commit()

    tx_hash = None
    ngo_selected = None
    
    # Only proceed if authorization is explicit YES
    if authorization == "YES" and decision.decision == "PAYOUT":
        # 2. Select NGO Recipient
        ngo_selected = ngo_manager.select_recipient(
            disaster_type=event.disaster_type,
            location=event.location,
            severity=event.severity
        )
        
        if not ngo_selected:
            async for session in get_session():
                session.add(SentinelLog(
                    text="STEP 3: NGO SELECTION FAILED - No verified NGO found for this disaster", 
                    status="fail"
                ))
                await session.commit()
            logger.error("No verified NGO found for disaster type: %s", event.disaster_type)
            return ProcessingResult(event=event, ai_decision=decision, status="failed_no_ngo")
        
        # 3. Validate NGO address
        is_valid, error_msg = ngo_manager.validate_address(ngo_selected.address)
        if not is_valid:
            async for session in get_session():
                session.add(SentinelLog(
                    text=f"STEP 3: ADDRESS VALIDATION FAILED - {error_msg}", 
                    status="fail"
                ))
                await session.commit()
            logger.error(f"Address validation failed: {error_msg}")
            return ProcessingResult(event=event, ai_decision=decision, status="failed_validation")
        
        async for session in get_session():
            session.add(SentinelLog(
                text=f"STEP 3: NGO SELECTED - {ngo_selected.name}", 
                status="ok"
            ))
            session.add(SentinelLog(
                text=f"NGO ADDRESS: {ngo_selected.address}", 
                status="ok"
            ))
            await session.commit()
        
        # 4. Execute Blockchain Transaction (Vault)
        try:
            async for session in get_session():
                session.add(SentinelLog(text="STEP 4: INITIATING BLOCKCHAIN TRANSACTION...", status="warn"))
                await session.commit()

            # In MOCK mode, use mock transaction hash for demo safety
            if settings.sentinel_mode == "MOCK":
                tx_hash = "0x" + "e" * 64  # Mock hash for demo
                async for session in get_session():
                    session.add(SentinelLog(
                        text="MOCK MODE: Transaction hash generated (not sent to blockchain)", 
                        status="warn"
                    ))
                    await session.commit()
            else:
                # LIVE mode: Execute real blockchain transaction if configured
                try:
                    # Check if blockchain is fully configured
                    blockchain_configured = (
                        settings.sentinel_private_key and
                        settings.rpc_url and
                        settings.contract_address and
                        settings.chain_id is not None
                    )
                    
                    if not blockchain_configured:
                        # Use mock transaction if blockchain not fully configured
                        tx_hash = "0x" + "e" * 64
                        async for session in get_session():
                            session.add(SentinelLog(
                                text="LIVE MODE: Blockchain not fully configured (missing RPC_URL, CONTRACT_ADDRESS, or CHAIN_ID), using mock transaction", 
                                status="warn"
                            ))
                            await session.commit()
                        logger.warning("Blockchain not fully configured, using mock transaction for safety")
                    else:
                        # Execute REAL blockchain transaction
                        async for session in get_session():
                            session.add(SentinelLog(
                                text="EXECUTING REAL BLOCKCHAIN TRANSACTION...", 
                                status="warn"
                            ))
                            await session.commit()
                        
                        transactor = PayoutTransactor(
                            rpc_url=settings.rpc_url,
                            contract_address=settings.contract_address,
                            chain_id=settings.chain_id
                        )
                        
                        # Convert USDC amount to units (assuming 6 decimals for USDC)
                        amount_units = int(float(decision.payout_amount_usdc) * 1e6)
                        
                        tx_hash = transactor.send_payout(
                            to_address=ngo_selected.address,
                            amount_units=amount_units,
                            reason=f"Disaster: {event.description[:100]}"  # Reason truncated for gas efficiency
                        )
                        
                        if not tx_hash:
                            raise ValueError("Transaction failed - no hash returned")
                        
                        async for session in get_session():
                            session.add(SentinelLog(
                                text=f"REAL BLOCKCHAIN TRANSACTION CONFIRMED: {tx_hash}", 
                                status="ok"
                            ))
                            await session.commit()
                        logger.info(f"Real blockchain transaction executed: {tx_hash}")
                        
                except Exception as tx_error:
                    logger.error(f"Blockchain transaction error: {tx_error}")
                    async for session in get_session():
                        session.add(SentinelLog(
                            text=f"BLOCKCHAIN TRANSACTION FAILED: {str(tx_error)}", 
                            status="fail"
                        ))
                        await session.commit()
                    return ProcessingResult(event=event, ai_decision=decision, status="failed_transaction")
            
            decision.tx_hash = tx_hash
            payout_timestamp = datetime.now(timezone.utc)
            
            async for session in get_session():
                # Enhanced logging with full NGO details
                session.add(SentinelLog(
                    text=f"STEP 5: PAYOUT COMPLETE - {decision.payout_amount_usdc} USDC", 
                    status="ok"
                ))
                session.add(SentinelLog(
                    text=f"NGO RECIPIENT: {ngo_selected.name} | Address: {ngo_selected.address}", 
                    status="ok"
                ))
                session.add(SentinelLog(
                    text=f"PAYOUT TIMESTAMP: {payout_timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')}", 
                    status="ok"
                ))
                session.add(SentinelLog(
                    text=f"TRANSACTION HASH: {tx_hash}", 
                    status="ok"
                ))
                
                # Save event to DB with full NGO information
                db_event = SentinelEventDB(
                    external_id=event.raw.get("id", "unknown"),
                    disaster_type=event.disaster_type,
                    description=event.description,
                    lat=event.location[0],
                    lon=event.location[1],
                    severity=event.severity,
                    processed=True,
                    payout_tx=tx_hash,
                    payout_amount=decision.payout_amount_usdc,
                    ai_confidence=int(decision.confidence_score),
                    ai_reasoning=decision.reasoning,
                    ngo_name=ngo_selected.name,
                    ngo_address=ngo_selected.address,
                    ngo_id=ngo_selected.id,
                    payout_timestamp=payout_timestamp
                )
                session.add(db_event)
                await session.commit()

        except Exception as e:
            logger.error(f"Payout error: {e}")
            async for session in get_session():
                 session.add(SentinelLog(text=f"PAYOUT FAILED: {str(e)}", status="fail"))
                 await session.commit()
            return ProcessingResult(event=event, ai_decision=decision, status="failed")

    else:
        async for session in get_session():
            session.add(SentinelLog(
                text=f"STEP 3: AUTHORIZATION DENIED - No payout (Authorization: {authorization})", 
                status="fail"
            ))
            await session.commit()

    return ProcessingResult(event=event, ai_decision=decision, status="completed")

_RE_SPACES = re.compile(r"\s+")

def _norm(s: str) -> str:
    return _RE_SPACES.sub(" ", (s or "").strip().lower())

def _trigger_bucket(disaster_type: str) -> str:
    """
    Map heterogeneous source types to a stable trigger bucket.
    This prevents UI trigger mismatch (e.g. 'volcano'/'wildfires' -> 'fire').
    """
    t = _norm(disaster_type)
    if any(k in t for k in ["earthquake", "quake", "eq", "seismic"]):
        return "quake"
    if any(k in t for k in ["wildfire", "wildfires", "fire", "volcano", "volcanoes", "thermal"]):
        return "fire"
    if any(k in t for k in ["hurricane", "cyclone", "typhoon", "storm", "tornado", "flood", "fl", "tsunami", "ts"]):
        return "storm"
    return "other"

def _event_id(event: SourceEvent) -> str:
    h = hashlib.sha1()
    h.update(_norm(event.source).encode())
    h.update(_norm(event.disaster_type).encode())
    h.update(_norm(event.description).encode())
    h.update(f"{event.location[0]:.4f},{event.location[1]:.4f}".encode())
    return h.hexdigest()[:16]

def _event_out(event: SourceEvent, eid: str) -> dict:
    return {
        "id": eid,
        "source": event.source,
        "disaster_type": event.disaster_type,
        "description": event.description,
        "location": [event.location[0], event.location[1]],
        "severity": event.severity,
        "raw": event.raw,
        "bucket": _trigger_bucket(event.disaster_type),
    }

class AnalyzeRequest(BaseModel):
    id: str
    source: str
    disaster_type: str
    description: str
    location: List[float]
    raw: dict
    severity: Optional[str] = None

@app.post("/simulate")
async def simulate(req: SimulationRequest, background_tasks: BackgroundTasks):
    async for session in get_session():
        session.add(SentinelLog(text="SYSTEM: STARTING SCAN SEQUENCE...", status="ok"))
        await session.commit()

    switchboard = IngestionSwitchboard()
    result = switchboard.ingest()
    
    # Filter
    events_to_process = result.events
    if req.scenario_type:
        want = _norm(req.scenario_type)
        # Support both stable buckets and raw source types
        events_to_process = [
            e for e in result.events
            if _trigger_bucket(e.disaster_type) == want or _norm(e.disaster_type) == want
        ]
        if not events_to_process:
             # Fallback
             if req.scenario_type == "quake":
                 events_to_process = [e for e in result.events if _trigger_bucket(e.disaster_type) == "quake"]
             elif req.scenario_type == "fire":
                 events_to_process = [e for e in result.events if _trigger_bucket(e.disaster_type) == "fire"]
             elif req.scenario_type == "storm":
                 events_to_process = [e for e in result.events if _trigger_bucket(e.disaster_type) == "storm"]

    # Log ingestion status
    async for session in get_session():
        for log in result.logs:
            session.add(SentinelLog(text=log, status="ok"))
        await session.commit()

    if not events_to_process:
        async for session in get_session():
            session.add(SentinelLog(text="SCAN COMPLETE: NO ACTIONABLE EVENTS", status="warn"))
            await session.commit()
        return {"message": "No events found", "events": []}

    results = []
    for event in events_to_process:
        res = await process_event_pipeline(event)
        results.append(res)
    
    return {"message": "Scan complete", "results": results}


@app.get("/live/ingest")
async def live_ingest():
    """
    LIVE war-room endpoint: returns current source statuses + actionable events.
    Frontend polls this to plot disasters in real time.
    """
    if settings.sentinel_mode != "LIVE":
        raise HTTPException(status_code=400, detail="Not in LIVE mode")

    switchboard = IngestionSwitchboard()
    result = switchboard.ingest()

    # persist logs
    async for session in get_session():
        for log in result.logs:
            session.add(SentinelLog(text=log, status="ok"))
        await session.commit()

    events_out: list[dict] = []
    for ev in result.events:
        eid = _event_id(ev)
        out = _event_out(ev, eid)
        LIVE_EVENT_CACHE[eid] = out
        events_out.append(out)

    return {"mode": result.mode, "logs": result.logs, "events": events_out}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    """
    Analyze a selected live event via Gemini + (optional) payout.
    Returns the same structure used by /simulate pipeline.
    """
    ev = SourceEvent(
        source=req.source,
        disaster_type=req.disaster_type,
        description=req.description,
        location=(req.location[0], req.location[1]),
        raw=req.raw,
        severity=req.severity,
    )
    res = await process_event_pipeline(ev)
    return {"result": res}


@app.get("/statistics")
async def get_statistics():
    """
    Get comprehensive statistics for the dashboard.
    """
    async for session in get_session():
        # Total events processed
        total_events = await session.execute(select(func.count(SentinelEventDB.id)))
        total_count = total_events.scalar() or 0
        
        # Total payouts (only events with payout_tx are actual payouts)
        payouts_result = await session.execute(
            select(SentinelEventDB).where(SentinelEventDB.payout_tx.isnot(None))
        )
        payout_list = payouts_result.scalars().all()
        total_payouts = len(payout_list)
        total_amount = sum(float(p.payout_amount or 0) for p in payout_list)
        
        # Last payout information
        last_payout = None
        if payout_list:
            # Get most recent payout by payout_timestamp or timestamp
            last_payout_event = max(
                payout_list,
                key=lambda p: p.payout_timestamp or p.timestamp
            )
            last_payout = {
                "timestamp": (last_payout_event.payout_timestamp or last_payout_event.timestamp).isoformat(),
                "amount": last_payout_event.payout_amount,
                "ngo_name": last_payout_event.ngo_name,
                "ngo_address": last_payout_event.ngo_address,
                "disaster_type": last_payout_event.disaster_type,
            }
        
        # Events by type
        events_by_type = {}
        all_events_result = await session.execute(select(SentinelEventDB))
        for event in all_events_result.scalars().all():
            t = _trigger_bucket(event.disaster_type)
            events_by_type[t] = events_by_type.get(t, 0) + 1
        
        # Uptime
        uptime_seconds = (datetime.now(timezone.utc) - STARTUP_TIME).total_seconds()
        
        # Calculate vault balance (starting balance - total disbursed)
        initial_vault_balance = 10000.0
        vault_balance = max(0.0, initial_vault_balance - total_amount)
        
        return {
            "total_events_processed": total_count,
            "total_payouts": total_payouts,
            "total_payout_amount": total_amount,
            "vault_balance": vault_balance,
            "initial_vault_balance": initial_vault_balance,
            "events_by_type": events_by_type,
            "uptime_seconds": uptime_seconds,
            "mode": settings.sentinel_mode,
            "last_updated": datetime.now(timezone.utc).isoformat(),
            "last_payout": last_payout,
        }


@app.get("/history")
async def get_history(limit: int = 20):
    """
    Get recent event history with AI decisions and payouts.
    """
    async for session in get_session():
        result = await session.execute(
            select(SentinelEventDB)
            .order_by(desc(SentinelEventDB.timestamp))
            .limit(limit)
        )
        events = result.scalars().all()
        
        return {
            "events": [
                {
                    "id": e.id,
                    "external_id": e.external_id,
                    "timestamp": e.timestamp.isoformat(),
                    "disaster_type": e.disaster_type,
                    "description": e.description,
                    "lat": e.lat,
                    "lon": e.lon,
                    "severity": e.severity,
                    "processed": e.processed,
                    "payout_tx": e.payout_tx,
                    "payout_amount": e.payout_amount,
                    "ai_confidence": e.ai_confidence,
                    "ai_reasoning": e.ai_reasoning,
                    "bucket": _trigger_bucket(e.disaster_type),
                    # NGO information for transparency
                    "ngo_name": e.ngo_name,
                    "ngo_address": e.ngo_address,
                    "ngo_id": e.ngo_id,
                    "payout_timestamp": e.payout_timestamp.isoformat() if e.payout_timestamp else None,
                }
                for e in events
            ]
        }


@app.get("/policy")
async def get_policy():
    """
    Get current parametric policy configuration.
    """
    async for session in get_session():
        payouts = await session.execute(
            select(SentinelEventDB).where(SentinelEventDB.payout_tx != None)
        )
        spent = sum(float(e.payout_amount or 0) for e in payouts.scalars().all())
        
        return {
            "max_payout_usdc": POLICY.max_payout_usdc,
            "vault_balance_usdc": max(0, POLICY.vault_balance_usdc - spent),
            "triggers": POLICY.triggers,
            "high_risk_zones": POLICY.high_risk_zones,
            "ai_confidence_threshold": POLICY.ai_confidence_threshold,
            "ai_model": "gemini-1.5-flash",
            "data_sources": ["GDACS", "NASA EONET", "NOAA NWS"],
        }


@app.get("/sources/status")
async def get_source_status():
    """
    Get real-time status of all data sources.
    """
    return {
        "sources": SOURCE_STATUS_CACHE,
        "mode": settings.sentinel_mode,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.post("/policy/update")
async def update_policy(
    max_payout: Optional[int] = None,
    confidence_threshold: Optional[int] = None,
):
    """
    Update policy parameters (demo-only, would be governance-controlled in prod).
    """
    global POLICY
    if max_payout is not None:
        POLICY.max_payout_usdc = max_payout
    if confidence_threshold is not None:
        POLICY.ai_confidence_threshold = confidence_threshold
    
    return {"status": "updated", "policy": POLICY.model_dump()}


class ModeToggleRequest(BaseModel):
    mode: str  # "LIVE" or "MOCK"


@app.post("/mode/toggle")
async def toggle_mode(req: ModeToggleRequest):
    """
    Toggle between LIVE and MOCK modes at runtime.
    Note: This is for demo purposes - in production, mode would be fixed.
    """
    from backend.config import Settings
    import os
    
    new_mode = req.mode.upper()
    if new_mode not in ("LIVE", "MOCK"):
        raise HTTPException(status_code=400, detail="Mode must be LIVE or MOCK")
    
    # Update the settings singleton
    global settings
    # We need to recreate settings with new mode
    os.environ["SENTINEL_MODE"] = new_mode
    
    # Clear the lru_cache to reload settings
    from backend.config import get_settings
    get_settings.cache_clear()
    settings = get_settings()
    
    logger.info(f"Mode toggled to: {new_mode}")
    
    return {
        "status": "success",
        "mode": settings.sentinel_mode,
        "message": f"Switched to {new_mode} mode"
    }


@app.get("/mode")
async def get_mode():
    """Get current mode."""
    return {"mode": settings.sentinel_mode}


@app.get("/ngos")
async def list_ngos():
    """
    List all verified NGOs.
    """
    ngos = ngo_manager.list_all_verified()
    return {
        "ngos": [
            {
                "id": ngo.id,
                "name": ngo.name,
                "address": ngo.address,
                "disaster_types": ngo.disaster_types,
                "regions": ngo.regions,
                "description": ngo.description,
            }
            for ngo in ngos
        ],
        "total": len(ngos),
    }


class EligibleNGOsRequest(BaseModel):
    disaster_type: str
    location: List[float]
    severity: Optional[str] = None


@app.post("/ngos/eligible")
async def get_eligible_ngos(req: EligibleNGOsRequest):
    """
    Get all eligible NGOs for a specific disaster.
    Used by LIVE mode pop-up to show potential recipients.
    """
    lat, lon = req.location[0], req.location[1]
    disaster_type = req.disaster_type
    
    # Get all verified NGOs
    all_ngos = ngo_manager.list_all_verified()
    
    # Filter by disaster type support
    eligible = []
    for ngo in all_ngos:
        disaster_lower = disaster_type.lower()
        supports_type = any(
            dt.lower() in disaster_lower or disaster_lower in dt.lower()
            for dt in ngo.disaster_types
        )
        
        if supports_type:
            # Determine if region matches (using internal helper)
            # Simple region mapping
            if 10 <= lat <= 50 and 100 <= lon <= 150:
                region = "asia"
            elif 25 <= lat <= 50 and -130 <= lon <= -65:
                region = "north_america"
            elif 25 <= lat <= 50 and -100 <= lon <= -70:
                region = "us"
            elif -50 <= lat <= 50 and -180 <= lon <= 180:
                region = "pacific"
            else:
                region = "global"
            region_match = region in ngo.regions or "global" in ngo.regions
            
            eligible.append({
                "id": ngo.id,
                "name": ngo.name,
                "address": ngo.address,
                "disaster_types": ngo.disaster_types,
                "regions": ngo.regions,
                "description": ngo.description,
                "region_match": region_match,
                "is_ingo": "international" in ngo.name.lower() or "global" in ngo.regions,
            })
    
    # Select the one that would be chosen (for transparency)
    selected = ngo_manager.select_recipient(
        disaster_type=disaster_type,
        location=(lat, lon),
        severity=req.severity
    )
    
    return {
        "eligible": eligible,
        "selected": {
            "id": selected.id,
            "name": selected.name,
            "address": selected.address,
            "reason": f"Selected based on region match and disaster type support"
        } if selected else None,
        "total_eligible": len(eligible),
    }
