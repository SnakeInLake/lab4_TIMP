# app/deps.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer  # Для получения токена из заголовка
from sqlalchemy.orm import Session
from jose import JWTError

from app import crud, models, schemas
from app.database import get_db
from app.security import decode_access_token  # Наша функция декодирования
from app.config import settings

# OAuth2PasswordBearer указывает FastAPI, с какого URL будет запрашиваться токен.
# Это используется для документации Swagger UI, чтобы он знал, куда отправлять
# username/password для получения токена и как потом использовать этот токен.
# URL "/api/v1/auth/login/token" - это наш эндпоинт логина.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login/token")


async def get_current_user(
        db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)
) -> models.User:
    """
    Зависимость для получения текущего аутентифицированного пользователя.
    Извлекает токен, декодирует его, получает пользователя из БД.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token_data = decode_access_token(token)
    if token_data is None or token_data.user_id is None:  # Убедимся, что user_id есть
        raise credentials_exception

    user = crud.get_user(db, user_id=token_data.user_id)  # Получаем пользователя по ID
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(  # Пример зависимости для активного пользователя (если бы у нас было поле is_active)
        current_user: models.User = Depends(get_current_user)
) -> models.User:
    # if not current_user.is_active: # Если бы у нас было поле is_active
    #     raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


# Зависимость для проверки роли администратора
async def get_current_admin_user(
        current_user: models.User = Depends(get_current_user)
) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user

async def get_current_superuser(
    current_user: models.User = Depends(get_current_user) # Сначала получаем текущего пользователя
) -> models.User:
    if current_user.role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have superadmin privileges"
        )
    return current_user

async def get_current_admin_or_superuser(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    if current_user.role not in ["admin", "superadmin"]: # Пропускаем, если роль admin ИЛИ superadmin
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges (admin or superadmin required)"
        )
    return current_user