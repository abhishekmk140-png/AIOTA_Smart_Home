import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import Room, Activity
from ..schemas import RoomCreate, RoomOut, RoomToggleAll
from ..services.events import hub
from ..services.mqtt import publish_relay, publish_relay_all
from ..services.http_transport import send_http_relay, send_http_relay_all

router = APIRouter(prefix="/api/rooms", tags=["rooms"])

@router.get("", response_model=list[RoomOut])
async def list_rooms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).options(selectinload(Room.devices)).order_by(Room.id))
    return result.scalars().unique().all()

@router.post("", response_model=RoomOut, status_code=201)
async def create_room(payload: RoomCreate, db: AsyncSession = Depends(get_db)):
    room = Room(name=payload.name.strip())
    db.add(room)
    try:
        await db.commit()
        await db.refresh(room)
    except Exception:
        await db.rollback()
        raise HTTPException(409, "A room with this name may already exist")
    return room

@router.delete("/{room_id}", status_code=204)
async def delete_room(room_id: int, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(404, "Room not found")
    await db.delete(room)
    await db.commit()

@router.post("/{room_id}/toggle-all", response_model=RoomOut)
async def toggle_all_devices(room_id: int, payload: RoomToggleAll, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Room).options(selectinload(Room.devices)).where(Room.id == room_id))
    room = result.scalars().first()
    if not room:
        raise HTTPException(404, "Room not found")
    
    target_ip = room.devices[0].ip_address if room.devices else None
    node_id = room.devices[0].node_id if room.devices else "aiota-living"
    channels = []

    for device in room.devices:
        device.is_on = payload.is_on
        channels.append(device.channel)
        await hub.publish({"type": "relay", "device_id": device.id, "is_on": device.is_on})

    # Master batch dispatch to hardware (single batch packet or persistent keep-alive, zero socket drop)
    send_http_relay_all(target_ip, payload.is_on, channels)
    publish_relay_all(node_id, payload.is_on)

    state_str = "ON" if payload.is_on else "OFF"
    db.add(Activity(message=f"All devices in {room.name} turned {state_str}", category="room"))
    await db.commit()
    await db.refresh(room)
    return room
