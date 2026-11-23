from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "AIOTA Smart Home API"
    database_url: str = "sqlite+aiosqlite:///./aiota.db"
    mqtt_enabled: bool = False
    mqtt_host: str = "localhost"
    mqtt_port: int = 1883
    mqtt_username: str = ""
    mqtt_password: str = ""
    cors_origins: str = "*"
    allow_virtual_relay: bool = True
    simulate_telemetry: bool = True

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
