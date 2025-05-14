// src/pages/LoginPage.test.tsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom'; // LoginPage может использовать хуки роутера
import LoginPage from './LoginPage'; // Путь к твоему LoginPage

// Мокаем функцию onLoginSuccess, так как она приходит из пропсов и нам не важна ее реализация в этом тесте
const mockOnLoginSuccess = jest.fn();

// Мокаем модуль apiClient, чтобы избежать реальных HTTP запросов
jest.mock('../services/api', () => ({
  __esModule: true, // Для ES6 модулей
  default: {
    post: jest.fn(), // Мокаем метод post
    // Добавь другие методы, если LoginPage их использует
  },
}));


describe('LoginPage Component', () => {
  beforeEach(() => {
    // Сбрасываем моки перед каждым тестом
    mockOnLoginSuccess.mockClear();
    // Если apiClient.post был мокнут через jest.mock, его можно сбросить так:
    // require('../services/api').default.post.mockClear();
  });

  test('renders login form elements', () => {
    render(
      <BrowserRouter> {/* Оборачиваем в BrowserRouter, если LoginPage использует Link или useNavigate */}
        <LoginPage onLoginSuccess={mockOnLoginSuccess} />
      </BrowserRouter>
    );

    // Проверяем наличие заголовка
    expect(screen.getByRole('heading', { name: /вход в систему/i })).toBeInTheDocument();

    // Проверяем наличие поля для имени пользователя (по label тексту)
    expect(screen.getByLabelText(/имя пользователя/i)).toBeInTheDocument();

    // Проверяем наличие поля для пароля
    expect(screen.getByLabelText(/пароль/i)).toBeInTheDocument();

    // Проверяем наличие кнопки входа
    expect(screen.getByRole('button', { name: /войти/i })).toBeInTheDocument();
  });

  // Можно добавить тест на попытку отправки формы, но это уже сложнее
  // и требует мокирования ответа apiClient.post
  // test('calls onLoginSuccess on successful login', async () => {
  //   // ...
  // });
});