from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import Device, Room, Telemetry
from ..schemas import NodeStatus
from ..services.node_tracker import node_tracker

router = APIRouter(prefix="/api/nodes", tags=["nodes"])

ROOM_CONFIGS = {
    "THE GALLERY": {"node_id": "dev_a0a94ebae634", "delta": -0.3, "hum_delta": 1.0},
    "ENGINEERING HUB": {"node_id": "dev_f1babe801e17", "delta": 0.5, "hum_delta": -2.0},
    "CONFERENCE": {"node_id": "dev_baa26b76b453", "delta": 0.0, "hum_delta": 0.0},
}

@router.get("", response_model=list[NodeStatus])
async def list_nodes(db: AsyncSession = Depends(get_db)):
    room_res = await db.execute(select(Room))
    rooms = room_res.scalars().all()

    # Get latest physical telemetry
    t_res = await db.execute(select(Telemetry).order_by(Telemetry.recorded_at.desc()).limit(1))
    latest_t = t_res.scalars().first()
    base_temp = latest_t.temperature if (latest_t and latest_t.temperature is not None) else 27.5
    base_hum = latest_t.humidity if (latest_t and latest_t.humidity is not None) else 58.0
    base_motion = bool(latest_t.motion) if latest_t else False

    results = []
    for room in rooms:
        cfg = ROOM_CONFIGS.get(room.name, {"node_id": f"dev_room_{room.id}", "delta": 0.0, "hum_delta": 0.0})
        nid = cfg["node_id"]
        tracker_info = node_tracker.get_info(nid)
        live_tracker_ip = tracker_info.get("ip_address")

        dev_res = await db.execute(select(Device).where(Device.room_id == room.id))
        devs = dev_res.scalars().all()
        active_count = sum(1 for d in devs if d.is_on)
        ip_addr = live_tracker_ip or (devs[0].ip_address if devs and devs[0].ip_address else "192.168.1.8")

        results.append(NodeStatus(
            node_id=nid,
            name=f"ESP32-S3 ({room.name})",
            room_name=room.name,
            online=True,
            last_seen=tracker_info.get("last_seen"),
            ip_address=ip_addr,
            relay_count=len(devs),
            active_relays=active_count,
            temperature=round(base_temp + cfg["delta"], 1),
            humidity=round(base_hum + cfg["hum_delta"], 1),
            motion=base_motion,
        ))

    return results
