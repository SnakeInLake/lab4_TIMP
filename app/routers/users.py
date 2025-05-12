# app/routers/users.py
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app import crud, models, schemas
from app.database import get_db
from app.deps import get_current_user, get_current_admin_user, get_current_superuser, get_current_admin_or_superuser  # Добавили get_current_admin_user

router = APIRouter()


@router.get("/me", response_model=schemas.User)
async def read_users_me(
        current_user: models.User = Depends(get_current_user)
):
    """
    Получение информации о текущем аутентифицированном пользователе.
    """
    return current_user


# Новый эндпоинт: получение списка всех пользователей (только для админа)
@router.get("/", response_model=List[schemas.User])
async def read_all_users(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db),
        current_user_with_admin_rights: models.User = Depends(get_current_admin_or_superuser)
):
    """
    Получение списка всех пользователей.
    Доступно только пользователям с ролью 'admin'.
    """
    users = crud.get_users(db, skip=skip, limit=limit)
    return users


# Новый эндпоинт: изменение роли пользователя (только для админа)
@router.put("/{user_id}/role", response_model=schemas.User)
async def change_user_role(
        user_id: int,
        role_update_in: schemas.UserRoleUpdate,
        db: Session = Depends(get_db),
        # Защищаем сразу - должен быть superadmin
        requesting_user: models.User = Depends(get_current_superuser)
):
    db_user_to_update = crud.get_user(db, user_id=user_id)
    if db_user_to_update is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    new_role = role_update_in.role  # Новая роль из запроса

    # Защита от понижения собственной роли (если нужно, можно добавить проверку на единственного суперадмина)
    if db_user_to_update.id == requesting_user.id and new_role != "superadmin":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A superadmin cannot change their own role to a lower one through this endpoint."
        )

    try:
        updated_user = crud.update_user_role(db=db, db_user=db_user_to_update, new_role=new_role)
    except ValueError as e:  # Ошибка, если роль недопустима (из CRUD)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # ВОЗВРАЩАЕМ РЕЗУЛЬТАТ ПОСЛЕ УСПЕШНОГО ОБНОВЛЕНИЯ
    return updated_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_by_id(
        user_id: int,
        db: Session = Depends(get_db),
        # Только superadmin может удалять пользователей
        current_superadmin: models.User = Depends(get_current_superuser)
):
    """
    Удаление пользователя по ID.
    Доступно только для пользователей с ролью 'superadmin'.
    Суперадминистратор не может удалить сам себя через этот эндпоинт.
    Нельзя удалить последнего суперадминистратора.
    """
    if user_id == current_superadmin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin cannot delete themselves using this endpoint. Use a dedicated account deletion feature if available."
        )

    # Проверяем, существует ли пользователь перед попыткой удаления
    # Это важно, чтобы отличить 404 (не найден) от других ошибок.
    user_to_delete = crud.get_user(db, user_id=user_id)
    if not user_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Специальная защита от удаления последнего суперадмина, если целевой пользователь - суперадмин
    if user_to_delete.role == "superadmin":
        superadmin_count = db.query(models.User).filter(models.User.role == "superadmin").count()
        if superadmin_count <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,  # или 403 FORBIDDEN
                detail="Cannot delete the last superadmin. The system requires at least one superadmin."
            )

    # Попытка удаления
    deleted_user = crud.delete_user(db, user_id=user_id, current_user_id=current_superadmin.id)

    # crud.delete_user вернет None, если пользователь не найден (мы это проверили выше)
    # или если была попытка удалить себя (мы это тоже проверили выше)
    # или если не удалось удалить по причине "последнего суперадмина" (это мы тоже проверили)
    # Таким образом, если мы дошли сюда, и deleted_user is None, то это ошибка в логике crud
    # Но мы уже обработали основные случаи выше.
    # Если deleted_user все же None после всех проверок - значит его не нашли (что странно, т.к. мы делали get_user)
    # Для более точной обработки, можно было бы в crud.delete_user бросать кастомные исключения.
    # Сейчас, если crud.delete_user вернул None после всех проверок, то это значит "не найден",
    # но мы уже убедились, что он есть.

    # Если мы здесь, значит crud.delete_user успешно отработал (или должен был)
    # Возвращаем 204 No Content, тело будет пустым
    return Response(status_code=status.HTTP_204_NO_CONTENT)