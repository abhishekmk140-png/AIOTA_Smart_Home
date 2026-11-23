# AIOTA Smart Home Automation

A starter full-stack smart-home platform for three Waveshare ESP32-S3 Relay 6CH nodes.

## Stack
- Frontend: React, TypeScript, Vite, Recharts
- Backend: Python, FastAPI, SQLAlchemy async
- Database: PostgreSQL (SQLite fallback for local development)
- Live updates: WebSocket
- Device transports: HTTP polling/commands and optional MQTT
- Firmware: Arduino framework for ESP32-S3

## Project layout
```
AIOTA_Smart_Home/
  backend/
    app/
      main.py, config.py, database.py, models.py, schemas.py
      routers/       (rooms, devices, telemetry)
      services/      (device transport, MQTT)
    requirements.txt
    .env.example
  frontend/
    src/
      App.tsx, main.tsx, styles.css, api.ts, types.ts
      components/
    package.json, vite.config.ts, index.html
  firmware/
    aiota_esp32s3_relay6ch.ino
  docker-compose.yml
```

## 1. Start the backend
Python 3.11+ recommended.

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate
pip install -r requirements.txt
copy .env.example .env   # Windows
# cp .env.example .env   # macOS/Linux
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API docs: http://localhost:8000/docs

The backend uses SQLite by default so it can start without PostgreSQL. To use PostgreSQL, set `DATABASE_URL` in `.env` and start the database using Docker Compose.

## 2. Start the frontend
Open a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the URL printed by Vite (normally http://localhost:5173).

## 3. PostgreSQL + MQTT (optional)
From the project root:
```bash
docker compose up -d
```
Then set:
```
DATABASE_URL=postgresql+asyncpg://aiota:aiota_dev_password@localhost:5432/aiota
MQTT_ENABLED=true
MQTT_HOST=localhost
MQTT_PORT=1883
```
Restart the backend after changing `.env`.

## 4. ESP32 firmware
Open `firmware/aiota_esp32s3_relay6ch.ino` in Arduino IDE. Install:
- ESP32 board support package
- PubSubClient library
- ArduinoJson library

Set Wi-Fi credentials, backend URL, node ID and MQTT settings in the sketch.
The firmware exposes an HTTP relay endpoint (`POST http://ESP32_IP/api/relay`) and also subscribes to MQTT commands.
Set a node's IP address using `PATCH /api/devices/{device_id}/network` with `{"ip_address":"192.168.1.50"}`.
The firmware uses the Waveshare ESP32-S3 Relay 6CH example GPIO mapping:
`1, 2, 41, 42, 45, 46`.
Verify this against the exact PCB revision and schematic before wiring. Relay active level is configurable because it has not yet been confirmed for this board.

## 5. Initial demo nodes
The backend seeds three demo rooms and devices on first startup. These are software records only; they do not prove that a physical ESP32 is online. Update each device's `node_id` to match the firmware.

## 6. Safety and commissioning
- Test each relay with the mains load disconnected first.
- Verify relay active-high/active-low behavior with a multimeter.
- Use properly rated enclosures, fuses, isolation, wiring and qualified electrical installation for mains loads.
- A relay channel only switches power. AC temperature/mode control needs an IR blaster or compatible AC interface. Fan speed control needs suitable speed-control hardware.
- Energy dashboards need a real energy meter/current sensor. Relay ON/OFF state is not an energy measurement.
- The sample firmware accepts HTTP/MQTT relay commands and sends a basic HTTP telemetry heartbeat. Sensor drivers and calibration must be completed for the exact AM2315C, PIR and air-quality sensor modules being installed. Do not connect an unknown sensor output directly to an ESP32 pin until its voltage range is verified.
- Before exposing AIOTA outside the home network, add production authentication, TLS, secure device credentials, authorization and rate limiting. This starter is for local development, not production deployment.

## 7. Current implementation scope
Included:
- Responsive dashboard with dark/light theme toggle
- Three default rooms and room create/delete
- Device cards with six-channel assignment model
- Relay on/off API
- Analytics page with telemetry chart components and empty/demo state
- Automation rule starter UI
- Device management and notifications views
- FastAPI REST endpoints and WebSocket event stream
- Optional MQTT command publishing
- ESP32 firmware skeleton with HTTP heartbeat and MQTT command support

Next implementation tasks:
1. Confirm exact sensor module models, pinout and output voltages.
2. Confirm relay active level and validate all six outputs.
3. Add authentication and role-based access.
4. Add real sensor drivers, calibration and energy meter integration.
5. Add automation scheduler persistence and rule execution.
