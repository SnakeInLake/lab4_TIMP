# app/security.py
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.config import settings  # Наши настройки с SECRET_KEY, ALGORITHM, и т.д.
from app.schemas import TokenData  # Pydantic модель для данных в токене

# Контекст для хеширования паролей
# "bcrypt" - рекомендуемый алгоритм
# deprecated="auto" - автоматически будет использовать новые схемы, если старые устареют
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = settings.ALGORITHM
SECRET_KEY = settings.SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Проверяет, соответствует ли обычный пароль хешированному."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Возвращает хеш для пароля."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Создает JWT токен доступа.
    :param data: Данные для кодирования в токен (обычно {'sub': username, 'user_id': id}).
    :param expires_delta: Время жизни токена. Если None, используется значение по умолчанию.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[TokenData]:
    """
    Декодирует токен доступа.
    Возвращает данные пользователя (TokenData) или None, если токен невалиден.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: Optional[str] = payload.get("sub")
        user_id: Optional[int] = payload.get("user_id")  # Получаем user_id из токена

        if username is None or user_id is None:  # Убедимся, что оба поля есть
            return None  # Или можно выбросить исключение credentials_exception

        # Проверяем, не истек ли срок действия токена (хотя jwt.decode это тоже делает)
        # exp_timestamp = payload.get("exp")
        # if exp_timestamp and datetime.fromtimestamp(exp_timestamp, timezone.utc) < datetime.now(timezone.utc):
        #     return None # Токен истек

        return TokenData(username=username, user_id=user_id)
    except JWTError:  # Любая ошибка при декодировании JWT
        return None