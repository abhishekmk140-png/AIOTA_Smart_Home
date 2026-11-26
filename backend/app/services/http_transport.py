import threading
import subprocess
import re
import httpx

_last_known_ip = "192.168.1.11"

def discover_esp32_ip() -> str | None:
    global _last_known_ip
    # Quick probe last known
    if _last_known_ip:
        try:
            r = httpx.get(f"http://{_last_known_ip}/health", timeout=1.0)
            if r.status_code == 200 and "Waveshare" in r.text:
                return _last_known_ip
        except Exception:
            pass

    # Read ARP table to find ESP32
    try:
        out = subprocess.check_output("arp -a", shell=True, text=True)
        ips = re.findall(r"(192\.168\.1\.\d+)", out)
        for ip in ips:
            if ip.endswith(".1") or ip.endswith(".255"):
                continue
            try:
                r = httpx.get(f"http://{ip}/health", timeout=0.8)
                if r.status_code == 200 and "Waveshare" in r.text:
                    _last_known_ip = ip
                    print(f"[AUTODETECT] Found ESP32 board at {ip}")
                    return ip
            except Exception:
                continue
    except Exception:
        pass
    return None

def _post_relay(ip_address: str, channel: int, is_on: bool):
    global _last_known_ip
    target_ip = ip_address or _last_known_ip
    for attempt in range(2):
        try:
            clean_ip = target_ip.replace("http://", "").replace("https://", "").rstrip("/")
            url = f"http://{clean_ip}/api/relay" if ":" in clean_ip else f"http://{clean_ip}:80/api/relay"
            res = httpx.post(
                url,
                json={"channel": channel, "is_on": is_on},
                timeout=2.0,
            )
            if res.status_code == 200:
                _last_known_ip = clean_ip
                print(f"[PHYSICAL RELAY] CH{channel} -> {'ON' if is_on else 'OFF'} sent to {url} [Status {res.status_code}]")
                return
        except Exception as err:
            print(f"[PHYSICAL RELAY] Attempt {attempt+1} failed for {target_ip}: {err}")
            # Try auto-discovering
            discovered = discover_esp32_ip()
            if discovered and discovered != target_ip:
                target_ip = discovered
            else:
                break

def send_http_relay(ip_address: str | None, channel: int, is_on: bool) -> bool:
    if not ip_address:
        return False
    # Dispatch in daemon thread so slow or unreachable hardware never blocks the API or UI
    threading.Thread(
        target=_post_relay,
        args=(ip_address, channel, is_on),
        daemon=True,
    ).start()
    return True

async def probe_esp32_hardware(ip_address: str) -> dict:
    """Check if ESP32-S3 relay hardware is reachable and responsive at the given IP."""
    clean_ip = ip_address.replace("http://", "").replace("https://", "").rstrip("/")
    from ..services.node_tracker import node_tracker

    # 1. Direct local HTTP probe (checks /api/status first, then /health)
    async with httpx.AsyncClient(timeout=1.5) as client:
        for path in ("/api/status", "/health"):
            url = f"http://{clean_ip}{path}" if ":" in clean_ip else f"http://{clean_ip}:80{path}"
            try:
                res = await client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "online": True,
                        "hardware": data.get("hardware", "Waveshare ESP32-S3 6CH"),
                        "node_id": data.get("node_id"),
                        "status": "ok",
                        "transport": "http_direct"
                    }
            except Exception:
                pass

    # 2. Check if physical ESP32 node (aiota-living) is actively streaming real telemetry
    living_node = node_tracker._nodes.get("aiota-living")
    if living_node and node_tracker.is_online("aiota-living", timeout_seconds=20):
        real_ip = living_node.get("ip_address")
        if real_ip:
            return {
                "online": True,
                "hardware": f"Waveshare ESP32-S3 6CH (Live on {real_ip})",
                "node_id": "aiota-living",
                "ip_address": real_ip,
                "status": "ok",
                "transport": "telemetry"
            }

    return {"online": False, "error": f"Physical board at {clean_ip} is unreachable (Offline/Power/Wi-Fi issue)"}
