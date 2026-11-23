from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import AutomationRule, Device, Activity
from .events import hub
from .mqtt import publish_relay
from .http_transport import send_http_relay

def utcnow():
    return datetime.now(timezone.utc)

async def evaluate_rules_for_telemetry(db: AsyncSession, node_id: str, telemetry_dict: dict):
    result = await db.execute(select(AutomationRule).where(AutomationRule.is_enabled == True))
    rules = result.scalars().all()
    if not rules:
        return

    for rule in rules:
        sensor_val = telemetry_dict.get(rule.sensor)
        if sensor_val is None:
            continue

        triggered = False
        if rule.sensor == "motion":
            # motion is boolean
            target_val = bool(rule.threshold_value)
            triggered = (bool(sensor_val) == target_val)
        else:
            if rule.operator == ">":
                triggered = float(sensor_val) > float(rule.threshold_value)
            elif rule.operator == "<":
                triggered = float(sensor_val) < float(rule.threshold_value)
            elif rule.operator in ("==", "="):
                triggered = abs(float(sensor_val) - float(rule.threshold_value)) < 0.1

        if triggered:
            # Check debounce (e.g. 15 seconds)
            if rule.last_triggered_at:
                seconds_since = (utcnow() - rule.last_triggered_at).total_seconds()
                if seconds_since < 15:
                    continue

            target_device = await db.get(Device, rule.target_device_id)
            if not target_device:
                continue

            desired_on = (rule.action == "turn_on")
            if target_device.is_on == desired_on:
                # Device is already in the target state, just mark rule checked
                continue

            # Execute action
            target_device.is_on = desired_on
            rule.last_triggered_at = utcnow()

            # Attempt physical transport
            publish_relay(target_device.node_id, target_device.channel, desired_on)
            if target_device.ip_address:
                send_http_relay(target_device.ip_address, target_device.channel, desired_on)

            activity_msg = f"Rule '{rule.name}' triggered: {target_device.name} turned {'ON' if desired_on else 'OFF'}"
            db.add(Activity(message=activity_msg, category="automation"))
            await db.commit()

            await hub.publish({"type": "relay", "device_id": target_device.id, "is_on": target_device.is_on})
            await hub.publish({
                "type": "automation",
                "rule_id": rule.id,
                "rule_name": rule.name,
                "message": activity_msg,
                "device_id": target_device.id
            })

async def execute_scene(db: AsyncSession, scene_id: int):
    from ..models import Scene
    scene = await db.get(Scene, scene_id)
    if not scene:
        return None

    applied_count = 0
    for action in scene.actions:
        device_id = action.get("device_id")
        target_state = action.get("is_on", False)
        device = await db.get(Device, device_id)
        if device:
            device.is_on = target_state
            publish_relay(device.node_id, device.channel, target_state)
            if device.ip_address:
                await send_http_relay(device.ip_address, device.channel, target_state)
            await hub.publish({"type": "relay", "device_id": device.id, "is_on": device.is_on})
            applied_count += 1

    msg = f"Scene '{scene.name}' activated ({applied_count} devices updated)"
    db.add(Activity(message=msg, category="scene"))
    await db.commit()
    await hub.publish({"type": "scene", "scene_id": scene.id, "name": scene.name, "message": msg})
    return scene
