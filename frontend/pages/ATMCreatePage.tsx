// src/pages/ATMCreatePage.tsx
import React, { useState, useEffect, useCallback } from 'react'; // Убрали useCallback, если fetchData не нужен
import { useNavigate } from 'react-router-dom';
import apiClient from '../services/api';
import type { ATMCreatePayload, ATMStatus, User } from '../src/types'; // Нужен тип для создания
import styles from './FormStyles.module.css';

// Определяем пропсы (для currentUser, если он нужен для каких-то проверок, хотя для создания обычно нет)
interface ATMCreatePageProps {
    currentUser: User | null; // Пока оставим, может пригодиться для логики по умолчанию
}

const ATMCreatePage: React.FC<ATMCreatePageProps> = ({ currentUser }) => {
  const navigate = useNavigate();
    if (currentUser) { // Просто проверка, чтобы "использовать"
      console.log("User creating ATM"); // Например, для отладки
  }

  // Состояния формы (аналогичны полям в ATMCreate схеме на бэкенде)
  const [atmUid, setAtmUid] = useState('');
  const [location, setLocation] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [statusId, setStatusId] = useState<number | ''>(''); // Используем '' для пустого значения в select

  // Состояния для загрузки справочников и ошибок
  const [statuses, setStatuses] = useState<ATMStatus[]>([]);
  const [loadingStatuses, setLoadingStatuses] = useState<boolean>(true); // Отдельный лоадер для статусов
  const [saving, setSaving] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Функция загрузки списка статусов
  const fetchStatuses = useCallback(async () => {
     setLoadingStatuses(true);
     setFormError(null); // Сбрасываем ошибку формы при новой загрузке
     try {
        const statusesResponse = await apiClient.get<ATMStatus[]>('/atms/statuses/');
        setStatuses(statusesResponse.data);
        // Установить статус по умолчанию, если нужно. Например, первый из списка.
        // if (statusesResponse.data.length > 0) {
        //   setStatusId(statusesResponse.data[0].id);
        // }
     } catch (err: any) {
        console.error("Failed to fetch ATM statuses:", err);
        setFormError(err.response?.data?.detail || err.message || 'Не удалось загрузить список статусов.');
     } finally {
        setLoadingStatuses(false);
     }
  }, []); // Нет зависимостей, вызывается один раз

  useEffect(() => {
      fetchStatuses();
  }, [fetchStatuses]);

  // Обработчик сохранения (создания)
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFormError(null);

    // Проверка, что статус выбран
    if (statusId === '') {
        setFormError("Пожалуйста, выберите статус банкомата.");
        setSaving(false);
        return;
    }

    const createData: ATMCreatePayload = { // Используем тип для создания
        atm_uid: atmUid,
        location_description: location || null, // Отправляем null, если пустая строка
        ip_address: ipAddress || null,       // Отправляем null, если пустая строка
        status_id: Number(statusId),         // Убедимся, что это число
    };

    try {
        // Эндпоинт для создания: POST /atms/
        const response = await apiClient.post('/atms/', createData);
        alert(`Банкомат ${response.data.atm_uid} успешно создан.`);
        navigate(`/atms/${response.data.id}`); // Перенаправляем на страницу деталей нового ATM
    } catch (err: any) {
        console.error("Failed to create ATM:", err);
        let errorMessage = 'Не удалось создать банкомат.';
        if (err.response?.data?.detail) {
            const details = err.response.data.detail;
            if (Array.isArray(details)) {
                errorMessage = details.map(d => d.msg || `${d.loc?.join('.')} - ${d.type}`).join('; ');
            } else if (typeof details === 'string') {
                errorMessage = details;
            } else {
                errorMessage = JSON.stringify(details);
            }
        } else if (err.message) {
            errorMessage = err.message;
        }
        setFormError(errorMessage);
    } finally {
        setSaving(false);
    }
  };

  if (loadingStatuses) return <div>Загрузка списка статусов...</div>;
  // Ошибку загрузки статусов мы отобразим в formError ниже

  return (
    <div className={styles.formContainer}>
        <h2>Создать Новый Банкомат</h2>
        <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
                <label htmlFor="create-atm-uid">UID Банкомата:</label>
                <input
                    type="text"
                    id="create-atm-uid"
                    value={atmUid}
                    onChange={(e) => setAtmUid(e.target.value)}
                    required
                    className={styles.formInput}
                    placeholder="Только цифры, например, 12345678"
                />
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="create-location">Местоположение (опционально):</label>
                <input
                    type="text"
                    id="create-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={styles.formInput}
                    placeholder="Например, ул. Ленина, 1, ТЦ 'Мега'"
                />
            </div>
            <div className={styles.formGroup}>
                <label htmlFor="create-ip">IP Адрес (опционально):</label>
                <input
                    type="text"
                    id="create-ip"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className={styles.formInput}
                    placeholder="Например, 192.168.1.100"
                />
            </div>
             <div className={styles.formGroup}>
                <label htmlFor="create-status">Статус:</label>
                <select
                    id="create-status"
                    value={statusId}
                    onChange={(e) => setStatusId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    required // Статус обязателен для создания
                    className={styles.formInput}
                >
                    <option value="" disabled>-- Выберите статус --</option>
                    {statuses.map(status => (
                        <option key={status.id} value={status.id}>
                            {status.name}
                        </option>
                    ))}
                </select>
            </div>

            {formError && <p className={styles.errorText}>{formError}</p>}

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '25px' }}>
                <button
                    type="button"
                    onClick={() => navigate('/atms')} // Назад к списку ATM
                    className={styles.submitButton}
                    style={{ backgroundColor: '#6c757d', width: '48%'}}
                    disabled={saving}
                >
                    Отмена
                </button>
                <button
                    type="submit"
                    disabled={saving || loadingStatuses} // Блокируем во время отправки или если статусы еще грузятся
                    className={styles.submitButton}
                    style={{ width: '48%'}}
                >
                    {saving ? 'Создание...' : 'Создать банкомат'}
                </button>
            </div>
        </form>
    </div>
  );
};

export default ATMCreatePage;