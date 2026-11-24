import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import get_db
from ..models import Device, Activity
from ..schemas import DeviceCreate, DeviceOut, RelayCommand, DeviceNetworkUpdate, DeviceUpdate
from ..services.events import hub
from ..services.mqtt import publish_relay
from ..services.http_transport import send_http_relay, probe_esp32_hardware
from ..config import settings

class BoardIpPayload(BaseModel):
    ip_address: str
    node_id: str | None = None

class BoardPingPayload(BaseModel):
    ip_address: str

router = APIRouter(prefix="/api/devices", tags=["devices"])

@router.get("", response_model=list[DeviceOut])
async def list_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device).order_by(Device.room_id, Device.channel))
    return result.scalars().all()

@router.post("", response_model=DeviceOut, status_code=201)
async def create_device(payload: DeviceCreate, db: AsyncSession = Depends(get_db)):
    device = Device(**payload.model_dump())
    db.add(device)
    await db.commit()
    await db.refresh(device)
    return device

@router.patch("/{device_id}/relay", response_model=DeviceOut)
async def set_relay(device_id: int, payload: RelayCommand, db: AsyncSession = Depends(get_db)):
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(404, "Device not found")

    norm_name = device.name.strip().lower()

    # Query all appliances sharing the same channel or name in this particular room node
    query = select(Device).where(
        or_(
            Device.channel == device.channel,
            func.lower(func.trim(Device.name)) == norm_name
        ),
        Device.node_id == device.node_id
    )
    if device.room_id is not None:
        query = query.where(Device.room_id == device.room_id)
    else:
        query = query.where(Device.room_id.is_(None))

    result = await db.execute(query)
    peers = result.scalars().all()
    if not peers:
        peers = [device]

    dispatched_channels = set()
    for peer in peers:
        peer.is_on = payload.is_on
        # Broadcast state over WebSocket so all matching UI switches update in sync
        await hub.publish({"type": "relay", "device_id": peer.id, "is_on": peer.is_on})
        
        # Dispatch physical transport to ESP32 (prevent duplicate commands if multiple aliases share a channel)
        if peer.channel not in dispatched_channels:
            dispatched_channels.add(peer.channel)
            if peer.ip_address:
                send_http_relay(peer.ip_address, peer.channel, payload.is_on)
            publish_relay(peer.node_id, peer.channel, payload.is_on)

    ch_summary = ", ".join(f"CH{c}" for c in sorted(dispatched_channels))
    db.add(Activity(
        message=f"{device.name} ({ch_summary}) switched {'ON' if payload.is_on else 'OFF'}",
        category="device"
    ))
    await db.commit()
    await db.refresh(device)
    return device

@router.delete("/{device_id}", status_code=204)
async def delete_device(device_id: int, db: AsyncSession = Depends(get_db)):
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(404, "Device not found")
    await db.delete(device)
    await db.commit()

@router.patch("/{device_id}", response_model=DeviceOut)
async def update_device(device_id: int, payload: DeviceUpdate, db: AsyncSession = Depends(get_db)):
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(404, "Device not found")
    data = payload.model_dump(exclude_unset=True)
    for field, val in data.items():
        if val is not None:
            setattr(device, field, val)
    db.add(Activity(message=f"Device {device.name} updated", category="device"))
    await db.commit()
    await db.refresh(device)
    return device

@router.patch("/{device_id}/network", response_model=DeviceOut)
async def update_device_network(device_id: int, payload: DeviceNetworkUpdate, db: AsyncSession = Depends(get_db)):
    device = await db.get(Device, device_id)
    if not device:
        raise HTTPException(404, "Device not found")
    device.ip_address = payload.ip_address
    await db.commit()
    await db.refresh(device)
    return device

@router.post("/set-board-ip")
async def set_board_ip(payload: BoardIpPayload, db: AsyncSession = Depends(get_db)):
    clean_ip = payload.ip_address.replace("http://", "").replace("https://", "").rstrip("/")
    stmt = update(Device)
    if payload.node_id:
        stmt = stmt.where(Device.node_id == payload.node_id)
    stmt = stmt.values(ip_address=clean_ip)
    await db.execute(stmt)
    db.add(Activity(message=f"ESP32 hardware IP address set to {clean_ip}", category="system"))
    await db.commit()
    return {"ok": True, "ip_address": clean_ip}

@router.post("/ping-board")
async def ping_board(payload: BoardPingPayload):
    return await probe_esp32_hardware(payload.ip_address)
