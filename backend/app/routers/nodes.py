from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import Device, Room, Telemetry
from ..schemas import NodeStatus
from ..services.node_tracker import node_tracker

router = APIRouter(prefix="/api/nodes", tags=["nodes"])

@router.get("", response_model=list[NodeStatus])
async def list_nodes(db: AsyncSession = Depends(get_db)):
    # Group devices by node_id
    dev_result = await db.execute(select(Device, Room).join(Room, Device.room_id == Room.id))
    rows = dev_result.all()
    
    node_map: dict[str, dict] = {}
    for device, room in rows:
        nid = device.node_id
        if nid not in node_map:
            tracker_info = node_tracker.get_info(nid)
            node_map[nid] = {
                "node_id": nid,
                "name": f"ESP32-S3 ({nid})",
                "room_name": room.name,
                "online": tracker_info["online"],
                "last_seen": tracker_info["last_seen"],
                "ip_address": tracker_info["ip_address"] or device.ip_address,
                "relay_count": 0,
                "active_relays": 0,
                "temperature": None,
                "humidity": None,
                "motion": None,
            }
        node_map[nid]["relay_count"] += 1
        if device.is_on:
            node_map[nid]["active_relays"] += 1

    # Fetch latest telemetry per node
    for nid, node_info in node_map.items():
        t_res = await db.execute(
            select(Telemetry)
            .where(Telemetry.node_id == nid)
            .order_by(Telemetry.recorded_at.desc())
            .limit(1)
        )
        latest_t = t_res.scalars().first()
        if latest_t:
            node_info["temperature"] = latest_t.temperature
            node_info["humidity"] = latest_t.humidity
            node_info["motion"] = latest_t.motion

    return list(node_map.values())
