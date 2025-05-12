# app/main.py
import logging
import sys
import os # Для работы с путями, если будешь раздавать статику
from pathlib import Path

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse, FileResponse # FileResponse для SPA
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles # Если будешь раздавать статику
from fastapi.encoders import jsonable_encoder

from app.config import settings
from app.database import engine, Base # Убедись, что Base импортируется для create_all
from app.routers import auth, users, atms, logs

# 1. Базовая конфигурация логирования должна быть одной из первых вещей
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
        # logging.FileHandler("app.log", mode='a', encoding='utf-8') # Для вывода в файл
    ]
)
logger = logging.getLogger("app") # Даем логгеру нашего приложения имя "app"

# 2. Создание таблиц в БД (если они еще не созданы)
# Это можно делать здесь или через Alembic (для продакшена Alembic предпочтительнее)
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables checked/created successfully.")
except Exception as e:
    logger.error(f"Error creating database tables: {e}", exc_info=True)
    # В зависимости от критичности, можно здесь завершить приложение, если БД необходима
    # sys.exit(1) 

# 3. Создание экземпляра FastAPI
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.PROJECT_VERSION,
    openapi_url="/api/v1/openapi.json" # Путь к схеме OpenAPI
)

# 4. Настройка CORS Middleware (должна быть добавлена до роутеров и обработчиков исключений,
# которые могут сами возвращать ответы, на которые должен влиять CORS)
origins = [
    "http://localhost",
    "http://localhost:5173",    # Твой Vite dev server
    "http://127.0.0.1:5173",  # Также Vite dev server
    # Добавь сюда URL твоего фронтенда, если он будет деплоиться отдельно
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Разрешаем все стандартные методы
    allow_headers=["*"], # Разрешаем все заголовки
)
logger.info(f"CORS Middleware configured for origins: {origins}")

# 5. Кастомные обработчики исключений
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    raw_error_details = exc.errors()
    logger.warning(f"Raw validation error for {request.method} {request.url}: {raw_error_details}")
    
    # --- Используем jsonable_encoder для подготовки деталей к JSON ---
    serializable_error_details = jsonable_encoder(raw_error_details)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": serializable_error_details}, # Передаем сериализуемые детали
    )

@app.exception_handler(Exception) # Общий обработчик для всех остальных исключений
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception for request {request.method} {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal server error occurred."},
    )

# 6. Подключение роутеров API
# Префикс /api/v1 для всех API эндпоинтов
API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=f"{API_PREFIX}/auth", tags=["Authentication"])
app.include_router(users.router, prefix=f"{API_PREFIX}/users", tags=["Users"])
app.include_router(atms.router, prefix=f"{API_PREFIX}/atms", tags=["ATMs"])
app.include_router(logs.router, prefix=f"{API_PREFIX}/logs", tags=["Logs"])
logger.info("API routers included.")


# 8. Настройка раздачи статики фронтенда (для локального деплоя без Docker)
# Этот блок должен идти ПОСЛЕ всех API роутеров и корневого "/", 
# чтобы он перехватывал только те пути, которые не были обработаны API.

# Путь к папке dist твоего собранного фронтенда.
# Предполагаем, что структура: ProjectRoot/app/main.py и ProjectRoot/frontend/dist/
PROJECT_ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # ProjectRoot
FRONTEND_DIST_DIR = os.path.join(PROJECT_ROOT_DIR, "frontend", "dist")

if os.path.exists(os.path.join(FRONTEND_DIST_DIR, "index.html")):
    # Раздаем статические файлы (JS, CSS, картинки и т.д.) из подпапки assets (если она есть)
    # Vite обычно складывает бандлы в /assets/
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST_DIR, "assets")), name="frontend-assets")
    
    # Раздаем другие статические файлы из корня dist (например, favicon.ico)
    # Это монтирование должно быть таким, чтобы не конфликтовать с /assets и /api
    # Можно попробовать так, если нет других файлов в корне dist, кроме index.html и ассетов
    # Либо явно указать файлы, которые нужно раздавать из корня dist.
    # app.mount("/static-root", StaticFiles(directory=FRONTEND_DIST_DIR), name="frontend-root-static")


    # Обработчик для всех остальных GET запросов - должен возвращать index.html для SPA
    @app.get("/{full_path:path}", include_in_schema=False) # include_in_schema=False чтобы не отображался в Swagger
    async def serve_spa_index(request: Request, full_path: str):
        # Исключаем пути API и уже смонтированные статические пути
        if full_path.startswith("api/") or full_path.startswith("assets/") or full_path.startswith("openapi.json") or full_path.startswith("docs") or full_path.startswith("redoc"):
             # Это для отладки, в идеале такой запрос не должен доходить сюда
            logger.warning(f"SPA index handler received an API/static path: {full_path}")
            # Можно вернуть 404 или передать дальше, но лучше чтобы он сюда не попадал
            return JSONResponse(status_code=404, content={"detail": "Not found by SPA handler"})

        index_html_path = os.path.join(FRONTEND_DIST_DIR, "index.html")
        logger.info(f"Serving SPA index.html for path: {full_path}")
        return FileResponse(index_html_path)
    
    logger.info(f"SPA frontend will be served from: {FRONTEND_DIST_DIR}")
else:
    logger.warning(f"Static files directory for SPA not found at {FRONTEND_DIST_DIR}. SPA will not be served.")


# --- Пример запуска uvicorn из кода (для удобства, но обычно запускают командой) ---
# if __name__ == "__main__":
#     import uvicorn
#     logger.info("Starting Uvicorn server...")
#     # Для "деплоя" убираем --reload и используем host="0.0.0.0"
#     uvicorn.run(app, host="0.0.0.0", port=settings.APP_PORT if hasattr(settings, 'APP_PORT') else 8000)