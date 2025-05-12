# app/routers/atms.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional

# Импортируем все необходимое из наших модулей
from app import crud, models, schemas
from app.database import get_db
from app.deps import get_current_user, get_current_admin_or_superuser
from fastapi.responses import JSONResponse  # Нужен для установки заголовков

router = APIRouter()


# --- Эндпоинт для получения списка статусов ---
# Важно определить его ДО эндпоинта GET /{atm_id}, чтобы /statuses не считался ID
@router.get("/statuses/", response_model=List[schemas.ATMStatus])
async def read_atm_statuses(db: Session = Depends(get_db)):
    """
    Получение списка всех возможных статусов банкоматов.
    """
    statuses = db.query(models.ATMStatus).order_by(models.ATMStatus.id).all()
    return statuses


# --- Эндпоинт для получения списка банкоматов (с пагинацией и фильтрацией) ---
@router.get("/", response_model=List[schemas.ATM])
async def read_atms(
        # !!! ВАЖНО: Объект Response НЕ НУЖЕН как аргумент, если возвращаем JSONResponse !!!
        # Вместо этого FastAPI предоставит его неявно, если нужно,
        # но для JSONResponse он не требуется в аргументах.
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=1000),
        status_id: Optional[int] = Query(None, description="Filter by status ID"),
        location: Optional[str] = Query(None, description="Search keyword for location"),
        # --- Новый параметр для фильтрации по UID ---
        atm_uid: Optional[str] = Query(None, description="Search keyword for ATM UID"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Получение списка банкоматов с пагинацией и расширенной фильтрацией.
    Возвращает заголовок X-Total-Count с общим количеством.
    """
    # Получаем общее количество с учетом всех фильтров
    total_count = crud.get_atms_count(
        db,
        status_id=status_id,
        location_keyword=location,
        atm_uid_keyword=atm_uid  # Передаем новый фильтр
    )

    # Получаем саму страницу данных с учетом всех фильтров
    atms = crud.get_atms(
        db,
        skip=skip,
        limit=limit,
        status_id=status_id,
        location_keyword=location,
        atm_uid_keyword=atm_uid  # Передаем новый фильтр
    )

    # Используем jsonable_encoder для корректной сериализации datetime и др. типов
    from fastapi.encoders import jsonable_encoder
    content_to_serialize = jsonable_encoder(atms)

    # Возвращаем JSONResponse с контентом и заголовками
    return JSONResponse(
        content=content_to_serialize,
        headers={
            "X-Total-Count": str(total_count),
            "Access-Control-Expose-Headers": "X-Total-Count"
        }
    )


# --- Эндпоинт создания банкомата ---
@router.post("/", response_model=schemas.ATM, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=schemas.ATM, status_code=status.HTTP_201_CREATED)
async def create_new_atm(
        atm_in: schemas.ATMCreate,
        db: Session = Depends(get_db),
        # Меняем зависимость для проверки прав администратора или суперадминистратора
        current_user_with_admin_rights: models.User = Depends(get_current_admin_or_superuser)
):
    """
    Создание нового банкомата.
    Доступно только администраторам или суперадминистраторам.
    """
    existing_atm = crud.get_atm_by_uid(db, atm_uid=atm_in.atm_uid)
    if existing_atm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ATM with UID {atm_in.atm_uid} already exists."
        )
    status_obj = db.query(models.ATMStatus).filter(models.ATMStatus.id == atm_in.status_id).first()
    if not status_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ATMStatus with id {atm_in.status_id} not found."
        )

    try:
        # Передаем ID пользователя из проверенной зависимости
        created_atm = crud.create_atm(db=db, atm=atm_in, user_id=current_user_with_admin_rights.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return created_atm

# --- Эндпоинт получения одного банкомата по ID ---
@router.get("/{atm_id}", response_model=schemas.ATM)
async def read_atm_by_id(
        atm_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Получение информации о конкретном банкомате по его ID.
    """
    db_atm = crud.get_atm(db, atm_id=atm_id)
    if db_atm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ATM not found")
    return db_atm  # FastAPI сам обработает через response_model


# --- Эндпоинт обновления банкомата ---
@router.put("/{atm_id}", response_model=schemas.ATM)
async def update_existing_atm(
        atm_id: int,
        atm_in: schemas.ATMUpdate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Обновление информации о банкомате.
    Доступно создателю банкомата или администратору/суперадминистратору.
    """
    db_atm = crud.get_atm(db, atm_id=atm_id)
    if db_atm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ATM not found")

    # Проверка прав: создатель ИЛИ админ ИЛИ суперадмин
    if not (db_atm.added_by_user_id == current_user.id or current_user.role in ["admin", "superadmin"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update this ATM"
        )

    # Проверка status_id, если он передан
    if atm_in.status_id is not None:
        status_obj = db.query(models.ATMStatus).filter(models.ATMStatus.id == atm_in.status_id).first()
        if not status_obj:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ATMStatus with id {atm_in.status_id} not found for update."
            )

    # Проверка уникальности atm_uid, если он передается и отличается от текущего
    if atm_in.atm_uid is not None and atm_in.atm_uid != db_atm.atm_uid:
        existing_atm = crud.get_atm_by_uid(db, atm_uid=atm_in.atm_uid)
        if existing_atm:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ATM with UID {atm_in.atm_uid} already exists."
            )

    try:
        updated_atm = crud.update_atm(db=db, db_atm=db_atm, atm_in=atm_in)
    except ValueError as e:  # Ловим ошибки из CRUD
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return updated_atm  # FastAPI сам обработает через response_model


# --- Эндпоинт удаления банкомата ---
@router.delete("/{atm_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_existing_atm(
        atm_id: int,
        db: Session = Depends(get_db),
        # Используем зависимость, которая пропускает admin и superadmin
        current_user_with_admin_rights: models.User = Depends(get_current_admin_or_superuser)
):
    """
    Удаление банкомата (только для администраторов или суперадминистраторов).
    """
    deleted_atm = crud.delete_atm(db, atm_id=atm_id)
    if deleted_atm is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ATM not found")
    # Возвращаем Response с кодом 204, тело будет пустым
    return Response(status_code=status.HTTP_204_NO_CONTENT)