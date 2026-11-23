import asyncio
import math
import random
from datetime import datetime, timezone
from sqlalchemy import select
from ..database import SessionLocal
from ..models import Device, Telemetry, Activity
from ..services.events import hub
from ..services.node_tracker import node_tracker
from ..services.automation_engine import evaluate_rules_for_telemetry

def utcnow():
    return datetime.now(timezone.utc)

cumulative_energy = {"aiota-living": 12.4, "aiota-bedroom": 8.7, "aiota-kitchen": 15.2}

async def run_telemetry_simulator():
    """Background task that produces realistic sensor data and energy usage for demo/testing."""
    step = 0
    nodes = ["aiota-living", "aiota-bedroom", "aiota-kitchen"]
    node_ips = {
        "aiota-living": "192.168.1.101",
        "aiota-bedroom": "192.168.1.102",
        "aiota-kitchen": "192.168.1.103",
    }

    # Device wattage lookup for real power calculation
    WATTAGE = {"light": 15.0, "fan": 65.0, "ac": 1400.0, "socket": 120.0}

    while True:
        try:
            await asyncio.sleep(8)
            step += 1

            async with SessionLocal() as db:
                # Query devices to calculate live power usage
                dev_res = await db.execute(select(Device))
                devices = dev_res.scalars().all()
                device_power: dict[str, float] = {n: 5.0 for n in nodes} # 5W base standby

                for d in devices:
                    if d.is_on and d.node_id in device_power:
                        power = WATTAGE.get(d.kind, 30.0)
                        device_power[d.node_id] += power

                for i, nid in enumerate(nodes):
                    # NEVER simulate for the physical ESP32 node (aiota-living)
                    if nid == "aiota-living":
                        continue
                    # Ambient fluctuations
                    base_temp = 24.5 + (i * 0.8)
                    temp = round(base_temp + math.sin((step + i * 4) / 6.0) * 2.2 + random.uniform(-0.2, 0.2), 1)
                    humidity = round(52.0 + math.cos((step + i * 3) / 8.0) * 7.0 + random.uniform(-0.5, 0.5), 1)
                    air_quality = round(32.0 + math.sin((step + i) / 5.0) * 12.0 + random.uniform(-1, 1), 0)
                    
                    # Random motion burst every ~60 seconds in one room
                    motion = (random.random() < 0.12)

                    # Update cumulative kWh based on wattage: (Watts * (8s / 3600s)) / 1000
                    watts = device_power.get(nid, 10.0)
                    kwh_increment = (watts * (8.0 / 3600.0)) / 1000.0
                    cumulative_energy[nid] = round(cumulative_energy.get(nid, 10.0) + kwh_increment, 4)

                    telemetry = Telemetry(
                        node_id=nid,
                        temperature=temp,
                        humidity=humidity,
                        air_quality=air_quality,
                        energy_kwh=cumulative_energy[nid],
                        motion=motion,
                    )
                    db.add(telemetry)

                    # Register heartbeat
                    node_tracker.record_heartbeat(
                        nid,
                        ip_address=node_ips.get(nid),
                        telemetry_data={
                            "temperature": temp,
                            "humidity": humidity,
                            "air_quality": air_quality,
                            "motion": motion,
                            "power_w": watts,
                        }
                    )

                    # Broadcast WS
                    await hub.publish({
                        "type": "telemetry",
                        "node_id": nid,
                        "temperature": temp,
                        "humidity": humidity,
                        "air_quality": air_quality,
                        "energy_kwh": cumulative_energy[nid],
                        "power_w": round(watts, 1),
                        "motion": motion,
                        "recorded_at": utcnow().isoformat()
                    })

                    # If motion occurred, log activity
                    if motion:
                        db.add(Activity(message=f"Motion detected in {nid.replace('aiota-', '').capitalize()}", category="security"))

                await db.commit()

        except asyncio.CancelledError:
            break
        except Exception as e:
            # Silently continue loop on transient errors
            await asyncio.sleep(5)
