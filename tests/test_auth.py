# tests/test_auth.py
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session  # Для тайп-хинтинга, если нужно будет напрямую с БД в тестах
from app import schemas  # Наши Pydantic схемы

# из conftest.py фикстура client будет доступна автоматически

# Данные для тестового пользователя
test_user_data = {
    "username": "testuser_auth",
    "email": "testauth@example.com",
    "password": "Str0ngP@sswOrd!",  # Соответствует нашим новым правилам валидации
    "role": "operator"  # Убедись, что UserCreate может принимать роль или она устанавливается по умолчанию
}
test_user_login_data = {  # Для OAuth2PasswordRequestForm
    "username": test_user_data["username"],
    "password": test_user_data["password"],
}


def test_user_signup(client: TestClient):
    response = client.post("/api/v1/auth/signup", json=test_user_data)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["email"] == test_user_data["email"]
    assert data["username"] == test_user_data["username"]
    assert "id" in data
    # Убедимся, что пароль не возвращается
    assert "password_hash" not in data
    assert "password" not in data


# tests/test_auth.py
def test_user_signup_duplicate_username_or_email(client: TestClient):  # Переименуем для ясности
    # Убедимся, что пользователь с такими данными уже есть
    # (например, если test_user_signup не вызывался перед этим тестом из-за порядка запуска)
    initial_response = client.post("/api/v1/auth/signup", json=test_user_data)
    # Мы не проверяем тут initial_response.status_code, так как он может быть 201 или 400

    response = client.post("/api/v1/auth/signup", json=test_user_data)  # Повторная попытка
    assert response.status_code == 400, response.text
    detail = response.json()["detail"]
    assert "Почта уже зарегистрирована" in detail or "Имя пользователя занято" in detail


def test_login_for_access_token(client: TestClient):
    # Сначала убедимся, что пользователь существует (или создадим его)
    # Проще всего здесь положиться на то, что test_user_signup отработал ранее,
    # либо создать пользователя через API или напрямую в тестовой БД, если нужно
    # client.post("/api/v1/auth/signup", json=test_user_data) # Гарантируем наличие пользователя

    response = client.post("/api/v1/auth/login/token", data=test_user_login_data)  # data= для form-data
    assert response.status_code == 200, response.text
    token_data = response.json()
    assert "access_token" in token_data
    assert token_data["token_type"] == "bearer"
    return token_data["access_token"]  # Возвращаем токен для использования в других тестах (через pytest фикстуры)


def test_login_wrong_password(client: TestClient):
    wrong_login_data = test_user_login_data.copy()
    wrong_login_data["password"] = "wrongpassword"
    response = client.post("/api/v1/auth/login/token", data=wrong_login_data)
    assert response.status_code == 401, response.text
    assert "Неправильное имя пользователя или пароль" in response.json()["detail"]


def test_validate_token(client: TestClient):
    # Получаем токен
    login_response = client.post("/api/v1/auth/login/token", data=test_user_login_data)
    assert login_response.status_code == 200
    access_token = login_response.json()["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}
    response_validate = client.post("/api/v1/auth/validate-token", headers=headers)
    assert response_validate.status_code == 200, response_validate.text
    user_data = response_validate.json()
    assert user_data["username"] == test_user_data["username"]


def test_validate_invalid_token(client: TestClient):
    headers = {"Authorization": "Bearer invalidtoken"}
    response_validate = client.post("/api/v1/auth/validate-token", headers=headers)
    assert response_validate.status_code == 401  # Или 403 в зависимости от FastAPI/Starlette обработки
    # Обычно 401 с деталями от нашей зависимости