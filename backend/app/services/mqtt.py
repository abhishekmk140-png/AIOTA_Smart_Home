import json
from . import __name__ as _unused
from ..config import settings

_client = None

def publish_relay(node_id: str, channel: int, is_on: bool) -> bool:
    global _client
    if not settings.mqtt_enabled:
        return False
    try:
        import paho.mqtt.publish as publish
        publish.single(
            f"aiota/{node_id}/relay/set",
            json.dumps({"channel": channel, "state": "ON" if is_on else "OFF"}),
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
            auth={"username": settings.mqtt_username, "password": settings.mqtt_password}
                 if settings.mqtt_username else None,
        )
        return True
    except Exception:
        return False
