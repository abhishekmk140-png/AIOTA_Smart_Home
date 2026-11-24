from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "AIOTA Smart Home API"
    database_url: str = "sqlite+aiosqlite:///./aiota.db"
    mqtt_enabled: bool = True
    mqtt_host: str = "mqtt.aiota.tech"
    mqtt_port: int = 1883
    mqtt_client_id: str = "dev_a0a94ebae634"
    mqtt_username: str = "dev_a0a94ebae634"
    mqtt_password: str = "UsJpRoSIrMPbHPguEH2V8kPpdK8yxGYA"
    mqtt_telemetry_topic: str = "devices/dev_a0a94ebae634/telemetry"
    mqtt_status_topic: str = "devices/dev_a0a94ebae634/status"
    mqtt_command_topic: str = "devices/dev_a0a94ebae634/cmd"
    cors_origins: str = "*"
    allow_virtual_relay: bool = True
    simulate_telemetry: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
