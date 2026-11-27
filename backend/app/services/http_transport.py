import threading
import httpx
from typing import Optional

# Reusable HTTP client with persistent connection pool & keep-alive
# Eliminates TCP 3-way handshake on every relay toggle for sub-20ms latency
_http_pool = httpx.Client(
    timeout=httpx.Timeout(0.8, connect=0.4),
    limits=httpx.Limits(max_keepalive_connections=20, max_connections=40, keepalive_expiry=60.0),
)

_last_known_ip = "192.168.1.8"

def get_active_board_ips(target_ip: Optional[str] = None) -> list[str]:
    """Get candidate IP addresses to reach the physical ESP32, prioritizing the verified live IP."""
    global _last_known_ip
    from .node_tracker import node_tracker

    candidates = []
    # 1. First priority: live IP tracked from real telemetry heartbeat
    living = node_tracker._nodes.get("aiota-living", {})
    live_ip = living.get("ip_address")
    if live_ip and live_ip not in ("127.0.0.1", "localhost", "::1"):
        _last_known_ip = live_ip
        candidates.append(live_ip)

    # 2. Second priority: explicitly specified IP if different
    if target_ip:
        clean_target = target_ip.replace("http://", "").replace("https://", "").rstrip("/")
        if clean_target and clean_target not in candidates and clean_target not in ("127.0.0.1", "localhost", "::1"):
            candidates.append(clean_target)

    # 3. Fallback: last known working IP
    if _last_known_ip and _last_known_ip not in candidates:
        candidates.append(_last_known_ip)

    return candidates

def _post_relay_fast(ip: str, channel: int, is_on: bool) -> bool:
    """Send relay command to a single IP with connection reuse and ultra-low timeout."""
    clean_ip = ip.replace("http://", "").replace("https://", "").rstrip("/")
    url = f"http://{clean_ip}/api/relay" if ":" in clean_ip else f"http://{clean_ip}:80/api/relay"
    try:
        res = _http_pool.post(
            url,
            json={"channel": channel, "is_on": is_on},
            timeout=0.6,
        )
        if res.status_code == 200:
            global _last_known_ip
            _last_known_ip = clean_ip
            print(f"[PHYSICAL RELAY] CH{channel} -> {'ON' if is_on else 'OFF'} confirmed by {url} [Status {res.status_code}]")
            return True
    except Exception as err:
        print(f"[PHYSICAL RELAY] Fast post failed for {url}: {err}")
    return False

def _post_relay(ip_address: str, channel: int, is_on: bool):
    candidates = get_active_board_ips(ip_address)
    for candidate in candidates:
        if _post_relay_fast(candidate, channel, is_on):
            return

def send_http_relay(ip_address: str | None, channel: int, is_on: bool) -> bool:
    """Non-blocking daemon dispatch to physical ESP32 relay with connection reuse."""
    target = ip_address or _last_known_ip
    threading.Thread(
        target=_post_relay,
        args=(target, channel, is_on),
        daemon=True,
    ).start()
    return True

async def probe_esp32_hardware(ip_address: str) -> dict:
    """Check if ESP32-S3 relay hardware is reachable and responsive at the given IP."""
    clean_ip = ip_address.replace("http://", "").replace("https://", "").rstrip("/")
    from ..services.node_tracker import node_tracker

    # 1. Direct local HTTP probe (checks /api/status first, then /health)
    async with httpx.AsyncClient(timeout=1.2) as client:
        for path in ("/api/status", "/health"):
            url = f"http://{clean_ip}{path}" if ":" in clean_ip else f"http://{clean_ip}:80{path}"
            try:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    global _last_known_ip
                    _last_known_ip = clean_ip
                    return {
                        "online": True,
                        "hardware": data.get("hardware", "Waveshare ESP32-S3 6CH"),
                        "node_id": data.get("node_id", "aiota-living"),
                        "ip_address": clean_ip,
                        "status": "ok",
                        "transport": "http_direct"
                    }
            except Exception:
                pass

    # 2. Check if physical ESP32 node (aiota-living) is actively streaming real telemetry
    living_node = node_tracker._nodes.get("aiota-living")
    if living_node and node_tracker.is_online("aiota-living", timeout_seconds=25):
        real_ip = living_node.get("ip_address") or _last_known_ip
        if real_ip:
            return {
                "online": True,
                "hardware": "Waveshare ESP32-S3 6CH",
                "node_id": "aiota-living",
                "ip_address": real_ip,
                "status": "ok",
                "transport": "telemetry"
            }

    return {"online": False, "error": f"Physical board at {clean_ip} is unreachable (Offline/Power/Wi-Fi issue)"}
