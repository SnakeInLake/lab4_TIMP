# tests/test_atms.py
from fastapi.testclient import TestClient
# ... (импорты и вспомогательные функции, как в test_users.py) ...
def get_auth_headers(client: TestClient, login_data: dict) -> dict:
    """Вспомогательная функция для получения заголовков авторизации."""
    response = client.post("/api/v1/auth/login/token", data=login_data)
    assert response.status_code == 200, f"Login failed: {response.text}" # Добавил f-string для отладки
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
# Нужно будет создать оператора и админа для тестов
# Для простоты пока будем использовать одного оператора
operator_data = {"username": "atm_operator", "email": "atm_op@example.com", "password": "Str0ngP@sswOrd!"}
operator_login_data = {"username": operator_data["username"], "password": operator_data["password"]}

# Данные для создания ATM (убедись, что status_id существует в твоих тестовых данных справочника)
# В conftest.py можно добавить фикстуру для заполнения справочников начальными данными
# Предположим, status_id=1 это 'active'
atm_create_data = {
    "atm_uid": "TESTATM001",
    "location_description": "Test Location",
    "status_id": 1
}
created_atm_id = None # Будем хранить ID созданного ATM

def test_create_atm(client: TestClient):
    global created_atm_id
    # Регистрация и логин оператора
    client.post("/api/v1/auth/signup", json=operator_data)
    auth_headers = get_auth_headers(client, operator_login_data)

    response = client.post("/api/v1/atms/", headers=auth_headers, json=atm_create_data)
    assert response.status_code == 201, response.text
    data = response.json()
    assert data["atm_uid"] == atm_create_data["atm_uid"]
    created_atm_id = data["id"] # Сохраняем ID для других тестов

def test_read_atms(client: TestClient):
    auth_headers = get_auth_headers(client, operator_login_data) # Логинимся снова или используем сохраненный токен
    response = client.get("/api/v1/atms/", headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()
    assert isinstance(data, list)
    # Проверить, что созданный ATM есть в списке (если список непустой)
    if created_atm_id and data:
        assert any(atm["id"] == created_atm_id for atm in data)

# ... Добавить тесты для GET /atms/{atm_id}, PUT /atms/{atm_id}, DELETE /atms/{atm_id} ...
# Для DELETE потребуется админ, что усложнит настройку фикстур.