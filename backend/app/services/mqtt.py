import json
import threading
from ..config import settings

def _do_publish(node_id: str, channel: int, is_on: bool):
    """Background publisher - sends command to MQTT broker without blocking the local HTTP relay."""
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
            qos=0  # QoS 0 = Non-blocking fire & forget
        )
        print(f"[MQTT] Relay command sent: CH{channel} -> {'ON' if is_on else 'OFF'}")
    except Exception as e:
        print(f"[MQTT] Error publishing relay command: {e}")

def publish_relay(node_id: str, channel: int, is_on: bool) -> bool:
    if not settings.mqtt_enabled:
        return False
    # Dispatch in daemon thread so the local physical relay and API response are INSTANT (<10ms)
    threading.Thread(
        target=_do_publish,
        args=(node_id, channel, is_on),
        daemon=True
    ).start()
    return True
