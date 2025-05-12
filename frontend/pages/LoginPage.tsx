// src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Для редиректа после логина
import apiClient from '../services/api'; // Наш axios клиент
import styles from './FormStyles.module.css'; // Импортируем стили

// Типизируем пропсы, включая onLoginSuccess
interface LoginPageProps {
  onLoginSuccess: (token: string) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null); // Для отображения ошибок API
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate(); // Хук для навигации

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Предотвращаем стандартную отправку формы
    setError(null);
    setLoading(true);

    // Axios ожидает form-data для login/token
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    try {
      const response = await apiClient.post('/auth/login/token', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      
      const accessToken = response.data.access_token;
      onLoginSuccess(accessToken); // Передаем токен в App.tsx
      navigate('/'); // Перенаправляем на главную страницу (Dashboard)
      
    } catch (err: any) { // Используем any или более специфичный тип AxiosError
      console.error("Login error:", err);
      if (err.response && err.response.data && err.response.data.detail) {
          // Показываем ошибку от API (например, "Incorrect username or password")
          setError(err.response.data.detail);
      } else if (err.message) {
        setError(`Ошибка входа: ${err.message}`);
      } else {
        setError('Произошла ошибка входа.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.formContainer}>
      <h2>Вход в систему</h2>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="login-username">Имя пользователя:</label>
          <input
            type="text"
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className={styles.formInput}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="login-password">Пароль:</label>
          <input
            type="password"
            id="login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.formInput}
          />
        </div>
        {error && <p className={styles.errorText}>{error}</p>}
        <button type="submit" disabled={loading} className={styles.submitButton}>
          {loading ? 'Вход...' : 'Войти'}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;