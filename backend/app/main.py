import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from .config import settings
from .database import engine, Base, SessionLocal
from .models import Room, Device, AutomationRule, Scene, Activity
from .routers import rooms, devices, telemetry, automations, nodes
from .services.events import hub
from .services.telemetry_simulator import run_telemetry_simulator

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB schema
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed initial 6-channel Waveshare ESP32-S3 relay profile if empty
    async with SessionLocal() as db:
        result = await db.execute(select(Device))
        if not result.scalars().first():
            # Seed 6 Waveshare ESP32-S3 hardware relay channels
            seed_devices = [
                Device(name="Relay 1 (CH1 - GPIO 1)", kind="light", channel=1, node_id="aiota-living", ip_address="192.168.1.100", is_on=False, room_id=None),
                Device(name="Relay 2 (CH2 - GPIO 2)", kind="fan", channel=2, node_id="aiota-living", ip_address="192.168.1.100", is_on=False, room_id=None),
                Device(name="Relay 3 (CH3 - GPIO 41)", kind="ac", channel=3, node_id="aiota-living", ip_address="192.168.1.100", is_on=False, room_id=None),
                Device(name="Relay 4 (CH4 - GPIO 42)", kind="socket", channel=4, node_id="aiota-living", ip_address="192.168.1.100", is_on=False, room_id=None),
                Device(name="Relay 5 (CH5 - GPIO 45)", kind="socket", channel=5, node_id="aiota-living", ip_address="192.168.1.100", is_on=False, room_id=None),
                Device(name="Relay 6 (CH6 - GPIO 46)", kind="light", channel=6, node_id="aiota-living", ip_address="192.168.1.100", is_on=False, room_id=None),
            ]
            db.add_all(seed_devices)
            await db.flush()

            # Seed clean scenes without auto rules
            db.add_all([
                Scene(
                    name="All Relays ON",
                    icon="Sun",
                    description="Energize all 6 relays on the board",
                    actions=[{"device_id": d.id, "is_on": True} for d in seed_devices]
                ),
                Scene(
                    name="All Relays OFF",
                    icon="Power",
                    description="Turn off all 6 relays",
                    actions=[{"device_id": d.id, "is_on": False} for d in seed_devices]
                ),
            ])

            db.add(Activity(message="AIOTA smart home initialized with Waveshare ESP32-S3 6CH Relay profile", category="system"))
            await db.commit()

    # Start telemetry simulator background task
    sim_task = None
    if settings.simulate_telemetry:
        sim_task = asyncio.create_task(run_telemetry_simulator())

    yield

    if sim_task:
        sim_task.cancel()
        try:
            await sim_task
        except asyncio.CancelledError:
            pass

    await engine.dispose()

app = FastAPI(title=settings.app_name, version="0.2.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[x.strip() for x in settings.cors_origins.split(",") if x.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rooms.router)
app.include_router(devices.router)
app.include_router(telemetry.router)
app.include_router(automations.router)
app.include_router(nodes.router)

@app.get("/")
async def root():
    return {
        "name": "AIOTA Smart Home API",
        "status": "online",
        "docs": "/docs",
        "features": ["rooms", "devices", "telemetry", "automations", "nodes", "websocket"]
    }

@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "AIOTA API", "nodes_tracked": 3}

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await hub.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        hub.disconnect(ws)
