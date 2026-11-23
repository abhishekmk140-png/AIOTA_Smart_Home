from datetime import datetime
from pydantic import BaseModel, Field

class DeviceOut(BaseModel):
    id: int
    name: str
    kind: str
    channel: int
    node_id: str
    ip_address: str | None = None
    is_on: bool
    room_id: int | None = None
    class Config:
        from_attributes = True

class RoomCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)

class RoomOut(BaseModel):
    id: int
    name: str
    devices: list[DeviceOut] = []
    class Config:
        from_attributes = True

class DeviceCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: str = "light"
    channel: int = Field(ge=1, le=6)
    node_id: str
    room_id: int | None = None
    ip_address: str | None = None

class RelayCommand(BaseModel):
    is_on: bool

class TelemetryIn(BaseModel):
    node_id: str
    temperature: float | None = None
    humidity: float | None = None
    air_quality: float | None = None
    energy_kwh: float | None = None
    motion: bool | None = None

class TelemetryOut(TelemetryIn):
    id: int
    recorded_at: datetime
    class Config:
        from_attributes = True

class ActivityOut(BaseModel):
    id: int
    message: str
    category: str
    created_at: datetime
    class Config:
        from_attributes = True

class DeviceNetworkUpdate(BaseModel):
    ip_address: str | None = None

class DeviceUpdate(BaseModel):
    name: str | None = None
    kind: str | None = None
    channel: int | None = Field(default=None, ge=1, le=6)
    node_id: str | None = None
    ip_address: str | None = None
    room_id: int | None = None

class RoomToggleAll(BaseModel):
    is_on: bool

# Automation Rule Schemas
class AutomationRuleCreate(BaseModel):
    name: str
    sensor: str  # temperature, humidity, air_quality, motion
    operator: str  # >, <, ==
    threshold_value: float = 0.0
    target_device_id: int
    action: str = "turn_on"  # turn_on, turn_off
    is_enabled: bool = True

class AutomationRuleOut(AutomationRuleCreate):
    id: int
    last_triggered_at: datetime | None = None
    created_at: datetime
    target_device: DeviceOut | None = None
    class Config:
        from_attributes = True

# Scene Schemas
class SceneAction(BaseModel):
    device_id: int
    is_on: bool

class SceneCreate(BaseModel):
    name: str
    icon: str = "Moon"
    description: str = ""
    actions: list[SceneAction] = []

class SceneOut(SceneCreate):
    id: int
    class Config:
        from_attributes = True

# Node status
class NodeStatus(BaseModel):
    node_id: str
    name: str
    room_name: str
    online: bool
    last_seen: datetime | None = None
    ip_address: str | None = None
    relay_count: int = 6
    active_relays: int = 0
    temperature: float | None = None
    humidity: float | None = None
    motion: bool | None = None
