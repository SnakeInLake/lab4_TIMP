# app/routers/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta

from app import crud, schemas, models  # Убедись, что models импортирован, если он нужен для current_user типа
from app.database import get_db
from app.security import create_access_token, verify_password
from app.config import settings
from app.deps import get_current_user  # Наша зависимость для проверки токена

router = APIRouter()


@router.post("/signup", response_model=schemas.User, status_code=status.HTTP_201_CREATED)
async def signup_new_user(
        user_in: schemas.UserCreate,
        db: Session = Depends(get_db)
):
    # ... (существующий код signup)
    db_user_by_email = crud.get_user_by_email(db, email=user_in.email)
    if db_user_by_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Почта уже зарегистрирована"
        )

    db_user_by_username = crud.get_user_by_username(db, username=user_in.username)
    if db_user_by_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Имя пользователя занято"
        )

    created_user = crud.create_user(db=db, user=user_in)
    return created_user


@router.post("/login/token", response_model=schemas.Token)
async def login_for_access_token(
        form_data: OAuth2PasswordRequestForm = Depends(),
        db: Session = Depends(get_db)
):
    user = crud.get_user_by_username(db, username=form_data.username)
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неправильное имя пользователя или пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)  # Используем из settings
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


# Новый эндпоинт для валидации токена
@router.post("/validate-token",
             response_model=schemas.User)  # Используем POST, т.к. GET не должен иметь тела, а токен передается в заголовке
async def validate_access_token(
        current_user: models.User = Depends(get_current_user)  # Тип current_user - это SQLAlchemy модель
):
    """
    Проверяет валидность текущего токена доступа.
    Если токен валиден, возвращает информацию о пользователе.
    Если невалиден, зависимость get_current_user выбросит 401.
    """
    return current_user