# app/schemas.py
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime
from typing import Literal
import re
# --- Вспомогательные схемы (если нужны для вложенности) ---

# --- Схемы для User ---
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role: Optional[str] = Field("operator", description="User role: operator or admin")

    @field_validator('password') # ИЗМЕНЕНО
    @classmethod # Валидаторы полей теперь обычно @classmethod
    def password_complexity(cls, v: str) -> str: # v - это значение поля
        if len(v) < 8:
            raise ValueError('Пароль должен быть длиной не менее 8 символов')
        if not re.search(r"[A-Z]", v):
            raise ValueError('Пароль должен содержать хотя бы одну заглавную букву')
        if not re.search(r"[a-z]", v):
            raise ValueError('Пароль должен содержать хотя бы одну строчную букву')
        if not re.search(r"[0-9]", v):
            raise ValueError('Пароль должен содержать как минимум одну цифру')
        return v

class User(UserBase):  # Схема для чтения данных пользователя (без пароля)
    id: int
    role: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Позволяет Pydantic работать с объектами SQLAlchemy


# --- Схемы для Справочников (для чтения) ---
class ATMStatusBase(BaseModel):
    name: str
    description: Optional[str] = None


class ATMStatus(ATMStatusBase):
    id: int

    class Config:
        from_attributes = True


class LogLevelBase(BaseModel):
    name: str
    severity_order: Optional[int] = None


class LogLevel(LogLevelBase):
    id: int

    class Config:
        from_attributes = True


class EventTypeBase(BaseModel):
    name: str
    category: Optional[str] = None
    description: Optional[str] = None


class EventType(EventTypeBase):
    id: int

    class Config:
        from_attributes = True


# --- Схемы для ATM ---
class ATMBase(BaseModel):
    atm_uid: str = Field(..., max_length=100)
    location_description: Optional[str] = None
    ip_address: Optional[str] = Field(None, max_length=45)
    status_id: int

    @field_validator('atm_uid')
    @classmethod
    def validate_atm_uid_digits(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError('ATM UID должен состоять только из цифр')
        return v

    @field_validator('ip_address')
    @classmethod
    def validate_ip_address_format(cls, v: Optional[str]) -> Optional[str]:
        # Валидируем, только если значение передано (не None)
        if v is not None:
            # Простая проверка на формат IPv4 (можно использовать более строгую библиотеку)
            ip_pattern = re.compile(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$")
            if not ip_pattern.match(v):
                raise ValueError('Неверный формат IP адреса')
            # Дополнительно проверяем октеты
            parts = v.split('.')
            if len(parts) != 4 or any(int(part) > 255 for part in parts):
                raise ValueError('Неверный формат IP адреса (октеты должны быть 0-255)')
        return v


class ATMCreate(ATMBase):
    pass


class ATMUpdate(BaseModel):
    atm_uid: Optional[str] = Field(None, max_length=100)
    location_description: Optional[str] = None
    ip_address: Optional[str] = Field(None, max_length=45)
    status_id: Optional[int] = None

    # Добавляем валидаторы и сюда, если поле может быть обновлено
    @field_validator('atm_uid')
    @classmethod
    def validate_update_atm_uid_digits(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.isdigit():
            raise ValueError('ATM UID должен состоять только из цифр')
        return v

    @field_validator('ip_address')
    @classmethod
    def validate_update_ip_address_format(cls, v: Optional[str]) -> Optional[str]:
        # Можно скопировать логику из ATMBase или вынести в общую функцию
        if v is not None:
            ip_pattern = re.compile(r"^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$")
            if not ip_pattern.match(v):
                raise ValueError('Неверный формат IP адреса')
            parts = v.split('.')
            if len(parts) != 4 or any(int(part) > 255 for part in parts):
                raise ValueError('Неверный формат IP адреса (октеты должны быть 0-255)')
        return v

class ATM(ATMBase):  # Схема для чтения ATM
    id: int
    added_by_user_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    status: ATMStatus  # Вложенная схема для отображения информации о статусе

    class Config:
        from_attributes = True


# --- Схемы для ATMLog ---
class ATMLogBase(BaseModel):
    event_timestamp: datetime
    message: str
    payload: Optional[dict] = None  # JSONB будет представлен как dict
    is_alert: Optional[bool] = False
    # Связи через ID
    log_level_id: int
    event_type_id: Optional[int] = None


class ATMLogCreate(ATMLogBase):
    # atm_id будет передаваться в URL или в теле, если лог создается не для конкретного ATM
    pass


class ATMLogUpdate(BaseModel):  # Для обновления, например, статуса алерта
    message: Optional[str] = None
    payload: Optional[dict] = None
    is_alert: Optional[bool] = None
    # acknowledged_by_user_id и acknowledged_at будут устанавливаться специальным эндпоинтом


class ATMLog(ATMLogBase):  # Схема для чтения лога
    id: int
    atm_id: int
    recorded_at: datetime
    acknowledged_by_user_id: Optional[int] = None
    acknowledged_at: Optional[datetime] = None

    # Вложенные схемы для удобного отображения
    log_level: LogLevel
    event_type: Optional[EventType] = None  # Может быть NULL

    # atm: ATM # Можно добавить, если нужно возвращать полную инфу о банкомате с каждым логом, но может быть избыточно

    class Config:
        from_attributes = True


# --- Схемы для токенов (аутентификация) ---
class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):  # Для декодирования данных из токена
    username: Optional[str] = None
    user_id: Optional[int] = None  # Добавим user_id для удобства

class UserRoleUpdate(BaseModel):
    role: Literal["operator", "admin"] = Field(..., description="New role for the user: 'operator' or 'admin'")