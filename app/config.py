# app/core/config.py
import os
from dotenv import load_dotenv
from pathlib import Path

# Определяем путь к .env файлу относительно текущего файла config.py
# (config.py находится в app/core/, .env - в корне проекта, т.е. на два уровня выше)
env_path = Path('.') / '.env'
# env_path = Path(__file__).parent.parent.parent / '.env' # Более надежный способ найти корень проекта
load_dotenv(dotenv_path=env_path)

class Settings:
    PROJECT_NAME: str = "ATM Log Monitoring API"
    PROJECT_VERSION: str = "1.0.0"

    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "password")
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5432") # Порт PostgreSQL по умолчанию
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "atm_monitoring_db")
    DATABASE_URL: str = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_SERVER}:{POSTGRES_PORT}/{POSTGRES_DB}"

    # Настройки для JWT
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-please-change-in-production") # Ключ для подписи JWT
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30 # Время жизни токена доступа

settings = Settings()

# Для проверки, что DATABASE_URL собирается правильно:
# print(f"DATABASE_URL: {settings.DATABASE_URL}")
# print(f"SECRET_KEY: {settings.SECRET_KEY}")