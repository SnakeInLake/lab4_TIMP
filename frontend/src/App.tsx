// src/App.tsx
import { useState, useEffect, useCallback, type JSX } from 'react';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Link,
    useNavigate,
    Navigate,
    useLocation // Добавляем useLocation
} from 'react-router-dom';
import apiClient, { UNAUTHORIZED_EVENT } from '../services/api'; // Импортируем UNAUTHORIZED_EVENT
import LoginPage from '../pages/LoginPage';
import RegisterPage from '../pages/RegisterPage';
import ATMsPage from '../pages/ATMsPage';
import ATMDetailPage from '../pages/ATMDetailPage';
import ATMLogsPage from '../pages/ATMLogsPage';
import ATMEditPage from '../pages/ATMEditPage';
import UserManagementPage from '../pages/UserManagementPage';
import ATMCreatePage from '../pages/ATMCreatePage';

// Определим интерфейс для пользователя (согласно schemas.User)
interface User {
    id: number;
    username: string;
    email: string;
    role: 'operator' | 'admin' | 'superadmin';
    created_at: string;
    updated_at: string;
}

// Navbar остается без изменений (как в вашем коде)
const Navbar = ({ user, onLogout }: { user: User | null; onLogout: () => void }) => {
    const isAdminOrSuper = user?.role === 'admin' || user?.role === 'superadmin';

    const handleLogoutClick = () => {
      onLogout();
    };

    return (
      <nav style={{ marginBottom: '20px', paddingBottom: '10px', borderBottom: '1px solid #ccc' }}>
        {user && <Link to="/atms" style={{ marginRight: '10px' }}>Банкоматы</Link>}
        {isAdminOrSuper && <Link to="/users" style={{ marginRight: '10px' }}>Пользователи</Link>}
        {isAdminOrSuper && <Link to="/atms/new" style={{ marginRight: '10px' }}>Добавить ATM</Link>}
        {!user && <Link to="/login" style={{ marginRight: '10px' }}>Вход</Link>}
        {!user && <Link to="/register" style={{ marginRight: '10px' }}>Регистрация</Link>}
        {user && <span style={{marginRight: '15px'}}>({user.username} - {user.role})</span>}
        {user && <button onClick={handleLogoutClick}>Выход</button>}
      </nav>
    );
};


// ProtectedRoute (остается как есть)
const ProtectedRoute = ({ children }: { children: JSX.Element }) => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return <Navigate to="/login" replace />;
    }
    return children;
};

// Создаем компонент-обертку для основного контента, чтобы использовать хуки роутера
const AppContent = () => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('accessToken'));
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [authLoading, setAuthLoading] = useState<boolean>(true);
    const navigate = useNavigate(); // Хук для навигации
    const location = useLocation(); // Для проверки текущего пути

    const fetchCurrentUser = useCallback(async (currentTokenValue: string | null) => {
        if (currentTokenValue) {
            try {
              const response = await apiClient.post<User>('/auth/validate-token');
              setCurrentUser(response.data);
              // setToken(currentTokenValue); // Не нужно, т.к. токен в localStorage уже есть
            } catch (error: any) { // error может быть AxiosError, проверяем response
                console.error("Token validation/fetch user failed:", error);
                // Если ошибка 401, интерсептор уже удалил токен и сгенерировал событие.
                // Здесь просто сбрасываем локальные состояния.
                localStorage.removeItem('accessToken');
                setToken(null);
                setCurrentUser(null);
                // Редирект будет обработан слушателем события или ProtectedRoute
            }
        }
        setAuthLoading(false);
    }, []); 

    // Загружаем данные пользователя при монтировании или изменении токена
    useEffect(() => {
        const currentTokenFromStorage = localStorage.getItem('accessToken');
        setToken(currentTokenFromStorage); // Синхронизируем стейт с localStorage
        if (currentTokenFromStorage) {
            setAuthLoading(true); // Начинаем загрузку, если токен есть
            fetchCurrentUser(currentTokenFromStorage);
        } else {
            setAuthLoading(false); // Нет токена, загрузку не начинаем
            setCurrentUser(null); // Убедимся, что пользователь сброшен
        }
    }, [fetchCurrentUser]); // Зависимость от fetchCurrentUser

    // Слушаем кастомное событие UNAUTHORIZED_EVENT
    useEffect(() => {
        const handleUnauthorized = () => {
            console.log("App.tsx: Caught 'unauthorized' event.");
            setToken(null);
            setCurrentUser(null);
            if (location.pathname !== '/login') {
                console.log("Navigating to /login due to unauthorized event.");
                navigate('/login', { replace: true });
            }
        };

        window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
        return () => {
            window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
        };
    }, [navigate, location.pathname]);

    const handleLogin = (newToken: string) => {
        localStorage.setItem('accessToken', newToken);
        setToken(newToken);
        setAuthLoading(true); // Начинаем загрузку данных пользователя
        fetchCurrentUser(newToken);
    };

    const handleLogout = () => {
        localStorage.removeItem('accessToken');
        setToken(null);
        setCurrentUser(null);
        // Редирект на /login при выходе
        if (location.pathname !== '/login') {
           navigate('/login', { replace: true });
        }
    };

    if (authLoading) {
        return <div>Проверка аутентификации...</div>;
    }

    return (
        <>
            <Navbar user={currentUser} onLogout={handleLogout} />
            <main className="main-content">
                <Routes>
                    <Route path="/login" element={<LoginPage onLoginSuccess={handleLogin} />} />
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Защищенные роуты */}
                    <Route path="/atms/:id/edit" element={<ProtectedRoute><ATMEditPage currentUser={currentUser} /></ProtectedRoute>} />
                    <Route path="/atms/new" element={<ProtectedRoute><ATMCreatePage currentUser={currentUser} /></ProtectedRoute>} />
                    <Route path="/atms/:id/logs" element={<ProtectedRoute><ATMLogsPage /></ProtectedRoute>} />
                    <Route path="/atms" element={<ProtectedRoute><ATMsPage /></ProtectedRoute>} />
                    <Route path="/atms/:id" element={<ProtectedRoute><ATMDetailPage currentUser={currentUser} /></ProtectedRoute>} />
                    <Route
                        path="/users"
                        element={
                            <ProtectedRoute>
                                {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin')
                                    ? <UserManagementPage currentUser={currentUser} />
                                    : <Navigate to="/atms" replace />
                                }
                            </ProtectedRoute>
                        }
                    />
                    {/* Если пользователь авторизован, / и * ведут на /atms, иначе на /login */}
                    <Route path="/" element={token ? <Navigate to="/atms" replace /> : <Navigate to="/login" replace />} />
                    <Route path="*" element={token ? <Navigate to="/atms" replace /> : <Navigate to="/login" replace />} />
                </Routes>
            </main>
        </>
    );
};

// Основной компонент App
function App() {
    return (
        <Router>
            <AppContent /> {/* Используем AppContent для доступа к хукам роутера */}
        </Router>
    );
}

export default App;