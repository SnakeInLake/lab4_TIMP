# app/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func  # Для DEFAULT NOW()

from app.database import Base  # Импортируем наш Base из database.py


# --- Справочные таблицы ---

#class UserRole(Base):  # Если бы мы выносили роли в отдельную таблицу
 #   __tablename__ = "user_roles"  # Пример, пока не используем, но как вариант
  #  id = Column(Integer, primary_key=True, index=True)
   # name = Column(String(20), unique=True, index=True, nullable=False)
    #description = Column(Text)
    # users = relationship("User", back_populates="role_obj")


class ATMStatus(Base):
    __tablename__ = "atm_statuses"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(Text)
    # Связь с таблицей atms
    atms = relationship("ATM", back_populates="status")


class LogLevel(Base):
    __tablename__ = "log_levels"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(20), unique=True, index=True, nullable=False)
    severity_order = Column(Integer, unique=True)
    # Связь с таблицей atm_logs
    atm_logs = relationship("ATMLog", back_populates="log_level")


class EventType(Base):
    __tablename__ = "event_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, index=True, nullable=False)
    category = Column(String(50))
    description = Column(Text)
    # Связь с таблицей atm_logs
    atm_logs = relationship("ATMLog", back_populates="event_type")


# --- Основные таблицы ---

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    # Пока роль храним строкой, но можно было бы сделать ForeignKey на user_roles
    role = Column(String(20), nullable=False, default='operator')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Связи (если нужны для ORM-запросов)
    added_atms = relationship("ATM", back_populates="added_by", foreign_keys="[ATM.added_by_user_id]")
    acknowledged_logs = relationship("ATMLog", back_populates="acknowledged_by",
                                     foreign_keys="[ATMLog.acknowledged_by_user_id]")


class ATM(Base):
    __tablename__ = "atms"

    id = Column(Integer, primary_key=True, index=True)
    atm_uid = Column(String(100), unique=True, index=True, nullable=False)
    location_description = Column(Text)
    ip_address = Column(String(45))

    status_id = Column(Integer, ForeignKey("atm_statuses.id"), nullable=False)
    added_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Связи с другими таблицами
    status = relationship("ATMStatus", back_populates="atms")
    added_by = relationship("User", back_populates="added_atms", foreign_keys=[added_by_user_id])
    logs = relationship("ATMLog", back_populates="atm", cascade="all, delete-orphan")


class ATMLog(Base):
    __tablename__ = "atm_logs"

    id = Column(Integer, primary_key=True,
                index=True)  # В DDL был BIGSERIAL, но для SQLAlchemy Integer часто мапится на BIGINT если это PK
    atm_id = Column(Integer, ForeignKey("atms.id"), nullable=False)
    event_timestamp = Column(DateTime(timezone=True), nullable=False)

    log_level_id = Column(Integer, ForeignKey("log_levels.id"), nullable=False)
    event_type_id = Column(Integer, ForeignKey("event_types.id"), nullable=True)

    message = Column(Text, nullable=False)
    payload = Column(JSON, nullable=True)  # SQLAlchemy мапит JSON на JSONB для PostgreSQL если это доступно

    is_alert = Column(Boolean, default=False)
    acknowledged_by_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    # Связи
    atm = relationship("ATM", back_populates="logs")
    log_level = relationship("LogLevel", back_populates="atm_logs")
    event_type = relationship("EventType", back_populates="atm_logs")
    acknowledged_by = relationship("User", back_populates="acknowledged_logs", foreign_keys=[acknowledged_by_user_id])