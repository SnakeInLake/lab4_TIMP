# tests/test_users.py
from fastapi.testclient import TestClient
# test_user_data, test_user_login_data можно вынести в conftest.py или общий файл с тестовыми данными

# Данные для тестового пользователя (можно импортировать или определить заново)
test_user_data_users = {
    "username": "testuser_for_users_ep",
    "email": "testusers@example.com",
    "password": "Str0ngP@sswOrd!",
}
test_user_login_data_users = {
    "username": test_user_data_users["username"],
    "password": test_user_data_users["password"],
}

def get_auth_headers(client: TestClient, login_data: dict) -> dict:
    """Вспомогательная функция для получения заголовков авторизации."""
    response = client.post("/api/v1/auth/login/token", data=login_data)
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}

def test_read_users_me(client: TestClient):
    # Сначала зарегистрируем и залогинимся
    client.post("/api/v1/auth/signup", json=test_user_data_users)
    auth_headers = get_auth_headers(client, test_user_login_data_users)

    response = client.get("/api/v1/users/me", headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["username"] == test_user_data_users["username"]
    assert data["email"] == test_user_data_users["email"]

def test_read_users_me_unauthenticated(client: TestClient):
    response = client.get("/api/v1/users/me") # Без заголовка Authorization
    assert response.status_code == 401 # Или 403, если FastAPI так настроен для OAuth2PasswordBearer по умолчанию
    # Проверьте точный статус и сообщение, которое возвращает ваш API
    # assert "Not authenticated" in response.json()["detail"] # Пример