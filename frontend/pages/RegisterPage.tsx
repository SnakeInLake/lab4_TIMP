// src/pages/RegisterPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import styles from './FormStyles.module.css'; // Используем те же стили

const RegisterPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null | string[]>(null); // Ошибка может быть строкой или массивом ошибок валидации
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const userData = { username, email, password };

    try {
      await apiClient.post('/auth/signup', userData);
      // После успешной регистрации перенаправляем на страницу входа
      navigate('/login');
      // Можно добавить сообщение об успехе
      alert('Регистрация прошла успешно! Пожалуйста, войдите.');

    } catch (err: any) {
      console.error("Registration error:", err);
      if (err.response && err.response.data && err.response.data.detail) {
        const errorDetail = err.response.data.detail;
        // Ошибки валидации (422) приходят как массив объектов
        if (Array.isArray(errorDetail)) {
          setError(errorDetail.map(e => `${e.msg}`).join('; '));
        } else {
          // Другие ошибки (например, 400 - email/username занят) приходят как строка
          setError(errorDetail);
        }
      } else if (err.message) {
         setError(`Ошибка регистрации: ${err.message}`);
      } else {
        setError('Произошла ошибка регистрации.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Функция для отображения ошибок
  const renderError = () => {
      if (!error) return null;
      // Можно сделать более красивое отображение списка ошибок валидации
      return <p className={styles.errorText}>{error}</p>;
  }

  return (
    <div className={styles.formContainer}>
      <h2>Регистрация</h2>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="register-username">Имя пользователя:</label>
          <input
            type="text"
            id="register-username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            minLength={3} // Добавляем базовую валидацию HTML5
            className={styles.formInput}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="register-email">Email:</label>
          <input
            type="email"
            id="register-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={styles.formInput}
          />
        </div>
        <div className={styles.formGroup}>
          <label htmlFor="register-password">Пароль:</label>
          <input
            type="password"
            id="register-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8} // Добавляем базовую валидацию HTML5
            className={styles.formInput}
          />
           <small>Минимум 8 символов, заглавные/строчные буквы, цифры.</small>
        </div>
        {renderError()}
        <button type="submit" disabled={loading} className={styles.submitButton}>
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  );
};

export default RegisterPage;