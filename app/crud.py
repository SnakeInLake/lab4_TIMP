# app/crud.py
from sqlalchemy.orm import Session
from typing import List, Optional # Добавили Optional и List

from app import models, schemas
from app.security import get_password_hash

from datetime import datetime, timezone
from sqlalchemy.exc import IntegrityError
from sqlalchemy import desc, func as sql_func
from sqlalchemy import func
# --- User CRUD (оставляем как было) ---
def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()

def get_user_by_username(db: Session, username: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: schemas.UserCreate) -> models.User:
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        role='operator'
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[models.User]: # Добавим для админов
    return db.query(models.User).offset(skip).limit(limit).all()


# --- ATM CRUD ---
def get_atm(db: Session, atm_id: int) -> Optional[models.ATM]:
    """Получает банкомат по ID."""
    return db.query(models.ATM).filter(models.ATM.id == atm_id).first()

def get_atm_by_uid(db: Session, atm_uid: str) -> Optional[models.ATM]:
    """Получает банкомат по его уникальному идентификатору (atm_uid)."""
    return db.query(models.ATM).filter(models.ATM.atm_uid == atm_uid).first()


def get_atms(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        status_id: Optional[int] = None,
        location_keyword: Optional[str] = None,
        atm_uid_keyword: Optional[str] = None  # <-- Новый параметр
) -> List[models.ATM]:
    query = db.query(models.ATM)
    if status_id is not None:
        query = query.filter(models.ATM.status_id == status_id)
    if location_keyword:
        query = query.filter(models.ATM.location_description.ilike(f"%{location_keyword}%"))
    if atm_uid_keyword:  # <-- Новый фильтр
        query = query.filter(models.ATM.atm_uid.ilike(f"%{atm_uid_keyword}%"))

    # TODO: Сортировка
    return query.offset(skip).limit(limit).all()


def get_atms_count(
        db: Session,
        status_id: Optional[int] = None,
        location_keyword: Optional[str] = None,
        atm_uid_keyword: Optional[str] = None  # <-- Новый параметр
) -> int:
    query = db.query(sql_func.count(models.ATM.id))
    if status_id is not None:
        query = query.filter(models.ATM.status_id == status_id)
    if location_keyword:
        query = query.filter(models.ATM.location_description.ilike(f"%{location_keyword}%"))
    if atm_uid_keyword:  # <-- Новый фильтр
        query = query.filter(models.ATM.atm_uid.ilike(f"%{atm_uid_keyword}%"))

    total_count = query.scalar()
    return total_count if total_count is not None else 0

def create_atm(db: Session, atm: schemas.ATMCreate, user_id: int) -> models.ATM:
    """Создает новый банкомат."""
    # Проверка на существование статуса (если нужно, но FK constraint это сделает)
    # status = db.query(models.ATMStatus).filter(models.ATMStatus.id == atm.status_id).first()
    # if not status:
    #     raise ValueError(f"Status with id {atm.status_id} not found")

    db_atm = models.ATM(
        **atm.model_dump(), # Используем model_dump() для Pydantic V2
        added_by_user_id=user_id
    )
    db.add(db_atm)
    db.commit()
    db.refresh(db_atm)
    return db_atm

def update_atm(
    db: Session, db_atm: models.ATM, atm_in: schemas.ATMUpdate
) -> models.ATM:
    """Обновляет информацию о банкомате."""
    update_data = atm_in.model_dump(exclude_unset=True) # exclude_unset=True для частичного обновления
    for key, value in update_data.items():
        setattr(db_atm, key, value)
    db.add(db_atm) # или db.merge(db_atm)
    db.commit()
    db.refresh(db_atm)
    return db_atm

def delete_atm(db: Session, atm_id: int) -> Optional[models.ATM]:
    """Удаляет банкомат."""
    db_atm = db.query(models.ATM).filter(models.ATM.id == atm_id).first()
    if db_atm:
        db.delete(db_atm)
        db.commit()
        return db_atm
    return None


# --- ATMLog CRUD ---
def get_atm_log(db: Session, log_id: int) -> Optional[models.ATMLog]:
    """Получает запись лога по ID."""
    return db.query(models.ATMLog).filter(models.ATMLog.id == log_id).first()


def get_atm_logs(
        db: Session,
        skip: int = 0,
        limit: int = 100,
        atm_id: Optional[int] = None,
        log_level_id: Optional[int] = None,
        event_type_id: Optional[int] = None,
        is_alert: Optional[bool] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        message_keyword: Optional[str] = None,
        sort_by_timestamp_desc: bool = True  # По умолчанию сортируем по убыванию времени
) -> List[models.ATMLog]:
    """Получает список логов с пагинацией и фильтрацией."""
    query = db.query(models.ATMLog)

    if atm_id is not None:
        query = query.filter(models.ATMLog.atm_id == atm_id)
    if log_level_id is not None:
        query = query.filter(models.ATMLog.log_level_id == log_level_id)
    if event_type_id is not None:
        query = query.filter(models.ATMLog.event_type_id == event_type_id)
    if is_alert is not None:
        query = query.filter(models.ATMLog.is_alert == is_alert)
    if start_time:
        query = query.filter(models.ATMLog.event_timestamp >= start_time)
    if end_time:
        query = query.filter(models.ATMLog.event_timestamp <= end_time)
    if message_keyword:
        query = query.filter(models.ATMLog.message.ilike(f"%{message_keyword}%"))

    if sort_by_timestamp_desc:
        query = query.order_by(desc(models.ATMLog.event_timestamp))  # Сортировка
    else:
        query = query.order_by(models.ATMLog.event_timestamp)

    return query.offset(skip).limit(limit).all()
def get_log_levels(db: Session) -> List[models.LogLevel]:
    return db.query(models.LogLevel).order_by(models.LogLevel.severity_order, models.LogLevel.name).all()

