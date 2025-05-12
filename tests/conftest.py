# tests/conftest.py
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool # Для SQLite в памяти

from app.main import app
from app.database import Base, get_db
from app.config import settings # Импортируем, чтобы можно было переопределить DATABASE_URL для тестов

# --- Настройка тестовой базы данных (SQLite в памяти для примера) ---
# В реальных сценариях можно использовать отдельную тестовую PostgreSQL БД
# Для этого нужно будет изменить DATABASE_URL на URL тестовой PostgreSQL БД
# и убедиться, что она создана и доступна.

# Для SQLite в памяти:
SQLALCHEMY_DATABASE_URL_TEST = "sqlite:///:memory:" # Или "sqlite:///./test.db" для файла

engine_test = create_engine(
    SQLALCHEMY_DATABASE_URL_TEST,
    # connect_args={"check_same_thread": False} # Нужно для SQLite при использовании в нескольких потоках/тестах
    poolclass=StaticPool, # Для SQLite в памяти
    connect_args={"check_same_thread": False} # для SQLite
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

# Создаем все таблицы в тестовой БД перед запуском тестов
Base.metadata.create_all(bind=engine_test)

# --- Переопределение зависимости get_db для тестов ---
def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

# Применяем переопределение для всего приложения на время тестов
app.dependency_overrides[get_db] = override_get_db

# --- Фикстура для TestClient ---
@pytest.fixture(scope="module") # "module" - клиент создается один раз для всех тестов в модуле
def client():
    # Перед тестами: создать таблицы
    Base.metadata.create_all(bind=engine_test)
    with TestClient(app) as c:
        yield c
    # После тестов (если нужно очистить):
    # Base.metadata.drop_all(bind=engine_test) # Осторожно, если тесты параллельные