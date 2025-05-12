# app/routers/logs.py
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app import crud, models, schemas
from app.database import get_db
from app.deps import get_current_user  # Наша зависимость

router = APIRouter()
@router.get("/levels/", response_model=List[schemas.LogLevel])
async def read_log_levels(
    db: Session = Depends(get_db),
    # current_user: models.User = Depends(get_current_user) # Раскомментируй, если нужна аутентификация
):
    """
    Получение списка всех уровней логов.
    """
    log_levels = crud.get_log_levels(db=db)
    return log_levels

@router.get("/event_types/", response_model=List[schemas.EventType])
async def read_event_types(
    db: Session = Depends(get_db),
    # current_user: models.User = Depends(get_current_user) # Раскомментируй, если нужна аутентификация
):
    """
    Получение списка всех типов событий.
    """
    event_types = crud.get_event_types(db=db)
    return event_types

@router.post("/atms/{atm_id}/logs/", response_model=schemas.ATMLog, status_code=status.HTTP_201_CREATED)
async def create_log_for_atm(
        atm_id: int,
        log_in: schemas.ATMLogCreate,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)  # Любой аутентифицированный пользователь
):
    """
    Создание новой записи лога для указанного банкомата.
    """
    db_atm = crud.get_atm(db, atm_id=atm_id)
    if not db_atm:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="ATM not found")

    # Дополнительные проверки для log_level_id и event_type_id (если ID не существует)
    log_level = db.query(models.LogLevel).filter(models.LogLevel.id == log_in.log_level_id).first()
    if not log_level:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                            detail=f"LogLevel with id {log_in.log_level_id} not found.")

    if log_in.event_type_id is not None:
        event_type = db.query(models.EventType).filter(models.EventType.id == log_in.event_type_id).first()
        if not event_type:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,
                                detail=f"EventType with id {log_in.event_type_id} not found.")

    return crud.create_atm_log(db=db, log=log_in, atm_id=atm_id)


@router.get("/", response_model=List[schemas.ATMLog])
async def read_logs(
        response: Response, # Добавлено для установки заголовка
        skip: int = Query(0, ge=0),
        limit: int = Query(100, ge=1, le=1000),
        atm_id: Optional[int] = Query(None, description="Filter by ATM ID"),
        log_level_id: Optional[int] = Query(None, description="Filter by LogLevel ID"),
        event_type_id: Optional[int] = Query(None, description="Filter by EventType ID"),
        is_alert: Optional[bool] = Query(None, description="Filter by alert status"),
        start_time: Optional[datetime] = Query(None, description="Filter logs from this time (ISO format)"),
        end_time: Optional[datetime] = Query(None, description="Filter logs up to this time (ISO format)"),
        message: Optional[str] = Query(None, description="Search keyword in log message"),
        # Изменим параметр сортировки для соответствия фронтенду (если нужно)
        # или оставим sort_desc и не будем использовать sort_by/sort_order с фронта
        sort_by: Optional[str] = Query("event_timestamp", description="Field to sort by"), # Пример, если нужна серверная сортировка
        sort_order: Optional[str] = Query("desc", description="Sort order: 'asc' or 'desc'"), # Пример
        # sort_desc: bool = Query(True, description="Sort by event_timestamp descending"), # Старый вариант
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Получение списка логов с пагинацией и расширенной фильтрацией.
    """
    # Получаем общее количество для X-Total-Count
    total_count = crud.get_atm_logs_count(
        db, atm_id=atm_id, log_level_id=log_level_id,
        event_type_id=event_type_id, is_alert=is_alert, start_time=start_time,
        end_time=end_time, message_keyword=message
    )
    response.headers["X-Total-Count"] = str(total_count)
    # Важно для CORS, чтобы фронтенд мог прочитать этот заголовок
    response.headers["Access-Control-Expose-Headers"] = "X-Total-Count"


    # Пример логики для серверной сортировки, если решишь ее использовать:
    # sort_desc_param = True if sort_order == "desc" else False
    # sort_by_param = sort_by # тут нужна валидация поля sort_by

    logs = crud.get_atm_logs(
        db, skip=skip, limit=limit, atm_id=atm_id, log_level_id=log_level_id,
        event_type_id=event_type_id, is_alert=is_alert, start_time=start_time,
        end_time=end_time, message_keyword=message,
        # sort_by_field=sort_by_param, # передаем поле для сортировки
        # sort_desc=sort_desc_param # передаем направление
        sort_by_timestamp_desc=(sort_by == "event_timestamp" and sort_order == "desc") # упрощенный вариант для старого crud
    )
    return logs


@router.get("/{log_id}", response_model=schemas.ATMLog)
async def read_log_by_id(
        log_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    """
    Получение информации о конкретной записи лога.
    """
    db_log = crud.get_atm_log(db, log_id=log_id)
    if db_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")
    return db_log


@router.patch("/{log_id}/acknowledge", response_model=schemas.ATMLog)
async def acknowledge_log_alert(
        log_id: int,
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)
):
    db_log = crud.get_atm_log(db, log_id=log_id)
    if db_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")
    if not db_log.is_alert:  # Проверка здесь
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot acknowledge a non-alert log")
    if db_log.acknowledged_by_user_id is not None:  # Проверка, что еще не подтвержден
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Alert already acknowledged")

    return crud.acknowledge_alert(db=db, db_log=db_log, user_id=current_user.id)


@router.patch("/{log_id}/alert_status", response_model=schemas.ATMLog)
async def set_log_alert_status(
        log_id: int,
        set_alert: bool = Query(..., alias="isAlert", description="Set to true to mark as alert, false to unmark"),
        db: Session = Depends(get_db),
        current_user: models.User = Depends(get_current_user)  # Возможно, только админ или спец. роль?
):
    """
    Установка или снятие флага 'is_alert' для записи лога.
    """
    db_log = crud.get_atm_log(db, log_id=log_id)
    if db_log is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log entry not found")

    return crud.update_log_alert_status(db=db, db_log=db_log, is_alert=set_alert)