def get_event_types(db: Session) -> List[models.EventType]:
    return db.query(models.EventType).order_by(models.EventType.category, models.EventType.name).all()

# Функция для подсчета общего количества логов для пагинации
def get_atm_logs_count(
    db: Session,
    atm_id: Optional[int] = None,
    log_level_id: Optional[int] = None,
    event_type_id: Optional[int] = None,
    is_alert: Optional[bool] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    message_keyword: Optional[str] = None
) -> int:
    query = db.query(func.count(models.ATMLog.id)) # Считаем количество ID

    if atm_id is not None:
        query = query.filter(models.ATMLog.atm_id == atm_id)
    if log_level_id is not None:
        query = query.filter(models.ATMLog.log_level_id == log_level_id)
    if event_type_id is not None:
        query = query.filter(models.ATMLog.event_type_id == event_type_id)
    if is_alert is not None:
        query = query.filter(models.ATMLog.is_alert == is_alert)
    if start_time:
        query = query.filter(models.ATMLog.event_timestamp >= start_time)
    if end_time:
        query = query.filter(models.ATMLog.event_timestamp <= end_time)
    if message_keyword:
        # Для поиска по части строки используем ilike (нечувствительный к регистру) или like
        query = query.filter(models.ATMLog.message.ilike(f"%{message_keyword}%"))

    count = query.scalar() # scalar_one_or_none вернет None если нет записей, 0 если 0.
    return count if count is not None else 0


def create_atm_log(db: Session, log: schemas.ATMLogCreate, atm_id: int) -> models.ATMLog:
    """Создает новую запись лога для указанного банкомата."""
    # Проверки на существование atm_id, log_level_id, event_type_id (если нужно, но FK сделают это)
    # ...
    db_log = models.ATMLog(
        **log.model_dump(),
        atm_id=atm_id
    )
    db.add(db_log)
    try:
        db.commit()
        db.refresh(db_log)
    except IntegrityError as e: # Перехватываем ошибки БД (FK и т.д.)
         db.rollback()
         raise ValueError(f"Database error: {e}") # Пример обработки ошибки БД
    return db_log


def acknowledge_alert(
        db: Session, db_log: models.ATMLog, user_id: int
) -> models.ATMLog:
    """Помечает алерт (is_alert=True) как подтвержденный текущим пользователем."""

    if not db_log.is_alert:
        raise ValueError("Cannot acknowledge a non-alert log entry.")  # Лучше явная ошибка

    if db_log.acknowledged_by_user_id is not None:
        raise ValueError(f"Alert log {db_log.id} was already acknowledged by user {db_log.acknowledged_by_user_id}.")

    db_log.acknowledged_by_user_id = user_id
    db_log.acknowledged_at = datetime.now(timezone.utc)

    db.add(db_log)
    db.commit()
    db.refresh(db_log)

    _ = db_log.log_level
    if db_log.event_type:
        _ = db_log.event_type

    return db_log


def update_log_alert_status(
        db: Session, db_log: models.ATMLog, is_alert: bool
) -> models.ATMLog:
    """Обновляет статус is_alert для лога."""
    db_log.is_alert = is_alert

    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[models.User]:  # Эта функция у нас уже должна быть
    return db.query(models.User).offset(skip).limit(limit).all()


def update_user_role(db: Session, db_user: models.User, new_role: str) -> models.User:
    ALLOWED_ROLES = ["operator", "admin", "superadmin"]
    if new_role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role: {new_role}. Allowed roles are {', '.join(ALLOWED_ROLES)}.")

    db_user.role = new_role
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def delete_user(db: Session, user_id: int, current_user_id: int) -> Optional[models.User]:
    """
    Удаляет пользователя по ID.
    Не позволяет пользователю удалить самого себя через этот метод.
    """
    if user_id == current_user_id:
        # Можно либо вернуть None и обработать в роутере, либо сразу выкинуть ошибку
        # raise ValueError("User cannot delete themselves through this endpoint.")
        # Лучше вернуть None, чтобы роутер вернул корректный HTTP ответ
        return None # Сигнализируем, что операция не выполнена по этой причине

    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if db_user:
        # Дополнительная проверка: не удаляем последнего суперадмина
        if db_user.role == "superadmin":
            superadmin_count = db.query(models.User).filter(models.User.role == "superadmin").count()
            if superadmin_count <= 1:
                # raise ValueError("Cannot delete the last superadmin.")
                # Опять же, лучше вернуть специальное значение или None,
                # чтобы роутер мог вернуть осмысленную ошибку.
                # Для простоты пока просто вернем None, а в роутере вернем 400/403.
                # Либо, если хотим передать ошибку, создадим кастомный Exception или ValueError.
                # Давайте пока вернем None, подразумевая "не могу удалить" по бизнес-логике.
                # Но для более явного ответа можно сделать так:
                # return {"error": "Cannot delete the last superadmin."} - если бы функция возвращала dict
                # или выкинуть ошибку, которую поймаем в роутере.
                # Для一致性, вернем None, и роутер решит, что это за ошибка.
                # Чтобы различать "не найден" от "нельзя удалить", можно сделать так:
                # db.expunge(db_user) # убираем из сессии, но не удаляем
                # db_user.cannot_delete_reason = "last_superadmin"
                # return db_user
                # ... но это усложнение. Пока просто вернем None, если не можем удалить по этой причине.
                # Для лучшей диагностики, давайте все же выкинем ValueError, чтобы роутер мог его обработать.
                raise ValueError("Cannot delete the last superadmin. System requires at least one superadmin.")


        db.delete(db_user)
        db.commit()
        return db_user # Возвращаем удаленного пользователя (или его копию до удаления)
    return None # Пользователь не найден