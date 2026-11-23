from fastapi import APIRouter, Depends, Request
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import Telemetry, Activity, Device
from ..schemas import TelemetryIn, TelemetryOut, ActivityOut
from ..services.events import hub
from ..services.node_tracker import node_tracker
from ..services.automation_engine import evaluate_rules_for_telemetry

router = APIRouter(prefix="/api", tags=["telemetry"])

@router.post("/telemetry", response_model=TelemetryOut, status_code=201)
async def ingest_telemetry(payload: TelemetryIn, request: Request, db: AsyncSession = Depends(get_db)):
    item = Telemetry(**payload.model_dump())
    db.add(item)
    
    client_ip = request.client.host if request.client else None

    # Automatically bind physical ESP32 IP to relay devices for this node
    if client_ip and client_ip not in ("127.0.0.1", "localhost", "::1"):
        await db.execute(
            update(Device)
            .where(Device.node_id == payload.node_id)
            .values(ip_address=client_ip)
        )

    # Track node heartbeat
    node_tracker.record_heartbeat(
        payload.node_id,
        ip_address=client_ip,
        telemetry_data=payload.model_dump()
    )

    # Motion event notification
    if payload.motion:
        db.add(Activity(message=f"Motion detected by node {payload.node_id}", category="security"))

    await db.commit()
    await db.refresh(item)

    # Broadcast via WebSocket
    await hub.publish({
        "type": "telemetry",
        "node_id": item.node_id,
        "temperature": item.temperature,
        "humidity": item.humidity,
        "air_quality": item.air_quality,
        "energy_kwh": item.energy_kwh,
        "motion": item.motion,
        "recorded_at": item.recorded_at.isoformat()
    })

    # Do not auto-evaluate rules on raw telemetry to prevent unwanted relay toggling
    return item

@router.get("/telemetry", response_model=list[TelemetryOut])
async def list_telemetry(limit: int = 100, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Telemetry).order_by(Telemetry.recorded_at.desc()).limit(min(limit, 1000)))
    return list(reversed(result.scalars().all()))

@router.get("/activities", response_model=list[ActivityOut])
async def list_activities(limit: int = 30, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity).order_by(Activity.created_at.desc()).limit(min(limit, 100)))
    return result.scalars().all()
