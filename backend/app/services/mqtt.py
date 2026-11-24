import json
from ..config import settings

def publish_relay(node_id: str, channel: int, is_on: bool) -> bool:
    if not settings.mqtt_enabled:
        return False
    try:
        import paho.mqtt.publish as publish
        topic = settings.mqtt_command_topic
        payload = json.dumps({
            "channel": channel,
            "state": "ON" if is_on else "OFF",
            "is_on": is_on,
            "node_id": node_id
        })
        auth = None
        if settings.mqtt_username:
            auth = {
                "username": settings.mqtt_username,
                "password": settings.mqtt_password
            }
        publish.single(
            topic,
            payload=payload,
            hostname=settings.mqtt_host,
            port=settings.mqtt_port,
            client_id=settings.mqtt_client_id,
            auth=auth,
            qos=1
        )
        print(f"[MQTT] Relay command published: CH{channel} -> {'ON' if is_on else 'OFF'} on topic {topic}")
        return True
    except Exception as e:
        print(f"[MQTT] Error publishing relay command: {e}")
        return False
