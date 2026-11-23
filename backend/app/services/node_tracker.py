from datetime import datetime, timezone
from typing import Dict, Any

def utcnow():
    return datetime.now(timezone.utc)

class NodeTracker:
    def __init__(self):
        self._nodes: Dict[str, Dict[str, Any]] = {
            "aiota-living": {"last_seen": utcnow(), "ip_address": "192.168.1.101", "rssi": -58},
            "aiota-bedroom": {"last_seen": utcnow(), "ip_address": "192.168.1.102", "rssi": -64},
            "aiota-kitchen": {"last_seen": utcnow(), "ip_address": "192.168.1.103", "rssi": -61},
        }

    def record_heartbeat(self, node_id: str, ip_address: str | None = None, telemetry_data: dict | None = None):
        if node_id not in self._nodes:
            self._nodes[node_id] = {}
        self._nodes[node_id]["last_seen"] = utcnow()
        if ip_address:
            self._nodes[node_id]["ip_address"] = ip_address
        if telemetry_data:
            self._nodes[node_id]["telemetry"] = telemetry_data

    def is_online(self, node_id: str, timeout_seconds: int = 60) -> bool:
        node = self._nodes.get(node_id)
        if not node or "last_seen" not in node:
            return False
        delta = (utcnow() - node["last_seen"]).total_seconds()
        return delta <= timeout_seconds

    def get_info(self, node_id: str) -> Dict[str, Any]:
        info = self._nodes.get(node_id, {})
        return {
            "node_id": node_id,
            "online": self.is_online(node_id),
            "last_seen": info.get("last_seen"),
            "ip_address": info.get("ip_address"),
            "rssi": info.get("rssi", -60),
        }

node_tracker = NodeTracker()
