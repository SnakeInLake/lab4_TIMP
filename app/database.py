# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base # Новый импорт
from sqlalchemy.orm import sessionmaker
from app.config import settings # Импортируем наши настройки

# DATABASE_URL из config.py будет использован здесь
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Создаем движок SQLAlchemy
# connect_args нужны для SQLite, для PostgreSQL они обычно не требуются,
# но если будут проблемы с SSL или другими параметрами, их можно добавить сюда.
engine = create_engine(SQLALCHEMY_DATABASE_URL)

# Создаем фабрику сессий
# autocommit=False и autoflush=False - стандартные настройки для SQLAlchemy сессий,
# управляемых вручную (мы будем коммитить изменения явно).
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Базовый класс для декларативных моделей SQLAlchemy
# Все наши модели таблиц будут наследоваться от этого класса.
Base = declarative_base()

# Зависимость (dependency) для FastAPI, чтобы получать сессию БД в эндпоинтах
def get_db():
    db = SessionLocal()
    try:
        yield db  # Предоставляем сессию в эндпоинт
    finally:
        db.close() # Закрываем сессию после того, как эндпоинт отработал